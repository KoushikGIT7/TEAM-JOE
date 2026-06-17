# Deploy Cloud Functions (CSE Cafeteria)

With the backend optimization in place, **orders, payment, QR validation, and serving** run in Cloud Functions. Firestore rules are set so that **only Functions can create/update orders and inventory**. You must deploy Functions before the app will work in production.

## 1. Prerequisites

- Node 18+
- Firebase CLI: `npm install -g firebase-tools`
- Logged in: `firebase login`
- Project set: `firebase use csecafe-a7fff` (or your project ID)

## 2. Install and deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## 3. Environment (QR secret)

For QR code verification to match the web app, set the same secret in Firebase:

```bash
firebase functions:config:set qr.secret_key="YOUR_QR_SECRET_KEY"
```

Or use Secret Manager (recommended for production): define `QR_SECRET_KEY` in the Cloud Console (Functions → Environment variables / Secrets) so it matches `VITE_QR_SECRET_KEY` (or the default in `services/qr.ts`).

Redeploy after setting config:

```bash
firebase deploy --only functions
```

## 4. Optional: local emulator

```bash
cd functions
npm install
cd ..
firebase emulators:start --only functions
```

In the app, set in `.env.local`:

- `VITE_USE_FUNCTIONS_EMULATOR=true` — callables will use `localhost:5001`.

## 5. Disable callables (fallback to client writes)

Only for local dev without Functions: set in `.env.local`:

- `VITE_USE_CALLABLES=false`

Then **revert** Firestore rules for `orders` and `inventory` to allow client writes again (see git history for previous rules). Production should always use callables.

## 6. Deployed functions

| Function           | Purpose                          |
|-------------------|----------------------------------|
| `createOrder`     | Create order (auth or guest)     |
| `confirmPayment`  | Cashier confirm cash payment     |
| `rejectPayment`   | Cashier reject cash payment      |
| `validateQRCode`  | Server validate QR and mark USED |
| `serveItem`       | Server mark one item served      |
| `updateInventory` | Admin update inventory item      |
| `cancelOrder`     | Cancel order                     |
| `onOrderCreated`  | Trigger: fraud check (order rate)|

## 7. Region

Callables are deployed to **us-central1** by default. The client uses the same region in `services/callables.ts` (`getFunctions(app, "us-central1")`). To use another region, change it in both the Functions config and in `callables.ts`.
