import type { Handler } from '@netlify/functions';

/**
 * OneSignal Push Notification — Netlify Serverless Function
 *
 * Body (POST JSON):
 *   { userId?, role?, title, body, url? }
 *   - userId → push to one specific user (include_external_user_ids)
 *   - role   → broadcast to all users with that role tag (filters)
 *
 * Env required: ONESIGNAL_REST_API_KEY (set in Netlify dashboard)
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { userId, role, title, body, url } = payload;

  if (!title || !body) {
    return { statusCode: 400, body: 'Missing title or body' };
  }
  if (!userId && !role) {
    return { statusCode: 400, body: 'Provide userId or role' };
  }

  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!restApiKey) {
    console.error('[OneSignal] ONESIGNAL_REST_API_KEY not set in Netlify env vars.');
    return { statusCode: 500, body: 'Server configuration error: missing API key' };
  }

  const APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';
  const ICON_URL = 'https://kucafe.online/JeoLogoFinal.png';

  // Build targeting payload
  const targeting: Record<string, any> = userId
    ? { include_external_user_ids: [userId] }      // ✅ stable v1 API format
    : { filters: [{ field: 'tag', key: 'role', relation: '=', value: role }] };

  const pushPayload = {
    app_id: APP_ID,
    headings: { en: title },
    contents: { en: body },
    large_icon: ICON_URL,
    chrome_web_icon: ICON_URL,
    // High priority — shows immediately even on silent/battery-saver mode
    priority: 10,
    android_visibility: 1,
    // 1 hour TTL — discard if not delivered (order would be stale)
    ttl: 3600,
    url: url || 'https://kucafe.online',
    ...targeting,
  };

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify(pushPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[OneSignal] Push FAILED (${userId || role}):`, JSON.stringify(data));
      return { statusCode: response.status, body: JSON.stringify(data) };
    }

    const recipients = data.recipients ?? 0;
    console.log(`[OneSignal] ✅ Push sent to ${userId || `role:${role}`} | recipients: ${recipients}`);

    if (recipients === 0) {
      console.warn(`[OneSignal] ⚠️ 0 recipients. Device not subscribed or external_id not linked for: ${userId}`);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, recipients }) };
  } catch (error: any) {
    console.error('[OneSignal] Network error:', error?.message);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
