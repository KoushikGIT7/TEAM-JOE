import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { PrepBatch, Order, CartItem, PrepBatchStatus } from '../types';

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

/**
 * 3. markBatchReady
 */
export const markBatchReady = async (batchId: string): Promise<void> => {
    const batchRef = doc(db, "prepBatches", batchId);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) throw new Error("Batch not found");
    
    const batchData = batchSnap.data() as PrepBatch;
    const now = Date.now();

    await updateDoc(batchRef, {
        status: 'READY',
        readyAt: now,
        updatedAt: serverTimestamp()
    });

    const orderPromises = (batchData.orderIds || []).map(async (orderId) => {
        const orderRef = doc(db, "orders", orderId);
        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) return;
        
        const orderData = orderSnap.data() as Order;
        
        const updatedItems = (orderData.items || []).map(item => {
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
               endTime: now + 600000,
               durationMs: 600000,
               status: 'COLLECTING'
            },
            updatedAt: serverTimestamp()
        });
    });

    await Promise.all(orderPromises);
};

/**
 * 4. serveItem
 * Mutates one item natively. If all are served, complete the order.
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
 * Helper for KitchenView which manipulates whole slots at once.
 */
export const updateSlotStatus = async (slot: number, status: PrepBatchStatus): Promise<void> => {
    const q = query(
        collection(db, "prepBatches"),
        where("arrivalTimeSlot", "==", slot),
        where("status", "!=", "COMPLETED")
    );
    
    // Non-transactional read
    const querySnap = await getDocs(q);
    if (querySnap.empty) return;

    // Fast parallel execution
    const batchPromises = querySnap.docs.map(async (d) => {
        if (status === 'PREPARING') {
            await startBatchPreparation(d.id);
        } else if (status === 'READY') {
            await markBatchReady(d.id);
        } else {
            // Treat ALMOST_READY lightly (just a flag, but for strictness we use markBatchReady if needed)
            // or just update batch directly.
            await updateDoc(d.ref, { status, updatedAt: serverTimestamp() });
        }
    });

    await Promise.all(batchPromises);
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
