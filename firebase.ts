// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { initializeFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Firebase configuration - load from environment variables or use defaults
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
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);
import { getMessaging, Messaging } from "firebase/messaging";
export const messaging: Messaging = getMessaging(app);

// Initialize Firestore with persistentLocalCache to satisfy production hardening (Task 5).
// Enables offline action queuing and data persistence during network drops.
let db: Firestore;
db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  // ✅ Auto-detect: uses WebSocket by default, falls back to long-poll only on restricted networks
  experimentalAutoDetectLongPolling: true,
});
console.log("🔥 [FIRESTORE] Initialized with AutoDetectLongPolling (WebSocket preferred)");

export { db };

// Analytics - Completely disabled to prevent ad blocker conflicts
// Analytics is optional and not critical for app functionality
// Re-enable in production if needed by uncommenting the code below
let analytics: any = null;

// Analytics initialization disabled to prevent ERR_BLOCKED_BY_CLIENT errors
// If you need Analytics, enable it only in production builds:
// if (typeof window !== 'undefined' && firebaseConfig.measurementId && import.meta.env.PROD) {
//   // Analytics initialization code here
// }

export { analytics };
export default app;