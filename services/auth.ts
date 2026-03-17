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

/**
 * Infer role from email address (fallback for incorrect Firestore data)
 */
const inferRoleFromEmail = (email: string): UserRole | null => {
  if (!email) return null;
  const emailLower = email.toLowerCase();
  if (emailLower.includes('admin@joecafe.com') || emailLower === 'admin@joecafe.com') return 'ADMIN';
  if (emailLower.includes('cashier@joecafe.com') || emailLower === 'cashier@joecafe.com') return 'CASHIER';
  if (emailLower.includes('server@joecafe.com') || emailLower === 'server@joecafe.com') return 'SERVER';
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
        name: data.name || 'Staff member',
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
      console.log('🆕 Creating new student profile for:', user.email);
      const newProfile: Partial<UserProfile> = {
        uid: user.uid,
        name: user.displayName || 'Student',
        email: user.email || '',
        role: 'STUDENT',
        active: true,
        createdAt: Date.now(),
      };
      
      await setDoc(doc(db, "users", user.uid), {
        ...newProfile,
        lastActive: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      profile = await getUserProfile(user.uid);
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
    
    const userProfile = await getUserProfile(user.uid);
    
    if (!userProfile) {
      await firebaseSignOut(auth);
      throw new Error('ACCESS_DENIED');
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

/**
 * Listen to authentication state changes
 * STRICT RBAC: If role invalid or profile missing, logs out immediately
 */
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null, profile: UserProfile | null) => void
): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const profile = await getUserProfile(firebaseUser.uid);

        if (!profile) {
          console.warn("⚠️ No profile found for", firebaseUser.email);
          // If we want to allow students who were somehow created without profiles:
          // But signInWithGoogle handles this now.
          callback(firebaseUser, null);
          return;
        }

        const allowedRoles: UserRole[] = ['ADMIN', 'CASHIER', 'SERVER', 'STUDENT'];
        if (!allowedRoles.includes(profile.role)) {
          console.error("🛑 INVALID ROLE detected for", firebaseUser.email);
          await firebaseSignOut(auth);
          callback(null, null);
          return;
        }

        callback(firebaseUser, profile);
      } catch (error) {
        console.error("❌ onAuthStateChange: Error during RBAC check", error);
        await firebaseSignOut(auth);
        callback(null, null);
      }
    } else {
      callback(null, null);
    }
  });
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
