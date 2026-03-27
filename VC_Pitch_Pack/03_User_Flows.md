# JOE — User Flows
## Complete Journey Maps for All 5 User Roles

---

## Flow 1: Student — Order to QR

```
[LAUNCH APP]
     │
     ▼
[Welcome Screen]
  ├── "Continue with Google" → Firebase Google OAuth → HomeView
  ├── "Enter as Guest"      → Anonymous Auth → HomeView
  └── "Staff Login"         → Email/Password → Staff Portal
     │
     ▼
[HomeView — Menu Browser]
  ├── Browse by Category: Breakfast / Lunch / Snacks / Beverages
  ├── Search bar (real-time filter)
  ├── Add to Cart (+ / - controls)
  ├── Live stock indicators (AVAILABLE / LOW / SOLD OUT)
  └── Tap "Process Order →" when cart ready
     │
     ▼
[PaymentView]
  ├── UPI Flow:
  │     ├── Scan QR / enter UPI ID
  │     ├── Student pays externally
  │     ├── Enter last 4 digits of UTR
  │     └── Submit → Order status: UTR_SUBMITTED → Cashier verifies
  └── Cash Flow:
        ├── Select "Pay with Cash"
        ├── Order created with paymentStatus: PENDING
        └── Cashier must approve before QR activates
     │
     ▼
[QRView — Live Order Tracker]
  ├── QR Code displayed (HMAC-SHA256 signed, 30-min expiry)
  ├── Real-time status banner:
  │     ├── 📅 Order Scheduled
  │     ├── 🥣 Preparing Meal
  │     ├── 🔥 Almost Ready...
  │     └── 🎉 Food is Ready! → Push notification sent
  └── Progress bar animates through flow states
```

**Key UX guarantee**: Student never needs to reload. `onSnapshot` listeners push all state changes automatically.

---

## Flow 2: Cashier — Payment Approval

```
[CashierView launches]
     │
     ▼
[Real-time queue of PENDING cash orders]
  Each card shows:
  - Student name + order total
  - Items ordered
  - Time since order placed
     │
  ┌──┴───────────┐
  ▼              ▼
[APPROVE]     [REJECT]
  │              │
  ▼              ▼
paymentStatus  paymentStatus
= SUCCESS      = REJECTED
qrStatus       Student sees
= ACTIVE       rejection notice
  │              │
  ▼
Student QR instantly activates
(Firestore listener pushes update)
```

**SLA target**: Cashier approval < 60 seconds from order placement.

---

## Flow 3: Server — QR Scan & Serve

```
[UnifiedKitchenConsole → SERVER tab]
     │
     ▼
[Camera opens / QR Scanner]
     │
[Student shows QR]
     │
     ▼
[processAtomicIntake() transaction]
  ├── Idempotency check (already scanned? → ALREADY_MANIFESTED)
  ├── HMAC-SHA256 signature verify
  ├── qrStatus must be ACTIVE
  └── isStaticItem()?
        │
    YES │ (Plate Meal, Beverages, Snacks)
        ├──→ Order CONSUMED instantly
        ├──→ Items written to subcollection as READY
        └──→ Server sees "ORDER COMPLETE ✅"
        │
    NO  │ (Dosa, Idli, Omelette, Egg Rice)
        ├──→ qrStatus = SCANNED
        ├──→ Items written to subcollection as PENDING
        └──→ Shows on Server Console manifest
     │
     ▼
[ServerConsoleWorkspace — Live Manifest]
  Each order card shows:
  - Food image + name + quantity
  - Status badge (PENDING / READY / SERVED)
  - [SERVE] button per item
  - [SERVE ALL] button in header
  - [REJECT] button per item
     │
  ┌──┴──────────────────────┐
  ▼                         ▼
[SERVE ALL]             [SERVE single]
  atomic Firestore        serveSingleItem()
  runTransaction          item.status = SERVED
  all items = SERVED      
  order = CONSUMED        
```

---

## Flow 4: Cook — Kitchen Batch Management

```
[UnifiedKitchenConsole → COOK tab]
     │
     ▼
[CookConsoleWorkspace — Live Batch Queue]
  safeListener on prepBatches (QUEUED / PREPARING)
  FIFO sorted by createdAt ascending
     │
[Focus Panel shows current batch]
  - Station: DOSA / KITCHEN / DEFAULT
  - Items in batch with order IDs
  - Status: QUEUED / PREPARING
     │
[Tap "START" on batch]
     │
     ▼
startBatch(batchId) → status = PREPARING
  ├── Cook's UID stamped (ownerId)
  └── Visual: card turns emerald green / animated
     │
[Cook prepares food]
     │
[Tap "DONE" on batch]
     │
     ▼
finalizeBatch(batchId) → status = READY
  ├── All linked orders: serveFlowStatus = READY
  ├── Cloud Function triggers push notification → Students
  └── Server Console manifest turns green
```

---

## Flow 5: Admin — Full System Control

```
[AdminDashboard]
  ├── 📊 METRICS TAB
  │     ├── Today's orders, revenue, P&L
  │     ├── UPI vs Cash split
  │     └── Item-wise popularity ranking
  │
  ├── 🍽️ MENU MANAGEMENT
  │     ├── Add / Edit / Deactivate items
  │     ├── Upload food images
  │     └── Toggle item availability live
  │
  ├── 👥 STAFF MANAGEMENT
  │     ├── Create cashier/cook/server accounts
  │     └── Set roles + active status
  │
  ├── ⚙️ SYSTEM SETTINGS
  │     ├── Enable/disable ordering
  │     ├── Set max QR expiry
  │     ├── Kitchen panic delay button
  │     └── Toggle maintenance mode
  │
  ├── 📣 MARKETING PULSES
  │     ├── Push real-time promo banners to all students
  │     └── Flash deal announcements with sound alert
  │
  └── 📥 REPORTS
        ├── Export CSV: daily orders + revenue
        └── Audit trail: all serve/scan logs
```

---

## Critical Edge Cases Handled

| Scenario | JOE's Response |
|----------|---------------|
| Student scans QR twice | Idempotency key blocks second scan → "ALREADY MANIFESTED" |
| Screenshot of QR reused | HMAC hash fails or qrStatus = USED → rejected |
| QR expires (30 min) | Signature timestamp check fails → expired message |
| Network drops during scan | Firestore offline persistence maintains last state |
| Cook marks ready but student gone | Pickup window timer → MISSED after timeout |
| Two servers scan same QR simultaneously | Firestore transaction serializes → only first wins |
