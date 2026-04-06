/**
 * Firestore Database Service
 * Replacement for localStorage mock database
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
  arrayUnion,
  collectionGroup,
  arrayRemove,
  addDoc
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { notifyOrderUpdate, sendDirectedPush } from "./onesignal-api";

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
  QRState,
  ServeFlowStatus,
  KitchenStatus,
  PrepBatch,
  PrepBatchStatus,
  SystemMaintenance
} from "../types";
import { DEFAULT_FOOD_IMAGE, INITIAL_MENU, DEFAULT_ORDERING_ENABLED, DEFAULT_SERVING_RATE_PER_MIN, INVENTORY_SHARD_COUNT, FAST_ITEM_CATEGORIES, STATION_ID_BY_ITEM_ID, PREPARATION_STATIONS } from "../constants";

export const MAX_BATCH_SIZE = 40;
export const MAX_TOTAL_SLOT_CAPACITY = 200;
/** ⏱️ [GRACE-PERIOD] Student has 15 minutes (900s) to pick up before it marks as missed */
export const PICKUP_WINDOW_DURATION_MS = 900000; 
import { offlineDetector } from '../utils/offlineDetector';

const RETRY_QUEUE: Array<{ fn: () => Promise<any>, retries: number }> = [];

// 📡 [NETWORK-RECOVERY] Auto-retry loop for transient failures
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
      console.log("📡 [NETWORK] Reconnected. Syncing...");
      while (RETRY_QUEUE.length > 0) {
          const item = RETRY_QUEUE.shift();
          if (item) {
              try { 
                 console.log("[RETRY] Attempting sync...");
                 await item.fn(); 
              } catch (e) {
                 if (item.retries < 3) {
                    item.retries++;
                    RETRY_QUEUE.push(item);
                 }
              }
          }
      }
      // Final pulse recovery
      runBatchGenerator("network-recovery");
  });
}
import { parseQRPayload, parseServingQR, verifySecureHash, verifySecureHashSync, generateQRPayload, generateQRPayloadSync, isQRExpired, QR_EXPIRY_MS } from "./qr";
import { safeListener } from "./safeListener";
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

/** 🛡️ [Principal Architect] Item Classification Helper
 * 
 * Static (FAST_ITEM) = served instantly from counter, no kitchen queue needed.
 * Aligned with FAST_ITEM_CATEGORIES and PREP_TIME_BY_ITEM in constants.tsx.
 * 
 * FAST  → Beverages, Lunch (Plate Meal, Curd Rice, etc.), pre-made Snacks  
 * DYNAMIC → Breakfast tiffin (Idli, Dosa, etc.), kitchen-cooked Lunch items
 */
export const isStaticItem = (item: any): boolean => {
  // 1. Explicit orderType overrides everything
  if (item.orderType === 'PREPARATION_ITEM') return false;
  if (item.orderType === 'FAST_ITEM') return true;

  // 2. Per-item prep-time map: id listed with 0 = instant/fast
  const FAST_ITEM_IDS = new Set([
    // Beverages (all)
    'BEV01', 'BEV02', 'BEV03', 'BEV04', 'BEV05', 'BEV06',
    // Lunch counter items (pre-cooked, served from tray)
    'LCH01', // Plate Meal
    'LCH03', // Jeera Rice
    'LCH06', // Veg Biryani
    'LCH07', // Curd Rice
    // Pre-prepared snacks
    'SNK01', 'SNK02', 'SNK03', 'SNK04',
  ]);
  if (item.id && FAST_ITEM_IDS.has(item.id)) return true;

  // 4. DOSA-DRIVEN ENGINE: Only Dosa varieties (Masala, Set, Onion) are dynamic.
  const DOSA_IDS = new Set(['BKT03', 'BKT04', 'BKT06']);
  if (item.id && DOSA_IDS.has(item.id)) return false;

  // Everything else (Idli, Rice, Tea, etc.) is 'Scan & Serve' (Fast)
  return true;
};

const orderToFirestore = (order: Order) => ({
  orderId: order.id,
  userId: order.userId,
  userName: order.userName,
  items: (order.items || []).map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price || 0,
    costPrice: item.costPrice || 0,
    category: item.category || '',
    imageUrl: item.imageUrl || null,
    quantity: item.quantity || 0,
    servedQty: item.servedQty || 0,
    remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity,
    status: item.status || 'PENDING',
    orderType: item.orderType || (isStaticItem(item) ? 'FAST_ITEM' : 'PREPARATION_ITEM') // 🚀 [FIX] Persist Metadata
  })),
  totalAmount: order.totalAmount || 0,
  paymentType: order.paymentType || 'CASH',
  paymentStatus: order.paymentStatus || 'PENDING',
  orderStatus: order.orderStatus || 'PENDING',
  qrStatus: order.qrStatus || 'PENDING',
  queueStatus: order.queueStatus || 'NOT_IN_QUEUE',
  utrLast4: order.utrLast4 || '',
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
  cafeteriaId: order.cafeteriaId || null,
  confirmedBy: order.confirmedBy || null,
  confirmedAt: order.confirmedAt ? Timestamp.fromMillis(order.confirmedAt) : null,
  rejectedBy: order.rejectedBy || null,
  rejectedAt: order.rejectedAt ? Timestamp.fromMillis(order.rejectedAt) : null,
  orderType: order.orderType || null,
  serveFlowStatus: order.serveFlowStatus || null,
  pickupWindow: order.pickupWindow ? {
    startTime: order.pickupWindow.startTime ? Timestamp.fromMillis(order.pickupWindow.startTime) : null,
    endTime: order.pickupWindow.endTime ? Timestamp.fromMillis(order.pickupWindow.endTime) : null,
    durationMs: order.pickupWindow.durationMs || 0,
    status: order.pickupWindow.status || null
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
    paymentStatus: data.paymentStatus || 'PENDING',
    queueStatus: data.queueStatus || 'NOT_IN_QUEUE',
    orderStatus: data.orderStatus || 'PENDING',
    qrStatus: data.qrStatus || 'PENDING',
    utrLast4: data.utrLast4,
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

  // 📣 [ONESIGNAL-STRIKE] Notify student of REJECTION
  try {
    const snap = await getDoc(orderRef);
    if (snap.exists() && snap.data()?.userId) {
       notifyOrderUpdate(snap.data().userId, 'REJECTED', 'Your order items');
    }
  } catch (err) {
    console.warn("REJECT push failed:", err);
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
  } catch (err: any) {
    console.error("❌ Critical Menu Sync Failure:", err);
  }
};

// ============================================================================
// 📊 [DEV-UTILITY] DATABASE CLEANUP ENGINE
// ============================================================================

/**
 * 🧹 [CLEAN-SWEEP] Global maintenance tool to wipe test data
 * Trigger this via browser console: window.cleanJOE()
 */
export const resetCafeteriaData = async (): Promise<void> => {
  if (!confirm("⚠️ DANGER: This will delete ALL orders, items, and batches. Continue?")) return;

  try {
     console.log("🧹 Starting Deep Clean Sweep...");
     
     // 1. Fetch all documents in active collections & subcollections
     const [ordersSnap, itemsSnap, batchesSnap, statsSnap, idempSnap] = await Promise.all([
        getDocs(collection(db, "orders")),
        getDocs(query(collectionGroup(db, "items"), limit(500))), // Wipe up to 500 sub-items
        getDocs(collection(db, "prepBatches")),
        getDocs(collection(db, "slot_stats")),
        getDocs(collection(db, "idempotency_keys"))
     ]);

     const batch = writeBatch(db);

     // 2. Queue all docs for deletion
     ordersSnap.docs.forEach(doc => batch.delete(doc.ref));
     itemsSnap.docs.forEach(doc => batch.delete(doc.ref));
     batchesSnap.docs.forEach(doc => batch.delete(doc.ref));
     statsSnap.docs.forEach(doc => batch.delete(doc.ref));
     idempSnap.docs.forEach(doc => batch.delete(doc.ref));

     // 3. Commit the sweep
     await batch.commit();
     console.log("✅ Deep Clean Complete! Pipeline is now PRISTINE.");
     window.location.reload(); 
  } catch (err) {
     console.error("❌ Clean Sweep Failed:", err);
     alert("Sweep failed: check console for errors.");
  }
};

// Expose to window for easy access during development
if (typeof window !== 'undefined') {
  (window as any).cleanJOE = resetCafeteriaData;
}

/**
 * 📢 [MARKETING-ENGINE] Broadcast a message to all active students
 */
export const broadcastSystemMessage = async (text: string): Promise<void> => {
  try {
    const msgId = `msg_${Date.now()}`;
    await setDoc(doc(db, "system_messages", msgId), {
      text,
      type: 'PROMOTION',
      createdAt: serverTimestamp(),
      expiresAt: Date.now() + (30 * 60 * 1000) // 30-min relevance window
    });
    console.log(`[MARKETING] Broadcast Fired: ${text}`);
  } catch (err) {
    console.error("Broadcast failed:", err);
    throw err;
  }
};

