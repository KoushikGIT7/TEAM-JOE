import OneSignal from 'react-onesignal';
import { UserProfile } from '../types';

let isInitialized = false;

export const initializeOneSignal = async () => {
    if (typeof window === 'undefined') return;
    if (isInitialized) return;
    try {
        await OneSignal.init({
            appId: "2ce03ee2-27d2-49b7-9fea-21c1f2f124cd",
            allowLocalhostAsSecureOrigin: true,
            notifyButton: { enable: false }
        });
        isInitialized = true;
        console.log("🔔 [OneSignal] Initialized successfully");
    } catch (e) {
        console.error("🔔 [OneSignal] Initialization error:", e);
    }
};

export const loginUser = async (uid: string, profile: UserProfile) => {
    try {
        if (!isInitialized) return;
        await OneSignal.login(uid);
        OneSignal.User.addTags({
            role: profile.role,
            userName: profile.name
        });
        console.log(`🔔 [OneSignal] User logged in: ${uid}`);
    } catch (e) {
        console.error("🔔 [OneSignal] Login error:", e);
    }
};

export const logoutUser = async () => {
    try {
        if (!isInitialized) return;
        await OneSignal.logout();
        console.log("🔔 [OneSignal] User logged out");
    } catch (e) {
        console.error("🔔 [OneSignal] Logout error:", e);
    }
};

export const requestOneSignalPermission = async () => {
    try {
        if (!isInitialized) return;
        await OneSignal.Notifications.requestPermission();
    } catch (e) {
        console.error("🔔 [OneSignal] Prompt error:", e);
    }
};

export const getPushSubscriptionState = (): boolean => {
    try {
        if (!isInitialized) return false;
        return OneSignal.User.PushSubscription.optedIn ?? false;
    } catch (e) {
        console.error("🔔 [OneSignal] Get opt-in state error:", e);
        return false;
    }
};

export const setPushSubscriptionState = async (enable: boolean) => {
    try {
        if (!isInitialized) return;
        if (enable) {
            if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                await OneSignal.Notifications.requestPermission();
            } else {
                await OneSignal.User.PushSubscription.optIn();
            }
        } else {
            await OneSignal.User.PushSubscription.optOut();
        }
    } catch (e) {
        console.error("🔔 [OneSignal] Set opt-in state error:", e);
    }
};

export const addSubscriptionChangeListener = (callback: (optedIn: boolean) => void) => {
    try {
        if (!isInitialized) return;
        OneSignal.User.PushSubscription.addEventListener("change", (e: any) => {
            if (e && e.current) {
                callback(e.current.optedIn);
            }
        });
    } catch (e) {
        console.error("🔔 [OneSignal] Event listener registration error:", e);
    }
};

export const getPushSubscriptionId = (): string | undefined => {
    try {
        if (!isInitialized) return undefined;
        return OneSignal.User.PushSubscription.id;
    } catch (e) {
        console.error("🔔 [OneSignal] Get subscription ID error:", e);
        return undefined;
    }
};
