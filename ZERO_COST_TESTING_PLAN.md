# 🛑 JOE Cafeteria: The Zero-Cost Testing Blueprint

**Objective:** Run the first month of live testing with ~1,000 daily users completely FREE (₹0) on the Firebase Spark Plan.
**The Constraints:** 50,000 Reads per Day, 20,000 Writes per Day, 0 Cloud Backend Functions allowed.

If 1,000 users visit daily, each user has a strict budget of **50 database reads**. To prevent the system from crashing mid-lunch due to "Quota Exceeded" errors, the entire AI prompt engineering team MUST adhere to these 4 architectural rules:

---

## 💾 Rule 1: Aggressive Frontend Menu Caching

If 1,000 students download the 30-item menu directly from the database every time they open the app, that consumes 30,000 reads instantly. This will break the app by 1:00 PM.

**The Implementation Strategy:**
- **Local Storage:** Tell your AI to implement `localStorage` or `sessionStorage` caching for the Menu component.
- **The Flow:** When a user opens the app, check if the menu exists in local memory and was fetched today. If YES -> Load instantly from local memory (0 reads). If NO -> Fetch from Firestore, save to memory, and then render.
- **Impact:** Reduces menu reads from 30,000+ per day to roughly 1,000 per day.

---

## 📡 Rule 2: Constrained Real-Time Listeners (The Kitchen Engine)

Real-time listeners (`onSnapshot`) charge 1 read every time a document changes, PLUS 1 read for every active document loaded initially. If the Cook Console queries the *entire history* of the cafeteria, your quota will instantly vanish.

**The Implementation Strategy:**
- **Time Bounds:** Ensure all Firestore queries in `UnifiedKitchenConsole.tsx` strictly pull data with a `.where("status", "in", ["pending", "cooking", "ready"])`.
- **Auto-Unmount:** Never let the system listen to an order once its status hits `completed` or `served`.
- **Impact:** Staff consoles will only load the 30-50 active active lunches instead of the thousands of historical records, saving massive amounts of reads.

---

## 🔔 Rule 3: The OneSignal Push Integration

We are utilizing **OneSignal** (`react-onesignal`) for notifications. Because OneSignal operates its own massive free tier, we can send real push notifications to student devices without burning our Firebase quotas or needing paid Firebase Cloud Functions!

**The Implementation Strategy:**
- **Frontend Triggering:** When the Cook clicks "Ready" or the Server clicks "Served", the React app can directly trigger a OneSignal REST API call (or utilize the frontend SDK) to push a notification to the specific student's `OneSignal Player ID`.
- **The Catch:** Since it's currently broken, the AI needs to diagnose how the `OneSignal Player ID` is being saved to the user's Firestore profile and ensure the trigger perfectly maps to that ID.
- **Impact:** We get 100% real push notifications on iOS/Android/Web for free, completely bypassing Firebase push limits.

---

## 🌐 Rule 4: Deploy Free (Avoid Firebase Hosting)

Firebase restricts bandwidth to 360MB/day (10GB/month) on the Free Plan. Sending high-quality food images to 1,000 users will exceed this rapidly.

**The Implementation Strategy:**
- **Netlify or Vercel:** Deploy the Vite/React application to Vercel or Netlify. Both services provide unlimited global CDN bandwidth for free on their starter tiers.
- **Impact:** You keep your website incredibly fast and offload all the heavy image/code transfers away from Firebase's restrictive quota.

---

### 🚦 The Teammate Checklist:
Before you deploy an AI-generated code block, ask yourself: *"Does this query load data from the past? Does it fetch things the user already has? Does it loop?"* **If yes, reject the code.** Keep fetches tiny, cached, and local.
