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
import { registerFCMToken } from "./fcm";

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
  if (emailLower.includes('admin@joe.com') || emailLower === 'admin@joe.com') return 'admin';
  if (emailLower.includes('cashier@joe.com') || emailLower === 'cashier@joe.com') return 'cashier';
  if (emailLower.includes('server@joe.com') || emailLower === 'server@joe.com') return 'server';
  return null; // Cannot infer from email
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
      
      // Validate role - ensure it's a valid UserRole
      // CRITICAL: Check email pattern if role doesn't match (data integrity fix)
      const validRoles: UserRole[] = ['student', 'cashier', 'server', 'admin'];
      let userRole: UserRole;
      
      if (data.role && validRoles.includes(data.role)) {
        userRole = data.role as UserRole;
        
        // CRITICAL FIX: If role in Firestore doesn't match email pattern, override it
        // This fixes cases where server@joe.com has role: "student" in Firestore
        const inferredRole = inferRoleFromEmail(email);
        if (inferredRole && inferredRole !== userRole) {
          console.error('🚨 getUserProfile: CRITICAL ROLE MISMATCH DETECTED!');
          console.error('   Email:', email);
          console.error('   Firestore role:', userRole);
          console.error('   Inferred role from email:', inferredRole);
          console.error('   OVERRIDING role to match email pattern');
          console.error('   This user should have role:', inferredRole, 'but has:', userRole);
          
          // Override with inferred role
          userRole = inferredRole;
          
          // Update Firestore to fix the data (async, don't wait)
          setDoc(doc(db, "users", uid), {
            role: inferredRole,
            lastActive: serverTimestamp()
          }, { merge: true })
          .then(() => {
            console.log('✅ Successfully updated role in Firestore to:', inferredRole);
          })
          .catch(err => {
            console.error('❌ Failed to update role in Firestore:', err);
            console.error('   Please run fixStaffRoles.js script to fix this manually');
          });
        }
      } else if (!data.role) {
        // Role is missing - try to infer from email
        const inferredRole = inferRoleFromEmail(email);
        if (inferredRole) {
          console.warn('⚠️ getUserProfile: Role missing, inferring from email:', inferredRole);
          userRole = inferredRole;
          
          // Update Firestore with inferred role (async, don't wait)
          setDoc(doc(db, "users", uid), {
            role: inferredRole,
            lastActive: serverTimestamp()
          }, { merge: true }).catch(err => {
            console.error('❌ Failed to update role in Firestore:', err);
          });
        } else {
          // Cannot infer - default to student
          console.warn('⚠️ getUserProfile: Role missing and cannot infer from email, defaulting to student');
          userRole = 'student';
        }
      } else {
        // Role exists but is invalid - try to infer from email
        const inferredRole = inferRoleFromEmail(email);
        if (inferredRole) {
          console.error('❌ getUserProfile: Invalid role in Firestore:', data.role);
          console.error('   Using inferred role from email:', inferredRole);
          userRole = inferredRole;
          
          // Update Firestore with inferred role (async, don't wait)
          setDoc(doc(db, "users", uid), {
            role: inferredRole,
            lastActive: serverTimestamp()
          }, { merge: true }).catch(err => {
            console.error('❌ Failed to update role in Firestore:', err);
          });
        } else {
          // Cannot infer - default to student
          console.error('❌ getUserProfile: Invalid role in Firestore:', data.role);
          console.error('   Valid roles:', validRoles);
          console.error('   Document data:', data);
          userRole = 'student';
        }
      }
      
      return {
        uid: data.uid || uid,
        name: data.name || 'Unknown User',
        email: data.email || '',
        role: userRole,
        studentType: data.studentType,
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
 * Create or update user profile in Firestore (UPSERT - idempotent)
 * Uses setDoc with merge: true - safe for first login and updates
 * NEVER throws "document not found" - creates if missing
 */
export const createUserProfile = async (
  uid: string,
  email: string,
  name: string,
  role: UserRole = 'student',
  studentType?: 'dayScholar' | 'hosteller'
): Promise<void> => {
  try {
    const userRef = doc(db, "users", uid);
    
    // UPSERT: merge: true creates if missing, updates if exists
    // This is safe for first login (creates) and subsequent logins (updates)
    await setDoc(userRef, {
      uid,
      email,
      name,
      role,
      studentType: studentType || null,
      active: true,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error: any) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
};

/**
 * Detect if we're on a mobile platform (native app or mobile browser)
 */
const isMobilePlatform = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check if running in Cordova/Capacitor (native mobile app)
  if ((window as any).cordova || (window as any).Capacitor) {
    return true;
  }
  
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent.toLowerCase();
  const mobilePatterns = [
    /android/i,
    /webos/i,
    /iphone/i,
    /ipad/i,
    /ipod/i,
    /blackberry/i,
    /windows phone/i,
    /mobile/i,
    /mobi/i
  ];
  
  return mobilePatterns.some(pattern => pattern.test(userAgent));
};

/**
 * Google Sign-In with platform-aware method selection
 * - Uses popup for desktop/web
 * - Uses redirect for mobile/APK (required for native platforms)
 * Does NOT navigate - lets onAuthStateChanged handle routing
 */
export const signInWithGoogle = async (): Promise<{ user: FirebaseUser; profile: UserProfile }> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    // Detect if running in a NATIVE app wrapper (Cordova / Capacitor)
    // For ALL web contexts (desktop browser, mobile browser) use popup.
    // Redirect causes a page reload which shows the splash screen loop.
    const isNativeApp = !!(
      (window as any).cordova || 
      (window as any).Capacitor?.isNativePlatform?.()
    );
    
    let result;
    
    if (isNativeApp) {
      // True native app: use redirect (popup won't work in WebView)
      console.log('📱 Native app detected — using redirect sign-in');
      await signInWithRedirect(auth, provider);
      return new Promise(() => {}); // Page will reload; auth handler picks it up
    } else {
      // Web (desktop or mobile browser): always use popup
      console.log('🪟 Web context — using popup sign-in');
      result = await signInWithPopup(auth, provider);
    }
    
    const user = result.user;
    console.log('🔐 signInWithGoogle: Auth successful for', user.email);
    
    // Ensure profile exists in Firestore
    let profile = await getUserProfile(user.uid);
    
    if (!profile) {
      console.log('📝 signInWithGoogle: Creating new user profile for', user.email);
      await createUserProfile(
        user.uid,
        user.email || '',
        user.displayName || 'Student',
        'student'
      );
      profile = await getUserProfile(user.uid);
    }
    
    if (!profile) {
      // Fallback in-memory profile
      console.warn('⚠️ signInWithGoogle: Profile creation failed, using fallback');
      profile = {
        uid: user.uid,
        name: user.displayName || 'Student',
        email: user.email || '',
        role: 'student',
        active: true,
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
    }
    
    console.log('✅ signInWithGoogle: Complete:', { email: profile.email, role: profile.role });
    
    // DO NOT NAVIGATE — onAuthStateChanged handles routing
    return { user, profile };
  } catch (error: any) {
    console.error('❌ signInWithGoogle failed:', error);
    throw error;
  }
};


/**
 * Legacy: Google Sign-In with redirect (kept for compatibility)
 * @deprecated Use signInWithGoogle instead
 */
export const signInWithGoogleRedirect = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(auth, provider);
};

