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
  increment
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
  KitchenStatus
} from "../types";
import { DEFAULT_FOOD_IMAGE, INITIAL_MENU, DEFAULT_ORDERING_ENABLED, DEFAULT_SERVING_RATE_PER_MIN, INVENTORY_SHARD_COUNT } from "../constants";
import { parseQRPayload, verifySecureHash, verifySecureHashSync, generateQRPayload, generateQRPayloadSync, isQRExpired } from "./qr";
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
    remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity
  })),
  totalAmount: order.totalAmount,
  paymentType: order.paymentType,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  qrStatus: order.qrStatus,
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
  pickupWindowStart: order.pickupWindowStart != null ? Timestamp.fromMillis(order.pickupWindowStart) : null,
  pickupWindowEnd: order.pickupWindowEnd != null ? Timestamp.fromMillis(order.pickupWindowEnd) : null,
  estimatedReadyTime: order.estimatedReadyTime != null ? Timestamp.fromMillis(order.estimatedReadyTime) : null,
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
      remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity
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
    orderType: data.orderType || undefined,
    serveFlowStatus: data.serveFlowStatus || undefined,
    pickupWindowStart: toMillis(data.pickupWindowStart),
    pickupWindowEnd: toMillis(data.pickupWindowEnd),
    estimatedReadyTime: toMillis(data.estimatedReadyTime),
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
      const newOrder: Order = {
        ...orderData,
        items: itemsWithQty,
        id,
        createdAt,
        orderStatus: 'PENDING'
      } as Order;

      if (newOrder.paymentStatus === 'SUCCESS') {
        newOrder.qrStatus = 'ACTIVE';
        const token = generateQRPayloadSync(newOrder);
        newOrder.qr = { token, status: 'ACTIVE', createdAt };
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
      where("orderStatus", "==", "ACTIVE"),
      where("paymentStatus", "==", "SUCCESS"),
      where("qrStatus", "==", "USED"),
      orderBy("scannedAt", "desc")
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
      where("orderStatus", "==", "ACTIVE"),
      where("paymentStatus", "==", "SUCCESS"),
      where("qrStatus", "==", "USED"),
      orderBy("scannedAt", "desc")
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
    // 1. Parse the secure encrypted payload
    const payload = parseQRPayload(qrData);
    if (!payload?.orderId) {
      throw new Error("INVALID_TOKEN_FORMAT - This does not look like a JOE Meal Token.");
    }

    const { orderId, userId, cafeteriaId, secureHash } = payload;

    // 2. Direct Firestore Fetch (The Source of Truth)
    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (!orderDoc.exists()) {
      throw new Error("ORDER_NOT_FOUND - Token corresponds to a non-existent order.");
    }

    const orderData = orderDoc.data();
    const order = firestoreToOrder(orderDoc.id, orderData);

    // 3. Cryptographic Signature Verification
    // Prevents forged tokens by checking against the server-generated hash
    const qrExpiresAt = order.createdAt + 24 * 60 * 60 * 1000; // 24hr validity
    const isValid = verifySecureHash(
      orderId, 
      userId, 
      cafeteriaId, 
      order.createdAt, 
      qrExpiresAt, 
      secureHash
    );

    if (!isValid) {
      throw new Error("SECURITY_BREACH - Token signature is invalid or forged.");
    }

    // 4. Status Checks
    if (order.paymentStatus !== 'SUCCESS') {
      throw new Error("PAYMENT_REQUIRED - This order has not been paid for yet.");
    }

    if (order.qrStatus === 'USED') {
      throw new Error("ALREADY_SERVED - This token has already been scanned and used.");
    }

    if (order.qrStatus === 'EXPIRED') {
      throw new Error("TOKEN_EXPIRED - This token is no longer valid.");
    }

    console.log('✅ [FIREBASE-ORDER] Token validated successfully:', orderId);
    return order;
  } catch (error: any) {
    console.error('❌ [SCAN-ERROR]:', error.message);
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

      if (order.orderStatus === 'COMPLETED') {
        throw new Error("Order already completed");
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
      const invSnap = await tx.get(invRef);

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
      const newOrderStatus = allItemsServed ? 'COMPLETED' : order.orderStatus;

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

      // Update inventory (only if it exists)
      if (invSnap.exists()) {
        tx.update(invRef, {
          consumed: increment(1),
          lastUpdated: serverTimestamp()
        });
      }
    });

    console.log('✅ Item served:', { orderId, itemId, servedBy });
  } catch (error) {
    console.error("Error serving item:", error);
    throw error;
  }
};

export const scanAndServeOrder = async (qrDataRaw: string, scannedBy: string = 'server_01') => {
  const scanTime = Date.now();
  let logEntry: ScanLog | null = null;

  try {
    const payload = parseQRPayload(qrDataRaw);
    if (!payload) {
      throw new Error("Invalid Token Format");
    }

    const { orderId, userId, cafeteriaId, secureHash } = payload;

    const orderDoc = await getDoc(doc(db, "orders", orderId));
    if (!orderDoc.exists()) {
      throw new Error("Order not found");
    }

    const order = firestoreToOrder(orderDoc.id, orderDoc.data());

    const qrExpiresAt = order.createdAt + 24 * 60 * 60 * 1000;
    if (!verifySecureHash(orderId, userId, cafeteriaId, order.createdAt, qrExpiresAt, secureHash)) {
      throw new Error("Invalid Token Signature");
    }

    if (order.paymentStatus !== 'SUCCESS') {
      throw new Error("PAYMENT_NOT_VERIFIED");
    }

    if (order.qrStatus === 'USED') {
      throw new Error("TOKEN_ALREADY_USED");
    }

    if (order.qrStatus !== 'ACTIVE') {
      throw new Error("QR_NOT_ACTIVE");
    }

    // Update order
    await updateDoc(doc(db, "orders", orderId), {
      orderStatus: 'SERVED',
      qrStatus: 'USED',
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
