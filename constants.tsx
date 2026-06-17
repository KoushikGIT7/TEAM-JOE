import React from 'react';
import { MenuItem } from './types';

// Production-grade Indian food images (curated for cafeteria style)
export const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';

export const INITIAL_MENU: MenuItem[] = [
  // --- 🥞 BREAKFAST (TIFFIN) ---
  { id: 'BKT01', name: 'Idli',       price: 30, costPrice: 15, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&q=80', active: true },
  { id: 'BKT02', name: 'Vada',       price: 25, costPrice: 10, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=400&q=80', active: true },
  { id: 'BKT03', name: 'Dosa',       price: 40, costPrice: 20, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80', active: true },
  { id: 'BKT04', name: 'Pongal',     price: 35, costPrice: 15, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80', active: true },
  { id: 'BKT05', name: 'Poori',      price: 40, costPrice: 20, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80', active: true },
  { id: 'BKT06', name: 'Upma',       price: 30, costPrice: 15, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1605197161470-b0b57b56fc3b?w=400&q=80', active: true },

  // --- 🍚 LUNCH ---
  { id: 'LCH01', name: 'Andhra Meals', price: 80, costPrice: 40, category: 'Lunch', imageUrl: '/assets/menu/plate_meal.png', active: true },
  { id: 'LCH02', name: 'Veg Meals',    price: 70, costPrice: 35, category: 'Lunch', imageUrl: '/assets/menu/plate_meal.png', active: true },
  { id: 'LCH03', name: 'Curd Rice',    price: 45, costPrice: 20, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=400&q=80', active: true },
  { id: 'LCH04', name: 'Lemon Rice',   price: 45, costPrice: 20, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1645177628172-a6a4a5d0b06d?w=400&q=80', active: true },
  { id: 'LCH05', name: 'Fried Rice',   price: 60, costPrice: 30, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80', active: true },

  // --- 🍟 SNACKS ---
  { id: 'SNK01', name: 'Tea',    price: 15, costPrice: 5, category: 'Snacks', imageUrl: '/assets/menu/tea.png', active: true },
  { id: 'SNK02', name: 'Coffee', price: 20, costPrice: 8, category: 'Snacks', imageUrl: '/assets/menu/coffee.png', active: true },
  { id: 'SNK03', name: 'Samosa', price: 20, costPrice: 10, category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80', active: true },
  { id: 'SNK04', name: 'Bajji',  price: 15, costPrice: 7, category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80', active: true },
  { id: 'SNK05', name: 'Bonda',  price: 15, costPrice: 7, category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&q=80', active: true },
  { id: 'SNK06', name: 'Puffs',  price: 25, costPrice: 12, category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=80', active: true },
];

export const CATEGORIES = ['Breakfast', 'Lunch', 'Snacks'] as const;

export const INVENTORY_SHARD_COUNT = 10;
export const QR_EXPIRY_MINUTES = 30;
export const DEFAULT_ORDERING_ENABLED = true;
export const DEFAULT_SERVING_RATE_PER_MIN = 10;

// --- ZERO-WAIT WORKFLOW CONFIG ---

/** Categories designated as FAST_ITEM (instantly serveable from counter) */
export const FAST_ITEM_CATEGORIES: readonly string[] = ['Breakfast', 'Lunch', 'Snacks'];

/** Fixed prep time (seconds) for items not requiring a kitchen queue */
export const DEFAULT_PREP_TIME_SECONDS = 0;

/** Kitchen Queue Mapping: Specific prep time by item ID */
export const PREP_TIME_BY_ITEM: Record<string, number> = {
  'BKT03': 60,  // Dosa
  'BKT05': 45,  // Poori
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
  'BKT03': 'dosa', 'BKT05': 'dosa',

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
