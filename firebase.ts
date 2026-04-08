// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { 
  initializeFirestore, 
  Firestore, 
  persistentLocalCache, 
  getFirestore 
} from "firebase/firestore";
import { getMessaging, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBRzOIMBTExHkfM92EMNfCodh63t54OKSw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "joecafe-a7fff.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "joecafe-a7fff",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "joecafe-a7fff.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1034738714307",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1034738714307:web:95e1f52bfa57a101ae8476",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BSF8C3H6S4"
};

// Initialize Firebase (prevent multiple initializations)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
export const messaging: Messaging = getMessaging(app);

// Initialize Firestore with single-tab persistence to resolve BloomFilter synchronization errors
// occurring in multi-tab managers under high volume (as reported in SDK 12.8.0).
// In Vite HMR, we must avoid multiple calls to initializeFirestore with different options.
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({}), // Single tab is more stable for kitchen consoles
    experimentalForceLongPolling: true,
  });
} catch (e) {
  // If already initialized (common in HMR), return the existing instance
  db = getFirestore(app);
}

console.log("🔥 [FIRESTORE] Active with AutoDetectLongPolling");

export { db };

// Analytics - Completely disabled to prevent ad blocker conflicts
export const analytics: any = null;

export default app;