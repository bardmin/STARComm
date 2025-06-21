// client/src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your Firebase config object (get this from Firebase Console)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Connect to emulators in development
if (import.meta.env.DEV) {
  // Check if we're already connected to avoid multiple connections
  if (!auth.config.emulator) {
    connectAuthEmulator(auth, 'http://localhost:9099');
  }
  
  // For Firestore emulator
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    // Emulator already connected
  }
  
  // For Storage emulator
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    // Emulator already connected
  }
}

export default app;



/* import admin from 'firebase-admin';
import { initializeApp, applicationDefault, App } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

const FIREBASE_PROJECT_ID = 'star-community';
let firebaseApp: App | null = null;

export const initializeFirebaseAdmin = async (): Promise<void> => {
  if (firebaseApp) {
    console.log('Firebase Admin SDK already initialized.');
    return;
  }

  try {
    let serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    // Fallback to relative path if env var is not set or file doesn't exist
    if (!serviceAccountPath || !fs.existsSync(path.resolve(serviceAccountPath))) {
      // Try relative path from server directory
      const relativePath = path.join(__dirname, '..', 'star-community.json');
      if (fs.existsSync(relativePath)) {
        serviceAccountPath = relativePath;
        console.log(`📁 Using relative path for service account: ${relativePath}`);
      }
    }
    
    console.log('🔍 Firebase initialization debug:');
    console.log('GOOGLE_APPLICATION_CREDENTIALS env var:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log('Using service account path:', serviceAccountPath);
    console.log('Current working directory:', process.cwd());
    console.log('__dirname:', __dirname);
    
    if (serviceAccountPath) {
      const resolvedPath = path.resolve(serviceAccountPath);
      console.log('Resolved path:', resolvedPath);
      console.log('File exists?', fs.existsSync(resolvedPath));
      
      if (fs.existsSync(resolvedPath)) {
        console.log(`✅ Initializing Firebase Admin SDK with service account key from: ${resolvedPath}`);
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

        firebaseApp = initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: FIREBASE_PROJECT_ID,
        });
      } else {
        console.error(`❌ Service account file not found at: ${resolvedPath}`);
        console.log('⚠️ Falling back to Application Default Credentials.');
        firebaseApp = initializeApp({
          credential: applicationDefault(),
          projectId: FIREBASE_PROJECT_ID,
        });
      }
    } else {
      console.warn(
        '⚠️ GOOGLE_APPLICATION_CREDENTIALS not set and no relative path found. Falling back to Application Default Credentials.'
      );
      firebaseApp = initializeApp({
        credential: applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
      });
    }

    console.log('✅ Firebase Admin SDK initialized. Project ID:', FIREBASE_PROJECT_ID);
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error);
    throw error; // Optional: crash app if Firebase is critical
  }
};

export { admin };

export const getFirebaseApp = (): App | null => firebaseApp; */