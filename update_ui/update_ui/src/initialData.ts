/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MenuItem, SystemSettings, StaffUser } from './types';

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Masala Chai',
    description: 'Classic Indian aromatic hot tea brewed with fresh milk, crushed ginger, and green cardamom grains.',
    price: 10.00,
    category: 'DRINKS',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 25,
    initialStock: 30
  },
  {
    id: '2',
    name: 'Filter Coffee',
    description: 'South Indian chicory-infused espresso frothed with boiling milk and poured from heights.',
    price: 10.00,
    category: 'DRINKS',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 20,
    initialStock: 30
  },
  {
    id: '3',
    name: 'Boost Energy Drink',
    description: 'Nourishing hot chocolatey malt and barley food beverage designed to keep energy high.',
    price: 15.00,
    category: 'DRINKS',
    image: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 22,
    initialStock: 25
  },
  {
    id: '4',
    name: 'Curd Buttermilk (Chaas)',
    description: 'Cool refreshing spiced churned yogurt drink salted and seasoned with curry leaves.',
    price: 10.00,
    category: 'DRINKS',
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 18,
    initialStock: 20
  },
  {
    id: '5',
    name: 'Sweet Mango Lassi',
    description: 'Thick, creamy chilled yogurt shake blended with fresh sweet ripe mango pulp.',
    price: 12.00,
    category: 'DRINKS',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 15,
    initialStock: 20
  },
  {
    id: '6',
    name: 'Soft Steamed Idly (3 pcs)',
    description: 'Three super-soft steamed rice and black lentil cakes served with sambar and coconut chutney.',
    price: 30.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 30,
    initialStock: 40
  },
  {
    id: '7',
    name: 'Idly (2 pcs) + Mirchi Bajji (2 pcs)',
    description: 'Awesome combo of two soft steamed idlies with two crispy golden-fried spiced whole chilli bajjis.',
    price: 30.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 24,
    initialStock: 30
  },
  {
    id: '8',
    name: 'Plump Poori Chana Sagu',
    description: 'Golden-fried fluffy whole wheat puffed puries with delicious potato masala curry.',
    price: 40.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 18,
    initialStock: 25
  },
  {
    id: '9',
    name: 'Uggani + Crunchy Mirchi Bajji',
    description: 'Spiced puffed rice upma with turmeric, crunchy peanuts, served with fresh hot chilli bajjis.',
    price: 30.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 15,
    initialStock: 20
  },
  {
    id: '10',
    name: 'Crispy Plain Dosa',
    description: 'Crusty golden rice & black lentil paper-thin fermented crepe served with chutneys.',
    price: 35.00,
    category: 'BREAKFAST',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXBt7Nb3rkzlmfXi8s2QG75DRn-mFc8I5R2w158864hYHkmVGucIEzril2b2AAxuxdD9ff6SNXkXjLdhI5ntbXNyt48i3RsV51uQGtmLkLdtAlpmG5dTIMdMgijq1IAw6AgbbTcW2WGsuennSiISQfa1KVuSk1uaz3fYwa6jnv4vK2KQTmqtT63EY-XkD1-mBzOpwICPKuiVYCwmYDFQ41N6VO7iA5ReMJc8dN786oyFj1sYPsr10fc9BIpa9I5Zm59v-qtRB-nrI',
    isFast: true,
    stock: 20,
    initialStock: 25
  },
  {
    id: '11',
    name: 'Classic Masala Dosa',
    description: 'Savoury crisp hand-swirled crepe folded over soft herb-spiced potato & mustard bhaji mash.',
    price: 40.00,
    category: 'BREAKFAST',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXBt7Nb3rkzlmfXi8s2QG75DRn-mFc8I5R2w158864hYHkmVGucIEzril2b2AAxuxdD9ff6SNXkXjLdhI5ntbXNyt48i3RsV51uQGtmLkLdtAlpmG5dTIMdMgijq1IAw6AgbbTcW2WGsuennSiISQfa1KVuSk1uaz3fYwa6jnv4vK2KQTmqtT63EY-XkD1-mBzOpwICPKuiVYCwmYDFQ41N6VO7iA5ReMJc8dN786oyFj1sYPsr10fc9BIpa9I5Zm59v-qtRB-nrI',
    isFast: true,
    stock: 25,
    initialStock: 30
  },
  {
    id: '12',
    name: 'Savoury Onion Dosa',
    description: 'Fermented crepe griddle-toasted with a layout of finely chopped raw sweet red onion and cilantro.',
    price: 50.00,
    category: 'BREAKFAST',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXBt7Nb3rkzlmfXi8s2QG75DRn-mFc8I5R2w158864hYHkmVGucIEzril2b2AAxuxdD9ff6SNXkXjLdhI5ntbXNyt48i3RsV51uQGtmLkLdtAlpmG5dTIMdMgijq1IAw6AgbbTcW2WGsuennSiISQfa1KVuSk1uaz3fYwa6jnv4vK2KQTmqtT63EY-XkD1-mBzOpwICPKuiVYCwmYDFQ41N6VO7iA5ReMJc8dN786oyFj1sYPsr10fc9BIpa9I5Zm59v-qtRB-nrI',
    isFast: true,
    stock: 15,
    initialStock: 20
  },
  {
    id: '13',
    name: 'Farm Egg Dosa',
    description: 'Thin crispy swirled crepe overlayed with a freshly whipped, spiced farm egg glaze.',
    price: 50.00,
    category: 'BREAKFAST',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXBt7Nb3rkzlmfXi8s2QG75DRn-mFc8I5R2w158864hYHkmVGucIEzril2b2AAxuxdD9ff6SNXkXjLdhI5ntbXNyt48i3RsV51uQGtmLkLdtAlpmG5dTIMdMgijq1IAw6AgbbTcW2WGsuennSiISQfa1KVuSk1uaz3fYwa6jnv4vK2KQTmqtT63EY-XkD1-mBzOpwICPKuiVYCwmYDFQ41N6VO7iA5ReMJc8dN786oyFj1sYPsr10fc9BIpa9I5Zm59v-qtRB-nrI',
    isFast: true,
    stock: 18,
    initialStock: 22
  },
  {
    id: '14',
    name: 'Tangy Lemon Rice',
    description: 'Comforting bright turmeric long grain rice infused with lemon juice, mustard seeds, and crunchy cashews.',
    price: 30.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 22,
    initialStock: 30
  },
  {
    id: '15',
    name: 'Traditional South Thali Meals',
    description: 'Full regional thali feast complete with unlimited hot white rice, sambar, rasam, curd, dry stir fry, and papad.',
    price: 60.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 15,
    initialStock: 25
  },
  {
    id: '16',
    name: 'Crispy Gobi Fried Rice',
    description: 'Sizzling wok tossed seasoned long grain rice layered with crisp battered chili cauliflower bits.',
    price: 60.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1603133872878-696a548e7620?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 16,
    initialStock: 20
  },
  {
    id: '17',
    name: 'Wok Egg Fried Rice',
    description: 'High flame long grain rice fried with freshly scrambled eggs, julienned greens, and ginger-garlic dressing.',
    price: 60.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1603133872878-696a548e7620?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 20,
    initialStock: 25
  },
  {
    id: '18',
    name: 'Chilli Veg Stir-Fry Noodles',
    description: 'Savory stir-fried noodles cooked with shredded fresh market cabbage, crunchy carrots, and light soy-pepper.',
    price: 50.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 25,
    initialStock: 30
  },
  {
    id: '19',
    name: 'Classic Wok Egg Noodles',
    description: 'Smoky, high flame tossed street style egg noodles mixed with egg scramble and tender cabbage julienne.',
    price: 60.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 20,
    initialStock: 25
  },
  {
    id: '20',
    name: 'Gobi Manchurian (Dry)',
    description: 'Sizzling crispy coated deep fried cauliflower florets stir fried in a rich dark sweet-chilli glazing sauce.',
    price: 60.00,
    category: 'SNACKS',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBav7Lo1M20yI4dtBaVepZy-B3kBgDMlsw6_TI2uJSiJvgxjljJ9WYcyrBFkfdxh-62rnolikQL1t4uo7UeBF-gaf_tk8sWwRZ-sHG1AavHkbH8HwBk8kGtUDP8xg6CD8TfNUIPWvpoNzY6I1l8J1zxCkJIx9rgD_wVfibT4RX31FT4GI-Llo_o501SvYvP-CqOuwLsnvRtI9tasbdQrVGAR-fvYofIkyq1C6yt6M41Xulp75KzB0mKDpaOWhfZ6OZH8bTssEWS3G0',
    isFast: false,
    stock: 15,
    initialStock: 20
  },
  {
    id: '21',
    name: 'Gobi Noodles Delight',
    description: 'Amazing fast stir fried vegetable noodles topped and mixed with crispy hot chunks of sweet spicy Gobi Manchurian.',
    price: 70.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 12,
    initialStock: 15
  },
  {
    id: '22',
    name: 'Egg Gobi Sizzler Bowl',
    description: 'Tasty fusion of savory scrambled egg fragments wok-cooked together with deep fried red Gobi chunks and greens.',
    price: 70.00,
    category: 'LUNCH',
    image: 'https://images.unsplash.com/photo-1603133872878-696a548e7620?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 10,
    initialStock: 15
  },
  {
    id: '23',
    name: 'Griddle Chapati (2 pcs)',
    description: 'Two soft griddle-toasted flatbreads served with regional dry aromatic vegetable korma curry.',
    price: 30.00,
    category: 'LUNCH',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmU53uQw9vrlUsAuSIa5B_Rjauqhl-NqRT1b-qMgxd9OULnzXPbFpTwfhG6qmsca4ALZquk0ItIMGOHnwA4BreikfV-g8v_qLpQOMGE2CR_UEtYdgP__1SNO_gwfUqIFOzr1T9pKCpTnTyM1VC8ZtAf1cDc5ppQXHNlOyVxYDKZaKMK2D8MX8jO5wTgR6lxx1TbRGuqCATmaoQprGP7t0B9rbzRGw_I3sBcPwvSz0JqhFaUGgqAIrtbtmZOCdZVIEUXhtfB8bCrtI',
    isFast: true,
    stock: 25,
    initialStock: 30
  },
  {
    id: '24',
    name: 'Masala Egg Omelette',
    description: 'Two farm eggs frothed with fine onions, fiery green chillies, cracked black pepper, pan cooked.',
    price: 20.00,
    category: 'SNACKS',
    image: 'https://images.unsplash.com/photo-1510431198580-79e7df10f924?auto=format&fit=crop&w=600&q=80',
    isFast: true,
    stock: 30,
    initialStock: 35
  }
];

