export const triggerOneSignalWebhook = async (userId: string, title: string, body: string, url?: string) => {
    try {
        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (isLocalhost) {
            const restApiKey = process.env.ONESIGNAL_REST_API_KEY;
            if (!restApiKey) {
                console.warn("[OneSignal Webhook] Localhost detected, but ONESIGNAL_REST_API_KEY is missing. Skipping direct local push.");
                return;
            }
            console.log(`[OneSignal Webhook] Localhost detected. Performing direct push to ${userId}...`);
            const appId = "2ce03ee2-27d2-49b7-9fea-21c1f2f124cd";
            
            const response = await fetch("https://onesignal.com/api/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Basic ${restApiKey}`
                },
                body: JSON.stringify({
                    app_id: appId,
                    include_aliases: {
                        external_id: [userId]
                    },
                    target_channel: "push",
                    headings: { en: title },
                    contents: { en: body },
                    url: url || undefined
                })
            });
            
            const data = await response.json();
            if (!response.ok) {
                console.error(`[OneSignal Webhook] Direct local push failed for ${userId}:`, data);
            } else {
                console.log(`[OneSignal Webhook] Direct local push sent successfully to ${userId}:`, data);
            }
            return;
        }

        const response = await fetch('/.netlify/functions/onesignal-webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, title, body, url })
        });
        if (!response.ok) {
            console.error('[OneSignal Webhook] Failed to trigger notification');
        }
    } catch (err) {
        console.error('[OneSignal Webhook] Network error:', err);
    }
};
