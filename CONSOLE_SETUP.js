/**
 * COPY THIS ENTIRE SCRIPT AND PASTE INTO BROWSER CONSOLE
 * Make sure you're on your JOE app page (localhost or deployed)
 * 
 * This will create/update all 3 staff users in Firebase Authentication and Firestore
 * Uses UPSERT pattern - safe to run multiple times
 */

(async function() {
  console.log('🚀 Starting user creation...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Import Firebase modules from your app
    const { auth, db } = await import('./firebase.js');
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = await import('firebase/auth');
    const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
    
    const users = [
      { email: 'admin@joecafe.com', password: 'joeadmin2026', name: 'JOE Admin', role: 'admin' },
      { email: 'cashier@joecafe.com', password: 'joecashier2026', name: 'Cashier Node', role: 'cashier' },
      { email: 'server@joecafe.com', password: 'joeserver2026', name: 'Server Node', role: 'server' }
    ];
    
    for (const userData of users) {
      console.log(`\n🔧 Processing: ${userData.email} (${userData.role})`);
      console.log('─────────────────────────────────────────');
      
      try {
        let userCredential;
        let isNewUser = false;
        
        // Try to create user in Firebase Authentication
        try {
          userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
          console.log(`✅ Created Firebase Auth user: ${userData.email}`);
          isNewUser = true;
        } catch (authError) {
          if (authError.code === 'auth/email-already-in-use') {
            console.log(`⚠️  User ${userData.email} already exists in Firebase Auth`);
            // Sign in to get the user UID
            userCredential = await signInWithEmailAndPassword(auth, userData.email, userData.password);
            console.log(`✅ Signed in to get UID for ${userData.email}`);
            // Sign out immediately after getting UID
            await signOut(auth);
            console.log(`✅ Signed out after getting UID`);
          } else {
            throw authError;
          }
        }
        
        const uid = userCredential.user.uid;
        const userRef = doc(db, 'users', uid);
        
        // Check if Firestore profile exists
        const userDoc = await getDoc(userRef);
        const existingData = userDoc.exists() ? userDoc.data() : null;
        
        // Prepare profile data with all required fields
        const profileData = {
          uid: uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          active: true,
          studentType: null, // Staff users don't have studentType
          createdAt: existingData?.createdAt || serverTimestamp(),
          lastActive: serverTimestamp()
        };
        
        // Create or update Firestore profile (UPSERT)
        await setDoc(userRef, profileData, { merge: true });
        
        if (userDoc.exists()) {
          console.log(`✅ Updated Firestore profile for ${userData.email}`);
        } else {
          console.log(`✅ Created Firestore profile for ${userData.email}`);
        }
        console.log(`   Role: ${profileData.role}`);
        console.log(`   Active: ${profileData.active}`);
        
        // Verify the profile was created correctly
        const verifyDoc = await getDoc(userRef);
        if (verifyDoc.exists()) {
          const verifyData = verifyDoc.data();
          console.log(`✅ Verification:`);
          console.log(`   ✓ UID: ${verifyData.uid}`);
          console.log(`   ✓ Email: ${verifyData.email}`);
          console.log(`   ✓ Name: ${verifyData.name}`);
          console.log(`   ✓ Role: ${verifyData.role}`);
          console.log(`   ✓ Active: ${verifyData.active ?? true}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to create ${userData.email}:`, error.message);
        console.error(`   Error code: ${error.code || 'unknown'}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📧 Demo Credentials:\n');
    console.log('   ADMIN PORTAL:');
    console.log('   📧 Email: admin@joecafe.com');
    console.log('   🔑 Password: joeadmin2026');
    console.log('   🎯 Portal: Admin Dashboard\n');
    console.log('   CASHIER PORTAL:');
    console.log('   📧 Email: cashier@joecafe.com');
    console.log('   🔑 Password: joecashier2026');
    console.log('   🎯 Portal: Cashier Dashboard\n');
    console.log('   SERVER PORTAL:');
    console.log('   📧 Email: server@joecafe.com');
    console.log('   🔑 Password: joeserver2026');
    console.log('   🎯 Portal: Serving Counter\n');
    console.log('💡 You can now login with these credentials!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.error('Error details:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Make sure you\'re on your app page (localhost or deployed)');
    console.log('   2. Check that Firebase is initialized');
    console.log('   3. Verify Firestore security rules allow user creation');
    console.log('   4. Check browser console for detailed error messages\n');
  }
})();
