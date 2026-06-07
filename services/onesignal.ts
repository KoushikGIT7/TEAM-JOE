import OneSignal from 'react-onesignal';
import { UserProfile } from '../types';

const ONESIGNAL_APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';

let isInitialized = false;
let initPromise: Promise<void> | null = null;
let changeListeners: ((optedIn: boolean) => void)[] = [];

/**
 * 🔔 Safe Client-Side OneSignal Initialization
 * Prevents multiple concurrent/duplicate SDK calls.
 */
export const initializeOneSignal = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log('🔌 [ONESIGNAL] Initializing Web SDK with combined service worker...');
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          // Point to combined worker so only one root SW is registered
          serviceWorkerPath: 'firebase-messaging-sw.js',
          notifyButton: { enable: false }
        });
        isInitialized = true;
        console.log('✅ [ONESIGNAL] Web SDK Initialized successfully.');

        // Trigger and register all deferred change listeners
        const currentState = OneSignal.User.PushSubscription.optedIn ?? false;
        for (const cb of changeListeners) {
          try {
            OneSignal.User.PushSubscription.addEventListener("change", (e: any) => {
              if (e && e.current) {
                cb(e.current.optedIn);
              }
            });
            cb(currentState);
          } catch (e) {
            console.error("🔔 [OneSignal] Deferred listener registration error:", e);
          }
        }
        changeListeners = []; // Clear queue
      } catch (error) {
        console.error('❌ [ONESIGNAL] Initialization failed:', error);
        initPromise = null; // Allow retry on failure
      }
    })();
  }
  
  return initPromise;
};

/**
 * 🏷️ Synchronize User Identity and tags to OneSignal
 */
export const loginUser = async (uid: string, profile: UserProfile): Promise<void> => {
  if (typeof window === 'undefined') return;
  await initializeOneSignal();

  try {
    console.log(`👤 [ONESIGNAL] Logging in external_id: ${uid}`);
    await OneSignal.login(uid);

    // Build user tags for targeting segmentation
    const tags: Record<string, string> = {
      role: (profile.role || 'student').toLowerCase(),
      name: profile.name,
      wallet_enabled: String(profile.walletBalance !== undefined),
      regular_customer: String((profile.totalSpent && profile.totalSpent > 0) || false),
    };

    if (profile.walletBalance !== undefined) {
      tags.wallet_user = 'true';
      tags.low_balance_user = String(profile.walletBalance < 30);
    }

    await OneSignal.User.addTags(tags);
    console.log('🏷️ [ONESIGNAL] Tags synchronized:', tags);
  } catch (error) {
    console.error('❌ [ONESIGNAL] Failed to identify user:', error);
  }
};

/**
 * 🚪 Log out and clear user context
 */
export const logoutUser = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  await initializeOneSignal();
  try {
    console.log('🚪 [ONESIGNAL] Logging out and clearing user aliases...');
    await OneSignal.logout();
  } catch (error) {
    console.error('❌ [ONESIGNAL] Logout error:', error);
  }
};

/**
 * 🔒 Request Push Notification Permission
 */
export const requestOneSignalPermission = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  await initializeOneSignal();
  try {
    console.log('🔔 [ONESIGNAL] Requesting push permission...');
    await OneSignal.Notifications.requestPermission();
  } catch (error) {
    console.error('❌ [ONESIGNAL] Error requesting permission:', error);
  }
};

/**
 * 📊 Get current push subscription state (boolean)
 */
export const getPushSubscriptionState = (): boolean => {
  if (typeof window === 'undefined' || !isInitialized) return false;
  try {
    return OneSignal.User.PushSubscription.optedIn ?? false;
  } catch (e) {
    console.error("🔔 [OneSignal] Get opt-in state error:", e);
    return false;
  }
};

/**
 * ⚙️ Set push subscription state (Opt-In / Opt-Out)
 */
export const setPushSubscriptionState = async (enable: boolean): Promise<void> => {
  if (typeof window === 'undefined') return;
  await initializeOneSignal();
  try {
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

/**
 * 🔄 Register callback for subscription changes
 */
export const addSubscriptionChangeListener = (callback: (optedIn: boolean) => void): void => {
  if (typeof window === 'undefined') return;
  
  if (isInitialized) {
    try {
      OneSignal.User.PushSubscription.addEventListener("change", (e: any) => {
        if (e && e.current) {
          callback(e.current.optedIn);
        }
      });
    } catch (e) {
      console.error("🔔 [OneSignal] Event listener registration error:", e);
    }
  } else {
    // Queue the listener to be registered when initialization is complete
    changeListeners.push(callback);
  }
};

/**
 * 🆔 Get current push subscription ID
 */
export const getPushSubscriptionId = (): string | undefined => {
  if (typeof window === 'undefined' || !isInitialized) return undefined;
  try {
    return OneSignal.User.PushSubscription.id;
  } catch (e) {
    console.error("🔔 [OneSignal] Get subscription ID error:", e);
    return undefined;
  }
};
