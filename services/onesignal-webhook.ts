/**
 * triggerOneSignalWebhook
 *
 * Sends a push notification to a specific user via OneSignal.
 *
 * HOW IT WORKS:
 * - In localhost/dev:  calls OneSignal REST API directly (using injected API key)
 * - In production:     calls /.netlify/functions/onesignal-webhook (server-side)
 *
 * IMPORTANT: The ONESIGNAL_REST_API_KEY env var must be set in:
 * - .env (for localhost)
 * - Netlify dashboard → Site settings → Environment variables (for production)
 */
export const triggerOneSignalWebhook = async (
    userId: string,
    title: string,
    body: string,
    url?: string
): Promise<void> => {
    if (!userId || !title || !body) {
        console.warn('[OneSignal] triggerOneSignalWebhook called with missing params', { userId, title });
        return;
    }

    try {
        const isLocalhost =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        const APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';

        if (isLocalhost) {
            // In dev: call OneSignal REST API directly from browser
            const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
            if (!restApiKey) {
                console.warn('[OneSignal] ONESIGNAL_REST_API_KEY not set. Cannot send push in localhost mode.');
                return;
            }

            console.log(`[OneSignal] Localhost → direct REST push to userId: ${userId}`);
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${restApiKey}`
                },
                body: JSON.stringify({
                    app_id: APP_ID,
                    include_aliases: { external_id: [userId] },
                    target_channel: 'push',
                    headings: { en: title },
                    contents: { en: body },
                    ...(url ? { url } : {})
                })
            });

            const data = await response.json();
            if (!response.ok) {
                console.error(`[OneSignal] REST push FAILED for ${userId}:`, JSON.stringify(data));
            } else {
                console.log(`[OneSignal] ✅ Push sent to ${userId} | recipients: ${data.recipients ?? '?'}`);
            }
            return;
        }

        // In production: delegate to Netlify serverless function
        console.log(`[OneSignal] Production → Netlify function push to userId: ${userId}`);
        const response = await fetch('/.netlify/functions/onesignal-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title, body, url })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'unknown error');
            console.error(`[OneSignal] Netlify function push FAILED for ${userId}: ${response.status} — ${errText}`);
        } else {
            const data = await response.json().catch(() => ({}));
            console.log(`[OneSignal] ✅ Push sent via Netlify to ${userId} | recipients: ${data?.data?.recipients ?? '?'}`);
        }
    } catch (err: any) {
        console.error('[OneSignal] Network/fetch error sending push notification:', err?.message ?? err);
    }
};
