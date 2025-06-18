import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyB4MCOq-pO3Is4k6ShkngHLN_bF_NNgc0c", // User-provided
  authDomain: "star-community.firebaseapp.com",     // User-provided
  projectId: "star-community",                       // User-provided
  storageBucket: "star-community.firebasestorage.app", // User-provided (corrected from .appspot.com if this is indeed the intended storage)
  messagingSenderId: "224478198278",                 // User-provided
  appId: "1:224478198278:web:8d719cbcd495e9925d2187", // User-provided
  measurementId: "G-03NW8F03ZH"                      // User-provided
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp(); // If already initialized, get the existing app
}

const auth: Auth = getAuth(app);
const firestore: Firestore = getFirestore(app);

let analytics: Analytics | null = null;
if (firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
    console.log("Firebase Analytics initialized.");
  } catch (error) {
    console.error("Failed to initialize Firebase Analytics:", error);
    // Keep analytics as null if initialization fails
  }
} else {
  console.warn("Firebase measurementId not found in config. Firebase Analytics not initialized by firebase.ts.");
}

export { app, auth, firestore, analytics };
