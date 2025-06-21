import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK only once
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

// --- Basic Encryption Utilities (for demonstration) ---
// IMPORTANT: In production, use Firebase Functions secrets for ENCRYPTION_KEY_HEX:
// `functions.config().secrets.encryption_key_hex` or `process.env.ENCRYPTION_KEY_HEX` (set via GCP Secret Manager).
const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY_HEX || "6468657861646563696d616c6b6579666f726c6f63616c74657374696e673132"; // 32-byte key as hex
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // GCM standard
const AUTH_TAG_LENGTH = 16; // GCM standard

function encrypt(text: string): string | null {
  if (!text) return null;
  if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
    functions.logger.error("ENCRYPTION_KEY_HEX is missing or not 64 hex characters (32 bytes). Phone number not encrypted.");
    // Fallback: return original text in dev/test if key is placeholder, otherwise error or return null
    if (ENCRYPTION_KEY_HEX === "6468657861646563696d616c6b6579666f726c6f63616c74657374696e673132") {
        functions.logger.warn("Using placeholder encryption key. Data will not be truly encrypted.");
        return `PLAINTEXT:${text}`; // Indicate it's not really encrypted for dev
    }
    return null; // Indicate encryption failure
  }
  try {
    const crypto = require('crypto');
    const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    functions.logger.error("Encryption failed:", error);
    return null;
  }
}

function decrypt(text: string): string | null {
  if (!text) return null;
  if (text.startsWith("PLAINTEXT:")) { // Dev fallback
    return text.substring("PLAINTEXT:".length);
  }
  if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) {
    functions.logger.error("ENCRYPTION_KEY_HEX is missing or not 64 hex characters (32 bytes). Cannot decrypt.");
    return null; // Indicate decryption failure
  }
  try {
    const crypto = require('crypto');
    const key = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
    const parts = text.split(':');
    if (parts.length !== 3) {
      functions.logger.error("Decryption failed: Invalid encrypted text format.");
      return null;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    functions.logger.error("Decryption failed:", error);
    return null;
  }
}
// --- End Encryption Utilities ---


// Example HTTP function (can be kept for testing if desired)
export const helloSTAR = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello STAR logs from HTTP function!", {structuredData: true});
  response.send("Hello from Firebase STAR Community functions!");
});

export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  functions.logger.info(`New user registered via Firebase Auth: UID=${user.uid}, Email=${user.email}`);

  const { uid, email, displayName, phoneNumber, photoURL, emailVerified } = user;

  let firstName = "";
  let lastName = "";
  if (displayName) {
    const nameParts = displayName.split(" ");
    firstName = nameParts[0];
    if (nameParts.length > 1) {
      lastName = nameParts.slice(1).join(" ");
    }
  }

  let encryptedPhoneNumber = null;
  if (phoneNumber) {
    encryptedPhoneNumber = encrypt(phoneNumber);
    if (!encryptedPhoneNumber) {
        functions.logger.warn(`Failed to encrypt phone number for UID: ${uid} during creation. Storing as null.`);
    }
  }

  const userProfileRef = db.collection("users").doc(uid);
  const userProfileData = {
    userId: uid,
    email: email?.toLowerCase() || null,
    firstName: firstName,
    lastName: lastName,
    userType: "resident",
    role: "resident",
    phoneNumber: encryptedPhoneNumber,
    profileImageUrl: photoURL || "",
    status: "active",
    isActive: true,
    isVerified: emailVerified || false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    location: null,
    address: null,
    areaId: null,
    preferences: {},
    bio: "",
    businessName: null,
    businessDescription: null,
    verificationStatus: 'pending',
    operatingHours: {},
    serviceAreas: [],
    averageRating: 0,
    ratingCount: 0,
    portfolioImages: [],
  };

  try {
    await userProfileRef.set(userProfileData);
    functions.logger.info(`User profile created in Firestore for UID: ${uid}`);

    const walletRef = db.collection("tokenWallets").doc(uid);
    const initialWalletData = {
      userId: uid,
      balance: 0,
      escrowBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      totalPurchased: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastTransactionAt: FieldValue.serverTimestamp(),
    };
    await walletRef.set(initialWalletData);
    functions.logger.info(`Token wallet created in Firestore for UID: ${uid}`);

  } catch (error) {
    functions.logger.error(`Error creating Firestore profile or wallet for UID: ${uid}`, error);
    throw error;
  }
  return null;
});


