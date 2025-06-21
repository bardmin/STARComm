import admin from 'firebase-admin';
import { initializeApp, applicationDefault, App } from 'firebase-admin/app';
import fs from 'fs';

const FIREBASE_PROJECT_ID = 'star-community';
let firebaseApp: App | null = null;

export const initializeFirebaseAdmin = async (): Promise<void> => {
  if (firebaseApp) {
    console.log('Firebase Admin SDK already initialized.');
    return;
  }

  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      console.log(`✅ Initializing Firebase Admin SDK with service account key from: ${serviceAccountPath}`);
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

      firebaseApp = initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID,
      });
    } else {
      console.warn(
        '⚠️ GOOGLE_APPLICATION_CREDENTIALS not set or file not found. Falling back to Application Default Credentials.'
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

export const getFirebaseApp = (): App | null => firebaseApp;
