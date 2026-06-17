# CSE Cafeteria — Advanced Architecture Improvements

Incremental improvements for high-traffic (10k+ daily users), concurrency-safe, and fraud-resistant operation. All changes are backward-compatible with the existing codebase.

---

## 1. Architecture Summary

- **Sharded inventory**: `inventory_shards/{itemId}/shards/shard_{0..N}` — each serve increments one random shard; aggregation writes to `inventory_meta/{itemId}` or existing `inventory/{itemId}.consumed` for dashboard.
- **QR lifecycle**: ACTIVE → SCANNED (on validateQR) → SERVED (when order fully served). Expiry and scan timestamp stored on order; duplicate/expired scans logged to `fraudLogs`.
- **Rate limiting**: In `createOrder` Callable — max 3 active orders per user, min 5s between orders.
- **Kitchen workflow**: Order field `kitchenStatus`: PLACED | COOKING | READY | SERVED. Kitchen dashboard and `updateKitchenStatus` Callable; students see READY via listener.
- **Queue prediction**: `estimated_wait_minutes = pending_orders_count / serving_rate`; serving_rate from settings or default.
- **Fail-safe**: `settings/global.orderingEnabled`; createOrder and client check before placing order.
- **Security**: No client writes to orders/inventory/scanLogs/serveLogs (already enforced); fraudLogs write by Functions only.
- **Offline**: Retry helper for failed ops; optional offline banner component.

---

## 2. Updated Firestore Schema (Additions Only)

| Collection / Doc | New / Changed Fields |
|------------------|----------------------|
| orders | `kitchenStatus`: "PLACED" \| "COOKING" \| "READY" \| "SERVED", `qrState`: "ACTIVE" \| "SCANNED" \| "SERVED" \| "EXPIRED", `qrScannedAt`, `qrExpiresAt` |
| settings/global | `orderingEnabled`: boolean, `servingRatePerMin`: number (for queue estimate), `qrExpiryMinutes`: number |
| inventory_meta/{itemId} | `openingStock`, `consumed` (aggregated from shards), `lastAggregatedAt` |
| inventory_shards/{itemId}/shards/shard_{0..N} | `count`, `lastUpdated` |
| fraudLogs/{logId} | `orderId`, `userId`, `reason`, `details`, `createdAt` (Functions only) |

Existing collections unchanged except additive fields above.

---

## 3. Performance Recommendations

- **Indexes**: Ensure composite indexes for orders by `userId`+`createdAt`, `orderStatus`+`createdAt`, `kitchenStatus`+`createdAt` if you query by kitchen status.
- **Listeners**: Use bounded queries (limit 50–100) for admin “all orders” and kitchen queue; paginate with startAfter.
- **Inventory**: Dashboard reads aggregated `inventory_meta` or single `inventory` doc; avoid summing shards on every request (aggregation in Function or scheduled job).
- **Queue estimate**: Cache pending count for 10–30s or use a lightweight query with limit.

---

## 4. Testing Strategy

- **Unit**: Rate limit logic (mock Firestore: 3 orders, 5s window). OrderingEnabled check. QR expiry and state transitions.
- **Integration**: createOrder rejects when orderingEnabled false; validateQR rejects expired/duplicate and writes fraudLog; serveItem increments shard and aggregate.
- **E2E**: Student places order → cashier confirms → server scans QR → kitchen marks READY → student sees READY; ordering disabled blocks new orders.
- **Load**: Simulate many concurrent serveItem calls for same itemId; verify shard distribution and no single-doc hotspot.

---

## 5. File Change Summary

| File | Changes |
|------|---------|
| types.ts | QRState, KitchenStatus; Order.qrState, kitchenStatus, qrScannedAt, qrExpiresAt; SystemSettings.orderingEnabled, servingRatePerMin, qrExpiryMinutes |
| constants.tsx | INVENTORY_SHARD_COUNT, QR_EXPIRY_MINUTES, DEFAULT_ORDERING_ENABLED |
| functions/index.js | createOrder: rate limit, orderingEnabled, kitchenStatus PLACED; confirmPayment: qrExpiresAt; validateQRCode: qrState SCANNED, fraud log; serveItem: sharded increment, qrState SERVED; updateKitchenStatus; aggregateInventory |
| firestore-db.ts | getOrderingEnabled, getAggregatedInventory, getQueueEstimate, updateKitchenStatus (callable); createOrder pre-check orderingEnabled; settings defaults |
| firestore.rules | fraudLogs (read admin, write false) |
| views | PaymentView: orderingEnabled check; HomeView: estimated wait; Kitchen dashboard (new or Admin tab) |
| utils/retry.ts | withRetry() for network resilience |

## 6. Monitoring (Firebase)

- **Performance Monitoring**: In production, add `firebase/performance` and call `getPerformance(app)` then `trace()` for critical flows (createOrder, validateQR, serveItem). See [Firebase Perf](https://firebase.google.com/docs/perf-mon).
- **Analytics**: Optional; enable only in production to avoid ad-blocker issues. Log events for `order_created`, `payment_confirmed`, `qr_scanned`, `order_served`.
- **Cloud Logging**: Functions already use `functions.logger.warn` for fraud (expired QR, duplicate scan). Add custom metrics in Cloud Console for failed scans and rate-limit hits.
- **Alerts**: Create alert policies for Function error rate and Firestore read/write spikes.
