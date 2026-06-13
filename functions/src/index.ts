import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION EVENTS
// ─────────────────────────────────────────────────────────────────────────────
type NotificationEvent =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_REJECTED"
  | "CASH_ORDER_PLACED"
  | "KITCHEN_COOKING"
  | "FULL_ORDER_READY"
  | "QR_SCANNED_SERVED"
  | "ORDER_COLLECTED"
  | "WALLET_RECHARGED"
  | "WALLET_RECHARGE_REJECTED";

// ─────────────────────────────────────────────────────────────────────────────
// sendNotification — FCM multicast with dead-token pruning
// ─────────────────────────────────────────────────────────────────────────────
async function sendNotification(
  userId: string,
  event: NotificationEvent,
  orderId: string,
  orderData: any
): Promise<void> {
  let title = "";
  let body = "";

  switch (event) {
    case "PAYMENT_SUCCESS":
      if (orderData.paymentType === "UPI" || orderData.paymentType === "WALLET") {
        title = "✅ Payment Confirmed";
        body = "Your order has been placed. We're getting it ready!";
      } else {
        title = "✅ Cash Confirmed — QR Unlocked!";
        body = "Show your QR code at the counter to collect your order.";
      }
      break;
    case "PAYMENT_REJECTED":
      title = "❌ Order Rejected";
      body = "Your order could not be accepted. Please contact the cashier.";
      break;
    case "CASH_ORDER_PLACED":
      title = "💵 Cash Order Received";
      body = `Order #${orderId.slice(-4).toUpperCase()} is waiting for cashier confirmation. Please pay at the counter.`;
      break;
    case "KITCHEN_COOKING":
      title = "🍳 Kitchen is Cooking!";
      body = `Order #${orderId.slice(-4).toUpperCase()} is being prepared. Sit tight!`;
      break;
    case "FULL_ORDER_READY":
      title = "🍽️ Order Ready for Pickup!";
      body = `Order #${orderId.slice(-4).toUpperCase()} is ready at the counter. Come collect it now!`;
      break;
    case "QR_SCANNED_SERVED":
      title = "🎉 Order Handed Over!";
      body = `Order #${orderId.slice(-4).toUpperCase()} has been served. Enjoy your meal! Bon appétit 🎊`;
      break;
    case "ORDER_COLLECTED":
      title = "✅ Order Completed";
      body = "Your order has been successfully collected. See you next time!";
      break;
    case "WALLET_RECHARGED":
      title = "💰 Wallet Recharged!";
      body = `₹${orderData.amount || ''} has been added to your JOE Wallet. Updated balance ready.`;
      break;
    case "WALLET_RECHARGE_REJECTED":
      title = "❌ Recharge Rejected";
      body = `Your recharge of ₹${orderData.amount || ''} was declined. Please contact the cashier.`;
      break;
    default:
      return;
  }

  // Fetch FCM tokens from Firestore
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    functions.logger.warn(`[FCM-WARN] User ${userId} profile not found.`);
    return;
  }

  const userData = userSnap.data()!;
  const tokens: string[] = userData.fcmTokens || [];
  if (userData.fcmToken) tokens.push(userData.fcmToken); // legacy field fallback

  const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim() !== '')));
  if (uniqueTokens.length === 0) {
    functions.logger.info(`[FCM-INFO] No FCM tokens for user ${userId}. Skipping push.`);
    return;
  }

  functions.logger.info(`[FCM] Sending ${event} to user ${userId} (${uniqueTokens.length} devices)`);

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: uniqueTokens,
      notification: { title, body },
      data: { orderId, event },
      android: {
        priority: "high",
        notification: { channelId: "joe_orders", sound: "default" }
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } }
      }
    });

    const tokensToRemove: string[] = [];
    response.responses.forEach((res, index) => {
      if (!res.success) {
        const code = res.error?.code;
        functions.logger.warn(`[FCM-SEND-ERROR] Token[${index}]: ${code}`);
        if (
          code === "messaging/invalid-registration-token" ||
          code === "messaging/registration-token-not-registered"
        ) {
          tokensToRemove.push(uniqueTokens[index]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      functions.logger.info(`[FCM-CLEANUP] Pruning ${tokensToRemove.length} stale tokens for ${userId}`);
      await userRef.update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    functions.logger.error(`[FCM-ERROR] Multicast failed for ${orderId}`, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// markEventSent — Idempotency guard via Firestore transaction
// ─────────────────────────────────────────────────────────────────────────────
async function markEventSent(orderId: string, event: string): Promise<boolean> {
  const ref = db.collection("orders").doc(orderId);
  let alreadySent = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const sentEvents: Record<string, number> = snap.data()?.notificationEvents || {};
    if (sentEvents[event]) { alreadySent = true; return; }
    tx.update(ref, { [`notificationEvents.${event}`]: Date.now() });
  });
  return alreadySent;
}

// ─────────────────────────────────────────────────────────────────────────────
// onOrderWrite — watches ALL order-level state changes
// Triggers: PAYMENT_SUCCESS, PAYMENT_REJECTED, CASH_ORDER_PLACED,
//           KITCHEN_COOKING, FULL_ORDER_READY, QR_SCANNED_SERVED, ORDER_COLLECTED
// ─────────────────────────────────────────────────────────────────────────────
export const onOrderWrite = functions
  .firestore.document("orders/{orderId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data()! : null;
    const after  = change.after.exists  ? change.after.data()!  : null;
    const orderId = context.params.orderId;

    if (!after) return;
    if (!after.userId) {
      functions.logger.warn(`[NOTIFY-WARN] Missing userId on order ${orderId}`);
      return;
    }

    const studentId: string = after.userId;

    // ── 1. CASH ORDER PLACED (student placed cash order, waiting for cashier) ──
    const wasCreated = !before;
    const isCash = after.paymentType === "CASH";
    if (wasCreated && isCash && after.paymentStatus === "PENDING") {
      const dup = await markEventSent(orderId, "CASH_ORDER_PLACED");
      if (!dup) {
        functions.logger.info(`[NOTIFY] CASH_ORDER_PLACED for ${orderId}`);
        await sendNotification(studentId, "CASH_ORDER_PLACED", orderId, after);
      }
      return;
    }

    // ── 2. PAYMENT SUCCESS / CASHIER APPROVED ──────────────────────────────────
    const wasNotPaid  = !before || (before.paymentStatus !== "SUCCESS" && before.paymentStatus !== "VERIFIED");
    const isNowPaid   = after.paymentStatus === "SUCCESS" || after.paymentStatus === "VERIFIED";
    if (wasNotPaid && isNowPaid) {
      const dup = await markEventSent(orderId, "PAYMENT_SUCCESS");
      if (!dup) {
        functions.logger.info(`[NOTIFY] PAYMENT_SUCCESS for ${orderId}`);
        await sendNotification(studentId, "PAYMENT_SUCCESS", orderId, after);
      }
      return;
    }

    // ── 3. PAYMENT REJECTED ────────────────────────────────────────────────────
    const wasNotRejected = !before || (before.paymentStatus !== "REJECTED" && before.orderStatus !== "REJECTED");
    const isNowRejected  = after.paymentStatus === "REJECTED"  || after.orderStatus === "REJECTED";
    if (wasNotRejected && isNowRejected) {
      const dup = await markEventSent(orderId, "PAYMENT_REJECTED");
      if (!dup) {
        functions.logger.info(`[NOTIFY] PAYMENT_REJECTED for ${orderId}`);
        await sendNotification(studentId, "PAYMENT_REJECTED", orderId, after);
      }
      return;
    }

    // ── 4. KITCHEN COOKING (kitchenStatus transitions to COOKING) ──────────────
    const wasNotCooking = !before || before.kitchenStatus !== "COOKING";
    const isNowCooking  = after.kitchenStatus === "COOKING";
    if (wasNotCooking && isNowCooking) {
      const dup = await markEventSent(orderId, "KITCHEN_COOKING");
      if (!dup) {
        functions.logger.info(`[NOTIFY] KITCHEN_COOKING for ${orderId}`);
        await sendNotification(studentId, "KITCHEN_COOKING", orderId, after);
      }
      return;
    }

    // ── 5. FULL ORDER READY ────────────────────────────────────────────────────
    const wasNotReady = !before || before.serveFlowStatus !== "READY";
    const isNowReady  = after.serveFlowStatus === "READY";
    if (wasNotReady && isNowReady) {
      const dup = await markEventSent(orderId, "FULL_ORDER_READY");
      if (!dup) {
        functions.logger.info(`[NOTIFY] FULL_ORDER_READY for ${orderId}`);
        await sendNotification(studentId, "FULL_ORDER_READY", orderId, after);
      }
      return;
    }

    // ── 6. QR SCANNED / SERVED (server scans QR, food handed over) ────────────
    const wasNotServed = !before || (before.qrState !== "CONSUMED" && before.qrState !== "MANIFESTED");
    const isNowServed  = after.qrState === "CONSUMED" || after.qrState === "MANIFESTED";
    if (wasNotServed && isNowServed) {
      const dup = await markEventSent(orderId, "QR_SCANNED_SERVED");
      if (!dup) {
        functions.logger.info(`[NOTIFY] QR_SCANNED_SERVED for ${orderId}`);
        await sendNotification(studentId, "QR_SCANNED_SERVED", orderId, after);
      }
      return;
    }

    // ── 7. ORDER FULLY COMPLETED ───────────────────────────────────────────────
    const wasNotCompleted = !before || (before.orderStatus !== "COMPLETED" && before.serveFlowStatus !== "SERVED");
    const isNowCompleted  = after.orderStatus === "COMPLETED" || after.serveFlowStatus === "SERVED";
    if (wasNotCompleted && isNowCompleted) {
      const dup = await markEventSent(orderId, "ORDER_COLLECTED");
      if (!dup) {
        functions.logger.info(`[NOTIFY] ORDER_COLLECTED for ${orderId}`);
        await sendNotification(studentId, "ORDER_COLLECTED", orderId, after);
      }
      return;
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// onRechargeWrite — watches wallet_recharge_requests for approve/reject events
// ─────────────────────────────────────────────────────────────────────────────
export const onRechargeWrite = functions
  .firestore.document("wallet_recharge_requests/{reqId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data()! : null;
    const after  = change.after.exists  ? change.after.data()!  : null;
    if (!after) return;

    const userId = after.uid;
    if (!userId) return;

    const wasPending  = !before || before.status === "pending";
    const isApproved  = after.status === "approved";
    const isRejected  = after.status === "rejected";

    if (wasPending && isApproved) {
      functions.logger.info(`[NOTIFY] WALLET_RECHARGED for user ${userId}`);
      await sendNotification(userId, "WALLET_RECHARGED", context.params.reqId, after);
    } else if (wasPending && isRejected) {
      functions.logger.info(`[NOTIFY] WALLET_RECHARGE_REJECTED for user ${userId}`);
      await sendNotification(userId, "WALLET_RECHARGE_REJECTED", context.params.reqId, after);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// onItemWrite — item subcollection (no-op FCM — handled via onOrderWrite)
// ─────────────────────────────────────────────────────────────────────────────
export const onItemWrite = functions
  .firestore.document("orders/{orderId}/items/{itemId}")
  .onWrite(async () => { return; });

// ─────────────────────────────────────────────────────────────────────────────
// processHardwareScan — IoT hardware scanner endpoint
// ─────────────────────────────────────────────────────────────────────────────
export const processHardwareScan = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST");
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }

  try {
    const { orderId, scannerType } = req.body;
    if (!orderId) { res.status(400).json({ error: "Missing orderId" }); return; }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new Error("ORDER_NOT_FOUND");

    const order = orderSnap.data()!;
    if (order.paymentStatus !== "SUCCESS" && order.paymentStatus !== "VERIFIED") {
      throw new Error("PAYMENT_NOT_VERIFIED");
    }

    const itemsSnap = await orderRef.collection("items").get();
    if (itemsSnap.empty) throw new Error("NO_ITEMS_FOUND");

    const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    let targetItems: any[] = [];
    if (scannerType === "STATIC") {
      targetItems = items.filter((i: any) => (i.orderType === "FAST_ITEM" || !i.orderType) && i.status === "PENDING");
    } else if (scannerType === "DYNAMIC") {
      targetItems = items.filter((i: any) => i.orderType === "PREPARATION_ITEM" && i.status === "READY");
    } else {
      targetItems = items.filter((i: any) =>
        i.status === "READY" || ((i.orderType === "FAST_ITEM" || !i.orderType) && i.status === "PENDING")
      );
    }

    if (targetItems.length === 0) throw new Error("NOTHING_TO_SERVE_OR_WRONG_LINE");

    const batch = db.batch();
    let totalItemsServed = 0;
    targetItems.forEach((item: any) => {
      batch.update(orderRef.collection("items").doc(item.id), { status: "SERVED", servedAt: Date.now() });
      totalItemsServed++;
    });

    const allItemsAreNowServed = items.every((i: any) =>
      i.status === "SERVED" || targetItems.some(ti => ti.id === i.id)
    );
    if (allItemsAreNowServed) {
      batch.update(orderRef, { orderStatus: "COMPLETED", serveFlowStatus: "SERVED" });
    } else {
      batch.update(orderRef, { serveFlowStatus: "PARTIALLY_SERVED" });
    }

    await batch.commit();
    functions.logger.info(`[HARDWARE-SCAN] Success: orderId=${orderId}, itemsServed=${totalItemsServed}`);
    res.status(200).json({ success: true, message: "SERVED", itemsServed: totalItemsServed, allItemsCompleted: allItemsAreNowServed });
  } catch (error: any) {
    functions.logger.error(`[HARDWARE-SCAN] Rejected: ${error.message}`);
    res.status(403).json({ error: error.message });
  }
});
