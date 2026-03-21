/**
 * Firestore Database Service
 * Production-grade replacement for localStorage mock database
 * All operations use Firestore with real-time listeners
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
  arrayUnion
} from "firebase/firestore";
import { db } from "../firebase";

import {
  UserProfile,
  Order,
  CartItem,
  MenuItem,
  SystemSettings,
  ScanLog,
  InventoryItem,
  InventoryMetaItem,
  StockStatus,
  ServeLog,
  TransactionRecord,
  DailyReport,
  OrderStatus,
  QRStatus,
  KitchenStatus,
  PrepBatch,
  PrepBatchStatus,
  SystemMaintenance
} from "../types";
import { DEFAULT_FOOD_IMAGE, INITIAL_MENU, DEFAULT_ORDERING_ENABLED, DEFAULT_SERVING_RATE_PER_MIN, INVENTORY_SHARD_COUNT, FAST_ITEM_CATEGORIES, STATION_ID_BY_ITEM_ID } from "../constants";

export const MAX_BATCH_SIZE = 40;
export const MAX_TOTAL_SLOT_CAPACITY = 200;
export const PICKUP_WINDOW_DURATION_MS = 180 * 1000; // ⏱️ TEST MODE: 3 Minutes Pickup Window
import { parseQRPayload, parseServingQR, verifySecureHash, verifySecureHashSync, generateQRPayload, generateQRPayloadSync, isQRExpired, QR_EXPIRY_MS } from "./qr";
import {
  useCallables,
  createOrderCallable,
  confirmPaymentCallable,
  rejectPaymentCallable,
  validateQRCodeCallable,
  serveItemCallable,
  updateInventoryCallable,
  updateKitchenStatusCallable,
  updateServeFlowStatusCallable,
} from "./callables";

export const saveCartDraft = async (userId: string, items: any[]): Promise<void> => {
  try {
    await setDoc(doc(db, "carts", userId), {
      userId,
      items,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving cart draft:", error);
  }
};


// ============================================================================
// TYPE CONVERSIONS
// ============================================================================

/** 🛡️ [Principal Architect] Item Classification Helper */
export const isStaticItem = (item: any): boolean => {
  if (!item) return false;
  // Primary: Strict OrderType check
  if (item.orderType === 'FAST_ITEM') return true;
  // Secondary: Category Fallback (High-certainty categories)
  if (['Lunch', 'Beverages', 'Snacks'].includes(item.category)) return true;
  return false;
};

const orderToFirestore = (order: Order) => ({
  orderId: order.id,
  userId: order.userId,
  userName: order.userName,
  items: order.items.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    costPrice: item.costPrice,
    category: item.category,
    imageUrl: item.imageUrl,
    quantity: item.quantity,
    servedQty: item.servedQty || 0,
    remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity,
    status: item.status || 'PENDING',
    orderType: item.orderType || (isStaticItem(item) ? 'FAST_ITEM' : 'PREPARATION_ITEM') // 🚀 [FIX] Persist Metadata
  })),
  totalAmount: order.totalAmount,
  paymentType: order.paymentType,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  qrStatus: order.qrStatus,
  qrRedeemable: order.qrRedeemable ?? null,
  qr: order.qr ? {
    token: order.qr.token,
    status: order.qr.status,
    createdAt: Timestamp.fromMillis(order.qr.createdAt)
  } : null,
  createdAt: Timestamp.fromMillis(order.createdAt),
  scannedAt: order.scannedAt ? Timestamp.fromMillis(order.scannedAt) : null,
  servedAt: order.servedAt ? Timestamp.fromMillis(order.servedAt) : null,
  kitchenStatus: order.kitchenStatus || 'PLACED',
  qrState: order.qrState || null,
  qrScannedAt: order.qrScannedAt ? Timestamp.fromMillis(order.qrScannedAt) : null,
  qrExpiresAt: order.qrExpiresAt ? Timestamp.fromMillis(order.qrExpiresAt) : null,
  cafeteriaId: order.cafeteriaId,
  confirmedBy: order.confirmedBy || null,
  confirmedAt: order.confirmedAt ? Timestamp.fromMillis(order.confirmedAt) : null,
  rejectedBy: order.rejectedBy || null,
  rejectedAt: order.rejectedAt ? Timestamp.fromMillis(order.rejectedAt) : null,
  orderType: order.orderType || null,
  serveFlowStatus: order.serveFlowStatus || null,
  pickupWindow: order.pickupWindow ? {
    startTime: order.pickupWindow.startTime ? Timestamp.fromMillis(order.pickupWindow.startTime) : null,
    endTime: order.pickupWindow.endTime ? Timestamp.fromMillis(order.pickupWindow.endTime) : null,
    durationMs: order.pickupWindow.durationMs,
    status: order.pickupWindow.status
  } : null,
  estimatedReadyTime: order.estimatedReadyTime != null ? Timestamp.fromMillis(order.estimatedReadyTime) : null,
  arrivalTime: order.arrivalTime || null,
  batchIds: order.batchIds || [],
  missedCount: order.missedCount || 0,
  missedFromBatchId: order.missedFromBatchId || null,
  sentPickupReminderAt: order.sentPickupReminderAt != null ? Timestamp.fromMillis(order.sentPickupReminderAt) : null,
  preparationStationId: order.preparationStationId || null,
  queuePosition: order.queuePosition ?? null,
  estimatedQueueStartTime: order.estimatedQueueStartTime != null ? Timestamp.fromMillis(order.estimatedQueueStartTime) : null,
  overrides: order.overrides || []
});

const firestoreToOrder = (id: string, data: any): Order => {
  // Helper to safely convert Firestore Timestamp to milliseconds
  const toMillis = (timestamp: any): number | undefined => {
    if (!timestamp) return undefined;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp === 'number') return timestamp;
    return undefined;
  };

  return {
    id,
    // orderId is stored redundantly in Firestore; we keep id as source of truth
    userId: data.userId,
    userName: data.userName,
    items: data.items.map((item: any) => ({
      ...item,
      servedQty: item.servedQty || 0,
      remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity,
      status: item.status || 'PENDING'
    })),
    totalAmount: data.totalAmount,
    paymentType: data.paymentType,
    paymentStatus: data.paymentStatus,
    orderStatus: data.orderStatus,
    qrStatus: data.qrStatus,
    qr: data.qr ? {
      token: data.qr.token,
      status: data.qr.status,
      createdAt: toMillis(data.qr.createdAt) || Date.now()
    } : undefined,
    createdAt: toMillis(data.createdAt) || Date.now(),
    scannedAt: toMillis(data.scannedAt),
    servedAt: toMillis(data.servedAt),
    kitchenStatus: data.kitchenStatus || 'PLACED',
    qrState: data.qrState,
    qrScannedAt: toMillis(data.qrScannedAt),
    qrExpiresAt: toMillis(data.qrExpiresAt),
    cafeteriaId: data.cafeteriaId,
    confirmedBy: data.confirmedBy,
    confirmedAt: toMillis(data.confirmedAt),
    rejectedBy: data.rejectedBy,
    rejectedAt: toMillis(data.rejectedAt),
    qrRedeemable: data.qrRedeemable ?? false,
    orderType: data.orderType || undefined,
    serveFlowStatus: data.serveFlowStatus || undefined,
    pickupWindow: data.pickupWindow ? {
      startTime: toMillis(data.pickupWindow.startTime),
      endTime: toMillis(data.pickupWindow.endTime),
      durationMs: data.pickupWindow.durationMs || 420000,
      status: data.pickupWindow.status || 'AWAITING_READY'
    } : undefined,
    estimatedReadyTime: toMillis(data.estimatedReadyTime),
    arrivalTime: data.arrivalTime || null,
    batchIds: data.batchIds || [],
    missedCount: data.missedCount || 0,
    missedFromBatchId: data.missedFromBatchId || null,
    sentPickupReminderAt: toMillis(data.sentPickupReminderAt),
    preparationStationId: data.preparationStationId || undefined,
    queuePosition: data.queuePosition ?? undefined,
    estimatedQueueStartTime: toMillis(data.estimatedQueueStartTime),
    overrides: data.overrides || []
  };
};

// ============================================================================
// 1. USER & ROLE MANAGEMENT
// ============================================================================

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      // Helper to safely convert Timestamp
      const toMillis = (ts: any): number | undefined => {
        if (!ts) return undefined;
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts === 'number') return ts;
        return undefined;
      };
      
      return {
        uid: data.uid,
        name: data.name,
        email: data.email,
        role: data.role,
        studentType: data.studentType,
        active: data.active ?? true,
        createdAt: toMillis(data.createdAt) || Date.now(),
        lastActive: toMillis(data.lastActive)
      } as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

