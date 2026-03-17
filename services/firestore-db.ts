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
import { DEFAULT_FOOD_IMAGE, INITIAL_MENU, DEFAULT_ORDERING_ENABLED, DEFAULT_SERVING_RATE_PER_MIN, INVENTORY_SHARD_COUNT } from "../constants";

export const MAX_BATCH_SIZE = 40;
export const PICKUP_WINDOW_DURATION_MS = 7 * 60 * 1000;
import { parseQRPayload, verifySecureHash, verifySecureHashSync, generateQRPayload, generateQRPayloadSync, isQRExpired, QR_EXPIRY_MS } from "./qr";
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
    status: item.status || 'PENDING'
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
  batchId: order.batchId || null,
  missedCount: order.missedCount || 0,
  missedFromBatchId: order.missedFromBatchId || null,
  sentPickupReminderAt: order.sentPickupReminderAt != null ? Timestamp.fromMillis(order.sentPickupReminderAt) : null,
  preparationStationId: order.preparationStationId || null,
  queuePosition: order.queuePosition ?? null,
  estimatedQueueStartTime: order.estimatedQueueStartTime != null ? Timestamp.fromMillis(order.estimatedQueueStartTime) : null,
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
    batchId: data.batchId || null,
    missedCount: data.missedCount || 0,
    missedFromBatchId: data.missedFromBatchId || null,
    sentPickupReminderAt: toMillis(data.sentPickupReminderAt),
    preparationStationId: data.preparationStationId || undefined,
    queuePosition: data.queuePosition ?? undefined,
    estimatedQueueStartTime: toMillis(data.estimatedQueueStartTime),
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

export const listenToMenu = (callback: (items: MenuItem[]) => void): (() => void) => {
  // Query all menu items (no index needed), filter and sort in-memory
  // This is simpler and more reliable than composite index query
  return onSnapshot(
    query(collection(db, "menu")),
    (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MenuItem))
        .filter(item => item.active !== false) // Filter active items in-memory
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name in-memory
      
      callback(items);
    },
    (error) => {
      console.error("Error listening to menu:", error);
      callback([]);
    }
  );
};

