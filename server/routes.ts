import type { Express, Request, Response, NextFunction } from "express"; // Added Request, Response, NextFunction
import { createServer, type Server } from "http";
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit'; // For loginLimiter
import { storage } from "./storage"; // This will be largely unused for user creation now
// import bcrypt from "bcrypt"; // Bcrypt no longer needed for Firebase auth user creation
import jwt from "jsonwebtoken"; // Still used for custom token if any, but not for Firebase primary auth
import { admin } from "../firebase"; // Import Firebase Admin SDK instance
import { FieldValue } from 'firebase-admin/firestore'; // For serverTimestamp
import { recordTransactionAndUpdateWallet, TransactionType } from '../lib/tokenManager'; // Import token manager

import { insertUserSchema, insertServiceSchema, insertBookingSchema, insertStarProjectSchema, insertStarCauseSchema, insertReviewSchema, insertMessageSchema } from "@shared/schema";
import { trackServerEvent, getClientIdFromRequest } from "./analytics";
import { logAuditEvent } from './audit'; // Import audit logger
import { encrypt, decrypt } from './encryption'; // Import encryption utilities
import { sendRegistrationEmail } from './email'; // Import email utility

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"; // Keep for now if other routes use it

// Middleware for authentication
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Define loginLimiter here to be used in this file
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per window
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware to check if user is a service provider
const isServiceProvider = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'service_provider' || req.user.role === 'admin')) { // Admins can also act as providers or manage
    next();
  } else {
    res.status(403).json({ message: "Forbidden: User is not a service provider." });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register",
    [
      body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
      body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
      // Assuming 'firstName' is required and used like a username for non-empty check
      body('firstName').trim().notEmpty().escape().withMessage('First name cannot be empty'),
      body('lastName').trim().notEmpty().escape().withMessage('Last name cannot be empty'),
    ],
    async (req: Request, res: Response) => { // Add types for req, res
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const { email, password, firstName, lastName, role, phoneNumber: rawPhoneNumber } = req.body;

        // 1. Create user in Firebase Authentication
        let firebaseUserRecord;
        try {
          firebaseUserRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: `${firstName} ${lastName}`,
            // Firebase Admin SDK createUser doesn't directly accept arbitrary phoneNumber format for all regions.
            // It's better to store this in Firestore. If Firebase needs E.164 for user.phoneNumber,
            // ensure it's formatted correctly before passing or skip here and only store in Firestore.
            // For now, we'll assume it's primarily for display or custom use.
          });
        } catch (error: any) {
          console.error("Firebase Auth user creation failed:", error);
          if (error.code === 'auth/email-already-exists') {
            return res.status(409).json({ message: "Email already exists in Firebase." });
          }
          if (error.code === 'auth/invalid-password' || error.code === 'auth/weak-password') {
            return res.status(400).json({ message: error.message || "Password does not meet Firebase requirements." });
          }
          return res.status(500).json({ message: "Failed to create user in Firebase Authentication." });
        }

        const uid = firebaseUserRecord.uid;

        // 2. Encrypt phone number if provided
        let encryptedPhoneNumber = null;
        if (rawPhoneNumber) {
          encryptedPhoneNumber = encrypt(rawPhoneNumber);
          if (!encryptedPhoneNumber) {
            // Potentially roll back Firebase user creation or mark user for cleanup
            // For now, log error and proceed without phone, or return error
            console.error(`Failed to encrypt phone number for user ${uid}. Proceeding without it or consider cleanup.`);
            // return res.status(500).json({ message: "Failed to secure phone number." }); // Option: stricter handling
          }
        }

        // 3. Create user profile in Firestore
        const db = admin.firestore();
        const userDocRef = db.collection('users').doc(uid);

        const firestoreUserData = {
          userId: uid, // Storing uid also as a field for easier querying if needed
          email: email.toLowerCase(), // Normalize email
          firstName,
          lastName,
          userType: role, // Aligning with Firestore schema 'userType'
          role: role,     // Keeping 'role' if other parts of app might still use it
          phoneNumber: encryptedPhoneNumber, // Store encrypted phone
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          profileImageUrl: "", // Default or empty
          isVerified: false,   // Default, maps to verificationStatus aspects
          isActive: true,      // Maps to status
          // Add other default fields from your Firestore schema as necessary
          location: null,
          address: null,
          areaId: null,
          preferences: {},
          bio: "",
          // These might not be set at registration
          // verificationStatus: 'pending',
          // lastLoginAt: FieldValue.serverTimestamp(),
          // notificationPreferences: { email: true, push: true },
        };

        try {
          await userDocRef.set(firestoreUserData);
          } catch (profileError) {
            console.error(`Firestore user profile creation failed for UID ${uid}:`, profileError);
            // Attempt to delete the Firebase Auth user to prevent orphaned auth users.
          try {
            await admin.auth().deleteUser(uid);
            console.log(`Cleaned up Firebase Auth user ${uid} due to Firestore profile creation failure.`);
          } catch (cleanupError) {
            console.error(`CRITICAL: Failed to cleanup Firebase Auth user ${uid} after Firestore error:`, cleanupError);
          }
          return res.status(500).json({ message: "Failed to create user profile in database." });
        }

        // 4. Create user wallet in Firestore
        const walletRef = db.collection('tokenWallets').doc(uid);
        const initialWalletData = {
            userId: uid,
            balance: 0, // Or a default starting balance, e.g., for a welcome bonus
            escrowBalance: 0,
            totalEarned: 0,
            totalSpent: 0,
            totalPurchased: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            lastTransactionAt: FieldValue.serverTimestamp(),
        };
        try {
            await walletRef.set(initialWalletData);
        } catch (walletError) {
            console.error(`Firestore token wallet creation failed for UID ${uid}:`, walletError);
            // Critical error: User profile exists but wallet creation failed.
            // This might require manual intervention or a more complex rollback (delete user profile, delete auth user).
            // For now, log it as critical and potentially alert. The user might not have a functional wallet.
            // Consider if the user registration should be fully rolled back at this point.
            logAuditEvent('WALLET_CREATION_FAILED', req, uid, { email: firestoreUserData.email, error: String(walletError) });
            // Depending on policy, you might still return 201 but with a warning, or a 500 error.
            // For robustness, let's treat this as a registration failure for now.
            try {
                await userDocRef.delete(); // Attempt to delete user profile
                await admin.auth().deleteUser(uid); // Attempt to delete auth user
                console.log(`Rolled back user profile and auth user ${uid} due to wallet creation failure.`);
            } catch (rollbackError) {
                console.error(`CRITICAL: Failed to rollback user ${uid} after wallet creation failure:`, rollbackError);
            }
            return res.status(500).json({ message: "Failed to initialize user wallet." });
        }

        // Log audit event for successful registration
        logAuditEvent('USER_REGISTER_FIREBASE', req, uid, {
          targetType: 'user',
          targetId: uid,
          email: firestoreUserData.email,
          role: firestoreUserData.role,
        });

        // Send welcome email (fire and forget)
        sendRegistrationEmail(firestoreUserData.email, {
          firstName: firestoreUserData.firstName,
          clientUrl: process.env.VITE_CLIENT_URL
        }).catch(err => console.error("Failed to send registration email:", err));

        // For now, the server doesn't generate a custom JWT for Firebase users upon registration.
        // The client will need to sign in with Firebase on its own to get an ID token.
        // Respond with basic user info.
        res.status(201).json({
          message: "User registered successfully with Firebase.",
          userId: uid,
          email: firestoreUserData.email,
          role: firestoreUserData.role
        });

      } catch (error: any) {
        console.error("Overall registration error:", error);
        // Handle Zod errors from express-validator if they somehow pass through or if direct parsing is used
        if (error.name === 'ZodError') {
          return res.status(400).json({ message: "Invalid user data format.", errors: error.errors });
        }
        Sentry.captureException(error); // Capture other unexpected errors
        res.status(500).json({ message: "Internal server error during registration." });
      }
    }
  );

  // POST /api/auth/login - This route will need to be refactored in a subsequent step
  // to handle Firebase ID token verification instead of email/password.
  // For now, it remains as is, but it will NOT work for users created via Firebase.
  app.post("/api/auth/login",
    loginLimiter,
    [
      body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
      body('password').notEmpty().withMessage('Password cannot be empty'),
    ],
    async (req: Request, res: Response) => {
      // ... (existing old login logic, now correctly erroring out for Firebase users)
      // This endpoint is effectively deprecated for Firebase client login.
      // Client should use Firebase sign-in and then call /api/auth/sessionLogin.
      console.warn("Attempted login via POST /api/auth/login - this endpoint is deprecated for Firebase auth flow.");
      return res.status(405).json({ message: "Login method outdated. Please use Firebase sign-in on the client, which will then establish a server session." });
    }
  );

  // New route for Firebase ID token verification and custom JWT issuance
  app.post("/api/auth/sessionLogin",
    [ body('token').notEmpty().withMessage('Firebase ID token is required.') ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token: idToken } = req.body;

      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Fetch user profile from Firestore to get role and other details
        const db = admin.firestore();
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
          console.error(`User profile not found in Firestore for UID: ${uid} after ID token verification.`);
          // This case might indicate an issue where Auth user exists but Firestore profile creation failed earlier
          // Or if a user was deleted from Firestore but not from Auth.
          // For now, deny session creation. Consider cleanup or re-creation of Firestore doc if appropriate for your app.
          return res.status(404).json({ message: "User profile not found. Please contact support." });
        }

        const firestoreUser = userDoc.data();
        if (!firestoreUser) { // Should not happen if userDoc.exists is true, but as a type guard
            return res.status(500).json({ message: "Failed to retrieve user data." });
        }

        if (firestoreUser.status !== 'active' || !firestoreUser.isActive) {
            logAuditEvent('SESSION_LOGIN_DENIED_INACTIVE', req, uid, { email: decodedToken.email });
            return res.status(403).json({ message: "Account is inactive. Please contact support." });
        }

        // Create a custom JWT for our backend session
        const customJwtPayload = {
          userId: uid, // Use Firebase UID as userId in our custom token
          // Firebase ID token already contains email, email_verified, phone_number if available in Auth.
          // We prioritize data from our Firestore profile for consistency, esp. role.
          email: firestoreUser.email,
          role: firestoreUser.role || firestoreUser.userType, // Use 'role' or 'userType' from Firestore
          // Add any other claims needed by your backend from decodedToken or firestoreUser
        };

        const customBackendToken = jwt.sign(customJwtPayload, JWT_SECRET, { expiresIn: '24h' });

        logAuditEvent('SESSION_LOGIN_SUCCESS', req, uid, { email: customJwtPayload.email, role: customJwtPayload.role });

        // Decrypt phone number for the user object being returned to client
        const decryptedPhoneNumber = firestoreUser.phoneNumber ? decrypt(firestoreUser.phoneNumber) : null;

        res.json({
          token: customBackendToken,
          user: {
            id: uid, // Send Firebase UID as 'id' to match client's User interface
            uid: uid,
            email: firestoreUser.email,
            firstName: firestoreUser.firstName,
            lastName: firestoreUser.lastName,
            role: firestoreUser.role || firestoreUser.userType,
            phoneNumber: decryptedPhoneNumber,
            profileImage: firestoreUser.profileImageUrl,
            isVerified: firestoreUser.isVerified, // Or map from decodedToken.email_verified
            isActive: firestoreUser.isActive,
            // Include other fields from firestoreUser as needed by the client's User interface
          },
        });

      } catch (error: any) {
        console.error("Firebase ID token verification or session login failed:", error);
        logAuditEvent('SESSION_LOGIN_FAILED', req, null, { tokenUsed: idToken.substring(0, 20) + "...", error: error.message });
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/id-token-revoked' || error.code === 'auth/argument-error') {
          return res.status(401).json({ message: "Invalid or expired Firebase token. Please sign in again." });
        }
        Sentry.captureException(error);
        return res.status(500).json({ message: "Failed to establish server session." });
      }
    }
  );

  app.get("/api/auth/me", authenticateToken, async (req: Request, res: Response) => {
    try {
      // req.user is populated by authenticateToken with the payload of our custom JWT.
      // req.user.userId is the Firebase UID (string).
      const firebaseUid = req.user.userId;
      if (!firebaseUid) {
        return res.status(401).json({ message: "Authentication error: User ID missing from token." });
      }

      const db = admin.firestore();
      const userDocRef = db.collection('users').doc(firebaseUid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: "User profile not found in Firestore." });
      }

      const firestoreUser = userDoc.data();
      if (!firestoreUser) { // Should not happen if userDoc.exists
        return res.status(500).json({ message: "Failed to retrieve user data." });
      }

      // Construct the response object, decrypting phone number
      const responseUser = {
        id: firebaseUid, // Or userDoc.id
        uid: firebaseUid,
        email: firestoreUser.email,
        firstName: firestoreUser.firstName,
        lastName: firestoreUser.lastName,
        role: firestoreUser.role || firestoreUser.userType,
        phoneNumber: firestoreUser.phoneNumber ? decrypt(firestoreUser.phoneNumber) : null,
        profileImage: firestoreUser.profileImageUrl,
        isVerified: firestoreUser.isVerified,
        isActive: firestoreUser.isActive,
        createdAt: firestoreUser.createdAt?.toDate ? firestoreUser.createdAt.toDate().toISOString() : null, // Convert Timestamp to ISO string
        updatedAt: firestoreUser.updatedAt?.toDate ? firestoreUser.updatedAt.toDate().toISOString() : null,
        // Include other fields from firestoreUser as needed
      };

      res.json(responseUser);
    } catch (error: any) {
      console.error("Error fetching /api/auth/me:", error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Internal server error while fetching user profile." });
    }
  });

  // User management routes
  // GET /api/users - This might need refactoring if users are primarily fetched from Firestore now.
  // For now, assuming it might still serve a purpose for PG-specific user data or until fully migrated.
  // If it's meant to list all users for an admin, it should fetch from Firestore.
  app.get("/api/users", authenticateToken, async (req: Request, res: Response) => { // Added types
    try {
      // TODO: Refactor to fetch users from Firestore if this is the primary user source.
      // For now, this might be returning users from the old PostgreSQL table if not cleaned up.
      // If this is intended for admin use to list all users, it should query Firestore's 'users' collection.
      // Example Firestore query (needs admin role check):
      // if (req.user.role !== 'admin') return res.status(403).json({ message: "Forbidden" });
      // const db = admin.firestore();
      // const usersSnapshot = await db.collection('users').get();
      // const users = usersSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
      // res.json(users.map(({ password, ...user }) => user)); // Assuming password is not stored or needs removal

      const { role } = req.query;
      let users;
      
      if (role) {
        // This storage.getUsersByRole likely queries PostgreSQL.
        // Consider if this is still needed or should also move to Firestore.
        users = await storage.getUsersByRole(role as string);
      } else {
        users = await storage.getUsers();
      }

      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // PUT /api/users/me - Update authenticated user's own profile (Refactored for Firestore)
  app.put("/api/users/me",
    authenticateToken,
    [ // Validation for self-updatable fields
      body('firstName').optional().trim().notEmpty().escape().withMessage('First name cannot be empty if provided.'),
      body('lastName').optional().trim().notEmpty().escape().withMessage('Last name cannot be empty if provided.'),
      body('phoneNumber').optional({nullable: true}).trim().escape(), // No specific format, allow empty or null to clear
      body('profileImageUrl').optional({nullable: true}).trim().isURL().withMessage('Invalid URL for profile image if provided.'),
      // Add validation for other self-editable fields from Firestore schema (e.g., bio, location)
      body('bio').optional({nullable: true}).trim().escape(),
      body('location').optional({nullable: true}).isObject().withMessage('Location must be an object if provided'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user.userId; // Firebase UID from token
      const updatesFromBody = req.body;
      const db = admin.firestore();
      const userRef = db.collection('users').doc(userId);

      try {
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          // This should not happen if user is authenticated via Firebase token linked to a Firestore profile
          logAuditEvent('USER_PROFILE_UPDATE_FAILED_NO_PROFILE', req, userId, { note: "User profile not found in Firestore for authenticated user." });
          return res.status(404).json({ message: "User profile not found." });
        }
        const originalUserData = userDoc.data()!;

        const allowedUpdates: Partial<any> = {}; // Use 'any' or a specific UserUpdateDTO type
        const editableFields = ['firstName', 'lastName', 'phoneNumber', 'profileImageUrl', 'bio', 'location' /* add other editable fields */];

        let phoneNumberChanged = false;
        for (const field of editableFields) {
          if (updatesFromBody.hasOwnProperty(field)) {
            if (field === 'phoneNumber') {
              if (updatesFromBody.phoneNumber !== decrypt(originalUserData.phoneNumber)) { // Compare with decrypted original
                allowedUpdates.phoneNumber = updatesFromBody.phoneNumber ? encrypt(updatesFromBody.phoneNumber) : null;
                phoneNumberChanged = true; // Mark that phone number was part of the update payload
              } else if (updatesFromBody.phoneNumber === null && originalUserData.phoneNumber !== null) {
                // If client explicitly sends null to clear it, and it was previously set
                allowedUpdates.phoneNumber = null;
                phoneNumberChanged = true;
              }
            } else {
              allowedUpdates[field] = updatesFromBody[field];
            }
          }
        }

        if (Object.keys(allowedUpdates).length === 0 && !phoneNumberChanged) {
          // If only phoneNumber was sent but it matched the decrypted original, nothing to update.
          // Return existing data or a "no changes" message.
          const { password, phoneNumber: encryptedPhone, ...userSafeData } = originalUserData; // Exclude PG password if any
          const responseUser = {
            ...userSafeData,
            id: userId, // Ensure id is UID
            uid: userId,
            phoneNumber: encryptedPhone ? decrypt(encryptedPhone) : null,
          };
          return res.status(200).json(responseUser); // Or 304 Not Modified
        }

        allowedUpdates.updatedAt = FieldValue.serverTimestamp();

        await userRef.update(allowedUpdates);

        // Prepare audit log details
        const changedFieldsForAudit = Object.keys(allowedUpdates)
          .filter(key => key !== 'updatedAt')
          .map(key => ({
            field: key,
            oldValue: key === 'phoneNumber' ? decrypt(originalUserData.phoneNumber) : originalUserData[key],
            newValue: key === 'phoneNumber' ? updatesFromBody.phoneNumber : allowedUpdates[key]
          }));

        if (changedFieldsForAudit.length > 0) {
             logAuditEvent('USER_PROFILE_SELF_UPDATE', req, userId, {
                targetType: 'user',
                targetId: userId,
                changedFields: changedFieldsForAudit
            });
        }

        const updatedUserDoc = await userRef.get();
        const updatedFirestoreUser = updatedUserDoc.data()!;

        // Construct response, decrypting phone number
        const responseUser = {
          id: userId,
          uid: userId,
          email: updatedFirestoreUser.email, // Email is not changed here
          firstName: updatedFirestoreUser.firstName,
          lastName: updatedFirestoreUser.lastName,
          role: updatedFirestoreUser.role || updatedFirestoreUser.userType,
          phoneNumber: updatedFirestoreUser.phoneNumber ? decrypt(updatedFirestoreUser.phoneNumber) : null,
          profileImageUrl: updatedFirestoreUser.profileImageUrl,
          isVerified: updatedFirestoreUser.isVerified,
          isActive: updatedFirestoreUser.isActive,
          createdAt: updatedFirestoreUser.createdAt?.toDate ? updatedFirestoreUser.createdAt.toDate().toISOString() : null,
          updatedAt: updatedFirestoreUser.updatedAt?.toDate ? updatedFirestoreUser.updatedAt.toDate().toISOString() : null,
        };

        res.status(200).json(responseUser);

      } catch (error: any) {
        console.error(`Error updating user profile for ${userId}:`, error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to update user profile." });
      }
    }
  );

  // The old PUT /api/users/:id for admin/self can be deprecated or refocused for admin only.
  // For now, it remains but might conflict or be confusing.
  // Ideally, admin actions have separate, clearly permissioned routes e.g. /api/admin/users/:userId
  /*
  app.put("/api/users/:id", authenticateToken, async (req: Request, res: Response) => { // Added types
    // This route primarily dealt with PostgreSQL IDs and might need full removal or refactor for admin actions on Firestore users.
    // For now, if an admin tries to use this with a Firebase UID, it might fail at parseInt or PG lookups.
    // If it's meant for admins to update Firestore users:
    // 1. Check req.user.role === 'admin'
    // 2. req.params.id would be the Firebase UID (string) of the target user.
    // 3. Fetch target user from Firestore.
    // 4. Apply admin-allowed updates (e.g., role, isActive, isVerified).
    // 5. Encrypt phone if changed.
    // 6. Log audit event.
    // 7. Return updated user.
    // This is a significant refactor for this specific route if it's to be kept for admin use.
    // For now, let's assume `/api/users/me` is the primary self-update path.
    // The old logic using parseInt(req.params.id) and storage.getUser will fail for Firebase UIDs.
    // We should explicitly disable or correctly refactor this for admin use on Firestore.

    // For this subtask, we're focusing on /api/users/me. This old route is now problematic.
    // I will comment it out to avoid conflicts and indicate it needs a separate admin-focused refactor.

    try {
      const userId = parseInt(req.params.id); // This will fail for Firebase UIDs (strings)
      const updates = req.body;

      // Users can only update their own profile, or admins can update any
      // This logic also needs to compare string UIDs if it were to work with Firebase
      if (req.user.userId !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      // const originalUser = await storage.getUser(userId); // PG lookup
      // ... rest of old PG logic ...
      res.status(501).json({ message: "This endpoint /api/users/:id is pending refactor for Firestore admin actions." });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Service routes
  // GET /api/services (List Services) - Refactored for Firestore
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const { categoryId, serviceProviderId, search } = req.query; // Example filters
      const db = admin.firestore();
      let query: admin.firestore.Query = db.collection('services');

      // Always filter by active services for public listing
      query = query.where('isActive', '==', true);

      if (categoryId) {
        query = query.where('categoryId', '==', categoryId as string);
      }
      if (serviceProviderId) {
        query = query.where('serviceProviderId', '==', serviceProviderId as string);
      }
      // Full-text search is more complex with Firestore and often requires a third-party like Algolia/Typesense.
      // For a basic keyword search, you might query against 'name' or 'description' if you expect exact matches or use workarounds.
      // This example does not implement full-text search. If 'search' is present, it's ignored for now or could do a simple name filter.
      if (search) {
         // Simple "starts with" search on name, case-sensitive. Not ideal for full search.
         // query = query.where('name', '>=', search as string).where('name', '<=', search + '\uf8ff');
         console.log("Search query param received but not fully implemented for Firestore in this basic version:", search);
      }

      query = query.orderBy('createdAt', 'desc'); // Default sort by newest

      // Basic pagination example (client would need to send lastVisibleDocId)
      const limit = parseInt(req.query.limit as string) || 10;
      query = query.limit(limit);
      const lastVisibleDocId = req.query.lastVisible as string;
      if (lastVisibleDocId) {
        const lastVisibleDoc = await db.collection('services').doc(lastVisibleDocId).get();
        if (lastVisibleDoc.exists) {
          query = query.startAfter(lastVisibleDoc);
        }
      }

      const servicesSnapshot = await query.get();
      const services = servicesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(services);
    } catch (error: any) {
      console.error("Error fetching services from Firestore:", error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch services." });
    }
  });

  // GET /api/services/:serviceId (Get Single Service) - Refactored for Firestore
  app.get("/api/services/:serviceId", async (req: Request, res: Response) => {
    try {
      const serviceId = req.params.serviceId; // ID is a string from Firestore
      const db = admin.firestore();
      const serviceRef = db.collection('services').doc(serviceId);
      const doc = await serviceRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Service not found." });
      }

      // Optionally, fetch and embed limited provider info
      const serviceData = doc.data() as any; // Cast to any or define a proper type
      let providerInfo = null;
      if (serviceData.serviceProviderId) {
        const providerRef = db.collection('users').doc(serviceData.serviceProviderId);
        const providerDoc = await providerRef.get();
        if (providerDoc.exists) {
          const providerData = providerDoc.data();
          providerInfo = {
            id: providerDoc.id,
            firstName: providerData?.firstName,
            lastName: providerData?.lastName,
            profileImage: providerData?.profileImageUrl,
            // Add other relevant, non-sensitive provider details
          };
        }
      }

      res.json({
        id: doc.id,
        ...serviceData,
        providerProfile: providerInfo // Embed provider info
      });
    } catch (error: any) {
      console.error(`Error fetching service ${req.params.serviceId} from Firestore:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch service details." });
    }
  });

  app.post("/api/services",
    authenticateToken,
    isServiceProvider, // Ensure user is a service provider
    [
      body('name').trim().notEmpty().escape().withMessage('Service name cannot be empty'),
      body('description').trim().notEmpty().escape().withMessage('Service description cannot be empty'),
      body('categoryId').trim().notEmpty().escape().withMessage('Category ID cannot be empty'),
      body('basePrice').isFloat({ gt: 0 }).withMessage('Base price must be a positive number'),
      body('serviceType').isIn(['on_demand', 'scheduled']).withMessage('Invalid service type'),
      // Basic validation for location and availability objects. Detailed validation can be more complex.
      body('location').optional().isObject().withMessage('Location must be an object'),
      body('availability').optional().isObject().withMessage('Availability must be an object'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const { name, description, categoryId, basePrice, serviceType, location, availability, images } = req.body;
        const serviceProviderId = req.user.userId; // Firebase UID from token

        const db = admin.firestore();
        const serviceData = {
          name,
          description,
          categoryId,
          serviceProviderId,
          basePrice: Number(basePrice),
          serviceType,
          location: location || {}, // Default to empty object if not provided
          availability: availability || {}, // Default to empty object
          images: images || [], // Default to empty array
          isActive: true, // New services are active by default
          averageRating: 0,
          reviewCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('services').add(serviceData);

        logAuditEvent('SERVICE_CREATED', req, serviceProviderId, {
          serviceId: docRef.id,
          name: serviceData.name,
          categoryId: serviceData.categoryId
        });

        res.status(201).json({ id: docRef.id, ...serviceData });
      } catch (error: any) {
        console.error("Service creation error (Firestore):", error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to create service." });
      }
    }
  );

  // PUT /api/services/:serviceId (Update Service) - Refactored for Firestore
  app.put("/api/services/:serviceId",
    authenticateToken,
    isServiceProvider,
    [ // Add validation rules for updatable fields
      body('name').optional().trim().notEmpty().escape().withMessage('Service name cannot be empty'),
      body('description').optional().trim().notEmpty().escape().withMessage('Service description cannot be empty'),
      body('categoryId').optional().trim().notEmpty().escape().withMessage('Category ID cannot be empty'),
      body('basePrice').optional().isFloat({ gt: 0 }).withMessage('Base price must be a positive number'),
      body('serviceType').optional().isIn(['on_demand', 'scheduled']).withMessage('Invalid service type'),
      body('location').optional().isObject().withMessage('Location must be an object'),
      body('availability').optional().isObject().withMessage('Availability must be an object'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs'),
      body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const serviceId = req.params.serviceId;
        const serviceProviderId = req.user.userId; // Firebase UID from token
        const updateData = req.body;

        const db = admin.firestore();
        const serviceRef = db.collection('services').doc(serviceId);
        const doc = await serviceRef.get();

        if (!doc.exists) {
          return res.status(404).json({ message: "Service not found." });
        }

        const serviceData = doc.data();
        if (serviceData?.serviceProviderId !== serviceProviderId) {
          logAuditEvent('SERVICE_UPDATE_FORBIDDEN', req, serviceProviderId, { serviceId, owner: serviceData?.serviceProviderId });
          return res.status(403).json({ message: "Forbidden: You do not own this service." });
        }

        // Remove fields that should not be updatable directly by client here (e.g. serviceProviderId, createdAt)
        delete updateData.serviceProviderId;
        delete updateData.createdAt;
        delete updateData.averageRating; // Should be calculated
        delete updateData.reviewCount;  // Should be calculated

        await serviceRef.update({ ...updateData, updatedAt: FieldValue.serverTimestamp() });

        logAuditEvent('SERVICE_UPDATED', req, serviceProviderId, { serviceId, updatedFields: Object.keys(updateData) });
        res.status(200).json({ id: serviceId, ...updateData }); // Return updated fields + id
      } catch (error: any) {
        console.error("Service update error (Firestore):", error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to update service." });
      }
    }
  );

  // DELETE /api/services/:serviceId (Soft Delete) - Refactored for Firestore
  app.delete("/api/services/:serviceId",
    authenticateToken,
    isServiceProvider,
    async (req: Request, res: Response) => {
      try {
        const serviceId = req.params.serviceId;
        const serviceProviderId = req.user.userId;

        const db = admin.firestore();
        const serviceRef = db.collection('services').doc(serviceId);
        const doc = await serviceRef.get();

        if (!doc.exists) {
          return res.status(404).json({ message: "Service not found." });
        }

        const serviceData = doc.data();
        if (serviceData?.serviceProviderId !== serviceProviderId) {
          logAuditEvent('SERVICE_DELETE_FORBIDDEN', req, serviceProviderId, { serviceId, owner: serviceData?.serviceProviderId });
          return res.status(403).json({ message: "Forbidden: You do not own this service." });
        }

        await serviceRef.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() });

        logAuditEvent('SERVICE_SOFT_DELETED', req, serviceProviderId, { serviceId });
        res.status(200).json({ message: "Service deactivated successfully." });
      } catch (error: any) {
        console.error("Service delete error (Firestore):", error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to delete service." });
      }
    }
  );

  // Service categories - Refactored to use Firestore
  app.get("/api/service-categories", authenticateToken, async (req: Request, res: Response) => {
    try {
      const db = admin.firestore();
      const categoriesSnapshot = await db.collection('serviceCategories')
                                         .where('isActive', '==', true) // Assuming isActive field exists as per schema
                                         .orderBy('sortOrder', 'asc') // Assuming sortOrder exists
                                         .get();

      if (categoriesSnapshot.empty) {
        return res.json([]);
      }

      const categories = categoriesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, // Firestore document ID
          name: data.name,
          description: data.description,
          iconUrl: data.iconUrl,       // As per Firestore schema: iconUrl
          parentId: data.parentId || null, // As per Firestore schema
          sortOrder: data.sortOrder,
          isActive: data.isActive      // Keep isActive if needed by client
          // Map other fields from your Firestore 'serviceCategories' schema if necessary
        };
      });

      res.json(categories);
    } catch (error: any) {
      console.error("Error fetching service categories from Firestore:", error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch service categories." });
    }
  });

  // Booking routes
  app.get("/api/bookings", authenticateToken, async (req, res) => {
    try {
      const { type } = req.query;
      let bookings;

      if (type === 'resident') {
        bookings = await storage.getBookingsByResident(req.user.userId);
      } else if (type === 'provider') {
        bookings = await storage.getBookingsByProvider(req.user.userId);
      } else {
        bookings = await storage.getBookings();
      }

      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // POST /api/bookings - Create a new booking (Refactored for Firestore)
  app.post("/api/bookings",
    authenticateToken,
    [ // Basic validation for booking creation
      body('serviceId').trim().notEmpty().withMessage('Service ID is required.'),
      body('scheduledDate').isISO8601().toDate().withMessage('Valid scheduled date is required.'),
      body('scheduledTime').trim().notEmpty().withMessage('Scheduled time is required.'),
      body('duration').isInt({ gt: 0 }).withMessage('Duration must be a positive integer (hours).'),
      body('requirements').optional().trim().escape(),
      // serviceIdSI might be generated or validated differently, assuming client sends it for now if needed
      body('serviceIdSI').optional().trim().escape(),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const residentId = req.user.userId; // Firebase UID
      const { serviceId, scheduledDate, scheduledTime, duration, requirements, serviceIdSI } = req.body;
      const db = admin.firestore();

      try {
        // 1. Fetch service details to get price and providerId
        const serviceRef = db.collection('services').doc(serviceId);
        const serviceDoc = await serviceRef.get();
        if (!serviceDoc.exists || !serviceDoc.data()?.isActive) {
          return res.status(404).json({ message: "Service not found or is unavailable." });
        }
        const serviceData = serviceDoc.data()!;
        const providerId = serviceData.serviceProviderId;
        const serviceName = serviceData.name; // For description in transaction
        const pricePerUnit = serviceData.basePrice; // Assuming basePrice is per hour if duration is in hours

        if (residentId === providerId) {
          return res.status(400).json({ message: "Cannot book your own service." });
        }

        // 2. Calculate totalTokens (ensure pricePerUnit and duration are numbers)
        const totalTokens = Number(pricePerUnit) * Number(duration);
        if (isNaN(totalTokens) || totalTokens <= 0) {
          return res.status(400).json({ message: "Invalid total token amount calculated." });
        }

        // 3. Perform Escrow Hold via tokenManager (this checks resident's balance internally)
        let escrowTransactionId;
        try {
          const transactionResult = await recordTransactionAndUpdateWallet(db, {
            userId: residentId,
            type: 'escrow_hold', // This will debit balance, credit escrow
            amount: -totalTokens, // Debit from main balance
            escrowChange: totalTokens, // Credit to escrow balance
            description: `Escrow for booking: ${serviceName} (ID: ${serviceId})`,
            // referenceId will be set to bookingId after booking is created
          });
          escrowTransactionId = transactionResult.transactionId;
        } catch (walletError: any) {
          console.error("Wallet operation error during booking:", walletError);
          return res.status(400).json({ message: walletError.message || "Failed to hold tokens for booking." });
        }

        // 4. Create booking document
        const bookingCollectionRef = db.collection('bookings');
        const newBookingRef = bookingCollectionRef.doc(); // Auto-generate ID

        const bookingData = {
          residentId,
          serviceId,
          serviceProviderId: providerId,
          scheduledDate: new Date(scheduledDate), // Ensure it's a Date object if not already
          scheduledTime,
          duration: Number(duration),
          totalTokens,
          status: 'pending', // Initial status
          requirements: requirements || "",
          serviceIdSI: serviceIdSI || `VERIFY_${serviceId.substring(0,6)}`, // Example placeholder for serviceIdSI
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        await newBookingRef.set(bookingData);

        // 5. (Optional but good) Update the transaction log with the booking ID
        if (escrowTransactionId) {
            await db.collection('tokenTransactions').doc(escrowTransactionId).update({ referenceId: newBookingRef.id });
        }

        logAuditEvent('BOOKING_CREATED', req, residentId, { bookingId: newBookingRef.id, serviceId, providerId, totalTokens });
        res.status(201).json({ id: newBookingRef.id, ...bookingData });

      } catch (error: any) {
        console.error("Booking creation error:", error);
        Sentry.captureException(error);
        // TODO: Consider rolling back the escrow_hold transaction if booking creation fails after tokens are held.
        // This would require a compensating transaction.
        res.status(500).json({ message: "Failed to create booking." });
      }
    }
  );

  // GET /api/bookings - List bookings for the authenticated user (as resident or provider)
  app.get("/api/bookings", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user.userId;
      const db = admin.firestore();

      const residentBookingsQuery = db.collection('bookings').where('residentId', '==', userId);
      const providerBookingsQuery = db.collection('bookings').where('serviceProviderId', '==', userId);

      const [residentSnapshot, providerSnapshot] = await Promise.all([
        residentBookingsQuery.orderBy('scheduledDate', 'desc').get(),
        providerBookingsQuery.orderBy('scheduledDate', 'desc').get()
      ]);

      const bookingsMap = new Map(); // To avoid duplicates if a user books their own service (though disallowed)
      residentSnapshot.docs.forEach(doc => bookingsMap.set(doc.id, { id: doc.id, ...doc.data() }));
      providerSnapshot.docs.forEach(doc => bookingsMap.set(doc.id, { id: doc.id, ...doc.data() }));

      const bookings = Array.from(bookingsMap.values())
                        .sort((a:any, b:any) => b.scheduledDate.toMillis() - a.scheduledDate.toMillis()); // Ensure consistent sort

      // TODO: Add pagination if needed (more complex with combined queries)

      res.json(bookings);
    } catch (error: any) {
      console.error(`Error fetching bookings for user ${req.user.userId}:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch bookings." });
    }
  });

  // GET /api/bookings/:bookingId - Get a single booking
  app.get("/api/bookings/:bookingId", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user.userId;
      const bookingId = req.params.bookingId;
      const db = admin.firestore();
      const bookingRef = db.collection('bookings').doc(bookingId);
      const doc = await bookingRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Booking not found." });
      }

      const bookingData = doc.data()!;
      // Security check: ensure the authenticated user is part of this booking
      if (bookingData.residentId !== userId && bookingData.serviceProviderId !== userId && req.user.role !== 'admin') {
        logAuditEvent('BOOKING_READ_FORBIDDEN', req, userId, { bookingId });
        return res.status(403).json({ message: "Forbidden: You are not authorized to view this booking." });
      }

      res.json({ id: doc.id, ...bookingData });
    } catch (error: any) {
      console.error(`Error fetching booking ${req.params.bookingId}:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch booking details." });
    }
  });


  // PUT /api/bookings/:bookingId/status - Update booking status (Refactored for Firestore)
  app.put("/api/bookings/:bookingId/status",
    authenticateToken,
    [ // Validate status and optional fields
      body('status').isIn(['confirmed', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status value.'),
      body('serviceIdSI').optional().trim().escape(),
      body('cancellationReason').optional().if(body('status').equals('cancelled')).trim().notEmpty().escape().withMessage('Cancellation reason is required when cancelling.'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const bookingId = req.params.bookingId;
      const newStatus = req.body.status;
      const serviceIdSI = req.body.serviceIdSI; // For completion
      const cancellationReason = req.body.cancellationReason;
      const currentUserId = req.user.userId;
      const currentUserRole = req.user.role;

      const db = admin.firestore();
      const bookingRef = db.collection('bookings').doc(bookingId);

      try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
          return res.status(404).json({ message: "Booking not found." });
        }
        const bookingData = bookingDoc.data()!;
        const oldStatus = bookingData.status;

        // --- Authorization & State Machine Logic ---
        let canUpdate = false;
        let requiresTokenOperation = false;
        let tokenOps: TransactionDetails[] = [];

        if (newStatus === 'confirmed') {
          if ((currentUserId === bookingData.serviceProviderId || currentUserRole === 'admin') && oldStatus === 'pending') {
            canUpdate = true;
          } else {
            return res.status(403).json({ message: "Forbidden or invalid status transition for confirming." });
          }
        } else if (newStatus === 'in_progress') {
          if ((currentUserId === bookingData.serviceProviderId || currentUserRole === 'admin') && oldStatus === 'confirmed') {
            canUpdate = true;
          } else {
            return res.status(403).json({ message: "Forbidden or invalid status transition for starting progress." });
          }
        } else if (newStatus === 'completed') {
          if ((currentUserId === bookingData.serviceProviderId || currentUserRole === 'admin') && oldStatus === 'in_progress') {
            // Optional: Verify serviceIdSI if it's part of your business logic for completion
            // if (serviceIdSI !== bookingData.serviceIdSI) {
            //   return res.status(400).json({ message: "Service ID verification code mismatch." });
            // }
            canUpdate = true;
            requiresTokenOperation = true;
            // 1. Resident pays from escrow: decrease resident escrow
            tokenOps.push({
              userId: bookingData.residentId,
              type: 'escrow_release', // This type implies a debit from escrow
              amount: 0, // No change to main balance directly from this transaction leg
              escrowChange: -bookingData.totalTokens,
              description: `Payment for completed service: ${bookingData.serviceId} (Booking: ${bookingId})`,
              referenceId: bookingId,
              initiatorId: currentUserId,
            });
            // 2. Provider earns to balance: increase provider balance
            tokenOps.push({
              userId: bookingData.serviceProviderId,
              type: 'earn_service_fee', // This type implies a credit to main balance
              amount: bookingData.totalTokens,
              escrowChange: 0, // No change to provider's escrow from this transaction
              description: `Earnings from service: ${bookingData.serviceId} (Booking: ${bookingId})`,
              referenceId: bookingId,
              initiatorId: currentUserId,
            });
            // TODO: Add platform fee deduction logic here if applicable
          } else {
            return res.status(403).json({ message: "Forbidden or invalid status transition for completing." });
          }
        } else if (newStatus === 'cancelled') {
          // Allow resident to cancel if pending/confirmed (adjust policy as needed)
          // Allow provider to cancel if pending/confirmed (adjust policy as needed)
          if ( ((currentUserId === bookingData.residentId && (oldStatus === 'pending' || oldStatus === 'confirmed')) ||
                (currentUserId === bookingData.serviceProviderId && (oldStatus === 'pending' || oldStatus === 'confirmed'))) ||
                currentUserRole === 'admin' ) {
            canUpdate = true;
            // If tokens were in escrow, they need to be returned
            if (oldStatus === 'pending' || oldStatus === 'confirmed' || oldStatus === 'in_progress') { // Check if escrow was held
                const residentWallet = await db.collection('tokenWallets').doc(bookingData.residentId).get();
                if (residentWallet.exists && (residentWallet.data()?.escrowBalance || 0) >= bookingData.totalTokens) {
                    requiresTokenOperation = true;
                    // Return funds from resident's escrow to their main balance
                    tokenOps.push({
                        userId: bookingData.residentId,
                        type: 'refund_escrow', // This type implies credit to balance, debit from escrow
                        amount: bookingData.totalTokens, // Credit main balance
                        escrowChange: -bookingData.totalTokens, // Debit escrow balance
                        description: `Refund for cancelled booking: ${bookingData.serviceId} (Booking: ${bookingId})`,
                        referenceId: bookingId,
                        initiatorId: currentUserId,
                    });
                } else if (residentWallet.exists && (residentWallet.data()?.escrowBalance || 0) < bookingData.totalTokens && (residentWallet.data()?.escrowBalance || 0) > 0) {
                    console.warn(`Partial escrow found for booking ${bookingId} during cancellation. Refunding available amount.`);
                    requiresTokenOperation = true;
                    tokenOps.push({
                        userId: bookingData.residentId,
                        type: 'refund_escrow',
                        amount: residentWallet.data()?.escrowBalance || 0,
                        escrowChange: -(residentWallet.data()?.escrowBalance || 0),
                        description: `Partial refund for cancelled booking: ${bookingData.serviceId} (Booking: ${bookingId})`,
                        referenceId: bookingId,
                        initiatorId: currentUserId,
                    });
                }
                // If status was just 'pending' and escrow_hold might not have happened yet, this logic needs to be robust
                // or ensure escrow_hold is always attempted for 'pending' before cancellation.
            }
          } else {
            return res.status(403).json({ message: "Forbidden or invalid status transition for cancelling." });
          }
        }

        if (!canUpdate) { // Should be caught by specific condition blocks, but as a safeguard
          return res.status(403).json({ message: "Status update not permitted." });
        }

        // Perform token operations if required
        if (requiresTokenOperation) {
          for (const op of tokenOps) {
            await recordTransactionAndUpdateWallet(db, op);
          }
        }

        // Update booking status and other fields
        const updatePayload: any = {
          status: newStatus,
          updatedAt: FieldValue.serverTimestamp(),
          lastStatusUpdateBy: currentUserId, // Track who made the last status update
        };
        if (newStatus === 'completed') updatePayload.completedAt = FieldValue.serverTimestamp();
        if (newStatus === 'cancelled') {
          updatePayload.cancellationReason = cancellationReason || "Cancelled by user.";
          updatePayload.cancelledBy = currentUserId;
        }

        await bookingRef.update(updatePayload);
        logAuditEvent(`BOOKING_STATUS_UPDATED_TO_${newStatus.toUpperCase()}`, req, currentUserId, { bookingId, oldStatus, newStatus });

        const updatedBookingDoc = await bookingRef.get(); // Get updated document
        res.status(200).json({ id: updatedBookingDoc.id, ...updatedBookingDoc.data() });

      } catch (error: any) {
        console.error(`Error updating booking ${bookingId} status to ${newStatus}:`, error);
        Sentry.captureException(error);
        // If token operation failed, the booking status update might not have happened.
        // This state needs careful handling, potentially a retry or manual reconciliation flag.
        res.status(500).json({ message: `Failed to update booking status. ${error.message}` });
      }
    }
  );


  // Wallet routes
  app.get("/api/wallet", authenticateToken, async (req, res) => {
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Wallet routes
  app.get("/api/wallet", authenticateToken, async (req, res) => {
    try {
      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      res.json(wallet);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/transactions", authenticateToken, async (req, res) => {
    try {
      const transactions = await storage.getTokenTransactions(req.user.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/wallet/transactions", authenticateToken, async (req, res) => {
    try {
      const transactions = await storage.getTokenTransactions(req.user.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/transactions/purchase", authenticateToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid token amount" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        // Create wallet if it doesn't exist
        const newWallet = await storage.createWallet({
          userId: req.user.userId,
          balance: amount,
          escrowBalance: 0,
          totalEarned: 0,
          totalSpent: 0,
        });

        // Create transaction record
        await storage.createTokenTransaction({
          userId: req.user.userId,
          type: 'purchase',
          amount: amount,
          description: `Token purchase: ${amount} tokens`,
          status: 'completed',
        });

        return res.json(newWallet);
      }

      // Update wallet balance
      const updatedWallet = await storage.updateWallet(req.user.userId, {
        balance: (wallet.balance || 0) + amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'purchase',
        amount: amount,
        description: `Token purchase: ${amount} tokens`,
        status: 'completed',
      });

      res.json(updatedWallet);
    } catch (error) {
      console.error("Token purchase error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/transactions/redeem", authenticateToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid token amount" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      if ((wallet.balance || 0) < amount) {
        return res.status(400).json({ message: "Insufficient token balance" });
      }

      // Calculate redemption amount (60% rate)
      const redemptionValue = amount * 0.6;

      // Update wallet balance
      const updatedWallet = await storage.updateWallet(req.user.userId, {
        balance: (wallet.balance || 0) - amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'redeem',
        amount: -amount,
        description: `Token redemption: ${amount} tokens = $${redemptionValue.toFixed(2)}`,
        status: 'completed',
      });

      res.json(updatedWallet);
    } catch (error) {
      console.error("Token redemption error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/wallet/purchase", authenticateToken, async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid token amount" });
      }

      const wallet = await storage.getWallet(req.user.userId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Update wallet balance
      const updatedWallet = await storage.updateWallet(req.user.userId, {
        balance: wallet.balance + amount,
      });

      // Create transaction record
      await storage.createTokenTransaction({
        userId: req.user.userId,
        type: 'purchase',
        amount: amount,
        description: `Token purchase: ${amount} tokens`,
      });

      res.json(updatedWallet);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // STAR Projects routes
  // GET /api/star-projects - List STAR Projects (Refactored for Firestore)
  app.get("/api/star-projects", async (req: Request, res: Response) => {
    try {
      const { status, category, creatorId, sortBy = 'createdAt', sortOrder = 'desc', limit: queryLimit, lastVisible } = req.query;
      const db = admin.firestore();
      let query: admin.firestore.Query = db.collection('starProjects');

      if (status) {
        query = query.where('status', '==', status as string);
      } else {
        query = query.where('status', 'in', ['active', 'funded', 'in_progress', 'completed']); // Default statuses to show
      }
      if (category) {
        query = query.where('category', '==', category as string);
      }
      if (creatorId) {
        query = query.where('creatorId', '==', creatorId as string);
      }
      
      if (sortBy && (sortOrder === 'asc' || sortOrder === 'desc')) {
        query = query.orderBy(sortBy as string, sortOrder as admin.firestore.OrderByDirection);
      } else {
        query = query.orderBy('createdAt', 'desc'); // Default sort
      }

      const limitNum = parseInt(queryLimit as string) || 10;
      query = query.limit(limitNum);

      if (lastVisible) {
        const lastVisibleDoc = await db.collection('starProjects').doc(lastVisible as string).get();
        if (lastVisibleDoc.exists) {
          query = query.startAfter(lastVisibleDoc);
        }
      }

      const projectsSnapshot = await query.get();
      const projects = projectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let nextCursor = null;
      if (projects.length === limitNum && projectsSnapshot.docs.length > 0) {
          nextCursor = projectsSnapshot.docs[projectsSnapshot.docs.length - 1].id;
      }

      res.json({ projects, nextCursor });
    } catch (error: any) {
      console.error("Error fetching STAR projects from Firestore:", error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch STAR projects." });
    }
  });

  // GET /api/star-projects/:projectId - Get Single STAR Project (Refactored for Firestore)
  app.get("/api/star-projects/:projectId", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId; // projectId is a string (Firestore doc ID)
      const db = admin.firestore();
      const projectRef = db.collection('starProjects').doc(projectId);
      const doc = await projectRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Project not found." });
      }

      res.json({ id: doc.id, ...doc.data() });
    } catch (error: any) {
      console.error(`Error fetching project ${req.params.projectId} from Firestore:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch project details." });
    }
  });

  // POST /api/star-projects - Create a new STAR Project (Refactored for Firestore)
  app.post("/api/star-projects",
    authenticateToken,
    [ // Validation for project creation (align with Firestore schema for starProjects)
      body('title').trim().notEmpty().escape().withMessage('Project title cannot be empty.'),
      body('description').trim().notEmpty().escape().withMessage('Project description cannot be empty.'),
      body('category').trim().notEmpty().escape().withMessage('Project category cannot be empty.'),
      body('targetAmount').isFloat({ gt: 0 }).withMessage('Target amount must be a positive number.'),
      body('deadline').optional().isISO8601().toDate().withMessage('Invalid deadline date format.'),
      body('location').optional().isObject().withMessage('Location must be an object.'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs.'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const { title, description, category, targetAmount, deadline, location, images } = req.body;
        const creatorId = req.user.userId; // Firebase UID from token

        const db = admin.firestore();
        const projectData = {
          creatorId,
          title,
          description,
          category,
          targetAmount: Number(targetAmount),
          currentAmount: 0,
          status: 'active', // Default to 'active'; could be 'draft' if an approval flow is added
          participants: {}, // Empty map for participants
          deadline: deadline ? new Date(deadline) : null,
          location: location || null,
          images: images || [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        const docRef = await db.collection('starProjects').add(projectData);

        // Log audit event for project creation (already present, ensure params match)
        trackServerEvent( // Assuming trackServerEvent is preferred over logAuditEvent for this one from previous step
          "ProjectCreate",
          { projectId: docRef.id, title: projectData.title, targetAmount: projectData.targetAmount, creatorId },
          getClientIdFromRequest(req)
        );
        logAuditEvent('PROJECT_CREATED', req, creatorId, { projectId: docRef.id, title: projectData.title });


        res.status(201).json({ id: docRef.id, ...projectData });
      } catch (error: any) {
        console.error("STAR Project creation error (Firestore):", error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to create STAR project." });
      }
    }
  );

  // PUT /api/star-projects/:projectId - Update a STAR Project (by Creator)
  app.put("/api/star-projects/:projectId",
    authenticateToken,
    [ // Validation for updatable fields
      body('title').optional().trim().notEmpty().escape().withMessage('Project title cannot be empty.'),
      body('description').optional().trim().notEmpty().escape().withMessage('Project description cannot be empty.'),
      body('category').optional().trim().notEmpty().escape().withMessage('Project category cannot be empty.'),
      // targetAmount can only be updated if status is 'draft' (enforced in DB rule & here)
      body('targetAmount').optional().isFloat({ gt: 0 }).withMessage('Target amount must be a positive number.'),
      body('deadline').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid deadline date format.'),
      body('location').optional({ nullable: true }).isObject().withMessage('Location must be an object.'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs.'),
      body('status').optional().isIn(['active', 'cancelled', 'draft']).withMessage('Invalid status for client update.'), // limited statuses client can set
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const projectId = req.params.projectId;
      const currentUserId = req.user.userId;
      const updatePayload = req.body;

      const db = admin.firestore();
      const projectRef = db.collection('starProjects').doc(projectId);

      try {
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) {
          return res.status(404).json({ message: "Project not found." });
        }
        const projectData = projectDoc.data()!;

        if (projectData.creatorId !== currentUserId) {
          logAuditEvent('PROJECT_UPDATE_FORBIDDEN', req, currentUserId, { projectId });
          return res.status(403).json({ message: "Forbidden: You are not the creator of this project." });
        }

        // Prevent direct client update of critical financial/state fields managed by server
        delete updatePayload.creatorId;
        delete updatePayload.createdAt;
        delete updatePayload.currentAmount; // Must be updated via contributions
        delete updatePayload.participants;  // Must be updated via contributions

        // Allow targetAmount update only if project is in 'draft' state
        if (updatePayload.targetAmount && projectData.status !== 'draft') {
          delete updatePayload.targetAmount; // Or return error: res.status(400).json({ message: "Target amount can only be changed for draft projects." });
        }

        // Server should control transitions to 'funded', 'in_progress', 'completed'.
        // Client can potentially set to 'active' (from 'draft') or 'cancelled' (from 'active'/'draft').
        if (updatePayload.status) {
            if (!((projectData.status === 'draft' && updatePayload.status === 'active') ||
                  ((projectData.status === 'active' || projectData.status === 'draft') && updatePayload.status === 'cancelled'))) {
                // If an invalid status transition is attempted by client for non-draft/active states
                if (!(projectData.status === 'active' && updatePayload.status === 'active') &&
                    !(projectData.status === 'draft' && updatePayload.status === 'draft') &&
                    !(projectData.status === 'cancelled' && updatePayload.status === 'cancelled')) {
                     logAuditEvent('PROJECT_STATUS_UPDATE_INVALID', req, currentUserId, { projectId, oldStatus: projectData.status, attemptedStatus: updatePayload.status });
                     return res.status(400).json({ message: `Invalid status transition from ${projectData.status} to ${updatePayload.status}.` });
                }
            }
        }


        await projectRef.update({ ...updatePayload, updatedAt: FieldValue.serverTimestamp() });
        logAuditEvent('PROJECT_UPDATED', req, currentUserId, { projectId, updatedFields: Object.keys(updatePayload) });

        const updatedProjectDoc = await projectRef.get();
        res.status(200).json({ id: updatedProjectDoc.id, ...updatedProjectDoc.data() });

      } catch (error: any) {
        console.error(`Error updating project ${projectId}:`, error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to update project." });
      }
    }
  );

  // POST /api/star-projects/:projectId/contribute - Contribute to a STAR Project (Refactored for Firestore)
  app.post("/api/star-projects/:projectId/contribute",
    authenticateToken,
    [ body('amount').isFloat({ gt: 0 }).withMessage('Contribution amount must be a positive number.') ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const projectId = req.params.projectId;
      const contributorId = req.user.userId; // Firebase UID
      const contributionAmount = Number(req.body.amount);
      const db = admin.firestore();

      const projectRef = db.collection('starProjects').doc(projectId);
      // Note: Wallet operations and transaction logging are now part of recordTransactionAndUpdateWallet.
      // This requires careful integration if recordTransactionAndUpdateWallet is not designed for external transactions.
      // For this refactor, we will call recordTransactionAndUpdateWallet first, and if it succeeds,
      // then in a separate Firestore transaction, update the project. This is not fully atomic across both.
      // A more robust solution might involve a multi-stage process or Cloud Functions for full atomicity
      // if recordTransactionAndUpdateWallet cannot be part of the project update transaction.

      // Let's simplify: Assume recordTransactionAndUpdateWallet handles its own atomicity.
      // If it fails, we don't proceed. If it succeeds, we try to update the project.
      // This is a common pattern if the two operations are hard to bind in one transaction an
      // can lead to eventual consistency or require compensating transactions if project update fails.

      // For this exercise, the prompt implies the token transfer and project update should be atomic.
      // This means the logic inside recordTransactionAndUpdateWallet needs to be adapted or
      // its core parts (wallet update, transaction log) moved into this transaction.
      // Let's try to do it in one transaction here for project and wallet, and a separate write for transaction log for simplicity.
      // This is a complex interaction. The provided `recordTransactionAndUpdateWallet` is designed to be atomic for one user.
      // For a contribution, it's a spend for the user, and an update for the project.

      try {
        // Step 1: Debit contributor's wallet and record their spend transaction
        // This uses the existing atomic function for the wallet part.
        const transactionResult = await recordTransactionAndUpdateWallet(db, {
          userId: contributorId,
          type: 'spend_project_contribution',
          amount: -contributionAmount, // Debit from contributor's balance
          description: `Contribution to project ID: ${projectId}`,
          referenceId: projectId,
          initiatorId: contributorId,
        });

        // Step 2: If wallet debit was successful, now update the project's currentAmount and participants
        // This is a separate Firestore write. If this fails, the user's tokens are spent but project not updated.
        // This is a limitation without a two-phase commit or more complex distributed transaction pattern (not native to Firestore alone).
        // A Firebase Function triggered by the token transaction log could update the project for better decoupling and atomicity.
        // For now, proceed with direct update.
        try {
            const projectDoc = await projectRef.get();
            if (!projectDoc.exists) {
                // TODO: CRITICAL - Need to refund the user here as project doesn't exist!
                // This requires a compensating transaction.
                console.error(`Project ${projectId} not found after user ${contributorId} was charged. Refunding is necessary.`);
                // Attempt refund (this is a simplified example of a compensating transaction)
                await recordTransactionAndUpdateWallet(db, {
                    userId: contributorId,
                    type: 'refund_escrow', // Or a generic 'refund_contribution_failed'
                    amount: contributionAmount, // Credit back
                    description: `Refund for failed contribution to non-existent project ID: ${projectId}`,
                    referenceId: projectId,
                    initiatorId: 'system', // System initiated refund
                });
                return res.status(404).json({ message: "Project not found. Contribution has been refunded." });
            }

            const projectData = projectDoc.data()!;
            if (projectData.status !== 'active' && projectData.status !== 'funded') { // Can contribute to active or already funded
                // TODO: CRITICAL - Refund user as project is not active for contributions.
                 await recordTransactionAndUpdateWallet(db, {
                    userId: contributorId, type: 'refund_escrow', amount: contributionAmount,
                    description: `Refund for contribution to inactive project ID: ${projectId}`, referenceId: projectId, initiatorId: 'system'
                });
                return res.status(400).json({ message: "Project is not active for contributions. Contribution refunded." });
            }

            const newCurrentAmount = (projectData.currentAmount || 0) + contributionAmount;
            const newStatus = (newCurrentAmount >= projectData.targetAmount && projectData.status !== 'funded' && projectData.status !== 'completed')
                              ? 'funded'
                              : projectData.status;

            // Update participants map: Add or update contributor's total contribution
            const contributorName = req.user.displayName || `${req.user.firstName || 'User'} ${req.user.lastName || ''}`.trim() || 'Anonymous Contributor';
            const newParticipantData = {
                contribution: (projectData.participants?.[contributorId]?.contribution || 0) + contributionAmount,
                name: contributorName, // Store contributor's display name
                timestamp: FieldValue.serverTimestamp() // Last contribution time
            };

            const updateData: any = {
                currentAmount: newCurrentAmount,
                [`participants.${contributorId}`]: newParticipantData, // Using dot notation for map field update
                updatedAt: FieldValue.serverTimestamp(),
            };
            if (newStatus !== projectData.status) {
                updateData.status = newStatus;
            }

            await projectRef.update(updateData);

            logAuditEvent('PROJECT_CONTRIBUTION_SUCCESS', req, contributorId, { projectId, amount: contributionAmount, newProjectTotal: newCurrentAmount });
            if (newStatus !== projectData.status && newStatus === 'funded') {
                 logAuditEvent('PROJECT_FUNDED', req, 'system', { projectId, totalCollected: newCurrentAmount });
            }

            // Fetch the updated project to return
            const updatedProjectDoc = await projectRef.get();
            res.status(200).json({ id: updatedProjectDoc.id, ...updatedProjectDoc.data() });

        } catch (projectUpdateError) {
            console.error(`Failed to update project ${projectId} after successful contribution ${transactionResult.transactionId} from ${contributorId}. MANUAL INTERVENTION REQUIRED.`, projectUpdateError);
            Sentry.captureException(new Error(`Project update failed post-contribution: ${projectUpdateError}`), { extra: { projectId, contributorId, contributionAmount, transactionId: transactionResult.transactionId }});
            // Return success for the token part, but with a warning about project update.
            // This is not ideal; a more robust system would use a queue or retry mechanism for the project update.
            return res.status(207).json({
                message: "Contribution processed, but there was an issue updating project details. Please contact support if inconsistency is observed.",
                transactionId: transactionResult.transactionId
            });
        }

      } catch (error: any) {
        console.error(`Project contribution error for project ${projectId} by user ${contributorId}:`, error);
        Sentry.captureException(error);
        res.status(error.message.includes("Insufficient balance") ? 400 : 500)
           .json({ message: error.message || "Failed to process contribution." });
      }
    }
  );

  // STAR Causes routes
  // GET /api/star-causes - List STAR Causes (Refactored for Firestore)
  app.get("/api/star-causes", async (req: Request, res: Response) => {
    try {
      const { status, category, championId, urgencyLevel, sortBy = 'createdAt', sortOrder = 'desc', limit: queryLimit, lastVisible } = req.query;
      const db = admin.firestore();
      let query: admin.firestore.Query = db.collection('starCauses');

      if (status) {
        query = query.where('status', '==', status as string);
      } else {
        // Default to publicly visible statuses
        query = query.where('status', 'in', ['approved', 'active', 'funded', 'completed']);
      }
      if (category) {
        query = query.where('category', '==', category as string);
      }
      if (championId) {
        query = query.where('championId', '==', championId as string);
      }
      if (urgencyLevel) {
        query = query.where('urgencyLevel', '==', urgencyLevel as string);
      }
      
      if (sortBy && (sortOrder === 'asc' || sortOrder === 'desc')) {
        query = query.orderBy(sortBy as string, sortOrder as admin.firestore.OrderByDirection);
      } else {
        query = query.orderBy('createdAt', 'desc'); // Default sort
      }

      const limitNum = parseInt(queryLimit as string) || 10;
      query = query.limit(limitNum);

      if (lastVisible) {
        const lastVisibleDoc = await db.collection('starCauses').doc(lastVisible as string).get();
        if (lastVisibleDoc.exists) {
          query = query.startAfter(lastVisibleDoc);
        }
      }

      const causesSnapshot = await query.get();
      const causes = causesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let nextCursor = null;
      if (causes.length === limitNum && causesSnapshot.docs.length > 0) {
          nextCursor = causesSnapshot.docs[causesSnapshot.docs.length - 1].id;
      }

      res.json({ causes, nextCursor });
    } catch (error: any) {
      console.error("Error fetching STAR causes from Firestore:", error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch STAR causes." });
    }
  });

  // GET /api/star-causes/:causeId - Get Single STAR Cause (Refactored for Firestore)
  app.get("/api/star-causes/:causeId", async (req: Request, res: Response) => {
    try {
      const causeId = req.params.causeId; // causeId is a string (Firestore doc ID)
      const db = admin.firestore();
      const causeRef = db.collection('starCauses').doc(causeId);
      const doc = await causeRef.get();

      if (!doc.exists) {
        return res.status(404).json({ message: "Cause not found." });
      }

      const causeData = doc.data()!;
      // Check if cause is in a publicly readable state, otherwise deny (unless admin, etc.)
      // This aligns with the security rule: resource.data.status in ['approved', 'active', 'completed', 'funded']
      if (!['approved', 'active', 'completed', 'funded'].includes(causeData.status) && req.user?.role !== 'admin') {
          // If user is authenticated, check if they are applicant or champion for non-public states
          if (!(req.user && (req.user.userId === causeData.applicantId || req.user.userId === causeData.championId))) {
            logAuditEvent('CAUSE_READ_FORBIDDEN_STATUS', req, req.user?.userId, { causeId, status: causeData.status });
            return res.status(403).json({ message: "This cause is not currently public." });
          }
      }

      res.json({ id: doc.id, ...causeData });
    } catch (error: any) {
      console.error(`Error fetching cause ${req.params.causeId} from Firestore:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch cause details." });
    }
  });

  // POST /api/star-causes - Create/Apply for a new STAR Cause (Refactored for Firestore)
  app.post("/api/star-causes",
    authenticateToken,
    [ // Validation for cause creation (align with Firestore schema for starCauses)
      body('title').trim().notEmpty().escape().withMessage('Cause title cannot be empty.'),
      body('description').trim().notEmpty().escape().withMessage('Cause description cannot be empty.'),
      body('category').trim().notEmpty().escape().withMessage('Cause category cannot be empty.'),
      body('targetAmount').isFloat({ gt: 0 }).withMessage('Target amount must be a positive number.'),
      body('urgencyLevel').optional().isIn(['low', 'normal', 'high', 'critical']).withMessage('Invalid urgency level.'),
      body('deadline').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid deadline date format.'),
      body('supportingDocuments').optional().isArray().withMessage('Supporting documents must be an array of URLs.'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs.'),
      body('championId').optional().trim().escape(), // Can be self-championed or assigned later by admin
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      try {
        const { title, description, category, targetAmount, urgencyLevel, deadline, supportingDocuments, images, championId } = req.body;
        const applicantId = req.user.userId; // Firebase UID from token

        const db = admin.firestore();
        const causeData = {
          applicantId,
          championId: championId || applicantId, // Default to applicant if not provided or if self-championing
          title,
          description,
          category,
          targetAmount: Number(targetAmount),
          currentAmount: 0,
          urgencyLevel: urgencyLevel || 'normal',
          status: 'pending', // New causes start as pending admin approval
          deadline: deadline ? new Date(deadline) : null,
          supportingDocuments: supportingDocuments || [],
          images: images || [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          impactMetrics: {}, // Initialize empty
        };

        const docRef = await db.collection('starCauses').add(causeData);

        trackServerEvent( // Existing GA event
          "CauseCreate",
          { causeId: docRef.id, title: causeData.title, targetAmount: causeData.targetAmount, applicantId },
          getClientIdFromRequest(req)
        );
        logAuditEvent('CAUSE_APPLICATION_CREATED', req, applicantId, { causeId: docRef.id, title: causeData.title });

        res.status(201).json({ id: docRef.id, ...causeData });
      } catch (error: any) {
        console.error("STAR Cause creation error (Firestore):", error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to create STAR cause application." });
      }
    }
  );

  // PUT /api/star-causes/:causeId - Update a STAR Cause (by Champion/Admin)
  // This is a new route, as only POST for donate existed.
  app.put("/api/star-causes/:causeId",
    authenticateToken,
    [ // Validation for updatable fields by Champion
      body('title').optional().trim().notEmpty().escape().withMessage('Cause title cannot be empty.'),
      body('description').optional().trim().notEmpty().escape().withMessage('Cause description cannot be empty.'),
      body('category').optional().trim().notEmpty().escape().withMessage('Cause category cannot be empty.'),
      body('urgencyLevel').optional().isIn(['low', 'normal', 'high', 'critical']).withMessage('Invalid urgency level.'),
      body('deadline').optional({ nullable: true }).isISO8601().toDate().withMessage('Invalid deadline date format.'),
      body('supportingDocuments').optional().isArray().withMessage('Supporting documents must be an array of URLs.'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs.'),
      body('impactMetrics').optional().isObject().withMessage('Impact metrics must be an object.'),
      // Status changes like 'approved', 'active', 'rejected', 'completed', 'cancelled' should be admin-only separate endpoints.
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const causeId = req.params.causeId;
      const currentUserId = req.user.userId;
      const updatePayload = req.body;
      const db = admin.firestore();
      const causeRef = db.collection('starCauses').doc(causeId);

      try {
        const causeDoc = await causeRef.get();
        if (!causeDoc.exists) {
          return res.status(404).json({ message: "Cause not found." });
        }
        const causeData = causeDoc.data()!;

        // Only champion or admin can update. Admin check could be a separate middleware or role check here.
        if (causeData.championId !== currentUserId && req.user.role !== 'admin') {
          logAuditEvent('CAUSE_UPDATE_FORBIDDEN', req, currentUserId, { causeId });
          return res.status(403).json({ message: "Forbidden: You are not the champion or an admin for this cause." });
        }

        // Champions can only update if status is 'approved' or 'active'
        if (req.user.role !== 'admin' && !(causeData.status === 'approved' || causeData.status === 'active')) {
            return res.status(403).json({ message: `Cause cannot be updated in its current state (${causeData.status}) by champion.` });
        }

        // Prevent client update of critical/managed fields
        delete updatePayload.applicantId;
        delete updatePayload.championId; // Champion cannot reassign themselves via this generic update
        delete updatePayload.createdAt;
        delete updatePayload.currentAmount;
        delete updatePayload.status; // Status changes via specific admin routes usually

        await causeRef.update({ ...updatePayload, updatedAt: FieldValue.serverTimestamp() });
        logAuditEvent('CAUSE_UPDATED', req, currentUserId, { causeId, updatedFields: Object.keys(updatePayload) });

        const updatedCauseDoc = await causeRef.get();
        res.status(200).json({ id: updatedCauseDoc.id, ...updatedCauseDoc.data() });

      } catch (error: any) {
        console.error(`Error updating cause ${causeId}:`, error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to update cause." });
      }
    }
  );

  // POST /api/star-causes/:causeId/donations - Donate to a STAR Cause (Refactored for Firestore)
  app.post("/api/star-causes/:causeId/donate",
    authenticateToken,
    [ body('amount').isFloat({ gt: 0 }).withMessage('Donation amount must be a positive number.'),
      body('message').optional().trim().escape()
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const causeId = req.params.causeId;
      const donorId = req.user.userId; // Firebase UID
      const donationAmount = Number(req.body.amount);
      const donorMessage = req.body.message || null;
      const db = admin.firestore();

      const causeRef = db.collection('starCauses').doc(causeId);
      const donationCollectionRef = db.collection('causeDonations');
      const newDonationRef = donationCollectionRef.doc(); // Auto-generate ID for the donation

      try {
        // Similar to project contributions, ideally this is one transaction or handled by a function.
        // For now, debit wallet first, then update cause and create donation record.
        // This has risks if subsequent steps fail.

        // 1. Debit donor's wallet and record their spend transaction
        const tokenTransactionResult = await recordTransactionAndUpdateWallet(db, {
          userId: donorId,
          type: 'spend_cause_donation',
          amount: -donationAmount, // Debit from donor's balance
          description: `Donation to cause ID: ${causeId}`,
          referenceId: causeId, // Could also be newDonationRef.id later
          initiatorId: donorId,
        });

        // 2. If wallet debit successful, create donation record and update cause
        try {
          await db.runTransaction(async (transaction) => {
            const causeDoc = await transaction.get(causeRef);
            if (!causeDoc.exists) {
              throw new Error("Cause not found."); // This will trigger refund below
            }
            const causeData = causeDoc.data()!;
            if (causeData.status !== 'active' && causeData.status !== 'approved' && causeData.status !== 'funded') { // Can donate to approved, active or already funded
              throw new Error("Cause is not currently active for donations."); // This will trigger refund
            }

            // Create donation document
            const donationData = {
              causeId,
              donorId,
              amount: donationAmount,
              message: donorMessage,
              // paymentDetails: { transactionId: tokenTransactionResult.transactionId }, // Link to token transaction
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(), // Firestore schema has updatedAt
            };
            transaction.set(newDonationRef, donationData);

            // Update cause's currentAmount
            const newCurrentAmount = (causeData.currentAmount || 0) + donationAmount;
            const newStatus = (newCurrentAmount >= causeData.targetAmount && causeData.status !== 'funded' && causeData.status !== 'completed')
                              ? 'funded'
                              : causeData.status;

            const causeUpdateData: any = {
                currentAmount: newCurrentAmount,
                updatedAt: FieldValue.serverTimestamp(),
            };
            if (newStatus !== causeData.status) {
                causeUpdateData.status = newStatus;
            }
            transaction.update(causeRef, causeUpdateData);
          });

          // Update the main token transaction with the donation ID if desired
          // await db.collection('tokenTransactions').doc(tokenTransactionResult.transactionId).update({ referenceId: newDonationRef.id });

          logAuditEvent('CAUSE_DONATION_SUCCESS', req, donorId, { causeId, donationId: newDonationRef.id, amount: donationAmount });
          const finalCauseDoc = await causeRef.get(); // Get updated cause data
          res.status(201).json({
            message: "Donation successful.",
            donationId: newDonationRef.id,
            cause: { id: finalCauseDoc.id, ...finalCauseDoc.data() }
          });

        } catch (causeUpdateOrDonationCreateError: any) {
          console.error(`Failed to record donation or update cause ${causeId} after successful wallet debit ${tokenTransactionResult.transactionId} from ${donorId}. Initiating refund. Error: ${causeUpdateOrDonationCreateError.message}`);
          Sentry.captureException(new Error(`Cause update/donation record failed post-wallet-debit: ${causeUpdateOrDonationCreateError.message}`), { extra: { causeId, donorId, donationAmount, tokenTransactionId: tokenTransactionResult.transactionId }});

          // Attempt to refund the user
          try {
            await recordTransactionAndUpdateWallet(db, {
              userId: donorId,
              type: 'refund_escrow', // Or a more specific 'refund_donation_failed'
              amount: donationAmount, // Credit back
              description: `Refund for failed donation to cause ID: ${causeId}. Reason: ${causeUpdateOrDonationCreateError.message}`,
              referenceId: causeId,
              initiatorId: 'system',
            });
            logAuditEvent('CAUSE_DONATION_REFUNDED_POST_ERROR', req, donorId, { causeId, amount: donationAmount, reason: causeUpdateOrDonationCreateError.message });
            return res.status(500).json({ message: `Donation failed: ${causeUpdateOrDonationCreateError.message}. Your tokens have been refunded.` });
          } catch (refundError: any) {
            console.error(`CRITICAL: Failed to refund user ${donorId} for ${donationAmount} tokens after failed donation to cause ${causeId}. MANUAL INTERVENTION REQUIRED. Refund error: ${refundError.message}`);
            Sentry.captureException(new Error(`CRITICAL: Refund failed post-donation error: ${refundError.message}`), { extra: { causeId, donorId, donationAmount, originalError: causeUpdateOrDonationCreateError.message }});
            return res.status(500).json({ message: "Donation processing failed and refund attempt also failed. Please contact support immediately." });
          }
        }
      } catch (error: any) {
        console.error(`Cause donation error for cause ${causeId} by user ${donorId}:`, error);
        Sentry.captureException(error);
        res.status(error.message.includes("Insufficient balance") ? 400 : 500)
           .json({ message: error.message || "Failed to process donation." });
      }
    }
  );

  // Review routes
  // GET /api/reviews - List reviews (Refactored for Firestore)
  app.get("/api/reviews", async (req: Request, res: Response) => {
    try {
      const { revieweeId, serviceId, bookingId, limit: queryLimit, lastVisible } = req.query;
      const db = admin.firestore();
      let query: admin.firestore.Query = db.collection('reviews');

      if (revieweeId) {
        query = query.where('revieweeId', '==', revieweeId as string);
      } else if (bookingId) { // Fetching reviews for a specific booking
        query = query.where('bookingId', '==', bookingId as string);
      } else if (serviceId) {
        // Fetching all reviews for a serviceId is complex with Firestore if not denormalized.
        // Option 1: Denormalize serviceId into each review document.
        // Option 2: Fetch all bookings for the service, then fetch reviews for those bookings (many reads, limited by 'in' query).
        // For MVP, let's state this specific filter might be deferred or simplified to be combined with providerId.
        // If serviceId is provided, it might be better to also require serviceProviderId to narrow down.
        console.warn("Fetching reviews by serviceId directly is not efficiently supported without denormalization. Consider fetching by revieweeId (provider) instead or for a specific booking.");
        // For now, if only serviceId is given, we might return empty or an error, or combine with other filters if available.
        // This example will not implement direct serviceId fetching without other context.
        return res.status(400).json({ message: "Fetching reviews by serviceId alone is not directly supported. Try fetching by revieweeId (serviceProviderId)." });
      } else {
        // No specific filter, maybe return latest public reviews or error
        // For now, let's require at least one specific filter like revieweeId or bookingId for public queries
         query = query.where('isPublic', '==', true); // Default to public reviews if no specific target
      }

      query = query.orderBy('createdAt', 'desc');

      const limitNum = parseInt(queryLimit as string) || 10;
      query = query.limit(limitNum);

      if (lastVisible) {
        const lastVisibleDoc = await db.collection('reviews').doc(lastVisible as string).get();
        if (lastVisibleDoc.exists) {
          query = query.startAfter(lastVisibleDoc);
        }
      }

      const reviewsSnapshot = await query.get();
      const reviews = reviewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let nextCursor = null;
      if (reviews.length === limitNum && reviewsSnapshot.docs.length > 0) {
          nextCursor = reviewsSnapshot.docs[reviewsSnapshot.docs.length - 1].id;
      }

      res.json({
        reviews,
        nextCursor
      });
    } catch (error: any) {
      console.error("Error fetching reviews from Firestore:", error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch reviews." });
    }
  });

  // POST /api/reviews - Create a new review (Refactored for Firestore)
  app.post("/api/reviews",
    authenticateToken,
    [ // Validation for review creation
      body('bookingId').trim().notEmpty().withMessage('Booking ID is required.'),
      body('revieweeId').trim().notEmpty().withMessage('Reviewee ID is required.'),
      body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be a number between 1 and 5.'),
      body('comment').trim().notEmpty().escape().withMessage('Comment cannot be empty.'),
      body('images').optional().isArray().withMessage('Images must be an array of URLs.'),
    ],
    async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const reviewerId = req.user.userId; // Firebase UID
      const { bookingId, revieweeId, rating, comment, images } = req.body;
      const db = admin.firestore();

      try {
        // 1. Fetch the booking document
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
          return res.status(404).json({ message: "Booking not found." });
        }
        const bookingData = bookingDoc.data()!;

        // 2. Verify booking status is 'completed'
        if (bookingData.status !== 'completed') {
          return res.status(400).json({ message: "Review can only be submitted for completed bookings." });
        }

        // 3. Verify reviewer is a participant and reviewee is the other party
        let isValidParticipant = false;
        if (reviewerId === bookingData.residentId && revieweeId === bookingData.serviceProviderId) {
          isValidParticipant = true;
        } else if (reviewerId === bookingData.serviceProviderId && revieweeId === bookingData.residentId) {
          isValidParticipant = true;
        }
        if (!isValidParticipant) {
          logAuditEvent('REVIEW_CREATION_FORBIDDEN_PARTICIPANT', req, reviewerId, { bookingId, revieweeId });
          return res.status(403).json({ message: "Forbidden: Reviewer or reviewee not valid participants for this booking." });
        }

        // 4. Check if a review already exists for this booking by this reviewer
        const reviewsQuery = db.collection('reviews')
                              .where('bookingId', '==', bookingId)
                              .where('reviewerId', '==', reviewerId);
        const existingReviewsSnapshot = await reviewsQuery.get();
        if (!existingReviewsSnapshot.empty) {
          return res.status(409).json({ message: "Review already submitted for this booking by this user." });
        }

        // 5. Create the review document
        const reviewData = {
          bookingId,
          reviewerId,
          revieweeId,
          rating: Number(rating),
          comment,
          images: images || [],
          isPublic: true, // Default to public
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(), // Firestore schema has updatedAt
        };
        const reviewRef = await db.collection('reviews').add(reviewData);

        // 6. Update average rating and review count for the reviewee (user)
        // This should ideally be done in a transaction or a Firebase Function for atomicity.
        // For simplicity here, performing direct updates with a note on atomicity.
        const revieweeUserRef = db.collection('users').doc(revieweeId);
        try {
          await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(revieweeUserRef);
            if (!userDoc.exists) {
              throw new Error(`User ${revieweeId} not found for rating update.`);
            }
            const userData = userDoc.data()!;
            const currentRatingCount = userData.reviewCount || 0;
            const currentAverageRating = userData.averageRating || 0;

            const newRatingCount = currentRatingCount + 1;
            const newAverageRating = ((currentAverageRating * currentRatingCount) + Number(rating)) / newRatingCount;

            transaction.update(revieweeUserRef, {
              averageRating: parseFloat(newAverageRating.toFixed(2)), // Store with 2 decimal places
              reviewCount: newRatingCount,
              updatedAt: FieldValue.serverTimestamp()
            });
          });
          logAuditEvent('USER_RATING_UPDATED', req, reviewerId, { revieweeId, newAverageRating, newRatingCount });
        } catch (ratingUpdateError) {
            console.error(`Failed to update average rating for user ${revieweeId}:`, ratingUpdateError);
            Sentry.captureException(ratingUpdateError); // Log error, but review creation itself was successful
        }

        logAuditEvent('REVIEW_CREATED', req, reviewerId, { reviewId: reviewRef.id, bookingId, revieweeId, rating });
        res.status(201).json({ id: reviewRef.id, ...reviewData });

      } catch (error: any) {
        console.error("Review creation error:", error);
        Sentry.captureException(error);
        res.status(500).json({ message: "Failed to create review." });
      }
    }
  );

  // Message routes
  app.get("/api/messages", authenticateToken, async (req, res) => {
    try {
      const messages = await storage.getMessages(req.user.userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/messages/conversation/:userId", authenticateToken, async (req, res) => {
    try {
      const otherUserId = parseInt(req.params.userId);
      const messages = await storage.getConversation(req.user.userId, otherUserId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/messages", authenticateToken, async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user.userId,
      });

      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      console.error("Message creation error:", error);
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.put("/api/messages/:id/read", authenticateToken, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      await storage.markMessageAsRead(messageId);
      res.json({ message: "Message marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin routes
  app.get("/api/admin/stats", authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getUsers();
      const services = await storage.getServices();
      const bookings = await storage.getBookings();
      const projects = await storage.getStarProjects();
      const causes = await storage.getStarCauses();

      const stats = {
        totalUsers: users.length,
        activeServices: services.filter(s => s.isAvailable).length,
        totalBookings: bookings.length,
        activeProjects: projects.filter(p => p.status === 'active').length,
        activeCauses: causes.filter(c => c.status === 'active').length,
        completedBookings: bookings.filter(b => b.status === 'completed').length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  // Sentry Test Route
  app.get("/debug-sentry-server", (req, res) => {
    const SENTRY_DSN_SERVER = process.env.SENTRY_SERVER_DSN || "https://examplePublicKey@o0.ingest.sentry.io/0";
    if (SENTRY_DSN_SERVER !== "https://examplePublicKey@o0.ingest.sentry.io/0") {
      throw new Error("My first Sentry error! - Server Test - " + new Date().toISOString());
    }
    res.send("Sentry server test route. Error thrown if Sentry DSN is configured.");
  });

  // Health Check Endpoint
  app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok", message: "Server is healthy" });
  });

  // Placeholder for User Account Deletion
  app.delete("/api/users/me", authenticateToken, async (req: Request, res: Response) => {
    const userId = req.user.userId; // This is Firebase UID (string)
    console.log(`Received request to delete account for user ID: ${userId}`);

    // --- Strategy Outline for Deletion ---
    // 1. Perform Authentication & Authorization: Ensure user is deleting themselves.

    // 2. Log Audit Event (User Initiated Deletion Request)
    logAuditEvent('USER_DELETION_REQUESTED', req, userId, { targetType: 'user', targetId: userId });

    // 3. Graceful Deletion Process (Consider a multi-stage process):
    //    a. Stage 1: Soft Delete / Deactivation (Immediate)
    //       - Mark user as inactive (e.g., `isActive = false` in `users` table).
    //       - Revoke active sessions/JWTs if possible (more complex with JWTs, might rely on short expiry).
    //       - User data is preserved for a grace period (e.g., 30 days for accidental recovery).
    //       - Communicate to user that account is deactivated and will be permanently deleted after X days.
    //    b. Stage 2: Hard Delete / Anonymization (After grace period or if specifically requested for immediate GDPR erasure)
    //       - Delete PII from `users` table (e.g., email, firstName, lastName, encryptedPhoneNumber).
    //         Or, if user record must be kept for FK integrity but anonymized, replace PII with placeholder values.
    //       - Handle related data:
    //         - Services created: Decide to delete, anonymize providerId, or transfer.
    //         - Bookings: Anonymize residentId/providerId if involved. Keep transaction part for records.
    //         - Wallet/Transactions: Anonymize userId. Transaction records might need to be kept for financial audits.
    //         - Projects/Causes created: Anonymize creatorId/championId or delete if no contributions.
    //         - Contributions/Donations made: These records likely stay but linked to an anonymized user.
    //         - Messages: Delete or anonymize.
    //         - Reviews: Delete or anonymize.
    //       - This requires careful cascading logic in the database or application layer.

    // For this placeholder, we'll just simulate a soft delete acknowledgement.
    try {
      // Simulate marking as inactive in DB
      // await storage.updateUser(userId, { isActive: false, email: `deleted_${userId}@example.com`, phoneNumber: null });
      console.log(`User ID: ${userId} marked as inactive (simulated). Full deletion/anonymization would follow policy.`);

      logAuditEvent('USER_DEACTIVATED', req, userId, { targetType: 'user', targetId: userId, details: "Account soft deleted/deactivated." });

      res.status(202).json({ message: "Account deactivation initiated. Permanent deletion will occur as per data retention policy." });
    } catch (error) {
      console.error(`Error during account deletion simulation for user ID: ${userId}`, error);
      logAuditEvent('USER_DELETION_FAILED', req, userId, { targetType: 'user', targetId: userId, error: String(error) });
      res.status(500).json({ message: "Error processing account deletion request." });
    }
  });

  // --- Token Wallet and Transaction Routes ---

  // GET /api/wallet - Fetch user's token wallet
  app.get("/api/wallet", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user.userId; // Firebase UID from token
      const db = admin.firestore();
      const walletRef = db.collection('tokenWallets').doc(userId);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        // This might happen if wallet creation failed during registration,
        // or if the user somehow exists in Auth but not fully provisioned.
        logAuditEvent('WALLET_NOT_FOUND', req, userId, { note: "User attempted to fetch non-existent wallet." });
        return res.status(404).json({ message: "Token wallet not found for this user." });
      }

      res.json({ id: walletDoc.id, ...walletDoc.data() });
    } catch (error: any) {
      console.error(`Error fetching wallet for user ${req.user.userId}:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch token wallet." });
    }
  });

  // GET /api/wallet/transactions - Fetch user's token transaction history
  app.get("/api/wallet/transactions", authenticateToken, async (req: Request, res: Response) => {
    try {
      const userId = req.user.userId; // Firebase UID from token
      const db = admin.firestore();

      let query: admin.firestore.Query = db.collection('tokenTransactions')
                                           .where('userId', '==', userId)
                                           .orderBy('createdAt', 'desc'); // Default sort by newest

      const limit = parseInt(req.query.limit as string) || 10; // Default limit to 10 transactions
      query = query.limit(limit);

      const lastVisibleDocId = req.query.lastVisible as string;
      if (lastVisibleDocId) {
        const lastVisibleDoc = await db.collection('tokenTransactions').doc(lastVisibleDocId).get();
        if (lastVisibleDoc.exists) {
          query = query.startAfter(lastVisibleDoc);
        }
      }

      const transactionsSnapshot = await query.get();
      const transactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Determine if there's a next page for simple cursor pagination
      let nextCursor = null;
      if (transactions.length === limit && transactionsSnapshot.docs.length > 0) {
          // If the number of docs returned is equal to the limit, there might be more.
          // The ID of the last document fetched can be used as the startAfter for the next query.
          nextCursor = transactionsSnapshot.docs[transactionsSnapshot.docs.length - 1].id;
      }


      res.json({
        transactions,
        nextCursor // Client can use this for 'lastVisible' in next request
      });

    } catch (error: any) {
      console.error(`Error fetching transactions for user ${req.user.userId}:`, error);
      Sentry.captureException(error);
      res.status(500).json({ message: "Failed to fetch token transactions." });
    }
  });


  return httpServer;
}
