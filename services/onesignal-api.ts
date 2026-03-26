/**
 * 📣 [ONESIGNAL-FRONTEND-SHIM]
 *
 * ⚠️  IMPORTANT: This file NO LONGER calls the OneSignal REST API directly.
 *
 * WHY: Calling the OneSignal REST API from the browser causes:
 *   1. CORS errors (403 Forbidden) — OneSignal blocks browser-side POST
 *   2. API key exposure in the browser bundle — a security vulnerability
 *
 * NEW ARCHITECTURE:
 *   Frontend  →  updates Firestore state only
 *   Firestore →  triggers Cloud Functions (functions/src/index.ts)
 *   Cloud Fn  →  securely calls OneSignal REST API
 *   Student   →  receives push notification in background
 *
 * This shim exists only for backward compatibility with code that still
 * calls notifyOrderUpdate() — it is now a harmless no-op that logs the
 * intent and lets the Cloud Function handle actual delivery.
 */

/**
 * 🟢 [SAFE-SHIM] notifyOrderUpdate — backward compatible no-op.
 *
 * The actual push is now triggered by Firestore document transitions
 * detected by the Cloud Function (onOrderWrite / onItemWrite).
 * No direct API call is made from the browser.
 */
export const notifyOrderUpdate = (
  userId: string,
  status: string,
  _itemName?: string
): void => {
  // Structured intent log — useful for debugging in dev console
  console.info(
    `[NOTIFY-SHIM] Push intent recorded: userId=${userId} status=${status}. ` +
    `Actual delivery handled by Cloud Function on Firestore state transition.`
  );
  // No fetch. No API key. No CORS error.
};

/**
 * 🟢 [SAFE-SHIM] sendDirectedPush — backward compatible no-op.
 */
export const sendDirectedPush = async (_payload: {
  userId: string;
  title: string;
  message: string;
  sound?: string;
  url?: string;
  data?: Record<string, unknown>;
}): Promise<void> => {
  console.info("[NOTIFY-SHIM] sendDirectedPush suppressed — Cloud Function handles delivery.");
};
