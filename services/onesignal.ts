import OneSignal from 'react-onesignal';
import { UserProfile } from '../types';

const ONESIGNAL_APP_ID = '2ce03ee2-27d2-49b7-9fea-21c1f2f124cd';

// Module-level flags — survive React re-renders and StrictMode double-invokes
let isInitialized = false;
let initPromise: Promise<void> | null = null;
let changeListeners: ((optedIn: boolean) => void)[] = [];

// Cache to prevent redundant login/tag API calls
let lastLoggedId: string | null = null;
let lastSyncedTagsJson: string | null = null;

/**
 * 🔔 Safe OneSignal Initialization
 *
 * Handles:
 *  - React StrictMode double-invoke (initPromise deduplication)
 *  - "SDK already initialized" error (treated as success, not failure)
 *  - logoutUser() called before init is ready (guarded by isInitialized flag)
 */
export const initializeOneSignal = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;

  // On localhost the OneSignal app is domain-locked to https://kucafe.online.
  // The SDK cannot subscribe devices on localhost anyway (no service worker scope).
  // We skip init here — push sending still works via direct REST API in onesignal-webhook.ts.
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (isLocal) {
    console.log('ℹ️ [ONESIGNAL] Localhost detected — skipping SDK init (domain-locked to kucafe.online). Push sending via REST API still works.');
    return;
  }

  // Already in progress — return the same promise
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('🔌 [ONESIGNAL] Initializing Web SDK...');
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false } as any
      });
      isInitialized = true;
      console.log('✅ [ONESIGNAL] Web SDK Initialized.');

      // Auto-opt-in if browser permission is already granted!
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        console.log('🔔 [ONESIGNAL] Permission is granted. Opting in to push subscription...');
        OneSignal.User.PushSubscription.optIn().catch(err => {
          console.warn('[ONESIGNAL] Auto opt-in failed:', err);
        });
      }
    } catch (error: any) {
      const msg = error?.message || '';
      if (
        msg.includes('already initialized') ||
        msg.includes('already been initialized') ||
        msg.includes('SDK already')
      ) {
        // SDK was loaded by the page script tag before our module ran — adopt it
        isInitialized = true;
        console.log('✅ [ONESIGNAL] SDK already initialized (script tag). Adopting state.');
      } else if (msg.includes('Can only be used on')) {
        // Domain restriction — this device/origin is not whitelisted in OneSignal dashboard
        // This is expected on staging/preview URLs. Push sending via REST API still works.
        console.warn('⚠️ [ONESIGNAL] Domain not whitelisted — SDK subscription disabled on this origin. REST push still works.');
        initPromise = null;
        return;
      } else {
        console.error('❌ [ONESIGNAL] Initialization failed:', error);
        initPromise = null;
        return;
      }
    }

    // Register any deferred change listeners queued before init completed
    try {
      const currentState = OneSignal.User.PushSubscription.optedIn ?? false;
      for (const cb of changeListeners) {
        try {
          OneSignal.User.PushSubscription.addEventListener('change', (e: any) => {
            if (e?.current) cb(e.current.optedIn);
          });
          cb(currentState);
        } catch (e) {
          console.error('🔔 [OneSignal] Deferred listener error:', e);
        }
      }
      changeListeners = [];
    } catch (_) {}
  })();

  return initPromise;
};

/**
 * 👤 Login / sync user identity to OneSignal
 */
export const loginUser = async (uid: string, profile: UserProfile): Promise<void> => {
  if (typeof window === 'undefined') return;

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

  const tagsJson = JSON.stringify(tags);

  // Skip if nothing changed
  if (lastLoggedId === uid && lastSyncedTagsJson === tagsJson) return;

  await initializeOneSignal();
  if (!isInitialized) return; // init genuinely failed, bail out

  try {
    if (lastLoggedId !== uid) {
      console.log(`👤 [ONESIGNAL] Logging in external_id: ${uid}`);
      await OneSignal.login(uid);
      lastLoggedId = uid;
    }

    if (lastSyncedTagsJson !== tagsJson) {
      await OneSignal.User.addTags(tags);
      lastSyncedTagsJson = tagsJson;
      console.log('🏷️ [ONESIGNAL] Tags synced:', tags);
    }
  } catch (error) {
    console.error('❌ [ONESIGNAL] loginUser error:', error);
  }
};

