/**
 * Firebase Authentication Service
 * Handles user authentication, role management, and auth state persistence
 */

import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile, UserRole } from "../types";

/**
 * Safe timestamp converter - handles Firestore Timestamp, Date, number, or undefined
 */
const safeToMillis = (timestamp: any): number | undefined => {
  if (!timestamp) return undefined;
  if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'number') return timestamp;
  return undefined;
};

import { ROLES } from "../types";

/**
 * Infer role from email address (Core Truth)
 * HARDENED: Supports @joe.com and @joecafe.com
 */
export const inferRoleFromEmail = (email: string): UserRole | null => {
  if (!email) return null;
  const emailLower = email.toLowerCase();
  
  // 🛡️ [STAFF-ENFORCEMENT] Only authorized domains can have Staff roles
  const isAuthorizedStaffDomain = emailLower.endsWith('@joecafe.com') || emailLower.endsWith('@joe.com');
  
  if (isAuthorizedStaffDomain) {
    if (emailLower.startsWith('admin@'))   return ROLES.ADMIN;
    if (emailLower.startsWith('cashier@')) return ROLES.CASHIER;
    if (emailLower.startsWith('server@'))  return ROLES.SERVER;
    if (emailLower.startsWith('staff@'))   return ROLES.CASHIER;
    return ROLES.CASHIER; // Default staff domain user to Cashier if prefix unknown
  }
  
  // All other domains (gmail, college domains, etc.) are strictly STUDENTS
  return ROLES.STUDENT;
};

/**
 * Get user profile from Firestore
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const email = data.email || '';
      
      const validRoles: UserRole[] = ['ADMIN', 'CASHIER', 'SERVER', 'STUDENT', 'GUEST'];
      let userRole: UserRole | null = null;
      
      // Standardize input role to uppercase for check
      const inputRole = (data.role || '').toUpperCase();
      
      if (validRoles.includes(inputRole as UserRole)) {
        userRole = inputRole as UserRole;
        
        // Data integrity fix: Ensure role matches email pattern if applicable
        const inferredRole = inferRoleFromEmail(email);
        if (inferredRole && inferredRole !== userRole) {
          console.error('🚨 Role mismatch: Email implies', inferredRole, 'but Firestore says', userRole);
          userRole = inferredRole;
          await setDoc(doc(db, "users", uid), { role: inferredRole, lastActive: serverTimestamp() }, { merge: true });
        }
      } else {
        // Not a valid staff role
        return null;
      }

      return {
        uid: data.uid || uid,
        name: data.name || 'Student member',
        email: data.email || '',
        role: userRole,
        active: data.active ?? true,
        createdAt: safeToMillis(data.createdAt) ?? Date.now(),
        lastActive: safeToMillis(data.lastActive)
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

/**
 * Google Sign-In - UNIVERSAL (Staff & Students)
 * Faster Popup Flow for mobile web
 */
export const signInWithGoogle = async (): Promise<{ user: FirebaseUser; profile: UserProfile }> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    // 🛡️ [INSTANT-HANDSHAKE] Try Popup flow first for best UX
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check for existing profile (will be auto-provisioned by listener if missing)
    let profile = await getUserProfile(user.uid);
    
    // If profile is missing (brand new user), we define it here for the immediate return
    if (!profile) {
        const email = user.email || '';
        const inferredRole = inferRoleFromEmail(email) || ROLES.STUDENT; // Default to Student for all new Google logins
        
        profile = {
          uid: user.uid,
          name: user.displayName || email.split('@')[0] || 'User',
          email: email,
          role: inferredRole,
          active: true,
          createdAt: Date.now(),
        };

        // Fire & Forget: Let the background process handle the DB write
        setDoc(doc(db, "users", user.uid), {
           ...profile,
           lastActive: serverTimestamp(),
           createdAt: serverTimestamp()
        }, { merge: true }).catch(e => console.warn("Background provision fail", e));
    }
    
    return { user, profile };
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
        // Fallback to Redirect if popup is blocked by browser
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return new Promise(() => {}); 
    }
    console.error("❌ Universal Google Login failed:", error);
    throw error;
  }
};

/**
 * Sign in with email and password (Staff Only)
 */
export const signIn = async (email: string, password: string): Promise<{ user: FirebaseUser; profile: UserProfile }> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    let userProfile = await getUserProfile(user.uid);
    
    // AUTO-PROVISIONING: If profile missing but we can infer a role (Staff), create it on the fly.
    if (!userProfile) {
      const inferredRole = inferRoleFromEmail(email);
      if (inferredRole) {
        console.log('👷 Auto-provisioning staff profile for', email);
        const now = Date.now();
        userProfile = {
          uid: user.uid,
          name: email.split('@')[0],
          email: email,
          role: inferredRole,
          active: true,
          createdAt: now,
        };
        await setDoc(doc(db, "users", user.uid), {
          ...userProfile,
          lastActive: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Still missing and not a known staff email pattern
        await firebaseSignOut(auth);
        throw new Error('ACCESS_DENIED');
      }
    }
    
    if (!userProfile.active) {
      await firebaseSignOut(auth);
      throw new Error('ACCOUNT_DEACTIVATED');
    }
    
    await setDoc(doc(db, "users", user.uid), {
      lastActive: serverTimestamp()
    }, { merge: true });
    
    return { user, profile: userProfile };
  } catch (error: any) {
    console.error("❌ Sign in error:", error);
    throw error;
  }
};