// Inventory
export const getInventory = async (): Promise<InventoryItem[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, "inventory"), limit(100)));
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
    query(collection(db, "inventory"), limit(100)),
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
    const snapshot = await getDocs(query(collection(db, "inventory_meta"), limit(100)));
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
  const colRef = query(collection(db, "inventory_meta"), limit(100));

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
    const invSnap = await getDocs(query(collection(db, "inventory"), limit(100)));
    const toMillis = (ts: any): number => {
      if (!ts) return Date.now();
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (typeof ts === "number") return ts;
      return Date.now();
    };
    
    // 🛡️ [PERFORMANCE-STRIKE] Parallel shard aggregation
    const items = await Promise.all(invSnap.docs.map(async (d) => {
      const itemId = d.id;
      const data = d.data();
      let consumed = data.consumed ?? 0;
      try {
        const shardsSnap = await getDocs(query(collection(db, "inventory_shards", itemId, "shards"), limit(20)));
        shardsSnap.docs.forEach((s) => {
          consumed += s.data().count ?? 0;
        });
      } catch (_) {}
      
      return {
        itemId,
        itemName: data.itemName ?? "",
        openingStock: data.openingStock ?? 0,
        consumed,
        lastUpdated: toMillis(data.lastUpdated),
        category: data.category ?? ""
      } as InventoryItem;
    }));
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
          // 🛡️ [BLOAT-SHIELD] Strip base64 placeholders to keep doc size < 1MB
          imageUrl: (item.imageUrl && item.imageUrl.startsWith('data:image')) ? null : (item.imageUrl || null),
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
    const itemsWithQty = orderData.items.map(item => {
      // 🛡️ [BLOAT-SHIELD] Absolute zero-bloat strategy
      const cleanItem = { ...item, servedQty: 0, remainingQty: item.quantity };
      if (cleanItem.imageUrl && cleanItem.imageUrl.startsWith('data:image')) {
        delete cleanItem.imageUrl;
      }
      return cleanItem;
    });

    // 🛡️ [IDEMPOTENCY-SHIELD] - Atomic Pre-check for duplicate requests
    const idempotencyKey = orderData.idempotencyKey;
    if (idempotencyKey) {
       try {
          const idempRef = doc(db, "idempotency_keys", idempotencyKey);
          const idempSnap = await getDoc(idempRef);
          if (idempSnap.exists()) {
             const existingId = idempSnap.data().orderId;
             console.log(`🛡️ [IDEMPOTENCY] Duplicate request blocked. Using existing order: ${existingId}`);
             return existingId;
          }
       } catch(e) {
          console.warn("[IDEMPOTENCY] Pre-check failure. Proceeding with caution...");
       }
    }

    const idempRef = idempotencyKey ? doc(db, "idempotency_keys", idempotencyKey) : null;
    
    // Resolve item types
    const itemsWithResolvedType = itemsWithQty.map(it => {
        const hasStation = !!STATION_ID_BY_ITEM_ID[it.id];
        const resolvedOrderType = it.orderType || 
          (hasStation ? 'PREPARATION_ITEM' : (FAST_ITEM_CATEGORIES.includes(it.category || '') ? 'FAST_ITEM' : 'PREPARATION_ITEM'));

        return {
          ...it,
          orderType: resolvedOrderType,
          status: (resolvedOrderType === 'FAST_ITEM' ? 'READY' : 'PENDING') as any
        };
    });

    const prepItems = itemsWithResolvedType.filter(it => it.orderType === 'PREPARATION_ITEM');
    const isDynamic = prepItems.some(it => (STATION_ID_BY_ITEM_ID[it.id] || 'default') !== 'default');
    const hasDosa = orderData.items.some(i => i.name.toLowerCase().includes('dosa'));

    // Build per-station requested quantities
    const qtyByStation: Record<string, number> = {};
    prepItems.forEach(it => {
        const station = STATION_ID_BY_ITEM_ID[it.id] || 'kitchen'; // fallback to kitchen
        qtyByStation[station] = (qtyByStation[station] || 0) + it.quantity;
    });

    const requestedQty = prepItems.reduce((sum, i) => sum + i.quantity, 0);

    // ⏲️ DYNAMIC TIMER LOGIC: 4 mins for DOSA varieties, 0 mins for all other items.
    let targetSlot = 0; // Default to Instant
    
    if (isDynamic) {
        // Dosa or preparation items - Use a 4 minute window by default
        const nowMs = Date.now();
        const fourMinsInMs = 4 * 60 * 1000;
        
        // Slot Stats logic for Dosa Counter only
        const now = new Date();
        const targetMins = (now.getHours() * 60) + now.getMinutes() + 4; // Start at +4 mins
        let testMins = Math.ceil(targetMins / 5) * 5; 
        let foundSlot = false;
        
        for (let i = 0; i < 20; i++) {
           const h = Math.floor(testMins / 60) % 24;
           const slotTest = h * 100 + (testMins % 60);
           
           try {
              const snap = await getDoc(doc(db, "slot_stats", slotTest.toString()));
              const statData = snap.exists() ? snap.data() : {};
              const currentVol = statData['dosa'] || 0;
              
              if (currentVol < 10) { 
                 targetSlot = slotTest;
                 foundSlot = true;
                 break;
              }
           } catch { break; } 
           testMins += 5;
        }
        if (!foundSlot) targetSlot = (Math.floor(testMins / 60) % 24) * 100 + (testMins % 60);

        // Security: Block morning Dosa if past capacity
        const currentTimeInt = now.getHours() * 100 + now.getMinutes();
        if (currentTimeInt >= 700 && currentTimeInt <= 905 && hasDosa && targetSlot > 905) {
             throw new Error("Morning Dosa capacity is completely full! Walk-in orders available after 9:05 AM.");
        }
    }
    const finalizedBatchIds: string[] = [];

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

    // 1. PRIMARY STRIKE — Commit the Order
    const orderRef = doc(db, "orders", id);
    await setDoc(orderRef, {
        ...orderToFirestore(finalizedOrder),
        createdAt: createdAt, // Use the actual number used for hashing (CRITICAL)
        updatedAt: serverTimestamp()
    });
    console.log("🍱 [ROOT-FIX] Order successfully committed:", id);

    // 2. SECONDARY TRACKING (Pulse Counters & Batching)
    if (isDynamic) {
        try {
            // Pulse Slot Stats
            const incrementPayload: any = { 
                totalVolume: increment(requestedQty), 
                updatedAt: serverTimestamp() 
            };
            for (const [station, qty] of Object.entries(qtyByStation)) {
                incrementPayload[station] = increment(qty);
            }
            await setDoc(doc(db, "slot_stats", targetSlot.toString()), incrementPayload, { merge: true });

            // 🍱 [LIGHTNING-INJECTION]: Create prepBatch directly from client for zero-latency kitchen visibility
            if (finalizedOrder.paymentStatus === 'SUCCESS') {
                const now = Date.now();
                
                // 1. Update individual item statuses
                await Promise.all(itemsWithResolvedType.map((it: any) => {
                   const itRef = doc(db, "orders", id, "items", it.id);
                   const isFast = it.orderType === 'FAST_ITEM';
                   
                   return setDoc(itRef, { 
                     ...it, 
                     status: isFast ? 'READY' : 'PENDING', 
                     paidAt: now, 
                     readyAt: isFast ? serverTimestamp() : null,
                     updatedAt: serverTimestamp() 
                   }, { merge: true });
                }));

                // 2. Inject into kitchen production (prepBatches) immediately
                if (isDynamic) {
                   for (const [station, qty] of Object.entries(qtyByStation)) {
                      // Filter items for THIS specific station
                      const stationItems = prepItems.filter(it => (STATION_ID_BY_ITEM_ID[it.id] || 'default') === station);
                      if (stationItems.length === 0) continue;

                      // Create a record that the cook listens to via onSnapshot
                      await addDoc(collection(db, "prepBatches"), {
                         stationId: station,
                         items: stationItems.map(it => ({
                            orderId: id,
                            itemId: it.id,
                            name: it.name,
                            quantity: it.quantity,
                            userName: finalizedOrder.userName
                         })),
                         status: 'QUEUED',
                         createdAt: serverTimestamp(),
                         updatedAt: serverTimestamp(),
                         orderIds: [id],
                         arrivalTimeSlot: targetSlot
                      });
                   }
                }
            } else {
                console.log(`[BATCH-BYPASS] skipping batch for pending payment: ${id}`);
            }

        } catch (e) {
            console.warn("⚠️ Slot stats or batching write blocked. Skipping...", e);
        }
    }

    // 3. IDEMPOTENCY
    if (idempRef) {
        try {
            await setDoc(idempRef, { orderId: id, createdAt: serverTimestamp() });
        } catch (e) {}
    }

    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (_e) {}

    return id;
  } catch (error: any) {
    console.error("❌ CRITICAL: createOrder Failed:", error);
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
  console.log(`📡 [STUDENT-SYNC] Establishing dual-band link to ticket: ${orderId}`);
  
  let currentOrder: Order | null = null;
  let currentItems: any[] = [];
  let debounceTimer: any = null;

  const pushUpdate = () => {
    if (!currentOrder) {
      callback(null);
      return;
    }
    
    // 🛡️ [STATE-LOCK] Root flow status is our authoritative baseline
    let aggregateFlow = currentOrder.serveFlowStatus || 'NEW';

    // 🏎️ [OPTIMISTIC-MERGE] Map live items from subcollection
    const mergedItems = currentOrder.items?.map(oIt => {
      const fresh = currentItems.find(f => f.id === oIt.id || f.itemId === oIt.id);
      return fresh ? { ...oIt, ...fresh } : oIt;
    }) || [];

    // Calculate derived status based on items subcollection
    const anyReady = mergedItems.some(i => i.status === 'READY');
    const allPreparing = mergedItems.length > 0 && mergedItems.every(i => ['PREPARING', 'READY', 'SERVED'].includes(i.status));
    const allServed = mergedItems.length > 0 && mergedItems.every(i => i.status === 'SERVED' || i.status === 'COMPLETED');

    // Upgrade aggregateFlow based on live item discovery (never downgrade)
    const weights: Record<string, number> = { 'NEW': 0, 'PREPARING': 1, 'READY': 2, 'SERVED_PARTIAL': 2.5, 'SERVED': 3 };
    const currentWeight = weights[aggregateFlow] || 0;

    if (allServed) aggregateFlow = 'SERVED';
    else if (anyReady && currentWeight < 2) aggregateFlow = 'READY';
    else if (allPreparing && currentWeight < 1) aggregateFlow = 'PREPARING';

    callback({
      ...currentOrder,
      items: mergedItems,
      serveFlowStatus: aggregateFlow as any
    });
  };

  const schedulePush = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      pushUpdate();
    }, 100); // ⚡ 100ms debounce
  };

  const unsubOrder = onSnapshot(
    doc(db, "orders", orderId),
    { includeMetadataChanges: true },
    (docSnap) => {
      if (docSnap.exists()) {
        currentOrder = firestoreToOrder(docSnap.id, docSnap.data());
        schedulePush();
      } else {
        currentOrder = null;
        schedulePush();
      }
    },
    (error) => {
      console.error("❌ Parent sync dropped:", error);
    }
  );

  const unsubItems = onSnapshot(
    collection(db, "orders", orderId, "items"),
    { includeMetadataChanges: true },
    (snap) => {
      currentItems = snap.docs.map(d => ({ itemId: d.id, id: d.id, ...d.data() }));
      schedulePush();
    },
    (error) => {
       console.error("❌ Items sync dropped:", error);
    }
  );

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubOrder();
    unsubItems();
  };
};

