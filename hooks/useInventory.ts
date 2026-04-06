/**
 * useInventory - Real-time stock visibility for students
 * Listens to inventory_meta (totalStock, consumed, lowStockThreshold) and exposes
 * per-item status: AVAILABLE | LOW_STOCK | OUT_OF_STOCK and available count.
 */

import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { getStockStatus } from '../services/firestore-db';
import type { InventoryMetaItem, StockStatus } from '../types';

export interface StockInfo {
  status: StockStatus;
  available: number;
}

export function useInventory(): {
  stockByItemId: Record<string, StockInfo>;
  metaList: InventoryMetaItem[];
  loading: boolean;
  isOutOfStock: (itemId: string) => boolean;
  canAddToCart: (itemId: string, currentQty: number) => boolean;
} {
  const [metaList, setMetaList] = useState<InventoryMetaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // 📡 [SONIC-INVENTORY]: High-speed real-time sync for sub-second stock updates
    const unsub = onSnapshot(collection(db, "inventory_meta"), (snap) => {
      const items = snap.docs.map(doc => ({ ...doc.data() } as InventoryMetaItem));
      setMetaList(items);
      setLoading(false);
    }, (err) => {
      console.error("🔥 Inventory sync dropped:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const stockByItemId = useMemo(() => {
    const map: Record<string, StockInfo> = {};
    metaList.forEach((meta) => {
      map[meta.itemId] = getStockStatus(meta);
    });
    return map;
  }, [metaList]);

  const isOutOfStock = (itemId: string): boolean => {
    const s = stockByItemId[itemId];
    return s ? s.available <= 0 : false;
  };

  const canAddToCart = (itemId: string, currentQty: number): boolean => {
    const s = stockByItemId[itemId];
    if (!s) return true; // no meta = allow (legacy items)
    return s.available > currentQty;
  };

  return { stockByItemId, metaList, loading, isOutOfStock, canAddToCart };
}