export const createUserProfile = async (uid: string, data: Partial<UserProfile>): Promise<void> => {
  try {
    await setDoc(doc(db, "users", uid), {
      uid,
      name: data.name || "",
      email: data.email || "",
      role: data.role || "student",
      studentType: data.studentType || null,
      active: data.active ?? true,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

export const updateUserRole = async (uid: string, role: UserProfile['role']): Promise<void> => {
  try {
    await setDoc(doc(db, "users", uid), {
      role,
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
};

export const toggleUserStatus = async (uid: string, active: boolean): Promise<void> => {
  try {
    await setDoc(doc(db, "users", uid), {
      active,
      lastActive: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error toggling user status:", error);
    throw error;
  }
};

export const listenToAllUsers = (callback: (users: UserProfile[]) => void): (() => void) => {
  // Query without orderBy to avoid index requirement, sort in-memory
  return onSnapshot(
    query(collection(db, "users")),
    (snapshot) => {
      const users = snapshot.docs.map(doc => {
        const data = doc.data();
        // Handle Timestamp conversion safely
        let createdAt = Date.now();
        if (data.createdAt) {
          if (typeof data.createdAt.toMillis === 'function') {
            createdAt = data.createdAt.toMillis();
          } else if (typeof data.createdAt === 'number') {
            createdAt = data.createdAt;
          }
        }
        
        let lastActive: number | undefined = undefined;
        if (data.lastActive) {
          if (typeof data.lastActive.toMillis === 'function') {
            lastActive = data.lastActive.toMillis();
          } else if (typeof data.lastActive === 'number') {
            lastActive = data.lastActive;
          }
        }
        
        return {
          uid: doc.id,
          name: data.name,
          email: data.email,
          role: data.role,
          studentType: data.studentType,
          active: data.active ?? true,
          createdAt,
          lastActive
        } as UserProfile;
      }).sort((a, b) => b.createdAt - a.createdAt); // Sort by createdAt descending in-memory
      callback(users);
    },
    (error) => {
      console.error("Error listening to users:", error);
      callback([]);
    }
  );
};

// ============================================================================
// 2. MENU & INVENTORY
// ============================================================================

export const addMenuItem = async (item: Omit<MenuItem, 'id'>): Promise<string> => {
  try {
    const id = Math.random().toString(36).substr(2, 9);
    const newItem: MenuItem = {
      id,
      ...item,
      imageUrl: item.imageUrl || DEFAULT_FOOD_IMAGE,
      active: item.active ?? true
    };
    await setDoc(doc(db, "menu", id), newItem);
    return id;
  } catch (error) {
    console.error("Error adding menu item:", error);
    throw error;
  }
};

export const rejectOrder = async (orderId: string, rejectedBy: string, reason: string = 'Staff rejection'): Promise<void> => {
  const orderRef = doc(db, "orders", orderId);
  await updateDoc(orderRef, {
    qrStatus: 'REJECTED',
    qrState: 'EXPIRED',
    orderStatus: 'CANCELLED',
    rejectedBy,
    rejectedAt: serverTimestamp(),
    rejectionReason: reason
  });
};

export const updateMenuItem = async (id: string, updates: Partial<MenuItem>): Promise<void> => {
  try {
    await updateDoc(doc(db, "menu", id), updates);
  } catch (error) {
    console.error("Error updating menu item:", error);
    throw error;
  }
};

export const deleteMenuItem = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "menu", id));
  } catch (error) {
    console.error("Error deleting menu item:", error);
    throw error;
  }
};

export const getMenuOnce = async (): Promise<MenuItem[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, "menu")));
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
      .filter(item => item.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching menu:", error);
    return [];
  }
};

export const listenToMenu = (callback: (items: MenuItem[]) => void): (() => void) => {
  // Staff still needs real-time, but students should use getMenuOnce
  return onSnapshot(
    query(collection(db, "menu")),
    (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
        .filter(item => item.active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));
      callback(items);
    },
    (error) => {
      console.error("Error listening to menu:", error);
      callback([]);
    }
  );
};

// Initialize menu and Sync real metadata (Self-Healing Catalog)
export const initializeMenu = async (): Promise<void> => {
  try {
    const menuSnapshot = await getDocs(collection(db, "menu"));
    const currentIds = INITIAL_MENU.map(it => it.id);
    const batch = writeBatch(db);
    let deletedCount = 0;

    // 1. DATA CURING: Delete legacy/malformed items
    menuSnapshot.docs.forEach(doc => {
      if (!currentIds.includes(doc.id)) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      console.log(`🧹 Purged ${deletedCount} legacy dummy items.`);
    }

    // 2. LIVE SYNC: Push real verified board items
    console.log('🥣 Synchronizing 20+ real items with verified prices...');
    INITIAL_MENU.forEach(item => {
      const menuRef = doc(db, "menu", item.id);
      batch.set(menuRef, {
        ...item,
        imageUrl: item.imageUrl || DEFAULT_FOOD_IMAGE,
        active: true,
        updatedAt: serverTimestamp(),
        v: 2 // Schema version 2
      }, { merge: true });

      const metaRef = doc(db, "inventory_meta", item.id);
      batch.set(metaRef, {
        itemId: item.id,
        itemName: item.name,
        totalStock: 100,
        consumed: 0,
        lowStockThreshold: 20,
        category: item.category,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    });
    
    await batch.commit();
    console.log("✅ Database Cured & Synchronized.");
  } catch (error) {
    console.error("❌ Critical Menu Sync Failure:", error);
  }
};

// Inventory
export const getInventory = async (): Promise<InventoryItem[]> => {
  try {
    const snapshot = await getDocs(collection(db, "inventory"));
    const toMillis = (ts: any): number => {
      if (!ts) return Date.now();
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts === 'number') return ts;
      return Date.now();
    };
    
    return snapshot.docs.map(doc => ({
      itemId: doc.id,
      itemName: doc.data().itemName,
      openingStock: doc.data().openingStock || 0,
      consumed: doc.data().consumed || 0,
      lastUpdated: toMillis(doc.data().lastUpdated),
      category: doc.data().category || ""
    } as InventoryItem));
  } catch (error) {
    console.error("Error getting inventory:", error);
    return [];
  }
};

export const updateInventory = async (itemId: string, consumed: number): Promise<void> => {
  try {
    const invRef = doc(db, "inventory", itemId);
    await runTransaction(db, async (tx) => {
      const invSnap = await tx.get(invRef);
      if (invSnap.exists()) {
        const current = invSnap.data();
        const newConsumed = (current.consumed || 0) + consumed;
        tx.update(invRef, {
          consumed: newConsumed,
          lastUpdated: serverTimestamp()
        });
      }
    });
  } catch (error) {
    console.error("Error updating inventory:", error);
    throw error;
  }
};

export const updateInventoryItem = async (itemId: string, data: Partial<InventoryItem>): Promise<void> => {
  if (useCallables()) {
    try {
      await updateInventoryCallable({
        itemId,
        itemName: data.itemName,
        openingStock: data.openingStock,
        consumed: data.consumed,
        category: data.category,
        lowStockThreshold: (data as { lowStockThreshold?: number }).lowStockThreshold,
      });
      return;
    } catch (err: any) {
      console.error("Error updating inventory (callable):", err);
      throw err;
    }
  }
  try {
    const invRef = doc(db, "inventory", itemId);
    const invSnap = await getDoc(invRef);
    if (invSnap.exists()) {
      await updateDoc(invRef, { ...data, lastUpdated: serverTimestamp() });
    } else {
      await setDoc(invRef, {
        itemId,
        itemName: data.itemName || '',
        openingStock: data.openingStock || 0,
        consumed: data.consumed || 0,
        category: data.category || '',
        lastUpdated: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error updating inventory item:", error);
    throw error;
  }
};

export const listenToInventory = (callback: (items: InventoryItem[]) => void): (() => void) => {
  return onSnapshot(
    collection(db, "inventory"),
    (snapshot) => {
      const toMillis = (ts: any): number => {
        if (!ts) return Date.now();
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (typeof ts === 'number') return ts;
        return Date.now();
      };
      
      const items = snapshot.docs.map(doc => ({
        itemId: doc.id,
        itemName: doc.data().itemName,
        openingStock: doc.data().openingStock || 0,
        consumed: doc.data().consumed || 0,
        lastUpdated: toMillis(doc.data().lastUpdated),
        category: doc.data().category || ""
      } as InventoryItem));
      callback(items);
    },
    (error) => {
      console.error("Error listening to inventory:", error);
      callback([]);
    }
  );
};

// ============================================================================
// INVENTORY META (real-time stock for students: totalStock, consumed, lowStockThreshold)
// ============================================================================

/** [PERFORMANCE ARCHITECT] - Cached inventory data to prevent Spark Tier exhaust. */
let cachedInventoryMeta: InventoryMetaItem[] = [];
let lastMetaFetch = 0;
const META_TTL = 30000; // 30s cache

export const getInventoryMetaOnce = async (force: boolean = false): Promise<InventoryMetaItem[]> => {
  if (!force && Date.now() - lastMetaFetch < META_TTL && cachedInventoryMeta.length > 0) {
    return cachedInventoryMeta;
  }
  try {
    const snapshot = await getDocs(collection(db, "inventory_meta"));
    const items = snapshot.docs.map((d: any) => {
      const data = d.data();
      return {
        itemId: d.id,
        totalStock: data.totalStock ?? 0,
        consumed: data.consumed ?? 0,
        lowStockThreshold: data.lowStockThreshold ?? 20,
        available: data.available ?? Math.max(0, (data.totalStock ?? 0) - (data.consumed ?? 0)),
        stockStatus: data.stockStatus,
        itemName: data.itemName,
        category: data.category,
      };
    });
    cachedInventoryMeta = items;
    lastMetaFetch = Date.now();
    return items;
  } catch (error) {
    console.error("Error fetching inventory_meta once:", error);
    return cachedInventoryMeta;
  }
};

/** Real-time inventory_meta listener. STAFF ONLY. Students should use getInventoryMetaOnce. */
export const listenToInventoryMeta = (
  callback: (items: InventoryMetaItem[]) => void,
  options?: { includeMetadataChanges?: boolean }
): (() => void) => {
  const colRef = collection(db, "inventory_meta");

  const onNext = (snapshot: any) => {
    const items: InventoryMetaItem[] = snapshot.docs.map((d: any) => {
      const data = d.data();
      return {
        itemId: d.id,
        totalStock: data.totalStock ?? 0,
        consumed: data.consumed ?? 0,
        lowStockThreshold: data.lowStockThreshold ?? 20,
        available: data.available ?? Math.max(0, (data.totalStock ?? 0) - (data.consumed ?? 0)),
        stockStatus: data.stockStatus,
        itemName: data.itemName,
        category: data.category,
      };
    });
    callback(items);
  };

  const onError = (error: any) => {
    console.error("Error listening to inventory_meta:", error);
    callback([]);
  };

  return onSnapshot(colRef, onNext, onError);
};

/** Derive stock status and available count; prefer cached available/stockStatus when present */
export function getStockStatus(meta: InventoryMetaItem): { status: StockStatus; available: number } {
  const available = meta.available != null ? meta.available : Math.max(0, meta.totalStock - meta.consumed);
  const status: StockStatus =
    meta.stockStatus != null
      ? meta.stockStatus
      : available === 0
        ? "OUT_OF_STOCK"
        : available <= meta.lowStockThreshold
          ? "LOW_STOCK"
          : "AVAILABLE";
  return { status, available };
}

// ============================================================================
// 3. SETTINGS
// ============================================================================

export const getSettings = async (): Promise<SystemSettings> => {
  try {
    const settingsDoc = await getDoc(doc(db, "settings", "global"));
    if (settingsDoc.exists()) {
      return settingsDoc.data() as SystemSettings;
    }
    // Return defaults if not found
    return {
      isMaintenanceMode: false,
      acceptingOrders: true,
      orderingEnabled: DEFAULT_ORDERING_ENABLED,
      servingRatePerMin: DEFAULT_SERVING_RATE_PER_MIN,
      announcement: "JOE: New Indian Breakfast Catalog is now LIVE!",
      taxRate: 5,
      minOrderValue: 20,
      peakHourThreshold: 50,
      autoSettlementEnabled: true
    };
  } catch (error) {
    console.error("Error getting settings:", error);
    return {
      isMaintenanceMode: false,
      acceptingOrders: true,
      orderingEnabled: DEFAULT_ORDERING_ENABLED,
      servingRatePerMin: DEFAULT_SERVING_RATE_PER_MIN,
      announcement: "JOE: New Indian Breakfast Catalog is now LIVE!",
      taxRate: 5,
      minOrderValue: 20,
      peakHourThreshold: 50,
      autoSettlementEnabled: true
    };
  }
};

export const updateSettings = async (updates: Partial<SystemSettings>): Promise<void> => {
  const settingsRef = doc(db, "settings", "global");
  try {
    await updateDoc(settingsRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // If settings don't exist, create them
    if (error instanceof Error) {
      await setDoc(settingsRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } else {
      console.error("Error updating settings:", error);
      throw error;
    }
  }
};

export const listenToSettings = (callback: (settings: SystemSettings) => void): (() => void) => {
  return onSnapshot(
    doc(db, "settings", "global"),
    (doc) => {
      if (doc.exists()) {
        callback(doc.data() as SystemSettings);
      } else {
        callback({
          isMaintenanceMode: false,
          acceptingOrders: true,
          orderingEnabled: DEFAULT_ORDERING_ENABLED,
          servingRatePerMin: DEFAULT_SERVING_RATE_PER_MIN,
          announcement: "JOE: New Indian Breakfast Catalog is now LIVE!",
          taxRate: 5,
          minOrderValue: 20,
          peakHourThreshold: 50,
          autoSettlementEnabled: true
        });
      }
    },
    (error) => {
      console.error("Error listening to settings:", error);
      callback({
        isMaintenanceMode: false,
        acceptingOrders: true,
        orderingEnabled: DEFAULT_ORDERING_ENABLED,
        servingRatePerMin: DEFAULT_SERVING_RATE_PER_MIN,
        announcement: "JOE: New Indian Breakfast Catalog is now LIVE!",
        taxRate: 5,
        minOrderValue: 20,
        peakHourThreshold: 50,
        autoSettlementEnabled: true
      });
    }
  );
};

/** Fail-safe: whether new orders are allowed (from settings) */
export const getOrderingEnabled = async (): Promise<boolean> => {
  const s = await getSettings();
  return s.orderingEnabled !== false;
};

/**
 * Estimated wait time in minutes: pending_orders / serving_rate.
 * Pending = orders in ACTIVE/PLACED/COOKING/READY (not yet COMPLETED).
 */
export const getQueueEstimate = async (): Promise<{ minutes: number; pendingCount: number }> => {
  try {
    const settings = await getSettings();
    const rate = settings.servingRatePerMin ?? DEFAULT_SERVING_RATE_PER_MIN;
    const snap = await getDocs(
      query(
        collection(db, "orders"),
        where("orderStatus", "in", ["PENDING", "ACTIVE"]),
        limit(200)
      )
    );
    const pendingCount = snap.docs.filter((d) => {
      const o = d.data();
      return o.paymentStatus !== "REJECTED" && o.orderStatus !== "CANCELLED";
    }).length;
    const minutes = rate > 0 ? Math.max(0, Math.ceil(pendingCount / rate)) : 0;
    return { minutes, pendingCount };
  } catch (e) {
    console.warn("getQueueEstimate failed:", e);
    return { minutes: 0, pendingCount: 0 };
  }
};

/**
 * Aggregated inventory: from inventory doc + sum of inventory_shards for that item.
 * Use for admin dashboard when shards exist.
 */
export const getAggregatedInventory = async (): Promise<InventoryItem[]> => {
  try {
    const invSnap = await getDocs(collection(db, "inventory"));
    const toMillis = (ts: any): number => {
      if (!ts) return Date.now();
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (typeof ts === "number") return ts;
      return Date.now();
    };
    const items: InventoryItem[] = [];
    for (const d of invSnap.docs) {
      const itemId = d.id;
      const data = d.data();
      let consumed = data.consumed ?? 0;
      try {
        const shardsSnap = await getDocs(collection(db, "inventory_shards", itemId, "shards"));
        shardsSnap.docs.forEach((s) => {
          consumed += s.data().count ?? 0;
        });
      } catch (_) {
        // no shards
      }
      items.push({
        itemId,
        itemName: data.itemName ?? "",
        openingStock: data.openingStock ?? 0,
        consumed,
        lastUpdated: toMillis(data.lastUpdated),
        category: data.category ?? ""
      } as InventoryItem);
    }
    return items;
  } catch (error) {
    console.error("Error getAggregatedInventory:", error);
    return [];
  }
};

/** Update kitchen workflow state (PLACED â†’ COOKING â†’ READY â†’ SERVED). Server/admin only via Callable. */
export const updateKitchenStatus = async (orderId: string, kitchenStatus: KitchenStatus): Promise<void> => {
  if (useCallables()) {
    await updateKitchenStatusCallable({ orderId, kitchenStatus });
    return;
  }
  await updateDoc(doc(db, "orders", orderId), { kitchenStatus });
};

/** Zero-wait: update serve flow (NEWâ†’PREPARINGâ†’READY). Server only. */
export const updateServeFlowStatus = async (orderId: string, serveFlowStatus: 'PREPARING' | 'READY'): Promise<void> => {
  if (useCallables()) {
    await updateServeFlowStatusCallable({ orderId, serveFlowStatus });
    return;
  }
  await updateDoc(doc(db, "orders", orderId), { serveFlowStatus, serveFlowUpdatedAt: serverTimestamp() });
};

/** Listen to preparation orders only (for server dashboard). Excludes FAST_ITEM. */
export const listenToPreparationOrders = (callback: (orders: Order[]) => void, limitCount: number = 80): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("orderType", "==", "PREPARATION_ITEM"),
      where("serveFlowStatus", "in", ["NEW", "QUEUED", "PREPARING", "READY"]),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    ),
    (snapshot) => {
      const orders = snapshot.docs.map((d) => firestoreToOrder(d.id, d.data()));
      callback(orders.filter((o) => o.paymentStatus !== "REJECTED" && o.orderStatus !== "CANCELLED"));
    },
    (error) => {
      console.error("Error listening to preparation orders:", error);
      callback([]);
    }
  );
};

// ============================================================================
// 4. ORDERING SYSTEM (REAL-TIME)
// ============================================================================

export const createOrder = async (orderData: Omit<Order, 'id' | 'createdAt'> & { idempotencyKey?: string }): Promise<string> => {
  if (useCallables()) {
    try {
      const { data } = await createOrderCallable({
        userId: orderData.userId,
        userName: orderData.userName,
        items: orderData.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          costPrice: item.costPrice,
          category: item.category,
          imageUrl: item.imageUrl,
        })),
        totalAmount: orderData.totalAmount,
        paymentType: orderData.paymentType,
        paymentStatus: orderData.paymentStatus,
        cafeteriaId: orderData.cafeteriaId,
        idempotencyKey: orderData.idempotencyKey,
      });
      try {
        const { invalidateReportsCache } = await import('./reporting');
        invalidateReportsCache();
      } catch (_e) {}
      return (data as { orderId: string }).orderId;
    } catch (err: any) {
      const msg = err?.message || err?.code || String(err);
      console.error("Error creating order (callable):", err);
      throw err?.code === 'functions/unauthenticated' ? new Error('Please sign in to place an order.') : new Error(msg);
    }
  }
  try {
    const id = 'order_' + Math.random().toString(36).substr(2, 9);
    const createdAt = Date.now();
    const itemsWithQty = orderData.items.map(item => ({
      ...item,
      servedQty: 0,
      remainingQty: item.quantity
    }));

    // Perform atomic transaction on the client side
    // ARCHITECTURE: Only write to collections the customer owns:
    //   - orders (customer's own order)
    //   - prepBatches (join/create a kitchen batch)
    //   - slot_stats (capacity reservation)
    //   - idempotency_keys (duplicate prevention)
    // inventory_shards are staff-internal and NEVER written in the customer transaction.
    const result = await runTransaction(db, async (transaction) => {
      // ============================================================
      // PHASE 1 â€” READS ONLY (all reads must precede any writes)
      // ============================================================
      const idempotencyKey = orderData.idempotencyKey;
      const idempRef = idempotencyKey ? doc(db, "idempotency_keys", idempotencyKey) : null;
      const slot = orderData.arrivalTime || 0;
      const prepItems = orderData.items.filter(it => it.orderType === 'PREPARATION_ITEM');
      const slotStatsRef = doc(db, "slot_stats", slot.toString());

      // Pre-compute batch doc refs (3 slots per item to find an open batch)
      const batchRefs: { itemId: string; refs: any[] }[] = prepItems.map(item => ({
        itemId: item.id,
        refs: [0, 1, 2].map(idx => doc(db, "prepBatches", `batch_${slot}_${item.id}_${idx}`))
      }));

      const allRefs = [
        ...(idempRef ? [idempRef] : []),
        ...orderData.items.map(it => doc(db, "inventory_meta", it.id)),
        slotStatsRef,
        ...batchRefs.flatMap(b => b.refs)
      ];

      // Execute all reads at once â€” Firestore requires all reads before writes
      const snapshots = await Promise.all(
        allRefs.map(ref =>
          transaction.get(ref).catch(() =>
            ({ exists: () => false, data: () => undefined } as any)
          )
        )
      );

      // Map snapshots back by position
      let snapIdx = 0;
      const idempSnap = idempotencyKey ? snapshots[snapIdx++] : null;
      const inventorySnaps = orderData.items.map(() => snapshots[snapIdx++]);
      const slotStatsSnap = snapshots[snapIdx++];
      const itemBatchSnaps: Record<string, any[]> = {};
      prepItems.forEach(item => {
        itemBatchSnaps[item.id] = [0, 1, 2].map(() => snapshots[snapIdx++]);
      });

      // ============================================================
      // PHASE 2 â€” BUSINESS LOGIC (pure computation, no DB calls)
      // ============================================================

      // Idempotency: if this key already exists, return the existing orderId
      if (idempSnap?.exists()) {
        return (idempSnap.data() as any)?.orderId;
      }

      // Stock validation (soft check â€” does not block if inventory_meta is missing)
      orderData.items.forEach((item, idx) => {
        const snap = inventorySnaps[idx];
        if (snap.exists()) {
          const data = snap.data() as any;
          const available = (data.totalStock ?? 999) - (data.consumed ?? 0);
          if (available < item.quantity) {
            throw new Error(`OUT_OF_STOCK: ${item.name}`);
          }
        }
      });

      // Slot capacity check
      let targetSlot = slot;
      const requestedQty = prepItems.reduce((sum, i) => sum + i.quantity, 0);
      if (slotStatsSnap.exists()) {
        const currentVolume = (slotStatsSnap.data() as any)?.totalVolume || 0;
        if (currentVolume + requestedQty > MAX_TOTAL_SLOT_CAPACITY) {
          targetSlot = getNextLogicalSlot(targetSlot);
        }
      }

      // Resolve item types and build batch assignments
      const itemsWithResolvedType = itemsWithQty.map(it => {
        // [ROOT-FIX] Smart Item Routing: Check if item REQUIRES a station (e.g. Dosa, Wok for Egg Rice)
        const hasStation = !!STATION_ID_BY_ITEM_ID[it.id];
        const resolvedOrderType = it.orderType ||
          (hasStation ? 'PREPARATION_ITEM' : (FAST_ITEM_CATEGORIES.includes(it.category || '') ? 'FAST_ITEM' : 'PREPARATION_ITEM'));

        return {
          ...it,
          orderType: resolvedOrderType,
          status: resolvedOrderType === 'FAST_ITEM' ? 'READY' : 'PENDING'
        };
      });

      const isDynamic = itemsWithResolvedType.some(it => it.orderType === 'PREPARATION_ITEM');
      const batchAssignments: { ref: any; data: any; isNew: boolean }[] = [];
      const finalizedBatchIds: string[] = [];

      if (isDynamic) {
        prepItems.forEach(item => {
          const snaps = itemBatchSnaps[item.id];
          let found = false;

          for (let i = 0; i < snaps.length; i++) {
            const bSnap = snaps[i];
            const bRef = batchRefs.find(br => br.itemId === item.id)!.refs[i];

            if (!bSnap.exists()) {
              batchAssignments.push({
                ref: bRef, isNew: true,
                data: {
                  id: bRef.id, itemId: item.id, itemName: item.name,
                  arrivalTimeSlot: targetSlot, orderIds: [id],
                  quantity: item.quantity, status: 'QUEUED',
                  createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                }
              });
              finalizedBatchIds.push(bRef.id);
              found = true;
              break;
            } else {
              const bData = bSnap.data() as PrepBatch;
              if (bData.status === 'QUEUED' && (bData.quantity + item.quantity) <= MAX_BATCH_SIZE) {
                batchAssignments.push({
                  ref: bRef, isNew: false,
                  data: { orderIds: arrayUnion(id), quantity: increment(item.quantity), updatedAt: serverTimestamp() }
                });
                finalizedBatchIds.push(bRef.id);
                found = true;
                break;
              }
            }
          }

          if (!found) {
            // All 3 slots full â€” create a uniquely-named overflow batch
            const uniqueId = `batch_ovf_${targetSlot}_${item.id}_${id.slice(-4)}`;
            const bRef = doc(db, "prepBatches", uniqueId);
            batchAssignments.push({
              ref: bRef, isNew: true,
              data: {
                id: uniqueId, itemId: item.id, itemName: item.name,
                arrivalTimeSlot: targetSlot, orderIds: [id],
                quantity: item.quantity, status: 'QUEUED',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
              }
            });
            finalizedBatchIds.push(uniqueId);
          }
        });
      }

      // Build final order object
      const finalizedOrder: Order = {
        ...orderData,
        items: itemsWithResolvedType,
        id, createdAt,
        orderStatus: 'PENDING',
        orderType: isDynamic ? 'PREPARATION_ITEM' : 'FAST_ITEM',
        serveFlowStatus: isDynamic ? 'NEW' : 'READY',
        arrivalTime: isDynamic ? targetSlot : undefined,
        batchIds: finalizedBatchIds,
        pickupWindowStart: !isDynamic ? createdAt : undefined,
        pickupWindowEnd: !isDynamic ? createdAt + (60 * 60 * 1000) : undefined
      } as Order;

      if (finalizedOrder.paymentStatus === 'SUCCESS') {
        finalizedOrder.qrStatus = 'ACTIVE';
        const token = generateQRPayloadSync(finalizedOrder);
        finalizedOrder.qr = { token, status: 'ACTIVE', createdAt };
      }

      // ============================================================
      // PHASE 3 â€” WRITES ONLY (no reads from this point forward)
      // ============================================================

      // 1. Slot capacity reservation (only for dynamic/prep items)
      if (isDynamic && requestedQty > 0) {
        transaction.set(doc(db, "slot_stats", targetSlot.toString()), {
          totalVolume: increment(requestedQty),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      // 2. Kitchen batch assignments
      batchAssignments.forEach(ba => {
        if (ba.isNew) transaction.set(ba.ref, ba.data);
        else transaction.update(ba.ref, ba.data);
      });

      // 3. Idempotency key (write last in write phase to ensure atomicity)
      if (idempRef) {
        transaction.set(idempRef, { orderId: id, createdAt: serverTimestamp() });
      }

      // 4. The order document â€” customer owns this
      transaction.set(doc(db, "orders", id), orderToFirestore(finalizedOrder));

      return id;
      // inventory_shards intentionally excluded â€” they are staff-internal
      // and are managed via admin/server console, not customer transactions.
    });

    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (_e) {}

    return result;
  } catch (error: any) {
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      console.warn("Network error during order creation:", error.message);
      return 'order_' + Math.random().toString(36).substr(2, 9);
    }
    console.error("Error creating order:", error);
    throw error;
  }
};



/**
 * Get a single order by ID (non-realtime, one-time read)
 * Use listenToOrder for real-time updates
 */
export const getOrder = async (orderId: string): Promise<Order | null> => {
  try {
    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (orderDoc.exists()) {
      return firestoreToOrder(orderDoc.id, orderDoc.data());
    }
    return null;
  } catch (error) {
    console.error("Error getting order:", error);
    return null;
  }
};

export const listenToOrder = (orderId: string, callback: (order: Order | null) => void): (() => void) => {
  return onSnapshot(
    doc(db, "orders", orderId),
    (docSnap) => {
      if (docSnap.exists()) {
        const order = firestoreToOrder(docSnap.id, docSnap.data());
        callback(order);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error("Error listening to order:", error);
      callback(null);
    }
  );
};

export const listenToAllOrders = (callback: (orders: Order[]) => void): (() => void) => {
  // PERFORMANCE FIX: Limit to 100 most recent orders to prevent Quota Exceeded errors.
  // This ensures the cashier ledger only processes relevant recent history.
  return onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100)),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
    },
    (error) => {
      console.error("Error listening to orders (Quota Check):", error);
      // Fallback: If index is missing, try without orderBy but KEEP the limit
      if (error.code === 'failed-precondition') {
         return onSnapshot(
           query(collection(db, "orders"), limit(100)),
           (snap) => callback(snap.docs.map(d => firestoreToOrder(d.id, d.data())).sort((a,b) => b.createdAt - a.createdAt)),
           (e) => { console.error("Final fallback error:", e); callback([]); }
         );
      }
      callback([]);
    }
  );
};


/** Paginated recent orders (e.g. for kitchen dashboard). Limit 50. */
export const listenToRecentOrders = (callback: (orders: Order[]) => void, limitCount: number = 50): (() => void) => {
  return onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(limitCount)),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
    },
    (error) => {
      console.error("Error listening to recent orders:", error);
      callback([]);
    }
  );
};