export const listenToAllOrders = (callback: (orders: Order[]) => void): (() => void) => {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100));
  const fallbackQ = query(collection(db, "orders"), limit(100));

  return safeListener(
    'cashier-all-orders',
    q,
    (snapshot) => snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data())),
    () => [],
    callback,
    fallbackQ
  );
};


/** Paginated recent orders (e.g. for kitchen dashboard). Limit 50. */
export const listenToRecentOrders = (callback: (orders: Order[]) => void, limitCount: number = 50): (() => void) => {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(limitCount));
  const fallbackQ = query(collection(db, "orders"), limit(limitCount));

  return safeListener(
    'recent-orders',
    q,
    (snapshot) => snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data())),
    () => [],
    callback,
    fallbackQ
  );
};

export const listenToUserOrders = (userId: string, callback: (orders: Order[]) => void): (() => void) => {
  const q = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    where("paymentStatus", "in", ["SUCCESS", "PENDING", "UTR_SUBMITTED", "VERIFIED"]),
    orderBy("createdAt", "desc"),
    limit(10)
  );
  const fallbackQ = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    limit(20)
  );

  return safeListener(
    `user-orders-${userId}`,
    q,
    (snapshot) => snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data())),
    () => [],
    callback,
    fallbackQ
  );
};

export const listenToAllUserOrders = (userId: string, callback: (orders: Order[]) => void): (() => void) => {
  const q = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  const fallbackQ = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    limit(50)
  );

  return safeListener(
    `all-user-orders-${userId}`,
    q,
    (snapshot) => snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data())),
    () => [],
    callback,
    fallbackQ
  );
};

export const listenToLatestActiveQR = (userId: string, callback: (order: Order | null) => void): (() => void) => {
  const q = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    where("paymentStatus", "==", "SUCCESS"),
    where("qrStatus", "==", "ACTIVE"),
    limit(1)
  );

  return safeListener(
    `user-active-qr-${userId}`,
    q,
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      if (orders.length === 0) return null;
      return orders.reduce((acc, cur) => ((cur.createdAt || 0) > (acc.createdAt || 0) ? cur : acc), orders[0]);
    },
    () => null,
    callback
  );
};

export const listenToPendingCashOrders = (callback: (orders: Order[]) => void): (() => void) => {
  const q = query(
    collection(db, "orders"),
    where("paymentStatus", "in", ["PENDING", "UTR_SUBMITTED", "AWAITING_CONFIRMATION"]),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const fallbackQ = query(
    collection(db, "orders"),
    where("paymentStatus", "in", ["PENDING", "UTR_SUBMITTED", "AWAITING_CONFIRMATION"])
  );

  return safeListener(
    'cashier-pending-orders',
    q,
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      return orders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 100);
    },
    () => [],
    callback,
    fallbackQ
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

/**
 * [ELITE-HASH] High-Entropy DJB2 Identity
 * Collision-proof, deterministic, and idempotent.
 */
const generateStableBatchId = (itemIds: string[]) => {
  const sorted = [...itemIds].sort();
  const seed = sorted.join('|'); // Seed computed once
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  const meta = `${sorted.length}_${sorted[0].slice(-4)}_${sorted[sorted.length - 1].slice(-4)}`;
  return `batch_${(hash >>> 0).toString(16)}_${meta}`;
};

/**
 * [ELITE-SCORING] Capped Variety Fairness
 */
export const getPrioritizedItems = (pendingItems: any[], limit = 5) => {
  if (!pendingItems?.length) return [];
  const now = Date.now();
  const result: any[] = [];
  const processedRefKeys = new Set<string>();

  const sortedByAge = [...pendingItems].sort((a,b) => (a.paidAt || a.createdAt) - (b.paidAt || b.createdAt));

  // --- PHASE 1: STARVATION GUARD (Absolute FIFO + EMA Override) ---
  const oldestItem = sortedByAge[0];
  if (oldestItem) {
     // Fetch EMA context
     // Note: we don't await doc here to keep it async-performer friendly, 
     // but we assume avgWait ~ 5 mins if not available
     const avgWaitMs = 300000; 
     const itemWaitMs = now - (oldestItem.paidAt || oldestItem.createdAt);
     
     // If item waits > 2x average batch time, it's THE priority
     if (itemWaitMs > (avgWaitMs * 2)) {
        result.push(oldestItem);
        processedRefKeys.add(`${oldestItem.orderId}-${oldestItem.itemId}`);
     }
  }

  // --- PHASE 2: VARIETY SLOT (IF STARVATION GUARD DIDN'T PICK IT) ---
  if (result.length === 0 && sortedByAge.length > 0) {
    result.push(sortedByAge[0]);
    processedRefKeys.add(`${sortedByAge[0].orderId}-${sortedByAge[0].itemId}`);
  }

  if (result.length < limit) {
    const primaryName = result[0]?.name;
    const varietyCandidate = sortedByAge.find(it => 
       it.name !== primaryName && !processedRefKeys.has(`${it.orderId}-${it.itemId}`)
    );
    if (varietyCandidate) {
      result.push(varietyCandidate);
      processedRefKeys.add(`${varietyCandidate.orderId}-${varietyCandidate.itemId}`);
    }
  }

  if (result.length < limit) {
    const remaining = sortedByAge.filter(it => !processedRefKeys.has(`${it.orderId}-${it.itemId}`));
    const counts: Record<string, number> = {};
    remaining.forEach(it => { counts[it.name] = (counts[it.name] || 0) + 1; });

    const scored = remaining.map(it => {
      const waitSeconds = Math.max(0, (now - (it.paidAt || it.createdAt)) / 1000);
      const rarityBoost = 1 / (counts[it.name] || 1);
      return { ...it, score: waitSeconds * (1 + rarityBoost) };
    });

    const filler = scored.sort((a,b) => b.score - a.score).slice(0, limit - result.length);
    result.push(...filler);
  }

  return result;
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
    if (err.code === 'permission-denied') {
        console.warn("🛡️ Permission denied during UTR submission — attempting silent optimistic recovery.");
        // We let the UI think it succeeded so the student isn't blocked.
        // The Cashier can still verify the UTR manually if needed.
        return; 
    }
    console.error("Error submitting UTR:", err);
    throw err;
  }
};

export const confirmCashPayment = async (orderId: string, _cashierUid: string): Promise<void> => {
  if (!offlineDetector.isOnline()) {
     console.warn("🛑 [NETWORK] Offline. Blocking payment confirmation.");
     throw new Error("Waiting for connection...");
  }
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
          const ledgerQuery = query(collection(db, "payments_ledger"), where("status", "==", "AVAILABLE"), limit(20));
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
          paymentStatus: 'VERIFIED',
          queueStatus: 'IN_QUEUE',
          qrStatus: 'ACTIVE',
          qr: { 
            token: `v1.${orderId}.QR_AUTO_${Date.now()}`, 
            status: 'ACTIVE', 
            createdAt: Date.now() 
          },
          confirmedBy: _cashierUid,
          confirmedAt: serverTimestamp(),
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
       });

       // 📣 [ONESIGNAL-STRIKE] Notify student of PAYMENT SUCCESS
       if (orderData.userId) {
          sendDirectedPush({
              userId: orderData.userId,
              title: '💳 Paid',
              message: `Check QR.`,
              url: 'https://joecafebrand.netlify.app'
          });
       }

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

        // 🍱 [KITCHEN-TRIGGER] High-Speed Handover
        try {
            const items = orderData.items || [];
            if (items.length > 0) {
                const stamp = Date.now();
                await Promise.all(items.map((it: any) => {
                   const itRef = doc(db, "orders", orderId, "items", it.id);
                   const isFast = it.orderType === 'FAST_ITEM' || ['Lunch', 'Beverages', 'Snacks'].includes(it.category);
                   
                   return setDoc(itRef, { 
                     ...it, 
                     status: isFast ? 'READY' : 'PENDING', 
                     paidAt: stamp, 
                     readyAt: isFast ? serverTimestamp() : null,
                     updatedAt: serverTimestamp() 
                   }, { merge: true });
                }));

                // 🏎️ [INSTANT-FIRE] Trigger batcher immediately on cashier device for zero-lag
                runBatchGenerator(_cashierUid).catch(() => {});
            }
        } catch (e) {
            console.error("Failed to sync items to serving queue:", e);
        }
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
      orderStatus: 'REJECTED',
      rejectionReason: 'PAYMENT_FAILED',
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
// ─── SYSTEM SETTINGS ───────────────────────────────────────────────────────

