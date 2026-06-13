/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ChefHat, Sparkles, AlertCircle, RefreshCw, CheckSquare 
} from 'lucide-react';
import { Order } from '../../types';

export const CookView: React.FC = () => {
  const { orders, updateOrderStatus, menuItems } = useApp();

  const [systemTime, setSystemTime] = useState('');
  const [selectedBatchMeal, setSelectedBatchMeal] = useState<string | null>(null);

  // Clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter orders currently awaiting prep ('QUEUED' or 'COOKING')
  const prepOrders = orders.filter(o => o.status === 'QUEUED' || o.status === 'COOKING');

  // Aggregating food counts for cooking demand blocks
  const getAggregatedDemand = () => {
    const demand: { [name: string]: { name: string; count: number; ids: string[]; image: string } } = {};
    
    prepOrders.forEach(o => {
      o.items.forEach(it => {
        const itemInfo = menuItems.find(m => m.id === it.menuItemId);
        if (!itemInfo) return;

        if (demand[it.name]) {
          demand[it.name].count += it.quantity;
          demand[it.name].ids.push(o.id);
        } else {
          demand[it.name] = {
            name: it.name,
            count: it.quantity,
            ids: [o.id],
            image: itemInfo.image
          };
        }
      });
    });

    return Object.values(demand);
  };

  const batches = getAggregatedDemand();

  // Clear single increments or whole bundle
  const dispatchBatchReady = (ids: string[], countToClear: number) => {
    // Dispatch selected amount of orders to 'READY' status
    const idsToClear = ids.slice(0, countToClear);
    idsToClear.forEach(id => {
      updateOrderStatus(id, 'READY');
    });
    setSelectedBatchMeal(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 select-none">
      
      {/* Top sticky app bar */}
      <section className="flex justify-between items-center border-b border-white/5 pb-4">
        <div className="space-y-1">
          <span className="font-mono text-[9px] text-[#ef4444] bg-[#ef4444]/15 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            KITCHEN DISPATCH TERMINAL LIVE
          </span>
          <h2 className="font-display text-lg font-black text-white">
            Cook Terminal Engine
          </h2>
        </div>

        {/* Realtime clock ticker */}
        <div className="text-right">
          <span className="font-mono text-xs text-brand-green font-extrabold block">
            {systemTime || 'CLOCK INITIATING...'}
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest leading-none">
            REALTIME LOG SYNC
          </span>
        </div>
      </section>

      {/* Main demand visual dashboard */}
      <main className="space-y-4">
        {batches.length === 0 ? (
          // All clear view
          <div className="text-center py-24 glass-stroke glass-bg rounded-2xl space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-brand-green/15 border border-brand-green flex items-center justify-center mx-auto text-brand-green animate-bounce">
              <CheckSquare className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-extrabold text-white">"ALL CLEAR!"</h3>
              <p className="font-sans text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Outstanding orders cleared. Take a sip of tea. Cooking queues update automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[#ebd88d]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="font-sans">
                <strong>Batch Mode Enabled:</strong> Orders are bundled automatically per meal type to help you prepare food efficiently.
              </p>
            </div>

            {/* Cooking demand blocks grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {batches.map(bt => {
                const isSelected = selectedBatchMeal === bt.name;
                return (
                  <div 
                    key={bt.name}
                    className={`rounded-2xl overflow-hidden border transition-all ${
                      isSelected 
                        ? 'border-brand-green shadow-lg shadow-brand-green/5' 
                        : 'glass-stroke glass-bg hover:border-brand-purple/20'
                    }`}
                  >
                    {/* Cover image header */}
                    <div className="relative h-28 overflow-hidden select-none">
                      <img className="w-full h-full object-cover" alt={bt.name} src={bt.image} />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface-mid to-transparent opacity-90" />
                      
                      {/* Big circle volume badge count */}
                      <div className="absolute bottom-3 left-3 bg-brand-purple text-surface-lowest px-3 py-1 rounded-full font-mono font-black text-xs shadow-md">
                        {bt.count}x PREP DEMAND
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-display font-extrabold text-[#cbd5e1] leading-tight text-white mb-0.5">
                          {bt.name}
                        </h3>
                        <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
                          Active cooking tickets: {bt.ids.length}
                        </span>
                      </div>

                      {/* Expand segments triggers */}
                      {isSelected ? (
                        <div className="space-y-2 pt-2 border-t border-white/5 font-mono">
                          <span className="text-[9px] text-zinc-400 block font-bold uppercase">
                            Dispatch Ready Counter Qty:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {/* Increment options based on count scope */}
                            {Array.from({ length: Math.min(bt.count, 5) }, (_, i) => i + 1).map(num => (
                              <button
                                key={num}
                                onClick={() => dispatchBatchReady(bt.ids, num)}
                                className="px-2.5 py-1 text-[10px] rounded-md font-bold bg-brand-green hover:bg-brand-green/85 text-brand-green-dark cursor-pointer shrink-0"
                              >
                                +{num} READY
                              </button>
                            ))}
                            <button
                              onClick={() => dispatchBatchReady(bt.ids, bt.count)}
                              className="px-2.5 py-1 text-[10px] rounded-md font-bold bg-brand-purple hover:bg-brand-purple-light text-surface-lowest cursor-pointer shrink-0"
                            >
                              ALL ({bt.count})
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-white/5 flex gap-2">
                          {bt.count === 1 ? (
                            <button
                              onClick={() => dispatchBatchReady(bt.ids, 1)}
                              className="w-full h-9 rounded-lg bg-brand-green hover:bg-brand-green/85 text-brand-green-dark font-mono text-[10px] font-bold tracking-wider flex items-center justify-center cursor-pointer"
                            >
                              DISPATCH READY
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedBatchMeal(bt.name)}
                              className="w-full h-9 rounded-lg bg-surface-high hover:bg-zinc-700 text-on-surface font-mono text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-white/5"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-brand-purple" />
                              BATCH SPLIT ACTIONS
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

    </div>
  );
};
