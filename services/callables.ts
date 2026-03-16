/**
 * Cloud Functions callables for JOE Cafeteria.
 * All critical mutations (createOrder, confirmPayment, validateQRCode, serveItem, etc.)
 * go through these Callables when VITE_USE_CALLABLES is true (default in production).
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import app from "../firebase";
import type { Order } from "../types";

const functions = getFunctions(app, "us-central1");

if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === "true") {
  connectFunctionsEmulator(functions, "localhost", 5001);
}

export const createOrderCallable = httpsCallable<
  {
    userId?: string;
    userName?: string;
    items: Array<{ id: string; name: string; price: number; quantity: number; [k: string]: unknown }>;
    totalAmount: number;
    paymentType: string;
    paymentStatus?: string;
    cafeteriaId?: string;
    idempotencyKey?: string;
  },
  { orderId: string }
>(functions, "createOrder");

export const confirmPaymentCallable = httpsCallable<{ orderId: string }, { success: boolean; orderId: string }>(
  functions,
  "confirmPayment"
);

export const rejectPaymentCallable = httpsCallable<{ orderId: string }, { success: boolean; orderId: string }>(
  functions,
  "rejectPayment"
);

export const validateQRCodeCallable = httpsCallable<
  { qrPayload: string },
  { data: { success: boolean; order: Partial<Order> } }
>(functions, "validateQRCode");

export const serveItemCallable = httpsCallable<
  { orderId: string; itemId: string; servedBy?: string },
  { data: { success: boolean } }
>(functions, "serveItem");

export const updateInventoryCallable = httpsCallable<
  { itemId: string; itemName?: string; openingStock?: number; consumed?: number; category?: string; lowStockThreshold?: number },
  { data: { success: boolean } }
>(functions, "updateInventory");

export const cancelOrderCallable = httpsCallable<{ orderId: string }, { data: { success: boolean } }>(
  functions,
  "cancelOrder"
);

export const updateKitchenStatusCallable = httpsCallable<
  { orderId: string; kitchenStatus: 'PLACED' | 'COOKING' | 'READY' | 'SERVED' },
  { data: { success: boolean } }
>(functions, "updateKitchenStatus");

export const updateServeFlowStatusCallable = httpsCallable<
  { orderId: string; serveFlowStatus: 'PREPARING' | 'READY' },
  { data: { success: boolean; estimatedReadyTime?: number; pickupWindowEnd?: number } }
>(functions, "updateServeFlowStatus");

export function useCallables(): boolean {
  // Default to false for Spark (Free) plan. Explicitly set to "true" in production env if using Blaze.
  return import.meta.env.VITE_USE_CALLABLES === "true";
}
