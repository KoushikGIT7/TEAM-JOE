/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import { 
  Clock, Users, AlertCircle, ChevronDown, ChevronUp, Zap, CheckCircle 
} from 'lucide-react';

export const AssistantSupervisorView: React.FC = () => {
  const { listenToActiveSupervisorOrders, markPartialItemsReady, menuItems } = useApp();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [expandedDrawers, setExpandedDrawers] = useState<{ [name: string]: boolean }>({});
  const [rushMode, setRushMode] = useState<boolean>(false);
  const [, setForceTick] = useState(0);

  // Live real-time subscription on mount
  useEffect(() => {
    if (typeof listenToActiveSupervisorOrders === 'function') {
      const unsubscribe = listenToActiveSupervisorOrders((updatedOrders) => {
        setActiveOrders(updatedOrders);
      });
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [listenToActiveSupervisorOrders]);

  // Periodic ticker to keep oldest wait times refreshing actively
  useEffect(() => {
    const timer = setInterval(() => {
      setForceTick(t => t + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Filter orders according to specification:
  // "Payment Filtering: The UI ignores unpaid orders unless their payment type is cash or transaction state is success"
  const filteredOrders = activeOrders.filter(o => {
    const paymentType = (o as any).paymentType || o.paymentMethod || 'WALLET';
    const paymentStatus = o.paymentStatus;
    
    // Ignore if not CASH and not SUCCESS/PAID
    if (paymentType !== 'CASH' && paymentStatus !== 'SUCCESS' && paymentStatus !== 'PAID') {
      return false;
    }
    
    // Active Status Filtering: Items with a status of SERVED are ignored
    if (o.status === 'SERVED') {
      return false;
    }
    
    return true;
  });

  // Food generic Emoji resolver matching your pattern:
  const getEmoji = (name: string): string => {
    const norm = name.toLowerCase();
    if (norm.includes('dosa')) return '🥞';
    if (norm.includes('rice') || norm.includes('biryani')) return '🍚';
    if (norm.includes('coke') || norm.includes('soda') || norm.includes('drink') || norm.includes('juice')) return '🥤';
    if (norm.includes('coffee') || norm.includes('tea')) return '☕';
    if (norm.includes('omelette') || norm.includes('egg')) return '🍳';
    if (norm.includes('idli')) return '🍙';
    if (norm.includes('burger')) return '🍔';
    if (norm.includes('sandwich')) return '🥪';
    if (norm.includes('pizza')) return '🍕';
    if (norm.includes('noodle')) return '🍜';
    if (norm.includes('vada')) return '🍩';
    return '🍽️';
  };

  // Demand Aggregation & Categorization
  const getAggregatedItems = () => {
    const map: { [name: string]: {
      name: string;
      itemId: string;
      itemType: 'batch' | 'dynamic';
      pendingCount: number;
      readyCount: number;
      students: { studentName: string; tokenNumber: string; quantity: number; timestamp: number; orderId: string }[];
      readyStudents: { studentName: string; tokenNumber: string; quantity: number; timestamp: number; orderId: string }[];
      oldestWaitMs: number;
    } } = {};

    filteredOrders.forEach(o => {
      let oTime = Date.parse(o.timestamp);
      if (isNaN(oTime)) oTime = Date.now();

      o.items.forEach(it => {
        const menuItem = menuItems.find(m => m.id === it.menuItemId);
        const name = it.name;
        const isDosa = /dosa/i.test(name);
        const isExplicitDynamic = (menuItem as any)?.itemType === 'dynamic';
        const isFast = menuItem?.isFast ?? true;
        const type: 'batch' | 'dynamic' = (isExplicitDynamic || isDosa || !isFast) ? 'dynamic' : 'batch';

        if (!map[name]) {
          map[name] = {
            name,
            itemId: it.menuItemId,
            itemType: type,
            pendingCount: 0,
            readyCount: 0,
            students: [],
            readyStudents: [],
            oldestWaitMs: 0
          };
        }

        const entry = map[name];
        if (o.status === 'QUEUED' || o.status === 'COOKING') {
          entry.pendingCount += it.quantity;
          entry.students.push({
            studentName: o.studentName,
            tokenNumber: o.tokenNumber,
            quantity: it.quantity,
            timestamp: oTime,
            orderId: o.id
          });
        } else if (o.status === 'READY') {
          entry.readyCount += it.quantity;
          entry.readyStudents.push({
            studentName: o.studentName,
            tokenNumber: o.tokenNumber,
            quantity: it.quantity,
            timestamp: oTime,
            orderId: o.id
          });
        }
      });
    });

    const itemsArray = Object.values(map);
    itemsArray.forEach(entry => {
      // FIFO Sort: oldest wait first
      entry.students.sort((a, b) => a.timestamp - b.timestamp);
      entry.readyStudents.sort((a, b) => a.timestamp - b.timestamp);
      
      if (entry.students.length > 0) {
        entry.oldestWaitMs = Math.max(0, Date.now() - entry.students[0].timestamp);
      } else {
        entry.oldestWaitMs = 0;
      }
    });

    return itemsArray;
  };

  const aggregatedItems = getAggregatedItems();

  // Section A: Active items sorted by total active demand (pendingCount + readyCount)
  const sortedByDemand = [...aggregatedItems].sort((a, b) => {
    return (b.pendingCount + b.readyCount) - (a.pendingCount + a.readyCount);
  });

  const totalDemandQuantity = sortedByDemand.reduce((acc, item) => acc + (item.pendingCount + item.readyCount), 0);

  // Section B: Filter only dynamic / on-demand items for active supervisor monitoring
  const dynamicItems = aggregatedItems.filter(item => item.itemType === 'dynamic');

  // Section C: Items with waiting active ready-students (Ready Queue)
  const readyQueueItems = aggregatedItems.filter(item => item.readyCount > 0 && item.readyStudents.length > 0);

  const formatWaitMinutes = (ms: number) => {
    return Math.floor(ms / 60000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 select-none font-sans text-white">
      
      {/* Upper Control Bar with Rush Hour trigger */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#111827]/80 border border-white/5 rounded-2xl p-5 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#b76dff] animate-pulse" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#cbd5e1] font-extrabold">LIVE KITCHEN SUPERVISOR</span>
          </div>
          <h2 className="font-display font-black text-xl text-white tracking-tight">
            Assistant Terminal
          </h2>
        </div>

        {/* ⚡ RUSH MODE TOGGLE BUTTON */}
        <button
          onClick={() => setRushMode(!rushMode)}
          className={`px-5 py-2.5 rounded-xl font-mono text-xs font-black tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
            rushMode 
              ? 'bg-amber-500 text-black border border-amber-400 font-extrabold animate-pulse' 
              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/15'
          }`}
        >
          <Zap className={`w-4 h-4 ${rushMode ? 'fill-black' : ''}`} />
          {rushMode ? '⚡ RUSH MODE: ON' : '⚡ RUSH MODE: OFF'}
        </button>
      </section>

      {/* Main Terminal Dashboard Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================================== */}
        {/* SECTION A: TODAY'S DEMAND (Col-span 4, Read-Only)            */}
        {/* ========================================================== */}
        <section className="lg:col-span-4 bg-[#111827]/90 border border-white/5 rounded-2xl p-5 flex flex-col h-fit">
          <div className="border-b border-white/5 pb-3 mb-4">
            <h3 className="font-display font-black text-sm tracking-widest text-slate-400 uppercase flex items-center gap-2 select-none">
              🔥 TODAY'S DEMAND
            </h3>
          </div>

          {sortedByDemand.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              🍴 No active supervisor demand recorded
            </div>
          ) : (
            <div className="space-y-3 font-mono">
              {sortedByDemand.map((meal) => (
                <div key={meal.name} className="flex justify-between items-center text-xs text-slate-200">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{getEmoji(meal.name)}</span>
                    <span className="font-sans font-medium uppercase tracking-wide truncate max-w-[140px] md:max-w-none">
                      {meal.name}
                    </span>
                  </div>
                  <span className="font-bold text-sm text-white select-none">
                    {meal.pendingCount + meal.readyCount}
                  </span>
                </div>
              ))}

              <div className="pt-3 border-t border-white/5 text-slate-400 text-[11px] font-mono tracking-widest uppercase select-none">
                ━━━━━━━━━━━━━━━━━━
                <div className="flex justify-between items-center mt-2 font-black text-slate-300">
                  <span>Total Items:</span>
                  <span className="text-base text-white">{totalDemandQuantity}</span>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#1f2937]/40 border border-white/5 rounded-xl p-3.5 mt-5 font-sans text-[10px] text-slate-400 leading-relaxed">
            💡 <span className="font-bold text-slate-300">Read-Only View.</span> Instantly coordinate meal preparation with active cooks without clicking dropdown controls or choosing filters.
          </div>
        </section>

        {/* ========================================================== */}
        {/* SECTION B: PREPARE ON DEMAND (Col-span 8, Active Queue)      */}
        {/* ========================================================== */}
        <section className="lg:col-span-8 space-y-6">
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="font-display font-black text-sm tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                🥞 PREPARE ON DEMAND
              </h3>
              <span className="font-mono text-[9px] text-[#b76dff] bg-[#b76dff]/10 px-2 py-0.5 rounded-full font-bold select-none">
                Interactive Deck
              </span>
            </div>

            {dynamicItems.length === 0 ? (
              <div className="bg-[#111827]/70 border border-white/5 rounded-2xl p-12 text-center text-slate-500 space-y-2">
                <CheckCircle className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="font-display font-bold text-sm text-white">All Clear</h4>
                <p className="font-sans text-xs text-slate-400">
                  No pending dynamic items (like Dosas) are currently configured. Listening for raw client tickets!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {dynamicItems.map((item) => {
                  const isExpanded = !!expandedDrawers[item.name];
                  const waitMinutes = formatWaitMinutes(item.oldestWaitMs);

                  // Color Code Strategy for wait time threshold:
                  // 0-5 mins: Gray text
                  // 5-10 mins: Orange text
                  // 10+ mins: Red text
                  let colorClass = "text-slate-400";
                  let borderHighlight = "border-white/5";
                  let isBlinking = false;

                  if (item.pendingCount > 0) {
                    if (waitMinutes >= 10) {
                      colorClass = "text-red-500 font-black";
                      borderHighlight = "border-red-500/20";
                      isBlinking = true;
                    } else if (waitMinutes >= 5) {
                      colorClass = "text-amber-500 font-bold";
                      borderHighlight = "border-amber-500/10";
                    }
                  }

                  return (
                    <div 
                      key={item.name} 
                      className={`bg-[#111827]/90 border ${borderHighlight} rounded-2xl p-5 md:p-6 transition-all duration-200 shadow-xl`}
                    >
                      <div className="space-y-4">
                        
                        {/* 1. ITEM NAME */}
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getEmoji(item.name)}</span>
                          <h4 className="font-display font-black text-base text-white tracking-tight uppercase">
                            {item.name}
                          </h4>
                        </div>

                        {/* 2. PENDING COUNT */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-[#182235] border border-white/5 rounded-xl p-3">
                            <span className="block font-mono text-[9px] text-[#cbd5e1] font-bold tracking-wider leading-none uppercase">
                              PENDING
                            </span>
                            <span className="block font-display font-black text-xl text-[#b76dff] mt-1 select-none">
                              {item.pendingCount}
                            </span>
                          </div>

                          {/* 3. WAIT TIME */}
                          <div className="bg-[#182235] border border-white/5 rounded-xl p-3">
                            <span className="block font-mono text-[9px] text-[#cbd5e1] font-bold tracking-wider leading-none uppercase">
                              OLDEST WAIT
                            </span>
                            <span className={`block font-display text-xl mt-1 select-none ${colorClass} ${isBlinking ? 'animate-pulse' : ''}`}>
                              {item.pendingCount > 0 ? `${waitMinutes} mins` : '--'}
                            </span>
                          </div>

                          {/* 4. READY COUNT */}
                          <div className="bg-[#182235] border border-white/5 rounded-xl p-3 col-span-2 sm:col-span-1">
                            <span className="block font-mono text-[9px] text-[#cbd5e1] font-bold tracking-wider leading-none uppercase">
                              READY FOR PICKUP
                            </span>
                            <span className="block font-display font-black text-xl text-[#4ae176] mt-1 select-none">
                              {item.readyCount}
                            </span>
                          </div>
                        </div>

                        {/* ACTION BUTTONS (Incremental READY triggers using FIFO) */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                          <button
                            onClick={() => {
                              if (typeof markPartialItemsReady === 'function') {
                                markPartialItemsReady(item.itemId, 1);
                              }
                            }}
                            disabled={item.pendingCount === 0}
                            className="flex-1 min-w-[90px] h-9 rounded-xl bg-[#b76dff] hover:bg-[#b76dff]/90 text-black text-xs font-mono font-black tracking-wider disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            +1 READY
                          </button>

                          <button
                            onClick={() => {
                              if (typeof markPartialItemsReady === 'function') {
                                markPartialItemsReady(item.itemId, Math.min(item.pendingCount, 3));
                              }
                            }}
                            disabled={item.pendingCount === 0}
                            className="flex-1 min-w-[90px] h-9 rounded-xl bg-[#4ae176] hover:bg-[#4ae176]/90 text-black text-xs font-mono font-black tracking-wider disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            +3 READY
                          </button>

                          <button
                            onClick={() => {
                              if (typeof markPartialItemsReady === 'function') {
                                markPartialItemsReady(item.itemId, Math.min(item.pendingCount, 5));
                              }
                            }}
                            disabled={item.pendingCount === 0}
                            className="flex-1 min-w-[90px] h-9 rounded-xl bg-orange-500 hover:bg-orange-400 text-black text-xs font-mono font-black tracking-wider disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            +5 READY
                          </button>

                          <button
                            onClick={() => {
                              if (typeof markPartialItemsReady === 'function') {
                                markPartialItemsReady(item.itemId, item.pendingCount);
                              }
                            }}
                            disabled={item.pendingCount === 0}
                            className="flex-1 min-w-[90px] h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-mono font-black tracking-wider disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            ALL READY
                          </button>
                        </div>

                        {/* 5. DETAILS DROPDOWN HEAD (Hidden entirely during Rush Hour Mode) */}
                        {!rushMode ? (
                          <div
                            onClick={() => setExpandedDrawers(prev => ({ ...prev, [item.name]: !isExpanded }))}
                            className="pt-2 flex justify-between items-center text-[10px] font-mono text-slate-400 font-bold select-none cursor-pointer hover:text-white transition-colors"
                          >
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-[#b76dff]" />
                              <span>STUDENTS WAITING ({item.students.length})</span>
                            </div>
                            <div className="flex items-center gap-1 uppercase tracking-wider">
                              <span>{isExpanded ? '▲ Hide Details' : '▼ View Details'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-slate-500 font-bold italic select-none text-right pt-2">
                            ⚡ Student names hidden by Rush Mode
                          </div>
                        )}

                        {/* Dropdown details content (Hidden in Rush Mode) */}
                        {!rushMode && isExpanded && (
                          <div className="bg-black/20 border-t border-white/5 rounded-xl p-3 mt-2 divide-y divide-white/5 space-y-2">
                            {item.students.length === 0 ? (
                              <p className="text-center py-4 font-sans text-xs text-slate-500">
                                No students currently in supervisor pending list.
                              </p>
                            ) : (
                              item.students.map((stud, idx) => {
                                const waitSec = Math.floor((Date.now() - stud.timestamp) / 1000);
                                const waitMin = Math.floor(waitSec / 60);
                                return (
                                  <div key={`${stud.orderId}-${idx}`} className="flex justify-between items-center pt-2 first:pt-0 font-mono text-xs">
                                    <div className="space-y-0.5">
                                      <p className="font-sans font-bold text-white uppercase tracking-wider">{stud.studentName}</p>
                                      <p className="text-[9px] text-[#cbd5e1] flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5 text-slate-400" />
                                        <span>Ordered: {new Date(stud.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-extrabold text-white text-[12px] block">Qty {stud.quantity}</span>
                                      <span className={`text-[9px] block ${waitMin >= 10 ? 'text-red-400 font-bold' : waitMin >= 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                                        Wait {waitMin}m {waitSec % 60}s
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================================== */}
            {/* SECTION C: READY QUEUE (Active Pickup Tracking)              */}
            {/* ========================================================== */}
            <div className="space-y-4 mt-8 pt-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="font-display font-black text-sm tracking-widest text-slate-300 uppercase flex items-center gap-1.5">
                  🥞 READY FOR COLLECTION
                </h3>
                <span className="font-mono text-[9px] text-[#4ae176] bg-[#4ae176]/10 px-2 py-0.5 rounded-full font-bold select-none">
                  Awaiting Scan Pickup
                </span>
              </div>

              {readyQueueItems.length === 0 ? (
                <div className="bg-[#111827]/40 border border-dashed border-white/5 rounded-2xl p-8 text-center text-slate-500 font-sans text-xs">
                  No meals waiting at the front hatch right now. As you click ready, they will sync here!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {readyQueueItems.map(item => (
                    <div key={`ready-${item.name}`} className="bg-[#111827]/90 border border-[#4ae176]/20 rounded-2xl p-4 space-y-3 shadow-lg">
                      <div className="flex justify-between items-center select-none border-b border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getEmoji(item.name)}</span>
                          <span className="font-display font-extrabold text-xs uppercase tracking-tight text-white">
                            {item.name}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#4ae176] bg-[#4ae176]/10 px-2.5 py-0.5 rounded-full font-bold">
                          Ready Students: {item.readyStudents.length}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                        {item.readyStudents.map((stud, idx) => (
                          <div key={`${stud.orderId}-${idx}`} className="flex justify-between items-center bg-[#182235]/40 px-2.5 py-1.5 rounded-xl border border-white/5">
                            <span className="font-sans font-semibold text-white uppercase tracking-wider">
                              {stud.studentName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Qty {stud.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[9.5px] font-mono text-slate-500 leading-normal text-center select-none pt-2 max-w-lg mx-auto">
                ⚡ <span className="font-bold">Auto Cleanup:</span> When a student shows their meal QR at the front counter scanner, the item automatically clears from the READY QUEUE. No manual markup required!
              </p>
            </div>

          </div>

        </section>

      </main>

    </div>
  );
};
