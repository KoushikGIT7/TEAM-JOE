/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { MenuItem, Order, WalletTransaction, RechargeRequest, SystemSettings, StaffRole, PortalMode, OrderStatus, OrderItemInfo, Quest, RewardItem, RedeemedReward, LeaderboardUser } from '../types';
import { INITIAL_MENU_ITEMS, DEFAULT_SETTINGS, STAFF_USERS } from '../initialData';

const DEFAULT_QUESTS: Quest[] = [
  {
    id: 'q_1',
    title: 'The Ramen Run',
    description: '3 bowls after 8PM',
    points: 500,
    progress: 2,
    target: 3,
    type: 'ACTIVE',
    endsIn: '04:12:08',
    badge: 'restaurant'
  },
  {
    id: 'q_2',
    title: 'Green Week',
    description: 'Order 5 salads',
    points: 1000,
    progress: 1,
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
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvCkq0euQrUYDkh9H24X6ViWJaxtghE2-LOZ8TLVNsM4hSGnO7zd6vRFE72l09RQmOrP5fT9QujL74WINj34k_OjQ4bbIhDvYYaNhIUfvDeQUde3vhzqPYMnarnOoFxZ3PxJEBNvvuC5D7f7UzmwWprmVGhnghUhRtxJonJs00pv3aStGPpUH8uYilOLyY-puIfTpjxoQ1K5mlESa1fLXiac-NJCE3SZQ1dK1F9bJWDFUI_G89A-L-Do31yS8Yp8_G2qOVNOs_rp4',
    badge: 'POPULAR',
    category: 'DRINKS'
  },
  {
    id: 'rew_2',
    name: '20% Off Meal',
    description: 'Valid for any main course in the main hall.',
    pointsCost: 800,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcFJS9rB4phKzBCIYYvWOOjftatKWmUsXfDjOCXFiwpp0wYEUwZ1RBvyb8R-Kq7oDa6RCZqw1ILHvh9FzczZhQD4oSTI8YJS03vWSP0c2JmC4ifzHMsRmxV6K7oP1ZNuII3pk3u3do-8hh6VIWR2CAT-pfl9HrIes2FVS30CagF6zZAS_xTPRKfgkHrJ_mhS2szfFXU1tGBWm5HV_UKe4IXddSRCR8A3plalAmhPEK2QTKdH2ZBZi7BIpLwjlDf1LoOzqH5AJPiCg',
    category: 'MEALS'
  },
  {
    id: 'rew_3',
    name: 'Limited Edition Sticker',
    description: 'Holographic finish, JOE Season 1 design.',
    pointsCost: 200,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAXAv4RhFKqxLSsvFLTdL_Xe4eIrMf4rfWEBnkKp55c7ECVBg98FJtWzYHHuMBs7AzWc6v1nqTaKfEabnq9lUuqPgb2p6wKEAVlfw0qM7OV6EdhxqKOyO8ySa8Ugutf-Ygl_9WxTdXbjbUYnEd81YPtkedESRu1mGqz2HFS-7IpwCc4BmuXzT_vWzBRG6zdmq4ApHmM7GJT271W3tCrKvck6FsJRclmRkc3OPWJBb08S5OSPJPUHpS8eJdCp4dz3qroa3fH3JcpcRk',
    badge: 'RARE',
    category: 'EXCLUSIVE'
  },
  {
    id: 'rew_4',
    name: 'Skip the Line Pass',
    description: 'Instant priority for your next 3 orders.',
    pointsCost: 1500,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCTP68MLHpgFsEEXanJzAXuKZv9XcZR9dw1f7Ai4Dkgpbb2FEz1QrUzP7sl1yt7mxNc3ujjvHtz6Dbf8bSWO8LV6_ijYf_CddJiB3lmfJIG9CA0fLw8YTC5clfpUFazoHrKmCSxxuNiIOJEq-pFR2Byz4Qlajbpp8o7eyInHHOSdUS3H8O0YMe1BQBi5OWPYpUOLihrkr9xBUYw-oIrtI7xj-XaiG-ooXVKtItWZx72T5cElo0-eus-Md6URZZlm22zEHf71LLvyh0',
    category: 'EXCLUSIVE'
  }
];


