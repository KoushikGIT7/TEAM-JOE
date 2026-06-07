import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();


type NotificationEvent =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_REJECTED"
  | "FULL_ORDER_READY"
  | "ORDER_COLLECTED";

/**
 * 🚀 [BACKEND-NOTIFY] Sends targeted FCM push notifications to a student's active devices.
 * Prunes dead tokens on delivery failure to maintain zero bloat.
 */
async function sendNotification(
  userId: string,
  event: NotificationEvent,
  orderId: string,
  orderData: any
): Promise<void> {
  // 1. Determine title and body based on event and paymentType
  let title = "";
  let body = "";

  if (event === "PAYMENT_SUCCESS") {
    if (orderData.paymentType === "UPI") {
      title = "Payment Confirmed";
      body = "Your order has been placed successfully.";
    } else {
      // CASH order confirmed/approved by Cashier
      title = "Order Confirmed";
      body = "Your order has been accepted and is being prepared.";
    }
  } else if (event === "PAYMENT_REJECTED") {
    title = "Order Rejected";
    body = "Your order could not be accepted. Please contact the cashier.";
  } else if (event === "FULL_ORDER_READY") {
    title = "Order Ready for Pickup";
    body = "Your order is ready at the counter.";
  } else if (event === "ORDER_COLLECTED") {
    title = "Order Completed";
    body = "Your order has been successfully collected.";
  } else {
    // Unknown or unsupported event
    return;
  }

  // 2. Fetch user's FCM tokens from Firestore
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    functions.logger.warn(`[FCM-WARN] User ${userId} profile not found.`);
    return;
  }

  const userData = userSnap.data()!;
  const tokens: string[] = userData.fcmTokens || [];
  if (userData.fcmToken) {
    tokens.push(userData.fcmToken); // Fallback for legacy single token field
  }

  // Deduplicate and filter out empty strings
  const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim() !== '')));

  if (uniqueTokens.length === 0) {
    functions.logger.info(`[FCM-INFO] No registered FCM tokens for user ${userId}. Skipping push.`);
    return;
  }

  const payload = {
    notification: {
      title,
      body,
    },
    data: {
      orderId,
      event,
    },
  };

  functions.logger.info(`[FCM] Sending ${event} to user ${userId} (${uniqueTokens.length} devices)`);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: payload.notification,
      data: payload.data,
    });

    const tokensToRemove: string[] = [];
    response.responses.forEach((res, index) => {
      if (!res.success) {
        const err = res.error;
        if (err) {
          const code = err.code;
          functions.logger.warn(`[FCM-SEND-ERROR] Token error at index ${index} (${uniqueTokens[index]}): ${code}`);
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            tokensToRemove.push(uniqueTokens[index]);
          }
        }
      }
    });

    // Prune invalid/unregistered tokens from the database
    if (tokensToRemove.length > 0) {
      functions.logger.info(`[FCM-CLEANUP] Pruning ${tokensToRemove.length} stale tokens for user ${userId}`);
      await userRef.update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    functions.logger.error(`[FCM-ERROR] Multicast failed for order ${orderId}`, err);
  }
}

/**
 * 🛡️ [IDEMPOTENCY] Returns true if the event key was already sent.
 * Uses notificationEvents map on the order document.
 */
