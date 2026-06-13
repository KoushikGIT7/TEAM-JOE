export const PICKUP_TIMEOUT_MS = 200000; // ⏱️ [SENTINEL-TIMING] 3 Minutes + 20s Buffer (180s + 20s)
export const ROLES = {
  ADMIN: 'ADMIN',
  ASSISTANT_SUPERVISOR: 'ASSISTANT_SUPERVISOR',
  CASHIER: 'CASHIER',
  SERVER: 'SERVER',
  COOK: 'COOK',
  STUDENT: 'STUDENT',
  GUEST: 'GUEST',
} as const;

export type UserRole = keyof typeof ROLES;

export type StaffRole = 'CASHIER' | 'COOK' | 'SUPERVISOR' | 'SERVER' | 'ADMIN' | 'ASSISTANT_SUPERVISOR';
export type PortalMode = 'STUDENT' | 'STAFF' | 'ADMIN' | 'DEVELOPER' | 'MONITOR';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentType?: 'dayScholar' | 'hosteller';
  active: boolean;
  createdAt: number;
  lastActive?: number;
  walletBalance?: number; // Secure prepaid balance
  totalSpent?: number;    // Cumulative spent amount
  totalRecharged?: number; // Cumulative recharge amount
  points?: number;        // Loyalty points
  xp?: number;            // Experience points
  level?: number;         // Foodie level
  magicBoxProgress?: number; // Loot chest progress
  quests?: Quest[];       // Active quest tracking list
  redeemedRewards?: RedeemedReward[]; // Claimed rewards history
  escrowPoints?: number;   // Escrow pending points
  customTitle?: string;    // Custom title bought by points
  customFrameColor?: string; // Custom frame border color class
  customAvatarDecoration?: string; // Emoji avatar decoration icon
  frequency?: number;        // User order frequency
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  category: 'Breakfast' | 'Lunch' | 'Snacks' | 'Beverages';
  imageUrl: string;
  active: boolean;
  /** Zero-wait: FAST_ITEM = instant serve; PREPARATION_ITEM = kitchen + pickup window. Default from category if absent. */
  orderType?: OrderType;
  /** Kitchen routing classification */
  itemType?: 'batch' | 'dynamic';
}

export interface CartItem extends MenuItem {
  itemId: string; // 🖇️ [ID-MANIFEST] Original item code (BKT01, etc.)
  quantity: number;
  servedQty?: number;
  remainingQty?: number;
  status: 'PENDING' | 'AWAITING_READY' | 'QUEUED' | 'PREPARING' | 'READY' | 'COLLECTING' | 'MISSED' | 'MISSED_PREVIOUS' | 'SERVED' | 'READY_SERVED' | 'COMPLETED' | 'ABANDONED' | 'SERVED_PARTIAL';
}

export type OrderStatus = 'PENDING' | 'PAID' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'SERVED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED' | 'MISSED' | 'ABANDONED';
export type QRStatus = 'ACTIVE' | 'SCANNED' | 'IN_PROGRESS' | 'USED' | 'EXPIRED' | 'PENDING_PAYMENT' | 'REJECTED' | 'DESTROYED' | 'MISSED' | 'ABANDONED';
export type QRState = 'ACTIVE' | 'SCANNED' | 'IN_PROGRESS' | 'USED' | 'SERVED' | 'DESTROYED' | 'REJECTED' | 'MISSED' | 'ABANDONED';
export type OrderType = 'FAST_ITEM' | 'PREPARATION_ITEM';
export type ServeFlowStatus = 'PENDING' | 'PAID' | 'NEW' | 'QUEUED' | 'PREPARING' | 'ALMOST_READY' | 'READY' | 'SERVED_PARTIAL' | 'READY_SERVED' | 'SERVED' | 'MISSED' | 'EXPIRED' | 'ABANDONED' | 'MISSED_PREVIOUS' | 'CONSUMED' | 'MANIFESTED';

