import { messaging, db, auth } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { triggerOneSignalWebhook } from './onesignal-webhook';

/**
 * FIREBASE-ONLY NOTIFICATION SERVICE
 * 100% Spark Plan compatible.
 * Uses native FCM with multi-device tokens stored in an array.
 */

const VAPID_KEY = "BJ5TxYGvR2UtmisAySt18orcHfobLUZp96syjFmJLBEi9zLL8BIA6BOGXUzQxVTMH6pU0J-UVUEeoMYcr6Rs5bo";

/**
 * Request permission and register token (for multi-device background push)
 */
export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('🔔 Notification permission granted.');
            
            // Register service worker explicitly to support PWA/mobile environments robustly
            let registration: ServiceWorkerRegistration | undefined;
            if ('serviceWorker' in navigator) {
                registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                console.log('✅ FCM Service Worker registered:', registration);

                // Wait until the service worker is active and ready to prevent "no active Service Worker" AbortError
                await navigator.serviceWorker.ready;

                if (registration.installing) {
                    const worker = registration.installing;
                    await new Promise<void>((resolve) => {
                        worker.addEventListener('statechange', function stateChangeHandler() {
                            if (worker.state === 'activated') {
                                worker.removeEventListener('statechange', stateChangeHandler);
                                resolve();
                            }
                        });
                    });
                } else if (registration.waiting) {
                    const worker = registration.waiting;
                    await new Promise<void>((resolve) => {
                        worker.addEventListener('statechange', function stateChangeHandler() {
                            if (worker.state === 'activated') {
                                worker.removeEventListener('statechange', stateChangeHandler);
                                resolve();
                            }
                        });
                    });
                }

                // A brief sleep to ensure the browser has fully registered the PushManager on the active worker
                if (!registration.active) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                console.log('🚀 FCM Service Worker is active and ready.');
            }

            const token = await getToken(messaging, { 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                await registerFCMToken(token);
                // Dispatch event so UI elements (like the HomeView Bell button) update instantly
                window.dispatchEvent(new CustomEvent('joe_notif_granted'));
                return token;
            }
        } else {
            console.warn('⚠️ Notification permission denied/dismissed:', permission);
        }
    } catch (error) {
        console.error('❌ Notification permission error:', error);
    }
    return null;
};

/**
 * Save token to Firestore using arrayUnion for multi-device support
 */
export const registerFCMToken = async (token: string) => {
    const user = auth.currentUser;
    if (!user) {
        console.warn('[FCM-REGISTRY] Cannot save token: No authenticated user.');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            fcmTokens: arrayUnion(token),
            lastUpdated: serverTimestamp()
        });
        console.log('🚀 FCM Token registered in array successfully.');
    } catch (e) {
        console.error('Error saving FCM token:', e);
    }
};

/**
 * Clear current FCM token from Firestore array (for logout cleanup)
 */
export const clearFCMToken = async () => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        let registration: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
            registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        }

        if (registration && registration.active) {
            const token = await getToken(messaging, { 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    fcmTokens: arrayRemove(token),
                    lastUpdated: serverTimestamp()
                });
                console.log('🗑️ Local FCM Token removed from array.');
            }
        } else {
            console.log('ℹ️ No active Service Worker found during logout. Skipping token array removal.');
        }
    } catch (e) {
        console.error('Error clearing FCM token during logout:', e);
    }
};

/**
 * Trigger a system notification locally (for active foreground states)
 */
export const triggerLocalNotification = (title: string, body: string) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/JeoLogoFinal.png',
            tag: 'order-update'
        });
    }
};

/**
 * Listen for order status changes and trigger local alerts
 * (Used while the app is active in foreground)
 */
