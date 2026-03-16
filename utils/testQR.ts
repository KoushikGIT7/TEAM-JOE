
/**
 * Utility to generate valid test QR codes for testing
 */

import { generateSecureHash } from '../services/qr';

export interface TestOrderData {
  orderId: string;
  userId: string;
  cafeteriaId: string;
  createdAt: number;
}

/**
 * Generate a valid QR code payload for testing
 */
export async function generateTestQRCode(orderData: TestOrderData): Promise<string> {
  const expiresAt = orderData.createdAt + (30 * 60 * 1000); // 30 mins
  const secureHash = await generateSecureHash(
    orderData.orderId,
    orderData.userId,
    orderData.cafeteriaId,
    orderData.createdAt,
    expiresAt
  );

  const qrData = {
    orderId: orderData.orderId,
    userId: orderData.userId,
    cafeteriaId: orderData.cafeteriaId,
    secureHash: secureHash,
    expiresAt,
    createdAt: orderData.createdAt
  };

  return JSON.stringify(qrData);
}

/**
 * Create a test order and return the QR code
 */
export async function createTestOrderWithQR(): Promise<{ orderId: string; qrCode: string; orderData: TestOrderData }> {
  const orderId = 'order_' + Math.random().toString(36).substr(2, 9);
  const userId = 'student_' + Math.random().toString(36).substr(2, 9);
  const cafeteriaId = 'MAIN_CAFE';
  const createdAt = Date.now();

  const orderData: TestOrderData = {
    orderId,
    userId,
    cafeteriaId,
    createdAt
  };

  const qrCode = await generateTestQRCode(orderData);

  return {
    orderId,
    qrCode,
    orderData
  };
}
