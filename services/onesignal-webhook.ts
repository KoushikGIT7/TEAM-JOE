export const triggerOneSignalWebhook = async (userId: string, title: string, body: string, url?: string) => {
    try {
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