// Initialize menu if empty
export const initializeMenu = async (): Promise<void> => {
  try {
    const menuSnapshot = await getDocs(collection(db, "menu"));
    if (menuSnapshot.empty) {
      const batch = writeBatch(db);
      INITIAL_MENU.forEach(item => {
        const menuRef = doc(db, "menu", item.id);
        batch.set(menuRef, {
          ...item,
          imageUrl: item.imageUrl || DEFAULT_FOOD_IMAGE
        });
      });
      await batch.commit();
      console.log("✅ Menu initialized with default items");
      
      // Also initialize inventory + inventory_meta for menu items (inventory_meta for real-time student view)
      const inventoryBatch = writeBatch(db);
      const LOW_STOCK_DEFAULT = 20;
      INITIAL_MENU.forEach(item => {
        const invRef = doc(db, "inventory", item.id);
        inventoryBatch.set(invRef, {
          itemId: item.id,
          itemName: item.name,
          openingStock: 100,
          consumed: 0,
          category: item.category,
          lastUpdated: serverTimestamp()
        });
        const metaRef = doc(db, "inventory_meta", item.id);
        inventoryBatch.set(metaRef, {
          itemId: item.id,
          totalStock: 100,
          consumed: 0,
          lowStockThreshold: LOW_STOCK_DEFAULT,
          itemName: item.name,
          category: item.category,
          lastUpdated: serverTimestamp()
        });
      });
      await inventoryBatch.commit();
      console.log("✅ Inventory and inventory_meta initialized for menu items");
    }
  } catch (error) {
    console.error("Error initializing menu:", error);
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

/** Real-time inventory_meta listener. Use includeMetadataChanges: false to reduce bandwidth. */
export const listenToInventoryMeta = (
  callback: (items: InventoryMetaItem[]) => void,
  options?: { includeMetadataChanges?: boolean }
): (() => void) => {
  const colRef = collection(db, "inventory_meta");

  const onNext = (snapshot: any) => {
    const items: InventoryMetaItem[] = snapshot.docs.map((d: any) => {
      const data = d.data();
      const totalStock = data.totalStock ?? 0;
      const consumed = data.consumed ?? 0;
      const lowStockThreshold = data.lowStockThreshold ?? 20;
      return {
        itemId: d.id,
        totalStock,
        consumed,
        lowStockThreshold,
        available:
          data.available != null
            ? data.available
            : Math.max(0, totalStock - consumed),
        stockStatus: data.stockStatus ?? undefined,
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

  if (options?.includeMetadataChanges) {
    return onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      onNext,
      onError
    );
  }

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

/** Update kitchen workflow state (PLACED → COOKING → READY → SERVED). Server/admin only via Callable. */
export const updateKitchenStatus = async (orderId: string, kitchenStatus: KitchenStatus): Promise<void> => {
  if (useCallables()) {
    await updateKitchenStatusCallable({ orderId, kitchenStatus });
    return;
  }
  await updateDoc(doc(db, "orders", orderId), { kitchenStatus });
};

/** Zero-wait: update serve flow (NEW→PREPARING→READY). Server only. */
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
    const result = await runTransaction(db, async (transaction) => {
      // 1. Idempotency check (Document-based for transaction compatibility)
      if (orderData.idempotencyKey) {
        const idempRef = doc(db, "idempotency_keys", orderData.idempotencyKey);
        const idempSnap = await transaction.get(idempRef);
        if (idempSnap.exists()) {
          return idempSnap.data().orderId;
        }
      }

      // 2. Stock validation
      for (const item of orderData.items) {
        const metaRef = doc(db, "inventory_meta", item.id);
        const metaSnap = await transaction.get(metaRef);
        if (metaSnap.exists()) {
          const data = metaSnap.data();
          const available = (data.totalStock ?? 0) - (data.consumed ?? 0);
          if (available < item.quantity) {
            throw new Error(`OUT_OF_STOCK: ${item.name}`);
          }
        }
      }

      // 3. Prepare order
      const isDynamic = orderData.items.some(it => it.orderType === 'PREPARATION_ITEM');
      const orderType = isDynamic ? 'PREPARATION_ITEM' : 'FAST_ITEM';
      
      const newOrder: Order = {
        ...orderData,
        items: itemsWithQty,
        id,
        createdAt,
        orderStatus: 'PENDING',
        orderType,
        serveFlowStatus: isDynamic ? 'NEW' : 'READY',
        // Default pickup window for FAST_ITEMS is immediate
        pickupWindowStart: !isDynamic ? createdAt : undefined,
        pickupWindowEnd: !isDynamic ? createdAt + (60 * 60 * 1000) : undefined
      } as Order;

      if (newOrder.paymentStatus === 'SUCCESS') {
        newOrder.qrStatus = 'ACTIVE';
        const token = generateQRPayloadSync(newOrder);
        newOrder.qr = { token, status: 'ACTIVE', createdAt };
      }

      // 4. Batch Allocation Logic (for dynamic items)
      if (isDynamic && orderData.arrivalTime) {
        const slot = orderData.arrivalTime;
        const prepItems = orderData.items.filter(it => it.orderType === 'PREPARATION_ITEM');
        
        for (const item of prepItems) {
          // Find or create a batch for this item/slot respecting MAX_BATCH_SIZE
          let assignedBatchId = "";
          let index = 0;
          let found = false;

          while (!found && index < 20) {
            const potentialId = `batch_${slot}_${item.id}_${index}`;
            const bRef = doc(db, "prepBatches", potentialId);
            const bSnap = await transaction.get(bRef);

            if (!bSnap.exists()) {
              transaction.set(bRef, {
                id: potentialId,
                itemId: item.id,
                itemName: item.name,
                arrivalTimeSlot: slot,
                orderIds: [id],
                quantity: item.quantity,
                status: 'QUEUED',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              assignedBatchId = potentialId;
              found = true;
            } else {
              const bData = bSnap.data() as PrepBatch;
              if (bData.status === 'QUEUED' && (bData.quantity + item.quantity) <= MAX_BATCH_SIZE) {
                transaction.update(bRef, {
                  orderIds: arrayUnion(id),
                  quantity: increment(item.quantity),
                  updatedAt: serverTimestamp()
                });
                assignedBatchId = potentialId;
                found = true;
              } else {
                index++;
              }
            }
          }

          if (!found) {
             // Fallback: create unique overflow batch
             const overflowId = `batch_${slot}_${item.id}_ovf_${Date.now()}`;
             transaction.set(doc(db, "prepBatches", overflowId), {
                id: overflowId,
                itemId: item.id,
                itemName: item.name,
                arrivalTimeSlot: slot,
                orderIds: [id],
                quantity: item.quantity,
                status: 'QUEUED',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
             });
             assignedBatchId = overflowId;
          }
          
          newOrder.batchId = assignedBatchId; // Track the batch for the order
        }
      }

      // 4. Update Inventory Shards (Atomic count increment)
      for (const item of orderData.items) {
        const shardIndex = Math.floor(Math.random() * INVENTORY_SHARD_COUNT);
        const shardRef = doc(db, "inventory_shards", item.id, "shards", `shard_${shardIndex}`);
        transaction.set(shardRef, { 
          count: increment(item.quantity),
          lastUpdated: serverTimestamp() 
        }, { merge: true });
      }

      // 5. Register idempotency key
      if (orderData.idempotencyKey) {
        transaction.set(doc(db, "idempotency_keys", orderData.idempotencyKey), {
          orderId: id,
          createdAt: serverTimestamp()
        });
      }

      // 6. Write order
      transaction.set(doc(db, "orders", id), orderToFirestore(newOrder));
      return id;
    });

    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (_e) {}

    return result;
  } catch (error: any) {
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      console.warn("Network error during order creation (order may be queued):", error);
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
  return onSnapshot(
    query(collection(db, "orders"), orderBy("createdAt", "desc")),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
    },
    (error) => {
      console.error("Error listening to orders:", error);
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
      where("paymentType", "==", "CASH"),
      where("paymentStatus", "==", "PENDING"),
      orderBy("createdAt", "desc")
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
    },
    (error) => {
      console.error("Error listening to pending cash orders:", error);
      callback([]);
    }
  );
};

export const confirmCashPayment = async (orderId: string, _cashierUid: string): Promise<void> => {
  if (useCallables()) {
    try {
      await confirmPaymentCallable({ orderId });
      try {
        const { invalidateReportsCache } = await import('./reporting');
        invalidateReportsCache();
      } catch (_e) {}
      return;
    } catch (err: any) {
      console.error("Error confirming cash payment (callable):", err);
      throw err?.message?.includes?.('ALREADY') ? new Error("Order already confirmed") : err;
    }
  }
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found");
      const orderData = orderSnap.data();
      if (orderData.paymentStatus === 'SUCCESS') throw new Error("Order already confirmed");
      const createdAtMillis = (orderData.createdAt?.toMillis?.() ?? Date.now());
      const tempOrder: Order = {
        id: orderId,
        userId: orderData.userId,
        userName: orderData.userName,
        items: (orderData.items || []).map((it: any) => ({ ...it, servedQty: it.servedQty || 0, remainingQty: it.remainingQty ?? it.quantity })),
        totalAmount: orderData.totalAmount,
        paymentType: orderData.paymentType,
        paymentStatus: 'SUCCESS',
        orderStatus: orderData.orderStatus || 'PENDING',
        qrStatus: 'ACTIVE',
        createdAt: createdAtMillis,
        cafeteriaId: orderData.cafeteriaId || 'main'
      } as Order;
      const token = generateQRPayloadSync(tempOrder);
      tx.update(orderRef, {
        paymentStatus: 'SUCCESS',
        qrStatus: 'ACTIVE',
        qr: { token, status: 'ACTIVE', createdAt: serverTimestamp() },
        confirmedBy: _cashierUid,
        confirmedAt: serverTimestamp()
      });
    });
    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (_e) {}
  } catch (error) {
    console.error("Error confirming cash payment:", error);
    throw error;
  }
};

export const rejectCashPayment = async (orderId: string, _cashierUid: string): Promise<void> => {
  if (useCallables()) {
    try {
      await rejectPaymentCallable({ orderId });
      try {
        const { invalidateReportsCache } = await import('./reporting');
        invalidateReportsCache();
      } catch (_e) {}
      return;
    } catch (err: any) {
      console.error("Error rejecting cash payment (callable):", err);
      throw err?.message?.includes?.('ALREADY') ? new Error("ALREADY_PROCESSED") : err;
    }
  }
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found");
      const orderData = orderSnap.data();
      if (orderData.paymentStatus !== 'PENDING') throw new Error("ALREADY_PROCESSED");
      tx.update(orderRef, {
        paymentStatus: 'REJECTED',
        orderStatus: 'CANCELLED',
        rejectedAt: serverTimestamp(),
        rejectedBy: _cashierUid,
        qrStatus: 'REJECTED'
      });
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
}

export const listenToActiveOrders = (callback: (orders: Order[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "orders"),
      where("qrState", "==", "SCANNED"),
      orderBy("createdAt", "asc")
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      callback(orders);
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
      where("qrState", "==", "SCANNED"),
      orderBy("createdAt", "asc")
    ),
    (snapshot) => {
      const pendingItems: PendingItem[] = [];
      snapshot.docs.forEach(doc => {
        const order = firestoreToOrder(doc.id, doc.data());
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

export const validateQRForServing = async (qrData: string): Promise<Order> => {
  console.log('🛡️ [FIREBASE-ORDER] Validating Meal Token...');
  
  try {
    let orderId: string;
    let secureHash: string;
    let payloadExpiresAt: number | undefined;

    if (qrData.startsWith('order_')) {
      orderId = qrData;
      secureHash = 'MANUAL_OVERRIDE';
    } else {
      const payload = await parseQRPayload(qrData);
      if (!payload?.orderId) {
        throw new Error("INVALID_TOKEN_FORMAT - This does not look like a JOE Meal Token.");
      }
      orderId = payload.orderId;
      secureHash = payload.secureHash;
      payloadExpiresAt = payload.expiresAt;
    }

    // 2. Direct Firestore Fetch (The Source of Truth)
    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (!orderDoc.exists()) {
      throw new Error("ORDER_NOT_FOUND - Token corresponds to a non-existent order.");
    }

    const orderData = orderDoc.data();
    const order = firestoreToOrder(orderDoc.id, orderData);

    // 3. Status Checks (Fail fast)
    if (order.paymentStatus !== 'SUCCESS') {
      throw new Error("PAYMENT_REQUIRED - This order has not been paid for yet.");
    }
    if (order.qrStatus === 'USED' || order.qrStatus === 'DESTROYED') {
      throw new Error("ALREADY_SERVED - This token has already been scanned and used.");
    }

    // 4. Strict check: Only serve if READY (in collecting window)
    if (order.pickupWindow?.status !== 'COLLECTING') {
      throw new Error(`SERVE_BLOCKED - Item status is ${order.pickupWindow?.status || order.serveFlowStatus}. Only READY items can be served.`);
    }

    // 4. Cryptographic Signature Verification
    if (secureHash !== 'MANUAL_OVERRIDE') {
      // Reconstruct components for verification using DB data
      const verifCreatedAt = order.createdAt;
      const verifExpiresAt = payloadExpiresAt || (verifCreatedAt + QR_EXPIRY_MS);

      const isValid = await verifySecureHash(
        order.id,
        order.userId, 
        order.cafeteriaId, 
        verifCreatedAt, 
        verifExpiresAt, 
        secureHash
      );

      if (!isValid) {
        throw new Error("SECURITY_BREACH - Token signature is invalid.");
      }
    }

    console.log('✅ [FIREBASE-ORDER] Token validated successfully:', orderId);

    // 5. Mark as SCANNED in database so it appears at serving counter
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      scannedAt: serverTimestamp(),
      qrState: 'SCANNED'
    });

    return { ...order, scannedAt: Date.now(), qrState: 'SCANNED' };
  } catch (error: any) {
    console.error('❌ [SCAN-ERROR]:', error.message);
    throw error;
  }
};

// Batch serve multiple quantities of an item
export const serveItemBatch = async (orderId: string, itemId: string, quantity: number, servedBy: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    const serveLogsRef = collection(db, "serveLogs");

    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found");

      const orderData = orderSnap.data();
      const order = firestoreToOrder(orderSnap.id, orderData);

      if (order.orderStatus === 'SERVED') throw new Error("Order already served");
      if (order.paymentStatus !== 'SUCCESS') throw new Error("Payment not verified");

      // Strict check: Only serve if READY (in collecting window) or Overridden
      if (order.pickupWindow?.status !== 'COLLECTING' && !order.qrRedeemable) {
        throw new Error(`SERVE_BLOCKED - Item status is ${order.pickupWindow?.status || order.serveFlowStatus}. Only READY items or Overridden orders can be served.`);
      }

      const itemIndex = order.items.findIndex(i => i.id === itemId);
      if (itemIndex === -1) throw new Error("Item not found in order");
      const item = order.items[itemIndex];
      if (item.remainingQty < quantity) throw new Error("Not enough remaining quantity");

      // Update item quantities and status
      const updatedItems = [...order.items];
      const newServedQty = (item.servedQty || 0) + quantity;
      const newRemainingQty = item.remainingQty - quantity;
      
      updatedItems[itemIndex] = {
        ...item,
        servedQty: newServedQty,
        remainingQty: newRemainingQty,
        status: newRemainingQty <= 0 ? 'SERVED' : 'PENDING'
      };

      // Check if all items are completed (SERVED or ABANDONED)
      const allResolved = updatedItems.every(i => i.status === 'SERVED' || i.status === 'ABANDONED');
      const newOrderStatus = allResolved ? 'SERVED' : order.orderStatus;

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
          remainingQty: item.remainingQty,
          status: item.status
        })),
        orderStatus: newOrderStatus,
        servedAt: allResolved ? Date.now() : null,
        updatedAt: serverTimestamp(),
        qrStatus: allResolved ? 'DESTROYED' : order.qrStatus,
        qrState: allResolved ? 'SERVED' : 'SCANNED',
      });

      // Create serve log
      const serveLogRef = doc(serveLogsRef);
      tx.set(serveLogRef, {
        orderId,
        itemId,
        itemName: item.name,
        quantityServed: quantity,
        servedBy,
        servedAt: serverTimestamp()
      });

      // Update inventory shards for the batch
      const shardId = `shard_${Math.floor(Math.random() * INVENTORY_SHARD_COUNT)}`;
      const shardRef = doc(db, "inventory_shards", itemId, "shards", shardId);
      
      tx.set(shardRef, { 
        count: increment(quantity),
        lastUpdated: serverTimestamp() 
      }, { merge: true });
    });

    console.log('✅ Batch items served:', { orderId, itemId, quantity, servedBy });
  } catch (error) {
    console.error("Error batch serving items:", error);
    throw error;
  }
};

