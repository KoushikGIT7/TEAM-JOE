import type { Handler } from '@netlify/functions';
import { schedule } from '@netlify/functions';

const scheduledFunction: Handler = async (event, context) => {
  console.log("Running Lunch Reminder Cron Job...");

  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.warn("OneSignal REST API Key missing for lunch reminder.");
    return { statusCode: 500, body: "API Key missing" };
  }

  const appId = "2ce03ee2-27d2-49b7-9fea-21c1f2f124cd";
  const payload = {
    app_id: appId,
    included_segments: ["Active Users"],
    target_channel: "push",
    headings: { en: "🍽️ Lunch is Ready!" },
    contents: { en: "Beat the queue! Order your lunch now on CSE." },
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
    console.log("[OneSignal] Lunch reminder sent:", data);
    return { statusCode: 200, body: "Reminder sent!" };
  } catch (error) {
    console.error("[OneSignal] Lunch reminder error:", error);
    return { statusCode: 500, body: "Error sending reminder" };
  }
};

// Netlify Cron: Runs daily at 11:45 AM
export const handler = schedule("45 11 * * *", scheduledFunction);
