import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { joeSounds } from '../utils/audio';

/**
 * 📣 [MARKETING-SYNC] Listen for real-time promotion pulses and alerts
 * This hook catches 'Marketing Hub' messages and triggers local chimes/vibrations.
 * Optimized for ZERO-INDEXING (no manual Firestore indices required).
 */
export const useMarketingPulses = (role: string | null) => {
    const [latestPulse, setLatestPulse] = useState<{ id: string, text: string } | null>(null);

    useEffect(() => {
        // 🛡️ SECURITY: Only listen if user is a Student or Guest.
        // We silence the Marketing Hub for Staff/Admins to prevent work distractions.
        const isStudent = role === 'STUDENT' || role === 'GUEST';
        if (!isStudent && role !== null) return; // Allow listening for null (unauthed landing) but block Staff
        
        // 🔥 [SONIC-SYNC] We only use WHERE filter to avoid the need for composite indices.
        const q = query(
            collection(db, "system_messages"),
            where("type", "==", "PROMOTION"),
            limit(10)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const created = data.createdAt?.toMillis?.() || data.createdAt || 0;
                    
                    // 🛡️ SECURITY: Only show pulses created in the last 5 minutes (freshness guard)
                    if (Date.now() - created < 300000) {
                        setLatestPulse({ id: change.doc.id, text: data.text });
                        
                        // 🔊 [SONIC-BRANDING] Trigger the JOE Signature Chime
                        joeSounds.playAlert(); 
                        
                        // ⚡ Haptic feedback for mobile
                        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
                    }
                }
            });
        });

        return () => unsub();
    }, []);

    return { latestPulse, clearPulse: () => setLatestPulse(null) };
};
