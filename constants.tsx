import React from 'react';
import { MenuItem } from './types';

// Production-grade Indian food images (curated for cafeteria style)
export const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';

export const INITIAL_MENU: MenuItem[] = [
  // --- 🍵 BEVERAGES ---
  { id: 'BEV01', name: 'Masala Tea',       price: 10, costPrice: 4,  category: 'Beverages', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Masala_Chai.JPG/640px-Masala_Chai.JPG', active: true },
  { id: 'BEV02', name: 'Filter Coffee',    price: 10, costPrice: 4,  category: 'Beverages', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/South_Indian_Filter_Coffee.jpg/640px-South_Indian_Filter_Coffee.jpg', active: true },
  { id: 'BEV03', name: 'Hot Boost',        price: 15, costPrice: 6,  category: 'Beverages', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/640px-A_small_cup_of_coffee.JPG', active: true },
  { id: 'BEV04', name: 'Badam Milk',       price: 15, costPrice: 7,  category: 'Beverages', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Badam_Milk.jpg/640px-Badam_Milk.jpg', active: true },
  { id: 'BEV05', name: 'Ginger Coffee',    price: 15, costPrice: 6,  category: 'Beverages', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/A_small_cup_of_coffee.JPG/640px-A_small_cup_of_coffee.JPG', active: true },
  { id: 'BEV06', name: 'Spiced Buttermilk', price: 10, costPrice: 3, category: 'Beverages', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Chaas.jpg/640px-Chaas.jpg', active: true },

  // --- 🥞 BREAKFAST (TIFFIN) ---
  { id: 'BKT01', name: 'Idli (2pcs)',           price: 20, costPrice: 8,  category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Idli_Sambar.JPG/640px-Idli_Sambar.JPG', active: true },
  { id: 'BKT02', name: 'Tomato Bath',           price: 30, costPrice: 12, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/South_Indian_Tomato_Rice.jpg/640px-South_Indian_Tomato_Rice.jpg', active: true },
  { id: 'BKT03', name: 'Masala Dosa',           price: 30, costPrice: 12, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Dosa_at_Sree_Krishna_Inn.jpg/640px-Dosa_at_Sree_Krishna_Inn.jpg', active: true },
  { id: 'BKT04', name: 'Set Dosa (3pcs)',        price: 40, costPrice: 16, category: 'Breakfast', imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&q=80', active: true },
  { id: 'BKT05', name: 'Lemon Rice',             price: 30, costPrice: 10, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Lemon_rice.jpg/640px-Lemon_rice.jpg', active: true },
  { id: 'BKT06', name: 'Onion Dosa',             price: 30, costPrice: 12, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Dosa_with_chutney.jpg/640px-Dosa_with_chutney.jpg', active: true },
  { id: 'BKT07', name: 'Medu Vada (1pc)',        price: 10, costPrice: 4,  category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Medu_vada_%281%29.jpg/640px-Medu_vada_%281%29.jpg', active: true },
  { id: 'BKT08', name: 'Poha',                  price: 25, costPrice: 10, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Poha_with_chutney.jpg/640px-Poha_with_chutney.jpg', active: true },
  { id: 'BKT09', name: 'Upma',                  price: 25, costPrice: 10, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Upma.jpg/640px-Upma.jpg', active: true },
  { id: 'BKT10', name: 'Bread Omelette',        price: 45, costPrice: 18, category: 'Breakfast', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Bread_Omelette.jpg/640px-Bread_Omelette.jpg', active: true },

  // --- 🍟 SNACKS ---
  { id: 'SNK01', name: 'Onion Pakoda (3pcs)', price: 20, costPrice: 8, category: 'Snacks', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Onion_pakora.jpg/640px-Onion_pakora.jpg', active: true },
  { id: 'SNK02', name: 'Mirchi Bajji (1pc)',  price: 10, costPrice: 4, category: 'Snacks', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Mirchi_bajji.jpg/640px-Mirchi_bajji.jpg', active: true },
  { id: 'SNK03', name: 'Samosa (1pc)',        price: 15, costPrice: 6, category: 'Snacks', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Samosachutney.jpg/640px-Samosachutney.jpg', active: true },
  { id: 'SNK04', name: 'Bread Pakoda',        price: 20, costPrice: 8, category: 'Snacks', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Bread_Pakora.jpg/640px-Bread_Pakora.jpg', active: true },

  // --- 🍚 LUNCH & EGG ---
  { id: 'LCH01', name: 'Plate Meal',       price: 50, costPrice: 22, category: 'Lunch', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/South-Indian-Thali.jpg/640px-South-Indian-Thali.jpg', active: true },
  { id: 'LCH02', name: 'Egg Rice',         price: 60, costPrice: 28, category: 'Lunch', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Egg_fried_rice.jpg/640px-Egg_fried_rice.jpg', active: true },
  { id: 'LCH03', name: 'Jeera Rice',       price: 50, costPrice: 20, category: 'Lunch', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Jeera_Rice.jpg/640px-Jeera_Rice.jpg', active: true },
  { id: 'LCH04', name: 'Egg Bhurji',       price: 30, costPrice: 14, category: 'Lunch', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Egg_bhurji%28anda_bhurji%29.jpg/640px-Egg_bhurji%28anda_bhurji%29.jpg', active: true },
  { id: 'LCH05', name: 'Masala Omelette',  price: 40, costPrice: 18, category: 'Lunch', imageUrl: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=400&q=80', active: true },
  { id: 'LCH06', name: 'Veg Biryani',      price: 70, costPrice: 30, category: 'Lunch', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Hyderabadi_Vegetable_Biryani.jpg/640px-Hyderabadi_Vegetable_Biryani.jpg', active: true },
  { id: 'LCH07', name: 'Curd Rice',        price: 40, costPrice: 15, category: 'Lunch', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Curd_Rice.jpg/640px-Curd_Rice.jpg', active: true },
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
  'BKT10': 90,  // Bread Omelette (Kitchen)
  'LCH02': 90,  // Egg Rice (Wok prep)
  'LCH04': 60,  // Egg Bhurji
  'LCH05': 60,  // Omelette
  'BEV01': 0, 'BEV02': 0, 'BEV03': 0, 'BEV04': 0, 'BEV05': 0, 'BEV06': 0, // Fast
  'LCH01': 0, 'LCH03': 0, 'LCH06': 0, 'LCH07': 0, // Fast meals
  'SNK01': 0, 'SNK02': 0, 'SNK03': 0, 'SNK04': 0, // Pre-prepared snacks
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
    maxConcurrentPreparation: 10, // 🍳 Optimized for high-volume Dosa tawa
    name: 'Dosa Counter',
    nameKn: 'ದೋಸೆ ಕೌಂಟರ್',
    avgPrepTimeSeconds: 300,
  },
  rice_frying: {
    id: 'rice_frying',
    maxConcurrentPreparation: 12, // 🍳 Wok-based frying partition
    name: 'Rice Frying Counter',
    nameKn: 'ರೈಸ್ ಫ್ರೈಯಿಂಗ್ ಕೌಂಟರ್',
    avgPrepTimeSeconds: 420,
  },
  beverages: {
    id: 'beverages',
    maxConcurrentPreparation: 20, // ☕ Multi-glass tea/coffee tray batching
    name: 'Tea & Coffee Section',
    nameKn: 'ಟೀ ಮತ್ತು ಕಾಫಿ ವಿಭಾಗ',
    avgPrepTimeSeconds: 120,
  },
  kitchen: {
    id: 'kitchen',
    maxConcurrentPreparation: 25, // 🍲 Bulk Handi/Idli/Bulk preps
    name: 'Main Kitchen Prep',
    nameKn: 'ಮುಖ್ಯ ಅಡುಗೆಮನೆ ತಯಾರಿ',
    avgPrepTimeSeconds: 900,
  },
  default: {
    id: 'default',
    maxConcurrentPreparation: 100, // 🍱 Instant Front-Counter Items (Plate Meal)
    name: 'Front Counter',
    nameKn: 'ಮುಂಭಾಗದ ಕೌಂಟರ್',
    avgPrepTimeSeconds: 15,
  },
};

/** Categorization for Smart Kitchen Workflow (Physical Partitioning) */
export const STATION_ID_BY_ITEM_ID: Record<string, string> = {
  // --- KITCHEN (Main Bulk) ---
  'BKT01': 'kitchen', 'BKT02': 'kitchen', 'BKT05': 'kitchen', 'BKT07': 'kitchen', 'BKT08': 'kitchen', 'BKT09': 'kitchen', 
  
  // --- DOSA COUNTER ---
  'BKT03': 'dosa', 'BKT04': 'dosa', 'BKT06': 'dosa', 

  // --- RICE FRYING COUNTER ---
  'LCH02': 'rice_frying', 'LCH04': 'rice_frying', 'LCH05': 'rice_frying', 'BKT10': 'rice_frying',
  
  // --- BEVERAGE STATION ---
  'BEV01': 'beverages', 'BEV02': 'beverages', 'BEV03': 'beverages', 'BEV04': 'beverages', 'BEV05': 'beverages', 'BEV06': 'beverages',

  // --- FRONT COUNTER (Instant) ---
  'LCH01': 'default', 'LCH03': 'default', 'LCH06': 'default', 'LCH07': 'default',
  'SNK01': 'default', 'SNK02': 'default', 'SNK03': 'default', 'SNK04': 'default',
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