interface CartItem {
  id: string; // MenuItem ID
  quantity: number;
}

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
  handleStudentLogin: (email: string, name: string, type: 'GOOGLE' | 'GUEST') => void;
  handleStudentLogout: () => void;
  
  // Menu & Catalog
  menuItems: MenuItem[];
  updateMenuItem: (item: MenuItem) => void;
  addMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (id: string) => void;
  
  // Cart
  cart: CartItem[];
  addToCart: (itemId: string) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  
  // Orders State & Processing
  orders: Order[];
  activeOrderTrackId: string | null;
  setActiveOrderTrackId: (id: string | null) => void;
  placeOrder: (paymentMethod: 'WALLET' | 'CASH', appliedDiscountAmount?: number, discountDetail?: string) => { success: boolean; error?: string; order?: Order };
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  collectOrderItem: (orderId: string, menuItemId: string) => void;
  
  // Recharge Terminal
  rechargeRequests: RechargeRequest[];
  submitRechargeRequest: (amount: number, utr: string) => void;
  approveRecharge: (requestId: string) => void;
  rejectRecharge: (requestId: string, reason: string) => void;
  walletTransactions: WalletTransaction[];
  
  // Global Setup & Configs
  settings: SystemSettings;
  updateSettings: (s: SystemSettings) => void;
  reseedAllData: () => void;

  // Gamification & Loyalty States
  studentPoints: number;
  setStudentPoints: React.Dispatch<React.SetStateAction<number>>;
  studentXp: number;
  setStudentXp: React.Dispatch<React.SetStateAction<number>>;
  studentLevel: number;
  setStudentLevel: React.Dispatch<React.SetStateAction<number>>;
  quests: Quest[];
  setQuests: React.Dispatch<React.SetStateAction<Quest[]>>;
  updateQuestProgress: (id: string, amount: number) => void;
  redeemedRewards: RedeemedReward[];
  redeemReward: (rewardId: string) => { success: boolean; error?: string; reward?: RedeemedReward };
  useRedeemedReward: (id: string) => void;
  listenToActiveSupervisorOrders: (callback: (orders: Order[]) => void) => () => void;
  markPartialItemsReady: (itemIdOrName: string, quantityToReady: number) => void;
  updateMenuItemStock: (id: string, newStock: number) => void;
  updateMenuItemPrice: (id: string, newPrice: number) => void;
  
  // Custom High-Frequency Canteen Gamification
  magicBoxProgress: number;
  setMagicBoxProgress: React.Dispatch<React.SetStateAction<number>>;
  claimMagicBox: () => { success: boolean; rewardName: string; discountCode: string; discountPercent: number; description: string };
  leaderboardUsers: LeaderboardUser[];
  setLeaderboardUsers: React.Dispatch<React.SetStateAction<LeaderboardUser[]>>;
}