/**
 * Sign in with email and password
 * OPTIMIZED FOR SPEED: Single getDoc read, no retries
 * Returns both user and profile for immediate routing
 */
export const signIn = async (email: string, password: string): Promise<{ user: FirebaseUser; profile: UserProfile }> => {
  try {
    // Step 1: Authenticate with Firebase (fast)
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('🔐 signIn: Firebase auth successful for', email);
    
    // Step 2: Fetch profile with SINGLE read (no retries for speed)
    const userProfile = await getUserProfile(user.uid);
    
    // Step 3: Validate profile exists (fail fast)
    if (!userProfile) {
      // Check if this is a staff email - if so, don't auto-create
      const isStaffEmail = email.includes('@joe.com') && 
                           (email.includes('cashier') || email.includes('server') || email.includes('admin'));
      
      if (isStaffEmail) {
        throw new Error('PROFILE_MISSING');
      }
      
      // For non-staff emails, profile should exist - this is an error
      throw new Error('PROFILE_MISSING');
    }
    
    // Step 4: Validate role exists (fail fast)
    if (!userProfile.role) {
      throw new Error('PROFILE_INCOMPLETE');
    }
    
    // Step 5: Validate role is valid
    const validRoles: UserRole[] = ['admin', 'cashier', 'server', 'student'];
    if (!validRoles.includes(userProfile.role)) {
      throw new Error('ROLE_DENIED');
    }
    
    // Step 6: Validate account is active
    if (!userProfile.active) {
      throw new Error('ACCOUNT_DEACTIVATED');
    }
    
    // Step 7: Update last active timestamp (async, don't wait)
    setDoc(doc(db, "users", user.uid), {
      lastActive: serverTimestamp()
    }, { merge: true }).catch(err => {
      console.warn('⚠️ Failed to update lastActive:', err);
    });
    
    console.log('✅ signIn: Complete - returning user and profile:', {
      email: userProfile.email,
      role: userProfile.role
    });
    
    return { user, profile: userProfile };
  } catch (error: any) {
    console.error("❌ Sign in error:", error);
    // Re-throw Firebase errors as-is for error mapping
    throw error;
  }
};

