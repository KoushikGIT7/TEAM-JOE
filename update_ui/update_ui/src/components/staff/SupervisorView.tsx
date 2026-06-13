/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Users, KanbanSquare, Clock, Zap, ArrowRight, ShieldAlert, CheckCircle 
} from 'lucide-react';
import { Order } from '../../types';

export const SupervisorView: React.FC = () => {
  const { orders, updateOrderStatus, menuItems } = useApp();

  const [counter, setCounter] = useState(0);

  // Simple reactive ticks to sync order durations
  useEffect(() => {
    const timer = setInterval(() => {
      setCounter(prev => prev + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Filter orders waiting in queue for prep or pickup
  const activeOrders = orders.filter(o => o.status === 'QUEUED' || o.status === 'COOKING');

  // Compute wait duration dynamically and color it
  const getOldestWaitIndicator = () => {
    if (activeOrders.length === 0) return { label: '0 min wait', color: 'text-[#22c55e]', pulse: false };
    
    // Simulating oldest wait (either calculate or provide seeded wait ticks for realistic simulation)
    const seedWaitMinutes = activeOrders.length * 3 + 2; 

    if (seedWaitMinutes > 10) {
      return { label: `${seedWaitMinutes} mins waiting`, color: 'text-red-400 bg-red-400/10 border border-red-500/30 font-black', pulse: true };
    }
    if (seedWaitMinutes > 5) {
      return { label: `${seedWaitMinutes} mins wait`, color: 'text-amber-400 bg-amber-400/10 border border-amber-500/25', pulse: false };
    }
    return { label: `${seedWaitMinutes} mins wait`, color: 'text-[#cbd5e1] border border-white/5 bg-white/5', pulse: false };
  };

  const waitIndicator = getOldestWaitIndicator();

  // On-demand controls speed helpers
  const speedUpOldestQueue = (amountToClear: number) => {
    const sorted = [...activeOrders].reverse(); // oldest first (oldest is bottom of stack normally)
    const targets = sorted.slice(0, amountToClear);
    targets.forEach(o => {
      updateOrderStatus(o.id, 'READY');
    });
  };

  // Aggregating all items count across the ecosystem (Read-Only demand grid)
  const getReadOnlyEcosystemDemand = () => {
    const counts: { [name: string]: { count: number; category: string; image: string } } = {};
    menuItems.forEach(m => {
      counts[m.name] = { count: 0, category: m.category, image: m.image };
    });

    orders.filter(o => o.status !== 'SERVED').forEach(o => {
      o.items.forEach(it => {
        if (counts[it.name]) {
          counts[it.name].count += it.quantity;
        }
      });
    });

    return Object.entries(counts).map(([name, payload]) => ({ name, ...payload }));
  };

  const demandIndex = getReadOnlyEcosystemDemand();

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 select-none">
      
      {/* Top Greet heading */}
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <span className="font-mono text-[9px] text-[#818cf8] bg-[#818cf8]/15 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 animate-pulse w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8]" />
            Supervisor Console HUD Active
          </span>
          <h2 className="font-display text-lg font-black text-white">
            Ecosystem Controls
          </h2>
        </div>

        {/* Dynamic Wait timer card indicator */}
        <div className={`px-4 py-2 rounded-xl text-xs font-mono font-medium flex items-center gap-2 ${waitIndicator.color} ${waitIndicator.pulse ? 'animate-pulse' : ''}`}>
          <Clock className="w-4 h-4 shrink-0 text-brand-purple" />
          <span>OLDEST PENDING QUEUE:</span>
          <span>{waitIndicator.label}</span>
        </div>
      </section>

      {/* Main double split columns */}
      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column (2-spans) : Demand index tracking list */}
        <section className="md:col-span-2 space-y-4">
          <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
            <KanbanSquare className="w-4 h-4 text-brand-purple" />
            Ecosystem Active Demand Index (Live load)
          </h3>

          <div className="glass-bg glass-stroke rounded-2xl p-4 divide-y divide-white/5 space-y-3">
            {demandIndex.map(meal => (
              <div key={meal.name} className="flex justify-between items-center pt-3 first:pt-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-mid shrink-0 border border-white/5">
                    <img className="w-full h-full object-cover" alt={meal.name} src={meal.image} />
                  </div>
                  <div>
                    <h4 className="font-display font-medium text-xs text-white">{meal.name}</h4>
                    <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-wider">{meal.category}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-mono text-sm font-black ${meal.count > 0 ? 'text-brand-purple-light' : 'text-zinc-600'}`}>
                    {meal.count} queued
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Column: Speed controller trigger drawer & waiting list */}
        <section className="space-y-6">
          {/* Quick Override action panel */}
          <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-4">
            <div className="border-b border-white/5 pb-2">
              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-brand-green" />
                Live Counter Speed Up
              </h3>
              <p className="font-sans text-[10px] text-on-surface-variant leading-normal mt-0.5">
                Bypass standard kitchen loops to dispatch pending orders directly to the pickup locker.
              </p>
            </div>

            <div className="space-y-2 font-mono">
              <button
                onClick={() => speedUpOldestQueue(1)}
                disabled={activeOrders.length === 0}
                className="w-full h-10 rounded-xl bg-brand-purple hover:bg-brand-purple-light text-surface-lowest text-[10.5px] font-bold tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-md shadow-brand-purple/10"
              >
                SPEED UP OLDEST (+1)
              </button>

              <button
                onClick={() => speedUpOldestQueue(5)}
                disabled={activeOrders.length === 0}
                className="w-full h-10 rounded-xl bg-brand-green hover:bg-brand-green/85 text-brand-green-dark text-[10.5px] font-bold tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                SPEED UP BATCH (+5)
              </button>

              <button
                onClick={() => speedUpOldestQueue(activeOrders.length)}
                disabled={activeOrders.length === 0}
                className="w-full h-10 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-on-surface text-[10.5px] font-bold tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                ALL PENDING READY
              </button>
            </div>
          </div>

          {/* Waiting student drawer ledger */}
          <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-3.5">
            <div className="border-b border-white/5 pb-2">
              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-purple" />
                Waiting Students Drawer
              </h3>
            </div>

            {activeOrders.length === 0 ? (
              <div className="text-center py-6">
                <p className="font-sans text-[11px] text-zinc-500">No students currently in wait queues.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto hide-scrollbar divide-y divide-white/5">
                {activeOrders.map(order => (
                  <div key={order.id} className="pt-2.5 first:pt-0 font-mono text-[11px]">
                    <div className="flex justify-between font-bold text-white mb-0.5">
                      <span>{order.studentName.split(' ')[0]}</span>
                      <span className="text-brand-purple">{order.tokenNumber}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>{order.items.reduce((acc, c) => acc + c.quantity, 0)} plates</span>
                      <span>{order.timestamp.split(',')[1]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>

    </div>
  );
};
