import { 
  collection, query, where, getDocs, doc, setDoc, updateDoc,
  serverTimestamp, runTransaction, getDoc, collectionGroup,
  orderBy, limit, increment, writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { STATION_ID_BY_ITEM_ID, PREPARATION_STATIONS } from '../constants';

let lastPulseAt = 0; 
let failsafeInterval: any = null;
let dosaCycleCount = 0; 

/** 🛡️ [BRAIN-STABILIZER] Kill the continuous loop */
export const runBatchGenerator = async (nodeId: string, force: boolean = false) => {
  if (!auth.currentUser) return;
  const now = Date.now();
  
  // 🛡️ [COOLDOWN] Reduce noise under load (Mandatory 2s between pulses)
  if (now - lastPulseAt < 2000) return; 
  lastPulseAt = now;

  const lockRef = doc(db, "system_locks", "batch_generator");
  
  try {
    // 🛡️ [EXECUTIVE-AUTHORITY] 30s Lease to prevent multi-node clash
    const lockConfirmed = await runTransaction(db, async (tx) => {
       const snap = await tx.get(lockRef);
       if (snap.exists()) {
          const lData = snap.data();
          if (now - (lData.acquiredAt || 0) < 30000 && lData.nodeId !== nodeId) return false;
       }
       tx.set(lockRef, { nodeId, acquiredAt: now }, { merge: true });
       return true;
    });

    if (!lockConfirmed) return;

    // 1. SCAN FOR PENDING WORK
    const q = query(
      collectionGroup(db, "items"), 
      where("status", "in", ["PENDING", "RESERVED"]),
      orderBy("paidAt", "asc"),
      limit(50) 
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    // 🏎️ [INSTANT-PATH-ACCELERATOR] 
    // Handle front-counter items in a single atomic batch
    const instantItems = snap.docs.filter(d => (STATION_ID_BY_ITEM_ID[d.id] || 'default') === 'default');
    const queueItems = snap.docs.filter(d => (STATION_ID_BY_ITEM_ID[d.id] || 'default') !== 'default');

    if (instantItems.length > 0) {
       console.log(`🍟 [BRAIN] Auto-releasing ${instantItems.length} instant items.`);
       const bypassBatch = writeBatch(db);
       instantItems.forEach(d => {
          bypassBatch.update(d.ref, { status: 'READY', readyAt: now, updatedAt: serverTimestamp() });
       });
       await bypassBatch.commit();
    }

    if (queueItems.length === 0) return;

    // 🍳 [BATCH-GENERATION]
    // Group only valid prep-items (exclude already processed ones)
    const pendingItems = queueItems.map(d => {
       const data = d.data();
       const sId = STATION_ID_BY_ITEM_ID[d.id] || 'default';
       const paidAt = data.paidAt?.toMillis?.() || data.paidAt || now;
       const waitTimeMins = (now - paidAt) / 60000;
       
       let tier = 2; // Standard Kitchen Tier
       if (data.reQueuedAt) tier = 5;
       else if (waitTimeMins > 10) tier = 4;
       else if (waitTimeMins > 5) tier = 3;

       return {
         ...data,
         id: d.id,
         orderId: d.ref.parent.parent?.id || '',
         stationId: sId,
         score: (paidAt / 1000) - (tier * 1000000)
       };
    }).sort((a, b) => a.score - b.score);

    // Grouping by station
    const stations: Record<string, any[]> = {};
    pendingItems.forEach(it => {
       if (!stations[it.stationId]) stations[it.stationId] = [];
       stations[it.stationId].push(it);
    });

    for (const [sId, sItems] of Object.entries(stations)) {
       const config = PREPARATION_STATIONS[sId];
       if (!config) continue;

       // Group by Type (Dosa/Rice/Etc)
       const typeGroups: Record<string, any[]> = {};
       sItems.forEach(it => {
          const gId = (sId === 'beverages' || sId === 'default') ? sId : it.id;
          if (!typeGroups[gId]) typeGroups[gId] = [];
          typeGroups[gId].push(it);
       });

        for (const gItems of Object.values(typeGroups)) {
          const sliceSize = config.maxConcurrentPreparation || 8;
          const itemsToProcessRaw = gItems.slice(0, sliceSize);
          
          const nowMs = Date.now();
          const bId = `batch_${sId}_${itemsToProcessRaw[0].id}_${nowMs}`;

          // Atomic creation with validation
          await runTransaction(db, async (tx) => {
             // 🛡️ [DOUBLE-VALIDATION] - Ensure items are still PENDING before locking them
             const validatedItems = [];
             for(const it of itemsToProcessRaw) {
                const itRef = doc(db, 'orders', it.orderId, 'items', it.id);
                const itSnap = await tx.get(itRef);
                const itData = itSnap.data();
                
                // CRITICAL: Item must be PENDING and NOT already in a batch
                if (itSnap.exists() && (itData?.status === 'PENDING' || itData?.status === 'RESERVED') && !itData?.batchId) {
                   validatedItems.push({ ...it, ref: itRef });
                }
             }

             if (validatedItems.length === 0) return;

             const manifest = validatedItems.map(i => ({
                orderId: i.orderId, itemId: i.id, name: i.name, quantity: i.quantity || 1, userName: i.userName || 'Student'
             }));

             // Mark items as QUEUED
             validatedItems.forEach(it => {
                tx.update(it.ref, { status: 'QUEUED', batchId: bId, updatedAt: serverTimestamp() });
             });

             // Create the Prep Batch Card
             tx.set(doc(db, 'prepBatches', bId), {
                id: bId,
                itemId: validatedItems[0].id,
                itemName: validatedItems[0].name || 'Unnamed Item',
                stationId: sId,
                items: manifest,
                status: 'QUEUED',
                quantity: manifest.reduce((s, i) => s + i.quantity, 0),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
             });
          });
       }
    }

  } catch (err) {
    console.error("📛 [BRAIN-CRASH]", err);
  }
};
