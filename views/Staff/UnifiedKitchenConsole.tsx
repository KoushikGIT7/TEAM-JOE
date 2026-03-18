import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  CheckCircle, Zap, Clock, Search, Camera, X, ChefHat, 
  UtensilsCrossed, Timer, AlertCircle, ChevronRight, 
  ArrowRight, ShieldCheck, RefreshCw, Layers, Users, 
  PackageCheck, Flame, Sparkles, LogOut, LayoutDashboard, XCircle
} from 'lucide-react';
import { UserProfile, Order, PrepBatch, PrepBatchStatus, CartItem } from '../../types';
import {
  listenToBatches,
  updateSlotStatus,
  validateQRForServing,
  serveItemBatch,
  serveFullOrder,
  rejectOrderFromCounter,
  listenToActiveOrders,
  flushMissedPickups,
  toggleQrRedeemable
} from '../../services/firestore-db';
import { initializeScanner, getScanner } from '../../services/scanner';
import QRScanner from '../../components/QRScanner';

interface UnifiedKitchenConsoleProps {
  profile: UserProfile;
  onLogout: () => void;
}

// Helper to format slot
const formatSlot = (slot: number) => {
    const s = slot.toString().padStart(4, '0');
    return `${s.slice(0, 2)}:${s.slice(2)}`;
};

