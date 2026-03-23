import { useEffect } from 'react';

/**
 * 🎯 [SONIC-SYNC] Synchronize ID immediately on demand
 */
export const syncOneSignal = (userId: string | null) => {
    if (!userId) return;
    const joeSyncUser = (window as any).joeSyncUser;
    if (typeof joeSyncUser === 'function') {
        joeSyncUser(userId);
    }
};

export const useOneSignal = (userId: string | null) => {
    useEffect(() => {
        if (!userId) return;
        syncOneSignal(userId);
    }, [userId]);
};