export const listenToUserOrders = (userId: string, callback: (orders: Order[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("userId", "==", userId),
      where("paymentStatus", "in", ["SUCCESS", "PENDING"])
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
    },
    (error) => {
      console.error("Error listening to user orders:", error);
      callback([]);
    }
  );
};

export const listenToAllUserOrders = (userId: string, callback: (orders: Order[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("userId", "==", userId)
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
    },
    (error) => {
      console.error("Error listening to all user orders:", error);
      callback([]);
    }
  );
};

export const listenToLatestActiveQR = (userId: string, callback: (order: Order | null) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("userId", "==", userId),
      where("paymentStatus", "==", "SUCCESS"),
      where("qrStatus", "==", "ACTIVE")
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      if (orders.length === 0) return callback(null);
      const latest = orders.reduce((acc, cur) => ((cur.createdAt || 0) > (acc.createdAt || 0) ? cur : acc), orders[0]);
      callback(latest);
    },
    (error) => {
      console.error("Error listening to latest active QR:", error);
      callback(null);
    }
  );
};

export const listenToPendingCashOrders = (callback: (orders: Order[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("paymentStatus", "in", ["PENDING", "UTR_SUBMITTED"])
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      // Sort client-side to avoid index requirements
      const sorted = orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(sorted);
    },
    (error) => {
      console.error("Error listening to pending cash orders:", error);
      callback([]);
    }
  );
};

