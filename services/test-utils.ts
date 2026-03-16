
import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateQRPayloadSync } from './qr';
import { INITIAL_MENU } from '../constants';

/**
 * Creates multiple "READY" orders for testing scanning efficiency.
 */
export const seedReadyOrders = async (count: number = 3) => {
  console.log(`🚀 Seeding ${count} READY orders...`);
  
  const payloads: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const orderId = `test_order_${Date.now()}_${i}`;
    const createdAt = Date.now();
    
    // Select 1-3 random items from menu
    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedItems = [];
    let total = 0;
    
    for(let j=0; j<numItems; j++) {
        const menuItem = INITIAL_MENU[Math.floor(Math.random() * INITIAL_MENU.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        selectedItems.push({
            ...menuItem,
            quantity: qty,
            servedQty: 0,
            remainingQty: qty
        });
        total += menuItem.price * qty;
    }
    
    const orderData = {
      id: orderId,
      userId: 'test_student_user',
      userName: `Test Student ${i + 1}`,
      cafeteriaId: 'cafeteria_01',
      items: selectedItems,
      totalAmount: total,
      paymentType: 'CASH',
      paymentStatus: 'SUCCESS',
      orderStatus: 'READY',
      qrStatus: 'ACTIVE',
      qrState: 'SCANNED',
      scannedAt: serverTimestamp(), // Critical for active orders listener
      createdAt,
      updatedAt: serverTimestamp(),
      qr: {
        status: 'ACTIVE',
        createdAt
      }
    };
    
    await setDoc(doc(db, 'orders', orderId), orderData);
    
    const payload = generateQRPayloadSync(orderData as any);
    payloads.push(payload);
    
    console.log(`✅ Created Order: ${orderId} (${numItems} items)`);
  }
  
  return payloads;
};
