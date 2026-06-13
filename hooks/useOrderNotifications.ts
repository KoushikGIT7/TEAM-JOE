import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, PrepBatch } from '../types';
import { joeSounds } from '../utils/audio';
import { sonicVoice } from '../services/voice-engine';
import { triggerOneSignalWebhook } from '../services/onesignal-webhook';

/**
 * Hook to listen for updates across ALL active orders for the student.
 * 100% Firebase-only notification delivery for Spark Plan.
 * Includes wave-based delivery and persistent deduplication.
 *
 * EVENTS COVERED:
 *   1. REJECTED          — order / payment rejected by cashier
 *   2. CASH_CONFIRMED    — cashier approved cash order (QR now unlocked)
 *   3. READY             — kitchen marks serveFlowStatus=READY (wave-batched)
 *   4. QR_SCANNED        — server scans QR (serveFlowStatus=CONSUMED/MANIFESTED)
 *   5. COMPLETED         — order fully served
 *   6. STREAK_REWARD     — every 5 completed orders
 */
export const useOrderNotifications = (userId: string | null) => {
    // track local state to avoid spam within the same session
    const activeListenerRef = useRef<Record<string, { status: string; flow: string; payStatus: string }>>({});
    // sessionDedupeRef tracks which combinations have already been announced to prevent repeats in current lifecycle
    const sessionDedupeRef = useRef<Set<string>>(new Set());
    // track orders currently waiting for their "wave" delay
    const waveTimersRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!userId) return;

        console.log('🔔 [OrderNotify] Monitoring push events for student:', userId);

        // Fix: include ACTIVE status — many orders spend most of their life here
        const q = query(
            collection(db, 'orders'),
            where('userId', '==', userId),
            where('orderStatus', 'in', ['PENDING', 'PAID', 'ACTIVE', 'PROCESSING', 'REJECTED', 'COMPLETED']),
            orderBy('createdAt', 'desc'),
            limit(5)
        );

        const unsub = onSnapshot(
            q,
            (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                const data = change.doc.data() as Order;
                const orderId = change.doc.id;
                const currentFlow = data.serveFlowStatus || 'NEW';
                const currentStatus = data.orderStatus || 'PENDING';
                const currentPayStatus = data.paymentStatus || 'PENDING';

                const prev = activeListenerRef.current[orderId];

                /**
                 * markNotified: Attempt to stamp notifiedAt on the order for
                 * persistent deduplication across devices/sessions.
                 */
                const markNotified = async (id: string): Promise<void> => {
                    try {
                        await updateDoc(doc(db, 'orders', id), { notifiedAt: Date.now() });
                    } catch (err: any) {
                        if (err?.code !== 'permission-denied') {
                            console.warn('Could not update notifiedAt:', err);
                        }
                    }
                };

                // ─── EVENT 1: REJECTED ────────────────────────────────────────
                if ((!prev || prev.status !== 'REJECTED') && currentStatus === 'REJECTED' && !data.notifiedAt) {
                    joeSounds.playRejected();
                    triggerOneSignalWebhook(
                        userId,
                        '⚠️ Order Rejected',
                        `Order #${orderId.slice(-4).toUpperCase()} was rejected. Please contact the cashier.`
                    );
                    await markNotified(orderId);
                }

                // ─── EVENT 2: CASH ORDER CONFIRMED BY CASHIER ─────────────────
                // paymentStatus transitions to VERIFIED → QR is now active
                const wasUnverified = !prev || (prev.payStatus !== 'VERIFIED' && prev.payStatus !== 'SUCCESS');
                const isNowVerified = currentPayStatus === 'VERIFIED' || currentPayStatus === 'SUCCESS';
                const isCashOrder = data.paymentType === 'CASH';
                const cashConfirmDedupeKey = `${orderId}-CASH-CONFIRMED`;

                if (wasUnverified && isNowVerified && isCashOrder && !sessionDedupeRef.current.has(cashConfirmDedupeKey)) {
                    sessionDedupeRef.current.add(cashConfirmDedupeKey);
                    joeSounds.playPaymentConfirmed?.() ?? undefined;
                    triggerOneSignalWebhook(
                        userId,
                        '✅ Cash Confirmed — QR Unlocked!',
                        `Your order #${orderId.slice(-4).toUpperCase()} is confirmed. Show your QR code at the counter.`
                    );
                    // No markNotified here — we don't want to block the READY event
                }

                // ─── EVENT 3: FULL ORDER READY (Wave-batched) ─────────────────
                if (currentFlow === 'READY' && !data.notifiedAt && !waveTimersRef.current[orderId]) {
                    const isFastItem = data.orderType === 'FAST_ITEM';

                    if (isFastItem) {
                        const dedupeKey = `${orderId}-READY`;
                        if (!sessionDedupeRef.current.has(dedupeKey)) {
                            sessionDedupeRef.current.add(dedupeKey);
                            
                            // Play chime & vocal alert on student device
                            joeSounds.playPaymentConfirmed().catch(() => {});
                            const shortToken = data.tokenNumber || orderId.slice(-4).toUpperCase();
                            const firstItem = data.items?.[0]?.name || 'food';
                            const speakEN = `Token ${shortToken}, your order is ready at the counter.`;
                            const utter = new SpeechSynthesisUtterance(speakEN);
                            utter.lang = 'en-IN';
                            utter.rate = 0.85;
                            if (typeof window !== 'undefined' && window.speechSynthesis) {
                                window.speechSynthesis.cancel();
                                window.speechSynthesis.speak(utter);
                            }

                            triggerOneSignalWebhook(
                                userId,
                                '🍽️ Order Ready for Pickup!',
                                `Order #${orderId.slice(-4).toUpperCase()} is ready at the counter. Come collect it now!`
                            );
                            await markNotified(orderId);
                        }
                        activeListenerRef.current[orderId] = { status: currentStatus, flow: currentFlow, payStatus: currentPayStatus };
                        return;
                    }

                    waveTimersRef.current[orderId] = true;

                    let delay = 0;
                    const firstBatchId = Array.isArray(data.batchIds) ? data.batchIds[0] : undefined;
                    if (firstBatchId) {
                        try {
                            const bSnap = await getDoc(doc(db, 'prepBatches', firstBatchId));
                            if (bSnap.exists()) {
                                const bData = bSnap.data() as PrepBatch;
                                const idx = (bData.orderIds || []).indexOf(orderId);
                                if (idx >= 0) {
                                    const wave = Math.floor(idx / 10);
                                    delay = wave * 60000;
                                    if (delay > 0) {
                                        console.log(`⏳ Order #${orderId.slice(-4)} wave ${wave} (Delay: ${delay}ms)`);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('Wave calc error:', e);
                        }
                    }

                    setTimeout(async () => {
                        try {
                            const freshSnap = await getDoc(doc(db, 'orders', orderId));
                            const freshData = freshSnap.data() as Order;
                            if (freshSnap.exists() && freshData.serveFlowStatus === 'READY' && !freshData.notifiedAt) {
                                const dKey = `${orderId}-READY`;
                                if (!sessionDedupeRef.current.has(dKey)) {
                                    sessionDedupeRef.current.add(dKey);
                                    
                                    // Play chime & vocal alert on student device
                                    joeSounds.playPaymentConfirmed().catch(() => {});
                                    const shortToken = freshData.tokenNumber || orderId.slice(-4).toUpperCase();
                                    const firstItem = freshData.items?.[0]?.name || 'food';
                                    const speakEN = `Token ${shortToken}, your order is ready at the counter.`;
                                    const utter = new SpeechSynthesisUtterance(speakEN);
                                    utter.lang = 'en-IN';
                                    utter.rate = 0.85;
                                    if (typeof window !== 'undefined' && window.speechSynthesis) {
                                        window.speechSynthesis.cancel();
                                        window.speechSynthesis.speak(utter);
                                    }

                                    triggerOneSignalWebhook(
                                        userId,
                                        '🍽️ Order Ready for Pickup!',
                                        `Order #${orderId.slice(-4).toUpperCase()} is ready at the counter. Come collect it now!`
                                    );
                                    await markNotified(orderId);
                                }
                            }
                        } catch (e) {
                            console.error('Final trigger error:', e);
                        } finally {
                            delete waveTimersRef.current[orderId];
                        }
                    }, delay);
                }

                // ─── EVENT 4: QR SCANNED — Server handed over the order ────────
                const isNowScanned = currentFlow === 'CONSUMED' || currentFlow === 'MANIFESTED';
                const wasScanned = prev && (prev.flow === 'CONSUMED' || prev.flow === 'MANIFESTED');

                if (isNowScanned && !wasScanned) {
                    if (prev) {
                        const dKeyComplete = `${orderId}-SCANNED-AUDIO`;
                        if (!sessionDedupeRef.current.has(dKeyComplete)) {
                            sessionDedupeRef.current.add(dKeyComplete);
                            joeSounds.stopAll();
                            joeSounds.playStudentScanComplete();
                            triggerOneSignalWebhook(
                                userId,
                                '🎉 Enjoy your meal!',
                                `Order #${orderId.slice(-4).toUpperCase()} has been handed over. Bon appétit!`
                            );
                        }
                    }
                }

                // ─── EVENT 5 + 6: ORDER COMPLETED + STREAK REWARD ─────────────
                if ((!prev || prev.status !== 'COMPLETED') && currentStatus === 'COMPLETED') {

                    if (!data.streakCounted) {
                        try {
                            const userRef = doc(db, 'users', userId);
                            const userSnap = await getDoc(userRef);
                            if (userSnap.exists()) {
                                const newCount = (userSnap.data().completedOrdersCount || 0) + 1;
                                await updateDoc(userRef, { completedOrdersCount: newCount });
                                await updateDoc(doc(db, 'orders', orderId), { streakCounted: true });

                                if (newCount > 0 && newCount % 5 === 0) {
                                    triggerOneSignalWebhook(
                                        userId,
                                        '🏆 5-Order Streak!',
                                        `You've completed ${newCount} orders at JOE Cafeteria. You're a regular!`
                                    );
                                }
                            }
                        } catch (e) {
                            console.error('Streak update error:', e);
                        }
                    }

                    const dKeyCompleteAll = `${orderId}-FULL-COMPLETE-AUDIO`;
                    if (!sessionDedupeRef.current.has(dKeyCompleteAll)) {
                        sessionDedupeRef.current.add(dKeyCompleteAll);
                        if (!isNowScanned) {
                            joeSounds.stopAll();
                        }
                    }
                }

                activeListenerRef.current[orderId] = { status: currentStatus, flow: currentFlow, payStatus: currentPayStatus };
            });
        }, (error: any) => {
            if (error?.code === 'permission-denied') return;
            console.warn(`[useOrderNotifications] Listener error: ${error.message}`);
        });

        return unsub;
    }, [userId]);
};
