
/**
 * 📣 [SONIC-ONESIGNAL-API] Push Notification REST Integration
 * Role: Principal Orchestration Engineer
 * Strategy: Targeted UID strikes via OneSignal REST API
 */

const ONESIGNAL_APP_ID = "c7140793-2586-4d5c-9f38-b6fb98815c3b";

// 🛡️ [SECURITY-WARNING] Storing REST API Key on client is risky. 
// However, for this automated deployment context, we inject it via VITE_ env var.
const ONESIGNAL_REST_API_KEY = (import.meta as any).env.VITE_ONESIGNAL_REST_API_KEY;

interface PushNotificationData {
    userId: string;
    title: string;
    message: string;
    sound?: string;
    url?: string;
    data?: any;
}

/**
 * Sends a targeted push notification to a specific Firebase UID via OneSignal.
 * Students must have granted permission and completed the Handshake earlier.
 */
export const sendDirectedPush = async ({
    userId,
    title,
    message,
    sound = 'default',
    url = 'https://joecafebrand.netlify.app',
    data = {}
}: PushNotificationData) => {
    const apiKey = ONESIGNAL_REST_API_KEY || localStorage.getItem('onesignal_rest_api_key');
    
    if (!apiKey) {
        console.warn('⚠️ [ONESIGNAL-API] REST API Key missing. Skipping push strike.');
        return;
    }

    try {
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [userId],
            contents: { "en": message },
            headings: { "en": title },
            url: url,
            data: data,
            // 🔈 [VOICE-ENGINE] Custom sound for PWA support (Requires hosted sound file)
            web_push_sound: sound === 'ready' 
                ? 'https://joecafebrand.netlify.app/sounds/ready.mp3' 
                : 'https://joecafebrand.netlify.app/sounds/pulse.mp3',
            // [ANDROID/IOS Fallback]
            android_sound: sound,
            ios_sound: `${sound}.wav`,
            // 🏎️ [URGENCY] High priority push
            priority: 10,
            ttl: 3600 // 1 hour relevance
        };

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Basic ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log(`🚀 [ONESIGNAL-PULSE] Broadcast result for ${userId}:`, result);
        return result;
    } catch (err) {
        console.error('❌ [ONESIGNAL-PULSE] Broadcast failed:', err);
    }
};

/**
 * Logic-mapping for specific order states
 */
export const notifyOrderUpdate = (userId: string, status: string, itemName: string) => {
    const alerts: Record<string, { title: string, body: string, sound: string }> = {
        'PREPARING': {
            title: '🥣 Cooking',
            body: `Kitchen is busy.`,
            sound: 'pulse'
        },
        'READY': {
            title: '🎉 Ready',
            body: `Come get it!`,
            sound: 'ready'
        },
        'MISSED': {
            title: '⚠️ Missed',
            body: `Check next batch.`,
            sound: 'pulse'
        },
        'REJECTED': {
            title: '🚫 Issue',
            body: `See cashier now.`,
            sound: 'pulse'
        }
    };

    const alert = alerts[status];
    if (alert) {
        sendDirectedPush({
            userId,
            title: alert.title,
            message: alert.body,
            sound: alert.sound,
            data: { status, itemName }
        });
    }
};
