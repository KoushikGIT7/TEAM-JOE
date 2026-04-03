# 🚀 JOE CAFE ENGINE: 40-Sprint Core Roadmap (Spark Optimized)
**Author**: Tech Lead | **Version**: 2.0 | **Focus**: 1 to 100 Scalability

This roadmap is designed for the **Firestore Spark Plan** (Zero Cost). All tasks focus on reducing Read/Write overhead while delivering a "Starbucks-Class" experience.

---

### 🏛️ PILLAR 1: ARCHITECTURE & QUOTA OPTIMIZATION (Teammate A)
| # | Task | Why It's Needed | How to Implement (One-Line) |
|---| :--- | :--- | :--- |
| 1 | **Atomic "Read-Before-Write" Transaction** | Prevents 2 students from ordering the 'Last Dosa' at the exact same millisecond. | Wrap inventory check and order creation in a single `runTransaction()`. |
| 2 | **Metadata Aggregate Sharding** | Reduces total reads by reading 1 'Counts' doc instead of 100 'Order' docs. | Use a separate `collection('metadata')` to store real-time totals updated by Cloud Functions. |
| 3 | **State Throttling (3000ms Pulse)** | Prevents staff tablets from hitting the 50k read limit in 1 hour. | Use a local `timer` to throttle the frequency of `onSnapshot` listeners to 3s intervals. |
| 4 | **Sub-Collection Shifting** | Drastically reduces write costs for large orders (10+ items). | Store individual items as sub-docs `orders/{id}/items/{itemId}` for selective updates. |
| 5 | **Memory-Level Caching (Staff)** | Makes the staff dashboard instant without fetching from the cloud repeatedly. | Implement `react-query` or a simple memoized hook to store 'Recent Orders' locally. |
| 6 | **Idempotency Key Verification** | The definitive fix for the "150x Ghost Item" duplication bug. | Check if the `idempotencyKey` doc exists in `idempotency_keys` before ANY order creation. |
| 7 | **Selective Fields Snapshots** | Saves bandwidth and data transfer costs for students on mobile. | Use the `query('status', '==', 'READY')` with specific fields instead of listening to the whole doc. |
| 8 | **Batch Generator Fail-Safe** | Ensures kitchen production never stalls even if the primary staff device dies. | Implement a 'Heartbeat' timer that shifts the "Brain" responsibility between active staff. |
| 9 | **Index Integrity Audit** | Prevents the "Missing Index" crash during peak rush periods. | Map every `orderBy` and `where` query into the `firestore.indexes.json` file immediately. |
| 10 | **Orphan Data Sweeper** | Keeps the database small and fast for the Spark free tier. | Build a script to auto-delete `READY` orders older than 24 hours every morning. |

---

### 📲 PILLAR 2: SEAMLESS FLOW & STUDENT PUSH (Teammate B)
| # | Task | Why It's Needed | How to Implement (One-Line) |
|---| :--- | :--- | :--- |
| 11 | **OneSignal ID Mapping** | Ensures the notification goes to the specific student, not everyone. | Store the `oneSignalId` in the FireStore `users/{uid}` document during login. |
| 12 | **Stage 1: "Kitchen Accepted" Push** | Gives student immediate comfort that their payment was verified. | Send OneSignal push when the first `prepBatch` for an order is created. |
| 13 | **Stage 2: "Finalizing" Push** | Prepares the student to stand up and walk to the counter. | Send push when a batch status moves to `ALMOST_READY`. |
| 14 | **Stage 3: "Shelf Ready" Push** | The most critical alert that provides the student their QR code. | Trigger push notification inside the `finalizeBatch` function call. |
| 15 | **Deep-Link Notification** | Tapping the alert should open the QR directly, not the Home screen. | Include `orderId` in the OneSignal payload data and handle it in `App.tsx`. |
| 16 | **In-App Toast Sync** | Visual feedback for students who have push-notifications disabled. | Create a `NotificationContext` that listens to their specific `orders` collection. |
| 17 | **Haptic Handover Feedback** | Tactile confirmation of successful QR scans for better UX. | Use `navigator.vibrate([100, 50, 100])` when an item is served successfully. |
| 18 | **Dynamic Arrival Signal** | Allows the kitchen to prioritize people who are physically present. | Add an "I am Here" button that updates an `arrivalSignal` field in the order doc. |
| 19 | **Real-Time Voice Queue** | Audio confirmation for noisy cafeterias: "Order 42 ready!" | Use the `sonicVoice` engine to read out the last 2 digits of the `orderId` on the 'Ready' event. |
| 20 | **Auto-Lock QR Security** | Prevents students from sharing the same digital token with friends. | Change `qrStatus` to `SCANNED` in the first millisecond a staff scanner hits it. |

