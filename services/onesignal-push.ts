import { useState, useEffect } from 'react';
import OneSignal from 'react-onesignal';

/**
 * 📣 [ONESIGNAL-ENGINE] Direct-to-Pocket Notification Service
 * Automatically registers students for Background Pushes (System Tray).
 */
export const useOneSignal = (userId: string | null) => {
    useEffect(() => {
        if (!userId) return;

        const setupOneSignal = async () => {
            try {
                // 🔥 [ONESIGNAL-INIT] Replace with your ONE_SIGNAL_APP_ID from onesignal.com
                await OneSignal.init({ 
                    appId: "YOUR_ONESIGNAL_APP_ID_HERE", 
                    allowLocalhostAsSecureOrigin: true 
                });

                // 🎯 [SEGMENTING] Tag the user so you can target 'STUDENTS' vs 'STAFF'
                OneSignal.sendTags({ user_id: userId, role: 'STUDENT' });

                // 🚀 [SYSTEM-TRIGGER] Prompt the student for 'Allow Notifications'
                OneSignal.showNativePrompt();

            } catch (err) {
                console.warn('OneSignal registration restricted:', err);
            }
        };

        setupOneSignal();
    }, [userId]);
};
