import OneSignal from 'react-onesignal';
import { UserProfile } from '../types';

export const initializeOneSignal = async () => {
    try {
        if (!OneSignal.initialized) {
            await OneSignal.init({
                appId: "2ce03ee2-27d2-49b7-9fea-21c1f2f124cd",
                allowLocalhostAsSecureOrigin: true,
                notifyButton: { enable: false }
            });
            console.log("🔔 [OneSignal] Initialized successfully");
        }
    } catch (e) {
        console.error("🔔 [OneSignal] Initialization error:", e);
    }
};

export const loginUser = async (uid: string, profile: UserProfile) => {
    try {
        if (!OneSignal.initialized) return;
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
        if (!OneSignal.initialized) return;
        await OneSignal.logout();
        console.log("🔔 [OneSignal] User logged out");
    } catch (e) {
        console.error("🔔 [OneSignal] Logout error:", e);
    }
};

export const requestOneSignalPermission = async () => {
    try {
        if (!OneSignal.initialized) return;
        await OneSignal.Slidedown.promptPush();
    } catch (e) {
        console.error("🔔 [OneSignal] Prompt error:", e);
    }
};
