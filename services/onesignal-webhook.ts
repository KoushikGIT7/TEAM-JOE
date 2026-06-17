/**
 * CSE Cafeteria — OneSignal Push Notification Service
 *
 * ARCHITECTURE (Rapido-style):
 *   Push notifications fire from the ACTIVE STAFF device (cashier, supervisor, scanner)
 *   and reach the student's phone even when their browser is closed.
 *
 * TWO FUNCTIONS:
 *   triggerOneSignalWebhook(userId, title, body, url?)
 *     → sends push to ONE student by their Firebase UID
 *
 *   triggerRolePush(role, title, body, url?)
 *     → broadcasts to ALL users tagged with that role in OneSignal
 *       (e.g. all supervisors when a new order arrives)
 *
 * ROUTING:
 *   localhost  → calls OneSignal REST API directly (ONESIGNAL_REST_API_KEY in .env)
 *   production → calls /.netlify/functions/onesignal-webhook (Netlify env var)
 *
 * API FORMAT:
 *   Uses include_external_user_ids (stable v1 format, not include_aliases)
 *   This is the most compatible format across all OneSignal SDK versions.
 */

const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY ?? '';
const APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';
const ONESIGNAL_API = 'https://onesignal.com/api/v1/notifications';

const isLocalhost = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/** Raw REST call — localhost only */
const directRestPush = async (payload: Record<string, any>, label: string): Promise<void> => {
  if (!ONESIGNAL_REST_API_KEY) {
    console.warn(`[OneSignal] ⚠️ ONESIGNAL_REST_API_KEY missing — cannot push to ${label}`);
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
      console.error(`[OneSignal] ❌ Push failed → ${label}:`, JSON.stringify(data));
    } else {
      const recipients = data.recipients ?? data.id ?? '?';
      console.log(`[OneSignal] ✅ Push sent → ${label} | recipients: ${recipients}`);
      if (data.recipients === 0) {
        console.warn(`[OneSignal] ⚠️ 0 recipients for ${label}. Device may not be subscribed or external_id not linked.`);
      }
    }
  } catch (err: any) {
    console.error(`[OneSignal] Network error → ${label}:`, err?.message);
  }
};

/** Netlify serverless call — production */
const netlifyPush = async (body: Record<string, any>, label: string): Promise<void> => {
  try {
    const res = await fetch('/.netlify/functions/onesignal-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[OneSignal] ❌ Netlify push failed → ${label}: ${res.status} — ${text}`);
    } else {
      const data = await res.json().catch(() => ({}));
      console.log(`[OneSignal] ✅ Netlify push sent → ${label} | recipients: ${data?.recipients ?? '?'}`);
    }
  } catch (err: any) {
    console.error(`[OneSignal] Network error via Netlify → ${label}:`, err?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send push notification to ONE specific user by Firebase UID.
 *
 * Uses include_external_user_ids (stable v1 API format).
 * Requires student to have:
 *   1. Granted browser notification permission on kucafe.online
 *   2. OneSignal SDK called login(uid) on their device
 */
export const triggerOneSignalWebhook = async (
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<void> => {
  if (!userId || !title || !body) {
    console.warn('[OneSignal] triggerOneSignalWebhook: missing params', { userId: !!userId });
    return;
  }

  const pushBody = {
    // ✅ Stable v1 format + aliases for higher reliability across SDK versions
    include_external_user_ids: [userId],
    include_aliases: { external_id: [userId] },
    target_channel: 'push',
    headings: { en: title },
    contents: { en: body },
    // Large icon shown in Android notification tray
    large_icon: 'https://kucafe.online/JeoLogoFinal.png',
    // Chrome/Firefox web push icon
    chrome_web_icon: 'https://kucafe.online/JeoLogoFinal.png',
    // High priority — shows immediately, wakes device
    priority: 10,
    android_visibility: 1,
    // 1 hour TTL — if not delivered in 1hr, discard (order would be stale)
    ttl: 3600,
    ...(url ? { url } : { url: 'https://kucafe.online' }),
  };

  if (isLocalhost()) {
    await directRestPush(pushBody, `user:${userId.slice(0, 8)}`);
  } else {
    await netlifyPush({ userId, title, body, url }, `user:${userId.slice(0, 8)}`);
  }
};

/**
 * Broadcast push to ALL users with a specific role tag.
 * Use for: alerting all supervisors when a new dynamic-item order arrives.
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
    large_icon: 'https://kucafe.online/JeoLogoFinal.png',
    chrome_web_icon: 'https://kucafe.online/JeoLogoFinal.png',
    priority: 10,
    android_visibility: 1,
    ttl: 3600,
    ...(url ? { url } : { url: 'https://kucafe.online' }),
  };

  if (isLocalhost()) {
    await directRestPush(pushBody, `role:${role}`);
  } else {
    await netlifyPush({ role, title, body, url }, `role:${role}`);
  }
};
