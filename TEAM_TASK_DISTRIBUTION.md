# ⚔️ JOE Cafeteria: 1-to-100 Team Execution Plan

The foundation is built (0 to 1). We now have a robust data model, polished design identity, and active Kitchen/Cook system. Your mission as a 3-person AI prompting team is to take this from 1 to 100 seamlessly.

To avoid AI confusion, merge conflicts, and stepping on each other's toes, you must divide your efforts smartly. **Never have two AIs working on the exact same UI component at the same time.**

Here is an **Idea Board** to get you thinking. You have **FULL FREEDOM** to build, invent, and prompt whatever wild features you want. These are just ideas to help you distribute your focus areas safely:

---

## 👤 Teammate A: The Core Stabilizer (Fixing the Current Blockers)
**Focus Area:** The Server Console & Core Operation Stability. 
**Why this is safe:** You will be focusing deeply on existing files like `UnifiedKitchenConsole.tsx` while your teammates work on entirely new features.

**Your Idea Board (Things to Think About):**
1. **Fix the Core Blockers (Top Priority):** The Server Portal (QR scanning) and the Notification System (alerts) are currently failing. Use your AI to diagnose the Server Workspace logic and the push-notification routing so the engine works perfectly.
2. **Order Finalization:** Build out the logic for when an entire order is complete (e.g., all sub-items are served). Ensure the main `orders/{orderId}` status flips to `completed`.
3. **Queue Hardening:** Optimize the frontend list so that completed orders automatically vanish from both the Cook and Server screens instantly without requiring page refreshes.

---

## 👤 Teammate B: The Manager & Analytics Master (New Features)
**Focus Area:** The Manager Workspace & Business Intelligence.
**Why this is safe:** You will prompt your AI to build entirely **new** files (e.g., `ManagerDashboard.tsx`, `AnalyticsChart.tsx`), ensuring zero merge conflicts with Teammate A or C.

**Your Idea Board (Things to Think About):**
1. **Sales Dashboard UI:** Build a premium, glassmorphism dashboard view for managers to see real-time sales statistics.
2. **Item Popularity & Inventory:** Create logic to calculate and display which menu items are selling the fastest based on the `orders` subcollections.
3. **Export/Reports:** Implement a feature (using standard libraries) that allows a manager to click "Export Daily Report" and download an excel/PDF of the day's transactions.

---

## 👤 Teammate C: The Customer Experience Specialist 
**Focus Area:** The Mobile Menu, Cart Workflow & Customer Tracking.
**Why this is safe:** You are strictly interacting with the customer-facing views rather than staff-facing administration files.

**Your Idea Board (Things to Think About):**
1. **Dynamic Menu View:** Feed the AI the current menu aesthetic and improve the UX for users browsing items. Ensure categories (e.g., Hot Drinks, Snacks) filter flawlessly.
2. **Live Order Tracking Page:** Once a customer places an order, give them a beautiful mobile UI that shows the real-time status of their food (e.g., "In Queue" -> "Cooking" -> "Ready for Pickup").
3. **Instant Cart Optimization:** Make sure the shopping cart UI feels hyper-responsive with flawless micro-animations before the user hits the "Pay/Order" button.

---

## 🚀 The Golden Rule of Collaborative AI FreedomBecause you are moving from 1 to 100 simultaneously:
1. **Teammate A is handling the engine.**
2. **Teammate B is handling the reporting.**
3. **Teammate C is handling the storefront.**

If Teammate B's AI needs to pull data that Teammate A's AI is actively modifying, **COMMUNICATE FIRST**. Say: *"Hey A, I am pulling the latest commit to read the new order status schema for my analytics."*

Stick to your lanes, use the exact signature commits outline in the onboarding guide (`[Add Analytics] - I am {Name} doing this commit.`), and you will scale to 100 with incredible speed!
