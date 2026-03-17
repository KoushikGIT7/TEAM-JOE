/**
 * Staff Users Setup Script
 * Creates cashier and server users in Firebase Auth + Firestore
 * 
 * USAGE:
 * 1. Open your app in browser (localhost or deployed)
 * 2. Open browser console (F12)
 * 3. Copy and paste this ENTIRE script
 * 4. Press Enter
 * 
 * This will create/update:
 * - cashier@joe.com / cashier123 (Cashier portal)
 * - server@joe.com / server123 (Server portal)
 */

(async function setupStaffUsers() {
  console.log('🚀 Starting Staff Users Setup...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // Import Firebase modules
    const { auth, db } = await import('../firebase.js');
    const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
    
    // Staff users to create/update
    const staffUsers = [
      {
        email: 'cashier@joecafe.com',
        password: 'joecashier2026',
        name: 'Cashier Node',
        role: 'cashier',
        description: 'Handles cash payment approvals'
      },
      {
        email: 'server@joecafe.com',
        password: 'joeserver2026',
        name: 'Server Node',
        role: 'server',
        description: 'Handles order serving and QR scanning'
      }
    ];
    
    console.log(`\n📋 Setting up ${staffUsers.length} staff users...\n`);
    
    for (const userData of staffUsers) {
      console.log(`\n🔧 Processing: ${userData.email} (${userData.role})`);
      console.log('─────────────────────────────────────────');
      
      try {
        let userCredential;
        let isNewUser = false;
        
        // Try to create user in Firebase Auth
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
            const { signOut } = await import('firebase/auth');
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
          console.log(`   Role: ${profileData.role}`);
          console.log(`   Active: ${profileData.active}`);
        } else {
          console.log(`✅ Created Firestore profile for ${userData.email}`);
          console.log(`   Role: ${profileData.role}`);
          console.log(`   Active: ${profileData.active}`);
          console.log(`   Description: ${userData.description}`);
        }
        
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
        } else {
          console.error(`❌ Profile verification failed for ${userData.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to setup ${userData.email}:`, error.message);
        console.error(`   Error code: ${error.code || 'unknown'}`);
        if (error.code === 'permission-denied') {
          console.error(`   💡 Check Firestore security rules - user creation might be restricted`);
        }
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Staff Users Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📧 Demo Credentials:\n');
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
