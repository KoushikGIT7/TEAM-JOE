import { messaging, db, auth } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';

/**
 * FIREBASE-ONLY NOTIFICATION SERVICE
 * 100% Spark Plan compatible.
 * Uses client-side Firestore listeners for instant, free alerts.
 */

const VAPID_KEY = "BJ5TxYGvR2UtmisAySt18orcHfobLUZp96syjFmJLBEi9zLL8BIA6BOGXUzQxVTMH6pU0J-UVUEeoMYcr6Rs5bo";

/**
 * Request permission and register token (for future proofing)
 */
export const requestNotificationPermission = async () => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('🔔 Notification permission granted.');
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (token) {
                await registerFCMToken(token);
                return token;
            }
        }
    } catch (error) {
        console.error('❌ Notification permission error:', error);
    }
    return null;
};

/**
 * Save token to Firestore
 */
export const registerFCMToken = async (token: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: token,
            lastTokenUpdate: Date.now()
        });
    } catch (e) {
        console.error('Error saving FCM token:', e);
    }
};

/**
 * Trigger a system notification locally
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
 * Listen for order status changes and trigger alerts
 * Used by students to get instant updates without a backend.
 */
export const listenForOrderUpdates = (orderId: string, onUpdate?: (data: any) => void) => {
    if (!orderId) return () => {};

    let lastStatus: string | null = null;
    let lastFlowStatus: string | null = null;

    return onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
        if (!snapshot.exists()) return;
        
        const data = snapshot.data();
        const currentStatus = data.orderStatus;
        const currentFlowStatus = data.serveFlowStatus;

        // 1. Order Ready Alert
        if (lastFlowStatus && lastFlowStatus !== 'READY' && currentFlowStatus === 'READY') {
            triggerLocalNotification(
                '🍽️ Order Ready',
                'Your order is ready. Please collect it within 10 minutes.'
            );
        }

        // 2. Order Rejected Alert
        if (lastStatus && lastStatus !== 'REJECTED' && currentStatus === 'REJECTED') {
            triggerLocalNotification(
                '⚠️ Order Issue',
                'Your order was rejected. Please contact the cashier.'
            );
        }

        lastStatus = currentStatus;
        lastFlowStatus = currentFlowStatus;
        if (onUpdate) onUpdate(data);
    });
};

/**
 * Listener for foreground FCM messages (legacy/future compatibility)
 */
export function onForegroundMessage(callback: (payload: any) => void) {
    return onMessage(messaging, (payload) => {
        console.log('📩 Foreground notification:', payload);
        callback(payload);
    });
}
