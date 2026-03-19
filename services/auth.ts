/**
 * Firebase Authentication Service
 * Handles user authentication, role management, and auth state persistence
 */

import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  // Use Firebase default persistence (local) for web
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
  
  // STAFF Patterns: Allow any domain for these specific prefix-based staff accounts
  // or specifically @joecafe.com and @joe.com
  const isStaffDomain = emailLower.endsWith('@joecafe.com') || emailLower.endsWith('@joe.com');
  
  if (isStaffDomain) {
    if (emailLower.startsWith('admin@'))   return ROLES.ADMIN;
    if (emailLower.startsWith('cashier@')) return ROLES.CASHIER;
    if (emailLower.startsWith('server@'))  return ROLES.SERVER;
  }
  
  return null;
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
 * Google Sign-In - FOR STAFF ONLY
 */
export const signInWithGoogle = async (): Promise<{ user: FirebaseUser; profile: UserProfile }> => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if profile exists
    let profile = await getUserProfile(user.uid);
    
    // CASE 1: NEW USER or MISSING PROFILE -> Auto-create as STUDENT
    if (!profile) {
      const now = Date.now();
      const newProfile: UserProfile = {
        uid: user.uid,
        name: user.displayName || 'Student',
        email: user.email || '',
        role: 'STUDENT',
        active: true,
        createdAt: now,
      };
      
      // Perform write but don't wait for it to return the profile again
      // The onAuthStateChange listener will pick this up or we return it directly
      await setDoc(doc(db, "users", user.uid), {
        ...newProfile,
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
      
      profile = newProfile;
    }
    
    if (!profile) {
      throw new Error("FAILED_TO_CREATE_PROFILE");
    }
    
    if (!profile.active) {
      await firebaseSignOut(auth);
      throw new Error("ACCOUNT_DEACTIVATED");
    }

    return { user, profile };
  } catch (error: any) {
    console.error('❌ signInWithGoogle failed:', error);
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
 * Guest Login - Creates a temporary session profile
 */
export const signInAsGuest = async (): Promise<{ user: null; profile: UserProfile }> => {
  // We use a mock guest profile as we don't want to create Firebase Auth users for every guest
  // unless the system actually needs a signed-in anonymous user. 
  // For "limit access (ordering only)", a mock profile is faster.
  const guestId = `guest_${Math.random().toString(36).substr(2, 9)}`;
  const guestProfile: UserProfile = {
    uid: guestId,
    name: 'Guest User',
    email: 'guest@joecafe.com',
    role: 'GUEST',
    active: true,
    createdAt: Date.now()
  };
  
  return { user: null, profile: guestProfile };
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
            name: data.name || firebaseUser.displayName || 'Staff Member',
            email: email,
            role: currentRole,
            active: data.active ?? true,
            createdAt: safeToMillis(data.createdAt) ?? Date.now(),
            lastActive: safeToMillis(data.lastActive)
          };
          callback(firebaseUser, profile);
        } else {
          // PROFILE MISSING: Auto-provision based on email pattern
          const email = firebaseUser.email || '';
          const now = Date.now();
          const inferredRole = inferRoleFromEmail(email) || ROLES.STUDENT;
          
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || email.split('@')[0] || 'User',
            email: email,
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