/**
 * Serve an entire order in one atomic transaction.
 * Marks orderStatus = 'SERVED' and qrStatus = 'DESTROYED'.
 */
export const serveFullOrder = async (orderId: string, servedBy: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error("Order not found");
      const data = orderSnap.data();
      const order = firestoreToOrder(orderSnap.id, data);

      if (order.orderStatus === 'SERVED') return;

      if (order.pickupWindow?.status !== 'COLLECTING' && !order.qrRedeemable) {
        throw new Error(`SERVE_BLOCKED - Order status is ${order.pickupWindow?.status || order.serveFlowStatus}. Only READY orders or Overridden orders can be served.`);
      }

      const updatedItems = order.items.map(item => {
        const remaining = item.remainingQty !== undefined ? item.remainingQty : (item.quantity - (item.servedQty || 0));
        return {
          ...item,
          servedQty: item.quantity,
          remainingQty: 0,
          pendingServed: remaining
        };
      });

      tx.update(orderRef, {
        items: updatedItems.map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          costPrice: i.costPrice,
          category: i.category,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          servedQty: i.quantity,
          remainingQty: 0
        })),
        orderStatus: 'SERVED',
        qrStatus: 'DESTROYED',
        qrState: 'SERVED',
        servedAt: serverTimestamp(),
        serveFlowStatus: 'SERVED'
      });

      // Serve logs & Inventory Shards
      const serveLogsRef = collection(db, "serveLogs");
      for (const item of updatedItems) {
        if (item.pendingServed > 0) {
          const logRef = doc(serveLogsRef);
          tx.set(logRef, {
            orderId,
            itemId: item.id,
            itemName: item.name,
            quantityServed: item.pendingServed,
            servedBy,
            servedAt: serverTimestamp()
          });

          const shardId = `shard_${Math.floor(Math.random() * 5)}`; // INVENTORY_SHARD_COUNT fallback
          const shardRef = doc(db, "inventory_shards", item.id, "shards", shardId);
          tx.set(shardRef, { 
            count: increment(item.pendingServed),
            lastUpdated: serverTimestamp() 
          }, { merge: true });
        }
      }
    });

    console.log('🏁 Full order served successfully:', orderId);
  } catch (error) {
    console.error("Error serving full order:", error);
    throw error;
  }
};