export const listenForOrderUpdates = (orderId: string, onUpdate?: (data: any) => void) => {
    if (!orderId) return () => {};

    let lastStatus: string | null = null;
    let lastFlowStatus: string | null = null;

    return onSnapshot(
        doc(db, 'orders', orderId),
        (snapshot) => {
            if (!snapshot.exists()) return;
        
        const data = snapshot.data();
        const currentStatus = data.orderStatus;
        const currentFlowStatus = data.serveFlowStatus;

        // 1. Order Confirmed Alert
        if (lastStatus === 'PENDING' && (currentStatus === 'ACTIVE' || data.paymentStatus === 'VERIFIED')) {
            triggerLocalNotification(
                'Order Confirmed',
                'Your order has been accepted and is being prepared.'
            );
        }

        // 2. Order Ready Alert
        if (lastFlowStatus && lastFlowStatus !== 'READY' && currentFlowStatus === 'READY') {
            triggerLocalNotification(
                'Order Ready for Pickup',
                'Your order is ready at the counter.'
            );
        }

        // 3. Order Rejected Alert
        if (lastStatus && lastStatus !== 'REJECTED' && currentStatus === 'REJECTED') {
            triggerLocalNotification(
                'Order Rejected',
                'Your order could not be accepted. Please contact the cashier.'
            );
        }

        // 4. Order Collected Alert
        if (lastStatus && lastStatus !== 'COMPLETED' && currentStatus === 'COMPLETED') {
            triggerLocalNotification(
                'Order Completed',
                'Your order has been successfully collected.'
            );
        }

        lastStatus = currentStatus;
        lastFlowStatus = currentFlowStatus;
        if (onUpdate) onUpdate(data);
    }, (error) => {
        console.warn(`[listenForOrderUpdates] Listener error: ${error.message}`);
    });
};

/**
 * Listener for foreground FCM messages
 */
export function onForegroundMessage(callback: (payload: any) => void) {
    return onMessage(messaging, (payload) => {
        console.log('📩 Foreground notification:', payload);
        callback(payload);
    });
}

// 🏁 Expose hook for index.html compatibility or HomeView Bell button click
if (typeof window !== 'undefined') {
    (window as any).joeSubscribe = () => {
        console.log('🔔 [GLOBAL-SUBSCRIBE] Requesting FCM permission...');
        requestNotificationPermission();
    };
}

// ─── JOE WALLET NOTIFICATIONS ──────────────────────────────────────────────

/**
 * Notify student that their recharge has been approved.
 * Called by WalletView's real-time listener detecting status change from 'pending' → 'approved'.
 * 
 * FCM SERVER PUSH: For background notification, call a Cloud Function here.
 * Current: local Notification API only (works while app is open/focused).
 */
export const notifyRechargeApproved = (amount: number, userId?: string): void => {
    triggerLocalNotification(
        '✅ Recharge Approved!',
        `₹${amount} has been added to your JOE Wallet.`
    );
    // Background push — works even when app is closed
    if (userId) {
        triggerOneSignalWebhook(
            userId,
            '✅ Wallet Recharged!',
            `₹${amount} has been added to your JOE Wallet. Your balance is now updated.`
        );
    }
    // Dispatch DOM event so WalletView can show an in-app toast
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('joe_wallet_recharged', { detail: { amount } }));
    }
};

/**
 * Notify student that their recharge was rejected.
 */
export const notifyRechargeRejected = (amount: number, note?: string, userId?: string): void => {
    triggerLocalNotification(
        '❌ Recharge Rejected',
        `Your ₹${amount} recharge request was declined.${note ? ` Reason: ${note}` : ''}`
    );
    // Background push — works even when app is closed
    if (userId) {
        triggerOneSignalWebhook(
            userId,
            '❌ Recharge Request Declined',
            `Your ₹${amount} top-up was rejected.${note ? ` Reason: ${note}` : ' Please contact the cashier.'}`
        );
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('joe_wallet_rejected', { detail: { amount, note } }));
    }
};

/**
 * Warn student of low balance.
 * Called when wallet balance drops below threshold after an order.
 */
export const notifyLowBalance = (balance: number): void => {
    triggerLocalNotification(
        '⚠️ Low Wallet Balance',
        `Your JOE Wallet balance is ₹${balance}. Recharge to keep ordering.`
    );
};

/**
 * Notify student that wallet was debited for an order.
 */
export const notifyWalletDebited = (amount: number, balanceAfter: number): void => {
    // Silent — no popup, just dispatch DOM event for in-app update
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('joe_wallet_debited', { detail: { amount, balanceAfter } }));
    }
};