const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('joe_student_logged_in') === 'true';
  });
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem('joe_student_is_guest') === 'true';
  });
  const [studentName, setStudentName] = useState<string>(() => {
    return localStorage.getItem('joe_student_name') || 'Kabir Dev';
  });
  const [studentEmail, setStudentEmail] = useState<string>(() => {
    return localStorage.getItem('joe_student_email') || 'kabir.dev@gmail.com';
  });
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem('joe_student_wallet_balance');
    return saved ? parseFloat(saved) : 0.00; // default startup money
  });

  const [studentPoints, setStudentPoints] = useState<number>(() => {
    const saved = localStorage.getItem('joe_student_points');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [studentXp, setStudentXp] = useState<number>(() => {
    const saved = localStorage.getItem('joe_student_xp');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [studentLevel, setStudentLevel] = useState<number>(() => {
    const saved = localStorage.getItem('joe_student_level');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [magicBoxProgress, setMagicBoxProgress] = useState<number>(() => {
    const saved = localStorage.getItem('joe_magic_box_progress');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>(() => {
    const saved = localStorage.getItem('joe_leaderboard_users');
    if (saved) return JSON.parse(saved);
    return [
      { name: 'Leo V.', points: 4950, level: 24, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBTDPv7WdN2PKZubtsb3Ejet0BDK26s1iAp8ZLP-XJt8mS-KbVKuerZJskzgCq6h335sasf2d8tSeP3IIOqgpLtVWj_-L1XLdfH5DGDoBloID181ZKRiIs-alUugLUqfp2q3EF9s1ftpH6Yg_2s2lzfwDT-oOdpR0Q6wISHBOlnwhIJZQjkNmI2LV4_pxfqsVexvvOSsJMnsaaU_N-PK8iMpriHacDpVkJqtWai5u3BxUY-iAblELYmwR9t8QPSZypiV24-acKe2Zg', title: 'Chai Emperor', frequency: 54 },
      { name: 'Mia K.', points: 3820, level: 18, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBx_SrefqDh5-K-4vUVoK63MyglRNz5fqDTXmy3YN_tuKmM9unHLYYH6Xe1AT1O0SyMTh6OAThRI32f1rTWWVAo_91pXsXyXKG3f2te2myny1pR_7PQ1FKp0SjoTmSnwRiRPzQccB9oPq3DJ_sQu3RGq9fD1wLlPElC349_OCRNIJLDE24vFQ3WmDx4eVKPTxC3YZHEOvEm_hSWEk-SO_B8KbC-9vfCY5Ct9aHOvEWzYOuKke3_j5lo0m6Abyu8DkjajGFpVOLR51c', title: 'Maggi Emperor', frequency: 42 },
      { name: 'Sam R.', points: 3410, level: 15, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDOBpkStNWhzwMG6H3T_2BZ7843rxznRZy02Z7i08Z_3qE3XSVFzSGDSBekGKkoX4Nf-T69pbjA4W1EhNUltKdfcs0XRHQ5NvJB92uR_yuMWPfdkmVhDMejh0Q58nC_gPnDQMvDU13MwMEyuuImcciDPxhqL5pVrRtw44Ni0FTmJIMqlA3-fAnKIiMdag98RXkgZmUR9RJKZ2YBsi26aUydDF7CBTII8nBrOnyyVCS_Tjsp8HWnK86bntQa-7lDL6SHTm4XAV_FgUs', title: 'Samosa Overlord', frequency: 38 },
      { name: 'Elena Zhao', points: 3120, level: 13, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB_mWZTeTUN9KnPpm8f9QcMtBT-kxSppdJ3z-aUDJ8jEKPu_bhCdYp6rFzJoLZ9u88vrJ0prL_6k7U4H0AkJdBZqNJ_vdiBNFZqCqZONykHYB8pifDBPYC7O4kctH5EMEMxIAfkZ1YIOKil4eVJckkvHV8cLnHGcfag12cipal_sqoyQiQD8BsS_tsRCr9sWH1n71_NFrzmnQzGJO2YuNcgsczEE96hqwr28aX9tRd1ONvmWMnP9-O1qskflTZYNyb8CfuLQXCBaRY', title: 'Dosa Elite', frequency: 31 },
      { name: 'Jace Miller', points: 2990, level: 12, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA14-mtXFCOuy-VmG3Q2OS5VCO7HlVmMFNZq6S2Op8A-K-ra6okrLvckTIRJCa52qqIB_F3wLuMeOKjxTPw3hB4erGpj6DFdPvgojRAVQMR-i06hvpPHYhk9eP_9cfmORHy6hh7LiQEfEtv_syKBS2okQDb4WoZFBkITW_M1K2-pSQB23YjtWM9mx1AbrbLem0jmcU-NPe9BM8c3BCUpTW5_U0BGEfzyPIO8OLeOCcWBvgQGCz8Z2yxTNVLvh4zaGTw7pYDlhqDSr8', title: 'Ramen Legend', frequency: 28 },
      { name: 'Zoe Chen', points: 2410, level: 11, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0RWYE0-iQRDTDTMQlrx5k5L4rws2mmlxDqKOiNhawxBcnjyXtIcIx6b4ZPMlurYbK1746UAIIP669pFkrRAM7MspqisxObeOlfsFofPXq0UdPGKkb1YCZtYgmcr2rIYim6RppFASiaDpQwUWjJD0i_AHrUwugnGFGEienqqv32JpZbzxj4D8bRbCvMn49Ve8J-xqLbnBnv1kpqwsLv53hbJbYuY21lh251DZBwSgVlU_W5Q7PWgbm7bu6xkP7nhwQWau4DVZVs3k', title: 'Chai Enthusiast', frequency: 25 },
      { name: 'Riley Smith', points: 2380, level: 10, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9R5duExJVahUllF_ZdhZWmPik2c3elppc7_LAU7Ikc5QEsnBEryaHylZ1UN3OGrxZf3Wz8qvx7706SRC-BBTVdE6DdIF0TiYF-Tsdi66hxynqFtEVc1CXzuxh7e2IS4kTeCK5huMX-dwzz1VO6I3KwASzGNVeNr8u0kEWG-RT5v4MLJ5UznRGC7i4brrT39-S3p0sidgiqBM1MOcw6AQEf-TzbM04LEegcnGlLcIp-BNEVxzuGIp5C9XUyUmnBWvy4gNP90qz8RY', title: 'Samosa Rookie', frequency: 22 },
    ];
  });
  const [quests, setQuests] = useState<Quest[]>(() => {
    const saved = localStorage.getItem('joe_student_quests');
    return saved ? JSON.parse(saved) : DEFAULT_QUESTS;
  });
  const [redeemedRewards, setRedeemedRewards] = useState<RedeemedReward[]>(() => {
    const saved = localStorage.getItem('joe_redeemed_rewards');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Core Catalogs & settings ---
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('joe_menu_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some(item => item.name === 'Masala Chai')) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved menu items', e);
      }
    }
    return INITIAL_MENU_ITEMS;
  });
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('joe_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  // --- Operational States ---
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('joe_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('joe_orders');
    return saved ? JSON.parse(saved) : [];
  });
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>(() => {
    const saved = localStorage.getItem('joe_recharge_requests');
    return saved ? JSON.parse(saved) : [];
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    const saved = localStorage.getItem('joe_wallet_transactions');
    if (saved) return JSON.parse(saved);
    // Seed default transactions for beautiful initial ledger experience
    return [
      {
        id: 'tx_rec_1',
        type: 'credit',
        amount: 50.00,
        description: 'Wallet Refill (Instant)',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toLocaleString(),
        balanceAfter: 58.00
      },
      {
        id: 'tx_rec_2',
        type: 'debit',
        amount: 12.50,
        description: 'Truffle Burger Meal Payment',
        timestamp: new Date(Date.now() - 18 * 3600 * 1000).toLocaleString(),
        balanceAfter: 45.50
      }
    ];
  });

  const [activeOrderTrackId, setActiveOrderTrackId] = useState<string | null>(() => {
    return localStorage.getItem('joe_active_track_id');
  });

  // --- Synchronization & Side-effects ---
  useEffect(() => {
    localStorage.setItem('joe_portal_mode', portalMode);
  }, [portalMode]);

  useEffect(() => {
    localStorage.setItem('joe_staff_logged_in', String(isStaffLoggedIn));
    localStorage.setItem('joe_staff_role', staffRole);
  }, [isStaffLoggedIn, staffRole]);

  useEffect(() => {
    localStorage.setItem('joe_student_logged_in', String(isLoggedIn));
    localStorage.setItem('joe_student_is_guest', String(isGuest));
    localStorage.setItem('joe_student_name', studentName);
    localStorage.setItem('joe_student_email', studentEmail);
    localStorage.setItem('joe_student_wallet_balance', walletBalance.toFixed(2));
  }, [isLoggedIn, isGuest, studentName, studentEmail, walletBalance]);

  useEffect(() => {
    localStorage.setItem('joe_student_points', String(studentPoints));
  }, [studentPoints]);

  useEffect(() => {
    localStorage.setItem('joe_magic_box_progress', String(magicBoxProgress));
  }, [magicBoxProgress]);

  useEffect(() => {
    localStorage.setItem('joe_leaderboard_users', JSON.stringify(leaderboardUsers));
  }, [leaderboardUsers]);

  // Synchronize dynamic leaderboard rankings with current student state recursively
  useEffect(() => {
    setLeaderboardUsers(prev => {
      const otherCompetitors = prev.filter(u => u.name !== studentName);
      const updatedActiveUser: LeaderboardUser = {
        name: studentName,
        points: studentPoints,
        level: studentLevel,
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBmFXEjaHr485BvgqM5bLC8gHMekisyOhZX77PTrLjiqNulQFoLaWvvmmRgdX6O07AFQMjCUKM2G5HEXYGTcA8wvLsm5cPc0LJFRFVJiLpX-PV9wjrdpEAuTOhGUpGfJkk4aVAhtc8pM_3CFjjZEvA-9p1DuIXtt85buhP5MpqXG9JY81e_5m8xpVqIcwmlr8E6W1c46fQJLAH_li9udYdmfa0svx5n3bwsIi9ZMYtp8UriFW7S9JaK93MCh8J9GP1XbNxr_nTVGbI',
        title: studentLevel >= 18 ? 'Chai Emperor' : studentLevel >= 12 ? 'Pro Foodie' : 'Rising Star',
        frequency: orders.length + 18,
        isCurrentUser: true
      };

      const newList = [...otherCompetitors, updatedActiveUser];
      newList.sort((a, b) => b.points - a.points);
      
      return newList.map((u, index) => ({
        ...u,
        rank: index + 1
      }));
    });
  }, [studentPoints, studentLevel, studentName, orders.length]);

  useEffect(() => {
    localStorage.setItem('joe_student_xp', String(studentXp));
  }, [studentXp]);

  useEffect(() => {
    localStorage.setItem('joe_student_level', String(studentLevel));
  }, [studentLevel]);

  useEffect(() => {
    localStorage.setItem('joe_student_quests', JSON.stringify(quests));
  }, [quests]);

  useEffect(() => {
    localStorage.setItem('joe_redeemed_rewards', JSON.stringify(redeemedRewards));
  }, [redeemedRewards]);

  useEffect(() => {
    localStorage.setItem('joe_menu_items', JSON.stringify(menuItems));
  }, [menuItems]);

  useEffect(() => {
    localStorage.setItem('joe_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('joe_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('joe_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('joe_recharge_requests', JSON.stringify(rechargeRequests));
  }, [rechargeRequests]);

  useEffect(() => {
    localStorage.setItem('joe_wallet_transactions', JSON.stringify(walletTransactions));
  }, [walletTransactions]);

  useEffect(() => {
    if (activeOrderTrackId) {
      localStorage.setItem('joe_active_track_id', activeOrderTrackId);
    } else {
      localStorage.removeItem('joe_active_track_id');
    }
  }, [activeOrderTrackId]);

  // --- State Action Dispatches ---
  const setPortalMode = (mode: PortalMode) => {
    setPortalModeState(mode);
  };

  const setStudentTab = (tab: 'HOME' | 'ORDERS' | 'WALLET' | 'COMPLIANCE' | 'TRACKING' | 'QUESTS' | 'RANK' | 'STORE' | 'VAULT') => {
    setStudentTabState(tab);
  };

  const setStaffRole = (role: StaffRole) => {
    setStaffRoleState(role);
  };

  const setIsStaffLoggedIn = (v: boolean) => {
    setIsStaffLoggedInState(v);
  };

  const handleStudentLogin = (email: string, name: string, type: 'GOOGLE' | 'GUEST') => {
    setIsLoggedIn(true);
    setIsGuest(type === 'GUEST');
    setStudentName(name);
    setStudentEmail(email);
    if (type === 'GOOGLE') {
      // Retain standard balance and points loaded from localStorage, or start at zero if fresh login
      const savedBalance = localStorage.getItem('joe_student_wallet_balance');
      const savedPoints = localStorage.getItem('joe_student_points');
      setWalletBalance(savedBalance ? parseFloat(savedBalance) : 0.00);
      setStudentPoints(savedPoints ? parseInt(savedPoints, 10) : 0);
    } else {
      setWalletBalance(0.00); // guests require cashier-cash payment mode
      setStudentPoints(0);
    }
  };

  const handleStudentLogout = () => {
    setIsLoggedIn(false);
    setIsGuest(true);
    setStudentName('Guest Student');
    setStudentEmail('');
    setWalletBalance(0.00);
    setCart([]);
    setActiveOrderTrackId(null);
  };

  const updateMenuItem = (item: MenuItem) => {
    setMenuItems(prev => prev.map(m => m.id === item.id ? item : m));
  };

  const updateMenuItemStock = (id: string, newStock: number) => {
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, stock: newStock } : m));
  };

  const updateMenuItemPrice = (id: string, newPrice: number) => {
    setMenuItems(prev => prev.map(m => m.id === id ? { ...m, price: newPrice } : m));
  };

  const addMenuItem = (item: MenuItem) => {
    setMenuItems(prev => [...prev, item]);
  };

  const deleteMenuItem = (id: string) => {
    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  // --- Cart Management ---
  const addToCart = (itemId: string) => {
    const item = menuItems.find(m => m.id === itemId);
    if (!item) return;

    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (existing) {
        // Enforce maximum quantity bounds: "maximum of 3 plates per item"
        if (existing.quantity >= 3) return prev;
        // Verify remaining dynamic stock caps
        if (existing.quantity >= item.stock) return prev;
        return prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { id: itemId, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === itemId);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        return prev.filter(c => c.id !== itemId);
      }
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

  // --- Orders State Management ---
  const placeOrder = (paymentMethod: 'WALLET' | 'CASH', appliedDiscountAmount: number = 0, discountDetail?: string) => {
    const subtotal = getCartTotal();
    if (subtotal <= 0) return { success: false, error: 'Your cart is empty' };

    const total = parseFloat(Math.max(0, subtotal - appliedDiscountAmount).toFixed(2));

    // Limit check if wallet balances are sufficient 
    if (paymentMethod === 'WALLET') {
      if (walletBalance < total) {
        return { success: false, error: 'Insufficient wallet balance for payment' };
      }
    }

    const orderItems: OrderItemInfo[] = cart.map(c => {
      const item = menuItems.find(m => m.id === c.id)!;
      return {
        menuItemId: c.id,
        name: item.name,
        quantity: c.quantity,
        price: item.price
      };
    });

    const isGoogleUser = isLoggedIn && !isGuest;
    const initialStatus: OrderStatus = 'QUEUED';
    const randTokenNum = '#' + Math.floor(100 + Math.random() * 900).toString();

    const newOrder: Order = {
      id: 'ord_' + Math.random().toString(36).substr(2, 9),
      studentName: studentName,
      studentEmail: studentEmail,
      items: orderItems,
      total: total,
      status: initialStatus,
      tokenNumber: randTokenNum,
      timestamp: new Date().toLocaleString(),
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === 'WALLET' ? 'PAID' : 'PENDING',
      isGoogleUser,
      collectedItems: {},
      discountApplied: appliedDiscountAmount > 0 ? appliedDiscountAmount : undefined,
      discountDesc: discountDetail
    };

    // Atomically decrement menu item stocks
    setMenuItems(prev => prev.map(m => {
      const inCart = cart.find(c => c.id === m.id);
      if (inCart) {
        return { ...m, stock: Math.max(0, m.stock - inCart.quantity) };
      }
      return m;
    }));

    // Deduct user wallet if paid by wallet
    if (paymentMethod === 'WALLET') {
      setWalletBalance(prev => prev - total);
      setWalletTransactions(prev => [
        {
          id: 'tx_pay_' + Math.random().toString(36).substr(2, 9),
          type: 'debit',
          amount: total,
          description: `Order ${randTokenNum} Payment` + (discountDetail ? ` (${discountDetail})` : ''),
          timestamp: new Date().toLocaleString(),
          balanceAfter: walletBalance - total
        },
        ...prev
      ]);
    }

    // Award Points & XP smartly based on total spending and loyalty multiplier
    const currentFrequency = orders.length;
    let earningMultiplier = 1.0;
    if (currentFrequency >= 10) {
      earningMultiplier = 1.5; // Gold tier: 1.5x points
    } else if (currentFrequency >= 4) {
      earningMultiplier = 1.2; // Silver tier: 1.2x points
    }

    const orderedPoints = Math.round(total * 10 * earningMultiplier);
    const orderedXp = Math.round(total * 6 * earningMultiplier);
    
    setStudentPoints(p => p + orderedPoints);
    setStudentXp(x => {
      const nextX = x + orderedXp;
      if (nextX >= 1000) {
        setStudentLevel(lvl => lvl + 1);
        return nextX - 1000;
      }
      return nextX;
    });

    // Check specific menu item achievements to augment active quests
    const hasRamen = orderItems.some(it => it.menuItemId === '5');
    const hasSalad = orderItems.some(it => it.menuItemId === '2');

    if (hasRamen || hasSalad) {
      setQuests(prevQuests => prevQuests.map(q => {
        if (q.id === 'q_1' && hasRamen && q.progress < q.target) {
          const nextProg = q.progress + 1;
          if (nextProg === q.target) {
            setStudentPoints(p => p + q.points);
            return { ...q, progress: nextProg, type: 'ARCHIVED', completedAt: new Date().toLocaleDateString() };
          }
          return { ...q, progress: nextProg };
        }
        if (q.id === 'q_2' && hasSalad && q.progress < q.target) {
          const nextProg = q.progress + 1;
          if (nextProg === q.target) {
            setStudentPoints(p => p + q.points);
            return { ...q, progress: nextProg, type: 'ARCHIVED', completedAt: new Date().toLocaleDateString() };
          }
          return { ...q, progress: nextProg };
        }
        return q;
      }));
    }

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    
    // Increment smart Loot progress box for high frequency ordering cycles
    setMagicBoxProgress(prevVal => {
      const nextVal = prevVal + 1;
      return nextVal > 3 ? 3 : nextVal;
    });

    setActiveOrderTrackId(newOrder.id);
    setStudentTab('TRACKING');

    return { success: true, order: newOrder };
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      
      // If collection or served is completed
      const collected: { [menuItemId: string]: boolean } = { ...o.collectedItems };
      if (status === 'SERVED') {
        o.items.forEach(it => {
          collected[it.menuItemId] = true;
        });
      }

      return {
        ...o,
        status,
        collectedItems: collected,
        paymentStatus: o.paymentMethod === 'CASH' && status !== 'QUEUED' ? 'PAID' : o.paymentStatus
      };
    }));
  };

  const collectOrderItem = (orderId: string, menuItemId: string) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      
      const updatedCollections = { ...o.collectedItems, [menuItemId]: true };
      
      // Check if all items in order have been completed
      const allCollected = o.items.every(it => updatedCollections[it.menuItemId]);
      
      return {
        ...o,
        collectedItems: updatedCollections,
        status: allCollected ? 'SERVED' : o.status
      };
    }));
  };

  // --- Recharge Requests Terminal ---
  const submitRechargeRequest = (amount: number, utr: string) => {
    const request: RechargeRequest = {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      studentName,
      studentEmail,
      amount,
      screenshotUrl: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=400&auto=format&fit=crop&q=60', // Mock receipt screenshot preview URL
      utrNumber: utr || Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      timestamp: new Date().toLocaleString(),
      status: 'PENDING'
    };

    setRechargeRequests(prev => [request, ...prev]);
  };

  const approveRecharge = (requestId: string) => {
    const req = rechargeRequests.find(r => r.id === requestId);
    if (!req) return;

    setRechargeRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'APPROVED' } : r));
    
    // Add amount to wallet balance if this pertains to active simulated user
    if (req.studentEmail === studentEmail) {
      setWalletBalance(prev => {
        const fresh = prev + req.amount;
        setWalletTransactions(txs => [
          {
            id: 'tx_re_' + Math.random().toString(36).substr(2, 9),
            type: 'credit',
            amount: req.amount,
            description: `Wallet Refill (UTR: ${req.utrNumber})`,
            timestamp: new Date().toLocaleString(),
            balanceAfter: fresh
          },
          ...txs
        ]);
        return fresh;
      });
    }
  };

  const rejectRecharge = (requestId: string, reason: string) => {
    setRechargeRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'REJECTED', rejectionReason: reason } : r));
  };

  const updateSettings = (s: SystemSettings) => {
    setSettings(s);
  };

  const updateQuestProgress = (id: string, amount: number) => {
    setQuests(prev => prev.map(q => {
      if (q.id === id) {
        const nextProg = Math.min(q.target, q.progress + amount);
        if (nextProg === q.target && q.type === 'ACTIVE') {
          setStudentPoints(p => p + q.points);
          return { ...q, progress: nextProg, type: 'ARCHIVED', completedAt: new Date().toLocaleDateString() };
        }
        return { ...q, progress: nextProg };
      }
      return q;
    }));
  };

  const redeemReward = (rewardId: string) => {
    const item = INITIAL_REWARD_ITEMS.find(r => r.id === rewardId);
    if (!item) return { success: false, error: 'Reward item not found' };
    
    if (studentPoints < item.pointsCost) {
      return { success: false, error: `Inadequate points. Requires ${item.pointsCost} PTS` };
    }

    // Deduct points
    setStudentPoints(prev => prev - item.pointsCost);

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

    setRedeemedRewards(prev => [newRedemption, ...prev]);

    return { success: true, reward: newRedemption };
  };

  const useRedeemedReward = (id: string) => {
    setRedeemedRewards(prev => prev.map(r => r.id === id ? { ...r, status: 'USED' as const } : r));
  };

  const claimMagicBox = () => {
    if (magicBoxProgress < 3) {
      return { success: false, rewardName: '', discountCode: '', discountPercent: 0, description: 'Loot Box is still loading frequency triggers!' };
    }

    const potentialRewards = [
      {
        name: 'Masala Chai 50% Off Coupon',
        percent: 50,
        desc: 'Enjoy hot steaming Masala Chai at exactly 50% discount! (Canteen margin safe: low ingredient cost).',
        image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=60'
      },
      {
        name: 'Filter Coffee 40% Off Coupon',
        percent: 40,
        desc: 'Authentic Filter Coffee at 40% Off! (High volume margins retained for the seller).',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&auto=format&fit=crop&q=60'
      },
      {
        name: 'Choco Lava Cup 35% Off Coupon',
        percent: 35,
        desc: 'Indulge sweet cravings premium cake at 35% Off! (Encourages bulk food ordering combos).',
        image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=60'
      },
      {
        name: 'Tikka Roll 25% Off Coupon',
        percent: 25,
        desc: 'Delicious Tikka wrap sandwich at 25% Off! (Owner profit retained on combo checkouts).',
        image: 'https://images.unsplash.com/photo-1612966608997-30024d6ae7f7?w=400&auto=format&fit=crop&q=60'
      }
    ];

    const chosen = potentialRewards[Math.floor(Math.random() * potentialRewards.length)];
    const code = 'MAGIC-' + Math.floor(1000 + Math.random() * 9000).toString();

    setMagicBoxProgress(0);

    const newRedeem: RedeemedReward = {
      id: 'red_magic_' + Math.random().toString(36).substr(2, 9),
      rewardId: 'brew_magic_custom',
      name: chosen.name,
      pointsCost: 0,
      timestamp: new Date().toLocaleString(),
      code: code,
      status: 'ACTIVE'
    };

    setRedeemedRewards(prev => [newRedeem, ...prev]);

    return {
      success: true,
      rewardName: chosen.name,
      discountCode: code,
      discountPercent: chosen.percent,
      description: chosen.desc
    };
  };

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('supervisor-orders-update', { detail: orders }));
  }, [orders]);

  const listenToActiveSupervisorOrders = (callback: (updatedOrders: Order[]) => void) => {
    callback(orders);
    const handleStateChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        callback(customEvent.detail);
      }
    };
    window.addEventListener('supervisor-orders-update', handleStateChange);
    return () => {
      window.removeEventListener('supervisor-orders-update', handleStateChange);
    };
  };

  const markPartialItemsReady = (itemIdOrName: string, quantityToReady: number) => {
    setOrders(prev => {
      const pendingOrdersWithItem = prev
        .filter(o => {
          const isPending = o.status === 'QUEUED' || o.status === 'COOKING';
          if (!isPending) return false;
          return o.items.some(it => it.menuItemId === itemIdOrName || it.name === itemIdOrName);
        })
        .sort((a, b) => {
          const timeA = Date.parse(a.timestamp) || 0;
          const timeB = Date.parse(b.timestamp) || 0;
          return timeA - timeB;
        });
        
      let remainingToReady = quantityToReady;
      const orderIdsToReady = new Set<string>();
      
      for (const order of pendingOrdersWithItem) {
        if (remainingToReady <= 0) break;
        const item = order.items.find(it => it.menuItemId === itemIdOrName || it.name === itemIdOrName);
        if (item) {
          remainingToReady -= item.quantity;
          orderIdsToReady.add(order.id);
        }
      }
      
      return prev.map(o => {
        if (orderIdsToReady.has(o.id)) {
          return {
            ...o,
            status: 'READY' as const,
            paymentStatus: o.paymentMethod === 'CASH' ? ('PAID' as const) : o.paymentStatus
          };
        }
        return o;
      });
    });
  };

  const reseedAllData = () => {
    localStorage.removeItem('joe_menu_items');
    localStorage.removeItem('joe_settings');
    localStorage.removeItem('joe_cart');
    localStorage.removeItem('joe_orders');
    localStorage.removeItem('joe_recharge_requests');
    localStorage.removeItem('joe_wallet_transactions');
    localStorage.removeItem('joe_active_track_id');
    localStorage.removeItem('joe_student_points');
    localStorage.removeItem('joe_student_xp');
    localStorage.removeItem('joe_student_level');
    localStorage.removeItem('joe_student_quests');
    localStorage.removeItem('joe_redeemed_rewards');
    
    setPortalModeState('STUDENT');
    setStudentTabState('HOME');
    setIsStaffLoggedInState(false);
    setStaffRoleState('CASHIER');
    setIsLoggedIn(true);
    setIsGuest(false);
    setStudentName('Kabir Dev');
    setStudentEmail('kabir.dev@gmail.com');
    setWalletBalance(45.50);
    setStudentPoints(2450);
    setStudentXp(850);
    setStudentLevel(12);
    setQuests(DEFAULT_QUESTS);
    setRedeemedRewards([]);
    setMenuItems(INITIAL_MENU_ITEMS);
    setSettings(DEFAULT_SETTINGS);
    setCart([]);
    setRechargeRequests([]);
    setWalletTransactions([
      {
        id: 'tx_rec_1',
        type: 'credit',
        amount: 50.00,
        description: 'Wallet Refill (Instant)',
        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toLocaleString(),
        balanceAfter: 58.00
      },
      {
        id: 'tx_rec_2',
        type: 'debit',
        amount: 12.50,
        description: 'Truffle Burger Meal Payment',
        timestamp: new Date(Date.now() - 18 * 3600 * 1000).toLocaleString(),
        balanceAfter: 45.50
      }
    ]);
    setActiveOrderTrackId(null);
  };

  return (
    <AppContext.Provider value={{
      portalMode, setPortalMode,
      studentTab, setStudentTab,
      isStaffLoggedIn, setIsStaffLoggedIn,
      staffRole, setStaffRole,
      isLoggedIn, isGuest, studentName, studentEmail, walletBalance,
      handleStudentLogin, handleStudentLogout,
      menuItems, updateMenuItem, addMenuItem, deleteMenuItem,
      cart, addToCart, removeFromCart, clearCart, getCartTotal,
      orders, activeOrderTrackId, setActiveOrderTrackId,
      placeOrder, updateOrderStatus, collectOrderItem,
      rechargeRequests, submitRechargeRequest, approveRecharge, rejectRecharge, walletTransactions,
      settings, updateSettings, reseedAllData,
      studentPoints, setStudentPoints,
      studentXp, setStudentXp,
      studentLevel, setStudentLevel,
      quests, setQuests,
      updateQuestProgress,
      redeemedRewards, redeemReward, useRedeemedReward,
      listenToActiveSupervisorOrders, markPartialItemsReady,
      updateMenuItemStock, updateMenuItemPrice,
      magicBoxProgress, setMagicBoxProgress, claimMagicBox,
      leaderboardUsers, setLeaderboardUsers
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside the AppProvider');
  return context;
};
