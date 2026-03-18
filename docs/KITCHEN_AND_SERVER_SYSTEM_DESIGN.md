# 🍽️ Kitchen & Serving System Architecture

## 🎯 System Overview

The system strictly divides cafeteria operations into two highly optimized, mutually exclusive workspaces:
1. **Cook Console**: Exclusively handles batch cooking and timing.
2. **Server Console**: Exclusively handles QR scanning, queue management, and order fulfillment.

Both workspaces operate in real-time, instantly syncing state via Firestore, ensuring zero waiting at the counter and clear role separation under high load (100+ scans/minute).

---

## 🍳 1. Cook Console (Preparation Workspace)

**Target Audience**: Kitchen Staff / Cooks
**Core Philosophy**: Show only What, How Much, and When to cook.

### 🖼️ Component Structure

```tsx
// 📌 Location: views/Staff/CookConsole/index.tsx
<CookConsole>
  {/* TOP: Upcoming Batches */}
  <UpcomingBatches>
    <BatchGroup time="12:30 PM" items={[{ name: "Dosa", qty: 40 }, { name: "Gobi Rice", qty: 25 }]} />
    <BatchGroup time="12:45 PM" items={[{ name: "Dosa", qty: 30 }]} />
  </UpcomingBatches>

  {/* CENTER: Currently Preparing (Active Focus) */}
  <ActivePrepCard>
    <BatchHeader time="12:30 Batch" />
    <ItemList items={[{ name: "Dosa", qty: 40 }]} />
    <ActionControls>
      {/* Shown if status is QUEUED */}
      <Button action="START_PREPARING">Start Preparing</Button>
      {/* Shown if status is PREPARING */}
      <Button action="MARK_READY">Mark Ready</Button>
    </ActionControls>
  </ActivePrepCard>

  {/* BOTTOM: Ready for Pickup */}
  <ReadyBatches>
    <ReadyCard items={[{ name: "Dosa", qty: 40 }]} time="12:30 PM" />
  </ReadyBatches>
</CookConsole>
```

### ⚡ Cook Action Flow & Business Logic
1. **Start Preparing**: 
   - `batch.status` -> `PREPARING`
   - Real-time Fan-out: Updates all associated `CartItem` statuses within the orders to `PREPARING`. 
   - Student facing UI instantly updates to: *"Preparing your food"*.
2. **Mark Ready**:
   - `batch.status` -> `READY`
   - Updates all `CartItem` statuses to `READY`.
   - Starts the `pickupWindow` timer (7 minutes / 420000ms) on each associated `Order`.
   - Student UI updates to: *"Ready for pickup"*.
   - Server Console instantly enables the `[ SERVE ]` button for these items.

---

## 📱 2. Server Console (Scan & Serve Workspace)

**Target Audience**: Serving Staff
**Core Philosophy**: Scan fast, see exactly what to serve, and fulfill immediately.

### 🖼️ Component Structure

```tsx
// 📌 Location: views/Staff/ServerConsole/index.tsx
<ServerConsole>
  {/* Overlays for Fast Action (Static Meals) */}
  <StatusOverlay type="VALID|INVALID" />

  {/* TOP: Scan Area */}
  <ScannerArea onScan={handleQRScan} />

  {/* MAIN FOCUS: Active Order */}
  <ActiveOrderCard order={activeOrder}>
    <OrderHeader orderId="#1234" />
    <ServeItemList>
      <ServeItem name="Dosa" qty={2} status="READY" onServe={() => serveItem(itemId)} />
      <ServeItem name="Coffee" qty={1} status="PREPARING" disabled />
    </ServeItemList>
  </ActiveOrderCard>

  {/* BOTTOM: Queue Preview */}
  <QueueStrip>
    <QueueItem orderId="#1235" />
    <QueueItem orderId="#1236" />
    <QueueItem orderId="#1237" />
  </QueueStrip>
</ServerConsole>
```

### ⚡ Server Queue & Action Flow
1. **Scan QR**: Decodes QR -> Extracts `orderId` -> Fetches FULL order from Firestore -> Validates -> Pushes sequentially to the local `scanQueue`. If an active order is being handled, it sits in the `QueueStrip`. If tracking an already scanned QR, the order is moved to the front.
2. **Static Meal Override**: If the order consists entirely of instant/static items (e.g., standard meal without prep), the screen flashes full **Green ("VALID")** handling standard access control, and auto-dismisses after 1.5s completely skipping the Item UI. Invalid QRs flash **Red ("INVALID")**.
3. **Item Fulfillment (Partial Serves)**:
   - Server clicks `[ SERVE ]` on a Ready item.
   - Updates `order.items[...].remainingQty -= 1`.
   - Updates `order.items[...].servedQty += 1`.