export const toggleQrRedeemable = async (orderId: string, redeemable: boolean): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      qrRedeemable: redeemable,
      updatedAt: serverTimestamp()
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

    console.log('✅ Item served:', { orderId, itemId, servedBy });
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
    console.log('🚫 Order rejected from counter:', orderId);
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

export const listenToBatches = (callback: (batches: PrepBatch[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "prepBatches"), 
      orderBy("arrivalTimeSlot", "asc"), 
      where("status", "in", ["QUEUED", "PREPARING", "READY"]),
      limit(50)
    ),
    (snapshot) => {
      const batches = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
          updatedAt: data.updatedAt?.toMillis?.() || Date.now()
        } as PrepBatch;
      });
      callback(batches);
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
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) return;
    const data = batchSnap.data() as PrepBatch;

    await runTransaction(db, async (tx) => {
      tx.update(batchRef, { status: 'PREPARING', updatedAt: serverTimestamp() });
      for (const orderId of (data.orderIds || [])) {
        tx.update(doc(db, "orders", orderId), { serveFlowStatus: 'PREPARING' });
      }
    });
  } catch (err) {
    console.error("Error starting batch prep:", err);
    throw err;
  }
};

export const markBatchAlmostReady = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);
  try {
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) return;
    const data = batchSnap.data() as PrepBatch;

    await runTransaction(db, async (tx) => {
      tx.update(batchRef, { 
        status: 'ALMOST_READY', 
        updatedAt: serverTimestamp() 
      });
      
      for (const orderId of (data.orderIds || [])) {
        tx.update(doc(db, "orders", orderId), { 
          serveFlowStatus: 'ALMOST_READY'
        });
      }
    });
  } catch (err) {
    console.error("Error marking batch almost ready:", err);
    throw err;
  }
};

