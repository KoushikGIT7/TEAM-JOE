import { useEffect } from 'react';

/**
 * 🎯 [SONIC-SYNC] Synchronize ID immediately on demand
 */
export const syncOneSignal = (userId: string | null) => {
    if (!userId) return;
    const oneSignalDeferred = (window as any).OneSignalDeferred;
    if (oneSignalDeferred) {
        oneSignalDeferred.push(async (oneSignal: any) => {
            // Give 500ms to allow internal managers to catch up
            await new Promise(resolve => setTimeout(resolve, 500));
            if (oneSignal.User) {
                oneSignal.login(userId).catch(() => {});
                oneSignal.User.addTag('role', 'STUDENT');
                console.log('⚡ [SONIC-ONESIGNAL] Instant Handshake strike:', userId);
            }
        });
    }
};

export const useOneSignal = (userId: string | null) => {
    useEffect(() => {
        if (!userId) return;

        const oneSignalDeferred = (window as any).OneSignalDeferred || [];
        
        oneSignalDeferred.push(async (oneSignal: any) => {
            let retries = 5;
            
            const attemptSync = async () => {
                try {
                    // 🛡️ [RACER-GUARD] Standard buffer for hydration
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    if (oneSignal.User) {
                        await oneSignal.login(userId);
                        await oneSignal.User.addTag('role', 'STUDENT');
                        console.log('🚀 [ONESIGNAL] Industrial Handshake Verified:', userId);
                        return true;
                    }
                    return false;
                } catch (err: any) {
                    // Check if error is the 'Ye' manager race
                    if (err.message?.includes('Ye') || err.message?.includes('undefined')) {
                        if (retries > 0) {
                            console.warn(`⏳ [ONESIGNAL-RETRY] Hydrating... (${retries} left)`);
                            retries--;
                            return await attemptSync();
                        }
                    }
                    console.warn('[ONESIGNAL] Identity Sync deferred:', err);
                    return false;
                }
            };
            
            await attemptSync();
        });
    }, [userId]);
};
