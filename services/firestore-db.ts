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
import { DEFAULT_FOOD_IMAGE, INITIAL_MENU, DEFAULT_ORDERING_ENABLED, DEFAULT_SERVING_RATE_PER_MIN, INVENTORY_SHARD_COUNT, FAST_ITEM_CATEGORIES } from "../constants";

export const MAX_BATCH_SIZE = 40;
export const MAX_TOTAL_SLOT_CAPACITY = 200;
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
      console.log("âœ… Menu initialized with default items");
      
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
      console.log("âœ… Inventory and inventory_meta initialized for menu items");
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
        const resolvedOrderType = it.orderType ||
          (FAST_ITEM_CATEGORIES.includes(it.category || '') ? 'FAST_ITEM' : 'PREPARATION_ITEM');
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
      where("qrState", "==", "SCANNED")
    ),
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      // Sort client-side by scannedAt (FIFO) to avoid index overhead while ensuring line integrity
      const sorted = orders.sort((a, b) => (a.scannedAt || 0) - (b.scannedAt || 0));
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

export const validateQRForServing = async (qrData: string): Promise<Order> => {
  console.log('ðŸ›¡ï¸ [FIREBASE-ORDER] Validating Meal Token...');
  
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

    // 4. Strict check: Only serve if READY or COLLECTING (skip check if fully FAST_ITEM)
    const pStatus = order.pickupWindow?.status;
    const fStatus = order.serveFlowStatus;
    const isStaticMeal = order.items.every(it => it.orderType === 'FAST_ITEM');

    if (!isStaticMeal && pStatus !== 'COLLECTING' && fStatus !== 'READY') {
      throw new Error(`SERVE_BLOCKED - Item status is ${pStatus || fStatus || 'PENDING'}. Only READY items can be served.`);
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

    console.log('âœ… [FIREBASE-ORDER] Token validated successfully:', orderId);

    // 5. Mark as SCANNED in database so it appears at serving counter
    const orderRef = doc(db, "orders", orderId);
    await updateDoc(orderRef, {
      scannedAt: serverTimestamp(),
      qrState: 'SCANNED'
    });

    return { ...order, scannedAt: Date.now(), qrState: 'SCANNED' };
  } catch (error: any) {
    console.error('âŒ [SCAN-ERROR]:', error.message);
    throw error;
  }
};

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

      // Allow serving if COLLECTING, READY, or manually overridden
      const isAllowedToServe =
        order.pickupWindow?.status === 'COLLECTING' ||
        order.serveFlowStatus === 'READY' ||
        order.qrRedeemable === true;
      if (!isAllowedToServe) {
        throw new Error(`SERVE_BLOCKED - Order is ${order.serveFlowStatus || order.pickupWindow?.status || 'NOT_READY'}. Only READY orders can be served.`);
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
        status: newRemainingQty <= 0 ? 'SERVED' : item.status
      };

      // Check if all items are completed (SERVED or ABANDONED)
      const allResolved = updatedItems.every(i => i.status === 'SERVED' || i.status === 'ABANDONED' || (i.remainingQty === 0 && i.quantity > 0));
      const newOrderStatus = allResolved ? 'SERVED' : order.orderStatus;
      const newServeFlowStatus = allResolved ? 'SERVED' : (order.serveFlowStatus === 'READY' ? 'SERVED_PARTIAL' : order.serveFlowStatus);

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
        serveFlowStatus: newServeFlowStatus,
        servedAt: allResolved ? Date.now() : (order.servedAt || null),
        updatedAt: serverTimestamp(),
        qrStatus: allResolved ? 'DESTROYED' : order.qrStatus,
        qrState: allResolved ? 'SERVED' : 'SCANNED',
      });

      // ðŸ”„ SYNC PREP BATCHES: Decrement quantities in the production pipeline
      // This ensures the Cook Console clears items after they are physically handed over.
      const batchIds = order.batchIds || [];
      for (const bId of batchIds) {
         const bRef = doc(db, "prepBatches", bId);
         const bSnap = await tx.get(bRef);
         if (!bSnap.exists()) continue;
         const bData = bSnap.data() as PrepBatch;

         // If this batch belongs to the item we just served, decrement its quantity
         if (bData.itemId === itemId && bData.status !== 'COMPLETED') {
            const newQty = Math.max(0, bData.quantity - quantity);
            const newStatus = newQty <= 0 ? 'COMPLETED' : bData.status;
            tx.update(bRef, { 
               quantity: newQty, 
               status: newStatus,
               updatedAt: serverTimestamp() 
            });
         }
      }
    });
  } catch (err: any) {
    console.error("Error serving item batch:", err);
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

      if (order.orderStatus === 'SERVED') return;

      const isAllowedToServe =
        order.pickupWindow?.status === 'COLLECTING' ||
        order.serveFlowStatus === 'READY' ||
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
        orderStatus: 'SERVED',
        qrStatus: 'DESTROYED',
        qrState: 'SERVED',
        servedAt: serverTimestamp(),
        serveFlowStatus: 'SERVED'
      });

      // ðŸ”„ SYNC ALL RELATED BATCHES
      const batchIds = order.batchIds || [];
      for (const bId of batchIds) {
         const bRef = doc(db, "prepBatches", bId);
         const bSnap = await tx.get(bRef);
         if (!bSnap.exists()) continue;
         const bData = bSnap.data() as PrepBatch;

         // Force complete all batches associated with this full order
         if (bData.status !== 'COMPLETED') {
            // Find how much of THIS order was in THIS batch
            // (Simple approach for full serve: just decrement the whole order's items from the batch)
            const itemInBatch = order.items.find(i => i.id === bData.itemId);
            if (itemInBatch) {
               const newQty = Math.max(0, bData.quantity - itemInBatch.quantity);
               tx.update(bRef, { 
                  quantity: newQty, 
                  status: newQty <= 0 ? 'COMPLETED' : bData.status,
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

export const listenToBatches = (callback: (batches: PrepBatch[]) => void): (() => void) => {
  return onSnapshot(
    query(
      collection(db, "prepBatches"), 
      where("status", "in", ["QUEUED", "PREPARING", "ALMOST_READY", "READY"]),
      limit(100)
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
      const sorted = batches.sort((a, b) => (a.arrivalTimeSlot || 0) - (b.arrivalTimeSlot || 0));
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
 * If the doc is stale (>30s), takes over. Otherwise yields.
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
      
      if (data.activeNodeId === nodeId) {
        tx.update(maintenanceRef, { lastHeartbeatAt: now });
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

    // 5-second Grace Buffer for Timer Consistency
    const graceNow = now - 5000;
    const targetSlot = getNextAvailableSlot(now);

    await runTransaction(db, async (tx) => {
      for (const d of snap.docs) {
        const orderData = d.data();
        const order = firestoreToOrder(d.id, orderData);
        
        // 1. Time Check (Hard Consistency with Grace)
        const windowEnd = order.pickupWindow?.endTime || 0;
        if (windowEnd > graceNow) continue;

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

        // 3. Penalty Logic: Missed users get shifted to a LATER slot to prioritize first-timers
        const penalizedSlot = currentMissedCount > 0 ? getNextLogicalSlot(targetSlot) : targetSlot;

        // 4. Batch Reassignment for ALL PREPARATION items in the order
        const prepItems = order.items.filter(it => it.orderType === 'PREPARATION_ITEM' && (it.remainingQty ?? it.quantity) > 0);
        const lastBatchIds: string[] = [];

        for (const prepItem of prepItems) {
          // --- CLEANUP OLD BATCH ---
          // Find the batch this item was previously in (based on previous arrivalTime)
          const oldSlot = order.arrivalTime;
          if (oldSlot) {
            // We search for the batch the student was in. Since there might be multiple indexes, 
            // we check up to 20 (consistent with creation logic)
            for (let i = 0; i < 20; i++) {
              const oldBatchId = `batch_${oldSlot}_${prepItem.id}_${i}`;
              const oldRef = doc(db, "prepBatches", oldBatchId);
              const oldSnap = await tx.get(oldRef);
              if (oldSnap.exists()) {
                const oldData = oldSnap.data() as PrepBatch;
                if (oldData.orderIds.includes(d.id)) {
                  tx.update(oldRef, {
                    orderIds: oldData.orderIds.filter(id => id !== d.id),
                    quantity: increment(-prepItem.quantity),
                    updatedAt: serverTimestamp()
                  });
                  break; 
                }
              }
            }
          }

          // --- ASSIGN TO NEW BATCH ---
          let assignedBatchId = "";
          let index = 0;
          let foundBatch = false;

          while (!foundBatch && index < 20) {
            const potentialId = `batch_${penalizedSlot}_${prepItem.id}_${index}`;
            const bRef = doc(db, "prepBatches", potentialId);
            const bSnap = await tx.get(bRef);

            if (!bSnap.exists()) {
              tx.set(bRef, {
                id: potentialId,
                itemId: prepItem.id,
                itemName: prepItem.name,
                arrivalTimeSlot: penalizedSlot,
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
          if (assignedBatchId) lastBatchIds.push(assignedBatchId);
        }

        tx.update(doc(db, "orders", d.id), {
          "pickupWindow.status": 'MISSED',
          "serveFlowStatus": 'MISSED',
          "missedFromBatchId": order.batchIds?.[0] || null,
          "batchIds": lastBatchIds,
          "missedCount": currentMissedCount,
          "arrivalTime": penalizedSlot,
          "updatedAt": serverTimestamp()
        });
        reassignedCount++;
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