4. **Order Completion**: 
   - Evaluated automatically when all items are served (`remainingQty === 0` for all items).
   - Order marked `SERVED`. QR is voided forever (`USED` / `SERVED`).
   - `activeOrder` is popped from the queue, immediately visualizing the next order.

---

## 💾 3. Firestore Schema Design

### PrepBatch Collection (`batches/{batchId}`)
Used primarily by the Cook Console. Order updates are synced via Cloud Functions (or batch writers).
```typescript
{
  id: "batch-1234",
  itemId: "dosa-01",
  itemName: "Dosa",
  quantity: 40,
  orderIds: ["order-01", "order-02", ...],
  arrivalTimeSlot: 1230, // 12:30 PM slot mapped visually
  status: "QUEUED" | "PREPARING" | "READY" | "COMPLETED",
  createdAt: 1718000000000,
  readyAt: null // set when marked ready
}
```

### Orders Collection (`orders/{orderId}`)
Optimized for the Server workflow. Carries inline items and time-sensitive window states.
```typescript
{
  id: "order-1234",
  userId: "user-999",
  qrState: "ACTIVE" | "SCANNED" | "USED",
  serveFlowStatus: "PAID" | "PREPARING" | "READY" | "SERVED_PARTIAL" | "SERVED",
  isStaticMeal: boolean, // optimized static checks
  items: [
    {
      itemId: "dosa-01",
      name: "Dosa",
      quantity: 2,
      servedQty: 0,
      remainingQty: 2,
      status: "QUEUED" | "PREPARING" | "READY" | "SERVED", // Mirrors batch state internally
      batchId: "batch-1234"
    }
  ],
  pickupWindow: {
    startTime: 1718000000000, 
    endTime: 1718000420000, // startTime + 7 minutes
    status: "AWAITING_READY" | "COLLECTING" | "MISSED" | "COMPLETED"
  }
}
```

---

## 🔄 4. Real-time Sync & Edge Logic

### 🚀 Data Synchronization (Push vs Pull)
Both consoles use real-time listeners (`onSnapshot`) scoped highly to avoid noise.
- **Cook Console Listener**: Only queries `batches` where `status IN ['QUEUED', 'PREPARING', 'READY']`.
- **Server Console Listener**: Re-syncs the `activeOrder` by its ID upon scanning to get real-time state changes (e.g. if the cook marks an item READY while the server is viewing the order card).

### ⏰ The "Missed Order" Flow
Handled via backend Cloud Tasks or reactive frontend heartbeat checks on the Server side:
1. `pickupWindow.endTime` passes (7 mins elapsed since READY).
2. If order hasn't been scanned/served -> `pickupWindow.status = MISSED`.
3. Cloud logic automatically pushes the unserved individual `remainingQty` bounds into the **next active batch slot** for that item natively ensuring the cook sees standard replenishment.
4. Student app updates to *"Missed → Re-preparing"*.

### ⚡ Performance Considerations
- **No Queue Rerenders**: The horizontal scanner `QueueStrip` memoizes its DOM nodes heavily.
- **Instant Optimistic UI**: When Server taps `[ SERVE ]`, state mutates locally *instantly*, then debounces/fires an async background sync to Firestore avoiding roundtrip UI locking.

---

## 🎨 5. UI & Styling Rules (Design System)

1. **Colors**:
   - `READY` / `SERVE`: Bright, high contrast Green (`bg-green-500`, text white).
   - `PREPARING` / `WAITING`: Desaturated Grey (`text-gray-400`).
   - Overlays: Pure neon green for `VALID`, Pure solid red for `INVALID`.
2. **Hierarchy**: Pure White Backgrounds (`bg-white`), flat container structures, large robust target areas for fat-finger tapping in a rushed environment. Dark mode is **strictly disabled** for high visibility.
3. **Animations**: Keep to rigid micro-transitions (e.g., 150ms transform scales when items slide out of the Active Order list). No long chained animations.
