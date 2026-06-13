/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  costPrice?: number; // Raw cost price of ingredients
  category: string;
  image: string;
  isFast: boolean; // True for instant pickup items, false for kitchen-cooked meals
  stock: number;
  initialStock: number;
}

export type OrderStatus = 'QUEUED' | 'COOKING' | 'READY' | 'SERVED';

export interface OrderItemInfo {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  studentName: string;
  studentEmail: string;
  items: OrderItemInfo[];
  total: number;
  status: OrderStatus;
  tokenNumber: string; // e.g. '#204'
  timestamp: string;
  paymentMethod: 'WALLET' | 'CASH' | 'UPI';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  isGoogleUser: boolean;
  collectedItems: { [menuItemId: string]: boolean }; // Track per-item handovers
  discountApplied?: number;
  discountDesc?: string;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: string;
  balanceAfter: number;
}

export interface RechargeRequest {
  id: string;
  studentName: string;
  studentEmail: string;
  amount: number;
  screenshotUrl: string; // reference to virtual uploaded receipt
  utrNumber: string; // Unique Transaction Reference
  timestamp: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface SystemSettings {
  systemEnabled: boolean;
  upiId: string;
  upiQrCode: string;
  lowBalanceThreshold: number;
  pilotNotification: string;
  maintenanceMode?: boolean;
  orderFlowAccepting?: boolean;
  orderingFailSafe?: boolean;
  autoDailySettlement?: boolean;
  taxRate?: number;
  minOrderValue?: number;
  peakHourThreshold?: number;
}

export type StaffRole = 'CASHIER' | 'COOK' | 'SUPERVISOR' | 'SERVER' | 'ADMIN';

export type PortalMode = 'STUDENT' | 'STAFF' | 'ADMIN' | 'DEVELOPER' | 'MONITOR';

export interface LeaderboardUser {
  rank?: number;
  name: string;
  avatar: string;
  points: number;
  level: number;
  isCurrentUser?: boolean;
  frequency: number;
  title: string;
}

export interface StaffUser {
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
}

// --- Gamification & Loyalty ---
export interface Quest {
  id: string;
  title: string;
  description: string;
  points: number;
  progress: number;
  target: number;
  type: 'ACTIVE' | 'ARCHIVED';
  endsIn?: string;
  badge?: string;
  badgeColor?: string;
  completedAt?: string;
}

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  image: string;
  badge?: string;
  category: 'DRINKS' | 'MEALS' | 'EXCLUSIVE';
}

export interface RedeemedReward {
  id: string;
  rewardId: string;
  name: string;
  pointsCost: number;
  timestamp: string;
  code: string;
  status: 'ACTIVE' | 'USED';
}

