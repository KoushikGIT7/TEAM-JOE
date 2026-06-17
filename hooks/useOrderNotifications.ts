import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, PrepBatch } from '../types';
import { cseSounds } from '../utils/audio';
import { triggerOneSignalWebhook } from '../services/onesignal-webhook';

/**
 * Hook to listen for order status changes for the STUDENT side.
 *
 * ⚠️  PUSH NOTIFICATION ARCHITECTURE NOTE:
 *   - "Food Ready" push (EVENT 3) is sent by the SUPERVISOR's browser when
 *     they click "🔔 Notify Ready" in AssistantSupervisorView.
 *     We do NOT re-send it here to avoid duplicates and wrong-device triggers.
 *
 *   - This hook handles LOCAL in-app audio/UI alerts on the student's device
 *     when their app IS open and the Firestore snapshot fires.
 *
 * EVENTS COVERED:
 *   1. REJECTED          — order/payment rejected by cashier
 *   2. CASH_CONFIRMED    — cashier approved cash order (QR now unlocked)
 *   3. READY             — supervisor marks food ready → local chime + TTS only
 *   4. QR_SCANNED        — server scans QR (serveFlowStatus=CONSUMED/MANIFESTED)
 *   5. COMPLETED         — order fully served
 *   6. STREAK_REWARD     — every 5 completed orders
 */
export const useOrderNotifications = (userId: string | null) => {
    const activeListenerRef = useRef<Record<string, { status: string; flow: string; payStatus: string }>>({});
    const sessionDedupeRef = useRef<Set<string>>(new Set());
    const waveTimersRef = useRef<Record<string, boolean>>({});

    useEffect(() => {
        if (!userId) return;

        console.log('🔔 [OrderNotify] Monitoring order events for student:', userId);

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

                // ─── EVENT 1: REJECTED ────────────────────────────────────────
                if ((!prev || prev.status !== 'REJECTED') && currentStatus === 'REJECTED') {
                    const dKey = `${orderId}-REJECTED`;
                    if (!sessionDedupeRef.current.has(dKey)) {
                        sessionDedupeRef.current.add(dKey);
                        cseSounds.playRejected();
                        // Push from cashier device already sent; this is backup for when app is open
                        triggerOneSignalWebhook(
                            userId,
                            '⚠️ Order Rejected',
                            `Order #${orderId.slice(-4).toUpperCase()} was rejected. Please contact the cashier.`
                        ).catch(() => {});
                    }
                }

                // ─── EVENT 2: CASH ORDER CONFIRMED BY CASHIER ─────────────────
                const wasUnverified = !prev || (prev.payStatus !== 'VERIFIED' && prev.payStatus !== 'SUCCESS');
                const isNowVerified = currentPayStatus === 'VERIFIED' || currentPayStatus === 'SUCCESS';
                const isCashOrder = data.paymentType === 'CASH';
                const cashKey = `${orderId}-CASH-CONFIRMED`;

                if (wasUnverified && isNowVerified && isCashOrder && !sessionDedupeRef.current.has(cashKey)) {
                    sessionDedupeRef.current.add(cashKey);
                    cseSounds.playPaymentConfirmed?.().catch?.(() => {});
                    // Push already sent from cashier device; this is the in-app alert
                }

                // ─── EVENT 3: FOOD READY — Local alert only ──────────────────
                // ⚠️  The OneSignal push is sent from the SUPERVISOR'S device in
                //     AssistantSupervisorView.handleNotifyReady().
                //     Here we only play local audio/TTS if the student app is open.
                const wasReady = prev && prev.flow === 'READY';
                const isNowReady = currentFlow === 'READY';

                if (isNowReady && !wasReady) {
                    const dKey = `${orderId}-READY-LOCAL`;
                    if (!sessionDedupeRef.current.has(dKey)) {
                        sessionDedupeRef.current.add(dKey);

                        // Play chime and announce TTS 3 times sequentially
                        try {
                            const shortToken = data.tokenNumber || orderId.slice(-4).toUpperCase();
                            const speakText = `Token ${shortToken}, your food is ready at the counter.`;
                            
                            if (typeof window !== 'undefined' && window.speechSynthesis) {
                                window.speechSynthesis.cancel();
                                for (let i = 0; i < 3; i++) {
                                    // Play the celebratory ping sound with offset matching speech pacing
                                    setTimeout(() => {
                                        cseSounds.playFoodReady().catch(() => {});
                                    }, i * 3500);

                                    const utter = new SpeechSynthesisUtterance(speakText);
                                    utter.lang = 'en-IN';
                                    utter.rate = 0.85;
                                    window.speechSynthesis.speak(utter);
                                }
                            }
                        } catch (_) {}
                    }
                }

                // ─── EVENT 4: QR SCANNED — Local celebration ──────────────────
                const isNowScanned = currentFlow === 'CONSUMED' || currentFlow === 'MANIFESTED';
                const wasScanned = prev && (prev.flow === 'CONSUMED' || prev.flow === 'MANIFESTED');

                if (isNowScanned && !wasScanned) {
                    if (prev) {
                        const dKey = `${orderId}-SCANNED-AUDIO`;
                        if (!sessionDedupeRef.current.has(dKey)) {
                            sessionDedupeRef.current.add(dKey);
                            cseSounds.stopAll();
                            cseSounds.playStudentScanComplete();
                            // Push from scanner device already sent; no duplicate here
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
                                        `You've completed ${newCount} orders at CSE Cafeteria. You're a regular!`
                                    ).catch(() => {});
                                }
                            }
                        } catch (e) {
                            console.error('Streak update error:', e);
                        }
                    }

                    const dKey = `${orderId}-FULL-COMPLETE-AUDIO`;
                    if (!sessionDedupeRef.current.has(dKey)) {
                        sessionDedupeRef.current.add(dKey);
                        if (!isNowScanned) {
                            cseSounds.stopAll();
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