/** Kitchen workflow: PLACED → COOKING → READY → SERVED */
export type KitchenStatus = 'PLACED' | 'COOKING' | 'READY' | 'SERVED';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  items: CartItem[];
  totalAmount: number;
  paymentType: 'UPI' | 'CARD' | 'CASH' | 'NET';
  paymentStatus: 'INITIATED' | 'UTR_SUBMITTED' | 'VERIFIED' | 'FAILED' | 'SUCCESS' | 'REJECTED' | 'PENDING' | 'AWAITING_CONFIRMATION';
  queueStatus: 'NOT_IN_QUEUE' | 'IN_QUEUE';
  orderStatus: OrderStatus;
  qrStatus: QRStatus;
  tokenNumber?: string;
  rejectionReason?: string;
  cashRequestedAt?: any;
  utrLast4?: string;
  paidAt?: number;
  /** 🍳 [SONIC-JIT] Pre-order Arrival Signal */
  arrivalSignal?: 'ARRIVED' | 'PENDING';
  arrivalSignalAt?: any;

  /** 🖇️ UTR Verification Fields (Phased Testing) */
  utr?: string;
  utrSubmittedAt?: any;

  /** Zero-wait: FAST_ITEM (instant serve) vs PREPARATION_ITEM (kitchen + pickup window) */
  orderType?: OrderType;
  /** Serve flow: PAID | NEW | PREPARING | READY | SERVED */
  serveFlowStatus?: ServeFlowStatus;
  
  /** ⏱️ NEW: Pickup window logic (timer starts when READY) */
  pickupWindow?: {
    startTime?: number; // ms, set when batch moves to READY
    endTime?: number;   // ms, startTime + 7 mins
    durationMs: number; // default PICKUP_TIMEOUT_MS
    status: 'AWAITING_READY' | 'COLLECTING' | 'MISSED' | 'COMPLETED' | 'ABANDONED' | 'MISSED_PREVIOUS';
  };

  /** Selected slot (dynamic items): e.g. 1230 for 12:30 PM. Stored as integer. */
  arrivalTime?: number;
  /** Link to batch preparation (Multi-item support) */
  batchIds?: string[];
  /** Number of times this order has missed a window */
  missedCount?: number;
  /** Track history for MISSED items being moved */
  missedFromBatchId?: string;
  estimatedReadyTime?: number;
  /** Set when pickup-reminder FCM was sent (scheduled function) */
  sentPickupReminderAt?: number;
  /** Smart kitchen: preparation station (e.g. "dosa", "default") for slot control */
  preparationStationId?: string;
  /** Queue position when QUEUED (1-based); used for display and ordering */
  queuePosition?: number;
  /** When this order is expected to start preparing (QUEUED); ms */
  estimatedQueueStartTime?: number;
  /** Lifecycle state for QR (ACTIVE → SCANNED → SERVED) */
  qrState?: QRState;
  /** When QR was scanned (server) */
  qrScannedAt?: number;
  /** When QR expires (for cryptographic validity, NOT pickup timeout) */
  qrExpiresAt?: number;
  qr?: {
    token: string;
    status: 'ACTIVE' | 'USED';
    createdAt: number;
  };
  createdAt: number;
  scannedAt?: number;
  servedAt?: number;
  /** Kitchen workflow state */
  kitchenStatus?: KitchenStatus;
  cafeteriaId: string;
  confirmedBy?: string;
  confirmedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  /** Manual override for abandoned orders */
  qrRedeemable?: boolean;
  /** Audit trail of manual overrides */
  overrides?: OverrideLog[];
  /** When the student was successfully alerted (deduplication) */
  notifiedAt?: number;
  updatedAt?: number;
  streakCounted?: boolean;
  isEscrowed?: boolean;
  orderedPoints?: number;
  orderedXp?: number;
  kitchenInformed?: boolean;
  kitchenInformedAt?: number;
}

export interface QRData {
  orderId: string;
  userId: string;
  cafeteriaId: string;
  secureHash: string;
}

export interface SystemSettings {
  isMaintenanceMode?: boolean;
  acceptingOrders?: boolean;
  /** Fail-safe: when false, students cannot create orders */
  orderingEnabled?: boolean;
  announcement?: string;
  taxRate?: number;
  minOrderValue?: number;
  peakHourThreshold?: number;
  autoSettlementEnabled?: boolean;
  /** Orders per minute (for queue wait estimate). Default 10. */
  servingRatePerMin?: number;
  /** QR validity in minutes. Default 30. */
  menuVersion?: any;
  qrExpiryMinutes?: number;
  /** Max volume per arrival slot across all items. Default 200. */
  maxItemsPerSlot?: number;
  /** Kitchen Panic Button Delay (in minutes) */
  globalDelayMins?: number;

  // New UI Config compatibility fields
  systemEnabled?: boolean;
  upiId?: string;
  upiQrCode?: string;
  lowBalanceThreshold?: number;
  pilotNotification?: string;
  maintenanceMode?: boolean;
  orderFlowAccepting?: boolean;
  orderingFailSafe?: boolean;
  autoDailySettlement?: boolean;
}

