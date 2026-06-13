/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { 
  ArrowLeft, Clock, ShoppingCart, CheckCircle2, 
  RotateCcw, Sparkles, AlertCircle, Eye 
} from 'lucide-react';

interface OrdersViewProps {
  onBackToMenu: () => void;
  onNavigateToTracking: (orderId: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ onBackToMenu, onNavigateToTracking }) => {
  const { orders } = useApp();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-amber-400/10 border-amber-400/30 text-amber-300';
      case 'COOKING':
        return 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300 animate-pulse';
      case 'READY':
        return 'bg-brand-green/20 border-brand-green/45 text-brand-green font-bold animate-pulse';
      case 'SERVED':
        return 'bg-white/5 border-white/5 text-on-surface-variant';
      default:
        return 'bg-white/5 border-white/5 text-on-surface-variant';
    }
  };

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* Greet Greet App Bar Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <button
          onClick={onBackToMenu}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-brand-purple" />
        </button>
        <h1 className="font-display text-lg font-black text-white leading-none">
          Receipts & History
        </h1>
      </header>

      {/* Main timeline listing */}
      <main className="px-5 mt-4 space-y-4 max-w-lg mx-auto">
        {orders.length === 0 ? (
          // Empty state display
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-high flex items-center justify-center mx-auto border border-white/5">
              <ShoppingCart className="w-6 h-6 text-brand-purple-light" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-white">"Kitchen is quiet..."</h3>
              <p className="font-sans text-xs text-on-surface-variant/80 max-w-xs mx-auto">
                No purchases logged yet. Head over to our smart menu to place your very first food request!
              </p>
            </div>
            <button
              onClick={onBackToMenu}
              className="px-5 py-2.5 bg-brand-purple hover:bg-brand-purple-light text-surface-lowest font-mono text-xs font-bold rounded-full transition-colors cursor-pointer"
            >
              ORDER MEALS NOW
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const active = order.status !== 'SERVED';
              return (
                <div
                  key={order.id}
                  className={`p-4 rounded-xl border transition-all ${
                    order.status === 'READY' 
                      ? 'border-brand-green bg-brand-green-dark/5' 
                      : 'glass-stroke glass-bg'
                  }`}
                >
                  {/* Card head: order numeric reference, timestamp */}
                  <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">
                          TOKEN {order.tokenNumber}
                        </span>
                        <span className="font-mono text-[9px] text-zinc-500">•</span>
                        <span className="font-mono text-[9px] text-zinc-400">
                          {order.paymentMethod} • {order.paymentStatus}
                        </span>
                      </div>
                      <span className="font-sans text-[10px] text-on-surface-variant">
                        {order.timestamp}
                      </span>
                    </div>

                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold border ${getStatusStyle(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Card body: list item summaries */}
                  <div className="py-3 space-y-1 text-xs">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-on-surface-variant">
                        <span className="font-sans font-medium text-white/95">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-mono text-xs">${(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Card bottom footer detail & checkout triggers */}
                  <div className="pt-2.5 border-t border-white/5 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="font-sans text-[9px] text-zinc-500 uppercase tracking-widest">
                        Total debited
                      </span>
                      <span className="font-mono text-sm font-black text-brand-purple-light">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>

                    {active ? (
                      <button
                        onClick={() => onNavigateToTracking(order.id)}
                        className="px-4 py-1.5 rounded-full bg-brand-purple hover:bg-brand-purple-light text-surface-lowest text-xs font-mono font-bold tracking-wider flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        TRACK CODE
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 text-[9.5px] font-mono text-brand-green font-bold">
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
