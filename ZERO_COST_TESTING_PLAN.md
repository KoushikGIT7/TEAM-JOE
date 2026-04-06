# 🛑 JOE Cafeteria: The Zero-Cost Testing Blueprint (UPDATED)

**Objective:** Run the first month of live testing with ~1,000 daily users completely FREE (₹0) on the Firebase Spark Plan.
**The Constraints:** 50,000 Reads per Day, 20,000 Writes per Day, 0 Cloud Backend Functions allowed.

---

## 💾 Rule 1: Aggressive Frontend Menu Caching
Reducing menu reads from 30,000+ per day to roughly 1,000 per day.
- **The Flow:** When a user opens the app, check if the menu exists in `localStorage`. If YES -> Load instantly (0 reads). If NO -> Fetch from Firestore (1 read per item), save locally, and render.

---

## 📡 Rule 2: Constrained Real-Time Listeners
Every document change in a listener counts as a read. We must be tiny and local.
- **Time Bounds:** All queries in `CookView` and `ServingCounterView` strictly pull active data (status: `PENDING`/`READY`).
- **Auto-Unmount:** The system stops listening the moment an order hits `COMPLETED`.

---

## 🔔 Rule 3: The "Sonic Banner" (Fake In-App Notifications)
Because Spark Tier blocks Cloud Functions, we use **Real-Time Document Listeners** to mimic Push Notifications.
- **Status Pulse:** The student's `HomeView` listens *only* to their active order. When the kitchen marks an item `READY`, the banner instantly pulses and the phone vibrates.
- **Audio Cue:** The `ServingCounterView` and student `QRView` play local "Success" audio files to signal handover without any backend overhead.

---

## 🌐 Rule 4: Strategic Deployment (Netlify/Vercel)
Firebase bandwidth is limited (360MB/day).
- **The Strategy:** Deploy the React frontend to **Netlify** or **Vercel**. They provide massive global bandwidth for free.
- **The Result:** Offload all image and code transfers away from Firebase's restrictive quotas.

---

### 🚦 The Teammate Checklist:
Before you deploy an AI-generated code block, ask: *"Does this query load historical data? Does it fetch things the user already has?"* **If yes, reject the code.** Keep fetches tiny, cached, and local.
