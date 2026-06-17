# Firestore Index Deployment Guide

## ✅ Index Configuration Verified

All Firestore indexes are properly configured in `firestore.indexes.json` and ready for deployment.

## 🚀 Deployment Steps

### Step 1: Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication. Follow the prompts to complete login.

### Step 3: Set Firebase Project

```bash
firebase use csecafe-a7fff
```

Or if you need to add it:

```bash
firebase use csecafe-a7fff --add
```

### Step 4: Deploy Indexes

**Run this command to deploy all Firestore indexes:**

```bash
firebase deploy --only firestore:indexes
```

## 📋 Expected Output

```
=== Deploying to 'csecafe-a7fff'...

i  deploying firestore indexes
i  firestore: reading indexes from firestore.indexes.json...

✔  firestore: deployed indexes successfully

✔  Deploy complete!
```

## ⏱️ Index Build Time

- **Typical build time:** 5-15 minutes
- **Large collections:** May take 30+ minutes
- **Status check:** Firebase Console → Firestore → Indexes

## ✅ Verification

After deployment, verify indexes are building:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `csecafe-a7fff`
3. Navigate to: Firestore Database → Indexes
4. Check status: Building → Enabled

## 📊 Indexes Being Deployed

Total: **8 indexes**

1. `orders` - orderStatus + createdAt
2. `orders` - paymentType + paymentStatus + createdAt
3. `orders` - createdAt
4. `pendingItems` - createdAt
5. `inventory` - available
6. `serveLogs` - servedAt
7. `scanLogs` - scanTime
8. `orders` - orderStatus + paymentStatus + qrStatus + scannedAt

## ⚠️ Important Notes

- **During build:** Queries will still work but may be slower
- **After build:** All queries will use indexes automatically
- **No downtime:** Index building doesn't affect existing functionality

---

**Ready to deploy!** Run the commands above to deploy indexes automatically.