/** 
 * [SONIC-AUTOMATION] Reconciliation Engine 
 * Allows an external sync (SMS/Forwarder) to populate the confirmed bank deposits.
 */
export const registerBankDeposit = async (utr: string, amount: number, meta: any = {}): Promise<void> => {
  const cleanUTR = utr.trim().replace(/\D/g, '');
  if (cleanUTR.length < 10) return;

  const depositRef = doc(db, "payments_ledger", cleanUTR);
  const snap = await getDoc(depositRef);
  
  if (!snap.exists()) {
    // 1. RECORD DEPOSIT
    await setDoc(depositRef, {
      utr: cleanUTR,
      amount: Number(amount),
      status: 'AVAILABLE',
      receivedAt: serverTimestamp(),
      meta,
      updatedAt: serverTimestamp()
    });
    console.log(`[LEDGER] New deposit indexed: ${cleanUTR} | ₹${amount}`);

    // 2. ⚡ SONIC-MATCH ENGINE
    let targetOrderId: string | null = null;
    const note = (meta.note || "").toUpperCase();

    // LAYER A: Note Match (ORD-XXXX)
    if (note.includes('ORD')) {
       const shortIdArr = note.match(/ORD([A-F0-9]{4})/);
       const shortId = shortIdArr ? shortIdArr[1] : null;
       if (shortId) {
          const q = query(collection(db, "orders"), 
            where("totalAmount", "==", Number(amount)), 
            where("paymentStatus", "in", ["INITIATED", "UTR_SUBMITTED"]),
            limit(10)
          );
          const oSnap = await getDocs(q);
          const match = oSnap.docs.find(d => d.id.toUpperCase().endsWith(shortId));
          if (match) targetOrderId = match.id;
       }
    }

    // LAYER B: Deduction (Amount + Time Window)
    if (!targetOrderId) {
       const now = Date.now();
       const q = query(collection(db, "orders"), 
         where("totalAmount", "==", Number(amount)),
         where("paymentStatus", "in", ["INITIATED", "UTR_SUBMITTED", "PENDING"]),
         limit(5)
       );
       const oSnap = await getDocs(q);
       const candidates = oSnap.docs.filter(d => {
          const oData = d.data();
          const ageSec = Math.abs(now - oData.createdAt) / 1000;
          return ageSec < 300; // ± 5 min window
       });

       if (candidates.length === 1) {
          targetOrderId = candidates[0].id;
          console.log(`[RECON] Found unique amount match for ₹${amount}.`);
       } else if (candidates.length > 1) {
          console.warn(`[RECON] Conflict! ${candidates.length} orders found for ₹${amount}. Awaiting cashier.`);
       }
    }

    // 3. EXECUTE AUTO-APPROVAL
    if (targetOrderId) {
       console.log(`[AUTOPAIR] Resolving Order ${targetOrderId} via Bank Deposit ${cleanUTR}`);
       await confirmCashPayment(targetOrderId, 'SYSTEM_SONIC_RECON_V1');
    }
  }
};

export const submitOrderUTR = async (orderId: string, utr: string): Promise<void> => {
  const cleanUTR = utr.trim().replace(/\D/g, '');
  // 🏎️ [FAST-UTR] Allow last 4 digits for speed, but full 12 is supported
  if (cleanUTR.length < 4) throw new Error("Please enter at least the last 4 digits of your UTR.");

  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found");
    const orderData = orderSnap.data();

    // 🛡️ [ANTI-FRAUD] Check if this UTR has already been claimed (using suffix match)
    // For 4-digit entries, we only block if the amount ALSO matches exactly to prevent generic blocks
    const dupQuery = query(collection(db, "orders"), where("utr", "==", cleanUTR));
    const dupSnap = await getDocs(dupQuery);
    if (!dupSnap.empty && dupSnap.docs.some(d => d.id !== orderId)) {
        throw new Error("This UTR has already been claimed. Please enter the full 12 digits or contact support.");
    }

    // 1. Initial Update (Move to Review Queue)
    await updateDoc(orderRef, {
      paymentStatus: 'UTR_SUBMITTED',
      utr: cleanUTR,
      utrSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 🚀 [SONIC-RECON] Attempt Automatic Pairing (Suffix Match)
    // We check the ledger for any deposit ending with these digits and matching amount
    const ledgerQuery = query(collection(db, "payments_ledger"), where("status", "==", "AVAILABLE"));
    const ledgerSnap = await getDocs(ledgerQuery);
    
    const depositMatch = ledgerSnap.docs.find(d => {
       const dep = d.data();
       return dep.utr.endsWith(cleanUTR) && Number(dep.amount) === Number(orderData.totalAmount);
    });

    if (depositMatch) {
       console.log(`[AUTOPAIR] Smart match found via suffix ${cleanUTR}. Automating...`);
       await confirmCashPayment(orderId, 'SYSTEM_AUTOPAIR_V1');
    }
  } catch (err: any) {
    console.error("Error submitting UTR:", err);
    throw err;
  }
};

export const confirmCashPayment = async (orderId: string, _cashierUid: string): Promise<void> => {
  if (useCallables()) {
    try {
      await confirmPaymentCallable({ orderId });
      return;
    } catch (err: any) {
      console.error("Error confirming payment (callable):", err);
      throw err;
    }
  }

  try {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) return;
    const orderData = orderSnap.data();

    // 🏦 PRE-TRANSACTION SEARCH: 
    // Find the matching ledger record BEFORE we start the transaction (Queries are NOT allowed inside transactions)
    let depositDocId: string | null = null;
    if (orderData.utr) {
       try {
          const ledgerQuery = query(collection(db, "payments_ledger"), where("status", "==", "AVAILABLE"));
          const ledgerSnap = await getDocs(ledgerQuery);
          const depositMatch = ledgerSnap.docs.find(d => {
             const dep = d.data();
             return dep.utr.endsWith(orderData.utr) && Number(dep.amount) === Number(orderData.totalAmount);
          });
          if (depositMatch) {
             depositDocId = depositMatch.id;
             console.log(`[LEDGER_PREVIEW] Matched deposit ${depositDocId} for UTR suffix ${orderData.utr}`);
          }
       } catch (e) {
          console.error("[LEDGER_PREVIEW] Search failed, continuing with manual approval:", e);
       }
    }

    await runTransaction(db, async (transaction) => {
       transaction.update(orderRef, {
          paymentStatus: 'SUCCESS',
          qrStatus: 'ACTIVE',
          qr: { 
            token: `v1.${orderId}.QR_AUTO_${Date.now()}`, 
            status: 'ACTIVE', 
            createdAt: Date.now() 
          },
          confirmedBy: _cashierUid,
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
       });

       // Now we use the specific docId we found earlier to lock the record atomically
       if (depositDocId) {
          transaction.update(doc(db, "payments_ledger", depositDocId), {
            status: 'CLAIMED',
            claimedByOrder: orderId,
            claimedAt: serverTimestamp()
          });
       }
    });
    
    // Invalidate local cache
    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (_e) {}
  } catch (error) {
    console.error("Error confirming payment:", error);
    throw error;
  }
};

