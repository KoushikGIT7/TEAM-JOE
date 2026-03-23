import { useEffect } from 'react';

/**
 * 🎯 [SONIC-SYNC] Synchronize ID immediately on demand
 */
export const syncOneSignal = (userId: string | null) => {
    if (!userId) return;
    const oneSignalDeferred = (window as any).OneSignalDeferred;
    if (oneSignalDeferred) {
        oneSignalDeferred.push((oneSignal: any) => {
            if (oneSignal.User) {
                oneSignal.login(userId);
                oneSignal.User.addTag('role', 'STUDENT');
                console.log('⚡ [SONIC-ONESIGNAL] Instant Handshake strike:', userId);
            }
        });
    }
};

export const useOneSignal = (userId: string | null) => {
    useEffect(() => {
        if (!userId) return;

        const oneSignalDeferred = (window as any).OneSignalDeferred;
        
        if (oneSignalDeferred) {
            oneSignalDeferred.push(async (oneSignal: any) => {
                try {
                    // 🛡️ [RACER-GUARD] Wait for a tiny buffer to ensure internal Managers (Ye, etc.) are hydrated
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 🎯 [IDENTITY-STRIKE] Only login if the engine is truly ready
                    if (oneSignal.User) {
                        await oneSignal.login(userId);
                        await oneSignal.User.addTag('role', 'STUDENT');
                        console.log('🚀 [ONESIGNAL] Industrial Handshake Verified:', userId);
                    }
                } catch (err) {
                    // Fail silently to the console to keep student UX clean
                    console.warn('OneSignal Identity Sync deferred (Manager Race):', err);
                }
            });
        }
    }, [userId]);
};
