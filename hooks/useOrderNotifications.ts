import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, PrepBatch } from '../types';
import { joeSounds } from '../utils/audio';

/**
 * Hook to listen for updates across ALL active orders for the student.
 * 100% Firebase-only notification delivery for Spark Plan.
 * Includes wave-based delivery and persistent deduplication.
 */
export const useOrderNotifications = (userId: string | null) => {
    // track local state to avoid spam within the same session
    const activeListenerRef = useRef<Record<string, { status: string; flow: string }>>({});
    // track orders currently waiting for their "wave" delay
    const waveTimersRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!userId) return;

        console.log('🔔 Monitoring updates for student:', userId);
        
        const q = query(
            collection(db, 'orders'),
            where('userId', '==', userId),
            where('orderStatus', 'in', ['PENDING', 'PAID', 'REJECTED'])
        );

        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                const data = change.doc.data() as Order;
                const orderId = change.doc.id;
                const currentFlow = data.serveFlowStatus || 'NEW';
                const currentStatus = data.orderStatus || 'PENDING';
                
                const prev = activeListenerRef.current[orderId];

                /**
                 * markNotified: Attempt to stamp notifiedAt on the order for
                 * persistent deduplication across devices/sessions.
                 *
                 * Guest orders have no Firebase Auth context, so their
                 * updateDoc calls would fail with permission-denied. We skip
                 * silently — in-memory (waveTimersRef) deduplication covers
                 * the current session. No noisy log for expected guest failures.
                 */
                const markNotified = async (id: string): Promise<void> => {
                    try {
                        await updateDoc(doc(db, 'orders', id), { notifiedAt: Date.now() });
                    } catch (err: any) {
                        // permission-denied here means the rule didn't match — investigate.
                        // Do NOT log expected guest denials (already handled above).
                        if (err?.code !== 'permission-denied') {
                            console.warn('Could not update notifiedAt:', err);
                        }
                    }
                };

                // 1. REJECTED: Immediate notification (no waves)
                if ((!prev || prev.status !== 'REJECTED') && currentStatus === 'REJECTED' && !data.notifiedAt) {
                    joeSounds.playRejected(); // ❌ Gentle descending tone — professional, not harsh
                    triggerLocalNotification(
                        '⚠️ Order Issue',
                        `Order #${orderId.slice(-4).toUpperCase()} was rejected. Please contact the cashier.`
                    );
                    await markNotified(orderId);
                }

                // 2. READY: Wave-based delivery for Kitchen items, Immediate for Fast items
                if (currentFlow === 'READY' && !data.notifiedAt && !waveTimersRef.current[orderId]) {
                    const isFastItem = data.orderType === 'FAST_ITEM';

                    if (isFastItem) {
                        joeSounds.playFoodReady(); // 🍱 Triumphant ding — food is ready!
                        triggerLocalNotification(
                            '🍽️ Order Ready!',
                            `Order #${orderId.slice(-4).toUpperCase()} is ready for pickup.`
                        );
                        await markNotified(orderId);
                        return;
                    }

                    waveTimersRef.current[orderId] = true;
                    
                    let delay = 0;
                    // batchIds is an array — use first batch for wave position calculation
                    const firstBatchId = Array.isArray(data.batchIds) ? data.batchIds[0] : undefined;
                    if (firstBatchId) {
                        try {
                            const bSnap = await getDoc(doc(db, 'prepBatches', firstBatchId));
                            if (bSnap.exists()) {
                                const bData = bSnap.data() as PrepBatch;
                                const idx = (bData.orderIds || []).indexOf(orderId);
                                if (idx >= 0) {
                                    // Wave grouping: 10 people per wave, 1 minute gap
                                    const wave = Math.floor(idx / 10);
                                    delay = wave * 60000;
                                    if (delay > 0) {
                                        console.log(`⏳ Order #${orderId.slice(-4)} scheduled for wave ${wave} (Delay: ${delay}ms)`);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Wave calc error:', e);
                        }
                    }

                    setTimeout(async () => {
                        // Re-verify order is still READY and not yet notified
                        try {
                            const freshSnap = await getDoc(doc(db, 'orders', orderId));
                            const freshData = freshSnap.data() as Order;
                            if (freshSnap.exists() && freshData.serveFlowStatus === 'READY' && !freshData.notifiedAt) {
                                joeSounds.playFoodReady(); // 🍱 Wave delivery — food is ready!
                                triggerLocalNotification(
                                    '🍽️ Order Ready!',
                                    `Order #${orderId.slice(-4).toUpperCase()} is ready for pickup.`
                                );
                                await markNotified(orderId);
                            }
                        } catch (e) {
                            console.error('Final trigger error:', e);
                        } finally {
                            delete waveTimersRef.current[orderId];
                        }
                    }, delay);
                }

                activeListenerRef.current[orderId] = { status: currentStatus, flow: currentFlow };
            });
        });

        return unsub;
    }, [userId]);
};

const triggerLocalNotification = (title: string, body: string) => {
    // Audio is now handled at the call site with the correct specific sound
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/JeoLogoFinal.png',
            tag: 'order-update',
            requireInteraction: true // Keep it visible until dismissed
        });
    } else {
        console.warn('🔔 Notification permission not granted.');
    }
};
