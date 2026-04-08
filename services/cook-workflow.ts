import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { PrepBatch, Order, CartItem, PrepBatchStatus } from '../types';
import { STATION_ID_BY_ITEM_ID } from '../constants';

/**
 * 1. createBatchFromOrder (Internal Helper conceptually mapping to your Example 1)
 * Extracts items from an order and groups them into batches.
 */
export const createBatchFromOrder = async (orderId: string, item: CartItem, slot: number): Promise<void> => {
    const batchId = `batch_${slot}_${item.id}`;
    const batchRef = doc(db, "prepBatches", batchId);
    const snap = await getDoc(batchRef);

    if (!snap.exists()) {
        await setDoc(batchRef, {
            id: batchId,
            itemId: item.id,
            itemName: item.name,
            stationId: STATION_ID_BY_ITEM_ID[item.id] || 'kitchen',
            arrivalTimeSlot: slot,
            orderIds: [orderId],
            quantity: item.quantity,
            status: 'QUEUED',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } else {
        const data = snap.data() as PrepBatch;
        await updateDoc(batchRef, {
            orderIds: [...new Set([...(data.orderIds || []), orderId])],
            quantity: data.quantity + item.quantity,
            updatedAt: serverTimestamp()
        });
    }
};

/**
 * 2. startBatchPreparation
 * NO TRANSACTIONS. Pure Promise.all speed.
 */
export const startBatchPreparation = async (batchId: string): Promise<void> => {
    const batchRef = doc(db, "prepBatches", batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    const batchData = batchSnap.data() as PrepBatch;

    // Fast Parent Update
    await updateDoc(batchRef, {
        status: 'PREPARING',
        updatedAt: serverTimestamp()
    });

    // Parallel Sub-Updates for orders (Max 1 read per order)
    const orderPromises = (batchData.orderIds || []).map(async (orderId) => {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) return;
        
        const orderData = orderSnap.data() as Order;
        
        // Mutate specifically the matching items
        const updatedItems = (orderData.items || []).map(item => {
            if (item.id === batchData.itemId && item.status !== 'SERVED') {
                return { ...item, status: 'PREPARING' as any };
            }
            return item;
        });

        return updateDoc(orderRef, {
            serveFlowStatus: 'PREPARING',
            items: updatedItems,
            updatedAt: serverTimestamp()
        });
    });

    await Promise.all(orderPromises);
};

export const markBatchReady = async (batchId: string, limitCount?: number): Promise<void> => {
    const batchRef = doc(db, "prepBatches", batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    
    const batchData = batchSnap.data() as PrepBatch;
    const now = Date.now();

    // 1. Fetch connected orders to find which ones are actually pending
    const orderRefs = (batchData.orderIds || []).map(oId => doc(db, "orders", oId));
    const orderSnaps = await Promise.all(orderRefs.map(r => getDoc(r)));
    
    // 2. Identify orders whose target item is STILL NOT READY
    let pendingOrders: { ref: any, data: Order }[] = [];
    for (const snap of orderSnaps) {
        if (!snap.exists()) continue;
        const oData = snap.data() as Order;
        const targetItem = oData.items?.find((i:any) => i.id === batchData.itemId);
        // Only target items that need cooking/releasing
        if (targetItem && (targetItem.status === 'PENDING' || targetItem.status === 'PREPARING')) {
            pendingOrders.push({ ref: snap.ref, data: oData });
        }
    }

    // 3. Slice the exact amount of limitCount from the genuinely pending unfulfilled orders
    if (limitCount && pendingOrders.length > limitCount) {
        pendingOrders = pendingOrders.slice(0, limitCount);
    }

    if (pendingOrders.length === 0) {
        // [DEFENSE] Batch is orphaned or entirely fulfilled already. Auto-complete the bucket.
        await updateDoc(batchRef, {
            status: 'COMPLETED',
            quantity: 0,
            updatedAt: serverTimestamp()
        });
        return;
    }

    // Determine if batch is fully completed based on remaining unfulfilled amount
    const remainingUnfulfilled = (batchData.quantity || 0) - pendingOrders.length;
    const isPartial = remainingUnfulfilled > 0;

    await updateDoc(batchRef, {
        status: isPartial ? 'PREPARING' : 'READY', 
        readyAt: now,
        quantity: Math.max(0, remainingUnfulfilled), // Decrement the batch bucket strictly
        updatedAt: serverTimestamp(),
    });

    const orderPromises = pendingOrders.map(async ({ ref: orderRef, data: orderData }) => {
        const updatedItems = (orderData.items || []).map((item: any) => {
            if (item.id === batchData.itemId && item.status !== 'SERVED') {
                return { ...item, status: 'READY' as any };
            }
            return item;
        });

        return updateDoc(orderRef, {
            serveFlowStatus: 'READY',
            items: updatedItems,
            pickupWindow: {
               startTime: now,
               endTime: now + 420000,
               durationMs: 420000,
               status: 'COLLECTING'
            },
            updatedAt: serverTimestamp()
        });
    });

    await Promise.all(orderPromises);
};

/**
 * 4. serveItem
 */
export const serveItem = async (orderId: string, itemId: string): Promise<void> => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found");
    
    const orderData = orderSnap.data() as Order;
    let allServed = true;

    const updatedItems = (orderData.items || []).map(item => {
        if (item.id === itemId) {
            item.status = 'SERVED';
            item.servedQty = item.quantity;
            item.remainingQty = 0;
        }
        if (item.status !== 'SERVED') {
             allServed = false;
        }
        return item;
    });

    await updateDoc(orderRef, {
        items: updatedItems,
        serveFlowStatus: allServed ? 'SERVED' : 'SERVED_PARTIAL',
        orderStatus: allServed ? 'COMPLETED' : orderData.orderStatus,
        updatedAt: serverTimestamp()
    });
};

/**
 * 5. updateSlotStatus 
 * Helper for KitchenView which manipulates whole slots or partial batches.
 */
export const updateSlotStatus = async (slot: number, status: PrepBatchStatus, size?: number): Promise<void> => {
    const q = query(
        collection(db, "prepBatches"),
        where("arrivalTimeSlot", "==", slot)
    );
    
    const querySnap = await getDocs(q);
    if (querySnap.empty) return;

    const validBatches = querySnap.docs.filter(d => d.data().status !== 'COMPLETED');

    const batchPromises = validBatches.map(async (d) => {
        if (status === 'PREPARING') {
            await startBatchPreparation(d.id);
        } else if (status === 'READY') {
            await markBatchReady(d.id, size);
        } else {
            await updateDoc(d.ref, { status, updatedAt: serverTimestamp() });
        }
    });

    await Promise.all(batchPromises);
};

/**
 * 7. healBatchData
 * Repairs 'unnamed' items in the kitchen by recovering names from orders.
 */
export const healBatchData = async (): Promise<void> => {
    const q = query(collection(db, "prepBatches"), where("itemName", "==", ""));
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
        const data = d.data();
        if (data.orderIds && data.orderIds.length > 0) {
            const firstOrderRef = doc(db, "orders", data.orderIds[0]);
            const oSnap = await getDoc(firstOrderRef);
            if (oSnap.exists()) {
                const oData = oSnap.data();
                const item = oData.items?.find((i: any) => i.id === data.itemId);
                if (item?.name) {
                    await updateDoc(d.ref, { itemName: item.name });
                    console.log(`Healed item ${data.itemId} name to ${item.name}`);
                }
            }
        }
    }
};

/**
 * 6. requeueMissedOrder
 * When an order is missed, we reset it to PENDING and move it to the next slot
 * so it reappears in the Cook Console.
 */
export const requeueMissedOrder = async (orderId: string): Promise<void> => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return;

    const data = orderSnap.data() as Order;
    
    // Calculate Next Slot (Current time rounded UP to next 15-min interval)
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const nextSlotMins = Math.ceil((currentMins + 5) / 15) * 15; // 5 min buffer
    const slotH = Math.floor(nextSlotMins / 60);
    const slotM = nextSlotMins % 60;
    const nextSlot = Number(`${slotH.toString().padStart(2, '0')}${slotM.toString().padStart(2, '0')}`);

    const updatedItems: CartItem[] = (data.items || []).map(it => {
        // If it was READY but missed, it needs to be made again (or re-staged)
        if (it.status === 'READY' || it.status === 'MISSED') {
            return { ...it, status: 'PENDING' } as CartItem;
        }
        return it as CartItem;
    });

    // 5. Update the Order manifest
    await updateDoc(orderRef, {
        orderStatus: 'ACTIVE',
        serveFlowStatus: 'PENDING',
        qrStatus: 'ACTIVE', // Reactivate the QR
        arrivalTimeSlot: nextSlot,
        items: updatedItems,
        'pickupWindow.status': 'MISSED_PREVIOUS', // Audit trail
        updatedAt: serverTimestamp()
    });
    
    // 6. Integrate with Kitchen Batches (The "Re-Batching" step)
    // Create or Update PrepBatches for the NEW slot so they show up in KitchenView
    const batchPromises = updatedItems.map(it => createBatchFromOrder(orderId, it, nextSlot));
    await Promise.all(batchPromises);

    console.log(`🔄 Re-queued and Re-batched Order ${orderId} to Slot ${nextSlot}`);
};
