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
  | 'CANCELLED';           // Order cancelled

/**
 * Map Firestore order state to UI state
 * This is the ONLY function that determines what UI to show
 */
export const getOrderUIState = (order: Order): OrderUIState => {
  // Rejected states
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

  // QR is active and visible (most important - show QR as soon as payment succeeds)
  if (order.paymentStatus === 'SUCCESS' && order.qrStatus === 'ACTIVE') {
    return 'QR_ACTIVE';
  }

  // Payment succeeded but QR not yet generated/not active
  if (order.paymentStatus === 'SUCCESS' && order.orderStatus === 'PENDING') {
    return 'AWAITING_QR';
  }

  // QR was scanned but order not yet fully served
  if (order.qrState === 'SCANNED') {
    return 'SCANNED';
  }

  // Order fully served
  if (order.orderStatus === 'SERVED' || order.qrState === 'SERVED') {
    return 'COMPLETED';
  }

  // Default fallback
  return 'AWAITING_QR';
};

/**
 * Determine if QR should be visible
 * QR visible ONLY when: paymentStatus === SUCCESS AND qrStatus === ACTIVE
 * orderStatus does not block QR visibility
 */
export const shouldShowQR = (order: Order): boolean => {
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
      return 'Order Accepted';
    case 'COMPLETED':
      return 'Order Completed';
    case 'REJECTED':
      return 'Payment Rejected';
    case 'CANCELLED':
      return 'Order Cancelled';
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
  return state === 'COMPLETED' || state === 'REJECTED' || state === 'CANCELLED';
};
