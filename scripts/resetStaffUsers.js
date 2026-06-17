/**
 * RESET STAFF USERS SCRIPT
 * 
 * This script:
 * 1. Deletes existing cashier & server users from Firebase Auth
 * 2. Deletes their Firestore profiles
 * 3. Creates fresh users with proper roles
 * 
 * Run: node scripts/resetStaffUsers.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  fetchSignInMethodsForEmail
} = require('firebase/auth');
const { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  serverTimestamp 
} = require('firebase/firestore');

// Firebase config - UPDATE WITH YOUR CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const staffUsers = [
  {
    email: 'cashier@cse.com',
    password: 'cashier123',
    name: 'Cashier Node',
    role: 'cashier'
  },
  {
    email: 'server@cse.com',
    password: 'server123',
    name: 'Server Node',
    role: 'server'
  }
];

async function deleteUserFromAuth(email) {
  try {
    // Check if user exists
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods.length === 0) {
      console.log(`ℹ️  User ${email} does not exist in Auth`);
      return null;
    }

    // Sign in to get user object
    const userCredential = await signInWithEmailAndPassword(auth, email, 'temp');
    const user = userCredential.user;
    
    // Delete user
    await deleteUser(user);
    console.log(`✅ Deleted ${email} from Firebase Auth`);
    
    return user.uid;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`ℹ️  User ${email} not found in Auth`);
      return null;
    } else if (error.code === 'auth/wrong-password') {
      // User exists but we don't know password - try to get UID another way
      console.log(`⚠️  Cannot delete ${email} - wrong password. Please delete manually from Firebase Console.`);
      return null;
    } else {
      console.error(`❌ Error deleting ${email} from Auth:`, error.message);
      return null;
    }
  }
}

async function deleteUserFromFirestore(uid) {
  if (!uid) return;
  
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      await deleteDoc(userRef);
      console.log(`✅ Deleted user profile ${uid} from Firestore`);
    } else {
      console.log(`ℹ️  User profile ${uid} not found in Firestore`);
    }
  } catch (error) {
    console.error(`❌ Error deleting user profile from Firestore:`, error.message);
  }
}

async function createUser(email, password, name, role) {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`✅ Created Firebase Auth user: ${email}`);
    
    const uid = userCredential.user.uid;
    
    // Create user profile in Firestore
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid: uid,
      email: email,
      name: name,
      role: role,
      active: true,
      studentType: null, // Staff users don't have studentType
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    });
    
    console.log(`✅ Created Firestore profile for ${email} with role: ${role}`);
    
    // Sign out immediately
    await signOut(auth);
    
    return uid;
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`⚠️  User ${email} already exists - skipping creation`);
      return null;
    } else {
      console.error(`❌ Error creating ${email}:`, error.message);
      throw error;
    }
  }
}

async function resetStaffUsers() {
  console.log('🔄 Starting staff user reset...\n');
  
  // Step 1: Delete existing users
  console.log('📋 STEP 1: Deleting existing staff users...\n');
  for (const userData of staffUsers) {
    console.log(`\n🔧 Processing: ${userData.email}`);
    console.log('─────────────────────────────────────────');
    
    // Delete from Auth
    const uid = await deleteUserFromAuth(userData.email);
    
    // Delete from Firestore
    if (uid) {
      await deleteUserFromFirestore(uid);
    }
  }
  
  // Wait a moment for deletions to propagate
  console.log('\n⏳ Waiting for deletions to propagate...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 2: Create fresh users
  console.log('\n📋 STEP 2: Creating fresh staff users...\n');
  for (const userData of staffUsers) {
    console.log(`\n🔧 Creating: ${userData.email} (${userData.role})`);
    console.log('─────────────────────────────────────────');
    
    try {
      await createUser(userData.email, userData.password, userData.name, userData.role);
    } catch (error) {
      console.error(`❌ Failed to create ${userData.email}:`, error.message);
    }
  }
  
  console.log('\n✅ Staff user reset complete!');
  console.log('\n📝 Login credentials:');
  console.log('  - cashier@cse.com / cashier123');
  console.log('  - server@cse.com / server123');
  console.log('\n⚠️  IMPORTANT: Update firebaseConfig in this script with your actual Firebase config!');
}

// Run the script
resetStaffUsers()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
