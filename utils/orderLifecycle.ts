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
  // Abandoned (Too many misses)
  if (order.orderStatus === 'ABANDONED' || order.pickupWindow?.status === 'ABANDONED') {
      return 'ABANDONED';
  }

  // Missed pickup window logic (Industry-grade: checks Firestore flag OR local time)
  const isTimeMissed = order.pickupWindow?.endTime ? Date.now() > order.pickupWindow.endTime : false;
  if (order.pickupWindow?.status === 'MISSED' || order.orderStatus === 'MISSED' || order.serveFlowStatus === 'MISSED' || isTimeMissed) {
    return 'MISSED';
  }

  if (order.orderStatus === 'EXPIRED') {
    return 'EXPIRED';
  }

  if (order.paymentStatus === 'FAILED' || (order.paymentStatus === 'PENDING' && order.qrStatus === 'REJECTED')) {
    return 'REJECTED';
  }

  // Cancelled
  if (order.orderStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  // Cash waiting for cashier (paymentStatus = PENDING, qrStatus not ACTIVE)
  if (order.paymentStatus === 'PENDING') {
    return 'PENDING_PAYMENT';
  }

  // Order fully served
  if (order.orderStatus === 'SERVED' || order.orderStatus === 'COMPLETED' || order.qrState === 'SERVED' || order.serveFlowStatus === 'READY_SERVED' || order.serveFlowStatus === 'SERVED') {
    return 'COMPLETED';
  }

  // QR was scanned but order not yet fully served
  if (order.qrState === 'SCANNED' || order.serveFlowStatus === 'SERVED_PARTIAL') {
    return 'SCANNED';
  }

  // QR is active and visible (only if NOT expired/served)
  if (order.paymentStatus === 'SUCCESS' && order.qrStatus === 'ACTIVE') {
    return 'QR_ACTIVE';
  }

  // Payment succeeded but QR not yet generated/not active
  if (order.paymentStatus === 'SUCCESS' && order.orderStatus === 'PENDING') {
    return 'AWAITING_QR';
  }

  // Default fallback
  return 'AWAITING_QR';
};

/**
 * Determine if QR should be visible
 * QR visible ONLY when: paymentStatus === SUCCESS AND qrStatus === ACTIVE
 * AND order is NOT in a terminal/spent state
 */
export const shouldShowQR = (order: Order): boolean => {
  // QR visible UNTIL order is SERVED or explicitly REJECTED/CANCELLED/ABANDONED
  const terminalStates = ['SERVED', 'REJECTED', 'CANCELLED', 'ABANDONED'];
  if (terminalStates.includes(order.orderStatus || '')) return false;
  
  // If fully served at items level
  const remItems = order.items?.reduce((sum, item) => sum + (item.remainingQty ?? (item.quantity - (item.servedQty || 0))), 0);
  if (remItems === 0) return false;

  if (order.qrState === 'USED' || order.qrState === 'SERVED') return false;
  
  // ⏱️ Industry-grade Timeout Guard: Hide QR after window expires
  if (order.pickupWindow?.endTime && Date.now() > order.pickupWindow.endTime) {
    return false;
  }

  return order.paymentStatus === 'SUCCESS' && order.qrStatus === 'ACTIVE';
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
      return 'Processing at Counter';
    case 'COMPLETED':
      return 'Order Completed';
    case 'REJECTED':
      return 'Payment Rejected';
    case 'CANCELLED':
      return 'Order Cancelled';
    case 'MISSED':
      return 'Missed Window - Waiting for next Batch';
    case 'ABANDONED':
      return 'Pickup Overdue - Order Abandoned';
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
    if (state === 'QR_ACTIVE' || state === 'AWAITING_QR' || state === 'PENDING_PAYMENT') {
      active.push(order);
    } else if (state === 'SCANNED') {
      scanned.push(order);
    } else if (state === 'COMPLETED') {
      completed.push(order);
    }
  });

  return { active, scanned, completed };
};

/**
 * Determine if user can go back (or if locked to QR)
 */
export const canNavigateBack = (order: Order): boolean => {
  return true; // Always allow navigating back for better UX
};

/**
 * Determine if order is in a terminal state (can't be modified)
 */
export const isOrderTerminal = (order: Order): boolean => {
  const state = getOrderUIState(order);
  const terminalStates = ['COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ABANDONED'];
  return terminalStates.includes(state);
};