---

### 🍳 PILLAR 3: STAFF & OPERATIONAL INTELLIGENCE (Teammate C)
| # | Task | Why It's Needed | How to Implement (One-Line) |
|---| :--- | :--- | :--- |
| 21 | **Bento-Grid Production View** | Reduces eye-strain and confusion for cooks in a hot kitchen. | Build a card-based layout in `CookTab.tsx` that aggregates quantity across all batches. |
| 22 | **Staff Role-Masking** | Prevents a Cook from accidentally 'Serving' an item at the counter. | Enforce Firestore Rules where `delete` on `prepBatches` requires `role == 'server'`. |
| 23 | **Beverage Instant-Scanner** | Speeds up the tea/coffee counter (no-prep items). | Create a dedicated `BeverageTab` with direct scan-to-serve logic bypassing the kitchen. |
| 24 | **Stock Threshold Alerts** | Prevents staff from selling items that are already out of stock. | Add a `lowStockThreshold` to inventory and alert staff via the dashboard when hit. |
| 25 | **Daily Gross Recap** | Fast visibility for the manager on how much cash vs digital was collected. | Build a one-tap report that sums all `SERVED` orders for the current `yyyy-mm-dd`. |
| 26 | **Kitchen Wait-Time Algorithm** | Provides realistic expectations to the student app based on crowd. | Calculate `averagePrepTime` per item and multiply by currently `QUEUED` count. |
| 27 | **Panic Kill-Switch** | Immediately stops all student ordering in case of a fire or kitchen issue. | A global `settings/orderingEnabled` field that the Admin can flip on/off instantly. |
| 28 | **Staff Attendance Pulse** | Audit log of who was managing the counter during a specific shift. | Auto-write the logged-in staff UID to every `serveItem` transaction log. |
| 29 | **Fractional Release Logic** | Allows serving 5 Dosas even if the batch was for 10. | Finalize only the specific items selected in the batch release interface. |
| 30 | **Historical Prep Trends** | Identifying peak hours (e.g., 9:05 AM is your busiest time). | Graph the number of `PREPARING` events vs `Time` for the last 7 days. |

---

### 🛡️ PILLAR 4: SYSTEM HARDENING & DEVOPS (The "Tech Lead")
| # | Task | Why It's Needed | How to Implement (One-Line) |
|---| :--- | :--- | :--- |
| 31 | **Error Boundary Resilience** | Prevents the whole app from crashing if 1 item has a bad image. | Wrap the `OrderCard` component in a React `ErrorBoundary`. |
| 32 | **Environment Variable Isolation** | Prevents Dev data from leaking into Production Firestore. | Use `.env.production` and `.env.development` with different Firebase projects. |
| 33 | **CI/CD Deployment Pipeline** | Ensures a teammate doesn't "break the master branch" by mistake. | Use GitHub Actions to run `tsc` and `eslint` before every merge to main. |
| 34 | **Schema-Type Enforcement** | Prevents "Undefined" crashes when reading old orders. | Use Zod or strict TypeScript interfaces for all Firestore data casting. |
| 35 | **Lighthouse Performance Audit** | Zero-lag performance even on poor 3G cafeteria Wi-Fi. | Optimize images and lazy-load views that aren't currently active. |
| 36 | **Firebase Security Rule Audit** | Prevents students from "Editing their own Order" to mark it paid. | Ensure `request.resource.data.paymentStatus` can only be changed by `role == 'admin'`. |
| 37 | **PWA Manifest Implementation** | Staff can "Install" the app on their tablet for a fullscreen native look. | Configure `manifest.json` and service workers for offline asset caching. |
| 38 | **Automated Stress Test** | Proves the system works when 50 students order at the same time. | Build a script to create mock orders simultaneously and verify the queue logic. |
| 39 | **Staff QR Scanner Optimization** | Reduces scan time from 2 seconds to 200 milliseconds. | Upgrade internal barcode logic to use `requestAnimationFrame` for the camera feed. |
| 40 | **The "Handover" Handshake** | Final confirmation that the software development is "Enterprise Ready." | Complete a full walkthrough with all 30 features active and zero errors in logs. |
