import React from 'react';
import { MenuItem } from './types';

// Production-grade Indian food images (curated for cafeteria style)
export const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';

export const INITIAL_MENU: MenuItem[] = [
  // --- 🍵 BEVERAGES ---
  { id: 'BEV01', name: 'Masala Tea',        price: 10, costPrice: 4,  category: 'Beverages', imageUrl: '/assets/menu/tea.png', active: true },
  { id: 'BEV02', name: 'Filter Coffee',     price: 10, costPrice: 4,  category: 'Beverages', imageUrl: '/assets/menu/coffee.png', active: true },
  { id: 'BEV03', name: 'Hot Boost',         price: 15, costPrice: 6,  category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80', active: true },
  { id: 'BEV04', name: 'Badam Milk',        price: 15, costPrice: 7,  category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80', active: true },
  { id: 'BEV05', name: 'Ginger Coffee',     price: 15, costPrice: 6,  category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80', active: true },
  { id: 'BEV06', name: 'Spiced Buttermilk', price: 10, costPrice: 3,  category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&q=80', active: true },

  // --- 🥞 BREAKFAST (TIFFIN) ---
  { id: 'BKT01', name: 'Idli (2pcs)',              price: 20, costPrice: 8,  category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80', active: true },
  { id: 'BKT02', name: 'Tomato Bath',              price: 30, costPrice: 12, category: 'Breakfast', imageUrl: '/assets/menu/tomato_bath.png', active: true },
  { id: 'BKT03', name: 'Masala Dosa',              price: 30, costPrice: 12, category: 'Breakfast', imageUrl: '/assets/menu/masala_dosa.png', active: true },
  { id: 'BKT04', name: 'Set Dosa (3pcs)',          price: 40, costPrice: 16, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80', active: true },
  { id: 'BKT05', name: 'Lemon Rice',               price: 30, costPrice: 10, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1645177628172-a6a4a5d0b06d?w=400&q=80', active: true },
  { id: 'BKT06', name: 'Onion Dosa',               price: 30, costPrice: 12, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80', active: true },
  { id: 'BKT07', name: 'Medu Vada (1pc)',          price: 10, costPrice: 4,  category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80', active: true },
  { id: 'BKT08', name: 'Poha',                     price: 25, costPrice: 10, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80', active: true },
  { id: 'BKT09', name: 'Upma',                     price: 25, costPrice: 10, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1605197161470-b0b57b56fc3b?w=400&q=80', active: true },
  { id: 'BKT10', name: 'Bread Omelette',           price: 45, costPrice: 18, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80', active: true },
  { id: 'BKT11', name: '2 Idli + 2 Mirchi',       price: 35, costPrice: 14, category: 'Breakfast', imageUrl: '/assets/menu/idli_mirchi.jpg', active: true },
  { id: 'BKT12', name: 'Idli Vada (2 Idli + 1 Vada)', price: 35, costPrice: 14, category: 'Breakfast', imageUrl: '/assets/menu/idli_vada.png', active: true },

  // --- 🍟 SNACKS ---
  { id: 'SNK01', name: 'Onion Pakoda (3pcs)', price: 20, costPrice: 8,  category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80', active: true },
  { id: 'SNK02', name: 'Mirchi Bajji (1pc)',  price: 10, costPrice: 4,  category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80', active: true },
  { id: 'SNK03', name: 'Samosa (1pc)',        price: 15, costPrice: 6,  category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80', active: true },
  { id: 'SNK04', name: 'Bread Pakoda',        price: 20, costPrice: 8,  category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80', active: true },

  // --- 🍚 LUNCH & EGG ---
  { id: 'LCH01', name: 'Plate Meal',      price: 50, costPrice: 22, category: 'Lunch', imageUrl: '/assets/menu/plate_meal.png', active: true },
  { id: 'LCH02', name: 'Egg Rice',        price: 60, costPrice: 28, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80', active: true },
  { id: 'LCH03', name: 'Jeera Rice',      price: 50, costPrice: 20, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1645177628172-a6a4a5d0b06d?w=400&q=80', active: true },
  { id: 'LCH04', name: 'Egg Bhurji',      price: 30, costPrice: 14, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80', active: true },
  { id: 'LCH05', name: 'Masala Omelette', price: 40, costPrice: 18, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80', active: true },
  { id: 'LCH06', name: 'Veg Biryani',     price: 70, costPrice: 30, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80', active: true },
  { id: 'LCH07', name: 'Curd Rice',       price: 40, costPrice: 15, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80', active: true },
];

export const CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'] as const;

export const INVENTORY_SHARD_COUNT = 10;
export const QR_EXPIRY_MINUTES = 30;
export const DEFAULT_ORDERING_ENABLED = true;
export const DEFAULT_SERVING_RATE_PER_MIN = 10;

// --- ZERO-WAIT WORKFLOW CONFIG ---

/** Categories designated as FAST_ITEM (instantly serveable from counter) */
export const FAST_ITEM_CATEGORIES: readonly string[] = ['Breakfast', 'Lunch', 'Beverages', 'Snacks'];

/** Fixed prep time (seconds) for items not requiring a kitchen queue */
export const DEFAULT_PREP_TIME_SECONDS = 0;

/** Kitchen Queue Mapping: Specific prep time by item ID */
export const PREP_TIME_BY_ITEM: Record<string, number> = {
  'BKT03': 60,  // Masala Dosa
  'BKT04': 45,  // Set Dosa
  'BKT06': 60,  // Onion Dosa
};

// --- STATIONS (Slot Control) ---

export interface PreparationStationConfig {
  id: string;
  maxConcurrentPreparation: number;
  name: string;
  nameKn: string;
  avgPrepTimeSeconds: number;
}

export const PREPARATION_STATIONS: Record<string, PreparationStationConfig> = {
  dosa: {
    id: 'dosa',
    maxConcurrentPreparation: 10,
    name: 'Dosa Counter',
    nameKn: 'ದೋಸೆ ಕೌಂಟರ್',
    avgPrepTimeSeconds: 300,
  },
  default: {
    id: 'default',
    maxConcurrentPreparation: 100,
    name: 'Front Counter',
    nameKn: 'ಮುಂಭಾಗದ ಕೌಂಟರ್',
    avgPrepTimeSeconds: 15,
  },
};

/** Categorization for Smart Kitchen Workflow (Physical Partitioning) */
export const STATION_ID_BY_ITEM_ID: Record<string, string> = {
  // --- DOSA COUNTER (The only dynamic prep) ---
  'BKT03': 'dosa', 'BKT04': 'dosa', 'BKT06': 'dosa', 

  // Any other item defaults to Front Counter ('default') internally in isStaticItem
};

// --- BILINGUAL UI LABELS ---
export const SERVER_LABELS = {
  startPreparing: { en: 'Start Preparing', kn: 'ತಯಾರಿಸಲು ಪ್ರಾರಂಭಿಸಿ' },
  ready: { en: 'Ready', kn: 'ಸಿದ್ಧವಾಗಿದೆ' },
  serve: { en: 'Serve', kn: 'ಪೂರೈಸಿ' },
  new: { en: 'New', kn: 'ಹೊಸ' },
  queued: { en: 'Queued', kn: 'ಸಾಲದಲ್ಲಿ' },
  nextInQueue: { en: 'Next', kn: 'ಮುಂದೆ' },
  preparing: { en: 'Preparing', kn: 'ತಯಾರಾಗುತ್ತಿದೆ' },
  readyStatus: { en: 'Ready for Pickup', kn: 'ಪಿಕಪ್‌ಗೆ ಸಿದ್ಧ' },
  pickupWindow: { en: 'Pickup', kn: 'ಪಿಕಪ್' },
  queuePos: { en: 'Queue', kn: 'ಸಾಲ' },
  minLeft: { en: 'min left', kn: 'ನಿಮಿಷ ಉಳಿದಿದೆ' },
} as const;