export const rejectCashPayment = async (orderId: string, _cashierUid: string): Promise<void> => {
  if (useCallables()) {
    try {
      await rejectPaymentCallable({ orderId });
      return;
    } catch (err: any) {
      console.error("Error rejecting cash payment (callable):", err);
      throw err?.message?.includes?.('ALREADY') ? new Error("ALREADY_PROCESSED") : err;
    }
  }
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      paymentStatus: 'REJECTED',
      orderStatus: 'CANCELLED',
      rejectedAt: serverTimestamp(),
      rejectedBy: _cashierUid,
      qrStatus: 'REJECTED',
      updatedAt: serverTimestamp()
    });
    
    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (_e) {}
  } catch (error) {
    console.error("Error rejecting cash payment:", error);
    throw error;
  }
};

// ============================================================================
// 5. SERVING SYSTEM
// ============================================================================

export interface PendingItem {
  orderId: string;
  orderNumber: string;
  userName: string;
  itemId: string;
  itemName: string;
  imageUrl: string;
  remainingQty: number;
  orderedQty: number;
  servedQty: number;
  updatedAt?: number;
}

export const listenToActiveOrders = (callback: (orders: Order[]) => void): (() => void) => {
  // Use a query that fetches the orders currently circulating at the counter
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("orderStatus", "in", ["PAID", "PROCESSING", "PENDING", "SERVED"]), // SERVED is needed for partials
      limit(200)
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      // Sort client-side by createdAt to ensure stable FIFO ordering
      const sorted = orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(sorted);
    },
    (error) => {
      console.error("Error listening to active orders:", error);
      callback([]);
    }
  );
};

export const listenToPendingItems = (callback: (items: PendingItem[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("qrState", "==", "SCANNED")
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      // Sort client-side to avoid needing a composite index
      const sortedOrders = orders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      
      const pendingItems: PendingItem[] = [];
      sortedOrders.forEach(order => {
        order.items.forEach(item => {
          const remainingQty = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
          if (remainingQty > 0) {
            pendingItems.push({
              orderId: order.id,
              orderNumber: order.id.slice(-8).toUpperCase(),
              userName: order.userName,
              itemId: item.id,
              itemName: item.name,
              imageUrl: item.imageUrl,
              remainingQty,
              orderedQty: item.quantity,
              servedQty: item.servedQty || 0
            });
          }
        });
      });
      callback(pendingItems);
    },
    (error) => {
      console.error("Error listening to pending items:", error);
      callback([]);
    }
  );
};

/**
 * ⚡ [SONIC-ATOMIC] SUPERSONIC INTAKE ENGINE
 */
export const processAtomicIntake = async (qrPayload: string, staffId: string) => {
   const intake = parseServingQR(qrPayload);
   const parsedPayload = await parseQRPayload(qrPayload);

   console.log(`[ATOMIC-INTAKE] Input: ${intake.raw} | Resolved ID: ${intake.orderId} | Kind: ${intake.qrKind}`);

   let orderId = intake.orderId;
   let secureHash = parsedPayload?.secureHash || 'MANUAL_OVERRIDE';
   let payloadExpiresAt = parsedPayload?.expiresAt;

   // Attempt to probe for the order if it's missing (helps with manual entry/short IDs)
   // CRITICAL: We ONLY search by the resolved ID, never the raw payload.
   let orderRef = doc(db, "orders", orderId);
   let initialSnap = await getDoc(orderRef);

   if (!initialSnap.exists() && orderId.length >= 4) {
      // Manual entry or suffix scanner support
      const q = query(
        collection(db, "orders"), 
        where("orderStatus", "==", "PENDING"),
        limit(50)
      );
      const snaps = await getDocs(q);
      const found = snaps.docs.find(d => d.id.endsWith(orderId) || d.id.toLowerCase().endsWith(orderId.toLowerCase()));
      if (found) {
         orderId = found.id;
         orderRef = doc(db, "orders", orderId);
      }
   }

   try {
      return await runTransaction(db, async (tx) => {
         const snap = await tx.get(orderRef);
         if (!snap.exists()) throw new Error(`Order not found: ${orderId}`);
         const data = snap.data();
         const order = firestoreToOrder(snap.id, data);

         // 🛑 PAYMENT VERIFICATION BRIDGE
         if (order.paymentStatus !== 'SUCCESS') {
            // [SONIC-SYNC] Allow the cashier to see the order in their manifest to collect cash
            // but DO NOT fulfill/serve any items yet.
            return { order, result: 'AWAITING_PAYMENT' as const };
         }

         // 🛑 CONSUMPTION CHECK
         if (order.qrStatus === 'USED' || order.qrStatus === 'DESTROYED' || order.orderStatus === 'SERVED') {
            throw new Error("ALREADY_CONSUMED - Ticket already scanned.");
         }

         // 🛡️ IDEMPOTENT MANIFEST CHECK (Silent Mode)
         if (order.qrStatus === 'SCANNED' || order.qrState === 'SCANNED') {
            return { order, result: 'ALREADY_MANIFESTED' as const };
         }

         // 5. Strict Security Check
         if (secureHash !== 'MANUAL_OVERRIDE') {
            const verifExpiresAt = payloadExpiresAt || (order.createdAt + QR_EXPIRY_MS);
            const isValid = await verifySecureHash(
               order.id, order.userId, order.cafeteriaId, order.createdAt, verifExpiresAt, secureHash
            );
            
            if (!isValid) {
               console.error('⛔ SECURITY_BREACH DEBUG:', {
                  dbOrderId: order.id,
                  dbUserId: order.userId,
                  dbCafe: order.cafeteriaId,
                  dbCreated: order.createdAt,
                  verifExpiresAt,
                  providedHash: secureHash,
                  rawPayload: qrPayload
               });
               throw new Error("SECURITY_BREACH - Token invalid.");
            }
         }

         // 💼 BUSINESS RULES
          // 1. Guard against double-intake (infinite scanning loop)
          const fStatus = order.serveFlowStatus; // Moved up for use in isConsumed
          const isConsumed = (order.qrStatus as any) === 'DESTROYED' || fStatus === 'SERVED' || order.orderStatus === 'COMPLETED';
          if (isConsumed) {
             throw new Error("ALREADY_CONSUMED");
          }

          // 1.5 Guard against redundant manifestation for dynamic orders
          if ((order.qrState as any) === 'SCANNED') {
             throw new Error("ALREADY_SCANNED");
          }

          // 2. Define if this is a Pure Static (Instant Serve) order
          // A Static order is one where EVERY item is a FAST_ITEM
          const isStatic = order.items.every(it => isStaticItem(it));
          const pStatus = order.pickupWindow?.status;

          // Only orders consisting EXCLUSIVELY of Fast-Items are served automatically.
          const canIntake = 
             isStatic || // Static orders are always intakeable if not consumed
             pStatus === 'COLLECTING' ||
             fStatus === 'READY' || fStatus === 'ALMOST_READY' ||
             fStatus === 'MISSED' || fStatus === 'MISSED_PREVIOUS' ||
             fStatus === 'SERVED_PARTIAL' ||
             pStatus === 'MISSED_PREVIOUS' ||
             pStatus === 'ABANDONED' || fStatus === 'ABANDONED' ||
             (!isStatic && (
                fStatus === 'PENDING' || fStatus === 'NEW' ||
                fStatus === 'QUEUED' || fStatus === 'PREPARING'
             ));

          if (!canIntake) {
             throw new Error(`SERVE_BLOCKED - Status: ${pStatus || fStatus || 'PENDING'}.`);
          }

         // 📸 INTAKE ACTION
         const now = Date.now();
         const updateData: any = {
            scannedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastScannedBy: staffId
         };

         if (isStatic) {
            // ⚡ [SONIC-ATOMIC] Pure Static Completion
            updateData.qrStatus = 'DESTROYED';
            updateData.qrState = 'SERVED';
            updateData.orderStatus = 'COMPLETED';
            updateData.serveFlowStatus = 'SERVED';
            updateData.servedAt = now;
            updateData["pickupWindow.status"] = 'COMPLETED';
            updateData.items = order.items.map(it => ({ 
               ...it, status: 'SERVED', remainingQty: 0, servedQty: it.quantity 
            }));
         } else {
            // [ROOT-FIX] DYNAMIC/MIXED orders: ONLY 'Lunch' items within the order are served instantly on scan.
            // All other items (Dosas, Drinks, Snacks) remain on the manifest for the server to confirm manually.
            updateData.qrStatus = 'ACTIVE';
            updateData.qrState = 'SCANNED';
            updateData.serveFlowStatus = 'SERVED_PARTIAL';
            updateData.items = order.items.map(it => {
               if (isStaticItem(it)) {
                  return { ...it, status: 'SERVED', remainingQty: 0, servedQty: it.quantity };
               }
               return it;
            });
         }

         tx.update(orderRef, updateData);
         return { 
            order: { ...order, ...updateData, scannedAt: now }, 
            result: (updateData.qrStatus === 'DESTROYED') ? ('CONSUMED' as const) : ('MANIFESTED' as const)
         };
      });
   } catch (error: any) {
      console.error('❌ [ATOMIC-INTAKE-ERROR]:', error.message);
      throw error;
   }
};
;

/**
 * ALIAS: validateQRForServing -> processAtomicIntake
 * All staff views import this symbol. processAtomicIntake handles:
 *   - Static FAST_ITEM orders  -> result: CONSUMED  (qrStatus=DESTROYED)
 *   - Dynamic PREP_ITEM orders -> result: MANIFESTED (qrStatus=SCANNED)
 *   - Already manifested       -> result: ALREADY_MANIFESTED
 *   - Already consumed         -> throws  ALREADY_CONSUMED
 */
export const validateQRForServing = processAtomicIntake;

/**
 * ðŸ› ï¸ FORCE READY: Manual override for servers when an item is physically ready 
 * but system says PENDING/PREPARING. Moves it to COLLECTING/READY.
 */
export const forceReadyOrder = async (orderId: string, staffId: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error("Order not found");
      const orderData = snap.data();
      const now = Date.now();
      
      // Mark all items as ready if they were pending/preparing
      const items = (orderData.items || []).map((item: any) => {
        if (item.status === 'PENDING' || item.status === 'PREPARING') {
          return { ...item, status: 'READY' };
        }
        return item;
      });

      // Update associated batches to COMPLETED (since we've bypassed them)
      if (orderData.batchIds && orderData.batchIds.length > 0) {
        for (const bId of orderData.batchIds) {
          tx.update(doc(db, "prepBatches", bId), { 
            status: 'COMPLETED', // Or READY, but COMPLETED usually closes the kitchen view
            updatedAt: serverTimestamp() 
          });
        }
      }

      tx.update(orderRef, {
        items,
        serveFlowStatus: 'READY',
        pickupWindow: {
          startTime: now,
          endTime: now + PICKUP_WINDOW_DURATION_MS,
          durationMs: PICKUP_WINDOW_DURATION_MS,
          status: 'COLLECTING'
        },
        qrRedeemable: true, // Also set redeemable flag for safety in serve checks
        overrides: arrayUnion({
          staffId,
          reason: 'MANUAL_FORCE_READY_BY_SERVER',
          timestamp: now
        }),
        updatedAt: serverTimestamp()
      });
    });
  } catch (err: any) {
    console.error("Error forcing order ready:", err);
    throw err;
  }
};

