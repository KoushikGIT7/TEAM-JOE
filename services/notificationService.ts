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

            // Unregister any conflicting legacy FCM service worker to let OneSignal own background push
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const reg of registrations) {
                        if (reg.active && reg.active.scriptURL.includes('firebase-messaging-sw.js')) {
                            const success = await reg.unregister();
                            if (success) {
                                console.log('🗑️ Conflicting legacy FCM Service Worker unregistered successfully.');
                            }
                        }
                    }
                } catch (swErr) {
                    console.warn('Error cleaning up legacy service workers:', swErr);
                }
            }

            // Trigger OneSignal permission/registration to register OneSignal service worker
            try {
                const { requestOneSignalPermission } = await import('./onesignal');
                await requestOneSignalPermission();
            } catch (err) {
                console.warn('[OneSignal] Failed to trigger OneSignal registration:', err);
            }
            
            // Dispatch event so UI elements (like the HomeView Bell button) update instantly
            window.dispatchEvent(new CustomEvent('cse_notif_granted'));
            return 'granted';
        } else {
            console.warn('⚠️ Notification permission denied/dismissed:', permission);
        }
    } catch (error) {
        console.error('❌ Notification permission error:', error);
    }
    return null;
};

/**
 * Save token to Firestore (No-op since switching to OneSignal)
 */
export const registerFCMToken = async (token: string) => {
    console.log('ℹ️ registerFCMToken is now a no-op (using OneSignal). ID:', token);
};

/**
 * Clear current FCM token from Firestore (Clean up legacy FCM service workers instead)
 */
export const clearFCMToken = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                if (reg.active && reg.active.scriptURL.includes('firebase-messaging-sw.js')) {
                    await reg.unregister();
                }
            }
        } catch (_) {}
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
    (window as any).cseSubscribe = () => {
        console.log('🔔 [GLOBAL-SUBSCRIBE] Requesting FCM permission...');
        requestNotificationPermission();
    };
}

// ─── CSE WALLET NOTIFICATIONS ──────────────────────────────────────────────

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
        `₹${amount} has been added to your CSE Wallet.`
    );
    // Background push — works even when app is closed
    if (userId) {
        triggerOneSignalWebhook(
            userId,
            '✅ Wallet Recharged!',
            `₹${amount} has been added to your CSE Wallet. Your balance is now updated.`
        );
    }
    // Dispatch DOM event so WalletView can show an in-app toast
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cse_wallet_recharged', { detail: { amount } }));
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
        window.dispatchEvent(new CustomEvent('cse_wallet_rejected', { detail: { amount, note } }));
    }
};

/**
 * Warn student of low balance.
 * Called when wallet balance drops below threshold after an order.
 */
export const notifyLowBalance = (balance: number): void => {
    triggerLocalNotification(
        '⚠️ Low Wallet Balance',
        `Your CSE Wallet balance is ₹${balance}. Recharge to keep ordering.`
    );
};

/**
 * Notify student that wallet was debited for an order.
 */
export const notifyWalletDebited = (amount: number, balanceAfter: number): void => {
    // Silent — no popup, just dispatch DOM event for in-app update
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cse_wallet_debited', { detail: { amount, balanceAfter } }));
    }
};
