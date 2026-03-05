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
  ServeLog,
  TransactionRecord,
  DailyReport,
  OrderStatus,
  QRStatus
} from "../types";
import { DEFAULT_FOOD_IMAGE, INITIAL_MENU } from "../constants";
import { parseQRPayload, verifySecureHash, verifySecureHashSync, generateQRPayload, generateQRPayloadSync, isQRExpired } from "./qr";
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
  cafeteriaId: order.cafeteriaId,
  confirmedBy: order.confirmedBy || null,
  confirmedAt: order.confirmedAt ? Timestamp.fromMillis(order.confirmedAt) : null,
  rejectedBy: order.rejectedBy || null,
  rejectedAt: order.rejectedAt ? Timestamp.fromMillis(order.rejectedAt) : null
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
    cafeteriaId: data.cafeteriaId,
    confirmedBy: data.confirmedBy,
    confirmedAt: toMillis(data.confirmedAt),
    rejectedBy: data.rejectedBy,
    rejectedAt: toMillis(data.rejectedAt)
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
      
      // Also initialize inventory for menu items
      const inventoryBatch = writeBatch(db);
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
      });
      await inventoryBatch.commit();
      console.log("✅ Inventory initialized for menu items");
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
  try {
    const invRef = doc(db, "inventory", itemId);
    const invSnap = await getDoc(invRef);
    
    if (invSnap.exists()) {
      await updateDoc(invRef, {
        ...data,
        lastUpdated: serverTimestamp()
      });
    } else {
      // Create inventory item if it doesn't exist
      await setDoc(invRef, {
        itemId,
        itemName: data.itemName || '',
        openingStock: data.openingStock || 0,
        consumed: data.consumed || 0,
        category: data.category || '',
        lastUpdated: serverTimestamp()
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
      announcement: "JOE: New Indian Breakfast Catalog is now LIVE!",
      taxRate: 5,
      minOrderValue: 20,
      peakHourThreshold: 50,
      autoSettlementEnabled: true
    };
  }
};

export const updateSettings = async (updates: Partial<SystemSettings>): Promise<void> => {
  try {
    const settingsRef = doc(db, "settings", "global");
    await updateDoc(settingsRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // If settings don't exist, create them
    if (error instanceof Error && error.message.includes("No document")) {
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
        // Return defaults
        callback({
          isMaintenanceMode: false,
          acceptingOrders: true,
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
        announcement: "JOE: New Indian Breakfast Catalog is now LIVE!",
        taxRate: 5,
        minOrderValue: 20,
        peakHourThreshold: 50,
        autoSettlementEnabled: true
      });
    }
  );
};

// ============================================================================
// 4. ORDERING SYSTEM (REAL-TIME)
// ============================================================================

export const createOrder = async (orderData: Omit<Order, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const id = 'order_' + Math.random().toString(36).substr(2, 9);
    const createdAt = Date.now();
    const itemsWithQty = orderData.items.map(item => ({
      ...item,
      servedQty: 0,
      remainingQty: item.quantity
    }));
    
    const newOrder: Order = {
      ...orderData,
      items: itemsWithQty,
      id,
      createdAt,
      orderStatus: 'PENDING'
    } as Order;

    // If payment is already SUCCESS, attach QR now
    if (newOrder.paymentStatus === 'SUCCESS') {
      newOrder.qrStatus = 'ACTIVE';
      const token = generateQRPayloadSync(newOrder);
      newOrder.qr = { token, status: 'ACTIVE', createdAt };
    }

    await setDoc(doc(db, "orders", id), orderToFirestore(newOrder));
    console.log('✅ Order created in Firestore:', id);
    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (e) {
      // optional cache clear
    }
    return id;
  } catch (error: any) {
    // Enhanced error handling for network failures
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      // Network error - order may still be created (Firestore offline persistence)
      // Log warning but don't fail - let Firestore retry
      console.warn("Network error during order creation (order may be queued):", error);
      // Return order ID optimistically - Firestore will sync when online
      const id = 'order_' + Math.random().toString(36).substr(2, 9);
      return id;
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

export const confirmCashPayment = async (orderId: string, cashierUid: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }
      const orderData = orderSnap.data();
      if (orderData.paymentStatus === 'SUCCESS') {
        throw new Error("Order already confirmed");
      }
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
        qr: {
          token,
          status: 'ACTIVE',
          createdAt: serverTimestamp()
        },
        confirmedBy: cashierUid,
        confirmedAt: serverTimestamp()
      });
    });
    console.log('✅ Cash payment confirmed:', orderId);
    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (e) {
      // optional
    }
  } catch (error) {
    console.error("Error confirming cash payment:", error);
    throw error;
  }
};

