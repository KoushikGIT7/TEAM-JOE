import type { Handler } from '@netlify/functions';

export const handler: Handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Parse the body
  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { userId, title, body, url } = payload;
  if (!userId || !title || !body) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.warn("OneSignal REST API Key is missing. Skipping push.");
    return { statusCode: 500, body: 'Server configuration error' };
  }

  const appId = "2ce03ee2-27d2-49b7-9fea-21c1f2f124cd";
  const pushPayload: any = {
    app_id: appId,
    include_aliases: {
      external_id: [userId]
    },
    target_channel: "push",
    headings: { en: title },
    contents: { en: body },
  };

  if (url) {
    pushPayload.url = url;
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${restApiKey}`
      },
      body: JSON.stringify(pushPayload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[OneSignal] Push failed for ${userId}:`, data);
      return { statusCode: response.status, body: JSON.stringify(data) };
    }

    console.log(`[OneSignal] Push sent to ${userId}:`, data);
    return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
  } catch (error: any) {
    console.error(`[OneSignal] Network error sending push to ${userId}:`, error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
