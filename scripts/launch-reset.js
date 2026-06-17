import admin from "firebase-admin";

// Run this script locally using node to clean up the database before launch:
// node scripts/launch-reset.js
// Make sure you have your serviceAccountKey.json in the root directory!

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function resetLaunchData() {
  console.log("🚀 Starting Launch Reset Protocol...");

  try {
    console.log("🧹 1. Clearing Orders...");
    await deleteCollection("orders", 50);

    console.log("🧹 2. Clearing PrepBatches...");
    await deleteCollection("prepBatches", 50);

    console.log("🧹 3. Clearing Wallet Recharge Requests...");
    await deleteCollection("wallet_recharge_requests", 50);

    console.log("🧹 4. Clearing Daily Reports (Analytics)...");
    await deleteCollection("reports", 50);

    console.log("🧹 5. Clearing QR Scans & Server Logs...");
    await deleteCollection("hardware_scans", 50);
    await deleteCollection("server_logs", 50);

    console.log("🧹 6. Resetting User Data (Leaderboard, Points, Levels)...");
    const usersSnap = await db.collection("users").get();
    let userBatch = db.batch();
    let userCount = 0;

    for (const doc of usersSnap.docs) {
      userBatch.update(doc.ref, {
        points: 0,
        xp: 0,
        level: 1,
        frequency: 0,
        totalSpent: 0,
        ordersCount: 0,
        streakCount: 0,
      });

      userCount++;
      if (userCount % 500 === 0) {
        await userBatch.commit();
        userBatch = db.batch();
      }
    }
    if (userCount % 500 !== 0) {
      await userBatch.commit();
    }
    console.log(`✅ Reset points for ${userCount} users.`);

    console.log("🧹 7. Resetting Inventory Consumption...");
    const inventorySnap = await db.collection("inventory_meta").get();
    let invBatch = db.batch();
    for (const doc of inventorySnap.docs) {
      invBatch.update(doc.ref, {
        consumed: 0,
      });
    }
    await invBatch.commit();
    console.log("✅ Reset inventory consumption counters.");

    console.log("🎉 All mock data wiped successfully! Ready for tomorrow's launch.");
    process.exit(0);

  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
}

resetLaunchData();
