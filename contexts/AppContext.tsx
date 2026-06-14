import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  MenuItem, Order, WalletTransaction, WalletRechargeRequest, SystemSettings, StaffRole, PortalMode, OrderStatus, 
  Quest, RewardItem, RedeemedReward, LeaderboardUser, UserProfile, CartItem 
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { 
  doc, setDoc, updateDoc, collection, query, where, orderBy, limit, onSnapshot, increment, arrayUnion, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { getMenuOnce, listenToMenu, listenToSettings, updateSettings } from '../services/firestore-db';
import { deductWalletForOrder, submitRechargeRequest, approveRechargeRequest, rejectRechargeRequest, listenToWalletSummary } from '../services/wallet';
import { signOut as fbSignOut } from '../services/auth';
import { joeSounds } from '../utils/audio';
import { triggerOneSignalWebhook, triggerRolePush } from '../services/onesignal-webhook';

const DEFAULT_QUESTS: Quest[] = [
  {
    id: 'q_1',
    title: 'The Ramen Run',
    description: '3 bowls of Ramen after 8PM',
    points: 500,
    progress: 0,
    target: 3,
    type: 'ACTIVE',
    endsIn: '04:12:08',
    badge: 'restaurant'
  },
  {
    id: 'q_2',
    title: 'Green Week',
    description: 'Order 5 healthy Salads',
    points: 1000,
    progress: 0,
    target: 5,
    type: 'ACTIVE',
    endsIn: '5 Days',
    badge: 'eco',
    badgeColor: 'RARE BADGE'
  },
  {
    id: 'q_3',
    title: 'Caffeine Spike',
    description: 'Unlocked Dec 12',
    points: 200,
    progress: 5,
    target: 5,
    type: 'ARCHIVED',
    completedAt: 'Dec 12',
    badge: 'local_cafe'
  },
  {
    id: 'q_4',
    title: 'Late Night Legend',
    description: 'Unlocked Dec 10',
    points: 1000,
    progress: 3,
    target: 3,
    type: 'ARCHIVED',
    completedAt: 'Dec 10',
    badge: 'nightlight'
  }
];

export const INITIAL_REWARD_ITEMS: RewardItem[] = [
  {
    id: 'rew_1',
    name: 'Free Coffee',
    description: 'Any size, any blend. Freshly roasted daily.',
    pointsCost: 500,
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&auto=format&fit=crop&q=60',
    badge: 'POPULAR',
    category: 'DRINKS'
  },
  {
    id: 'rew_2',
    name: '20% Off Meal',
    description: 'Valid for any main course in the main hall.',
    pointsCost: 800,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60',
    category: 'MEALS'
  },
  {
    id: 'rew_3',
    name: 'Limited Edition Sticker',
    description: 'Holographic finish, JOE Season 1 design.',
    pointsCost: 200,
    image: 'https://images.unsplash.com/photo-1572375995501-4b0894dbe057?w=400&auto=format&fit=crop&q=60',
    badge: 'RARE',
    category: 'EXCLUSIVE'
  },
  {
    id: 'rew_4',
    name: 'Skip the Line Pass',
    description: 'Instant priority for your next 3 orders.',
    pointsCost: 1500,
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&auto=format&fit=crop&q=60',
    category: 'EXCLUSIVE'
  }
];

interface AppContextType {
  // Navigation & Identity
  portalMode: PortalMode;
  setPortalMode: (mode: PortalMode) => void;
  studentTab: 'HOME' | 'ORDERS' | 'WALLET' | 'COMPLIANCE' | 'TRACKING' | 'QUESTS' | 'RANK' | 'STORE' | 'VAULT' | 'PROFILE';
  setStudentTab: (tab: 'HOME' | 'ORDERS' | 'WALLET' | 'COMPLIANCE' | 'TRACKING' | 'QUESTS' | 'RANK' | 'STORE' | 'VAULT' | 'PROFILE') => void;
  isStaffLoggedIn: boolean;
  setIsStaffLoggedIn: (v: boolean) => void;
  staffRole: StaffRole;
  setStaffRole: (role: StaffRole) => void;
  
  // Student Context
  isLoggedIn: boolean;
  isGuest: boolean;
  studentName: string;
  studentEmail: string;
  walletBalance: number;
  handleStudentLogout: () => void;
  
  // Menu & Catalog
  menuItems: MenuItem[];
  
  // Cart
  cart: { id: string; quantity: number }[];
  addToCart: (itemId: string) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  
  // Orders State & Processing
  orders: Order[];
  activeOrderTrackId: string | null;
  setActiveOrderTrackId: (id: string | null) => void;
  placeOrder: (paymentMethod: 'WALLET' | 'CASH', appliedDiscountAmount?: number, discountDetail?: string) => Promise<{ success: boolean; error?: string; orderId?: string }>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  
  // Recharge Terminal
  rechargeRequests: WalletRechargeRequest[];
  submitRechargeRequest: (amount: number, utr: string) => Promise<void>;
  approveRecharge: (requestId: string) => Promise<void>;
  rejectRecharge: (requestId: string, reason: string) => Promise<void>;
  walletTransactions: WalletTransaction[];
  
  // Global Setup & Configs
  settings: SystemSettings;
  updateSettings: (s: SystemSettings) => void;

  // Gamification & Loyalty States
  studentPoints: number;
  studentXp: number;
  studentLevel: number;
  quests: Quest[];
  updateQuestProgress: (id: string, amount: number) => Promise<void>;
  redeemedRewards: RedeemedReward[];
  redeemReward: (rewardId: string) => Promise<{ success: boolean; error?: string; reward?: RedeemedReward }>;
  useRedeemedReward: (id: string) => Promise<void>;
  
  // Custom High-Frequency Canteen Gamification
  magicBoxProgress: number;
  claimMagicBox: () => Promise<{ success: boolean; rewardName: string; discountCode: string; discountPercent: number; description: string }>;
  leaderboardUsers: LeaderboardUser[];
  purchaseCustomization: (type: 'title' | 'frame' | 'decoration', value: string, cost: number) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading: authLoading } = useAuth();

  // --- Portal & Routing Modes ---
  const [portalMode, setPortalModeState] = useState<PortalMode>(() => {
    return (localStorage.getItem('joe_portal_mode') as PortalMode) || 'STUDENT';
  });
  const [studentTab, setStudentTabState] = useState<'HOME' | 'ORDERS' | 'WALLET' | 'COMPLIANCE' | 'TRACKING' | 'QUESTS' | 'RANK' | 'STORE' | 'VAULT' | 'PROFILE'>('HOME');
  const [isStaffLoggedIn, setIsStaffLoggedInState] = useState<boolean>(() => {
    return localStorage.getItem('joe_staff_logged_in') === 'true';
  });
  const [staffRole, setStaffRoleState] = useState<StaffRole>(() => {
    return (localStorage.getItem('joe_staff_role') as StaffRole) || 'CASHIER';
  });

  // --- Student Identity ---
  const isLoggedIn = !!user;
  const isGuest = profile?.role === 'GUEST';
  const studentName = profile?.name || 'Guest Student';
  const studentEmail = profile?.email || '';
  const walletBalance = profile?.walletBalance || 0;

  // Gamification States (Sync dynamically from Firestore profile, fallback locally for guest)
  const [guestPoints, setGuestPoints] = useState(0);
  const [guestXp, setGuestXp] = useState(0);
  const [guestLevel, setGuestLevel] = useState(1);
  const [guestMagicBoxProgress, setGuestMagicBoxProgress] = useState(1);
  const [guestQuests, setGuestQuests] = useState<Quest[]>(DEFAULT_QUESTS);
  const [guestRedeemedRewards, setGuestRedeemedRewards] = useState<RedeemedReward[]>([]);

  const studentPoints = isGuest ? guestPoints : (profile?.points || 0);
  const studentXp = isGuest ? guestXp : (profile?.xp || 0);
  const studentLevel = isGuest ? guestLevel : (profile?.level || 1);
  const magicBoxProgress = isGuest ? guestMagicBoxProgress : (profile?.magicBoxProgress || 1);
  const quests = useMemo(() => isGuest ? guestQuests : (profile?.quests || DEFAULT_QUESTS), [isGuest, guestQuests, profile?.quests]);
  const redeemedRewards = useMemo(() => isGuest ? guestRedeemedRewards : (profile?.redeemedRewards || []), [isGuest, guestRedeemedRewards, profile?.redeemedRewards]);

  // --- Core Catalogs & Settings ---
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [settings, setSettingsState] = useState<SystemSettings>({
    systemEnabled: true,
    upiId: 'fcgtub@okicici',
    upiQrCode: '/upi-qr.jpg',
    lowBalanceThreshold: 30,
    pilotNotification: 'Prepaid ordering enabled for campus.',
    maintenanceMode: false,
    orderFlowAccepting: true,
    orderingFailSafe: true,
    autoDailySettlement: true,
    taxRate: 0,
    minOrderValue: 0,
    peakHourThreshold: 50
  });

  // --- Operational States ---
  const [cart, setCart] = useState<{ id: string; quantity: number }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<WalletRechargeRequest[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [activeOrderTrackId, setActiveOrderTrackId] = useState<string | null>(null);
  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>([]);

  // Sync state options to localStorage
  useEffect(() => {
    localStorage.setItem('joe_portal_mode', portalMode);
  }, [portalMode]);

  useEffect(() => {
    localStorage.setItem('joe_staff_logged_in', String(isStaffLoggedIn));
    localStorage.setItem('joe_staff_role', staffRole);
  }, [isStaffLoggedIn, staffRole]);

  // Sync menuItems in real-time
  useEffect(() => {
    return listenToMenu(setMenuItems);
  }, []);

  // Auto-seed missing menu item BKT11 to Firestore on admin login
  useEffect(() => {
    const isAdmin = user?.email && (user.email === 'admin@joe.com' || user.email === 'admin@joecafe.com' || user.email.startsWith('admin@'));
    if (isAdmin && menuItems.length > 0 && !menuItems.some(it => it.id === 'BKT11')) {
      const seedBKT11 = async () => {
        try {
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
          const item = {
            id: 'BKT11',
            name: '2 Idli + 2 Mirchi',
            price: 35,
            costPrice: 14,
            category: 'Breakfast',
            imageUrl: '/assets/menu/idli_mirchi.jpg',
            active: true
          };
          await setDoc(doc(db, "menu", "BKT11"), item);
          
          await setDoc(doc(db, "inventory", "BKT11"), {
            itemId: 'BKT11',
            itemName: '2 Idli + 2 Mirchi',
            openingStock: 100,
            consumed: 0,
            category: 'Breakfast',
            lastUpdated: serverTimestamp()
          });

          await setDoc(doc(db, "inventory_meta", "BKT11"), {
            consumed: 0,
            updatedAt: Date.now()
          });

          console.log("🚀 [AUTO-SEED]: Successfully seeded BKT11 to Firestore menu, inventory & inventory_meta");
        } catch (err) {
          console.error("❌ [AUTO-SEED]: Failed to seed BKT11:", err);
        }
      };
      seedBKT11();
    }
  }, [user, menuItems]);

  // Sync Settings in real-time
  useEffect(() => {
    return listenToSettings((newSettings) => {
      if (newSettings) {
        setSettingsState({
          systemEnabled: !newSettings.isMaintenanceMode,
          upiId: 'fcgtub@okicici',
          upiQrCode: '/upi-qr.jpg',
          lowBalanceThreshold: 30,
          pilotNotification: newSettings.announcement,
          maintenanceMode: newSettings.isMaintenanceMode,
          orderFlowAccepting: newSettings.acceptingOrders,
          orderingFailSafe: newSettings.orderingEnabled,
          autoDailySettlement: newSettings.autoSettlementEnabled,
          taxRate: newSettings.taxRate || 0,
          minOrderValue: newSettings.minOrderValue || 0,
          peakHourThreshold: newSettings.peakHourThreshold || 50
        });
      }
    });
  }, []);

  // Sync Orders in real-time
  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    const q = (profile?.role === 'ADMIN' || profile?.role === 'CASHIER' || profile?.role === 'SERVER' || profile?.role === 'COOK' || profile?.role === 'ASSISTANT_SUPERVISOR')
      ? query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(100))
      : query(collection(db, "orders"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(20));

    return onSnapshot(
      q,
      (snapshot) => {
        // Sort snapshot docs by createdAt ascending to compute daily sequential token
        const sortedDocs = [...snapshot.docs].sort((a, b) => {
          const aData = a.data();
          const bData = b.data();
          const aTime = aData.createdAt?.toMillis?.() ?? (typeof aData.createdAt === 'number' ? aData.createdAt : 0);
          const bTime = bData.createdAt?.toMillis?.() ?? (typeof bData.createdAt === 'number' ? bData.createdAt : 0);
          return aTime - bTime;
        });

        // Group by calendar day (local time) to calculate sequential index starting from 1
        const dayCounts: Record<string, number> = {};
        const orderIdToTokenNum: Record<string, string> = {};

        sortedDocs.forEach(doc => {
          const d = doc.data();
          const toMs = (ts: any) => ts?.toMillis?.() ?? (typeof ts === 'number' ? ts : Date.now());
          const time = toMs(d.createdAt);
          const dateStr = new Date(time).toLocaleDateString('en-US'); // e.g. "6/13/2026"

          if (!dayCounts[dateStr]) {
            dayCounts[dateStr] = 0;
          }
          dayCounts[dateStr]++;
          orderIdToTokenNum[doc.id] = dayCounts[dateStr].toString();
        });

        const list = snapshot.docs.map(doc => {
          const d = doc.data();
          const toMs = (ts: any) => ts?.toMillis?.() ?? (typeof ts === 'number' ? ts : Date.now());
          return {
            id: doc.id,
            userId: d.userId,
            userName: d.userName || 'Student',
            items: d.items || [],
            totalAmount: d.totalAmount,
            paymentType: d.paymentType,
            paymentStatus: d.paymentStatus,
            orderStatus: d.orderStatus || 'PENDING',
            qrStatus: d.qrStatus || 'PENDING',
            tokenNumber: orderIdToTokenNum[doc.id] || '0',
            createdAt: toMs(d.createdAt),
            status: d.orderStatus === 'COMPLETED' || d.orderStatus === 'SERVED' ? 'SERVED' : d.orderStatus
          } as any;
        });
        setOrders(list);
      },
      (error) => {
        console.warn(`[AppContext:orders] Listener error: ${error.message}`);
      }
    );
  }, [user, profile?.role]);

  // Sync Recharge Requests & Transactions
  useEffect(() => {
    if (!user) {
      setRechargeRequests([]);
      setWalletTransactions([]);
      return;
    }
    const isStaff = ['ADMIN', 'CASHIER', 'SERVER', 'COOK', 'ASSISTANT_SUPERVISOR'].includes(profile?.role || '');
    const qRecharges = isStaff
      ? query(collection(db, "wallet_recharge_requests"), orderBy("createdAt", "desc"), limit(100))
      : query(collection(db, "wallet_recharge_requests"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(20));

    const unsubRecharges = onSnapshot(
      qRecharges,
      (snap) => {
        const list = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            uid: d.uid,
            studentName: d.studentName || 'Student',
            amount: d.amount || 0,
            screenshotUrl: d.screenshotUrl || '',
            status: d.status || 'pending',
            createdAt: d.createdAt?.toMillis?.() || Date.now(),
            rejectionNote: d.rejectionNote || undefined
          } as WalletRechargeRequest;
        });
        setRechargeRequests(list);
      },
      (error) => {
        console.warn(`[AppContext:recharges] Listener error: ${error.message}`);
      }
    );

    const qTransactions = query(collection(db, "wallet_transactions"), where("uid", "==", user.uid), orderBy("createdAt", "desc"), limit(20));
    const unsubTransactions = onSnapshot(
      qTransactions,
      (snap) => {
        const list = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            type: d.type,
            amount: d.amount || 0,
            description: d.reason === 'wallet_recharge' ? 'Wallet Refill (Approved)' : 'Order Payment Deduction',
            timestamp: new Date(d.createdAt?.toMillis?.() || Date.now()).toLocaleString(),
            balanceAfter: d.balanceAfter || 0
          } as any;
        });
        setWalletTransactions(list);
      },
      (error) => {
        console.warn(`[AppContext:transactions] Listener error: ${error.message}`);
      }
    );

    return () => {
      unsubRecharges();
      unsubTransactions();
    };
  }, [user, profile?.role]);

  // Sync Leaderboard in real-time — only while authenticated
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users"), orderBy("points", "desc"), limit(10));
    return onSnapshot(
      q,
      (snap) => {
        const users = snap.docs.map((doc, idx) => {
          const data = doc.data();
          return {
            name: data.name || 'Student',
            points: data.points || 0,
            level: data.level || 1,
            avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(data.name || 'Student')}`,
            title: data.customTitle || ((data.level || 1) >= 18 ? 'Chai Emperor' : (data.level || 1) >= 12 ? 'Pro Foodie' : 'Rising Star'),
            frameColor: data.customFrameColor || '',
            avatarDecoration: data.customAvatarDecoration || '',
            frequency: data.frequency || 0,
            isCurrentUser: doc.id === user.uid,
            rank: idx + 1
          };
        });
        setLeaderboardUsers(users);
      },
      (error: any) => {
        // permission-denied is expected after sign-out — suppress silently
        if (error?.code === 'permission-denied') return;
        console.warn(`[AppContext:leaderboard] Listener error: ${error.message}`);
      }
    );
  }, [user]);

  // --- Cart Actions ---
  const addToCart = (itemId: string) => {
    const item = menuItems.find(m => m.id === itemId);
    if (!item) return;

    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (existing) {
        if (existing.quantity >= 3) return prev;
        return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { id: itemId, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.id !== itemId);
      return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const clearCart = () => setCart([]);

  const getCartTotal = () => {
    return cart.reduce((total, c) => {
      const item = menuItems.find(m => m.id === c.id);
      return total + (item ? item.price * c.quantity : 0);
    }, 0);
  };

  // --- Checkout Action ---
  const placeOrder = async (paymentMethod: 'WALLET' | 'CASH', appliedDiscountAmount: number = 0, discountDetail?: string) => {
    if (paymentMethod === 'CASH') {
      return { success: false, error: 'Cash orders are disabled. Please pay online via your Prepaid Wallet.' };
    }
    if (!user) return { success: false, error: 'User is not logged in.' };
    const subtotal = getCartTotal();
    if (subtotal <= 0) return { success: false, error: 'Your cart is empty' };

    const total = parseFloat(Math.max(0, subtotal - appliedDiscountAmount).toFixed(2));

    // Calculate loyalty points and XP based on user order frequency
    const currentFrequency = profile?.frequency || 0;
    let earningMultiplier = 1.0;
    if (currentFrequency >= 10) {
      earningMultiplier = 1.5;
    } else if (currentFrequency >= 4) {
      earningMultiplier = 1.2;
    }
    const orderedPoints = Math.round(total * 10 * earningMultiplier);
    const orderedXp = Math.round(total * 6 * earningMultiplier);

    const activeAttemptKey = 'attempt_' + Math.random().toString(36).substr(2, 9);
    const optimisticOrderId = 'order_' + Math.random().toString(36).substr(2, 9);

    const orderItems = cart.map(c => {
      const item = menuItems.find(m => m.id === c.id)!;
      return {
        id: c.id,
        name: item.name,
        price: item.price,
        costPrice: item.costPrice || 0,
        category: item.category,
        imageUrl: item.imageUrl || '',
        quantity: c.quantity,
        servedQty: 0,
        remainingQty: c.quantity,
        status: 'PENDING'
      };
    });

    const isGoogleUser = !isGuest;
    const randTokenNum = Math.floor(100 + Math.random() * 900).toString();

    try {
      if (paymentMethod === 'WALLET') {
        // 1. Deduct wallet balance atomically
        const { transactionId } = await deductWalletForOrder(user.uid, total, optimisticOrderId);

        // 2. Build order payload
        const orderPayload = {
          id: optimisticOrderId,
          userId: user.uid,
          userName: studentName,
          items: orderItems,
          totalAmount: total,
          paymentType: 'WALLET' as any,
          paymentStatus: 'SUCCESS',
          queueStatus: 'NOT_IN_QUEUE',
          orderStatus: 'PENDING',
          qrStatus: 'ACTIVE',
          cafeteriaId: 'MAIN_CAFE',
          idempotencyKey: activeAttemptKey,
          walletTransactionId: transactionId,
          createdAt: Date.now(),
          isEscrowed: false,
          orderedPoints: orderedPoints,
          orderedXp: orderedXp
        };

        // Commit order in background
        const { createOrder: fbCreateOrder } = await import('../services/firestore-db');
        await fbCreateOrder(orderPayload as any);
      } else {
        // CASH Payment option
        const orderPayload = {
          id: optimisticOrderId,
          userId: user.uid,
          userName: studentName,
          items: orderItems,
          totalAmount: total,
          paymentType: 'CASH' as any,
          paymentStatus: 'AWAITING_CONFIRMATION',
          queueStatus: 'NOT_IN_QUEUE',
          orderStatus: 'PENDING',
          qrStatus: 'PENDING_PAYMENT',
          cashRequestedAt: serverTimestamp(),
          cafeteriaId: 'MAIN_CAFE',
          idempotencyKey: activeAttemptKey,
          createdAt: Date.now(),
          isEscrowed: true,
          orderedPoints: orderedPoints,
          orderedXp: orderedXp
        };

        const { createOrder: fbCreateOrder } = await import('../services/firestore-db');
        await fbCreateOrder(orderPayload as any);
      }

      // Award Gamification Points & XP (or hold in escrow for CASH orders)
      if (isGuest) {
        setGuestPoints(p => p + orderedPoints);
        setGuestXp(x => {
          const nextX = x + orderedXp;
          if (nextX >= 1000) {
            setGuestLevel(lvl => lvl + 1);
            return nextX - 1000;
          }
          return nextX;
        });
        setGuestMagicBoxProgress(prev => Math.min(3, prev + 1));
      } else {
        // WALLET checkouts get their points instantly
        const nextXp = studentXp + orderedXp;
        const levelUp = nextXp >= 1000;
        const nextLevel = levelUp ? studentLevel + 1 : studentLevel;
        const remainingXp = levelUp ? nextXp - 1000 : nextXp;
        const nextMagicBoxProgress = Math.min(3, magicBoxProgress + 1);

        await updateDoc(doc(db, "users", user.uid), {
          points: increment(orderedPoints),
          xp: remainingXp,
          level: nextLevel,
          magicBoxProgress: nextMagicBoxProgress,
          frequency: increment(1)
        });
      }

      // Check Quests progression
      const hasRamen = orderItems.some(it => it.id === 'BKT10' || it.name.toLowerCase().includes('ramen'));
      const hasSalad = orderItems.some(it => it.id === 'LCH02' || it.name.toLowerCase().includes('salad'));

      if (hasRamen || hasSalad) {
        const updatedQuests = quests.map(q => {
          if (q.id === 'q_1' && hasRamen && q.progress < q.target) {
            const nextP = q.progress + 1;
            if (nextP === q.target) {
              if (isGuest) setGuestPoints(p => p + q.points);
              else updateDoc(doc(db, "users", user.uid), { points: increment(q.points) });
              return { ...q, progress: nextP, type: 'ARCHIVED' as const, completedAt: new Date().toLocaleDateString() };
            }
            return { ...q, progress: nextP };
          }
          if (q.id === 'q_2' && hasSalad && q.progress < q.target) {
            const nextP = q.progress + 1;
            if (nextP === q.target) {
              if (isGuest) setGuestPoints(p => p + q.points);
              else updateDoc(doc(db, "users", user.uid), { points: increment(q.points) });
              return { ...q, progress: nextP, type: 'ARCHIVED' as const, completedAt: new Date().toLocaleDateString() };
            }
            return { ...q, progress: nextP };
          }
          return q;
        });

        if (isGuest) setGuestQuests(updatedQuests);
        else await updateDoc(doc(db, "users", user.uid), { quests: updatedQuests });
      }

      setCart([]);
      setActiveOrderTrackId(optimisticOrderId);
      setStudentTab('TRACKING');

      // ─── PUSH NOTIFICATIONS: Order Placed ─────────────────────────────
      // 1. Confirm order receipt to the student (works even if they leave the browser)
      const itemSummary = orderItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const tokenLabel = randTokenNum;
      triggerOneSignalWebhook(
        user.uid,
        '🎉 Order Received!',
        `Token #${tokenLabel}: ${itemSummary}. Your QR is ready.`,
      ).catch(() => {});

      // 2. Alert ALL supervisors about the new order (tag-based broadcast)
      triggerRolePush(
        'assistant_supervisor',
        '🔔 New Order Arrived!',
        `Token #${tokenLabel} — ${itemSummary} (₹${total})`,
      ).catch(() => {});
      // ──────────────────────────────────────────────────────────────────

      return { success: true, orderId: optimisticOrderId };
    } catch (err: any) {
      console.error('[WALLET-ORDER] Checkout error:', err);
      return { success: false, error: err.message || 'Payment processing failed.' };
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { orderStatus: status });
    } catch (err) {
      console.error('[ORDER] Status update failed:', err);
    }
  };

  // --- Recharge Request Actions ---
  const submitRecharge = async (amount: number, utr: string) => {
    if (!user) return;
    const screenshotMockUrl = 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400&auto=format&fit=crop&q=60';
    await submitRechargeRequest(user.uid, studentName, amount, screenshotMockUrl);
  };

  const approveRecharge = async (requestId: string) => {
    await approveRechargeRequest(requestId, studentName);
  };

  const rejectRecharge = async (requestId: string, reason: string) => {
    await rejectRechargeRequest(requestId, studentName, reason);
  };

  // --- Gamification Actions ---
  const updateQuestProgress = async (id: string, amount: number) => {
    const updated = quests.map(q => {
      if (q.id === id) {
        const nextP = Math.min(q.target, q.progress + amount);
        if (nextP === q.target && q.type === 'ACTIVE') {
          if (isGuest) setGuestPoints(p => p + q.points);
          else updateDoc(doc(db, "users", user.uid), { points: increment(q.points) });
          return { ...q, progress: nextP, type: 'ARCHIVED' as const, completedAt: new Date().toLocaleDateString() };
        }
        return { ...q, progress: nextP };
      }
      return q;
    });

    if (isGuest) setGuestQuests(updated);
    else await updateDoc(doc(db, "users", user.uid), { quests: updated });
  };

  const redeemReward = async (rewardId: string) => {
    const item = INITIAL_REWARD_ITEMS.find(r => r.id === rewardId);
    if (!item) return { success: false, error: 'Reward item not found' };

    if (studentPoints < item.pointsCost) {
      return { success: false, error: `Inadequate points. Requires ${item.pointsCost} PTS` };
    }

    const randCode = item.name.replace(/\s+/g, '').toUpperCase().substring(0, 6) + '-' + Math.floor(1000 + Math.random() * 9000);
    const newRedemption: RedeemedReward = {
      id: 'red_' + Math.random().toString(36).substr(2, 9),
      rewardId,
      name: item.name,
      pointsCost: item.pointsCost,
      timestamp: new Date().toLocaleString(),
      code: randCode,
      status: 'ACTIVE'
    };

    const nextRedeemed = [newRedemption, ...redeemedRewards];

    if (isGuest) {
      setGuestPoints(prev => prev - item.pointsCost);
      setGuestRedeemedRewards(nextRedeemed);
    } else {
      await updateDoc(doc(db, "users", user.uid), {
        points: increment(-item.pointsCost),
        redeemedRewards: nextRedeemed
      });
    }

    return { success: true, reward: newRedemption };
  };

  const useRedeemedReward = async (id: string) => {
    const updated = redeemedRewards.map(r => r.id === id ? { ...r, status: 'USED' as const } : r);
    if (isGuest) setGuestRedeemedRewards(updated);
    else await updateDoc(doc(db, "users", user.uid), { redeemedRewards: updated });
  };

  const claimMagicBox = async () => {
    if (magicBoxProgress < 3) {
      return { success: false, rewardName: '', discountCode: '', discountPercent: 0, description: 'Loot Box is still loading frequency triggers!' };
    }

    const potentialRewards = [
      { name: 'Masala Chai 50% Off Coupon', percent: 50, desc: 'Enjoy hot steaming Masala Chai at exactly 50% discount!' },
      { name: 'Filter Coffee 40% Off Coupon', percent: 40, desc: 'Authentic Filter Coffee at 40% Off!' },
      { name: 'Samosa 30% Off Coupon', percent: 30, desc: 'Delicious Crispy Samosa at 30% Off!' }
    ];

    const rolled = potentialRewards[Math.floor(Math.random() * potentialRewards.length)];
    const code = 'MBX-' + Math.floor(1000 + Math.random() * 9000);

    if (isGuest) {
      setGuestMagicBoxProgress(1);
    } else {
      await updateDoc(doc(db, "users", user.uid), { magicBoxProgress: 1 });
    }

    return {
      success: true,
      rewardName: rolled.name,
      discountCode: code,
      discountPercent: rolled.percent,
      description: rolled.desc
    };
  };

  const setPortalMode = (mode: PortalMode) => {
    setPortalModeState(mode);
  };

  const setStudentTab = (tab: 'HOME' | 'ORDERS' | 'WALLET' | 'COMPLIANCE' | 'TRACKING' | 'QUESTS' | 'RANK' | 'STORE' | 'VAULT' | 'PROFILE') => {
    setStudentTabState(tab);
  };

  const setStaffRole = (role: StaffRole) => {
    setStaffRoleState(role);
  };

  const setIsStaffLoggedIn = (v: boolean) => {
    setIsStaffLoggedInState(v);
  };

  return (
    <AppContext.Provider value={{
      portalMode, setPortalMode,
      studentTab, setStudentTab,
      isStaffLoggedIn, setIsStaffLoggedIn,
      staffRole, setStaffRole,
      isLoggedIn, isGuest, studentName, studentEmail, walletBalance,
      handleStudentLogout: () => {
        fbSignOut();
      },
      menuItems,
      cart, addToCart, removeFromCart, clearCart, getCartTotal,
      orders, activeOrderTrackId, setActiveOrderTrackId,
      placeOrder, updateOrderStatus,
      rechargeRequests, submitRechargeRequest: submitRecharge, approveRecharge, rejectRecharge, walletTransactions,
      settings, updateSettings: (s) => updateSettings(s as any),
      studentPoints, studentXp, studentLevel, quests, updateQuestProgress, redeemedRewards, redeemReward, useRedeemedReward,
      magicBoxProgress, claimMagicBox, leaderboardUsers,
      purchaseCustomization: async (type: 'title' | 'frame' | 'decoration', value: string, cost: number) => {
        if (!user) return { success: false, error: 'User is not logged in.' };
        if (studentPoints < cost) {
          return { success: false, error: `Insufficient points. Requires ${cost} PTS` };
        }
        try {
          if (isGuest) {
            setGuestPoints(p => p - cost);
          } else {
            const field = type === 'title' ? 'customTitle' : type === 'frame' ? 'customFrameColor' : 'customAvatarDecoration';
            await updateDoc(doc(db, "users", user.uid), {
              points: increment(-cost),
              [field]: value
            });
          }
          return { success: true };
        } catch (err: any) {
          console.error('Failed to purchase customization:', err);
          return { success: false, error: err.message || 'Customization purchase failed.' };
        }
      }
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
