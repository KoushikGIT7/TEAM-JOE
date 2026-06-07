import OneSignal from 'react-onesignal';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile } from '../types';

const ONESIGNAL_APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 🔔 Safe Client-Side OneSignal Initialization
 * Prevents multiple/duplicate SDK calls.
 */
export const initializeOneSignal = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log('🔌 [ONESIGNAL] Initializing Web SDK...');
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });
        isInitialized = true;
        console.log('✅ [ONESIGNAL] Web SDK Initialized successfully.');
      } catch (error) {
        console.error('❌ [ONESIGNAL] Initialization failed:', error);
        initPromise = null; // allow retry
      }
    })();
  }
  
  return initPromise;
};

/**
 * 🔒 Native Push Notification Permission Prompt
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    console.log('🔔 [ONESIGNAL] Requesting push permission...');
    const result = await OneSignal.Notifications.requestPermission();
    const isGranted = OneSignal.Notifications.permission;
    
    // Log analytics
    await trackAnalyticsEvent(isGranted ? 'Permission Accepted' : 'Permission Rejected', {
      raw_result: result,
    });

    console.log(`🔔 [ONESIGNAL] Permission state: ${isGranted ? 'GRANTED' : 'DENIED'}`);
    return isGranted;
  } catch (error) {
    console.error('❌ [ONESIGNAL] Error requesting permission:', error);
    return false;
  }
};

/**
 * 📊 Get current notification permission and subscription status
 */
export const getSubscriptionStatus = () => {
  if (typeof window === 'undefined' || !isInitialized) {
    return { permission: false, optedIn: false, subscriptionId: undefined };
  }

  try {
    return {
      permission: OneSignal.Notifications.permission,
      optedIn: OneSignal.User.PushSubscription.optedIn || false,
      subscriptionId: OneSignal.User.PushSubscription.id,
    };
  } catch (error) {
    console.error('❌ [ONESIGNAL] Failed to read subscription status:', error);
    return { permission: false, optedIn: false, subscriptionId: undefined };
  }
};

/**
 * 🏷️ Synchronize User Context and segment tags
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
  try {
    console.log('🚪 [ONESIGNAL] Logging out and clearing user aliases...');
    await OneSignal.logout();
  } catch (error) {
    console.error('❌ [ONESIGNAL] Logout error:', error);
  }
};

/**
 * 🏷️ Set specific user tags on the fly
 */
export const setUserTags = async (tags: Record<string, string>): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    await OneSignal.User.addTags(tags);
  } catch (error) {
    console.error('❌ [ONESIGNAL] Failed to set user tags:', error);
  }
};

/**
 * 📈 Track OneSignal push analytics inside Firestore
 */
export const trackAnalyticsEvent = async (eventName: string, data: Record<string, any> = {}): Promise<void> => {
  try {
    const trackingRef = collection(db, 'onesignal_analytics');
    await addDoc(trackingRef, {
      event: eventName,
      timestamp: serverTimestamp(),
      ...data,
    });
    console.log(`📈 [ANALYTICS] Logged event: "${eventName}"`);
  } catch (error) {
    console.error(`❌ [ANALYTICS] Failed to write metrics for "${eventName}":`, error);
  }
};

export const getPushSubscriptionState = (): boolean => {
  if (typeof window === 'undefined' || !isInitialized) return false;
  try {
    return OneSignal.User.PushSubscription.optedIn ?? false;
  } catch (e) {
    console.error("🔔 [OneSignal] Get opt-in state error:", e);
    return false;
  }
};

export const setPushSubscriptionState = async (enable: boolean) => {
  if (typeof window === 'undefined' || !isInitialized) return;
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

export const addSubscriptionChangeListener = (callback: (optedIn: boolean) => void) => {
  if (typeof window === 'undefined' || !isInitialized) return;
  try {
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
  if (typeof window === 'undefined' || !isInitialized) return undefined;
  try {
    return OneSignal.User.PushSubscription.id;
  } catch (e) {
    console.error("🔔 [OneSignal] Get subscription ID error:", e);
    return undefined;
  }
};