/**
 * 🚪 Logout — only runs if SDK is fully ready
 */
export const logoutUser = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  // Do NOT call initializeOneSignal() here — if there is no user, we don't
  // want to boot the SDK just to log out a non-existent session.
  // If init hasn't completed, there's no session to clear anyway.
  if (!isInitialized) {
    lastLoggedId = null;
    lastSyncedTagsJson = null;
    return;
  }

  // Only log out if we actually logged someone in
  if (!lastLoggedId) return;

  try {
    console.log('🚪 [ONESIGNAL] Logging out user...');
    await OneSignal.logout();
    lastLoggedId = null;
    lastSyncedTagsJson = null;
  } catch (error) {
    console.error('❌ [ONESIGNAL] Logout error:', error);
    // Still clear local state so we don't keep retrying
    lastLoggedId = null;
    lastSyncedTagsJson = null;
  }
};

/**
 * 🔒 Request Push Permission
 */
export const requestOneSignalPermission = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  await initializeOneSignal();
  if (!isInitialized) return;
  try {
    await OneSignal.Notifications.requestPermission();
  } catch (error) {
    console.error('❌ [ONESIGNAL] requestPermission error:', error);
  }
};

/**
 * 📊 Get current subscription opt-in state
 */
export const getPushSubscriptionState = (): boolean => {
  if (typeof window === 'undefined' || !isInitialized) return false;
  try {
    return OneSignal.User.PushSubscription.optedIn ?? false;
  } catch (_) {
    return false;
  }
};

/**
 * ⚙️ Opt in or out of push notifications
 */
export const setPushSubscriptionState = async (enable: boolean): Promise<void> => {
  if (typeof window === 'undefined') return;

  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 4000));

  const actionPromise = (async () => {
    await initializeOneSignal();
    if (!isInitialized) return;
    try {
      if (enable) {
        const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
        if (permission === 'granted') {
          await OneSignal.User.PushSubscription.optIn();
        } else if (permission === 'denied') {
          console.warn('[OneSignal] Notifications blocked in browser — user must unblock manually.');
        } else {
          await OneSignal.Notifications.requestPermission();
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            await OneSignal.User.PushSubscription.optIn();
          }
        }
      } else {
        await OneSignal.User.PushSubscription.optOut();
      }
    } catch (e) {
      console.error('🔔 [OneSignal] setPushSubscriptionState error:', e);
    }
  })();

  await Promise.race([actionPromise, timeoutPromise]);
};

/**
 * 🔄 Register a subscription change listener — returns cleanup fn
 */
export const addSubscriptionChangeListener = (
  callback: (optedIn: boolean) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  let internalHandler: ((e: any) => void) | null = null;

  const registerNow = () => {
    internalHandler = (e: any) => {
      if (e?.current) callback(e.current.optedIn);
    };
    try {
      OneSignal.User.PushSubscription.addEventListener('change', internalHandler);
    } catch (e) {
      console.error('🔔 [OneSignal] addEventListener error:', e);
    }
  };

  if (isInitialized) {
    registerNow();
  } else {
    // Queue until init completes
    changeListeners.push((optedIn: boolean) => {
      callback(optedIn);
      registerNow();
    });
  }

  return () => {
    if (internalHandler) {
      try {
        OneSignal.User.PushSubscription.removeEventListener('change', internalHandler as any);
      } catch (_) {}
      internalHandler = null;
    }
  };
};

/**
 * 🆔 Get current push subscription ID
 */
export const getPushSubscriptionId = (): string | undefined => {
  if (typeof window === 'undefined' || !isInitialized) return undefined;
  try {
    return OneSignal.User.PushSubscription.id;
  } catch (_) {
    return undefined;
  }
};

// Re-export for backwards compatibility
export const requestNotificationPermission = requestOneSignalPermission;
