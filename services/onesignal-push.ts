import { useEffect } from 'react';

/**
 * 📣 [ONESIGNAL-ENGINE] Identity Handshake Service
 * Syncs the student profile with the background messaging system tray.
 * Hardened for Deferred Industrial Initialization.
 */
export const useOneSignal = (userId: string | null) => {
    useEffect(() => {
        if (!userId) return;

        // Since OneSignal is initialized in index.html, we use the Deferred Buffer 
        // to ensure the handshake happens AFTER the SDK is fully stable.
        const oneSignalDeferred = (window as any).OneSignalDeferred;
        
        if (oneSignalDeferred) {
            oneSignalDeferred.push(async (oneSignal: any) => {
                try {
                    // 🔥 [IDENTITY-STRIKE]
                    await oneSignal.login(userId);
                    await oneSignal.User.addTag('role', 'STUDENT');
                    console.log('🚀 [ONESIGNAL] User Identity Handshaked:', userId);
                } catch (err) {
                    console.warn('OneSignal Identity Sync deferred:', err);
                }
            });
        }
    }, [userId]);
};