export const markBatchReady = async (batchId: string): Promise<void> => {
  const batchRef = doc(db, "prepBatches", batchId);
  try {
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) return;
    const data = batchSnap.data() as PrepBatch;

    const now = Date.now();
    const durationMs = 7 * 60 * 1000; // 7 minute window
    const pickupWindowEnd = now + durationMs;

    await runTransaction(db, async (tx) => {
      const batchSnap = await tx.get(batchRef);
      if (!batchSnap.exists()) return;
      const bData = batchSnap.data() as PrepBatch;
      
      // Double action protection
      if (bData.status === 'READY') return;

      tx.update(batchRef, { 
        status: 'READY', 
        readyAt: now, 
        updatedAt: serverTimestamp() 
      });
      
      for (const orderId of (bData.orderIds || [])) {
        tx.update(doc(db, "orders", orderId), { 
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

// ─── Slot Level Controllers (Batch Operations) ───

export const updateSlotStatus = async (slot: number, status: PrepBatchStatus): Promise<void> => {
    const q = query(
        collection(db, "prepBatches"),
        where("arrivalTimeSlot", "==", slot),
        where("status", "!=", "COMPLETED")
    );
    
    const snap = await getDocs(q);
    if (snap.empty) return;

    for (const d of snap.docs) {
        if (status === 'PREPARING') await startBatchPreparation(d.id);
        else if (status === 'ALMOST_READY') await markBatchAlmostReady(d.id);
        else if (status === 'READY') await markBatchReady(d.id);
    }
};

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
      // If last heartbeat was > 45s ago, assume the role
      if (now - data.lastHeartbeatAt > 45000) {
        tx.update(maintenanceRef, { lastHeartbeatAt: now, activeNodeId: nodeId });
        return true;
      }
      
      // If we are already the owner, update the timestamp
      if (data.activeNodeId === nodeId) {
        tx.update(maintenanceRef, { lastHeartbeatAt: now });
        return true;
      }
      
      return false;
    });
  } catch (err) {
    return false;
  }
};

export const flushMissedPickups = async (nodeId?: string): Promise<number> => {
  const now = Date.now();

  // If a nodeId is provided, try to acquire the lock first
  if (nodeId) {
     const hasLock = await tryAcquireMaintenanceLock(nodeId);
     if (!hasLock) return 0;
  }

  const qWithItems = query(
    collection(db, "orders"),
    where("pickupWindow.status", "==", "COLLECTING"),
    where("orderStatus", "==", "PAID")
  );

  try {
    const snap = await getDocs(qWithItems);
    if (snap.empty) return 0;

    let reassignedCount = 0;
    
    // Calculate the logical next slot (30-45 mins from now to avoid overlaps)
    const getNextAvailableSlot = (baseTime: number) => {
      const d = new Date(baseTime + 30 * 60 * 1000);
      const h = d.getHours();
      const m = Math.ceil(d.getMinutes() / 15) * 15;
      const finalH = m >= 60 ? h + 1 : h;
      const finalM = m >= 60 ? 0 : m;
      return finalH * 100 + finalM;
    };

    const targetSlot = getNextAvailableSlot(now);

    await runTransaction(db, async (tx) => {
      for (const d of snap.docs) {
        const orderData = d.data();
        const order = firestoreToOrder(d.id, orderData);
        
        // 1. Time Check (Hard Consistency)
        const windowEnd = order.pickupWindow?.endTime || 0;
        if (windowEnd > now) continue;

        const currentMissedCount = (order.missedCount || 0) + 1;

        // 2. Prevent Infinite Reassignment
        if (currentMissedCount >= 2) {
          const abandonedItems = order.items.map(it => ({
            ...it,
            status: it.status === 'SERVED' ? 'SERVED' : 'ABANDONED'
          }));
          
          tx.update(doc(db, "orders", d.id), {
            "pickupWindow.status": 'ABANDONED',
            "serveFlowStatus": 'ABANDONED',
            "orderStatus": 'ABANDONED',
            "missedCount": currentMissedCount,
            "items": abandonedItems,
            "updatedAt": serverTimestamp()
          });
          continue;
        }

        // 3. Batch Size Control & Reassignment
        // We must find a batch in the target slot for EACH item in the order actually being prepared.
        // Simplification: We look for a batch for the FIRST PREPARATION_ITEM.
        const prepItem = order.items.find(it => it.orderType === 'PREPARATION_ITEM');
        
        if (prepItem) {
          let assignedBatchId = "";
          let index = 0;
          let foundBatch = false;

          while (!foundBatch && index < 20) {
            const potentialId = `batch_${targetSlot}_${prepItem.id}_${index}`;
            const bRef = doc(db, "prepBatches", potentialId);
            const bSnap = await tx.get(bRef);

            if (!bSnap.exists()) {
              tx.set(bRef, {
                id: potentialId,
                itemId: prepItem.id,
                itemName: prepItem.name,
                arrivalTimeSlot: targetSlot,
                orderIds: [d.id],
                quantity: prepItem.quantity,
                status: 'QUEUED',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              assignedBatchId = potentialId;
              foundBatch = true;
            } else {
              const bData = bSnap.data() as PrepBatch;
              if (bData.status === 'QUEUED' && (bData.quantity + prepItem.quantity) <= MAX_BATCH_SIZE) {
                tx.update(bRef, {
                  orderIds: arrayUnion(d.id),
                  quantity: increment(prepItem.quantity),
                  updatedAt: serverTimestamp()
                });
                assignedBatchId = potentialId;
                foundBatch = true;
              } else {
                index++;
              }
            }
          }

          tx.update(doc(db, "orders", d.id), {
            "pickupWindow.status": 'MISSED',
            "serveFlowStatus": 'MISSED',
            "missedFromBatchId": order.batchId || null,
            "batchId": assignedBatchId || null,
            "missedCount": currentMissedCount,
            "arrivalTime": targetSlot,
            "updatedAt": serverTimestamp()
          });
          reassignedCount++;
        }
      }
    });

    return reassignedCount;
  } catch (err) {
    console.error("Error flushing missed pickups:", err);
    throw err;
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
