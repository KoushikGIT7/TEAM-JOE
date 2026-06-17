# Firebase Credentials Setup Guide

## Current Status

⚠️ **Firebase has been removed from this project.** The app currently uses **localStorage** for data storage.

If you want to migrate to Firebase/Firestore, follow the steps below.

## Firebase Credentials Location

Firebase credentials are typically stored in:

1. **Environment Variables** (Recommended for production)
2. **Firebase Config File** (For local development)

## Setting Up Firebase Credentials

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Enter project name: `cse-cafeteria-automation`
4. Follow the setup wizard
5. Enable **Firestore Database** and **Authentication**

### Step 2: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **Your apps**
3. Click **Web app** icon (`</>`)
4. Register your app
5. Copy the Firebase configuration object

### Step 3: Add Credentials to Project

#### Option A: Environment Variables (Recommended)

Create a `.env.local` file in the project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### Option B: Firebase Config File

Create `firebase.config.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
```

### Step 4: Update firebase.ts

Replace the current `firebase.ts` with:

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = null; // Cloud Functions if needed
export default app;
```

## Environment Variables for Netlify

If deploying to Netlify with Firebase, add these environment variables:

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth Domain | `project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project ID | `cse-cafeteria` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage Bucket | `project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID | `123456789` |
| `VITE_FIREBASE_APP_ID` | App ID | `1:123:web:abc` |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID (optional) | `G-XXXXXXXXXX` |

## Firebase Security Rules

Update `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Orders collection
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Pending items
    match /pendingItems/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.role == 'server';
    }
    
    // Inventory
    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.role in ['admin', 'server'];
    }
  }
}
```

## Current Project Status

✅ **Currently using:** localStorage (mock database)  
❌ **Firebase:** Not configured  
📝 **Firestore schema:** Documented in `FIRESTORE_SETUP.md`  
🔧 **Migration needed:** Yes, if you want to use Firebase

## Important Notes

- **Never commit Firebase credentials** to Git
- Use `.env.local` for local development (already in `.gitignore`)
- Use Netlify environment variables for production
- All Firebase config variables must start with `VITE_` to be accessible in Vite
- The project currently works without Firebase using localStorage
