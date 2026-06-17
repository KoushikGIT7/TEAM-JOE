# Quick Setup Guide - Firebase Initialization

## Problem
You can't login because staff users (admin, cashier, server) and menu items haven't been created in Firebase yet.

## Solution - Run This in Browser Console

### Step 1: Open Your App
1. Open your CSE app in browser
2. Open **Browser Console** (F12 or Right-click → Inspect → Console tab)

### Step 2: Copy & Paste This Script

Copy the entire code below and paste it into the console, then press Enter:

```javascript
// Quick Firebase Setup Script
(async function() {
  console.log('🚀 Starting Firebase setup...');
  
  // Import Firebase modules (adjust path if needed)
  const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
  const { doc, setDoc, getDoc, serverTimestamp, writeBatch, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  
  // You'll need to access your Firebase instance - use window if exposed, or import from your app
  // For now, try accessing from window or use your app's firebase instance
  console.log('⚠️ Note: Make sure Firebase is initialized. Adjust imports as needed.');
  
  // Better approach: Use your app's existing Firebase instance
  // Open DevTools → Sources → Find your firebase.ts file
  // Or use the app's existing Firebase initialization
  
  console.log('✅ Setup script ready. Run the functions below individually:');
})();
```

### Step 3: Use App's Firebase Instance

**Better approach** - Use your app's Firebase directly:

1. **In Console, type:**
```javascript
// Access Firebase from your app (adjust if your app exposes it differently)
const { auth, db } = await import('./firebase.js');
```

2. **Then run user creation:**
```javascript
const { createUserWithEmailAndPassword } = await import('firebase/auth');
const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

// Create admin user
try {
  const admin = await createUserWithEmailAndPassword(auth, 'admin@cse.com', 'admin123');
  await setDoc(doc(db, 'users', admin.user.uid), {
    uid: admin.user.uid,
    email: 'admin@cse.com',
    name: 'CSE Admin',
    role: 'admin',
    active: true,
    createdAt: serverTimestamp()
  });
  console.log('✅ Admin created');
} catch(e) { console.log('Admin exists or error:', e.message); }

// Create cashier
try {
  const cashier = await createUserWithEmailAndPassword(auth, 'cashier@cse.com', 'cashier123');
  await setDoc(doc(db, 'users', cashier.user.uid), {
    uid: cashier.user.uid,
    email: 'cashier@cse.com',
    name: 'Cashier Node',
    role: 'cashier',
    active: true,
    createdAt: serverTimestamp()
  });
  console.log('✅ Cashier created');
} catch(e) { console.log('Cashier exists or error:', e.message); }

// Create server
try {
  const server = await createUserWithEmailAndPassword(auth, 'server@cse.com', 'server123');
  await setDoc(doc(db, 'users', server.user.uid), {
    uid: server.user.uid,
    email: 'server@cse.com',
    name: 'Server Node',
    role: 'server',
    active: true,
    createdAt: serverTimestamp()
  });
  console.log('✅ Server created');
} catch(e) { console.log('Server exists or error:', e.message); }
```

## Alternative: Use Firebase Console (Easier)

### Create Users Manually:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **csecafe-a7fff**
3. Go to **Authentication** → **Users** → **Add user**
4. Create these 3 users:

| Email | Password | Role |
|-------|----------|------|
| admin@cse.com | admin123 | admin |
| cashier@cse.com | cashier123 | cashier |
| server@cse.com | server123 | server |

5. Then go to **Firestore Database** → Create collection: `users`
6. For each user, create a document with their UID (from Authentication) with fields:
   ```json
   {
     "uid": "[user-uid]",
     "email": "admin@cse.com",
     "name": "CSE Admin",
     "role": "admin",
     "active": true,
     "createdAt": [current timestamp]
   }
   ```

### Menu Items

Menu items will auto-initialize when you first open the app (via `initializeMenu()` function in App.tsx).

## Test Login

After setup, try logging in with:
- **Email**: `admin@cse.com`
- **Password**: `admin123`

## Need Help?

See `FIREBASE_SETUP_INSTRUCTIONS.md` for detailed instructions.
