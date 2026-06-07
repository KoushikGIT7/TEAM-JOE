import type { Handler } from '@netlify/functions';
import { schedule } from '@netlify/functions';

interface NotificationCopy {
  title: string;
  body: string;
}

// 7 slots representing 15-minute intervals between 10:30 AM and 12:00 PM IST
const slotCopyMap: Record<number, NotificationCopy> = {
  0: { // 10:30 AM IST (5:00 UTC)
    title: "🥢 Fried Rice Pre-orders are OPEN!",
    body: "Class finishing at 12:05 PM? Pre-order your hot Fried Rice now using JOE coins to ensure it is ready when you walk in!"
  },
  1: { // 10:45 AM IST (5:15 UTC)
    title: "⚡ Beat the 12:05 PM Rush!",
    body: "Lock in your lunch order early! Pre-order your favorite wok-tossed Fried Rice using your JOE balance now."
  },
  2: { // 11:00 AM IST (5:30 UTC)
    title: "🔥 The Woks are Heating Up!",
    body: "The kitchen is prepping the lunch batch. Tap to pre-order your steaming hot Fried Rice using JOE coins."
  },
  3: { // 11:15 AM IST (5:45 UTC)
    title: "⚠️ Cafeteria Lines are Filling Up!",
    body: "Avoid the long queues today. Pre-order your afternoon Fried Rice now and claim it instantly with your QR code."
  },
  4: { // 11:30 AM IST (6:00 UTC)
    title: "⏱️ Only 30 Minutes Left!",
    body: "Don't miss the 12:05 PM lunch batch. Pre-order your delicious Fried Rice plate using JOE coins right now!"
  },
  5: { // 11:45 AM IST (6:15 UTC)
    title: "🔔 Last Call for 12:05 PM Servings!",
    body: "Pre-orders are closing soon! Grab your hot, fresh Fried Rice using your JOE balance to have it ready for lunch."
  },
  6: { // 12:00 PM IST (6:30 UTC)
    title: "🚀 5 Minutes to Lunch!",
    body: "Grab the last few pre-order slots! Get your hot Fried Rice instantly as soon as class ends at 12:05 PM."
  }
};

const scheduledFunction: Handler = async (event, context) => {
  console.log("Running Morning Fried Rice Multi-Notification Cron Job...");

  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.warn("OneSignal REST API Key missing for morning fried rice reminder.");
    return { statusCode: 500, body: "API Key missing" };
  }

  const utcDate = new Date();
  const utcHour = utcDate.getUTCHours();
  const utcMinute = utcDate.getUTCMinutes();

  // Determine slot index based on UTC hour/minute ranges
  let slotIndex = -1;
  if (utcHour === 5) {
    if (utcMinute >= 0 && utcMinute < 10) slotIndex = 0;      // ~5:00 UTC (10:30 AM IST)
    else if (utcMinute >= 10 && utcMinute < 25) slotIndex = 1; // ~5:15 UTC (10:45 AM IST)
    else if (utcMinute >= 25 && utcMinute < 40) slotIndex = 2; // ~5:30 UTC (11:00 AM IST)
    else if (utcMinute >= 40 && utcMinute < 55) slotIndex = 3; // ~5:45 UTC (11:15 AM IST)
  } else if (utcHour === 6) {
    if (utcMinute >= 55 || utcMinute < 10) slotIndex = 4;      // ~6:00 UTC (11:30 AM IST)
    else if (utcMinute >= 10 && utcMinute < 25) slotIndex = 5; // ~6:15 UTC (11:45 AM IST)
    else if (utcMinute >= 25 && utcMinute < 40) slotIndex = 6; // ~6:30 UTC (12:00 PM IST)
    else if (utcMinute >= 40 && utcMinute < 55) slotIndex = 7; // ~6:45 UTC (12:15 PM IST)
  }

  // If slotIndex is 7 or -1, exit early (runs after 12:05 PM or outside the intended schedule)
  if (slotIndex === 7 || slotIndex === -1) {
    console.log(`Skipping notification for hour=${utcHour}, minute=${utcMinute} (Slot ${slotIndex}).`);
    return { statusCode: 200, body: `Skipped: Hour ${utcHour}:${utcMinute} is outside morning preorder window` };
  }

  const copy = slotCopyMap[slotIndex];
  if (!copy) {
    console.warn(`No copy template configured for slot index ${slotIndex}`);
    return { statusCode: 400, body: `No template for slot ${slotIndex}` };
  }

  const appId = "2ce03ee2-27d2-49b7-9fea-21c1f2f124cd";
  const payload = {
    app_id: appId,
    included_segments: ["Active Users"],
    target_channel: "push",
    headings: { en: copy.title },
    contents: { en: copy.body },
    priority: 10, // High priority to wake up devices/bypassing low power modes
    ttl: 259200,  // Time To Live of 3 days (in seconds) so offline devices receive it as soon as they turn back on
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${restApiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`[OneSignal] Morning pre-order reminder (Slot ${slotIndex}) sent successfully:`, data);
    return { statusCode: 200, body: `Fried rice reminder sent: ${copy.title}` };
  } catch (error) {
    console.error(`[OneSignal] Morning pre-order reminder (Slot ${slotIndex}) error:`, error);
    return { statusCode: 500, body: "Error sending fried rice reminder" };
  }
};

// Netlify Cron: Runs every 15 minutes during hour 5 and hour 6 UTC (runs from 5:00 UTC to 6:45 UTC)
// This triggers at: 5:00, 5:15, 5:30, 5:45, 6:00, 6:15, 6:30, and 6:45 UTC
export const handler = schedule("*/15 5,6 * * *", scheduledFunction);
