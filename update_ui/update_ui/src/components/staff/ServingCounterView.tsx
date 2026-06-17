/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { LogOut, ShieldCheck, AlertTriangle } from 'lucide-react';
import { QRScanner } from './QRScanner';
import { cseSounds } from './cseSounds';
import { Order } from '../../types';

export const ServingCounterView: React.FC = () => {
  const { orders, collectOrderItem, setIsStaffLoggedIn } = useApp();

  const [hudState, setHudState] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [hudMessage, setHudMessage] = useState('');
  const [hudPayload, setHudPayload] = useState<{ studentName: string; itemNames: string[] } | null>(null);
  
  const [isScanLocked, setIsScanLocked] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);
  
  const lastScanTimeRef = useRef<number>(0);
  const activeResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeOrders = orders.filter(o => o.status !== 'SERVED');

  const validateQRForServing = (payload: string): { success: boolean; error?: string; order?: Order; itemToServeId?: string } => {
    if (payload === 'EXPIRED_QR_CODE') {
      return { success: false, error: 'QR Code Expired' };
    }

    if (payload === 'INVALID_QR_CODE' || payload === 'corrupted_payload') {
      return { success: false, error: 'Invalid Secure QR Code' };
    }

    if (payload === 'unverified_cash') {
      return { success: false, error: 'Cash Payment Not Approved' };
    }

    let orderId = payload;
    let targetItemId: string | undefined = undefined;

    if (payload.includes('_')) {
      const parts = payload.split('_');
      if (parts[0] === 'ord' || parts[0] === 'order') {
        orderId = parts[1];
        if (parts[2]) {
          targetItemId = parts[2];
        }
      }
    }

    if (payload === 'VALID_MOCK_ORDER') {
      const pendingOrder = activeOrders.find(o => o.status === 'READY') || activeOrders[0];
      if (!pendingOrder) {
        return { success: false, error: 'No Active Orders' };
      }
      orderId = pendingOrder.id;
    }

    const matchedOrder = orders.find(o => o.id === orderId || o.tokenNumber === orderId);
    if (!matchedOrder) {
      return { success: false, error: 'Order Not Found' };
    }

    if (matchedOrder.paymentMethod === 'CASH' && matchedOrder.paymentStatus !== 'PAID') {
      return { success: false, error: 'Payment Pending Verification' };
    }

    if (targetItemId) {
      const isAlreadyServed = matchedOrder.collectedItems[targetItemId];
      if (isAlreadyServed) {
        return { success: false, error: 'Already Served' };
      }
      return { success: true, order: matchedOrder, itemToServeId: targetItemId };
    } else {
      const allCollected = matchedOrder.items.every(it => matchedOrder.collectedItems[it.menuItemId]);
      if (matchedOrder.status === 'SERVED' || allCollected) {
        return { success: false, error: 'Already Served' };
      }
      const firstPendingItem = matchedOrder.items.find(it => !matchedOrder.collectedItems[it.menuItemId]);
      return { 
        success: true, 
        order: matchedOrder, 
        itemToServeId: firstPendingItem?.menuItemId 
      };
    }
  };

  const handleQRScan = (payload: string) => {
    const currentTime = Date.now();
    
    if (currentTime - lastScanTimeRef.current < 4000) {
      setIsDebouncing(true);
      setTimeout(() => {
        setIsDebouncing(false);
      }, 1000);
      return;
    }

    lastScanTimeRef.current = currentTime;

    if (isScanLocked) return;
    setIsScanLocked(true);

    if (activeResetTimeoutRef.current) {
      clearTimeout(activeResetTimeoutRef.current);
    }

    const result = validateQRForServing(payload);

    if (result.success && result.order && result.itemToServeId) {
      const targetOrder = result.order;
      const itemId = result.itemToServeId;
      
      collectOrderItem(targetOrder.id, itemId);

      const targetItem = targetOrder.items.find(it => it.menuItemId === itemId);
      const itemNameDisplay = targetItem ? `${targetItem.quantity}x ${targetItem.name}` : 'Item';

      cseSounds.playServerScanSuccess();

      setHudState('SUCCESS');
      setHudPayload({
        studentName: targetOrder.studentName,
        itemNames: [itemNameDisplay]
      });

      setTimeout(() => {
        setIsScanLocked(false);
      }, 1);

      activeResetTimeoutRef.current = setTimeout(() => {
        setHudState('IDLE');
        setHudPayload(null);
      }, 2000);

    } else {
      const errorMsg = result.error || 'Invalid QR Security Digest';
      
      cseSounds.playErrorBuzzer();

      setHudState('ERROR');
      setHudMessage(errorMsg);

      setTimeout(() => {
        setIsScanLocked(false);
      }, 10);

      activeResetTimeoutRef.current = setTimeout(() => {
        setHudState('IDLE');
      }, 1500);
    }
  };

  return (
    <div id="counter-serving-terminal" className="relative w-full h-full bg-zinc-950 text-white select-none overflow-hidden">
      
      {/* 1. Fully-Immersive Viewport Feed */}
      <div className="absolute inset-0 w-full h-full z-0">
        <QRScanner 
          scannerState={hudState}
          onScan={handleQRScan}
          isDebouncing={isDebouncing}
        />
      </div>

      {/* 2. Minimal Floating Logout Action */}
      <button 
        onClick={() => {
          if (confirm('Are you sure you want to exit the scanning counter?')) {
            setIsStaffLoggedIn(false);
          }
        }}
        className="absolute top-6 left-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer shadow-lg"
        title="Exit Scanner"
      >
        <LogOut className="w-5 h-5" />
      </button>

      {/* 3. Minimalist Verification Success Overlay */}
      {hudState === 'SUCCESS' && hudPayload && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-none">
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-[scale-in_0.3s_ease-out]">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
                Authorized
              </span>
              <h2 className="text-lg font-black text-white uppercase tracking-wide leading-tight">
                {hudPayload.itemNames.join(', ')}
              </h2>
              <p className="text-zinc-400 text-xs font-medium uppercase font-mono">
                {hudPayload.studentName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Minimalist Verification Error Overlay */}
      {hudState === 'ERROR' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-none">
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-[scale-in_0.3s_ease-out]">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                Rejected
              </span>
              <p className="text-sm font-bold text-zinc-200 uppercase max-w-xs leading-relaxed">
                {hudMessage}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
