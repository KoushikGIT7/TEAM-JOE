/**
 * Order Lifecycle Utilities
 * Maps Firestore order states to UI states
 * Single source of truth for order status logic
 */

import { Order } from '../types';

export type OrderUIState = 
  | 'PENDING_PAYMENT'      // Awaiting payment (cash only)
  | 'PAYMENT_PROCESSING'   // Payment in progress
  | 'AWAITING_QR'          // Payment successful, QR generating
  | 'QR_ACTIVE'            // QR ready, awaiting scan
  | 'SCANNED'              // Cashier scanned QR
  | 'COMPLETED'            // Order completed/served
  | 'REJECTED'             // Payment/order rejected
  | 'CANCELLED'            // Order cancelled
  | 'MISSED'               // Missed current pickup window, reassigned
  | 'ABANDONED'            // Too many missed windows (cleanup)
  | 'EXPIRED';             // Cryptographic token expiry (rare)

export const getOrderUIState = (order: Order): OrderUIState => {
  // 🏁 TERMINAL STATES (Highest Priority)
  if (order.orderStatus === 'CANCELLED') return 'CANCELLED';
  if (order.orderStatus === 'REJECTED' || order.paymentStatus === 'FAILED') return 'REJECTED';
  if (order.orderStatus === 'ABANDONED' || order.pickupWindow?.status === 'ABANDONED') return 'ABANDONED';
  if (order.orderStatus === 'EXPIRED') return 'EXPIRED';

  // 🏆 COMPLETION CHECK (Item-Level Truth)
  // All items served = COMPLETED regardless of global status
  const allServed = order.items?.every(it => 
    it.status === 'SERVED' || 
    it.status === 'COMPLETED' || 
    (it.remainingQty === 0 && it.servedQty === it.quantity)
  );
  if (allServed || order.orderStatus === 'COMPLETED' || order.orderStatus === 'SERVED') {
    return 'COMPLETED';
  }

  // ⏱️ MISSED WINDOW
  const isTimeMissed = order.pickupWindow?.endTime ? Date.now() > order.pickupWindow.endTime : false;
  if (order.pickupWindow?.status === 'MISSED' || order.orderStatus === 'MISSED' || isTimeMissed) {
    return 'MISSED';
  }

  // 📸 SCAN-IN CHECK
  // Specifically for dynamic orders where scan isn't an instant serve
  if (order.qrState === 'SCANNED' || order.serveFlowStatus === 'SERVED_PARTIAL') {
    return 'SCANNED';
  }

  // 💰 PAYMENT STATES
  if (order.paymentStatus === 'PENDING') return 'PENDING_PAYMENT';
  
  // 📱 ACTIVE QR
  if (order.paymentStatus === 'SUCCESS' && (order.qrStatus === 'ACTIVE' || order.qrStatus === 'SCANNED')) {
    return 'QR_ACTIVE';
  }

  // ⏳ INITIAL STATES
  if (order.paymentStatus === 'SUCCESS' && order.orderStatus === 'PENDING') {
    return 'AWAITING_QR';
  }

  return 'AWAITING_QR';
};

/**
 * Determine if QR should be visible
 * QR remains visible until 100% of items are SERVED
 */
export const shouldShowQR = (order: Order): boolean => {
  const state = getOrderUIState(order);
  const hideStates = ['COMPLETED', 'REJECTED', 'CANCELLED', 'ABANDONED', 'EXPIRED'];
  if (hideStates.includes(state)) return false;

  // Final check: count unserved items
  const unservedCount = order.items?.reduce((sum, it) => {
    const isServed = it.status === 'SERVED' || it.status === 'COMPLETED' || (it.remainingQty === 0 && it.servedQty === it.quantity);
    return sum + (isServed ? 0 : 1);
  }, 0);

  if (unservedCount === 0) return false;

  // Lock QR if window expired (unless re-queued)
  if (order.pickupWindow?.endTime && Date.now() > order.pickupWindow.endTime) {
    return false;
  }

  return order.paymentStatus === 'SUCCESS' && (order.qrStatus === 'ACTIVE' || order.qrState === 'SCANNED');
};

/**
 * Get user-friendly status message
 */
export const getOrderStatusMessage = (order: Order): string => {
  const state = getOrderUIState(order);

  switch (state) {
    case 'PENDING_PAYMENT':
      return 'Awaiting Payment';
    case 'PAYMENT_PROCESSING':
      return 'Processing Payment...';
    case 'AWAITING_QR':
      return 'Generating QR...';
    case 'QR_ACTIVE':
      return 'Ready for Pickup - Show QR';
    case 'SCANNED':
      // If some items are READY and some are SCANNED, show a hybrid message
      const readyCount = order.items?.filter(it => it.status === 'READY').length;
      if (readyCount > 0) return 'READY AT COUNTER';
      return 'SCANNED - Processing Intake';
    case 'COMPLETED':
      return 'Order Completed';
    case 'REJECTED':
      return 'Payment Rejected';
    case 'CANCELLED':
      return 'Order Cancelled';
    case 'MISSED':
      return 'Re-Queuing - Waiting for Slot';
    case 'ABANDONED':
      return 'Pickup Overdue';
    case 'EXPIRED':
      return 'Token Expired';
    default:
      return 'Processing';
  }
};

/**
 * Group orders by active/scanned/completed status
 */
export const groupOrdersByStatus = (orders: Order[]): {
  active: Order[];
  scanned: Order[];
  completed: Order[];
} => {
  const active: Order[] = [];
  const scanned: Order[] = [];
  const completed: Order[] = [];

  orders.forEach(order => {
    const state = getOrderUIState(order);
    if (state === 'QR_ACTIVE' || state === 'AWAITING_QR' || state === 'PENDING_PAYMENT' || state === 'MISSED') {
      active.push(order);
    } else if (state === 'SCANNED') {
      scanned.push(order);
    } else if (['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ABANDONED'].includes(state)) {
      completed.push(order);
    }
  });

  return { active, scanned, completed };
};

export const canNavigateBack = (order: Order): boolean => true;

export const isOrderTerminal = (order: Order): boolean => {
  const state = getOrderUIState(order);
  const terminalStates = ['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ABANDONED'];
  return terminalStates.includes(state);
};