export const DEFAULT_SETTINGS: SystemSettings = {
  systemEnabled: true,
  upiId: 'cse-cafeteria@okaxis',
  upiQrCode: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCe0LcsCDMcen5LM_o_LTfSI2U9r9eF-UDAi9HGxY_I9m6Lhc6K6MzrSAKJsNdE3LBwXgtfdXG4DDGKBjUhnC8hxxXEiAm59nxKDnVsouc6WiPbt9Cx7mRit-SU3DYd8lLa0cyM9PXN74fCqcZEn_17yyc1q3eSVBq8y1p3--ioBDAf2U6PdsMYUeRUohvg_yja6vltAHouw9SEzmu188USRDCP76V-LTN4o1BAJ_Q6oCAo_iFnkQpBhGbw9Yl0rNAFs_DWrqN42oU',
  lowBalanceThreshold: 15.00,
  pilotNotification: '👨‍✈️ Digital wallet & cash counter pilot program running. Instant wallet approvals automated for testing!'
};

export const STAFF_USERS: StaffUser[] = [
  { email: 'cashier@cse.com', name: 'Kabir Dev (Cashier)', role: 'CASHIER', active: true },
  { email: 'cook@cse.com', name: 'Chef Suresh Kumar', role: 'COOK', active: true },
  { email: 'supervisor@cse.com', name: 'Ananya Sharma (Supervisor)', role: 'SUPERVISOR', active: true },
  { email: 'server@cse.com', name: 'Pranav Roy (Server)', role: 'SERVER', active: true },
  { email: 'admin@cse.com', name: 'Administrator Main', role: 'ADMIN', active: true }
];
