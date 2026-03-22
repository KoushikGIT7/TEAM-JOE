import { useEffect } from 'react';
import OneSignal from 'react-onesignal';

/**
 * 📣 [ONESIGNAL-ENGINE] Direct-to-Pocket Notification Service
 * Sole Source of Truth - Hardened for New Project Reset.
 */
export const useOneSignal = (userId: string | null) => {
    useEffect(() => {
        const setupOneSignal = async () => {
            try {
                // 🔥 [PROJECT-RESET] Re-link the browser to the NEW industrial IDs
                await OneSignal.init({ 
                    appId: "c7140793-2586-4d5c-9f38-b6fb98815c3b", 
                    safari_web_id: "web.onesignal.auto.61cc1b76-79db-483e-a0b9-263210abb193",
                    allowLocalhostAsSecureOrigin: true,
                    notifyButton: { enable: false }
                });

                // 🎯 [IDENTITY-HANDSHAKE]
                if (userId) {
                    OneSignal.login(userId);
                    OneSignal.User.addTag('role', 'STUDENT');
                }

                // 🔥 [DIRECT-STRIKE] Show the professional Slidedown on first gesture
                const triggerPulse = () => {
                    // Force the slidedown to override any previous "Muted" states
                    OneSignal.Slidedown.show({ force: true });
                    window.removeEventListener('click', triggerPulse);
                    window.removeEventListener('touchstart', triggerPulse);
                };
                window.addEventListener('click', triggerPulse);
                window.addEventListener('touchstart', triggerPulse);

            } catch (err) {
                console.warn('OneSignal reset restricted:', err);
            }
        };

        setupOneSignal();
    }, [userId]);
};
