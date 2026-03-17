/**
 * Quick User Initialization Script
 * Copy and paste this ENTIRE script into your browser console
 * Make sure you're on your JOE app page first
 */

(async function initUsers() {
  console.log('🚀 Starting user initialization...');
  
  try {
    // Import Firebase modules (these will be available from your app)
    // We'll access them through dynamic imports from your app's context
    
    // Access Firebase from window if exposed, or import directly
    let auth, db;
    
    try {
      // Try to access from app's Firebase instance
      const firebaseModule = await import('/firebase.js');
      auth = firebaseModule.auth;
      db = firebaseModule.db;
    } catch {
      // Alternative: import from firebase package
      const { getAuth, getFirestore } = await import('firebase/auth');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const firebaseApp = await import('/firebase.js');
      auth = getAuth(firebaseApp.default);
      db = getFirestore(firebaseApp.default);
    }
    
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc: firestoreDoc, setDoc: firestoreSetDoc, serverTimestamp } = await import('firebase/firestore');
    
    const users = [
      { email: 'admin@joecafe.com', password: 'joeadmin2026', name: 'JOE Admin', role: 'admin' },
      { email: 'cashier@joecafe.com', password: 'joecashier2026', name: 'Cashier Node', role: 'cashier' },
      { email: 'server@joecafe.com', password: 'joeserver2026', name: 'Server Node', role: 'server' }
    ];
    
    for (const userData of users) {
      try {
        // Try to create user
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        console.log(`✅ Created user: ${userData.email}`);
        
        // Create user profile in Firestore
        await firestoreSetDoc(firestoreDoc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          active: true,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp()
        });
        
        console.log(`✅ Created profile for ${userData.email} (${userData.role})`);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️ User ${userData.email} already exists in Authentication`);
          // Try to update Firestore profile anyway
          // But we'd need the UID - can't get it without signing in
          console.log(`💡 Sign in manually and update Firestore with role: ${userData.role}`);
        } else {
          console.error(`❌ Failed to create ${userData.email}:`, error.message);
        }
      }
    }
    
    console.log('✅ User initialization complete!');
    console.log('Now you can login with:');
    console.log('  - admin@joecafe.com / joeadmin2026');
    console.log('  - cashier@joecafe.com / joecashier2026');
    console.log('  - server@joecafe.com / joeserver2026');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.log('💡 Try using Firebase Console method instead (see SETUP_QUICK_START.md)');
  }
})();