/**
 * Guest Login - Creates a persistent anonymous session
 * This ensures the session survives payment transitions and background syncs.
 */
export const signInAsGuest = async (): Promise<{ user: FirebaseUser | null; profile: UserProfile }> => {
  try {
    console.log('🛡️ Cloud-First: Attempting Firebase Anonymous Sign-in...');
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    
    // Check for existing profile (in case of returning anonymous session)
    let profile = await getUserProfile(user.uid);
    
    if (!profile) {
      const now = Date.now();
      profile = {
          uid: user.uid,
          name: 'Guest User',
          email: 'guest@joecafe.com',
          role: 'GUEST',
          active: true,
          createdAt: now,
      };
      
      await setDoc(doc(db, "users", user.uid), {
          ...profile,
          lastActive: serverTimestamp(),
          createdAt: serverTimestamp()
      }, { merge: true }).catch(e => console.warn("Silent profile sync fail", e));
    }
    
    return { user, profile };
  } catch (err: any) {
    if (err.code === 'auth/admin-restricted-operation') {
        console.warn('⚠️ Console Settings Check: Anonymous Auth is RESTRICTED in Firebase Console.');
    }
    console.warn('⚡ Fallback: Generating High-Entropy Local ID...', err.code);
    
    const localId = `ls_guest_${Math.random().toString(36).substring(2, 15)}`;
    const now = Date.now();
    const gProfile: UserProfile = {
        uid: localId,
        name: 'Guest User',
        email: 'guest@joecafe.local',
        role: 'GUEST',
        active: true,
        createdAt: now
    };
    
    return { user: null, profile: gProfile };
  }
};

/**
 * Sign out
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  }
};

import { onSnapshot as firestoreOnSnapshot, Unsubscribe } from "firebase/firestore";

/**
 * Real-time Authentication and Profile Listener
 * CORE ARCHITECTURE: Uses onSnapshot for the profile to ensure 
 * that role changes are reflected INSTANTLY in the UI.
 */
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null, profile: UserProfile | null) => void
): Unsubscribe => {
  let profileUnsub: Unsubscribe | null = null;

  const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
    // Clear previous profile listener
    if (profileUnsub) { 
      profileUnsub();
      profileUnsub = null;
    }

    if (!firebaseUser) {
      callback(null, null);
      return;
    }

    // Initialize real-time profile listener
    profileUnsub = firestoreOnSnapshot(
      doc(db, "users", firebaseUser.uid),
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const email = data.email || firebaseUser.email || '';
          const currentRole = (data.role || '').toUpperCase() as UserRole;
          
          // Role Integrity Auto-Correction
          const inferredRole = inferRoleFromEmail(email);
          if (inferredRole && inferredRole !== currentRole) {
            console.log(`🛡️ Industry-grade Auto-Correction: ${email} -> ${inferredRole}`);
            await setDoc(doc(db, "users", firebaseUser.uid), { 
              role: inferredRole, 
              lastActive: serverTimestamp() 
            }, { merge: true });
            // The snapshot listener will fire again with new data, so we don't return early
            return;
          }

          if (!data.active) {
            console.warn("🛑 Account deactivated:", email);
            await firebaseSignOut(auth);
            callback(null, null);
            return;
          }

          const profile: UserProfile = {
            uid: data.uid || firebaseUser.uid,
            name: data.name || firebaseUser.displayName || (currentRole === 'GUEST' ? 'Guest User' : 'Staff Member'),
            email: email,
            role: currentRole,
            active: data.active ?? true,
            createdAt: safeToMillis(data.createdAt) ?? Date.now(),
            lastActive: safeToMillis(data.lastActive)
          };
          callback(firebaseUser, profile);
        } else {
          // PROFILE MISSING: Auto-provision based on email pattern or guest status
          const email = firebaseUser.email || '';
          const isAnonymous = firebaseUser.isAnonymous;
          const now = Date.now();
          const inferredRole = isAnonymous ? 'GUEST' : (inferRoleFromEmail(email) || ROLES.STUDENT);
          
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            name: isAnonymous ? 'Guest User' : (firebaseUser.displayName || email.split('@')[0] || 'User'),
            email: isAnonymous ? 'guest@joecafe.com' : email,
            role: inferredRole,
            active: true,
            createdAt: now,
          };

          console.log(`📦 Auto-provisioning profile for ${email} as ${inferredRole}`);
          await setDoc(doc(db, "users", firebaseUser.uid), {
            ...newProfile,
            lastActive: serverTimestamp(),
            createdAt: serverTimestamp()
          }, { merge: true });
          
          // No need to call callback yet, once setDoc finishes, the onSnapshot will fire again
        }
      },
      (error) => {
        console.error("❌ Profile Sync Error:", error);
        callback(firebaseUser, null);
      }
    );
  });

  // Return a cleanup function that unsubscribes from both
  return () => {
    authUnsub();
    if (profileUnsub) profileUnsub();
  };
};

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (uid: string, role: UserRole): Promise<void> => {
  try {
    await setDoc(doc(db, "users", uid), {
      role,
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
};

/**
 * Toggle user active status
 */
export const toggleUserStatus = async (uid: string, active: boolean): Promise<void> => {
  try {
    await setDoc(doc(db, "users", uid), {
      active,
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error toggling user status:", error);
    throw error;
  }
};
