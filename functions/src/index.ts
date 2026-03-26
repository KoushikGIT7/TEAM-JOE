import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// 📣 [ONESIGNAL] Secure notification engine — runs ONLY on the backend.
// The REST API key NEVER touches the browser bundle.
// Set via: firebase functions:secrets:set ONESIGNAL_REST_API_KEY
// ─────────────────────────────────────────────────────────────────────────────

const ONESIGNAL_APP_ID = "2561939d-5fe5-4311-b95c-c12b7ee9ded0";

type NotificationEvent =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_REJECTED"
  | "FIRST_ITEM_READY"
  | "FULL_ORDER_READY"
  | "ORDER_MISSED";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

const NOTIFICATION_TEMPLATES: Record<NotificationEvent, NotificationPayload> = {
  PAYMENT_SUCCESS: {
    title: "✅ Payment Received",
    body: "Your order is confirmed and now in the kitchen queue.",
  },
  PAYMENT_REJECTED: {
    title: "❌ Payment Rejected",
    body: "Your payment was declined by the cashier. Please pay again.",
  },
  FIRST_ITEM_READY: {
    title: "⚡ First Item Ready",
    body: "Your first item is ready. Head to the counter!",
  },
  FULL_ORDER_READY: {
    title: "🎉 Order Ready for Pickup",
    body: "Your full order is ready. Come collect it now!",
  },
  ORDER_MISSED: {
    title: "⚠️ Order Re-queued",
    body: "Your pickup window was missed. Your order has been re-queued.",
  },
};

/**
 * 🚀 [BACKEND-NOTIFY] Sends a targeted OneSignal push to a student.
 * Fails gracefully — never blocks the calling transaction.
 */
async function sendNotification(
  externalUserId: string,
  event: NotificationEvent,
  orderId: string
): Promise<void> {
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!apiKey) {
    functions.logger.error("[NOTIFY-ERROR] ONESIGNAL_REST_API_KEY secret not set.");
    return;
  }

  const template = NOTIFICATION_TEMPLATES[event];
  if (!template) {
    functions.logger.warn(`[NOTIFY-WARN] Unknown event type: ${event}`);
    return;
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_external_user_ids: [externalUserId],
    channel_for_external_user_ids: "push",
    headings: { en: template.title },
    contents: { en: template.body },
    data: { orderId, event, ...(template.data || {}) },
    priority: 10,
    ttl: 3600,
  };

  try {
    const fetch = (await import("node-fetch")).default;
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as Record<string, unknown>;
    functions.logger.info(`[NOTIFY] ${event} sent for order ${orderId}`, { result });
  } catch (err) {
    functions.logger.error(`[NOTIFY-ERROR] OneSignal send failed for order ${orderId}`, err);
    // NON-BLOCKING: swallow error, business flow continues
  }
}

/**
 * 🛡️ [IDEMPOTENCY] Returns true if the event key was already sent.
 * Uses notificationEvents map on the order document.
 */
async function markEventSent(
  orderId: string,
  event: NotificationEvent
): Promise<boolean> {
  const ref = db.collection("orders").doc(orderId);

  let alreadySent = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const sentEvents: Record<string, number> = snap.data()?.notificationEvents || {};
    if (sentEvents[event]) {
      alreadySent = true;
      return;
    }
    tx.update(ref, {
      [`notificationEvents.${event}`]: Date.now(),
    });
  });
  return alreadySent;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 CLOUD FUNCTION: onOrderWrite — Watches ALL order-level state changes
