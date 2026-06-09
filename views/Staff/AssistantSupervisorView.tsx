import React, { useState, useEffect, useMemo } from 'react';
import { listenToActiveSupervisorOrders } from '../../services/firestore-db';
import { markPartialItemsReady } from '../../services/staff-v3';
import { Order, UserProfile } from '../../types';
import { LogOut, ChefHat, ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
}

interface StudentEntry {
  name: string;
  time: number;
  qty: number;
}

interface AggregatedItem {
  name: string;
  type: 'batch' | 'dynamic';
  pendingCount: number;
  readyCount: number;
  students: StudentEntry[];
  oldestWaitMs: number;
  pendingOrders: Order[]; 
}

const AssistantSupervisorView: React.FC<Props> = ({ profile, onLogout }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubOrders = listenToActiveSupervisorOrders((data) => {
      setOrders(data);
    });
    return () => {
      unsubOrders();
    };
  }, []);

  const aggregatedDemand = useMemo(() => {
    const map = new Map<string, AggregatedItem>();
    
    orders.forEach(o => {
      if (o.paymentType !== 'CASH' && o.paymentStatus !== 'SUCCESS') return;
      
      o.items.forEach(item => {
        if (item.status === 'SERVED') return;

        const key = item.name;
        if (!map.has(key)) {
          // Dynamic items are explicitly itemType: 'dynamic' OR anything containing 'dosa'
          const isDynamic = item.itemType === 'dynamic' || /dosa/i.test(item.name);
          map.set(key, { 
            name: key, 
            type: isDynamic ? 'dynamic' : 'batch', 
            pendingCount: 0, 
            readyCount: 0,
            students: [],
            oldestWaitMs: 0,
            pendingOrders: [] 
          });
        }
        
        const entry = map.get(key)!;
        
        if (item.status === 'READY') {
           entry.readyCount += (item.quantity || 1);
        } else {
           entry.pendingCount += (item.quantity || 1);
           
           if (!entry.pendingOrders.some(po => po.id === o.id)) {
             entry.pendingOrders.push(o);
           }

           const reQueuedAt = (item as any).reQueuedAt ? (typeof (item as any).reQueuedAt === 'number' ? (item as any).reQueuedAt : (item as any).reQueuedAt.toMillis?.() || Date.now()) : 0;
           const orderTime = reQueuedAt > 0 ? reQueuedAt : (typeof o.createdAt === 'number' ? o.createdAt : Date.now());
           entry.students.push({
             name: o.userName || 'Student',
             time: orderTime,
             qty: item.quantity || 1
           });
        }
      });
    });

    const now = Date.now();
    const sorted = Array.from(map.values()).map(entry => {
      entry.students.sort((a, b) => a.time - b.time);
      if (entry.students.length > 0) {
        entry.oldestWaitMs = now - entry.students[0].time;
      }
      return entry;
    });

    return sorted;
  }, [orders]);

  // For the summary section, we want ALL items sorted by highest pending + ready
  const allItemsSorted = useMemo(() => {
    return [...aggregatedDemand].sort((a, b) => (b.pendingCount + b.readyCount) - (a.pendingCount + a.readyCount));
  }, [aggregatedDemand]);

  // For the management section, we ONLY want dynamic items
  const dynamicItems = useMemo(() => {
    return aggregatedDemand
      .filter(i => i.type === 'dynamic' && (i.pendingCount > 0 || i.readyCount > 0))
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [aggregatedDemand]);

  const toggleExpand = (itemName: string) => {
    setExpandedItems(prev => ({ ...prev, [itemName]: !prev[itemName] }));
  };

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getWaitMins = (ms: number) => Math.floor(ms / 60000);

  const getWaitColor = (ms: number) => {
    const mins = getWaitMins(ms);
    if (mins < 5) return 'text-slate-200';
    if (mins < 10) return 'text-orange-400 font-bold';
    return 'text-red-500 font-black animate-pulse'; 
  };

  const handleMarkReady = async (itemName: string, count: number, pendingOrders: Order[]) => {
    if (isUpdating || count <= 0) return;
    setIsUpdating(true);
    try {
      await markPartialItemsReady(itemName, count, pendingOrders);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0f1115] text-white flex flex-col font-sans select-none overflow-hidden pb-12">
      
      {/* --- STICKY HEADER --- */}
      <header className="shrink-0 border-b border-white/5 bg-[#0f1115] z-50 p-4 flex justify-between items-center sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
            <ChefHat className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none text-white/90">Live Kitchen Demand</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Active: {orders.length}</span>
              <span className="w-1 h-1 bg-white/20 rounded-full" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* --- SECTION 1: KITCHEN DEMAND SUMMARY (READ ONLY) --- */}
        <div className="px-4 pt-6 pb-2">
          <div className="bg-[#1a1d24] border border-white/5 rounded-2xl p-5 shadow-2xl">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-orange-500 flex items-center gap-2 border-b border-white/5 pb-3">
              🔥 TODAY'S DEMAND
            </h2>
            
            {allItemsSorted.length === 0 ? (
              <p className="text-slate-500 font-bold uppercase tracking-widest text-center py-4 text-xs">No Active Orders</p>
            ) : (
              <div className="flex flex-col gap-3">
                {allItemsSorted.map(item => (
                  <div key={`summary-${item.name}`} className="flex justify-between items-center font-black bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-lg tracking-tight text-white/90 truncate pr-2">{item.name}</span>
                    <span className="text-2xl text-orange-400">{item.pendingCount + item.readyCount}</span>
                  </div>
                ))}
                <div className="pt-4 mt-2 border-t border-white/5 flex justify-between items-center font-black text-lg text-indigo-400">
                  <span className="uppercase tracking-widest text-sm">Total Items</span>
                  <span className="text-2xl">
                    {allItemsSorted.reduce((sum, item) => sum + item.pendingCount + item.readyCount, 0)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- SECTION 2: DYNAMIC ITEM MANAGEMENT --- */}
        {dynamicItems.length > 0 && (
          <div className="px-4 py-6">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-emerald-400 flex items-center gap-2 pt-2">
              <CheckCircle className="w-5 h-5" /> Prepare On Demand
            </h2>
            
            <div className="space-y-4">
              {dynamicItems.map(item => {
                const isExpanded = expandedItems[item.name];
                const waitColor = getWaitColor(item.oldestWaitMs);
                const hasPending = item.pendingCount > 0;

                return (
                  <div key={`dyn-${item.name}`} className="bg-[#16201b] border border-emerald-500/20 rounded-2xl overflow-hidden shadow-lg shadow-emerald-900/10">
                    <div className="p-5">
                      <h3 className="text-3xl font-black uppercase tracking-tighter text-emerald-50 mb-1">{item.name}</h3>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-black/30 p-3 rounded-xl border border-emerald-500/10 flex flex-col items-center justify-center">
                          <span className="text-xs font-bold text-emerald-500/70 uppercase tracking-widest mb-1">Pending</span>
                          <span className="text-4xl font-black text-emerald-100 leading-none">{item.pendingCount}</span>
                        </div>
                        <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 flex flex-col items-center justify-center">
                          <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Ready</span>
                          <span className="text-4xl font-black text-emerald-400 leading-none">{item.readyCount}</span>
                        </div>
                      </div>

                      {hasPending && (
                        <div className="flex justify-between items-center bg-black/30 p-3 rounded-xl mt-3 border border-emerald-500/10">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-500/50" /> Oldest Wait
                          </span>
                          <span className={`text-lg ${waitColor}`}>
                            {getWaitMins(item.oldestWaitMs)} Mins
                          </span>
                        </div>
                      )}

                      {/* Ready Controls */}
                      {hasPending && (
                        <div className="mt-4 pt-4 border-t border-emerald-500/10">
                          <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-3 text-center">Mark Orders Ready</p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleMarkReady(item.name, 1, item.pendingOrders)}
                              disabled={isUpdating}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl flex flex-col items-center justify-center transition-colors disabled:opacity-50 active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                              <span className="text-xl leading-none">+1</span>
                            </button>
                            <button 
                              onClick={() => handleMarkReady(item.name, 5, item.pendingOrders)}
                              disabled={isUpdating}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-4 rounded-xl flex flex-col items-center justify-center transition-colors disabled:opacity-50 active:scale-95 shadow-lg shadow-emerald-500/20"
                            >
                              <span className="text-xl leading-none">+5</span>
                            </button>
                            <button 
                              onClick={() => handleMarkReady(item.name, item.pendingOrders.length, item.pendingOrders)}
                              disabled={isUpdating}
                              className="flex-[1.5] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 active:scale-95 shadow-lg shadow-emerald-600/20 text-sm uppercase tracking-wider"
                            >
                              All Ready
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {hasPending && (
                      <>
                        <button 
                          onClick={() => toggleExpand(item.name)}
                          className="w-full px-5 py-4 bg-emerald-500/5 border-t border-emerald-500/10 flex items-center justify-center text-sm font-black tracking-widest uppercase text-emerald-500/70 hover:text-emerald-400 transition-colors active:bg-emerald-500/10 gap-2"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-4 h-4" /> Hide Details</>
                          ) : (
                            <><ChevronDown className="w-4 h-4" /> View Details</>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="bg-black/50 p-4 border-t border-emerald-500/10">
                            <ul className="space-y-2">
                              {item.students.map((student, idx) => (
                                <li key={idx} className="flex justify-between items-center font-bold bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/10">
                                  <div className="flex flex-col">
                                    <span className="text-emerald-50 text-base">{student.name}</span>
                                    <span className="text-emerald-500/70 text-xs">{formatTime(student.time)}</span>
                                  </div>
                                  <span className="text-lg text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md border border-emerald-500/20">
                                    Qty {student.qty}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AssistantSupervisorView;
