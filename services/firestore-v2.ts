import { collection, doc, writeBatch, serverTimestamp, runTransaction, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { PrepBatch, Order, CartItem, PrepBatchStatus } from '../types';

const PICKUP_WINDOW_DURATION_MS = 420000;

export const startBatchPreparationV2 = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);

  await runTransaction(db, async (tx) => {
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists()) return;
    const batchData = batchSnap.data() as PrepBatch;

    tx.update(batchRef, { status: 'PREPARING', updatedAt: serverTimestamp() });

    const orderRefs = (batchData.orderIds || []).map(oid => doc(db, "orders", oid));
    const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

    orderSnaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const orderData = snap.data() as Order;
      const ref = orderRefs[i];
      
      const itemToUpdate = orderData.items?.find(it => it.id === batchData.itemId);
      if (itemToUpdate && itemToUpdate.status !== 'SERVED') {
          const itemRef = doc(db, "orders", snap.id, "items", itemToUpdate.id);
          tx.set(itemRef, { ...itemToUpdate, status: 'PREPARING', updatedAt: serverTimestamp() }, { merge: true });
      }

      const updatedItems = orderData.items?.map(it => {
        if (it.id === batchData.itemId && it.status !== 'SERVED') return { ...it, status: 'PREPARING' as any };
        return it;
      });

      tx.update(ref, {
        serveFlowStatus: 'PREPARING',
        items: updatedItems,
        updatedAt: serverTimestamp()
      });
    });
  });
};

export const markBatchReadyV2 = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);
  const now = Date.now();

  await runTransaction(db, async (tx) => {
    const batchSnap = await tx.get(batchRef);
    if (!batchSnap.exists()) return;
    const batchData = batchSnap.data() as PrepBatch;

    tx.update(batchRef, { status: 'READY', readyAt: now, updatedAt: serverTimestamp() });

    const orderRefs = (batchData.orderIds || []).map(oid => doc(db, "orders", oid));
    const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

    orderSnaps.forEach((snap, i) => {
      if (!snap.exists()) return;
      const orderData = snap.data() as Order;
      const ref = orderRefs[i];
      
      const itemToUpdate = orderData.items?.find(it => it.id === batchData.itemId);
      if (itemToUpdate && itemToUpdate.status !== 'SERVED') {
          const itemRef = doc(db, "orders", snap.id, "items", itemToUpdate.id);
          tx.set(itemRef, { ...itemToUpdate, status: 'READY', updatedAt: serverTimestamp() }, { merge: true });
      }

      const updatedItems = orderData.items?.map(it => {
        if (it.id === batchData.itemId && it.status !== 'SERVED') return { ...it, status: 'READY' as any };
        return it;
      });

      tx.update(ref, {
        serveFlowStatus: 'READY',
        items: updatedItems,
        pickupWindow: {
            startTime: now,
            endTime: now + PICKUP_WINDOW_DURATION_MS,
            durationMs: PICKUP_WINDOW_DURATION_MS,
            status: 'COLLECTING'
        },
        updatedAt: serverTimestamp()
      });
    });
  });
};

export const updateSlotStatusV2 = async (slot: number, status: PrepBatchStatus): Promise<void> => {
    const q = query(
        collection(db, "prepBatches"),
        where("arrivalTimeSlot", "==", slot),
        where("status", "!=", "COMPLETED")
    );
    
    const querySnap = await getDocs(q);
    if (querySnap.empty) return;

    const batchIds = querySnap.docs.map(d => d.id);

    await runTransaction(db, async (tx) => {
        const now = Date.now();

        // PHASE 1: READS
        const batchRefs = batchIds.map(bid => doc(db, "prepBatches", bid));
        const batchSnaps = await Promise.all(batchRefs.map(r => tx.get(r)));

        const batchDataList: { ref: any; data: PrepBatch; idx: number }[] = [];
        const allOrderIds = new Set<string>();
        
        batchSnaps.forEach((snap, idx) => {
            if (!snap.exists()) return;
            const data = snap.data() as PrepBatch;
            if (data.status === status) return;
            batchDataList.push({ ref: batchRefs[idx], data, idx });
            (data.orderIds || []).forEach(oid => allOrderIds.add(oid));
        });

        if (batchDataList.length === 0) return;

        const orderIdArray = Array.from(allOrderIds);
        const orderRefs = orderIdArray.map(oid => doc(db, "orders", oid));
        const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

        const orderMap = new Map<string, { ref: any; snap: any }>();
        orderIdArray.forEach((oid, i) => {
            orderMap.set(oid, { ref: orderRefs[i], snap: orderSnaps[i] });
        });

        // PHASE 2: WRITES
        batchDataList.forEach(({ ref, data }) => {
            const updateObj: any = { status, updatedAt: serverTimestamp() };
            if (status === 'READY') updateObj.readyAt = now;
            tx.update(ref, updateObj);
        });

        batchDataList.forEach(({ data: batchData }) => {
            (batchData.orderIds || []).forEach(orderId => {
                const entry = orderMap.get(orderId);
                if (!entry || !entry.snap.exists()) return;

                const orderData = entry.snap.data();
                
                // V2: Subcollection write
                const itemToUpdate = orderData.items?.find((it: any) => it.id === batchData.itemId);
                if (itemToUpdate && itemToUpdate.status !== 'SERVED') {
                    const itemRef = doc(db, "orders", entry.snap.id, "items", itemToUpdate.id);
                    tx.set(itemRef, { ...itemToUpdate, status, updatedAt: serverTimestamp() }, { merge: true });
                }

                // Normal array write
                const items = (orderData.items || []).map((item: any) => {
                    if (item.id === batchData.itemId && item.status !== 'SERVED') {
                        return { ...item, status };
                    }
                    return item;
                });

                const orderUpdate: any = { serveFlowStatus: status, items, updatedAt: serverTimestamp() };
                if (status === 'READY') {
                    orderUpdate.pickupWindow = {
                        startTime: now,
                        endTime: now + PICKUP_WINDOW_DURATION_MS,
                        durationMs: PICKUP_WINDOW_DURATION_MS,
                        status: 'COLLECTING'
                    };
                }
                tx.update(entry.ref, orderUpdate);
            });
        });
    });
};
