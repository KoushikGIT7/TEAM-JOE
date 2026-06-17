import type { Handler } from '@netlify/functions';
import { schedule } from '@netlify/functions';

interface NotificationCopy {
  title: string;
  body: string;
}

const copyMap: Record<number, NotificationCopy> = {
  0: { // Sunday
    title: "🎒 Monday Ready? Recharge your CSE Wallet!",
    body: "Start your college week strong. Top up your CSE balance tonight for smooth, instant coffee & breakfast tomorrow!"
  },
  1: { // Monday
    title: "⚡ Beat the Tuesday Rush!",
    body: "Don't let cashier queues slow you down. Recharge your CSE wallet tonight for lightning-fast orders tomorrow."
  },
  2: { // Tuesday
    title: "🪙 CSE Wallet running low?",
    body: "Keep your balance topped up for quick morning snacks. A quick recharge tonight means zero wait tomorrow!"
  },
  3: { // Wednesday
    title: "📚 Mid-week focus, zero wait!",
    body: "Stay focused on classes, not lines. Recharge your CSE wallet now for instant payments tomorrow."
  },
  4: { // Thursday
    title: "🎉 Friday is almost here!",
    body: "Finish the week smoothly. Ensure your CSE Wallet has enough balance for a hassle-free Friday morning breakfast."
  },
  5: { // Friday
    title: "💰 Skip the Cashier Queue tomorrow!",
    body: "Recharge your CSE Wallet tonight using UPI. Zero hassle, zero wait, and smooth transactions all day tomorrow."
  },
  6: { // Saturday
    title: "💰 Skip the Cashier Queue tomorrow!",
    body: "Recharge your CSE Wallet tonight using UPI. Zero hassle, zero wait, and smooth transactions all day tomorrow."
  }
};

const scheduledFunction: Handler = async (event, context) => {
  console.log("Running Nightly Wallet Recharge Cron Job...");

  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.warn("OneSignal REST API Key missing for nightly wallet reminder.");
    return { statusCode: 500, body: "API Key missing" };
  }

  // Get current day (0: Sunday, 1: Monday, etc.) in local time (UTC+5:30)
  // Since the function runs at 15:30 UTC, adding 5 hours 30 mins gives 21:00 (9:00 PM) on the same day.
  const utcDate = new Date();
  const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
  const day = istDate.getDay();

  const copy = copyMap[day] || copyMap[5];
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
    console.log("[OneSignal] Nightly wallet reminder sent successfully:", data);
    return { statusCode: 200, body: `Recharge reminder sent: ${copy.title}` };
  } catch (error) {
    console.error("[OneSignal] Nightly wallet reminder error:", error);
    return { statusCode: 500, body: "Error sending recharge reminder" };
  }
};

// Netlify Cron: Runs daily at 9:00 PM IST (15:30 UTC)
export const handler = schedule("30 15 * * *", scheduledFunction);