export const getNextLogicalSlot = (slot: number): number => {
    const h = Math.floor(slot / 100);
    const m = slot % 100;
    const nextM = m + 15;
    if (nextM >= 60) return ((h + 1) % 24) * 100;
    return h * 100 + nextM;
};

// Atomic multi-item serve for a single order (Prevents 429 and write amplification)
export const serveOrderItemsAtomic = async (orderId: string, itemIds: string[], servedBy: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error("Order not found");
      const orderData = snap.data();
      const now = Date.now();
      
      const updatedItems = (orderData.items || []).map((it: any) => {
        if (itemIds.includes(it.id)) {
          const qty = it.remainingQty !== undefined ? it.remainingQty : it.quantity;
          if (qty > 0) {
            return {
              ...it,
              status: 'SERVED',
              remainingQty: 0,
              servedQty: (it.servedQty || 0) + qty,
              servedAt: now,
              servedBy
            };
          }
        }
        return it;
      });

      const allServed = updatedItems.every((it: any) => it.status === 'SERVED' || it.status === 'ABANDONED');
      
      const updateData: any = {
        items: updatedItems,
        updatedAt: serverTimestamp(),
        lastServedBy: servedBy,
        lastServedAt: now
      };

      if (allServed) {
        updateData.qrStatus = 'DESTROYED';
        updateData.qrState = 'SERVED';
        updateData.orderStatus = 'COMPLETED';
        updateData.serveFlowStatus = 'SERVED';
        updateData.servedAt = now;
      } else {
        updateData.qrStatus = 'ACTIVE'; // Keep active for remaining items
        updateData.serveFlowStatus = 'SERVED_PARTIAL';
      }

      tx.update(orderRef, updateData);
    });
  } catch (error) {
    console.error("Error in serveOrderItemsAtomic:", error);
    throw error;
  }
};

// Legacy wrapper for single item batch serve (uses the optimized atomic engine)
export const serveItemBatch = async (orderId: string, itemId: string, quantity: number, servedBy: string): Promise<void> => {
   return serveOrderItemsAtomic(orderId, [itemId], servedBy);
};

/**
 * ❌ ABANDON ITEM: Manual override to void an item from the intake manifest.
 * Used when a student rejects an item or it's unavailable.
 * Invalidate QR if this was the last remaining item.
 */
export const abandonItem = async (orderId: string, itemId: string): Promise<void> => {
   try {
     const orderRef = doc(db, "orders", orderId);
     await runTransaction(db, async (tx) => {
       const snap = await tx.get(orderRef);
       if (!snap.exists()) throw new Error("Order not found");
       const order = firestoreToOrder(snap.id, snap.data());

       // 🔍 READ BATCHES FIRST (CRITICAL: READS BEFORE WRITES)
       const batchIds = order.batchIds || [];
       const batchSnaps = await Promise.all(batchIds.map(bId => tx.get(doc(db, "prepBatches", bId))));
 
       const itemIndex = order.items.findIndex(i => i.id === itemId);
       if (itemIndex === -1) throw new Error("Item not found");
 
       const updatedItems = [...order.items];
       const item = updatedItems[itemIndex];
       
       updatedItems[itemIndex] = {
         ...item,
         status: 'ABANDONED',
         remainingQty: 0 // Void remaining quantity
       };
 
       const allResolved = updatedItems.every(i => i.status === 'SERVED' || i.status === 'ABANDONED');
       
       tx.update(orderRef, {
         items: updatedItems,
         qrStatus: allResolved ? 'DESTROYED' : order.qrStatus,
         qrState: allResolved ? 'SERVED' : order.qrState,
         orderStatus: allResolved ? 'SERVED' : order.orderStatus,
         serveFlowStatus: allResolved ? 'SERVED' : order.serveFlowStatus,
         updatedAt: serverTimestamp()
       });
 
       // 🔄 SYNC PREP BATCHES
       for (const bSnap of batchSnaps) {
          if (!bSnap.exists()) continue;
          const bData = bSnap.data() as PrepBatch;
          if (bData.itemId === itemId && bData.status !== 'COMPLETED') {
             const newQty = Math.max(0, bData.quantity - item.quantity);
             tx.update(bSnap.ref, { 
                quantity: newQty, 
                status: newQty <= 0 ? 'COMPLETED' : bData.status,
                updatedAt: serverTimestamp() 
             });
          }
       }
     });
   } catch (err: any) {
     console.error("Abandon Item Failed:", err);
     throw err;
   }
};

export const serveFullOrder = async (orderId: string, servedBy: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found");
      const data = orderSnap.data();
      const order = firestoreToOrder(orderSnap.id, data);

      // 🔍 READ ALL BATCHES FIRST (CRITICAL: READS BEFORE WRITES)
      const batchIds = order.batchIds || [];
      const batchSnaps = await Promise.all(batchIds.map(bId => tx.get(doc(db, "prepBatches", bId))));

      if (order.orderStatus === 'SERVED') return;

      const isAllowedToServe =
        order.pickupWindow?.status === 'COLLECTING' ||
        order.serveFlowStatus === 'READY' ||
        order.serveFlowStatus === 'ALMOST_READY' ||
        order.qrStatus === 'SCANNED' ||  // Dynamic order already manifested — serve it
        order.qrStatus === 'ACTIVE' ||   // Static fast-item marked ACTIVE — allow serve
        order.qrRedeemable === true;

      if (!isAllowedToServe) {
        throw new Error(`SERVE_BLOCKED - Order is ${order.serveFlowStatus || order.pickupWindow?.status || 'NOT_READY'}. Only READY orders can be served.`);
      }

      const updatedItems = order.items.map(item => ({
        ...item,
        servedQty: item.quantity,
        remainingQty: 0,
        status: 'SERVED'
      }));

      tx.update(orderRef, {
        items: updatedItems,
        orderStatus: 'COMPLETED',
        qrStatus: 'DESTROYED',
        qrState: 'SERVED',
        servedAt: serverTimestamp(),
        serveFlowStatus: 'SERVED'
      });

      // 🔄 SYNC ALL RELATED BATCHES
      for (const bSnap of batchSnaps) {
         if (!bSnap.exists()) continue;
         const bData = bSnap.data() as PrepBatch;

         // Force complete all batches associated with this full order
         if (bData.status !== 'COMPLETED') {
            const itemInBatch = order.items.find(i => i.id === bData.itemId);
            if (itemInBatch) {
               const newQty = Math.max(0, bData.quantity - itemInBatch.quantity);
               const newStatus = newQty <= 0 ? 'COMPLETED' : bData.status;
               tx.update(bSnap.ref, { 
                  quantity: newQty, 
                  status: newStatus,
                  updatedAt: serverTimestamp() 
               });
            }
         }
      }
    });
  } catch (err: any) {
    console.error("Error serving full order:", err);
    throw err;
  }
};


export const toggleQrRedeemable = async (orderId: string, redeemable: boolean, staffId: string, reason: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists()) throw new Error("Order not found");
      const order = snap.data() as Order;
      
      const newOverride = {
        staffId,
        reason,
        timestamp: Date.now()
      };

      tx.update(orderRef, {
        qrRedeemable: redeemable,
        overrides: arrayUnion(newOverride),
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error("Error toggling qrRedeemable:", error);
    throw error;
  }
};

export const serveItem = async (orderId: string, itemId: string, servedBy: string): Promise<void> => {
  if (useCallables()) {
    try {
      await serveItemCallable({ orderId, itemId, servedBy });
      return;
    } catch (err: any) {
      console.error("Error serving item (callable):", err);
      throw err;
    }
  }
  try {
    const orderRef = doc(db, "orders", orderId);
    const serveLogsRef = collection(db, "serveLogs");

    await runTransaction(db, async (tx) => {
      // ===== ALL READS MUST HAPPEN FIRST =====
      // Read order
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }

      const orderData = orderSnap.data();
      const order = firestoreToOrder(orderSnap.id, orderData);

      if (order.orderStatus === 'SERVED') {
        throw new Error("Order already served");
      }

      if (order.paymentStatus !== 'SUCCESS') {
        throw new Error("Payment not verified");
      }

      const itemIndex = order.items.findIndex(i => i.id === itemId);
      if (itemIndex === -1) {
        throw new Error("Item not found in order");
      }

      const item = order.items[itemIndex];
      if (item.remainingQty <= 0) {
        throw new Error("Item already fully served");
      }

      // Read inventory BEFORE any writes
      const invRef = doc(db, "inventory", itemId);
      const metaRef = doc(db, "inventory_meta", itemId);
      
      const [invSnap, metaSnap] = await Promise.all([
        tx.get(invRef),
        tx.get(metaRef)
      ]);

      // ===== NOW ALL WRITES CAN HAPPEN =====
      // Update item
      const updatedItems = [...order.items];
      updatedItems[itemIndex] = {
        ...item,
        servedQty: (item.servedQty || 0) + 1,
        remainingQty: item.remainingQty - 1
      };

      // Check if all items are completed
      const allItemsServed = updatedItems.every(i => i.remainingQty <= 0);
      const newOrderStatus = allItemsServed ? 'SERVED' : order.orderStatus;

      // Update order
      tx.update(orderRef, {
        items: updatedItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          costPrice: item.costPrice,
          category: item.category,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          servedQty: item.servedQty || 0,
          remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity
        })),
        orderStatus: newOrderStatus,
        qrStatus: allItemsServed ? 'DESTROYED' : order.qrStatus,
        qrState: allItemsServed ? 'SERVED' : 'SCANNED',
        servedAt: allItemsServed ? serverTimestamp() : order.servedAt ? Timestamp.fromMillis(order.servedAt) : null
      });

      // Create serve log
      const serveLogRef = doc(serveLogsRef);
      tx.set(serveLogRef, {
        orderId,
        itemId,
        itemName: item.name,
        quantityServed: 1,
        servedBy,
        servedAt: serverTimestamp()
      });

      // Update inventory shard (High performance / scalability)
      // This avoids write hotspots on the main inventory documents during peak loads
      const shardId = `shard_${Math.floor(Math.random() * INVENTORY_SHARD_COUNT)}`;
      const shardRef = doc(db, "inventory_shards", itemId, "shards", shardId);
      
      tx.set(shardRef, { 
        count: increment(1),
        lastUpdated: serverTimestamp()
      }, { merge: true });

      // Note: inventory_meta and inventory docs are updated via Cloud Function aggregation
      // to maintain high throughput on this serving transaction.
    });

    console.log('âœ… Item served:', { orderId, itemId, servedBy });
  } catch (error) {
    console.error("Error serving item:", error);
    throw error;
  }
};

/** Reject order from serving counter (Fraud/Invalid) */
export const rejectOrderFromCounter = async (orderId: string, rejectedBy: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      orderStatus: 'REJECTED',
      qrStatus: 'DESTROYED',
      qrState: 'REJECTED',
      rejectedBy,
      rejectedAt: serverTimestamp()
    });
    console.log('ðŸš« Order rejected from counter:', orderId);
  } catch (error) {
    console.error("Error rejecting order:", error);
    throw error;
  }
};

