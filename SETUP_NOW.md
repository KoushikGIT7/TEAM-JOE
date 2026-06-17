# Quick Setup - Create Users NOW

## ⚡ Fastest Method - Copy/Paste into Browser Console

### Step 1: Open Your App
Open your CSE app in browser (localhost:5174 or your deployed URL)

### Step 2: Open Browser Console
- Press `F12` OR
- Right-click → **Inspect** → **Console** tab

### Step 3: Copy & Paste This Code

Copy the **ENTIRE** content from `CONSOLE_SETUP.js` file and paste into console, then press Enter:

```javascript
(async function() {
  console.log('🚀 Starting user creation...');
  
  try {
    // Import Firebase modules from your app
    const { auth, db } = await import('./firebase.js');
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    
    const users = [
      { email: 'admin@cse.com', password: 'admin123', name: 'CSE Admin', role: 'admin' },
      { email: 'cashier@cse.com', password: 'cashier123', name: 'Cashier Node', role: 'cashier' },
      { email: 'server@cse.com', password: 'server123', name: 'Server Node', role: 'server' }
    ];
    
    for (const userData of users) {
      try {
        // Create user in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        console.log(`✅ Created auth user: ${userData.email}`);
        
        // Create user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          active: true,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp()
        });
        
        console.log(`✅ Created Firestore profile for ${userData.email} (role: ${userData.role})`);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️ User ${userData.email} already exists in Authentication`);
        } else {
          console.error(`❌ Failed to create ${userData.email}:`, error.message);
        }
      }
    }
    
    console.log('✅ Setup complete!');
    console.log('You can now login with:');
    console.log('  📧 admin@cse.com / 🔑 admin123');
    console.log('  📧 cashier@cse.com / 🔑 cashier123');
    console.log('  📧 server@cse.com / 🔑 server123');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.log('💡 Make sure you\'re on the app page and Firebase is initialized');
  }
})();
```

### Step 4: Check Console Output

You should see:
```
✅ Created auth user: admin@cse.com
✅ Created Firestore profile for admin@cse.com (role: admin)
✅ Created auth user: cashier@cse.com
✅ Created Firestore profile for cashier@cse.com (role: cashier)
✅ Created auth user: server@cse.com
✅ Created Firestore profile for server@cse.com (role: server)
✅ Setup complete!
```

### Step 5: Test Login

Now try logging in with:
- **Email**: `admin@cse.com` | **Password**: `admin123`
- **Email**: `cashier@cse.com` | **Password**: `cashier123`
- **Email**: `server@cse.com` | **Password**: `server123`

## ✅ Done!

Menu items will auto-initialize when you first open the app (via `initializeMenu()` function).

---

**Note**: If the script fails, use Firebase Console method (see `FIREBASE_SETUP_INSTRUCTIONS.md`)