// Triggers: PAYMENT_SUCCESS, PAYMENT_REJECTED, FULL_ORDER_READY
// ─────────────────────────────────────────────────────────────────────────────
export const onOrderWrite = functions
  .firestore.document("orders/{orderId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data()! : null;
    const after = change.after.exists ? change.after.data()! : null;
    const orderId = context.params.orderId;

    if (!after) return; // Document deleted — ignore
    if (!after.userId) {
      functions.logger.warn(`[NOTIFY-WARN] Missing userId on order ${orderId}`);
      return;
    }

    const studentId: string = after.userId;

    // ── PAYMENT SUCCESS ─────────────────────────────────────────────────────
    const wasNotPaid = !before || (before.paymentStatus !== "SUCCESS" && before.paymentStatus !== "VERIFIED");
    const isNowPaid = after.paymentStatus === "SUCCESS" || after.paymentStatus === "VERIFIED";
    if (wasNotPaid && isNowPaid) {
      const duplicate = await markEventSent(orderId, "PAYMENT_SUCCESS");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] PAYMENT_SUCCESS queued for order ${orderId}`);
        await sendNotification(studentId, "PAYMENT_SUCCESS", orderId);
      } else {
        functions.logger.info(`[NOTIFY-WARN] Duplicate PAYMENT_SUCCESS skipped for order ${orderId}`);
      }
      return;
    }

    // ── PAYMENT REJECTED ────────────────────────────────────────────────────
    const wasNotRejected = !before || before.paymentStatus !== "REJECTED";
    const isNowRejected = after.paymentStatus === "REJECTED";
    if (wasNotRejected && isNowRejected) {
      const duplicate = await markEventSent(orderId, "PAYMENT_REJECTED");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] PAYMENT_REJECTED sent for order ${orderId}`);
        await sendNotification(studentId, "PAYMENT_REJECTED", orderId);
      } else {
        functions.logger.info(`[NOTIFY-WARN] Duplicate PAYMENT_REJECTED skipped for order ${orderId}`);
      }
      return;
    }

    // ── FULL ORDER READY ────────────────────────────────────────────────────
    const wasNotReady = !before || before.serveFlowStatus !== "READY";
    const isNowReady = after.serveFlowStatus === "READY";
    if (wasNotReady && isNowReady) {
      const duplicate = await markEventSent(orderId, "FULL_ORDER_READY");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] FULL_ORDER_READY sent for order ${orderId}`);
        await sendNotification(studentId, "FULL_ORDER_READY", orderId);
      } else {
        functions.logger.info(`[NOTIFY-WARN] Duplicate FULL_ORDER_READY skipped for order ${orderId}`);
      }
      return;
    }

    // ── ORDER MISSED (Re-queued) ─────────────────────────────────────────────
    const wasNotMissed = !before || before.orderStatus !== "MISSED";
    const isNowMissed = after.orderStatus === "MISSED";
    if (wasNotMissed && isNowMissed) {
      const duplicate = await markEventSent(orderId, "ORDER_MISSED");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] ORDER_MISSED sent for order ${orderId}`);
        await sendNotification(studentId, "ORDER_MISSED", orderId);
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 CLOUD FUNCTION: onItemWrite — Watches item subcollection for FIRST_ITEM_READY
// Triggers: FIRST_ITEM_READY (only once, even when many items become READY)
// ─────────────────────────────────────────────────────────────────────────────
export const onItemWrite = functions
  .firestore.document("orders/{orderId}/items/{itemId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const orderId = context.params.orderId;

    if (!after) return;

    // Only care about PREPARATION_ITEM going READY
    const itemType = after.orderType || "PREPARATION_ITEM";
    if (itemType === "FAST_ITEM") return; // Static items never need a FIRST_ITEM_READY push

    const wasNotReady = !before || before.status !== "READY";
    const isNowReady = after.status === "READY";
    if (!wasNotReady || !isNowReady) return;

    // Fetch the parent order document to get the studentId
    const orderSnap = await db.collection("orders").doc(orderId).get();
    if (!orderSnap.exists) {
      functions.logger.warn(`[NOTIFY-WARN] Parent order ${orderId} not found for FIRST_ITEM_READY`);
      return;
    }
    const orderData = orderSnap.data()!;
    if (!orderData.userId) {
      functions.logger.warn(`[NOTIFY-WARN] Missing userId on order ${orderId}`);
      return;
    }

    // Idempotency: only send once per order, even if multiple items go READY
    const duplicate = await markEventSent(orderId, "FIRST_ITEM_READY");
    if (duplicate) {
      functions.logger.info(`[NOTIFY-WARN] Duplicate FIRST_ITEM_READY skipped for order ${orderId}`);
      return;
    }

    // Check: if FULL_ORDER_READY was already sent, skip FIRST_ITEM_READY (no spam)
    const sentEvents = orderData.notificationEvents || {};
    if (sentEvents["FULL_ORDER_READY"]) {
      functions.logger.info(`[NOTIFY-WARN] FULL_ORDER_READY already sent for ${orderId}, skipping FIRST_ITEM_READY`);
      return;
    }

    functions.logger.info(`[NOTIFY] FIRST_ITEM_READY sent for order ${orderId}`);
    await sendNotification(orderData.userId, "FIRST_ITEM_READY", orderId);
  });