export const updateUserProfile = functions.https.onCall(async (data, context) => {
  // 1. Authentication Check
  if (!context.auth) {
    functions.logger.error("User attempted to update profile without authentication.");
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  const uid = context.auth.uid;
  functions.logger.info(`User ${uid} attempting to update profile with data:`, data);

  // 2. Input Validation & Allowed Fields
  const {
    firstName, lastName, phoneNumber, profileImageUrl,
    bio, location, address, areaId, preferences
  } = data;
  const allowedUpdates: any = {};

  // Validate and add fields to allowedUpdates
  if (firstName !== undefined) {
    if (typeof firstName === "string" && firstName.trim().length > 0) {
      allowedUpdates.firstName = firstName.trim();
    } else if (firstName === null || firstName.trim().length === 0) { // Allow clearing if desired by making it nullable
        allowedUpdates.firstName = ""; // Or null, depending on schema preference for empty vs null
    } else {
      throw new functions.https.HttpsError("invalid-argument", "First name must be a non-empty string.");
    }
  }
  if (lastName !== undefined) {
    if (typeof lastName === "string" && lastName.trim().length > 0) {
      allowedUpdates.lastName = lastName.trim();
    } else if (lastName === null || lastName.trim().length === 0) {
        allowedUpdates.lastName = ""; // Or null
    } else {
      throw new functions.https.HttpsError("invalid-argument", "Last name must be a non-empty string.");
    }
  }
  if (profileImageUrl !== undefined) {
    if (profileImageUrl === null || (typeof profileImageUrl === "string" && (profileImageUrl.startsWith("http://") || profileImageUrl.startsWith("https://") || profileImageUrl === ""))) {
      allowedUpdates.profileImageUrl = profileImageUrl === "" ? null : profileImageUrl;
    } else {
      throw new functions.https.HttpsError("invalid-argument", "Profile image URL must be a valid URL, an empty string, or null.");
    }
  }
   if (bio !== undefined) {
    if (bio === null || typeof bio === "string") {
      allowedUpdates.bio = bio;
    } else {
      throw new functions.https.HttpsError("invalid-argument", "Bio must be a string or null.");
    }
  }
  if (location !== undefined) {
     if (location === null || typeof location === "object") { // Add more specific validation for object structure if needed
        allowedUpdates.location = location;
     } else {
        throw new functions.https.HttpsError("invalid-argument", "Location must be an object or null.");
     }
  }
  if (address !== undefined) {
     if (address === null || typeof address === "string") {
        allowedUpdates.address = address;
     } else {
        throw new functions.https.HttpsError("invalid-argument", "Address must be a string or null.");
     }
  }
   if (areaId !== undefined) {
     if (areaId === null || typeof areaId === "string") {
        allowedUpdates.areaId = areaId;
     } else {
        throw new functions.https.HttpsError("invalid-argument", "Area ID must be a string or null.");
     }
  }
  if (preferences !== undefined) {
     if (preferences === null || typeof preferences === "object") {
        allowedUpdates.preferences = preferences;
     } else {
        throw new functions.https.HttpsError("invalid-argument", "Preferences must be an object or null.");
     }
  }

  if (phoneNumber !== undefined) {
    const userProfileDoc = await db.collection("users").doc(uid).get();
    const currentEncryptedPhone = userProfileDoc.data()?.phoneNumber;
    const plainCurrentPhone = currentEncryptedPhone ? decrypt(currentEncryptedPhone) : null;

    if (phoneNumber !== plainCurrentPhone) {
       if (phoneNumber === null || (typeof phoneNumber === "string" && phoneNumber.trim() === "")) {
          allowedUpdates.phoneNumber = null;
       } else if (typeof phoneNumber === "string" && phoneNumber.trim().length > 0) {
          const encryptedPhone = encrypt(phoneNumber.trim());
          if (encryptedPhone) {
              allowedUpdates.phoneNumber = encryptedPhone;
          } else {
              functions.logger.warn("Phone number provided but encryption failed for UID: " + uid + ". Not updating phone number.");
              // Do not throw error, just skip updating phone, or decide if this is critical
          }
       } else {
        throw new functions.https.HttpsError("invalid-argument", "Phone number must be a valid string or null.");
       }
    }
  }

  // Ensure non-editable fields are not in data payload from client
  const forbiddenFields = ["email", "role", "userType", "isVerified", "isActive", "status", "createdAt", "userId", "balance", "escrowBalance"];
  for (const field of forbiddenFields) {
    if (data.hasOwnProperty(field)) {
      functions.logger.warn(`Attempt to update forbidden field '${field}' by UID: ${uid} was blocked.`);
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Updating field '${field}' is not allowed.`
      );
    }
  }

  if (Object.keys(allowedUpdates).length === 0) {
    functions.logger.info(`No valid or changed fields to update for UID: ${uid}`, {uid, data});
    // Fetch and return current profile if no changes, or specific message
    const currentProfile = await db.collection("users").doc(uid).get();
    const currentData = currentProfile.data();
    if (currentData && currentData.phoneNumber) currentData.phoneNumber = decrypt(currentData.phoneNumber);
    return { status: "success", message: "No changes applied.", user: currentData };
  }

  // 3. Firestore Update
  allowedUpdates.updatedAt = FieldValue.serverTimestamp();
  const userProfileRef = db.collection("users").doc(uid);

  try {
    await userProfileRef.update(allowedUpdates);
    functions.logger.info(`User profile successfully updated for UID: ${uid}`, {updates: allowedUpdates});

    const updatedProfileDoc = await userProfileRef.get();
    const updatedProfileData = updatedProfileDoc.data();

    if (updatedProfileData && updatedProfileData.phoneNumber) {
      updatedProfileData.phoneNumber = decrypt(updatedProfileData.phoneNumber);
    }

    return { status: "success", message: "Profile updated successfully.", user: updatedProfileData };
  } catch (error) {
    functions.logger.error(`Error updating Firestore profile for UID: ${uid}`, error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to update profile information."
    );
  }
});

export const markMessagesAsRead = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    functions.logger.error("User not authenticated for markMessagesAsRead.");
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const readerUid = context.auth.uid;
  const { chatId, messageIds } = data;

  // 1. Validate input
  if (!chatId || typeof chatId !== "string" || chatId.trim() === "") {
    throw new functions.https.HttpsError("invalid-argument", "chatId must be a non-empty string.");
  }
  if (!messageIds || !Array.isArray(messageIds) || messageIds.some(id => typeof id !== "string" || id.trim() === "")) {
    throw new functions.https.HttpsError("invalid-argument", "messageIds must be an array of non-empty strings.");
  }

  if (messageIds.length === 0) {
    functions.logger.info(`No message IDs provided by ${readerUid} for chat ${chatId}. Nothing to mark as read.`);
    return { status: "success", message: "No messages to mark as read." };
  }

  // Limit the number of messages that can be marked as read in one call to prevent abuse
  if (messageIds.length > 50) { // Example limit
      throw new functions.https.HttpsError("invalid-argument", "Too many message IDs. Please provide 50 or fewer at a time.");
  }

  functions.logger.info(`User ${readerUid} attempting to mark ${messageIds.length} messages in chat ${chatId} as read.`);

  try {
    // 2. Verify Chat Participation
    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      throw new functions.https.HttpsError("not-found", `Chat with ID ${chatId} not found.`);
    }
    const chatData = chatDoc.data();
    if (!chatData || !chatData.participantUids || !chatData.participantUids.includes(readerUid)) {
      throw new functions.https.HttpsError("permission-denied", `User ${readerUid} is not a participant of chat ${chatId}.`);
    }

    // 3. Update Messages using a Batched Write
    const batch = db.batch();
    const messagesCollectionRef = chatRef.collection("messages");

    messageIds.forEach((messageId: string) => {
      const messageRef = messagesCollectionRef.doc(messageId);
      // Atomically add the readerUid to the readBy array if it's not already present.
      batch.update(messageRef, {
        readBy: FieldValue.arrayUnion(readerUid),
        // updatedAt: FieldValue.serverTimestamp() // Optional: if messages have an updatedAt field to track this modification
      });
    });

    await batch.commit();

    functions.logger.info(`Successfully marked ${messageIds.length} messages as read by ${readerUid} in chat ${chatId}.`);
    return { status: "success", message: `${messageIds.length} message(s) marked as read.` };

  } catch (error: any) {
    functions.logger.error(`Error marking messages as read for user ${readerUid} in chat ${chatId}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error; // Re-throw HttpsError as is
    }
    throw new functions.https.HttpsError("internal", "Failed to mark messages as read.", error.message);
  }
});

export const sendMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    functions.logger.error("User not authenticated for sendMessage.");
    throw new functions.https.HttpsError("unauthenticated", "Authentication required to send a message.");
  }

  const senderId = context.auth.uid;
  const { chatId: inputChatId, recipientUid, text, imageUrl } = data;

  // 1. Validate input
  if (!text && !imageUrl) {
    throw new functions.https.HttpsError("invalid-argument", "Message must have text or an image URL.");
  }
  if (text && typeof text !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Message text must be a string.");
  }
  if (imageUrl && typeof imageUrl !== "string") { // Basic URL validation can be added here if needed
    throw new functions.https.HttpsError("invalid-argument", "Image URL must be a string.");
  }
  if (!inputChatId && !recipientUid) {
    throw new functions.https.HttpsError("invalid-argument", "Either chatId or recipientUid must be provided.");
  }
  if (recipientUid && recipientUid === senderId) {
    throw new functions.https.HttpsError("invalid-argument", "Cannot send a message to yourself by specifying recipientUid.");
  }

  let currentChatId = inputChatId;
  let chatDocRef: admin.firestore.DocumentReference; // Explicitly type Firebase

  try {
    // 2. Determine or Create Chat ID for 1-on-1 chat
    if (!currentChatId && recipientUid) {
      functions.logger.info(`Attempting to find/create 1-on-1 chat between ${senderId} and ${recipientUid}`);

      // Construct a deterministic chat ID for 1-on-1 chats
      const uids = [senderId, recipientUid].sort();
      const deterministicChatId = uids.join('_');

      chatDocRef = db.collection("chats").doc(deterministicChatId);
      const chatSnapForNew = await chatDocRef.get();

      if (!chatSnapForNew.exists) {
        functions.logger.info(`No existing 1-on-1 chat found with ID ${deterministicChatId}. Creating new chat.`);
        const newChatData = {
          participantUids: uids,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastMessage: null,
          type: "one_on_one", // Add chat type for potential differentiation (e.g. group chats)
        };
        await chatDocRef.set(newChatData);
        currentChatId = chatDocRef.id;
        functions.logger.info(`Created new 1-on-1 chat: ${currentChatId}`);
      } else {
        currentChatId = chatDocRef.id;
        functions.logger.info(`Found existing 1-on-1 chat: ${currentChatId}`);
        const chatData = chatSnapForNew.data();
        if (!chatData || !chatData.participantUids.includes(senderId)) {
           throw new functions.https.HttpsError("permission-denied", "User is not a participant of this chat.");
        }
      }
    } else if (currentChatId) {
      chatDocRef = db.collection("chats").doc(currentChatId);
      const chatSnap = await chatDocRef.get();
      if (!chatSnap.exists) {
        throw new functions.https.HttpsError("not-found", `Chat with ID ${currentChatId} not found.`);
      }
      const chatData = chatSnap.data();
      if (!chatData || !chatData.participantUids.includes(senderId)) { // Ensure sender is part of the chat
         throw new functions.https.HttpsError("permission-denied", "User is not a participant of this chat.");
      }
    } else {
        throw new functions.https.HttpsError("invalid-argument", "ChatId or RecipientUid is required.");
    }

    // 3. Add Message to Subcollection and Update Chat Document in a Transaction
    const messageTimestamp = FieldValue.serverTimestamp();
    const messageTextForPreview = text ? (text.length > 50 ? text.substring(0, 47) + "..." : text) : (imageUrl ? "Image" : "Empty message");

    const newMessageRef = chatDocRef.collection("messages").doc();

    await db.runTransaction(async (transaction) => {
      transaction.set(newMessageRef, {
        senderId: senderId,
        text: text || null,
        imageUrl: imageUrl || null,
        timestamp: messageTimestamp, // Use the same consistent timestamp
        readBy: [senderId],
      });

      transaction.update(chatDocRef, {
        updatedAt: messageTimestamp,
        lastMessage: {
          text: messageTextForPreview,
          senderId: senderId,
          timestamp: messageTimestamp,
        },
        // Optionally, manage unread counts per participant on the chat document
        // For example: [`unreadCount.${otherParticipantUid}`]: admin.firestore.FieldValue.increment(1)
      });
    });

    functions.logger.info(`Message ${newMessageRef.id} sent to chat ${currentChatId} by ${senderId}`);
    return { status: "success", chatId: currentChatId, messageId: newMessageRef.id };

  } catch (error: any) {
    functions.logger.error(`Error sending message for user ${senderId} to chat ${currentChatId || 'new (recipient: '+recipientUid+')'}:`, error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Failed to send message.", error.message);
  }
});
