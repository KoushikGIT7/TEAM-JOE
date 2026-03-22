import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { joeSounds } from '../utils/audio';

/**
 * 📣 [MARKETING-SYNC] Listen for real-time promotion pulses and alerts
 */
export const useMarketingPulses = (role: string | null) => {
    const [latestPulse, setLatestPulse] = useState<{ id: string, text: string } | null>(null);
    const announcedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // 🔥 [SYNC-UNBLOCKED] Open for all roles for testing and immediate validation.
        const q = query(
            collection(db, "system_messages"),
            limit(20)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const data = change.doc.data();
                
                // Only process PROMOTION type messages that are newly added to the snapshot
                if (data.type === 'PROMOTION' && change.type === "added") {
                    
                    // 🛡️ [SYNC-SENSE] 
                    const createdMillis = data.createdAt?.toMillis?.() || (typeof data.createdAt === 'number' ? data.createdAt : 0);
                    
                    // 1. !createdMillis -> Means it's a locally-pushed message (null server timestamp). MUST fire.
                    // 2. Freshness -> Last 5 minutes.
                    // 3. MemoryLock -> only fire once.
                    const isFresh = (createdMillis === 0) || (Date.now() - createdMillis < 300000);

                    if (isFresh && !announcedRef.current.has(change.doc.id)) {
                        announcedRef.current.add(change.doc.id);
                        setLatestPulse({ id: change.doc.id, text: data.text });
                        
                        // 🔊 [HALLMARK-TRADEMARK] Trigger the Signature "JOOOOOOH-EE"
                        joeSounds.playAlert(); 
                        
                        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
                    }
                }
            });
        });

        return () => unsub();
    }, []); 

    return { latestPulse, clearPulse: () => setLatestPulse(null) };
};
