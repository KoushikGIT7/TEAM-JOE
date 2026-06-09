import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { UserProfile } from "../types";

let recaptchaVerifier: RecaptchaVerifier | null = null;

export const setupRecaptcha = (containerId: string) => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      },
      'expired-callback': () => {
        // Response expired. Ask user to solve reCAPTCHA again.
        recaptchaVerifier = null;
      }
    });
  }
  return recaptchaVerifier;
};

export const sendPhoneOTP = async (phoneNumber: string, containerId: string): Promise<ConfirmationResult> => {
  try {
    const verifier = setupRecaptcha(containerId);
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
    return confirmationResult;
  } catch (error) {
    console.error("Error sending OTP:", error);
    // Reset verifier on error so user can try again
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    throw error;
  }
};

export const verifyPhoneOTP = async (confirmationResult: ConfirmationResult, otp: string): Promise<{ user: FirebaseUser, profile: UserProfile }> => {
  try {
    const result = await confirmationResult.confirm(otp);
    const user = result.user;
    
    // Check if user exists or create new one
    const profile = await handlePhoneUserFirestore(user);
    
    return { user, profile };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
};

export const handlePhoneUserFirestore = async (user: FirebaseUser): Promise<UserProfile> => {
  const userRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    // Existing user: Update lastLoginAt and return existing profile
    await setDoc(userRef, {
      lastActive: serverTimestamp(),
      lastLoginAt: serverTimestamp() // Explicit requirement
    }, { merge: true });
    
    const data = userDoc.data();
    return {
      uid: data.uid || user.uid,
      name: data.name || 'Student member',
      email: data.email || '',
      role: data.role || 'STUDENT',
      active: data.active ?? true,
      createdAt: data.createdAt?.toMillis?.() || Date.now(),
      lastActive: Date.now()
    } as UserProfile;
  } else {
    // New user: Create complete document as requested
    // Note: 'name' and 'phoneNumber' might be stored temporarily in memory or we can just 
    // rely on the default and update it from the UI immediately after. 
    // To ensure exact strict creation, we provide default values here, but the UI should update it.
    // Alternatively, the UI can call a specific creation function, but this is safer as a fallback.
    
    const now = Date.now();
    const newProfile = {
      uid: user.uid,
      name: "Student", // Will be updated by UI right after
      phoneNumber: user.phoneNumber || "",
      authProvider: "phone",
      role: "STUDENT",
      walletBalance: 0,
      walletEnabled: true,
      regularCustomer: false,
      notificationEnabled: false,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      lastActive: serverTimestamp()
    };
    
    await setDoc(userRef, newProfile, { merge: true });
    
    return {
      uid: user.uid,
      name: newProfile.name,
      email: "",
      role: "STUDENT",
      active: true,
      createdAt: now,
      lastActive: now
    } as UserProfile;
  }
};

/**
 * Call this from the UI right after successful phone login for NEW users
 * to ensure their name is saved correctly from the input form.
 */
export const updatePhoneUserName = async (uid: string, name: string, phoneNumber: string) => {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    name: name,
    phoneNumber: phoneNumber,
    updatedAt: serverTimestamp()
  }, { merge: true });
};
