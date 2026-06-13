/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MenuItem } from './types';

export const CONSTANT_MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Masala Chai',
    description: 'Classic Indian aromatic hot tea brewed with fresh milk, crushed ginger, and green cardamom grains.',
    price: 15.00,
    costPrice: 6.00,
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
    price: 15.00,
    costPrice: 7.00,
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
    price: 20.00,
    costPrice: 10.00,
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
    price: 15.00,
    costPrice: 6.00,
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
    price: 25.00,
    costPrice: 12.00,
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
    price: 35.00,
    costPrice: 15.00,
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
    price: 45.00,
    costPrice: 20.00,
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
    price: 50.00,
    costPrice: 22.00,
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
    price: 40.00,
    costPrice: 16.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 15,
    initialStock: 20
  },
  {
    id: '10',
    name: 'Splendid Ghee Masala Dosa',
    description: 'Crispy aromatic golden crepe spread with home-churned ghee and potato masala stuffing.',
    price: 60.00,
    costPrice: 25.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 10,
    initialStock: 15
  },
  {
    id: '11',
    name: 'Perfect Plain Dosa',
    description: 'Savoury thin crispy rice crepe served hot with aromatic sambar and fresh coconut dip.',
    price: 45.00,
    costPrice: 18.00,
    category: 'BREAKFAST',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 12,
    initialStock: 20
  }
];
