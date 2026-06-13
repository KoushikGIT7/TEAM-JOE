/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { Order } from '../../types';
import { listenToAllUserOrders } from '../../services/firestore-db';
import { getOrderStatusMessage, getOrderUIState, shouldShowQR } from '../../utils/orderLifecycle';
import { 
  ArrowLeft, Clock, ShoppingCart, CheckCircle2, 
  RotateCcw, Sparkles, AlertCircle, Eye, Receipt, QrCode
} from 'lucide-react';

interface OrdersViewProps {
  profile?: any;
  onBack?: () => void;
  onQROpen?: (orderId: string) => void;
  onBackToMenu?: () => void;
  onNavigateToTracking?: (orderId: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ 
  profile, 
  onBack, 
  onQROpen, 
  onBackToMenu, 
  onNavigateToTracking 
}) => {
  const { orders: contextOrders } = useApp();
  const { profile: authProfile } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>(contextOrders);
  const [loading, setLoading] = useState(orders.length === 0);

  const activeUserId = profile?.uid || authProfile?.uid;

  useEffect(() => {
    if (!activeUserId) {
      setLoading(false);
      return;
    }
    const unsub = listenToAllUserOrders(activeUserId, (data) => {
      const sorted = [...data].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(sorted);
      setLoading(false);
    });
    return unsub;
  }, [activeUserId]);

  const handleBack = () => {
    if (onBack) onBack();
    else if (onBackToMenu) onBackToMenu();
  };

  const handleTrack = (orderId: string) => {
    if (onQROpen) onQROpen(orderId);
    else if (onNavigateToTracking) onNavigateToTracking(orderId);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-amber-400/10 border-amber-400/30 text-amber-300';
      case 'COOKING':
      case 'IN_PROGRESS':
        return 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300 animate-pulse';
      case 'READY':
        return 'bg-brand-green/20 border-brand-green/45 text-brand-green font-bold animate-pulse';
      case 'SERVED':
      case 'COMPLETED':
        return 'bg-white/5 border-white/5 text-zinc-500';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-red-500/10 border-red-500/25 text-red-400';
      default:
        return 'bg-white/5 border-white/5 text-zinc-400';
    }
  };

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface max-w-md mx-auto border-x border-white/5 shadow-2xl">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-brand-purple" />
        </button>
        <h1 className="font-display text-lg font-black text-white leading-none">
          Receipts & History
        </h1>
      </header>

      {/* Main timeline listing */}
      <main className="px-5 mt-4 space-y-4">
        {loading ? (
          <div className="text-center py-20">
            <Sparkles className="w-10 h-10 text-brand-purple animate-spin mx-auto" />
            <span className="text-xs font-mono text-zinc-400 mt-2 block">Syncing order timeline...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-high flex items-center justify-center mx-auto border border-white/5">
              <ShoppingCart className="w-6 h-6 text-brand-purple-light" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-white">"Kitchen is quiet..."</h3>
              <p className="font-sans text-xs text-zinc-400 max-w-xs mx-auto mt-1 leading-relaxed">
                No purchases logged yet. Head over to our smart menu to place your very first food request!
              </p>
            </div>
            <button
              onClick={handleBack}
              className="px-5 py-2.5 bg-brand-purple hover:bg-brand-purple-light text-surface-lowest font-mono text-xs font-bold rounded-full transition-colors cursor-pointer"
            >
              ORDER MEALS NOW
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const active = order.orderStatus !== 'SERVED' && order.orderStatus !== 'COMPLETED' && order.orderStatus !== 'CANCELLED' && order.orderStatus !== 'REJECTED' && order.orderStatus !== 'ABANDONED';
              const dateObj = new Date(order.createdAt);
              const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const statusMsg = getOrderStatusMessage(order);

              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    order.serveFlowStatus === 'READY' 
                      ? 'border-brand-green bg-brand-green-dark/5' 
                      : 'glass-stroke glass-bg bg-[#171f33]/30'
                  }`}
                >
                  {/* Card head: order numeric reference, timestamp */}
                  <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="font-mono text-[9px] text-zinc-600">•</span>
                        <span className="font-mono text-[9px] text-zinc-400">
                          {order.paymentType} • {order.paymentStatus}
                        </span>
                      </div>
                      <span className="font-sans text-[10px] text-zinc-400 mt-1 block">
                        {formattedDate} • {formattedTime}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-md text-[9px] font-mono font-bold border leading-none uppercase ${getStatusStyle(order.orderStatus)}`}>
                      {statusMsg}
                    </span>
                  </div>

                  {/* Card body: list item summaries */}
                  <div className="py-3.5 space-y-2 text-xs border-b border-white/5">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-zinc-300">
                        <span className="font-sans font-medium text-white/95">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">₹{(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Card bottom footer detail */}
                  <div className="pt-2.5 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-sans text-[9px] text-zinc-500 uppercase tracking-widest leading-none">
                        Total debited
                      </span>
                      <span className="font-mono text-sm font-black text-brand-purple-light mt-1.5 leading-none">
                        ₹{(order.totalAmount || 0).toFixed(2)}
                      </span>
                    </div>

                    {active ? (
                      <button
                        onClick={() => handleTrack(order.id)}
                        className="px-4 py-1.5 rounded-full bg-brand-purple hover:bg-brand-purple-light text-surface-lowest text-xs font-mono font-black tracking-wider flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        TRACK TOKEN
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-[9.5px] font-mono text-brand-green font-bold select-none">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                        HANDOVER DONE
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default OrdersView;