/**
 * Sign up new user
 */
export const signUp = async (
  email: string,
  password: string,
  name: string,
  role: UserRole = 'student',
  studentType?: 'dayScholar' | 'hosteller'
): Promise<FirebaseUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    await createUserProfile(userCredential.user.uid, email, name, role, studentType);
    return userCredential.user;
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
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

/**
 * Sign in as guest (student mode)
 */
export const signInAsGuest = async (name: string, studentType?: 'dayScholar' | 'hosteller'): Promise<UserProfile> => {
  // For guest mode, create a temporary profile
  // In production, you might want to use anonymous auth
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const guestProfile: UserProfile = {
    uid: guestId,
    name,
    email: `${guestId}@guest.joe.com`,
    role: 'student',
    studentType,
    active: true,
    createdAt: Date.now()
  };

  return guestProfile;
};

/**
 * Listen to authentication state changes
 * Returns user profile with role information
 * Handles Firestore read failures gracefully
 * Handles redirect results from mobile sign-in
 * Retries profile fetch if needed for server/cashier users
 */
export const onAuthStateChange = (
  callback: (user: FirebaseUser | null, profile: UserProfile | null) => void
): (() => void) => {
  // Handle redirect result from signInWithRedirect (mobile)
  // This needs to be called ONCE when the page loads after redirect
  let redirectResultHandled = false;
  
  // Check for redirect result immediately
  if (!redirectResultHandled) {
    redirectResultHandled = true;
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('✅ getRedirectResult: Got result from Google redirect:', result.user.email);
          // User is already authenticated - onAuthStateChanged will pick it up
          // Just ensure the profile is created
          const user = result.user;
          createUserProfile(user.uid, user.email || '', user.displayName || 'Student', 'student')
            .then(() => {
              console.log('✅ Profile ensured for redirect result');
            })
            .catch((err) => {
              console.error('⚠️ Failed to ensure profile for redirect result:', err);
              // Continue anyway - onAuthStateChanged will handle it
            });
        }
      })
      .catch((error) => {
        console.error('⚠️ getRedirectResult error:', error);
        // Ignore - might be during initial load without redirect
      });
  }
  
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        let profile: UserProfile | null = await getUserProfile(firebaseUser.uid);

        // Auto-create profile if missing
        if (!profile) {
          await createUserProfile(firebaseUser.uid, firebaseUser.email || '', firebaseUser.displayName || 'Student', 'student');
          profile = await getUserProfile(firebaseUser.uid);
        }

        // Register FCM token for push notifications (e.g. "Your order is ready for pickup")
        registerFCMToken(firebaseUser.uid).catch(() => {});

        callback(firebaseUser, profile);
      } catch (error) {
        // Firestore read failed - log but don't block auth or routing
        console.error("❌ onAuthStateChange: Failed to fetch user profile:", error);

        // FALLBACK: construct an in-memory student profile so routing can proceed
        const fallbackProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'Student',
          email: firebaseUser.email || '',
          role: 'student',
          active: true,
          createdAt: Date.now(),
          lastActive: Date.now(),
        };

        // Try to upsert this fallback profile to Firestore in the background (non-blocking)
        createUserProfile(
          firebaseUser.uid,
          fallbackProfile.email,
          fallbackProfile.name,
          fallbackProfile.role
        ).catch((err) => {
          console.error('❌ onAuthStateChange: Failed to upsert fallback profile:', err);
        });

        // Continue with authenticated user + fallback profile so the app can route out of Welcome
        callback(firebaseUser, fallbackProfile);
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
