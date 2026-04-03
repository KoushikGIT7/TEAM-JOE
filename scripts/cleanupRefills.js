const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Assumed present or I will use environment

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

const db = admin.firestore();

async function cleanupRefills() {
  console.log("🧹 [CLEANUP] Starting ghost-order purge...");
  
  const snap = await db.collection('prepBatches')
    .where('isInternalRefill', '==', true)
    .get();

  console.log(`🔍 [CLEANUP] Found ${snap.size} internal refill batches.`);

  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  if (snap.size > 0) {
    await batch.commit();
    console.log("✅ [CLEANUP] Purged all phantom 150x orders.");
  } else {
    console.log("🍹 [CLEANUP] No phantom orders left to purge.");
  }
}

cleanupRefills().catch(console.error);
