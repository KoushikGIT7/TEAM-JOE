import type { Handler } from '@netlify/functions';

/**
 * OneSignal Push Notification Netlify Function
 *
 * Supports two modes:
 *   1. userId  — sends to a specific user by external_id
 *   2. role    — broadcasts to all users tagged with that role (e.g. "assistant_supervisor")
 *
 * Body: { userId?, role?, title, body, url? }
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

  // Build targeting: specific user OR all users with a given role tag
  const targeting: Record<string, any> = userId
    ? {
        include_aliases: { external_id: [userId] },
        target_channel: 'push',
      }
    : {
        filters: [{ field: 'tag', key: 'role', relation: '=', value: role }],
      };

  const pushPayload = {
    app_id: APP_ID,
    headings: { en: title },
    contents: { en: body },
    ...(url ? { url } : {}),
    ...targeting,
    // Always show notification even if app is in foreground
    android_visibility: 1,
    priority: 10,
    ttl: 3600, // 1 hour TTL — order notifications expire if not delivered in time
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

    console.log(`[OneSignal] ✅ Push sent to ${userId || `role:${role}`} | recipients: ${data.recipients}`);
    return { statusCode: 200, body: JSON.stringify({ success: true, recipients: data.recipients }) };
  } catch (error: any) {
    console.error('[OneSignal] Network error:', error?.message);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