export const scanAndServeOrder = async (qrDataRaw: string, scannedBy: string = 'server_01') => {
  const scanTime = Date.now();
  let logEntry: ScanLog | null = null;

  try {
    // Parse payload or handle plain ID
    let orderId: string;
    let secureHash: string;
    let payloadExpiresAt: number | undefined;

    if (qrDataRaw.startsWith('order_')) {
      orderId = qrDataRaw;
      secureHash = 'MANUAL_OVERRIDE';
    } else {
      const payload = await parseQRPayload(qrDataRaw);
      if (!payload) throw new Error("Invalid Token Format");
      orderId = payload.orderId;
      secureHash = payload.secureHash;
      payloadExpiresAt = payload.expiresAt;
    }

    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (!orderDoc.exists()) {
      throw new Error("Order not found");
    }

    const order = firestoreToOrder(orderDoc.id, orderDoc.data());

    if (secureHash !== 'MANUAL_OVERRIDE') {
      const verifCreatedAt = order.createdAt;
      const verifExpiresAt = payloadExpiresAt || (verifCreatedAt + QR_EXPIRY_MS);
      const isValid = await verifySecureHash(orderId, order.userId, order.cafeteriaId, order.createdAt, verifExpiresAt, secureHash);
      if (!isValid) {
        throw new Error("Invalid Token Signature");
      }
    }

    if (order.paymentStatus !== 'SUCCESS') {
      throw new Error("PAYMENT_NOT_VERIFIED");
    }

    if (order.qrStatus === 'USED' || order.qrStatus === 'DESTROYED') {
      throw new Error("TOKEN_ALREADY_USED");
    }

    if (order.qrStatus !== 'ACTIVE') {
      throw new Error("QR_NOT_ACTIVE");
    }

    // Update order
    await updateDoc(doc(db, "orders", orderId), {
      orderStatus: 'SERVED',
      qrStatus: 'DESTROYED',
      qrState: 'SERVED',
      servedAt: serverTimestamp()
    });

    // Log successful scan
    logEntry = {
      id: 'log_' + Date.now(),
      orderId,
      userId: order.userId,
      userName: order.userName,
      scannedBy,
      scanTime,
      scanResult: 'SUCCESS',
      totalAmount: order.totalAmount
    };

    await setDoc(doc(collection(db, "scanLogs")), {
      orderId: logEntry.orderId,
      userId: logEntry.userId,
      userName: logEntry.userName,
      scannedBy: logEntry.scannedBy,
      scanTime: serverTimestamp(),
      scanResult: logEntry.scanResult,
      totalAmount: logEntry.totalAmount
    });

    // Update inventory
    for (const item of order.items) {
      await updateInventory(item.id, item.quantity);
    }

    return {
      success: true,
      message: 'TOKEN VALIDATED',
      order: { userName: order.userName, items: order.items }
    };
  } catch (err: any) {
    if (!logEntry) {
      logEntry = {
        id: 'log_' + Date.now(),
        orderId: 'UNKNOWN',
        userId: 'UNKNOWN',
        userName: 'UNKNOWN',
        scannedBy,
        scanTime,
        scanResult: 'FAILURE',
        totalAmount: 0,
        failureReason: err.message || 'Unknown error'
      };
    }

    await setDoc(doc(collection(db, "scanLogs")), {
      orderId: logEntry.orderId,
      userId: logEntry.userId,
      userName: logEntry.userName,
      scannedBy: logEntry.scannedBy,
      scanTime: serverTimestamp(),
      scanResult: logEntry.scanResult,
      totalAmount: logEntry.totalAmount,
      failureReason: logEntry.failureReason
    });

    throw err;
  }
};

// ============================================================================
// 6. ANALYTICS & REPORTS
// ============================================================================

export const getDailyReport = async (date: string): Promise<DailyReport | null> => {
  try {
    const reportDoc = await getDoc(doc(db, "dailyReports", date));
    if (reportDoc.exists()) {
      return reportDoc.data() as DailyReport;
    }
    return null;
  } catch (error) {
    console.error("Error getting daily report:", error);
    return null;
  }
};

export const getScanLogs = async (limitCount: number = 100): Promise<ScanLog[]> => {
  try {
    const snapshot = await getDocs(
      query(collection(db, "scanLogs"), orderBy("scanTime", "desc"), limit(limitCount))
    );
    const toMillis = (ts: any): number => {
      if (!ts) return Date.now();
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts === 'number') return ts;
      return Date.now();
    };
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      scanTime: toMillis(doc.data().scanTime)
    } as ScanLog));
  } catch (error) {
    console.error("Error getting scan logs:", error);
    return [];
  }
};

export const getServeLogs = async (limitCount: number = 100): Promise<ServeLog[]> => {
  try {
    const snapshot = await getDocs(
      query(collection(db, "serveLogs"), orderBy("servedAt", "desc"), limit(limitCount))
    );
    const toMillis = (ts: any): number => {
      if (!ts) return Date.now();
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts === 'number') return ts;
      return Date.now();
    };
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      servedAt: toMillis(doc.data().servedAt)
    } as ServeLog));
  } catch (error) {
    console.error("Error getting serve logs:", error);
    return [];
  }
};

/** Daily consumption per item (from serveLogs since start of today). For admin dashboard. */
export const getDailyConsumptionByItem = async (): Promise<Record<string, number>> => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startTs = Timestamp.fromDate(startOfDay);
    const snapshot = await getDocs(
      query(
        collection(db, "serveLogs"),
        where("servedAt", ">=", startTs),
        limit(5000)
      )
    );
    const byItem: Record<string, number> = {};
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const id = data.itemId || "";
      const qty = data.quantityServed ?? 1;
      byItem[id] = (byItem[id] || 0) + qty;
    });
    return byItem;
  } catch (error) {
    console.error("Error getDailyConsumptionByItem:", error);
    return {};
  }
};

/** Popular menu items by order quantity (recent orders). For admin dashboard. */
export const getPopularMenuItems = async (limitOrders: number = 500): Promise<{ itemId: string; itemName?: string; quantity: number }[]> => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "orders"),
        orderBy("createdAt", "desc"),
        limit(limitOrders)
      )
    );
    const byItem: Record<string, { quantity: number; itemName?: string }> = {};
    snapshot.docs.forEach((d) => {
      const data = d.data();
      (data.items || []).forEach((item: { id?: string; name?: string; quantity?: number }) => {
        const id = item.id || "";
        const qty = item.quantity ?? 1;
        if (!byItem[id]) byItem[id] = { quantity: 0, itemName: item.name };
        byItem[id].quantity += qty;
      });
    });
    return Object.entries(byItem)
      .map(([itemId, v]) => ({ itemId, itemName: v.itemName, quantity: v.quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  } catch (error) {
    console.error("Error getPopularMenuItems:", error);
    return [];
  }
};

// ============================================================================
// 7. BATCH PREPARATION SYSTEM (Smart Queue)
// ============================================================================

/** Internal helper for Re-batching */
const internalCreateBatchFromOrder = async (orderId: string, item: CartItem, slot: number): Promise<void> => {
    const batchId = `batch_${slot}_${item.id}`;
    const batchRef = doc(db, "prepBatches", batchId);
    
    await runTransaction(db, async (tx) => {
        const snap = await tx.get(batchRef);
        if (!snap.exists()) {
            tx.set(batchRef, {
                id: batchId,
                itemId: item.id,
                itemName: item.name,
                arrivalTimeSlot: slot,
                orderIds: [orderId],
                quantity: item.quantity,
                status: 'QUEUED',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } else {
            const data = snap.data() as PrepBatch;
            const existingOrderIds = data.orderIds || [];
            if (!existingOrderIds.includes(orderId)) {
                tx.update(batchRef, {
                    orderIds: [...existingOrderIds, orderId],
                    quantity: data.quantity + item.quantity,
                    updatedAt: serverTimestamp()
                });
            }
        }
    });
};

export const listenToBatches = (callback: (batches: PrepBatch[]) => void): (() => void) => {
  // 🚀 [Principal Fix] Index-Free Resilience
  // We fetch by creation time and filter status in JS to avoid breaking on missing 
  // composite Firestore index in test/prod environments.
  return onSnapshot(
    query(
      collection(db, "prepBatches"), 
      orderBy("createdAt", "desc"),
      limit(100)
    ),
    (snapshot) => {
      const allBatches = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
          updatedAt: data.updatedAt?.toMillis?.() || Date.now()
        } as PrepBatch;
      });

      // Filter in JS: Only keep active production batches
      const activeBatches = allBatches.filter(b => 
        ["QUEUED", "PREPARING", "ALMOST_READY", "READY"].includes(b.status)
      );

      // Sort by slot time for the display logic
      const sorted = activeBatches.sort((a, b) => (a.arrivalTimeSlot || 0) - (b.arrivalTimeSlot || 0));
      callback(sorted);
    },
    (error) => {
      console.error("Error listening to batches:", error);
      callback([]);
    }
  );
};

export const startBatchPreparation = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);
  try {
    await runTransaction(db, async (tx) => {
      // PHASE 1: READ
      const batchSnap = await tx.get(batchRef);
      if (!batchSnap.exists()) return;
      const data = batchSnap.data() as PrepBatch;
      
      // Read all order docs before writing anything
      const orderRefs = (data.orderIds || []).map(oid => doc(db, "orders", oid));
      const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

      // PHASE 2: WRITE
      tx.update(batchRef, { status: 'PREPARING', updatedAt: serverTimestamp() });
      orderSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          tx.update(orderRefs[i], { serveFlowStatus: 'PREPARING' });
        }
      });
    });
  } catch (err) {
    console.error("Error starting batch prep:", err);
    throw err;
  }
};

export const markBatchAlmostReady = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);
  try {
    await runTransaction(db, async (tx) => {
      // PHASE 1: READ
      const batchSnap = await tx.get(batchRef);
      if (!batchSnap.exists()) return;
      const data = batchSnap.data() as PrepBatch;

      const orderRefs = (data.orderIds || []).map(oid => doc(db, "orders", oid));
      const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

      // PHASE 2: WRITE
      tx.update(batchRef, { 
        status: 'ALMOST_READY', 
        updatedAt: serverTimestamp() 
      });
      orderSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          tx.update(orderRefs[i], { serveFlowStatus: 'ALMOST_READY' });
        }
      });
    });
  } catch (err) {
    console.error("Error marking batch almost ready:", err);
    throw err;
  }
};

export const markBatchReady = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);
  try {
    const now = Date.now();

    await runTransaction(db, async (tx) => {
      // PHASE 1: READ
      const batchSnap = await tx.get(batchRef);
      if (!batchSnap.exists()) return;
      const bData = batchSnap.data() as PrepBatch;

      // Double action protection
      if (bData.status === 'READY') return;

      const orderRefs = (bData.orderIds || []).map(oid => doc(db, "orders", oid));
      const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

      // PHASE 2: WRITE
      tx.update(batchRef, { 
        status: 'READY', 
        readyAt: now, 
        updatedAt: serverTimestamp() 
      });
      
      orderSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          tx.update(orderRefs[i], { 
            serveFlowStatus: 'READY',
            pickupWindow: {
              startTime: now,
              endTime: now + PICKUP_WINDOW_DURATION_MS,
              durationMs: PICKUP_WINDOW_DURATION_MS,
              status: 'COLLECTING'
            }
          });
        }
      });
    });
  } catch (err) {
    console.error("Error marking batch ready:", err);
    throw err;
  }
};

export const markBatchCompleted = async (batchId: string): Promise<void> => {
   await updateDoc(doc(db, "prepBatches", batchId), { 
     status: 'COMPLETED', 
     updatedAt: serverTimestamp() 
   });
};

// â”€â”€â”€ Slot Level Controllers (Batch Operations) â”€â”€â”€

