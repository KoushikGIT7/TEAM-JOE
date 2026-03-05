
export type UserRole = 'student' | 'cashier' | 'server' | 'admin';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentType?: 'dayScholar' | 'hosteller';
  active: boolean;
  createdAt: number;
  lastActive?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  category: 'Breakfast' | 'Lunch' | 'Snacks' | 'Beverages';
  imageUrl: string;
  active: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
  servedQty?: number;
  remainingQty?: number;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'ACTIVE' | 'COMPLETED' | 'SERVED' | 'CANCELLED';
export type QRStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'PENDING_PAYMENT' | 'REJECTED';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  items: CartItem[];
  totalAmount: number;
  paymentType: 'UPI' | 'CARD' | 'CASH' | 'NET';
  paymentStatus: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REJECTED';
  orderStatus: OrderStatus;
  qrStatus: QRStatus;
  qr?: {
    token: string;
    status: 'ACTIVE' | 'USED';
    createdAt: number;
  };
  createdAt: number;
  scannedAt?: number;
  servedAt?: number;
  cafeteriaId: string;
  confirmedBy?: string;
  confirmedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
}

export interface QRData {
  orderId: string;
  userId: string;
  cafeteriaId: string;
  secureHash: string;
}

export interface SystemSettings {
  isMaintenanceMode: boolean;
  acceptingOrders: boolean;
  announcement: string;
  taxRate: number;
  minOrderValue: number;
  peakHourThreshold: number;
  autoSettlementEnabled: boolean;
}

export interface TransactionRecord {
  id: string;
  orderId: string;
  amount: number;
  type: 'UPI' | 'CARD' | 'CASH' | 'NET';
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
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
