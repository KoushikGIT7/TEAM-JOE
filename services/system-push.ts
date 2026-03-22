import { useState, useEffect } from 'react';
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from '../firebase';
import { joeSounds } from '../utils/audio';

/**
 * 📣 [PUSH-ENGINE] System-Tray Notification Service
 * Manages device tokens and handles background/foreground system pushes.
 */
export const useSystemPush = (userId: string | null) => {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) return;

        const setupMessaging = async () => {
            try {
                // 1. Get Messaging Instance
                const messaging = getMessaging(app);

                // 2. Request System Permission
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return;

                // 3. Get Device Token (The 'Signal ID')
                // Note: Replace with your VAPID KEY from Firebase Console -> Project Settings -> Cloud Messaging
                const currentToken = await getToken(messaging, { 
                    vapidKey: 'YOUR_VAPID_KEY_HERE' 
                });

                if (currentToken) {
                    setToken(currentToken);
                    console.log('🚀 Device Token Registered:', currentToken);
                    // 📁 In a full production setup, you would save this token to Firestore 
                    // under users/{userId}/fcmTokens to target specific devices.
                }

                // 4. Handle Foreground Messages (If app is open)
                onMessage(messaging, (payload) => {
                    console.log('📬 Foreground System Message:', payload);
                    // Handle visual display if needed, but our MarketingSync already does this!
                });

            } catch (err) {
                console.warn('System Push restricted (likely local environment or missing VAPID):', err);
            }
        };

        setupMessaging();
    }, [userId]);

    return { token };
};
