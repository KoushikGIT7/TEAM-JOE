
/**
 * Debug utilities for QR code generation and validation
 * Use in browser console to test QR codes
 */

import { generateSecureHash, generateQRPayload, parseQRPayload, verifySecureHash } from '../services/qr';
import { Order } from '../types';

declare global {
  interface Window {
    joeQRDebug: {
      createTestOrder: () => Promise<{ order: Order; qrCode: string }>;
      validateQR: (qrData: string) => Promise<void>;
      generateQR: (orderId: string) => Promise<string | null>;
      listOrders: () => Order[];
    };
  }
}

/**
 * Create a test order with valid QR code
 */
async function createTestOrder(): Promise<{ order: Order; qrCode: string }> {
  const orderId = 'order_' + Math.random().toString(36).substr(2, 9);
  const userId = 'student_' + Math.random().toString(36).substr(2, 9);
  const createdAt = Date.now();

  const order: Order = {
    id: orderId,
    userId,
    userName: 'Test Student',
    items: [
      {
        id: 'item_1',
        name: 'Test Item',
        price: 100,
        costPrice: 50,
        category: 'Breakfast',
        imageUrl: 'https://via.placeholder.com/200x200',
        active: true,
        quantity: 1,
        servedQty: 0,
        remainingQty: 1,
        status: 'PENDING'
      }
    ],
    totalAmount: 100,
    paymentType: 'UPI',
    paymentStatus: 'SUCCESS',
    orderStatus: 'ACTIVE',
    qrStatus: 'ACTIVE',
    queueStatus: 'IN_QUEUE',
    createdAt,
    cafeteriaId: 'MAIN_CAFE'
  };

  const qrCode = await generateQRPayload(order);

  // Save to localStorage
  const orders = JSON.parse(localStorage.getItem('joe_mock_orders') || '[]');
  orders.push(order);
  localStorage.setItem('joe_mock_orders', JSON.stringify(orders));

  console.log('✅ Test order created:');
  console.log('Order ID:', orderId);
  console.log('QR Code:', qrCode);
  console.log('Copy this QR code to test scanning');

  return { order, qrCode };
}

/**
 * Validate a QR code
 */
async function validateQR(qrData: string): Promise<void> {
  try {
    const payload = await parseQRPayload(qrData);
    if (!payload) {
      console.error('❌ Invalid QR format');
      return;
    }

    console.log('📋 QR Payload:', payload);

    const orders = JSON.parse(localStorage.getItem('joe_mock_orders') || '[]');
    const order = orders.find((o: Order) => o.id === payload.orderId);

    if (!order) {
      console.error('❌ Order not found:', payload.orderId);
      console.log('Available orders:', orders.map((o: Order) => o.id));
      return;
    }

    console.log('✅ Order found:', order.id);

    const expiresAt = (payload as any).expiresAt || (order.createdAt + 24 * 60 * 60 * 1000);

    const isValid = await verifySecureHash(
      payload.orderId,
      order.userId,
      order.cafeteriaId,
      order.createdAt,
      expiresAt,
      payload.secureHash
    );

    if (isValid) {
      console.log('✅ Hash verification: PASSED');
      console.log('✅ QR code is valid');
    } else {
      console.error('❌ Hash verification: FAILED');
      const expectedHash = await generateSecureHash(
        order.id,
        order.userId,
        order.cafeteriaId,
        order.createdAt,
        expiresAt
      );
      console.log('Expected hash for order:', expectedHash);
    }
  } catch (err: any) {
    console.error('❌ Validation error:', err.message);
  }
}

/**
 * Generate QR code for existing order
 */
async function generateQR(orderId: string): Promise<string | null> {
  try {
    const orders = JSON.parse(localStorage.getItem('joe_mock_orders') || '[]');
    const order = orders.find((o: Order) => o.id === orderId);

    if (!order) {
      console.error('❌ Order not found:', orderId);
      return null;
    }

    if (order.paymentStatus !== 'SUCCESS') {
      console.error('❌ Order payment not confirmed');
      return null;
    }

    if (order.qrStatus !== 'ACTIVE') {
      console.error('❌ Order QR not active. Current status:', order.qrStatus);
      return null;
    }

    const qrCode = await generateQRPayload(order);
    console.log('✅ QR Code generated:', qrCode);
    return qrCode;
  } catch (err: any) {
    console.error('❌ Error generating QR:', err.message);
    return null;
  }
}

/**
 * List all orders
 */
function listOrders(): Order[] {
  const orders = JSON.parse(localStorage.getItem('joe_mock_orders') || '[]');
  console.log('📋 All orders:', orders);
  return orders;
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.joeQRDebug = {
    createTestOrder,
    validateQR,
    generateQR,
    listOrders
  };

  console.log('🔧 QR Debug utilities loaded. Use:');
  console.log('  window.joeQRDebug.createTestOrder() - Create test order with QR');
  console.log('  window.joeQRDebug.validateQR(qrString) - Validate QR code');
  console.log('  window.joeQRDebug.generateQR(orderId) - Generate QR for order');
  console.log('  window.joeQRDebug.listOrders() - List all orders');
}
