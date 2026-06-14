/**
 * OneSignal Push Notification Client Service
 *
 * Two functions:
 *   triggerOneSignalWebhook(userId, title, body, url?)
 *     → sends push to ONE specific user by their Firebase UID
 *
 *   triggerRolePush(role, title, body, url?)
 *     → broadcasts push to ALL users tagged with that role
 *       (e.g. role='assistant_supervisor' to alert all supervisors)
 *
 * Routing:
 *   localhost → calls OneSignal REST API directly (requires ONESIGNAL_REST_API_KEY in .env)
 *   production → calls /.netlify/functions/onesignal-webhook (requires env var in Netlify dashboard)
 */

const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY ?? '';
const APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';
const ONESIGNAL_API = 'https://onesignal.com/api/v1/notifications';

const isLocalhost = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * Internal: raw OneSignal REST call (localhost only)
 */
const directRestPush = async (payload: Record<string, any>, label: string): Promise<void> => {
  if (!ONESIGNAL_REST_API_KEY) {
    console.warn(`[OneSignal] ONESIGNAL_REST_API_KEY missing — cannot push to ${label}`);
    return;
  }
  try {
    const res = await fetch(ONESIGNAL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({ app_id: APP_ID, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`[OneSignal] ❌ Push failed to ${label}:`, JSON.stringify(data));
    } else {
      console.log(`[OneSignal] ✅ Push sent to ${label} | recipients: ${data.recipients ?? '?'}`);
    }
  } catch (err: any) {
    console.error(`[OneSignal] Network error pushing to ${label}:`, err?.message);
  }
};

/**
 * Internal: call Netlify serverless function (production)
 */
const netlifyPush = async (body: Record<string, any>, label: string): Promise<void> => {
  try {
    const res = await fetch('/.netlify/functions/onesignal-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[OneSignal] ❌ Netlify push failed to ${label}: ${res.status} — ${text}`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`[OneSignal] ✅ Netlify push sent to ${label} | recipients: ${data?.recipients ?? '?'}`);
    }
  } catch (err: any) {
    console.error(`[OneSignal] Network error via Netlify to ${label}:`, err?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send push notification to ONE specific user (by Firebase UID / external_id)
 *
 * Use for: order confirmed, food ready, payment rejected, QR scanned, etc.
 */
export const triggerOneSignalWebhook = async (
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> => {
  if (!userId || !title || !body) {
    console.warn('[OneSignal] triggerOneSignalWebhook: missing params', { userId: !!userId, title: !!title });
    return;
  }

  const pushBody = {
    include_aliases: { external_id: [userId] },
    target_channel: 'push',
    headings: { en: title },
    contents: { en: body },
    android_visibility: 1,
    priority: 10,
    ttl: 3600,
    ...(url ? { url } : {}),
  };

  if (isLocalhost()) {
    await directRestPush(pushBody, `user:${userId.slice(0, 8)}`);
  } else {
    await netlifyPush({ userId, title, body, url }, `user:${userId.slice(0, 8)}`);
  }
};

/**
 * Broadcast push to ALL users with a specific role tag
 *
 * Use for: notifying all supervisors when a new dynamic item order arrives
 * Roles: 'assistant_supervisor' | 'cashier' | 'cook' | 'admin'
 */
export const triggerRolePush = async (
  role: string,
  title: string,
  body: string,
  url?: string
): Promise<void> => {
  if (!role || !title || !body) {
    console.warn('[OneSignal] triggerRolePush: missing params');
    return;
  }

  const pushBody = {
    filters: [{ field: 'tag', key: 'role', relation: '=', value: role }],
    headings: { en: title },
    contents: { en: body },
    android_visibility: 1,
    priority: 10,
    ttl: 3600,
    ...(url ? { url } : {}),
  };

  if (isLocalhost()) {
    await directRestPush(pushBody, `role:${role}`);
  } else {
    await netlifyPush({ role, title, body, url }, `role:${role}`);
  }
};
