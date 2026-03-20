import React from 'react';
import { MenuItem } from './types';

// Production-grade Indian food images (curated for cafeteria style)
export const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';

export const INITIAL_MENU: MenuItem[] = [
  // --- 🍵 BEVERAGES ---
  { id: 'BEV01', name: 'Masala Tea', price: 10, costPrice: 4, category: 'Beverages', imageUrl: '/assets/menu/tea.png', active: true },
  { id: 'BEV02', name: 'Filter Coffee', price: 10, costPrice: 4, category: 'Beverages', imageUrl: '/assets/menu/coffee.png', active: true },
  { id: 'BEV03', name: 'Hot Boost', price: 15, costPrice: 6, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1591154706845-42994f31536b?auto=format&fit=crop&q=80&w=400', active: true },
  { id: 'BEV04', name: 'Badam Milk', price: 15, costPrice: 7, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&q=80&w=400', active: true },
  { id: 'BEV05', name: 'Ginger Coffee', price: 15, costPrice: 6, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1544787210-2213d242403b?auto=format&fit=crop&q=80&w=400', active: true },
  { id: 'BEV06', name: 'Spiced Buttermilk', price: 10, costPrice: 3, category: 'Beverages', imageUrl: 'https://images.unsplash.com/photo-1571407970349-bc81e7e96d47?auto=format&fit=crop&q=80&w=400', active: true },

  // --- 🥞 BREAKFAST (TIFFIN) ---
  { id: 'BKT01', name: 'Idli + Mirchi (2pcs)', price: 20, costPrice: 8, category: 'Breakfast', imageUrl: '/assets/menu/idli_vada.png', active: true },
  { id: 'BKT02', name: 'Tomato Bath', price: 30, costPrice: 12, category: 'Breakfast', imageUrl: '/assets/menu/tomato_bath.png', active: true },
  { id: 'BKT03', name: 'Masala Dosa', price: 30, costPrice: 12, category: 'Breakfast', imageUrl: '/assets/menu/masala_dosa.png', active: true },
  { id: 'BKT04', name: 'Set Dosa (3pcs)', price: 40, costPrice: 16, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1630131422700-d5be09321e1d?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'BKT05', name: 'Lemon Rice', price: 30, costPrice: 10, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'BKT06', name: 'Onion Dosa', price: 30, costPrice: 12, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1630383249899-231a47738f6b?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'BKT07', name: 'Vada (1pc)', price: 10, costPrice: 4, category: 'Breakfast', imageUrl: '/assets/menu/idli_vada.png', active: true },

  // --- 🍟 SNACKS ---
  { id: 'SNK01', name: 'Onion Pakoda (3pcs)', price: 20, costPrice: 8, category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1601050690597-df056fb27097?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'SNK02', name: 'Mirchi Bajji (1pc)', price: 10, costPrice: 4, category: 'Snacks', imageUrl: 'https://images.unsplash.com/photo-1626132646529-547b69a4ce13?auto=format&fit=crop&q=80&w=800', active: true },

  // --- 🍚 LUNCH & EGG ---
  { id: 'LCH01', name: 'Plate Meal', price: 50, costPrice: 22, category: 'Lunch', imageUrl: '/assets/menu/plate_meal.png', active: true },
  { id: 'LCH02', name: 'Egg Rice', price: 60, costPrice: 28, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1633333301117-90059346644f?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'LCH03', name: 'Jeera Rice', price: 50, costPrice: 20, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'LCH04', name: 'Egg Bhurji', price: 30, costPrice: 14, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1610450949065-2f2323f462a6?auto=format&fit=crop&q=80&w=800', active: true },
  { id: 'LCH05', name: 'Masala Omelette', price: 40, costPrice: 18, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1622543925917-763c34d1afd7?auto=format&fit=crop&q=80&w=800', active: true },
];

export const CATEGORIES = ['Breakfast', 'Lunch', 'Snacks', 'Beverages'] as const;

export const INVENTORY_SHARD_COUNT = 10;
export const QR_EXPIRY_MINUTES = 30;
export const DEFAULT_ORDERING_ENABLED = true;
export const DEFAULT_SERVING_RATE_PER_MIN = 10;

// --- ZERO-WAIT WORKFLOW CONFIG ---

/** Categories designated as FAST_ITEM (instantly serveable from counter) */
export const FAST_ITEM_CATEGORIES: readonly string[] = ['Lunch', 'Beverages', 'Snacks'];

/** Fixed prep time (seconds) for items not requiring a kitchen queue */
export const DEFAULT_PREP_TIME_SECONDS = 45;

/** Kitchen Queue Mapping: Specific prep time by item ID */
export const PREP_TIME_BY_ITEM: Record<string, number> = {
  'BKT03': 60,  // Masala Dosa
  'BKT04': 45,  // Set Dosa
  'BKT06': 60,  // Onion Dosa
  'LCH02': 90,  // Egg Rice (Wok prep)
  'LCH04': 60,  // Egg Bhurji
  'LCH05': 60,  // Omelette
  'BEV01': 0, 'BEV02': 0, 'BEV03': 0, 'BEV04': 0, 'BEV05': 0, 'BEV06': 0, // Fast
  'LCH01': 0, 'LCH03': 0, // Fast meals
  'SNK01': 0, 'SNK02': 0, // Pre-prepared snacks
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
    maxConcurrentPreparation: 3,
    name: 'Dosa Counter',
    nameKn: 'ದೋಸೆ ಕೌಂಟರ್',
    avgPrepTimeSeconds: 60,
  },
  kitchen: {
    id: 'kitchen',
    maxConcurrentPreparation: 4,
    name: 'Main Kitchen',
    nameKn: 'ಮುಖ್ಯ ಅಡುಗೆಮನೆ',
    avgPrepTimeSeconds: 90,
  },
  default: {
    id: 'default',
    maxConcurrentPreparation: 5,
    name: 'Instant Service',
    nameKn: 'ತಕ್ಷಣದ ಸೇವೆ',
    avgPrepTimeSeconds: 30,
  },
};

/** Categorization for Smart Kitchen Workflow */
export const STATION_ID_BY_ITEM_ID: Record<string, string> = {
  'BKT03': 'dosa', 'BKT04': 'dosa', 'BKT06': 'dosa',
  'LCH02': 'kitchen', 'LCH04': 'kitchen', 'LCH05': 'kitchen',
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
