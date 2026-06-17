# Firebase Setup Instructions

## Problem
After migrating to Firebase, you need to:
1. Create initial staff users (admin, cashier, server) in Firebase Authentication
2. Initialize menu items in Firestore
3. Set up initial inventory

## Solution - Quick Setup

### Option 1: Browser Console (Recommended)

1. **Open your app in browser**
2. **Open browser console** (F12 or Right-click → Inspect → Console)
3. **Copy and run this code:**

```javascript
// Import initializeFirebase function
const { initializeFirebase } = await import('./scripts/initializeFirebase.js');

// Run initialization
const result = await initializeFirebase();
console.log('Setup result:', result);
```

Or run this simpler version directly:

```javascript
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, writeBatch, collection, getDocs } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { INITIAL_MENU, DEFAULT_FOOD_IMAGE } from "./constants.js";

async function initializeFirebase() {
  console.log('🚀 Starting Firebase initialization...');
  
  // Create users
  const users = [
    { email: 'admin@cse.com', password: 'admin123', name: 'CSE Admin', role: 'admin' },
    { email: 'cashier@cse.com', password: 'cashier123', name: 'Cashier Node', role: 'cashier' },
    { email: 'server@cse.com', password: 'server123', name: 'Server Node', role: 'server' }
  ];

  for (const userData of users) {
    try {
      // Try to sign in (user might exist)
      try {
        await signInWithEmailAndPassword(auth, userData.email, userData.password);
        console.log(`✅ User ${userData.email} already exists`);
      } catch {
        // User doesn't exist, create it
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          active: true,
          createdAt: serverTimestamp()
        });
        console.log(`✅ Created user: ${userData.email}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create ${userData.email}:`, error);
    }
  }

  // Initialize menu
  const menuSnapshot = await getDocs(collection(db, "menu"));
  if (menuSnapshot.empty) {
    const batch = writeBatch(db);
    INITIAL_MENU.forEach(item => {
      batch.set(doc(db, "menu", item.id), {
        ...item,
        imageUrl: item.imageUrl || DEFAULT_FOOD_IMAGE
      });
    });
    await batch.commit();
    console.log('✅ Menu initialized');
  }

  console.log('✅ Setup complete!');
}

// Run it
await initializeFirebase();
```

### Option 2: Firebase Console (Manual)

#### Create Users in Firebase Authentication:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `csecafe-a7fff`
3. Go to **Authentication** → **Users**
4. Click **Add user** and create:
   - **Email**: `admin@cse.com` | **Password**: `admin123`
   - **Email**: `cashier@cse.com` | **Password**: `cashier123`
   - **Email**: `server@cse.com` | **Password**: `server123`

#### Add User Roles in Firestore:

1. Go to **Firestore Database**
2. Create collection: `users`
3. For each user (use their UID from Authentication):
   - Document ID: `{uid}`
   - Fields:
     ```json
     {
       "uid": "{uid}",
       "email": "admin@cse.com",
       "name": "CSE Admin",
       "role": "admin",
       "active": true,
       "createdAt": [timestamp]
     }
     ```

#### Initialize Menu Items:

The app will auto-initialize menu items on first load via `initializeMenu()` function.
If it doesn't, manually add items from `constants.tsx` to Firestore collection `menu`.

### Option 3: Use Setup Page (If Added to Routes)

If you've added a `/setup` route:
1. Navigate to `/setup` in your app
2. Click "Initialize Firebase" button
3. Wait for completion

## Default Credentials

After setup, use these to login:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@cse.com` | `admin123` |
| Cashier | `cashier@cse.com` | `cashier123` |
| Server | `server@cse.com` | `server123` |

## Menu Items

14 menu items from `constants.tsx` will be automatically loaded:
- 10 Breakfast items
- 2 Lunch items  
- 2 Beverages

## Troubleshooting

**Users can't login?**
- Verify users exist in Firebase Authentication
- Check user roles in Firestore `users` collection
- Ensure `active: true` in user document

**Menu not loading?**
- Check Firestore `menu` collection has items
- Verify `initializeMenu()` runs on app load
- Check browser console for errors

**Need to reset?**
- Delete users from Firebase Authentication
- Delete `menu`, `inventory`, `users` collections in Firestore
- Run setup again