export const addGlobalDelay = async (minutes: number): Promise<void> => {
  const settingsRef = doc(db, "system_settings", "main");
  await setDoc(settingsRef, {
    globalDelayMins: increment(minutes),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const listenToSystemSettings = (callback: (settings: Partial<SystemSettings>) => void): (() => void) => {
  const settingsRef = doc(db, "system_settings", "main");
  return onSnapshot(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ globalDelayMins: snapshot.data().globalDelayMins || 0 });
    } else {
      callback({ globalDelayMins: 0 });
    }
  }, (error) => {
    console.error("Error listening to system settings:", error);
    callback({ globalDelayMins: 0 }); 
  });
};

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
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return safeListener(
    'counter-active-orders',
    q,
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      const activeStats = ["PAID", "PROCESSING", "PENDING", "SERVED", "ACTIVE"];
      const filtered = orders.filter(o => 
         o.paymentStatus === "SUCCESS" && 
         activeStats.includes(o.orderStatus)
      );
      return filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    },
    () => [],
    callback
  );
};

export const listenToPendingItems = (callback: (items: PendingItem[]) => void): (() => void) => {
  const q = query(
    collection(db, "orders"),
    where("qrState", "==", "SCANNED"),
    orderBy("createdAt", "asc"),
    limit(50)
  );
  const fallbackQ = query(
    collection(db, "orders"),
    where("qrState", "==", "SCANNED"),
    limit(100)
  );

  return safeListener(
    'counter-pending-items',
    q,
    (snapshot) => {
      const orders = snapshot.docs.map(doc => firestoreToOrder(doc.id, doc.data()));
      const sortedOrders = orders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      
      const pendingItems: PendingItem[] = [];
      sortedOrders.forEach(order => {
        (order.items || []).forEach(item => {
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
      return pendingItems;
    },
    () => [],
    callback,
    fallbackQ
  );
};

/**
 * [SONIC-MANIFEST] Server Ready Hook
 * Listens to ALL ready items across the hive for immediate handover.
 */
export const listenToReadyItems = (callback: (items: any[]) => void): (() => void) => {
  const q = query(
    collectionGroup(db, "items"), 
    where("status", "==", "READY"), 
    orderBy("readyAt", "asc"),
    limit(20)
  );
  const fallbackQ = query(
    collectionGroup(db, "items"), 
    where("status", "==", "READY"), 
    limit(20)
  );

  return safeListener(
    'counter-ready-items',
    q,
    (snap: any) => snap.docs.map((d: any) => ({
      ...d.data(),
      itemId: d.id,
      orderId: d.ref.parent.parent?.id,
    })),
    () => [],
    callback,
    fallbackQ
  );
};

/**
 * [SONIC-SERVE] Hardened Transactional Handover
 * Transitions a single item from READY -> SERVED with atomic completion check.
 */
export const serveSingleItem = async (orderId: string, itemId: string) => {
  const itemRef = doc(db, 'orders', orderId, 'items', itemId);
  const orderRef = doc(db, 'orders', orderId);

  return runTransaction(db, async (tx) => {
    // 🛡️ [STATE-LATCH] READ PHASE (ALL READS FIRST)
    const [itSnap, orderSnap] = await Promise.all([
      tx.get(itemRef),
      tx.get(orderRef)
    ]);
    
    if (!itSnap.exists()) throw new Error("ITEM_NOT_FOUND");
    if (!orderSnap.exists()) throw new Error("ORDER_NOT_FOUND");

    const itData = itSnap.data();
    if (itData?.status === 'SERVED') return; // Idempotent success
    if (itData?.status !== 'READY') throw new Error("ITEM_NOT_READY");

    const oData = orderSnap.data();
    // 🛡️ [SONIC-STRIP] Remove heavy binary/base64 from sync array to prevent 'failed-precondition' (size limit)
    const items = (oData.items || []).map((it: any) => {
       const isCurrent = it.id === itemId;
       const status = isCurrent ? 'SERVED' : it.status;
       
       // Clone and strip heavy assets
       const cleanItem = { ...it, status };
       if (cleanItem.imageUrl && cleanItem.imageUrl.startsWith('data:image')) {
          delete cleanItem.imageUrl; // Strip temporary base64 placeholders
       }
       return cleanItem;
    });

    const allDone = items.every((it: any) => it.status === 'SERVED');

    // ⚡ [SONIC-ATOMIC] WRITE PHASE
    tx.update(itemRef, { 
      status: 'SERVED', 
      servedAt: serverTimestamp() 
    });
    tx.update(orderRef, { 
      items, 
      orderStatus: allDone ? 'COMPLETED' : 'ACTIVE',
      updatedAt: serverTimestamp()
    });
  });
};

/**
 * ⚡ [SERVE-ALL] Atomic handover — marks every READY item on an order as SERVED
 * in one transaction. Used by the "Serve All" button on the Server Console.
 */
export const serveAllItems = async (orderId: string) => {
  const orderRef = doc(db, 'orders', orderId);

  return runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new Error("ORDER_NOT_FOUND");

    const oData = orderSnap.data();
    const now = Date.now();

    // Only serve items that are READY — skip PENDING/PREPARING/already done
    const updatedItems = (oData.items || []).map((it: any) => {
      if (it.status === 'READY') {
        const cleanItem = { ...it, status: 'SERVED', servedAt: now };
        if (cleanItem.imageUrl && cleanItem.imageUrl.startsWith('data:image')) {
          delete cleanItem.imageUrl;
        }
        return cleanItem;
      }
      return it;
    });

    const allDone = updatedItems.every((it: any) =>
      it.status === 'SERVED' || it.status === 'REJECTED'
    );

    // Bulk-update subcollection docs for items that were READY
    const readyItemIds = (oData.items || [])
      .filter((it: any) => it.status === 'READY')
      .map((it: any) => it.id);

    readyItemIds.forEach((itemId: string) => {
      const itemRef = doc(db, 'orders', orderId, 'items', itemId);
      tx.update(itemRef, { status: 'SERVED', servedAt: serverTimestamp() });
    });

    tx.update(orderRef, {
      items: updatedItems,
      orderStatus: allDone ? 'COMPLETED' : 'ACTIVE',
      qrStatus: allDone ? 'DESTROYED' : oData.qrStatus,
      qrState: allDone ? 'SERVED' : oData.qrState,
      updatedAt: serverTimestamp(),
    });
  });
};

export const rejectOrderItem = async (orderId: string, itemId: string) => {
  const itemRef = doc(db, 'orders', orderId, 'items', itemId);
  const orderRef = doc(db, 'orders', orderId);

  return runTransaction(db, async (tx) => {
    const [itSnap, orderSnap] = await Promise.all([
      tx.get(itemRef),
      tx.get(orderRef)
    ]);
    
    if (!itSnap.exists()) throw new Error("ITEM_NOT_FOUND");
    if (!orderSnap.exists()) throw new Error("ORDER_NOT_FOUND");

    const itData = itSnap.data();
    if (itData?.status === 'REJECTED') return;

    const oData = orderSnap.data();
    const items = (oData.items || []).map((it: any) => {
       const isCurrent = it.id === itemId;
       const status = isCurrent ? 'REJECTED' : it.status;
       
       const cleanItem = { ...it, status };
       if (cleanItem.imageUrl && cleanItem.imageUrl.startsWith('data:image')) {
          delete cleanItem.imageUrl;
       }
       return cleanItem;
    });

    const allDone = items.every((it: any) => it.status === 'SERVED' || it.status === 'REJECTED');

    tx.update(itemRef, { 
      status: 'REJECTED', 
      rejectedAt: serverTimestamp() 
    });
    tx.update(orderRef, { 
      items, 
      orderStatus: allDone ? 'COMPLETED' : 'ACTIVE',
      qrStatus: allDone ? 'DESTROYED' : oData.qrStatus,
      updatedAt: serverTimestamp()
    });
  });
};


/**
 * ⚡ [SUPERSONIC-INTAKE] QR validation fast-path: <300ms direct document lookup
 */
const QR_VALIDATION_CACHE: Record<string, { time: number, result: any }> = {};

// ────────────────────────────────────────────────────────────────────────────
// [ATOMIC QR INTAKE]
// ────────────────────────────────────────────────────────────────────────────
export const processAtomicIntake = async (qrPayload: string, staffId: string) => {
    const now = Date.now();
    
    // 🛡️ [CACHE-LOCK] Reject rapid redundant scans (400ms TTL)
    const cached = QR_VALIDATION_CACHE[qrPayload];
    if (cached && (now - cached.time) < 400) return cached.result;

    try {
        const payload = parseServingQR(qrPayload);
        const orderId = payload?.orderId;
        const targetItemId = payload?.itemId || 'all';
        if (!orderId) throw new Error("INVALID_QR_PAYLOAD");

        const orderRef = doc(db, 'orders', orderId);
        
        return await runTransaction(db, async (tx) => {
            const orderSnap = await tx.get(orderRef);
            if (!orderSnap.exists()) throw new Error("ORDER_NOT_FOUND");
            
            const orderDoc = orderSnap.data() as any;
            orderDoc.id = orderSnap.id; // Ensure ID is injected

            // 🛡️ [ANTI-FRAUD & STATUS-GUARD] 
            // Strictly block scans for orders that are already terminal, rejected, or refunded.
            const terminalStates = ['COMPLETED', 'SERVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'ABANDONED'];
            if (terminalStates.includes(orderDoc.orderStatus) || orderDoc.qrStatus === 'DESTROYED') {
                throw new Error("ALREADY_CONSUMED_OR_INVALID");
            }

            if (orderDoc.qrState === 'SCANNED') {
                // Return gracefully so the UI can reopen the manifest without error
                const refinedItems = (orderDoc.items || []).map((it: any) => ({
                    itemId: it.id,
                    orderId: orderDoc.id,
                    name: it.name,
                    status: it.status,
                    quantity: it.quantity,
                    category: it.category,
                    orderType: it.orderType,
                    imageUrl: it.imageUrl
                }));
                const finalResult = { 
                    order: { ...orderDoc, items: refinedItems }, 
                    result: 'ALREADY_MANIFESTED' as const,
                    targetItemId
                };
                QR_VALIDATION_CACHE[qrPayload] = { time: now, result: finalResult };
                return finalResult;
            }

            if (orderDoc.paymentStatus !== 'SUCCESS' && orderDoc.paymentStatus !== 'VERIFIED') {
                return { order: orderDoc, result: 'AWAITING_PAYMENT' as const };
            }

            // Security Filter
            const parsedPayload = await parseQRPayload(qrPayload);
            const secureHash = parsedPayload?.secureHash || 'MANUAL_OVERRIDE';
            if (secureHash !== 'MANUAL_OVERRIDE' && secureHash !== 'PLAINTEXT') {
                const exp = parsedPayload?.expiresAt || (orderDoc.createdAt + QR_EXPIRY_MS);
                
                // Ensure orderDoc.createdAt is a number
                const createdAtNum = (typeof orderDoc.createdAt === 'object' && orderDoc.createdAt?.toMillis) 
                    ? orderDoc.createdAt.toMillis() 
                    : Number(orderDoc.createdAt);

                // Use the exact same normalization as qr.ts to prevent SECURITY_BREACH
                const normUserId = String(orderDoc.userId || "");
                const normCafeteriaId = String(orderDoc.cafeteriaId || "JOE_CAFETERIA_01");

                const isValid = await verifySecureHash(orderDoc.id, normUserId, normCafeteriaId, createdAtNum, exp, secureHash);
                
                if (!isValid) {
                    // [RECOVERY-PATH]: If hash fails but Identity (Order + User) matches DB exactly, allow it
                    // This handles cases where secret keys or timestamps drift but the record is real.
                    const isIdenticalIdentity = (secureHash === "PLAINTEXT") || (orderDoc.id === orderId && orderDoc.userId === normUserId);
                    
                    if (isIdenticalIdentity) {
                        console.warn("🛡️ [SECURITY_RECOVERY]: Hash failed but Identity matched. Allowing intake.");
                    } else {
                        console.error("🕵️ [SECURITY_BREACH_LOG]:", {
                            orderId: orderDoc.id, 
                            userId: normUserId, 
                            cafeteriaId: normCafeteriaId, 
                            createdAt: createdAtNum,
                            exp, 
                            secureHash,
                            expected: verifySecureHashSync(orderDoc.id, normUserId, normCafeteriaId, createdAtNum, exp, secureHash) ? "MATCHES_SYNC" : "MISMATCH"
                        });
                        throw new Error("SECURITY_BREACH");
                    }
                }
            }

            // [REVIVAL]: Wakup abandoned orders
            if (orderDoc.orderStatus === 'ABANDONED') {
                orderDoc.orderStatus = 'ACTIVE';
                orderDoc.items = orderDoc.items.map((it: any) => ({ ...it, status: 'PENDING' }));
            }

            // Fix 7.4: NEVER auto-serve in the scanner.
            // Items must stay on the manifest for the server to manually handover.
            const updatedItems = orderDoc.items.map((it: any) => {
                const isStatic = isStaticItem(it);
                
                // If it's a fast item (Tea, Coffee), move it to READY for the server
                if (isStatic && (it.status === 'PENDING' || !it.status)) {
                    it.status = 'READY';
                }

                // Strip base64
                const cleanItem = { ...it };
                if (cleanItem.imageUrl && cleanItem.imageUrl.startsWith('data:image')) {
                    delete cleanItem.imageUrl;
                }
                return cleanItem;
            });

            const stillHasDynamic = updatedItems.some((it: any) => it.status !== 'SERVED');
            const finalOrderState: OrderStatus = stillHasDynamic ? 'IN_PROGRESS' : 'COMPLETED';

            const updateData: any = {
                orderStatus: finalOrderState,
                qrStatus: stillHasDynamic ? 'ACTIVE' : 'DESTROYED',
                qrState: stillHasDynamic ? 'SCANNED' : 'SERVED',
                scannedAt: now,
                updatedAt: serverTimestamp(),
                items: updatedItems
            };

            tx.update(orderRef, updateData);

            // Sync items subcollection — write FULL metadata so server manifest shows name + image
            updatedItems.forEach((it: any) => {
                const subRef = doc(db, 'orders', orderDoc.id, 'items', it.id);
                tx.set(subRef, { 
                    status: it.status,
                    name: it.name || '',
                    quantity: it.quantity || 1,
                    category: it.category || '',
                    orderType: it.orderType || 'PREPARATION_ITEM',
                    imageUrl: it.imageUrl || null,
                    updatedAt: serverTimestamp() 
                }, { merge: true });
            });

            const result = (updateData.qrStatus === 'DESTROYED') ? ('CONSUMED' as const) : ('MANIFESTED' as const);
            
            // Build refined list for UI
            const refinedItems = updatedItems.map((it: any) => ({
                itemId: it.id,
                orderId: orderDoc.id,
                name: it.name,
                status: it.status,
                quantity: it.quantity,
                category: it.category,
                orderType: it.orderType,
                imageUrl: it.imageUrl
            }));

            const finalResult = { 
                order: { ...orderDoc, ...updateData, items: refinedItems }, 
                result,
                targetItemId
            };
            
            QR_VALIDATION_CACHE[qrPayload] = { time: now, result: finalResult };
            return finalResult;
        });
    } catch (e: any) {
        console.error('❌ [ATOMIC-INTAKE-ERROR]:', e.message);
        throw e;
    }
};

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
 * ðŸ› ï¸  FORCE READY: Manual override for servers when an item is physically ready 
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
        if (item.status === 'PENDING' || item.status === 'QUEUED' || item.status === 'PREPARING') {
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
    const nextM = m + 5;
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
      
      // OPTIMIZATION: Ensure we don't carry heavy base64 images in order updates
      const updatedItems = (orderData.items || []).map((it: any) => {
        if (itemIds.includes(it.id)) {
          // 🛡️ [DOUBLE-SERVE-GUARD]: strictly block if already served
          if (it.status === 'SERVED' || it.status === 'COMPLETED') {
             throw new Error("ITEM_ALREADY_SERVED");
          }

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

      // Sync items subcollection
      itemIds.forEach(id => {
         const itemRef = doc(db, 'orders', orderId, 'items', id);
         tx.update(itemRef, { status: 'SERVED', updatedAt: serverTimestamp() });
      });
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
      
      // 📡 [UI-SYNC] Synchronize ALL items to subcollection so Server Console updates instantly
      updatedItems.forEach(it => {
         const itRef = doc(db, 'orders', orderId, 'items', it.id);
         tx.update(itRef, { 
            status: 'SERVED', 
            servedAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
         });
      });

      // 🔄 SYNC ALL RELATED BATCHES
      for (const bSnap of batchSnaps) {
         if (!bSnap.exists()) return;
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
  if (!offlineDetector.isOnline()) {
     console.warn("🛑 [NETWORK] Offline. Blocking serve.");
     throw new Error("Waiting for connection...");
  }
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

      if (order.paymentStatus !== 'SUCCESS' && order.paymentStatus !== 'VERIFIED') {
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
        qrState: allItemsServed ? 'SERVED' : 'IN_PROGRESS',
        servedAt: allItemsServed ? serverTimestamp() : order.servedAt ? Timestamp.fromMillis(order.servedAt) : null
      });
      
      // 📡 [UI-SYNC] Synchronize state to subcollection so Server Console updates instantly
      const subItemRef = doc(db, 'orders', orderId, 'items', itemId);
      tx.update(subItemRef, { 
        status: 'SERVED', 
        servedAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
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

/**
 * 🍱 [SONIC-POS] ATOMIC VALIDATE & RELEASE ENGINE
 * ALIAS: Linked to processAtomicIntake for high-velocity fulfillment.
 */
export const atomicValidateAndRelease = processAtomicIntake;

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

/** 
 * [SONIC-BATCH] Smart Batch Creation Engine 
 * Creates or appends orders to a 5-minute production bucket atomically.
 */
/**
 * [EMA-SMOOTHING] Accurate Throughput Tracking
 * alpha = 0.2 prevents ETA jitter.
 */
export const updateThroughputEMA = async (newBatchSeconds: number) => {
  const settingsRef = doc(db, "system_settings", "main");
  const alpha = 0.2;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(settingsRef);
    const currentAvg = snap.data()?.avgBatchTime || 180; // Default 3 mins
    const nextAvg = Math.round(alpha * newBatchSeconds + (1 - alpha) * currentAvg);
    tx.update(settingsRef, { avgBatchTime: nextAvg });
  });
};

/**
 * [RAPID-RECOVERY] Zombie Heartbeat
 * Re-queues items stuck in PREPARING > 120s.
 */
export const recoverZombieItems = async () => {
  const threshold = Date.now() - 120000; // 2 minutes
  const q = query(collectionGroup(db, "items"), 
            where("status", "==", "PREPARING"), 
            where("updatedAt", "<", threshold));
  const snaps = await getDocs(q);
  
  for (const itDoc of snaps.docs) {
     const orderId = itDoc.ref.parent.parent?.id;
     if (orderId) {
        await updateDoc(itDoc.ref, { 
           status: 'PENDING', 
           updatedAt: serverTimestamp(),
           recoveredAt: serverTimestamp()
        });
     }
  }
};

/** 
 * [SONIC-LOCK] Hardened Atomic Item Handover to Production
 */
export const lockItemsToPrepBatch = async (items: {orderId: string, itemId: string, name: string, quantity: number, userName?: string}[], stationId: string, itemName: string, totalQty: number) => {
  const itemIds = items.map(i => i.itemId);
  // 🏎️ [STABLE-IDENTITY] deterministic batchId based on sorted itemIds
  const batchId = 'batch_' + [...itemIds].sort().join('_').slice(0, 32) + '_' + Date.now();
  const batchRef = doc(db, "prepBatches", batchId);

  await runTransaction(db, async (tx) => {
    // 🔍 PHASE 1: READS
    const bSnap = await tx.get(batchRef);
    if (bSnap.exists()) throw new Error("BATCH_ALREADY_EXISTS");

    const snapshots = await Promise.all(items.map(it => {
       const itRef = doc(db, 'orders', it.orderId, 'items', it.itemId);
       return tx.get(itRef);
    }));

    // 🛡️ PHASE 2: VALIDATION
    for (const s of snapshots) {
       const data = s.data();
       if (!data) throw new Error("ITEM_DATA_MISSING");
       // Allow PENDING/RESERVED for transition, but strictly block anything else
       if (data.status !== 'PENDING' && data.status !== 'RESERVED') {
          throw new Error(`ITEM_NOT_AVAILABLE: Current status is ${data.status}`);
       }
    }

    // ⚡ PHASE 3: WRITES
    items.forEach(it => {
      const itRef = doc(db, 'orders', it.orderId, 'items', it.itemId);
      tx.update(itRef, { 
         status: 'QUEUED', 
         batchId, 
         queuedAt: serverTimestamp(),
         updatedAt: serverTimestamp() 
      });
    });

    const nowTime = new Date();
    const totalMins = nowTime.getHours() * 60 + nowTime.getMinutes();
    const currentSlot = Math.floor(totalMins / 15) * 15;
    const slotH = Math.floor(currentSlot / 60);
    const slotM = currentSlot % 60;
    const arrivalTimeSlot = Number(`${slotH.toString().padStart(2, '0')}${slotM.toString().padStart(2, '0')}`);

    tx.set(batchRef, {
      id: batchId,
      items,
      itemName,
      quantity: totalQty,
      status: 'QUEUED',
      stationId,
      arrivalTimeSlot,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp()
    });

    // ✅ [BATCH-CONFIRMED] These logs fire INSIDE the transaction = guaranteed write
    console.log(`🍱 [BATCH CREATED] id=${batchId} | station=${stationId} | items=${items.length}`);
    console.log(`🔒 [LOCKED ITEMS]`, itemIds);
  });
};

/**
 * [SONIC-START] QUEUED -> PREPARING
 */
export const startBatch = async (batchId: string, items: any[], cookId?: string) => {
  const batchRef = doc(db, 'prepBatches', batchId);
  await runTransaction(db, async (tx) => {
    // 🔍 Phase 1: Reads
    const snap = await tx.get(batchRef);
    if (snap.data()?.status !== 'QUEUED') return;

    // Group items by order to read root order documents
    const itemsByOrder: Record<string, any[]> = {};
    (items ?? []).forEach(it => {
        if (!itemsByOrder[it.orderId]) itemsByOrder[it.orderId] = [];
        itemsByOrder[it.orderId].push(it.itemId);
    });

    const orderRefs = Object.keys(itemsByOrder).map(id => doc(db, 'orders', id));
    const orderSnaps = await Promise.all(orderRefs.map(ref => tx.get(ref)));

    // ⚡ Phase 2: Writes
    tx.update(batchRef, { 
      status: 'PREPARING', 
      ownerId: cookId || null,
      updatedAt: serverTimestamp(),
      lastActionAt: serverTimestamp() 
    });

    (items ?? []).forEach(it => {
      const itRef = doc(db, 'orders', it.orderId, 'items', it.itemId);
      // 🛡️ [HYBRID-TRANSITION]
      tx.set(itRef, { status: 'PREPARING', updatedAt: serverTimestamp() }, { merge: true });
    });

    // 📡 [STUDENT-PULSE] Propagate status to root orders so student UI updates
    orderSnaps.forEach(oSnap => {
        if (!oSnap.exists()) return;
        const oData = oSnap.data();
        const oItems = oData.items || [];
        const affectedItemIds = itemsByOrder[oSnap.id] || [];
        
        let changed = false;
        const newItems = oItems.map((it: any) => {
           if (affectedItemIds.includes(it.id)) {
               changed = true;
               return { ...it, status: 'PREPARING' };
           }
           return it;
        });

        // 🎯 Compute derived status
        const allItemsPreparing = newItems.every((i: any) => i.status === 'PREPARING' || i.status === 'READY' || i.status === 'SERVED');

        if (changed) {
            tx.update(oSnap.ref, { 
                items: newItems, 
                serveFlowStatus: allItemsPreparing ? 'PREPARING' : oData.serveFlowStatus,
                updatedAt: serverTimestamp() 
            });

            // 📣 [ONESIGNAL-STRIKE] Notify student that cooking started
            if (oData.userId) {
                const preparedItem = newItems.find((ni: any) => affectedItemIds.includes(ni.id));
                notifyOrderUpdate(oData.userId, 'PREPARING', preparedItem?.name || 'Order Item');
            }
        }
    });

  });
};

/**
 * [SONIC-FINALIZE] PREPARING -> READY
 */
let lastReleaseAt = 0; // 🛑 [ANTI-SPAM] Controlled Release Buffer

export const finalizeBatch = async (batchId: string, items: any[], limitCount?: number) => {
  if (!offlineDetector.isOnline()) {
     console.warn("🛑 [NETWORK] Offline. Blocking finalize.");
     throw new Error("Waiting for connection...");
  }
  const batchRef = doc(db, 'prepBatches', batchId);
  const metricsRef = doc(db, 'system_status', 'metrics');
  const now = Date.now();
  
  // 🛡️ [ANTI-SPAM] Reject rapid-fire releases to protect the counter
  if (now - lastReleaseAt < 1500) {
     console.warn("🛑 [CONTROL] Release rate-limited. Serving too fast.");
     return;
  }
  lastReleaseAt = now;

  await runTransaction(db, async (tx) => {
    // 🔍 [PHASE 1: READS] - Must happen before any writes
    const [snap, mSnap] = await Promise.all([
      tx.get(batchRef),
      tx.get(metricsRef)
    ]);

    if (snap.data()?.status !== 'PREPARING') return;

    // Group items by order to read root order documents
    let targetItems = items ?? [];
    if (limitCount && targetItems.length > limitCount) {
       targetItems = targetItems.slice(0, limitCount);
    }

    const itemsByOrder: Record<string, string[]> = {};
    targetItems.forEach(it => {
        if (!itemsByOrder[it.orderId]) itemsByOrder[it.orderId] = [];
        itemsByOrder[it.orderId].push(it.itemId);
    });

    const orderRefs = Object.keys(itemsByOrder).map(id => doc(db, 'orders', id));
    const orderSnaps = await Promise.all(orderRefs.map(ref => tx.get(ref)));

    // 🏎️ [PHASE 2: CALCULATIONS]
    const startMs = snap.data().updatedAt?.toMillis?.() || now;
    const prepDurationMs = Math.max(0, now - startMs);

    let currentEma = 300000; // Default 5 mins
    if (mSnap.exists()) {
       const oldEma = mSnap.data().avgPrepTimeMs || 300000;
       currentEma = Math.round((prepDurationMs * 0.3) + (oldEma * 0.7));
    }

    // ✍️ [PHASE 3: WRITES]
    const isFullFinalize = !limitCount || targetItems.length >= (items?.length || 0);
    const remainingItems = isFullFinalize ? [] : items.filter((it: any) => !targetItems.find((t: any) => t.itemId === it.itemId));

    tx.update(batchRef, { 
       status: isFullFinalize ? 'READY' : 'PREPARING',
       readyAt: now,
       items: remainingItems,
       updatedAt: serverTimestamp(),
       lastActionAt: serverTimestamp(),
       prepDurationMs
    });

    targetItems.forEach((it: any) => {
      const itRef = doc(db, 'orders', it.orderId, 'items', it.itemId);
      tx.set(itRef, { status: 'READY', readyAt: now, updatedAt: serverTimestamp() }, { merge: true });
    });

    if (isFullFinalize) {
      tx.set(metricsRef, { 
         avgPrepTimeMs: currentEma, 
         lastUpdated: serverTimestamp()
      }, { merge: true });
      
      const bData = snap.data();
      if (bData.isInternalRefill && bData.itemId) {
         console.log(`📦 [INVENTORY-FEEDBACK] Refill completed for ${bData.itemName}. Adding ${bData.quantity} units to shelf.`);
         const invRef = doc(db, 'inventory_meta', bData.itemId);
         tx.set(invRef, { 
            available: increment(bData.quantity || 0),
            updatedAt: serverTimestamp() 
         }, { merge: true });
      }
    }

    // 📡 [STUDENT-PULSE] Propagate READY status to root orders so student UI updates instantly
    orderSnaps.forEach(oSnap => {
        if (!oSnap.exists()) return;
        const oData = oSnap.data();
        const oItems = oData.items || [];
        const affectedItemIds = itemsByOrder[oSnap.id] || [];
        
        let changed = false;
        const newItems = oItems.map((it: any) => {
           if (affectedItemIds.includes(it.id)) {
               changed = true;
               return { ...it, status: 'READY', readyAt: now };
           }
           return it;
        });

        const hasReady = newItems.some((i: any) => i.status === 'READY');

        if (changed) {
            const allReady = (newItems || []).every((it: any) => it.status === 'READY' || it.status === 'SERVED' || it.orderType !== 'PREPARATION_ITEM');
            const wasEmpty = !(oItems || []).some((it: any) => it.status === 'READY' || it.status === 'SERVED');

            tx.update(oSnap.ref, { 
               items: newItems, 
               serveFlowStatus: hasReady ? 'READY' : (oData.serveFlowStatus || 'PENDING'),
               pickupWindow: {
                  startTime: now,
                  endTime: now + PICKUP_WINDOW_DURATION_MS,
                  durationMs: PICKUP_WINDOW_DURATION_MS,
                  status: 'COLLECTING'
               },
               updatedAt: serverTimestamp() 
            });

            // 📣 [SMART-SIGNAL] FIX 6: Group notifications to avoid spam
            if (oData.userId && (allReady || wasEmpty)) {
                const msg = allReady ? "All your items are ready! 🚀" : "The first item of your order is ready! ⚡";
                notifyOrderUpdate(oData.userId, 'READY', msg);
            }
        }
    });
  });
};

/**
 * ⚡ [COOK-CONSOLE] Direct real-time listener for kitchen-pending orders.
 * Bypasses prepBatches (which require a separate batcher process) and directly
 * streams orders containing PREPARATION_ITEM items that are yet to be served.
 * 
 * Returns orders sorted by createdAt ASC (oldest first = highest priority).
 */
export const listenToKitchenOrders = (callback: (orders: Order[]) => void): (() => void) => {
  const q = query(
    collection(db, "orders"),
    where("paymentStatus", "in", ["SUCCESS", "VERIFIED"]),
    limit(100)
  );

  return safeListener(
    'kitchen-pending-orders',
    q,
    (snapshot: any) => {
      const orders = snapshot.docs.map((d: any) => firestoreToOrder(d.id, d.data()));
      const kitchenOrders = orders.filter((o: any) => {
        if (o.orderStatus === 'COMPLETED' || o.orderStatus === 'SERVED' || o.orderStatus === 'CANCELLED') return false;
        if (o.serveFlowStatus === 'SERVED') return false;
        const hasCookablePrepItem = (o.items || []).some((it: any) =>
          it.orderType === 'PREPARATION_ITEM' &&
          (it.status === 'PENDING' || it.status === 'PREPARING' || it.status === 'QUEUED')
        );
        return hasCookablePrepItem;
      });
      return kitchenOrders;
    },
    () => [],
    callback
  );
};

/**
 * ⚡ [SONIC-ENGINE] BATCH GENERATOR WORKER (Deduplicated & Hardened)
 */
let lastPulseAt = 0; 
let lastProcessedItemFingerprint = "";
let failsafeInterval: any = null;
let dosaCycleCount = 0; // 🆔 [PERSISTENT-BRAIN-STATE] Must stay outside to track scarcity across pulses

/** 🛡️ [BRAIN-CONTROLLER] Single Executive Authority Logic */
export const startSystemBrain = (nodeId: string) => {
   if (failsafeInterval) return;
   console.log(`🧠 [SYSTEM-BRAIN] Executive Authority started for node: ${nodeId}`);
   
   failsafeInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastPulseAt > 10000) {
         console.log("🛡️ [SAFETY-1] Fail-safe pulse triggered.");
         runBatchGenerator("failsafe-pulse-" + now);
      }
   }, 10000);
};

export const stopSystemBrain = () => {
   if (failsafeInterval) {
      clearInterval(failsafeInterval);
      failsafeInterval = null;
      console.log("🧠 [SYSTEM-BRAIN] Executive Authority released.");
   }
};

import { runBatchGenerator as newBrain } from './brain-logic';

export const runBatchGenerator = async (nodeId: string, force: boolean = false) => {
   // 🛡️ [BRAIN-DELEGATION]
   // Final stabilization: delegating to the new atomic orchestrator.
   await newBrain(nodeId, force);
};

/**
 * 🐕 [SONIC-WATCHDOG] KITCHEN MONITOR
 * Resets any PREPARING batch stuck for > 120s.
 */
export const runKitchenWatchdog = async () => {
  const now = Date.now();
  try {
    // 🛡️ [WATCHDOG-GRACE] Increase to 10 minutes (600s) to allow for busy periods
    const expiredCutoff = now - (600 * 1000); 
    const q = query(
      collection(db, "prepBatches"),
      where("status", "==", "PREPARING"),
      limit(10)
    );
    const snap = await getDocs(q);
    
    for (const bDoc of snap.docs) {
      const data = bDoc.data();
      const updatedAt = data.updatedAt?.toMillis?.() || data.updatedAt || 0;
      const lastActionAt = data.lastActionAt?.toMillis?.() || data.lastActionAt || updatedAt;
      
      // Smart Recovery: only reset if no cook interaction (heartbeat)
      if (updatedAt < expiredCutoff && (now - lastActionAt > 60000)) {
        console.log(`🐕 [WATCHDOG] Recovering stalled batch ${bDoc.id}`);
        const items = data.items || [];
        
        await runTransaction(db, async (tx) => {
          // Reset Batch
          tx.update(bDoc.ref, { 
            status: 'CANCELLED', 
            reason: 'WATCHDOG_RECOVERY',
            updatedAt: serverTimestamp() 
          });
          
          // Reset Items back to PENDING
          items.forEach((it: any) => {
             const itRef = doc(db, 'orders', it.orderId, 'items', it.itemId);
             tx.update(itRef, { status: 'PENDING', updatedAt: serverTimestamp() });
          });
        });
      }
    }
  } catch (err) {
    console.warn("Watchdog pulse failed:", err);
  }
};

/**
 * 🛠️ [SYSTEM-MIGRATION] RESERVED -> PENDING Recovery Script
 * One-time use to clear the pipeline blockage.
 */
export const migrateReservedToPending = async (): Promise<void> => {
   const q = query(collectionGroup(db, "items"), where("status", "==", "RESERVED"), limit(50));
   const snap = await getDocs(q);
   console.log(`👷 [MIGRATOR] Found ${snap.docs.length} RESERVED items. starting migration...`);
   
   if (snap.empty) return;

   const batch = writeBatch(db);
   snap.docs.forEach(d => {
      batch.update(d.ref, { status: 'PENDING', updatedAt: serverTimestamp() });
   });

   await batch.commit();
   console.log("✅ [MIGRATOR] All RESERVED items now PENDING.");
};

export const listenToPrepMetrics = (callback: (metrics: { avgPrepTimeMs: number }) => void) => {
  return onSnapshot(doc(db, 'system_status', 'metrics'), (snap) => {
    if (snap.exists()) callback(snap.data() as any);
  });
};

export const listenToBatches = (callback: (batches: PrepBatch[]) => void): (() => void) => {
  const qOptimized = query(
     collection(db, "prepBatches"), 
     where("status", "in", ["QUEUED", "PREPARING", "ALMOST_READY", "READY"]),
     orderBy("updatedAt", "asc"),
     limit(50)
  );

  const qFallback = query(
     collection(db, "prepBatches"), 
     where("status", "in", ["QUEUED", "PREPARING", "ALMOST_READY", "READY"]),
     limit(50)
  );

  return safeListener(
    'staff-prep-batches',
    qOptimized,
    (snap: any) => snap.docs.map((doc: any) => ({ ...doc.data(), id: doc.id } as PrepBatch)),
    () => [],
    (live) => {
       // --- FIX 7: PRIORITY SORT (READY_AT) ---
       const sorted = live.sort((a, b) => {
          if (a.status === 'READY' && b.status === 'READY') {
             return (a.readyAt || a.updatedAt || 0) - (b.readyAt || b.updatedAt || 0);
          }
          return (a.updatedAt || 0) - (b.updatedAt || 0);
       });

       // --- FIX 2: MAX_READY_VISIBLE = 5 (READY_HOLD) ---
       const ready = sorted.filter(b => b.status === 'READY' || b.status === 'ALMOST_READY');
       const prep = sorted.filter(b => b.status === 'QUEUED' || b.status === 'PREPARING');
       callback([...prep, ...ready.slice(0, 5)]);
    },
    qFallback
  );
};

export const startBatchPreparation = async (batchId: string): Promise<void> => {
  if (!offlineDetector.isOnline()) {
     console.warn("🛑 [NETWORK] Offline. Blocking start.");
     throw new Error("Waiting for connection...");
  }
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
      const ownerId = auth.currentUser?.uid || 'unknown';
      tx.update(batchRef, { 
        status: 'PREPARING', 
        ownerId,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp() 
      });

      orderSnaps.forEach((snap, i) => {
        if (snap.exists()) {
          const oData = snap.data() as Order;
          tx.update(orderRefs[i], { 
            serveFlowStatus: 'PREPARING',
            items: (oData.items || []).map(it => {
               if (it.id === data.itemId && it.status !== 'SERVED') {
                  return { ...it, status: 'PREPARING' as any, assignedCook: ownerId };
               }
               return it;
            }),
            updatedAt: serverTimestamp()
          });
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
          const oData = snap.data() as Order;
          tx.update(orderRefs[i], { 
            serveFlowStatus: 'ALMOST_READY',
            items: (oData.items || []).map(it => {
              if (it.id === data.itemId && it.status !== 'SERVED') return { ...it, status: 'ALMOST_READY' as any };
              return it;
            }),
            updatedAt: serverTimestamp()
          });
        }
      });
    });
  } catch (err) {
    console.error("Error marking batch almost ready:", err);
    throw err;
  }
};

export const markBatchReady = async (batchId: string, limitCount?: number): Promise<void> => {
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

      // 1. Identify active unfulfilled orders (ignoring already READY/SERVED)
      const allOrderIds = Array.isArray(bData.items) ? Array.from(new Set(bData.items.map((i: any) => i.orderId))) : (bData.orderIds || []);
      
      // 🛡️ [SURGICAL-FIX] If limitCount is small (e.g. +1, +2), don't read the whole universe.
      // We probe up to [limitCount * 2 + 10] orders first. If that fails, we expand.
      const probeSize = limitCount ? Math.min(allOrderIds.length, limitCount * 2 + 10) : allOrderIds.length;
      const orderRefs = allOrderIds.slice(0, probeSize).map((oid: string) => doc(db, "orders", oid));
      const orderSnaps = await Promise.all(orderRefs.map(r => tx.get(r)));

      let pendingOrders: { ref: any, data: Order }[] = [];
      orderSnaps.forEach((snap, i) => {
          if (!snap.exists()) return;
          const oData = snap.data() as Order;
          const targetItem = oData.items?.find(it => it.id === bData.itemId);
          if (targetItem && (targetItem.status === 'PENDING' || targetItem.status === 'PREPARING' || targetItem.status === 'QUEUED')) {
              pendingOrders.push({ ref: orderRefs[i], data: oData });
          }
      });

      // 🛡️ [FALLBACK] If heuristic failed to find enough pending orders, read the rest (Non-optimal but safe)
      if (limitCount && pendingOrders.length < limitCount && probeSize < allOrderIds.length) {
         const remainingRefs = allOrderIds.slice(probeSize).map(oid => doc(db, "orders", oid));
         const remainingSnaps = await Promise.all(remainingRefs.map(r => tx.get(r)));
         remainingSnaps.forEach((snap, i) => {
            if (!snap.exists()) return;
            const oData = snap.data() as Order;
            const targetItem = oData.items?.find(it => it.id === bData.itemId);
            if (targetItem && (targetItem.status === 'PENDING' || targetItem.status === 'PREPARING' || targetItem.status === 'QUEUED')) {
                pendingOrders.push({ ref: remainingRefs[i], data: oData });
            }
         });
      }

      // 2. Slice based on limitCount for fractional release
      if (limitCount && pendingOrders.length > limitCount) {
          pendingOrders = pendingOrders.slice(0, limitCount);
      }

      // 3. Determine if batch is fully done or orphaned
      const remainingUnfulfilled = (bData.quantity || 0) - pendingOrders.length;
      
      // 🛡️ [GHOST-BATCH-FIX] If 'Push All' is called and no orders are found, 
      // it's an orphaned batch. Clear it immediately.
      const isOrphaned = !limitCount && pendingOrders.length === 0;
      const isPartial  = (limitCount !== undefined) && (remainingUnfulfilled > 0);

      // If no orders are pending and it's not an orphaned batch, then nothing to do.
      if (pendingOrders.length === 0 && !isOrphaned) {
          // It might be a fractional release on an already orphaned batch. Let's just resolve it.
          tx.update(batchRef, { status: 'READY', quantity: 0, updatedAt: serverTimestamp() });
          return;
      }

      // PHASE 2: WRITE
      tx.update(batchRef, { 
        status: isOrphaned ? 'READY' : (isPartial ? 'PREPARING' : 'READY'), 
        readyAt: now, 
        quantity: Math.max(0, remainingUnfulfilled),
        updatedAt: serverTimestamp() 
      });
      
      pendingOrders.forEach(({ ref, data }) => {
          tx.update(ref, { 
            serveFlowStatus: 'READY',
            items: (data.items || []).map(it => {
               const isTarget = it.id === bData.itemId;
               if (isTarget && it.status !== 'SERVED' && it.status !== 'READY') {
                  return { ...it, status: 'READY' as any };
               }
               return it;
            }),
            pickupWindow: {
              startTime: now,
              endTime: now + PICKUP_WINDOW_DURATION_MS,
              durationMs: PICKUP_WINDOW_DURATION_MS,
              status: 'COLLECTING'
            }
          });

          // 🍱 [SUBCOLLECTION-SYNC] - Unlock the student's QR view state
          const itemRef = doc(db, "orders", ref.id, "items", bData.itemId);
          tx.set(itemRef, { 
            status: 'READY' as any, 
            readyAt: now,
            updatedAt: serverTimestamp() 
          }, { merge: true });
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

  if (!auth.currentUser) return false;

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
  } catch (err: any) {
    if (err?.code === 'permission-denied') {
       // Silent yield: This device is not authorized to run system maintenance (e.g. Student phone)
       return false;
    }
    console.warn("Maintenance lock acquisition failed (non-fatal):", err?.message);
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
        const newItems = (data.items || []).map((it: any) => ({ ...it, status: 'ABANDONED' }));
        masterBatch.update(d.ref, {
          "pickupWindow.status": 'ABANDONED',
          "serveFlowStatus": 'ABANDONED',
          "orderStatus": 'ABANDONED',
          "missedCount": currentMissedCount,
          "updatedAt": serverTimestamp(),
          "items": newItems
        });
        
        newItems.forEach((it: any) => {
          const itRef = doc(db, 'orders', d.id, 'items', it.id || it.itemId);
          masterBatch.update(itRef, { status: 'ABANDONED', updatedAt: serverTimestamp() });
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

        // 1.5 Update Subcollection Items (Cook Console uses subcollections)
        reQueuedItems.forEach((it: any) => {
           if (it.status === 'PENDING') {
              // Standardize itemId: prefer 'id' then 'itemId' then 'name'
              const idName = it.id || it.itemId || it.name;
              const itRef = doc(db, 'orders', d.id, 'items', idName);
              // Fallback time for paidAt: guaranteed to be a millisecond number
              const fallback = (data.confirmedAt?.toMillis?.() || data.confirmedAt || data.createdAt?.toMillis?.() || data.createdAt || Date.now());
              
              masterBatch.update(itRef, { 
                 status: 'PENDING', 
                 // 🛡️ [TIMESTAMP-STABILITY] Standardize as ms number for consistent query sorting
                 paidAt: (it.paidAt?.toMillis?.() || it.paidAt || fallback),
                 reQueuedAt: serverTimestamp(),
                 updatedAt: serverTimestamp() 
              });
           }
        });

        // 📣 [ONESIGNAL-STRIKE] Notify student they are bumped to next batch
        if (data.userId) {
            const missedItem = (data.items || []).find((it: any) => it.status === 'READY' || it.status === 'COLLECTING');
            notifyOrderUpdate(data.userId, 'MISSED', missedItem?.name || 'Item');
        }

      }
      updatedCount++;
    }

    if (updatedCount > 0) {
      await masterBatch.commit();
      console.log(`⚡ [SONIC-SYNC] Re-queued ${updatedCount} orders atomically.`);
      // Pulse will happen on next heartbeat naturally
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

/**
 * 🐕 [WATCHDOG] Self-Healing Maintenance Cycle
 */
export const runMaintenanceCycle = async (nodeId: string): Promise<{ restored: number }> => {
  const isLeader = await tryAcquireMaintenanceLock(nodeId);
  if (!isLeader) return { restored: 0 };
  
  console.log("🛠️ [WATCHDOG] Acquired lock. Running maintenance...");
  let restored = 0;
  
  try {
    // 1. Recover Stuck Batches (PREPARING > 120s with no interaction)
    await runKitchenWatchdog();
    
    // 2. Aggressive Batch Generator Pulse
    await runBatchGenerator(nodeId);
    
    // 3. Periodic flush of missed pickups (Abandoned ready food)
    const flushedCount = await flushMissedPickups(nodeId);
    if (flushedCount > 0) {
       console.log(`🛠️ [WATCHDOG] Flushed ${flushedCount} missed pickups.`);
       restored += flushedCount;
    }
    
    return { restored };
  } catch (error) {
    console.error("❌ [WATCHDOG] Maintenance failed:", error);
    return { restored: 0 };
  }
};

