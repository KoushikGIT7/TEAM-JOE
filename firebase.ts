// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { initializeFirestore, Firestore, memoryLocalCache } from "firebase/firestore";

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

// Initialize Firestore with memoryLocalCache.
//
// WHY NOT persistentLocalCache?
// persistentLocalCache() uses IndexedDB which triggers a known Firebase SDK
// internal assertion error (ID: ca9 / b815, ve=-1) when:
//   - The IndexedDB watch-stream target state gets corrupted
//   - Multiple browser tabs are open simultaneously
//   - Network conditions cause the watch stream to reset unexpectedly
//
// memoryLocalCache is stable, does not use IndexedDB, has no multi-tab
// conflicts, and still provides full real-time onSnapshot support.
// Offline persistence is not critical for a cafeteria ordering system.
//
// experimentalForceLongPolling: true — improves reliability on college/
// corporate WiFi networks that block WebSocket upgrades (HTTP polling fallback).
let db: Firestore;
db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
});

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