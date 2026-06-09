import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PrepBatch, Order } from '../types';
import { finalizeBatch, serveItem } from './firestore-db';

/**
 * 🚀 [STAFF-V3-BRAIN]
 * Specialized logic for the new 3-tab high-performance system.
 */

/**
 * Automatically releases the next N items for a specific itemId.
 * It searches across active prepBatches for that item.
 */
export const releaseBatchByItem = async (itemId: string, count: number): Promise<void> => {
  if (count <= 0) return;

  // 1. Find active prepBatches for this item (PREPARING then QUEUED)
  const q = query(
    collection(db, 'prepBatches'),
    where('itemId', '==', itemId),
    where('status', 'in', ['PREPARING', 'QUEUED']),
    orderBy('status', 'desc'), // PREPARING first ('P' > 'Q')
    orderBy('createdAt', 'asc'),
    limit(5)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    console.warn(`No active batches found for item: ${itemId}`);
    return;
  }

  let remainingToRelease = count;
  
  for (const bDoc of snap.docs) {
    if (remainingToRelease <= 0) break;
    const bData = bDoc.data() as PrepBatch;
    const batchItems = bData.items || [];
    const availableInBatch = batchItems.length;

    if (availableInBatch === 0) continue;

    const toReleaseFromThisBatch = Math.min(remainingToRelease, availableInBatch);
    
    // Use existing finalizeBatch logic which handles partial release
    // NOTE: finalizeBatch expects (batchId, items, limitCount)
    await finalizeBatch(bDoc.id, batchItems, toReleaseFromThisBatch);
    
    remainingToRelease -= toReleaseFromThisBatch;
  }
};

/**
 * Listener for aggregate counts of items in different states.
 * Used by the Server Tab to show "Ready: 5, Queued: 12".
 */
export const listenToItemAggregates = (callback: (aggregates: Record<string, { ready: number, queued: number }>) => void) => {
  // We listen to prepBatches to get the most accurate production state
  const q = query(
    collection(db, 'prepBatches'),
    where('status', 'in', ['QUEUED', 'PREPARING', 'READY']),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    const aggregates: Record<string, { ready: number, queued: number }> = {};
    
    snap.docs.forEach(d => {
      const data = d.data() as PrepBatch;
      const itemId = data.itemId;
      if (!itemId) return;

      if (!aggregates[itemId]) {
        aggregates[itemId] = { ready: 0, queued: 0 };
      }

      const itemUnits = (data.items || []).length || data.quantity || 0;

      if (data.status === 'READY') {
        aggregates[itemId].ready += itemUnits;
      } else {
        aggregates[itemId].queued += itemUnits;
      }
    });

    callback(aggregates);
  });
};

/**
 * Instant serve for beverages (Fast Lane).
 * Directly moves an item from whatever status it was to SERVED.
 */
export const instantBeverageServe = async (orderId: string, itemId: string, staffId: string): Promise<void> => {
   // Beverages often bypass READY state and go straight to SERVED
   // Reuse our production-hardened serveItem function
   await serveItem(orderId, itemId, staffId);
};

/**
 * 🚀 [DYNAMIC-ITEMS]
 * Moves exactly `count` items across the oldest pending orders to READY state.
 * Preserves the QR unlock and Notification workflows without over-releasing.
 */
export const markPartialItemsReady = async (itemName: string, count: number, pendingOrders: Order[]): Promise<void> => {
  if (count <= 0 || pendingOrders.length === 0) return;

  // Sort by oldest first to ensure fairness (respecting reQueued penalties)
  const sortedOrders = [...pendingOrders].sort((a, b) => {
    // We need to find the target item to get its specific reQueuedAt time
    const aItem = a.items.find(i => i.name === itemName);
    const bItem = b.items.find(i => i.name === itemName);
    const aTime = (aItem as any)?.reQueuedAt ? (typeof (aItem as any).reQueuedAt === 'number' ? (aItem as any).reQueuedAt : (aItem as any).reQueuedAt.toMillis?.() || Date.now()) : a.createdAt;
    const bTime = (bItem as any)?.reQueuedAt ? (typeof (bItem as any).reQueuedAt === 'number' ? (bItem as any).reQueuedAt : (bItem as any).reQueuedAt.toMillis?.() || Date.now()) : b.createdAt;
    return aTime - bTime;
  });
  
  // Take exactly 'count' orders
  const ordersToUpdate = sortedOrders.slice(0, count);
  const now = Date.now();

  const promises = ordersToUpdate.map(async (order) => {
    // Only update the target item within the order
    let updatedItemCount = 0;
    const updatedItems = order.items.map(item => {
      // If we found the item, and it's not already READY/SERVED, mark it READY
      if (item.name === itemName && item.status !== 'SERVED' && item.status !== 'READY') {
        updatedItemCount++;
        return { ...item, status: 'READY' as any };
      }
      return item;
    });

    if (updatedItemCount === 0) return; // Failsafe

    const orderRef = doc(db, 'orders', order.id);
    
    // We update serveFlowStatus to READY so it appears in the collection tab
    // We also init/update pickupWindow to trigger the QR flow
    const pickupWindow = order.pickupWindow?.status === 'COLLECTING' 
      ? order.pickupWindow 
      : {
          startTime: now,
          endTime: now + 300000, // 5 minutes strict
          durationMs: 300000,
          status: 'COLLECTING'
        };

    await updateDoc(orderRef, {
      items: updatedItems,
      serveFlowStatus: 'READY',
      pickupWindow: pickupWindow,
      updatedAt: serverTimestamp()
    });
  });

  await Promise.all(promises);
};
