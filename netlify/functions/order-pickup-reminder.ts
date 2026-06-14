import type { Handler } from '@netlify/functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { credential } from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Rapido-style Order Pickup Reminder
 * Runs every 3 minutes via Netlify scheduled function.
 *
 * Finds orders where:
 *   - serveFlowStatus === 'READY' (food is ready, supervisor notified)
 *   - orderStatus not COMPLETED/SERVED/CANCELLED
 *   - readyAt timestamp > 4 minutes ago (food ready but student hasn't come)
 *
 * Sends a persistent reminder push to student every 3 minutes until they collect.
 * Max 5 reminders per order to avoid spam.
 */

// Initialize Firebase Admin only once
function getDb() {
  if (!getApps().length) {
    initializeApp({
      credential: credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

async function sendPush(userId: string, title: string, body: string): Promise<void> {
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) return;

  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${restApiKey}`,
    },
    body: JSON.stringify({
      app_id: '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd',
      include_external_user_ids: [userId],
      headings: { en: title },
      contents: { en: body },
      large_icon: 'https://kucafe.online/JeoLogoFinal.png',
      chrome_web_icon: 'https://kucafe.online/JeoLogoFinal.png',
      priority: 10,
      android_visibility: 1,
      ttl: 600, // 10 min TTL for reminders
      url: 'https://kucafe.online',
    }),
  });
}

export const handler: Handler = async () => {
  try {
    // Firebase Admin requires service account credentials in Netlify env vars
    // If not configured, skip gracefully
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.log('[PickupReminder] Firebase Admin credentials not set. Skipping.');
      return { statusCode: 200, body: 'Skipped: no Firebase admin credentials' };
    }

    const db = getDb();
    const now = Date.now();
    const FOUR_MINUTES_MS = 4 * 60 * 1000;
    const MAX_REMINDERS = 5;

    // Find READY orders where food has been ready for >4 minutes
    const snapshot = await db
      .collection('orders')
      .where('serveFlowStatus', '==', 'READY')
      .where('orderStatus', 'not-in', ['COMPLETED', 'SERVED', 'CANCELLED', 'MISSED'])
      .get();

    let reminded = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const orderId = docSnap.id;
      const userId = data.userId;
      const readyAt = data.readyAt || data.updatedAt;
      const reminderCount = data.reminderCount || 0;

      if (!userId || !readyAt) continue;
      if (reminderCount >= MAX_REMINDERS) continue;
      if ((now - readyAt) < FOUR_MINUTES_MS) continue;

      const token = data.tokenNumber || orderId.slice(-4).toUpperCase();
      const itemName = data.items?.[0]?.name || 'food';

      const messages = [
        `🍽️ Token #${token}: Your ${itemName} is getting cold! Please collect at the counter.`,
        `⏰ Token #${token}: Still waiting for you! Your order is at the counter.`,
        `🔔 Token #${token}: Don't miss your ${itemName}! Come collect now.`,
        `⚠️ Token #${token}: Last reminder — your food is at the counter!`,
        `🚨 Token #${token}: Final notice — collect your order or it may be cleared.`,
      ];

      const messageIndex = Math.min(reminderCount, messages.length - 1);

      await sendPush(
        userId,
        '📍 Pickup Reminder — JOE Cafeteria',
        messages[messageIndex]
      );

      // Increment reminder count and update lastReminderAt
      await db.collection('orders').doc(orderId).update({
        reminderCount: reminderCount + 1,
        lastReminderAt: now,
      });

      reminded++;
      console.log(`[PickupReminder] ✅ Sent reminder #${reminderCount + 1} to userId:${userId} for order:${orderId}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, remindedCount: reminded }),
    };
  } catch (err: any) {
    console.error('[PickupReminder] Error:', err?.message);
    return { statusCode: 500, body: err?.message };
  }
};