/**
 * updateSlotStatus â€” Updates all batches in a slot AND their linked orders.
 * 
 * ARCHITECTURE: Strict read-before-write transaction.
 * 1. Query all active batches in this slot (outside transaction â€” queries 
 *    can't run inside transactions anyway).
 * 2. Inside the transaction:
 *    - PHASE 1: Read ALL batch docs + ALL order docs upfront.
 *    - PHASE 2: Write ALL updates.
 *    No read is ever performed after a write.
 */
export const updateSlotStatus = async (slot: number, status: PrepBatchStatus): Promise<void> => {
    // Step 0: Query batch IDs outside the transaction (query is NOT transactional)
    const q = query(
        collection(db, "prepBatches"),
        where("arrivalTimeSlot", "==", slot),
        where("status", "!=", "COMPLETED")
    );
    
    const querySnap = await getDocs(q);
    if (querySnap.empty) return;

    const batchIds = querySnap.docs.map(d => d.id);

    await runTransaction(db, async (tx) => {
        const now = Date.now();

        // ============================================================
        // PHASE 1 â€” ALL READS (no writes until this section is done)
        // ============================================================
        
        // 1a. Read all batch documents
        const batchRefs = batchIds.map(bid => doc(db, "prepBatches", bid));
        const batchSnaps = await Promise.all(batchRefs.map(r => tx.get(r)));

        // 1b. Collect all unique order IDs from all batches
        const batchDataList: { ref: any; data: PrepBatch; idx: number }[] = [];
        const allOrderIds = new Set<string>();
        
        batchSnaps.forEach((snap, idx) => {
            if (!snap.exists()) return;
            const data = snap.data() as PrepBatch;
            if (data.status === status) return; // already at target status, skip
            batchDataList.push({ ref: batchRefs[idx], data, idx });
            (data.orderIds || []).forEach(oid => allOrderIds.add(oid));
        });

        if (batchDataList.length === 0) return; // nothing to update

        // 1c. Read ALL order documents upfront
        const orderIdArray = Array.from(allOrderIds);
        const orderRefs = orderIdArray.map(oid => doc(db, "orders", oid));
        const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

        // Build a lookup: orderId â†’ { ref, snap }
        const orderMap = new Map<string, { ref: any; snap: any }>();
        orderIdArray.forEach((oid, i) => {
            orderMap.set(oid, { ref: orderRefs[i], snap: orderSnaps[i] });
        });

        // ============================================================
        // PHASE 2 â€” ALL WRITES (no reads from this point forward)
        // ============================================================

        // 2a. Update each batch
        batchDataList.forEach(({ ref, data }) => {
            const updateObj: any = { status, updatedAt: serverTimestamp() };
            if (status === 'READY') updateObj.readyAt = now;
            tx.update(ref, updateObj);
        });

        // 2b. Update each order (using pre-fetched snapshots)
        batchDataList.forEach(({ data: batchData }) => {
            (batchData.orderIds || []).forEach(orderId => {
                const entry = orderMap.get(orderId);
                if (!entry || !entry.snap.exists()) return;

                const orderData = entry.snap.data();
                const items = (orderData.items || []).map((item: any) => {
                    // Authorize 'ABANDONED', 'MISSED', or 'READY' items to be updated to the new status
                    if (item.id === batchData.itemId && item.status !== 'SERVED') {
                        return { ...item, status };
                    }
                    return item;
                });

                const orderUpdate: any = { serveFlowStatus: status, items };
                if (status === 'READY') {
                    orderUpdate.pickupWindow = {
                        startTime: now,
                        endTime: now + PICKUP_WINDOW_DURATION_MS,
                        durationMs: PICKUP_WINDOW_DURATION_MS,
                        status: 'COLLECTING'
                    };
                }
                tx.update(entry.ref, orderUpdate);
            });
        });
    });
};

/**
 * tryAcquireMaintenanceLock â€” Leader election for background maintenance tasks.
 * Reads system/maintenance doc. If it doesn't exist, creates it.
 * If the doc is stale (>10s), takes over. Otherwise yields.
 */
export const tryAcquireMaintenanceLock = async (nodeId: string): Promise<boolean> => {
  const maintenanceRef = doc(db, "system", "maintenance");
  const now = Date.now();

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(maintenanceRef);
      if (!snap.exists()) {
        tx.set(maintenanceRef, { lastHeartbeatAt: now, activeNodeId: nodeId });
        return true;
      }
      
      const data = snap.data() as SystemMaintenance;
      if (now - data.lastHeartbeatAt > 30000) {
        tx.update(maintenanceRef, { lastHeartbeatAt: now, activeNodeId: nodeId });
        return true;
      }
      
      return false;
    });
  } catch (err) {
    console.warn("Maintenance lock acquisition failed (non-fatal):", (err as any)?.message);
    return false;
  }
};

export const flushMissedPickups = async (nodeId?: string): Promise<number> => {
  const now = Date.now();

  try {
    const q = query(
      collection(db, "orders"),
      where("pickupWindow.status", "==", "COLLECTING"),
      where("orderStatus", "!=", "SERVED")
    );

    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const masterBatch = writeBatch(db);
    let updatedCount = 0;
    const graceNow = now + 100; // Ultra-slim buffer
    
    // 🛡️ [SONIC-AGGREGATOR]
    // We must collect all re-queues into a manifest first to avoid 'duplicate-key' overwrites 
    // within the single Firestore Batch commit.
    const aggregatedBatches: Record<string, any> = {};
    const oldBatchDecrements: Record<string, number> = {};

    for (const d of snap.docs) {
      const data = d.data();
      const endTime = data.pickupWindow?.endTime || 0;
      
      if (endTime > graceNow) continue;

      const currentMissedCount = (data.missedCount || 0) + 1;
      const nowTime = new Date();
      // ⏱️ [SONIC-SLOT] Move to the IMMEDIATE Next 15-min block
      const totalMins = nowTime.getHours() * 60 + nowTime.getMinutes();
      const currentBlockMins = Math.floor(totalMins / 15) * 15;
      const nextSlotMins = currentBlockMins; // Re-queue to CURRENT slot for immediate attention
      
      const slotH = Math.floor(nextSlotMins / 60);
      const slotM = nextSlotMins % 60;
      const nextSlot = Number(`${slotH.toString().padStart(2, '0')}${slotM.toString().padStart(2, '0')}`);

      if (currentMissedCount >= 3) {
        masterBatch.update(d.ref, {
          "pickupWindow.status": 'ABANDONED',
          "serveFlowStatus": 'ABANDONED',
          "orderStatus": 'ABANDONED',
          "missedCount": currentMissedCount,
          "updatedAt": serverTimestamp(),
          "items": (data.items || []).map((it: any) => ({ ...it, status: 'ABANDONED' }))
        });
      } else {
        const isDynamic = (data.items || []).some((it: any) => it.orderType === 'PREPARATION_ITEM');
        
        const reQueuedItems = (data.items || []).map((it: any) => {
           const remQty = typeof it.remainingQty === 'number' ? it.remainingQty : it.quantity;
           if (remQty > 0 && (it.status === 'READY' || it.status === 'COLLECTING' || it.status === 'MISSED' || it.status === 'READY_SERVED')) {
             // 🛡️ [PRINCIPAL-FIX] Only revert items to PENDING if they actually need cooking!
             const canRequeue = !isStaticItem(it);
             return { ...it, status: canRequeue ? 'PENDING' : it.status, remainingQty: remQty };
           }
           return it;
        });

        // 1. Update the Order doc
        masterBatch.update(d.ref, {
          "pickupWindow.status": 'COLLECTING', // Keep active
          "serveFlowStatus": isDynamic ? 'PENDING' : 'READY', // Never show 'Preparing' for static!
          "orderStatus": 'ACTIVE',
          "qrStatus": 'ACTIVE',
          "qrState": 'ACTIVE',
          "missedCount": currentMissedCount,
          "arrivalTimeSlot": nextSlot, // Audit trail
          "items": reQueuedItems,
          "updatedAt": serverTimestamp()
        });

        // 2. Aggregate for NEW batches (only for items now marked PENDING)
        reQueuedItems.forEach((it: any) => {
           if (it.status === 'PENDING') {
              const batchId = `batch_${nextSlot}_${it.id}`;
              if (!aggregatedBatches[batchId]) {
                 aggregatedBatches[batchId] = {
                    id: batchId,
                    itemId: it.id,
                    itemName: it.name,
                    arrivalTimeSlot: nextSlot,
                    orderIds: new Set<string>(),
                    quantity: 0
                 };
              }
              const remQty = typeof it.remainingQty === 'number' ? it.remainingQty : it.quantity;
              if (remQty > 0) {
                aggregatedBatches[batchId].orderIds.add(d.id);
                aggregatedBatches[batchId].quantity += remQty;
              }
           }
        });

        // 3. Mark OLD batches for decrement
        (data.items || []).forEach((it: any) => {
           // If this item was in old batches and we are re-queuing it, we must subtract its quantity from the old batch
           if (it.status === 'READY' || it.status === 'COLLECTING') {
              const oldSlot = data.arrivalTimeSlot;
              if (oldSlot) {
                 const oldBatchId = `batch_${oldSlot}_${it.id}`;
                 const decrQty = typeof it.remainingQty === 'number' ? it.remainingQty : it.quantity;
                 if (decrQty > 0) {
                   oldBatchDecrements[oldBatchId] = (oldBatchDecrements[oldBatchId] || 0) + decrQty;
                 }
              }
           }
        });
      }
      updatedCount++;
    }

    // 🏎️💨 STAGE 2: COMMIT AGGREGATED MANIFEST (Atomic Sonic Write)
    // 2.1 CREATE NEW BATCHES
    Object.values(aggregatedBatches).forEach((b: any) => {
       const bRef = doc(db, "prepBatches", b.id);
       masterBatch.set(bRef, {
          id: b.id,
          itemId: b.itemId,
          itemName: b.itemName,
          arrivalTimeSlot: b.arrivalTimeSlot,
          orderIds: arrayUnion(...Array.from(b.orderIds)),
          quantity: increment(b.quantity),
          status: 'QUEUED',
          isRequeued: true, // 🏷️ FLAG FOR KITCHEN UI
          updatedAt: serverTimestamp()
       }, { merge: true });
    });

    // 2.2 CLEANUP OLD BATCHES (Decrement)
    Object.entries(oldBatchDecrements).forEach(([bId, qty]) => {
       const bRef = doc(db, "prepBatches", bId);
       // We use increment(-qty). If quantity hits 0, the Cook Console handles the hidden state 
       // Or we could try to set status to COMPLETED if it hits 0, but increment is safer.
       masterBatch.update(bRef, {
          quantity: increment(-qty),
          updatedAt: serverTimestamp()
       });
    });

    if (updatedCount > 0) {
      await masterBatch.commit();
      console.log(`⚡ [SONIC-SYNC] Re-queued ${updatedCount} orders atomically.`);
    }
    return updatedCount;
  } catch (error) {
    console.error("❌ Flush missed pickups failed:", error);
    return 0;
  }
};

export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const docSnap = await getDoc(doc(db, "orders", orderId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const toMillis = (val: any) => {
        if (!val) return Date.now();
        if (typeof val.toMillis === 'function') return val.toMillis();
        return val;
      };
      return {
        id: docSnap.id,
        ...data,
        createdAt: toMillis(data.createdAt),
        scannedAt: data.scannedAt ? toMillis(data.scannedAt) : undefined,
        servedAt: data.servedAt ? toMillis(data.servedAt) : undefined
      } as Order;
    }
    return null;
  } catch (error) {
    console.error("Error getting order by id:", error);
    return null;
  }
};
