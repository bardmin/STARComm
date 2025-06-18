import admin from 'firebase-admin';
import { initializeApp, applicationDefault, App } from 'firebase-admin/app';

// The projectId from the user's provided firebaseConfig in the initial task prompt
const FIREBASE_PROJECT_ID = 'star-community';

let firebaseApp: App | null = null;

export const initializeFirebaseAdmin = async (): Promise<void> => {
  if (firebaseApp) {
    console.log('Firebase Admin SDK already initialized.');
    return;
  }

  try {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (serviceAccountPath) {
      console.log(`Initializing Firebase Admin SDK with service account key from: ${serviceAccountPath}`);
      firebaseApp = initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId: FIREBASE_PROJECT_ID,
      });
    } else {
      console.warn(
        'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set. ' +
        'Attempting to initialize Firebase Admin SDK with Application Default Credentials. ' +
        'This is suitable for Google Cloud environments (e.g., Cloud Run, Functions) but may not work locally without gcloud CLI setup.'
      );
      firebaseApp = initializeApp({
        credential: applicationDefault(), // For ADC
        projectId: FIREBASE_PROJECT_ID,
      });
    }
    console.log('Firebase Admin SDK initialized successfully. Project ID:', FIREBASE_PROJECT_ID);
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
    // Depending on how critical Firebase Admin is at startup, you might want to throw the error
    // throw error;
  }
};

// Export the initialized admin instance for use in other modules
// It's important that other modules import `admin` from here AFTER initializeFirebaseAdmin has been called.
export { admin };

// Optionally, export the app instance if needed elsewhere, though typically `admin` is sufficient.
export const getFirebaseApp = (): App | null => firebaseApp;
