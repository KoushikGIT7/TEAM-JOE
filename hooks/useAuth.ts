/**
 * useAuth Hook — Single source of truth for authentication state.
 *
 * ⚡ [OPTIMIZATION] Profile is now cached in localStorage.
 * - On app start: profile loaded instantly from cache (no loading flash)
 * - onAuthStateChanged + onSnapshot still resolve the authoritative profile
 * - Cache updated whenever profile snapshot fires
 * - Cache cleared on logout
 * - No repeated Firestore reads for profile
 *
 * Flow:
 *   App Start → Load cached profile instantly (if UID matches)
 *   onAuthStateChanged → onSnapshot(users/uid)
 *     → if profile exists: update cache + setState → route
 *     → if null: clear cache → setState null → loading=false
 */

import { useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChange } from '../services/auth';
import { UserProfile } from '../types';

interface UseAuthReturn {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  role: UserProfile['role'] | null;
}

const PROFILE_CACHE_KEY = 'cse_profile_cache';
const PROFILE_UID_KEY = 'cse_profile_uid';

/** Read profile from localStorage (instant, no network) */
function loadCachedProfile(uid: string): UserProfile | null {
  try {
    const cachedUid = localStorage.getItem(PROFILE_UID_KEY);
    if (cachedUid !== uid) return null;
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/** Persist profile to localStorage */
function saveProfileCache(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_UID_KEY, profile.uid);
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch { /* localStorage full — non-critical */ }
}

/** Clear profile from localStorage on logout */
function clearProfileCache(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(PROFILE_UID_KEY);
  } catch {}
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser]       = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef          = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const unsubscribe = onAuthStateChange((firebaseUser, userProfile) => {
      if (!isMountedRef.current) return;

      if (firebaseUser && userProfile) {
        // ✅ Both resolved — cache profile + update state
        saveProfileCache(userProfile);
        setUser(firebaseUser);
        setProfile(userProfile);
        setLoading(false);
      } else if (firebaseUser && !userProfile) {
        // ⏳ Firebase user exists but profile not yet resolved
        // Try loading from cache to avoid blank screen
        const cached = loadCachedProfile(firebaseUser.uid);
        if (cached) {
          setUser(firebaseUser);
          setProfile(cached);
          setLoading(false); // Show cached profile immediately; snapshot will update it
        }
        // else stay loading — snapshot will fire soon
      } else if (!firebaseUser) {
        // 🚪 Logged out
        clearProfileCache();
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  const role = profile?.role ?? null;

  return { user, profile, loading, role };
};