export interface OverrideLog {
  staffId: string;
  reason: string;
  timestamp: number;
}

export interface TransactionRecord {
  id: string;
  orderId: string;
  amount: number;
  type: 'UPI' | 'CARD' | 'CASH' | 'NET';
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'INITIATED' | 'AUTHORIZED';
  createdAt: number;
}

export interface Cafeteria {
  id: string;
  name: string;
  counters: number;
  active: boolean;
  todayOrders?: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface InventoryItem {
  itemId: string;
  itemName: string;
  openingStock: number;
  consumed: number;
  lastUpdated: number;
  category: string;
}

/** Real-time inventory meta for students (totalStock, consumed from shard aggregation, lowStockThreshold) */
export interface InventoryMetaItem {
  itemId: string;
  totalStock: number;
  consumed: number;
  lowStockThreshold: number;
  /** Cached: totalStock - consumed (reduces client computation and bandwidth) */
  available?: number;
  /** Cached: AVAILABLE | LOW_STOCK | OUT_OF_STOCK (set by Cloud Functions) */
  stockStatus?: StockStatus;
  itemName?: string;
  category?: string;
}

/** Stock visibility: AVAILABLE | LOW_STOCK | OUT_OF_STOCK */
export type StockStatus = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ScanLog {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  scannedBy: string;
  scanTime: number;
  scanResult: 'SUCCESS' | 'FAILURE';
  totalAmount: number;
  failureReason?: string;
}

export interface DailyReport {
  id: string;
  date: string;
  totalOrders: number;
  totalRevenue: number;
  onlineRevenue: number;
  cashRevenue: number;
  pnl: number;
}

export interface ServeLog {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  quantityServed: number;
  servedBy: string;
  servedAt: number;
}

export type PrepBatchStatus = 'QUEUED' | 'PREPARING' | 'ALMOST_READY' | 'READY' | 'COMPLETED';

export interface PrepBatch {
  id: string;
  /** 🍱 [STATION-AFFINITY] Maps this production unit to a kitchen workstation */
  stationId?: string;
  /** 🍳 [ELITE-UPGRADE] Multi-item variety mix for the Pan */
  items: {
    orderId: string;
    itemId: string;
    name: string;
    quantity: number;
    userName?: string;
  }[];
  status: PrepBatchStatus;
  readyAt?: number;
  createdAt: number;
  updatedAt: number;
  /** Legacy fields for broad compatibility */
  itemId?: string;
  itemName?: string;
  quantity?: number;
  orderIds?: string[];
  arrivalTimeSlot?: number;
}

export interface SystemMaintenance {
  lastHeartbeatAt: number;
  activeNodeId: string;
}

// ─── JOE WALLET TYPES ────────────────────────────────────────────────────────

/** Status of a student wallet recharge request */
export type RechargeStatus = 'pending' | 'approved' | 'rejected';

/** Type of wallet transaction */
export type WalletTransactionType = 'credit' | 'debit';

/** Reason for a wallet transaction */
export type WalletTransactionReason = 'wallet_recharge' | 'order_purchase' | 'refund' | 'adjustment';

/**
 * A student's request to recharge their wallet.
 * Created by the student; approved/rejected by cashier/admin.
 */
export interface WalletRechargeRequest {
  id: string;
  uid: string;
  studentName: string;
  amount: number;
  screenshotUrl: string;
  status: RechargeStatus;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionNote?: string;
  utrNumber?: string;
}

/**
 * An auditable wallet transaction record.
 * Created by the wallet service inside Firestore transactions — never directly from the client.
 */
export interface WalletTransaction {
  id: string;
  uid: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  reason: WalletTransactionReason;
  orderId?: string;
  rechargeRequestId?: string;
  createdAt: number;
}

/**
 * Wallet summary stored on the user document.
 * These fields are managed by wallet.ts service — never directly editable.
 */
export interface WalletSummary {
  walletBalance: number;
  totalRecharged: number;
  totalSpent: number;
}

// --- Gamification & Loyalty Types ---
export interface LeaderboardUser {
  rank?: number;
  name: string;
  avatar: string;
  points: number;
  level: number;
  isCurrentUser?: boolean;
  frequency: number;
  title: string;
  frameColor?: string;
  avatarDecoration?: string;
}

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