async function markEventSent(
  orderId: string,
  event: string
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
// Triggers: PAYMENT_SUCCESS, PAYMENT_REJECTED, FULL_ORDER_READY, ORDER_COLLECTED
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

    // ── PAYMENT SUCCESS / CASHIER APPROVED ──────────────────────────────────────
    const wasNotPaid = !before || (before.paymentStatus !== "SUCCESS" && before.paymentStatus !== "VERIFIED");
    const isNowPaid = after.paymentStatus === "SUCCESS" || after.paymentStatus === "VERIFIED";
    if (wasNotPaid && isNowPaid) {
      const duplicate = await markEventSent(orderId, "PAYMENT_SUCCESS");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] PAYMENT_SUCCESS queued for order ${orderId}`);
        await sendNotification(studentId, "PAYMENT_SUCCESS", orderId, after);
      } else {
        functions.logger.info(`[NOTIFY-WARN] Duplicate PAYMENT_SUCCESS skipped for order ${orderId}`);
      }
      return;
    }

    // ── PAYMENT REJECTED ────────────────────────────────────────────────────
    const wasNotRejected = !before || (before.paymentStatus !== "REJECTED" && before.orderStatus !== "REJECTED");
    const isNowRejected = after.paymentStatus === "REJECTED" || after.orderStatus === "REJECTED";
    if (wasNotRejected && isNowRejected) {
      const duplicate = await markEventSent(orderId, "PAYMENT_REJECTED");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] PAYMENT_REJECTED sent for order ${orderId}`);
        await sendNotification(studentId, "PAYMENT_REJECTED", orderId, after);
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
        await sendNotification(studentId, "FULL_ORDER_READY", orderId, after);
      } else {
        functions.logger.info(`[NOTIFY-WARN] Duplicate FULL_ORDER_READY skipped for order ${orderId}`);
      }
      return;
    }

    // ── ORDER COLLECTED ─────────────────────────────────────────────────────
    const wasNotCompleted = !before || (before.orderStatus !== "COMPLETED" && before.serveFlowStatus !== "SERVED");
    const isNowCompleted = after.orderStatus === "COMPLETED" || after.serveFlowStatus === "SERVED";
    if (wasNotCompleted && isNowCompleted) {
      const duplicate = await markEventSent(orderId, "ORDER_COLLECTED");
      if (!duplicate) {
        functions.logger.info(`[NOTIFY] ORDER_COLLECTED sent for order ${orderId}`);
        await sendNotification(studentId, "ORDER_COLLECTED", orderId, after);
      } else {
        functions.logger.info(`[NOTIFY-WARN] Duplicate ORDER_COLLECTED skipped for order ${orderId}`);
      }
      return;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 CLOUD FUNCTION: onItemWrite — Watches item subcollection (No-op FCM)
// ─────────────────────────────────────────────────────────────────────────────
export const onItemWrite = functions
  .firestore.document("orders/{orderId}/items/{itemId}")
  .onWrite(async (change, context) => {
    // 🔕 [FCM-SILENCE] FIRST_ITEM_READY pushes have been disabled to prevent spam.
    // Real-time foreground status tracking is handled via Firestore listeners.
    return;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 CLOUD FUNCTION: processHardwareScan — Endpoint for IoT Hardware Scanners
// ─────────────────────────────────────────────────────────────────────────────
export const processHardwareScan = functions.https.onRequest(async (req, res) => {
  // CORS enabled so web-based test harnesses and direct REST clients can ping it safely
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    const { orderId, scannerType } = req.body;
    
    if (!orderId) {
      res.status(400).json({ error: "Missing orderId" });
      return;
    }

    // 1. Fetch Order
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      throw new Error("ORDER_NOT_FOUND");
    }
    
    const order = orderSnap.data()!;
    
    if (order.paymentStatus !== "SUCCESS" && order.paymentStatus !== "VERIFIED") {
      throw new Error("PAYMENT_NOT_VERIFIED");
    }

    // 2. Fetch Items in Subcollection
    const itemsSnap = await orderRef.collection("items").get();
    if (itemsSnap.empty) {
      throw new Error("NO_ITEMS_FOUND");
    }

    const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Filter Items based on Scanner Type Logic
    // - STATIC scanners serve FAST_ITEMs that are PENDING.
    // - DYNAMIC scanners serve PREPARATION_ITEMs that are READY.
    let targetItems: any[] = [];
    if (scannerType === "STATIC") {
      targetItems = items.filter((i: any) => (i.orderType === "FAST_ITEM" || !i.orderType) && i.status === "PENDING");
    } else if (scannerType === "DYNAMIC") {
      targetItems = items.filter((i: any) => i.orderType === "PREPARATION_ITEM" && i.status === "READY");
    } else {
      // Default: Try to serve anything that is READY or a PENDING FAST_ITEM
      targetItems = items.filter((i: any) => 
        i.status === "READY" || ((i.orderType === "FAST_ITEM" || !i.orderType) && i.status === "PENDING")
      );
    }

    if (targetItems.length === 0) {
      // Meaning the student is in the wrong line, or food is still cooking, or already served.
      throw new Error("NOTHING_TO_SERVE_OR_WRONG_LINE");
    }

    // 4. Execute Atomic Batch Update to mark items as SERVED
    const batch = db.batch();
    let totalItemsServed = 0;

    targetItems.forEach((item: any) => {
      const itemRef = orderRef.collection("items").doc(item.id);
      batch.update(itemRef, { 
        status: "SERVED", 
        servedAt: Date.now() 
      });
      totalItemsServed++;
    });

    // Also update order status if all items are now served
    const allItemsAreNowServed = items.every((i: any) => 
      i.status === "SERVED" || targetItems.some(ti => ti.id === i.id)
    );

    if (allItemsAreNowServed) {
      batch.update(orderRef, { orderStatus: "COMPLETED", serveFlowStatus: "SERVED" });
    } else {
      batch.update(orderRef, { serveFlowStatus: "PARTIALLY_SERVED" });
    }

    await batch.commit();

    functions.logger.info(`[HARDWARE-SCAN] Success: orderId=${orderId}, itemsServed=${totalItemsServed}`, { targetItems: targetItems.map(i => i.id) });

    // HTTP 200 causes the scanner to short-beep and flash GREEN.
    res.status(200).json({ 
      success: true, 
      message: "SERVED", 
      itemsServed: totalItemsServed,
      allItemsCompleted: allItemsAreNowServed 
    });
    
  } catch (error: any) {
    functions.logger.error(`[HARDWARE-SCAN] Rejected: ${error.message}`);
    // HTTP 403 causes the scanner to 3-beep and flash RED.
    res.status(403).json({ error: error.message });
  }
});