export const rejectCashPayment = async (orderId: string, cashierUid: string): Promise<void> => {
  try {
    const orderRef = doc(db, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }
      const orderData = orderSnap.data();
      if (orderData.paymentStatus !== 'PENDING') {
        throw new Error("ALREADY_PROCESSED");
      }

      tx.update(orderRef, {
        paymentStatus: 'REJECTED',
        orderStatus: 'CANCELLED',
        rejectedAt: serverTimestamp(),
        rejectedBy: cashierUid,
        qrStatus: 'REJECTED'
      });
    });
    console.log('✅ Cash payment rejected:', orderId);
    try {
      const { invalidateReportsCache } = await import('./reporting');
      invalidateReportsCache();
    } catch (e) {
      // optional
    }
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

export const validateQRForServing = async (qrDataRaw: string): Promise<Order> => {
  let payload;
  try {
    if (typeof qrDataRaw === 'string') {
      payload = JSON.parse(qrDataRaw);
    } else {
      payload = qrDataRaw;
    }
  } catch {
    const parsed = parseQRPayload(qrDataRaw);
    if (!parsed) {
      throw new Error("Invalid Token Format - Cannot parse QR data");
    }
    payload = parsed;
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error("Invalid Token Format - Invalid payload structure");
  }

  const { orderId, userId, cafeteriaId, secureHash, expiresAt, createdAt } = payload;

  if (!orderId || !userId || !cafeteriaId || !secureHash) {
    throw new Error("Invalid Token Format - Missing required fields");
  }

  // Check expiry FIRST (fail fast)
  if (expiresAt && Date.now() > expiresAt) {
    throw new Error("QR_CODE_EXPIRED - This QR code has expired. Please request a new one.");
  }

  // Fetch order with retry logic for network errors
  let orderDoc;
  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      orderDoc = await getDoc(doc(db, "orders", orderId));
      break; // Success, exit retry loop
    } catch (networkError: any) {
      retries++;
      if (retries >= maxRetries) {
        console.error('❌ Network error fetching order after', maxRetries, 'retries:', networkError);
        throw new Error(`Network Error - Failed to fetch order. Please check your internet connection and try again. Order ID: ${orderId}`);
      }
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
      console.warn(`⚠️ Network error fetching order, retry ${retries}/${maxRetries}...`);
    }
  }
  
  if (!orderDoc || !orderDoc.exists()) {
    throw new Error(`Order not found: ${orderId}. Please ensure the order exists and payment is confirmed.`);
  }

  const order = firestoreToOrder(orderDoc.id, orderDoc.data());

  // Use order's createdAt if payload doesn't have it (legacy QR codes)
  const qrCreatedAt = createdAt || order.createdAt;
  const qrExpiresAt = expiresAt || (qrCreatedAt + (24 * 60 * 60 * 1000)); // Default 24h if not specified

  // Verify signature (async HMAC-SHA256)
  const isValid = await verifySecureHash(
    orderId, 
    userId, 
    cafeteriaId, 
    qrCreatedAt,
    qrExpiresAt,
    secureHash
  );

  if (!isValid) {
    // Fallback to sync verification for legacy QR codes
    const isValidSync = verifySecureHashSync(
      orderId, 
      userId, 
      cafeteriaId, 
      qrCreatedAt,
      qrExpiresAt,
      secureHash
    );
    
    if (!isValidSync) {
      throw new Error("Invalid Token Signature - Hash verification failed");
    }
  }

  if (order.paymentStatus !== 'SUCCESS') {
    throw new Error("PAYMENT_NOT_VERIFIED");
  }

  if (order.qrStatus === 'USED') {
    throw new Error("TOKEN_ALREADY_USED - This QR code has already been scanned.");
  }

  if (order.qrStatus === 'EXPIRED') {
    throw new Error("QR_CODE_EXPIRED - This QR code has expired.");
  }

  if (order.qrStatus !== 'ACTIVE') {
    throw new Error("QR_NOT_ACTIVE");
  }

  if (order.orderStatus === 'COMPLETED') {
    throw new Error("Order Already Completed");
  }

  // Update order to USED and ACTIVE
  const itemsWithQty = order.items.map(item => ({
    ...item,
    servedQty: item.servedQty || 0,
    remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity
  }));

  await updateDoc(doc(db, "orders", orderId), {
    qrStatus: 'USED',
    orderStatus: 'ACTIVE',
    scannedAt: serverTimestamp(),
    items: itemsWithQty.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      costPrice: item.costPrice,
      category: item.category,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      servedQty: item.servedQty || 0,
      remainingQty: item.remainingQty !== undefined ? item.remainingQty : item.quantity
    }))
  });

  // Log scan
  await setDoc(doc(collection(db, "scanLogs")), {
    orderId,
    userId: order.userId,
    userName: order.userName,
    scannedBy: 'server',
    scanTime: serverTimestamp(),
    scanResult: 'SUCCESS',
    totalAmount: order.totalAmount
  });

  return {
    ...order,
    qrStatus: 'USED' as QRStatus,
    orderStatus: 'ACTIVE' as OrderStatus,
    items: itemsWithQty,
    scannedAt: Date.now()
  };
};

export const serveItem = async (orderId: string, itemId: string, servedBy: string): Promise<void> => {
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

    if (!verifySecureHash(orderId, userId, cafeteriaId, order.createdAt, secureHash)) {
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