const UnifiedKitchenConsole: React.FC<UnifiedKitchenConsoleProps> = ({ profile, onLogout }) => {
  // --- STATE ---
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushCount, setFlushCount] = useState<number | null>(null);
  const [scanQueue, setScanQueue] = useState<string[]>([]);

  // Derived focus: Index 0 is active, others are in queue
  const focusedOrderId = useMemo(() => scanQueue[0] || null, [scanQueue]);
  const nextInQueueIds = useMemo(() => scanQueue.slice(1), [scanQueue]);
  
  const scannedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return activeOrders.find(o => o.id === focusedOrderId) || null;
  }, [activeOrders, focusedOrderId]);

  const queuePreviewOrders = useMemo(() => {
    return nextInQueueIds.map(id => activeOrders.find(o => o.id === id)).filter(Boolean) as Order[];
  }, [activeOrders, nextInQueueIds]);

  // --- REFS ---
  const scanReviewRef = useRef<HTMLDivElement>(null);
  const lastScanTimestamp = useRef<number>(0);

  // --- TIME, SCANNER & MAINTENANCE ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);

    // 🤖 Autonomous Maintenance Heartbeat (Runs every 30s)
    const maintenance = setInterval(async () => {
        try {
            await flushMissedPickups(profile.uid);
        } catch (err) {}
    }, 30000);

    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true });
    scanner.onScan((data) => handleQRScan(data));
    return () => {
        clearInterval(t);
        clearInterval(maintenance);
        scanner.destroy();
    };
  }, []);

  // --- LISTENERS ---
  useEffect(() => {
    const unsubBatches = listenToBatches(setBatches);
    const unsubOrders = listenToActiveOrders(setActiveOrders);
    return () => {
        unsubBatches();
        unsubOrders();
    };
  }, []);

  // --- HANDLERS ---
  const handleQRScan = async (data: string) => {
    if (!data?.trim() || isScanning) return;
    
    // 🛡️ SCAN THROTTLING: Prevent repeated scans within 500ms (High Throughput)
    const now = Date.now();
    if (now - lastScanTimestamp.current < 500) return;
    lastScanTimestamp.current = now;

    setIsScanning(true);
    setError(null);
    try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        const order = await validateQRForServing(data);
        
        setScanQueue(prev => {
            const exists = prev.includes(order.id);
            if (exists) {
                // 🔄 DUPLICATE HANDLING: Bring to front (Active Focus)
                return [order.id, ...prev.filter(id => id !== order.id)];
            } else {
                // 📩 SCAN QUEUE: Add to end (Do not replace active)
                return [...prev, order.id];
            }
        });

        // Auto-scroll to scan result
        setTimeout(() => {
            scanReviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } catch (err: any) {
        setError(err.message || 'Scan Failed');
    } finally {
        setIsScanning(false);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    try {
        await serveItemBatch(orderId, itemId, qty, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate(50);

        // The local state update is no longer needed as the listener updates the DB state
        // and our memoized scannedOrder will reflect it automatically.
        if (scannedOrder?.id === orderId) {
            const newItems = scannedOrder.items.map(i => {
                if (i.id === itemId) {
                    const s = (i.servedQty || 0) + qty;
                    return { ...i, servedQty: s, remainingQty: i.quantity - s };
                }
                return i;
            });
            const allDone = newItems.every(item => {
              const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
              return rem <= 0;
            });
            if (allDone) {
                setTimeout(() => {
                  setScanQueue(prev => prev.filter(id => id !== orderId));
                }, 1200);
            }
        }
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    }
  };

  const handleServeAll = async (orderId: string) => {
    try {
        setScanQueue(prev => prev.filter(id => id !== orderId));
        await serveFullOrder(orderId, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    }
  };

  const handleFlushMissed = async () => {
    setIsFlushing(true);
    try {
        const count = await flushMissedPickups(profile.uid);
        setFlushCount(count);
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        setTimeout(() => setFlushCount(null), 3000);
    } catch (err: any) {
        setError(err.message || 'Flush Failed');
    } finally {
        setIsFlushing(false);
    }
  };

  // --- DERIVED DATA ---

  // 1. Current Active Batch (Nearest slot that is not READY)
  const activeBatchSlot = useMemo(() => {
    const preparing = batches.find(b => b.status === 'PREPARING' || b.status === 'ALMOST_READY');
    if (preparing) return preparing.arrivalTimeSlot;
    const queued = batches.find(b => b.status === 'QUEUED');
    return queued?.arrivalTimeSlot || null;
  }, [batches]);

  const activeBatchSlotBatches = useMemo(() => {
    if (!activeBatchSlot) return [];
    return batches.filter(b => b.arrivalTimeSlot === activeBatchSlot);
  }, [batches, activeBatchSlot]);

  const activeBatchStatus = activeBatchSlotBatches[0]?.status || 'QUEUED';

  const activeBatchItems = useMemo(() => {
    if (!activeBatchSlot) return [];
    // Aggregate by itemId
    const agg: Record<string, { id: string; itemName: string; quantity: number; imageUrl: string }> = {};
    activeBatchSlotBatches.forEach(b => {
        if (!agg[b.itemId]) agg[b.itemId] = { id: b.itemId, itemName: b.itemName, quantity: 0, imageUrl: '' };
        agg[b.itemId].quantity += b.quantity;
    });
    return Object.values(agg);
  }, [activeBatchSlotBatches]);

  // 2. Ready to Serve Aggregation (Grouped by item name for server)
  const readyPool = useMemo(() => {
    const pool: Record<string, { name: string; total: number; imageUrl: string; orderIds: string[] }> = {};
    activeOrders.forEach(order => {
        order.items.forEach(item => {
            const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
            if (rem > 0) {
                if (!pool[item.id]) {
                    pool[item.id] = { name: item.name, total: 0, imageUrl: item.imageUrl, orderIds: [] };
                }
                pool[item.id].total += rem;
                pool[item.id].orderIds.push(order.id);
            }
        });
    });
    return Object.values(pool).sort((a, b) => b.total - a.total);
  }, [activeOrders]);

  // 3. Upcoming Batches
  const upcomingBatches = useMemo(() => {
    if (!activeBatchSlot) return batches;
    return batches.filter(b => b.arrivalTimeSlot > activeBatchSlot);
  }, [batches, activeBatchSlot]);

  // 3. Upcoming Pipeline ( situational awareness)
  const upcomingPipeline = useMemo(() => {
    if (!activeBatchSlot) return batches.slice(0, 10);
    return batches.filter(b => b.arrivalTimeSlot > activeBatchSlot).slice(0, 10);
  }, [batches, activeBatchSlot]);

  // --- RENDER ---
  return (
    <div className="h-screen w-screen bg-[#020202] text-white flex flex-col overflow-hidden font-sans selection:bg-primary/30">
      
      {/* 🚀 ZONE 1: SCAN ZONE (TOP) - GLOBAL CONTROL */}
      <header className="h-[12vh] bg-black border-b border-white/5 px-10 flex items-center justify-between z-50">
        <div className="flex items-center gap-12">
            <div className="flex flex-col">
                <h1 className="text-4xl font-black italic tracking-tighter leading-none">JOE<span className="text-primary not-italic">.</span></h1>
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mt-1">KITCHEN OPS</span>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-3xl px-8 py-4 focus-within:border-primary/50 transition-all group shadow-inner">
                <Search className="w-6 h-6 text-gray-500 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="SCAN TOKEN CODE..."
                    className="bg-transparent border-none outline-none font-black text-2xl placeholder:text-white/5 tracking-[0.2em] uppercase w-96"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleQRScan((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                        }
                    }}
                />
            </div>
        </div>

        <div className="flex items-center gap-12">
            <div className="flex flex-col items-end">
                <p className="text-4xl font-black font-mono tracking-tighter text-white/90">
                    {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </p>
                <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_#22c55e] animate-pulse" />
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">{profile.name} • {profile.role}</p>
                </div>
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div className="flex items-center gap-4">
                <button
                    onClick={handleFlushMissed}
                    disabled={isFlushing}
                    className={`h-16 px-6 rounded-2xl border transition-all flex items-center gap-3 active:scale-95 ${
                        flushCount !== null ? 'bg-green-500 border-green-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'
                    }`}
                >
                    {isFlushing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Clock className="w-5 h-5" />}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                        {isFlushing ? 'CLEANING...' : flushCount !== null ? `${flushCount} DONE` : 'CLEANUP'}
                    </span>
                </button>
                
                <button onClick={onLogout} className="h-16 w-16 bg-red-600/10 hover:bg-red-600/30 rounded-2xl border border-red-600/20 text-red-500 transition-all active:scale-95 flex items-center justify-center">
                    <LogOut className="w-6 h-6" />
                </button>
            </div>
        </div>
      </header>

      {/* MID SECTION: DUAL-WING LAYOUT */}
      <div className="h-[68vh] flex overflow-hidden">
          
          {/* 🥘 ZONE 2: PREP ZONE (LEFT) - KITCHEN WING */}
          <section className="w-[45%] border-r border-white/5 bg-[#050505] p-10 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                      <div className="w-2 h-10 bg-amber-500 rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)]" />
                      <div className="flex flex-col">
                        <h3 className="text-3xl font-black uppercase tracking-[0.2em] italic">Current Prep</h3>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Aggregated Kitchen Load</p>
                      </div>
                  </div>
                  {activeBatchSlot && (
                      <div className="bg-amber-500 text-black px-8 py-3 rounded-2xl text-4xl font-black font-mono leading-none shadow-2xl">
                          {formatSlot(activeBatchSlot)}
                      </div>
                  )}
              </div>

              {!activeBatchSlot ? (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                      <ChefHat className="w-40 h-40 mb-8" />
                      <p className="text-2xl font-black uppercase tracking-[0.5em]">No Live Queue</p>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col justify-between">
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-4">
                          {activeBatchItems.map(item => (
                              <div key={item.id} className="bg-white/[0.03] border border-white/5 p-8 rounded-[3rem] flex items-center justify-between group hover:bg-white/[0.06] transition-all">
                                  <div className="flex items-center gap-8">
                                      <div className="w-20 h-20 rounded-3xl bg-black border border-white/10 overflow-hidden shadow-2xl group-hover:scale-105 transition-transform">
                                          <img src={(item as any).imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'} className="w-full h-full object-cover" alt="" />
                                      </div>
                                      <h4 className="text-3xl font-black italic tracking-tighter">{item.itemName}</h4>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-7xl font-black text-amber-500 italic leading-none">×{item.quantity}</span>
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1">Total Needed</span>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="pt-8 grid grid-cols-2 gap-6 pb-2">
                          <button 
                            onClick={() => updateSlotStatus(activeBatchSlot, 'PREPARING')}
                            disabled={activeBatchStatus !== 'QUEUED'}
                            className="h-28 bg-amber-500 text-black font-black uppercase tracking-[0.3em] text-sm rounded-[2.5rem] shadow-[0_0_60px_rgba(245,158,11,0.2)] active:scale-95 disabled:opacity-10 transition-all flex flex-col items-center justify-center gap-1"
                          >
                             <Flame className="w-6 h-6 mb-1" /> START COOKING
                          </button>
                          <button 
                            onClick={() => updateSlotStatus(activeBatchSlot, 'READY')}
                            disabled={activeBatchStatus !== 'PREPARING' && activeBatchStatus !== 'ALMOST_READY'}
                            className="h-28 bg-green-500 text-white font-black uppercase tracking-[0.3em] text-sm rounded-[2.5rem] shadow-[0_0_60px_rgba(34,197,94,0.3)] active:scale-95 disabled:opacity-10 transition-all flex flex-col items-center justify-center gap-1"
                          >
                             <Zap className="w-6 h-6 fill-current mb-1" /> BATCH READY
                          </button>
                      </div>
                  </div>
              )}
          </section>

          {/* ⚡ ZONE 3: SERVE ZONE (RIGHT) - COUNTER WING */}
          <section className="w-[55%] bg-black p-10 relative overflow-hidden flex flex-col">
              {/* Dynamic Glow based on Scanner Status */}
              <div className={`absolute top-0 right-0 w-[600px] h-[600px] blur-[180px] -mr-64 -mt-64 rounded-full pointer-events-none transition-colors duration-1000 ${
                scannedOrder ? 'bg-primary/20' : 'bg-primary/5'
              }`} />

              {/* 🕒 ZONE 3.1: QUEUE PREVIEW (STILL ZONE) */}
              <div className="flex items-center gap-4 mb-6 overflow-x-auto no-scrollbar scroll-smooth">
                   {queuePreviewOrders.map((qOrder, idx) => (
                       <div 
                         key={qOrder.id}
                         onClick={() => setScanQueue(prev => [qOrder.id, ...prev.filter(id => id !== qOrder.id)])}
                         className="flex-shrink-0 bg-white/5 border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3 hover:bg-white/10 transition-all cursor-pointer group"
                       >
                           <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                           <span className="text-[10px] font-black font-mono text-white/60 tracking-tighter">#{qOrder.id.slice(-4).toUpperCase()}</span>
                       </div>
                   ))}
              </div>

              {scannedOrder ? (
                  <div className="flex-1 flex flex-col animate-in slide-in-from-right duration-500 relative z-10" ref={scanReviewRef}>
                      <div className="flex items-center justify-between mb-12">
                          <div className="flex items-center gap-8">
                            <div className="w-24 h-24 rounded-[2.5rem] bg-primary flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.4)] animate-pulse">
                                <Sparkles className="w-12 h-12 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.6em] mb-2">Authenticated Verification ✓</p>
                                <h2 className="text-8xl font-black italic tracking-tighter leading-none mb-1">#{scannedOrder.id.slice(-6).toUpperCase()}</h2>
                                <p className="text-3xl font-black text-white/40 tracking-tight">{scannedOrder.userName}</p>
                            </div>
                          </div>
                          <button onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all active:scale-90">
                              <X className="w-10 h-10" />
                          </button>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-6">
                          <div className="grid grid-cols-1 gap-6 pb-6">
                              {scannedOrder.items.map(item => {
                                  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
                                  const done = rem <= 0;
                                  return (
                                      <div key={item.id} className={`p-10 rounded-[4rem] border-2 flex items-center justify-between transition-all duration-500 overflow-hidden relative group ${
                                          done ? 'bg-green-500/10 border-green-500/20 opacity-40' : 'bg-white/5 border-white/5 hover:border-primary/40'
                                      }`}>
                                          <div className="flex items-center gap-8">
                                              <div className="w-24 h-24 rounded-[2rem] overflow-hidden border border-white/20 shadow-2xl relative">
                                                  <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                                                  {done && <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center"><CheckCircle className="w-12 h-12 text-white" /></div>}
                                              </div>
                                              <div>
                                                  <h4 className="text-3xl font-black italic tracking-tighter leading-none mb-2">{item.name}</h4>
                                                  <div className="flex items-center gap-3">
                                                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Batch: {scannedOrder.batchId ? scannedOrder.batchId.slice(-4) : 'POOL'}</span>
                                                      <div className="w-1 h-1 rounded-full bg-gray-700" />
                                                      <span className={`text-[10px] font-black uppercase tracking-widest ${done ? 'text-green-500' : 'text-primary animate-pulse'}`}>
                                                        {done ? 'Fulfilled' : 'Awaiting Service'}
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-10">
                                              <div className="text-right">
                                                  <p className={`text-7xl font-black italic leading-none ${done ? 'text-green-500' : 'text-primary'}`}>
                                                      {done ? '✓' : rem}
                                                  </p>
                                                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1">Remaining</p>
                                              </div>
                                              {!done && (
                                                <button 
                                                    onClick={() => handleServeItem(scannedOrder.id, item.id, rem)}
                                                    className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-95"
                                                >
                                                    <Zap className="w-10 h-10 fill-current" />
                                                </button>
                                              )}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      <div className="pt-10 h-36 relative">
                          {/* Rejection context */}
                          <div className="absolute -top-12 right-0">
                                <button 
                                    onClick={async () => {
                                        if (confirm('REJECT AND ABANDON THIS ORDER?')) {
                                            await rejectOrderFromCounter(scannedOrder.id, profile.uid);
                                            setScanQueue(prev => prev.filter(id => id !== scannedOrder.id));
                                        }
                                    }}
                                    className="text-[10px] font-black text-red-500/40 uppercase tracking-[0.3em] hover:text-red-500 transition-colors"
                                >
                                    ABANDON SESSION ✕
                                </button>
                          </div>
                          
                          <button 
                            onClick={() => handleServeAll(scannedOrder.id)}
                            className="w-full h-full bg-white text-black font-black uppercase tracking-[0.5em] text-2xl rounded-[3rem] shadow-[0_0_80px_rgba(255,255,255,0.2)] active:scale-95 transition-all flex items-center justify-center gap-8 group"
                          >
                             <UtensilsCrossed className="w-10 h-10 group-hover:rotate-12 transition-transform" /> COMPLETE MEAL SERVING
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center relative z-10">
                       <div className="relative mb-10">
                            <Zap className="w-32 h-32 text-primary animate-pulse" />
                            <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-ping" />
                       </div>
                       <h3 className="text-5xl font-black italic tracking-tighter uppercase mb-6 leading-none">Awaiting Operation</h3>
                       <p className="text-sm font-bold text-gray-500 uppercase tracking-widest max-w-sm leading-relaxed">
                          Scan a student token or click an active focus code from the global panel to initialize verification.
                       </p>
                  </div>
              )}
          </section>
      </div>

      {/* 🔮 ZONE 4: PIPELINE (BOTTOM) - SITUATIONAL AWARENESS */}
      <footer className="h-[20vh] bg-[#050505] border-t border-white/5 px-10 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className="w-1.5 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(249,115,22,0.4)]" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">Production Pipeline ( Situational Awareness)</h4>
                </div>
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">{upcomingPipeline.length} Upcoming Batches</p>
            </div>
            
            <div className="flex items-center gap-6 overflow-x-auto pb-4 custom-scrollbar no-scrollbar">
                {upcomingPipeline.map((b, idx) => (
                    <div key={b.id} className={`flex-shrink-0 min-w-[320px] p-6 rounded-[2.5rem] border-2 transition-all relative overflow-hidden group ${
                        b.arrivalTimeSlot === activeBatchSlot ? 'bg-primary/10 border-primary shadow-[0_0_40px_rgba(249,115,22,0.2)]' : 'bg-white/[0.03] border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 hover:bg-white/[0.05]'
                    }`}>
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <span className="text-2xl font-black font-mono tracking-tighter text-white/90">{formatSlot(b.arrivalTimeSlot)}</span>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${
                                b.status === 'READY' ? 'bg-green-500/20 text-green-500 border-green-500/20' :
                                b.status === 'PREPARING' ? 'bg-amber-500/20 text-amber-500 border-amber-500/20' :
                                'bg-white/5 text-white/30 border-white/5'
                            }`}>{b.status}</span>
                        </div>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-black border border-white/10 overflow-hidden">
                                    <img src={(b as any).imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'} className="w-full h-full object-cover opacity-60" alt="" />
                                </div>
                                <span className="text-xl font-black italic truncate max-w-[150px] tracking-tight">{b.itemName}</span>
                            </div>
                            <span className="text-4xl font-black italic text-primary drop-shadow-[0_0_15px_rgba(249,115,22,0.3)]">×{b.quantity}</span>
                        </div>
                        {/* Progress Bar background hint */}
                        <div className="absolute bottom-0 left-0 h-1 bg-primary/20 w-full" />
                    </div>
                ))}
            </div>
      </footer>

      {/* ── CAMERA OVERLAY ── */}
      {isCameraOpen && (
        <QRScanner 
          onScan={(data) => { setIsCameraOpen(false); handleQRScan(data); }}
          onClose={() => setIsCameraOpen(false)}
          isScanning={isScanning}
        />
      )}

      {/* ERROR TOAST (FIXED) */}
      {error && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-red-600 text-white px-10 py-6 rounded-[3rem] shadow-[0_30px_100px_rgba(220,38,38,0.5)] z-[100] border-4 border-[#020202] flex items-center gap-6 animate-in slide-in-from-bottom duration-500">
              <AlertCircle className="w-8 h-8" />
              <p className="font-black uppercase tracking-widest text-lg">{error}</p>
              <button onClick={() => setError(null)} className="p-2 bg-black/20 rounded-full hover:bg-black/40"><X className="w-6 h-6" /></button>
          </div>
      )}

    </div>
  );
};

export default UnifiedKitchenConsole;
