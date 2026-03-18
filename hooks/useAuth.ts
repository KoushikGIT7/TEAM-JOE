/**
 * useAuth Hook — Single source of truth for authentication state.
 *
 * CRITICAL FIX: loading stays `true` until BOTH the Firebase user AND the
 * Firestore profile have been resolved. This prevents routing from firing
 * prematurely with an incomplete (user=✓, profile=null) state, which caused
 * the "first login shows Welcome screen" bug.
 *
 * Flow:
 *   onAuthStateChanged fires
 *   → if user:  fetch profile → set user+profile → set loading=false
 *   → if null:  clear user+profile → set loading=false
 *
 * No setTimeout. No fallback hacks. Clean and deterministic.
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

export const useAuth = (): UseAuthReturn => {
  const [user, setUser]         = useState<FirebaseUser | null>(null);
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);  // TRUE until first auth resolution
  const isMountedRef            = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const unsubscribe = onAuthStateChange((firebaseUser, userProfile) => {
      if (!isMountedRef.current) return;

      if (firebaseUser && userProfile) {
        // Both user AND profile resolved — safe to route
        setUser(firebaseUser);
        setProfile(userProfile);
        setLoading(false);
      } else if (!firebaseUser) {
        // Logged out
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (firebaseUser) {
        // User exists but profile is still resolving in the service layer.
        // We stay loading to prevent flickering or unauthorized views.
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
