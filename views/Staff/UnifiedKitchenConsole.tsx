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
  flushMissedPickups
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
  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushCount, setFlushCount] = useState<number | null>(null);

  // Derived: Get the actual order object for the focused ID from the listener
  const scannedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return activeOrders.find(o => o.id === focusedOrderId) || null;
  }, [activeOrders, focusedOrderId]);

  // --- REFS ---
  const scanReviewRef = useRef<HTMLDivElement>(null);

  // --- TIME, SCANNER & MAINTENANCE ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // 🤖 Autonomous Maintenance Heartbeat (Runs every 30s)
    const maintenance = setInterval(async () => {
        try {
            await flushMissedPickups();
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
    setIsScanning(true);
    setError(null);
    try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        const order = await validateQRForServing(data);
        setFocusedOrderId(order.id);
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
                  setFocusedOrderId(null);
                }, 1200);
            }
        }
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    }
  };

  const handleServeAll = async (orderId: string) => {
    try {
        setFocusedOrderId(null);
        await serveFullOrder(orderId, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    }
  };

  const handleFlushMissed = async () => {
    setIsFlushing(true);
    try {
        const count = await flushMissedPickups();
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

  const activeBatchItems = useMemo(() => {
    if (!activeBatchSlot) return [];
    return batches.filter(b => b.arrivalTimeSlot === activeBatchSlot);
  }, [batches, activeBatchSlot]);

  const activeBatchStatus = activeBatchItems[0]?.status || 'QUEUED';

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

  // --- RENDER ---
  return (
    <div className="h-screen w-screen bg-[#050505] text-white flex flex-col overflow-hidden font-sans selection:bg-primary/30">
      
      {/* 🔴 QR SCANNER (TOP - ALWAYS FIXED) */}
      <div className="bg-black/80 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
            <div className="flex items-baseline gap-2">
                <h1 className="text-3xl font-black tracking-tighter italic">JOE</h1>
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] px-3 py-1 border border-primary/30 rounded-full bg-primary/10">Console</span>
            </div>
            
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-6 py-2.5 focus-within:border-primary/50 transition-all">
                <Search className="w-5 h-5 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="SCAN MEAL TOKEN..." 
                    className="bg-transparent border-none outline-none font-black text-xl placeholder:text-white/10 tracking-widest uppercase w-64"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleQRScan((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                        }
                    }}
                />
            </div>
            <button 
                onClick={() => setIsCameraOpen(true)}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-primary"
            >
                <Camera className="w-6 h-6" />
            </button>
        </div>

        <div className="flex items-center gap-8">
            <div className="text-right hidden sm:block">
                <p className="text-2xl font-black font-mono tracking-wider">
                    {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </p>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">System Live: {profile.name}</p>
                </div>
            </div>
            
            <button 
                onClick={handleFlushMissed}
                disabled={isFlushing}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-2 group ${
                    flushCount !== null ? 'bg-green-500 border-green-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/20'
                }`}
            >
                {isFlushing ? <RefreshCw className="w-5 h-5 animate-spin" /> : 
                 flushCount !== null ? <CheckCircle className="w-5 h-5" /> : 
                 <Clock className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">
                    {isFlushing ? 'Checking...' : flushCount !== null ? `${flushCount} REASSIGNED` : 'CLEANUP MISSED'}
                </span>
            </button>

            <button onClick={onLogout} className="p-3 bg-red-600/10 hover:bg-red-600/20 rounded-2xl border border-red-600/20 text-red-500 transition-all active:scale-95">
                <LogOut className="w-6 h-6" />
            </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar bg-[#080808]">
        <div className="max-w-[1600px] mx-auto p-8 space-y-12">
            
            {/* 🧾 SCAN RESULT UI (AUTO-FOCUS PANEL) */}
            {scannedOrder && (
                <section ref={scanReviewRef} className="animate-in slide-in-from-top duration-500">
                    <div className="bg-primary/10 border-2 border-primary/40 rounded-[3.5rem] p-10 shadow-[0_40px_100px_rgba(249,115,22,0.15)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 blur-[150px] -mr-[300px] -mt-[300px] rounded-full pointer-events-none" />
                        
                        <div className="flex items-center justify-between mb-10 relative z-10">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-[2rem] bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(249,115,22,0.4)] animate-bounce">
                                    <Sparkles className="w-10 h-10 text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-primary uppercase tracking-[0.5em] mb-1">Authenticated Token ✓</p>
                                    <h2 className="text-6xl font-black tracking-tighter italic">#{scannedOrder.id.slice(-6).toUpperCase()}</h2>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black text-white/90 mb-1">{scannedOrder.userName}</p>
                                <div className="flex items-center justify-end gap-2 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                        scannedOrder.pickupWindow?.status === 'COLLECTING' ? 'bg-green-500 text-white border-green-400' :
                                        scannedOrder.pickupWindow?.status === 'MISSED' ? 'bg-amber-500 text-white border-amber-400' :
                                        scannedOrder.pickupWindow?.status === 'ABANDONED' ? 'bg-red-500 text-white border-red-400' :
                                        'bg-white/10 text-white/40 border-white/5'
                                    }`}>
                                        Window: {scannedOrder.pickupWindow?.status || scannedOrder.serveFlowStatus || 'PENDING'}
                                    </span>
                                </div>
                                <button onClick={() => setFocusedOrderId(null)} className="text-xs font-black text-white/30 uppercase tracking-widest hover:text-white transition-colors">Dismiss Panel ✕</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                            {scannedOrder.items.map((item) => {
                                const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
                                const done = rem <= 0;
                                return (
                                    <div key={item.id} className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 flex flex-col justify-between h-56 ${
                                        done ? 'bg-green-500/10 border-green-500/20 opacity-60' : 'bg-black/40 border-white/5 hover:border-primary/20'
                                    }`}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
                                                    <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black tracking-tight leading-none mb-1">{item.name}</h4>
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Qty: {item.quantity}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-4xl font-black ${done ? 'text-green-500' : 'text-primary'}`}>
                                                    {done ? '✓' : `×${rem}`}
                                                </p>
                                            </div>
                                        </div>
                                        {!done && (
                                            <button 
                                                onClick={() => handleServeItem(scannedOrder.id, item.id, rem)}
                                                disabled={scannedOrder.pickupWindow?.status !== 'COLLECTING'}
                                                className={`w-full h-16 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${
                                                    scannedOrder.pickupWindow?.status === 'COLLECTING' ? 'bg-primary shadow-primary/20' : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                                }`}
                                            >
                                                {scannedOrder.pickupWindow?.status === 'COLLECTING' ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                {scannedOrder.pickupWindow?.status === 'COLLECTING' ? 'Bulk Serve' : scannedOrder.pickupWindow?.status || 'Awaiting Ready'}
                                            </button>
                                        )}
                                        {done && (
                                            <div className="flex items-center justify-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                                <CheckCircle className="w-4 h-4" /> Fulfilled
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="mt-8 flex justify-end gap-4">
                             <button 
                                onClick={async () => {
                                    if (confirm('REJECT THIS ORDER? This will destroy the token and cancel the pickup.')) {
                                        try {
                                            await rejectOrderFromCounter(scannedOrder.id, profile.uid);
                                            setFocusedOrderId(null);
                                        } catch (err: any) {
                                            setError(err.message || 'Reject Failed');
                                        }
                                    }
                                }}
                                className="h-20 px-8 bg-red-600/10 border border-red-600/20 text-red-500 font-black uppercase tracking-[0.2em] text-[10px] rounded-[2rem] hover:bg-red-600/20 transition-all active:scale-95"
                             >
                                Reject Order
                             </button>
                             <button 
                                onClick={() => handleServeAll(scannedOrder.id)}
                                className="h-20 px-12 bg-white text-black font-black uppercase tracking-[0.3em] text-sm rounded-[2rem] shadow-2xl transition-all active:scale-95 flex items-center gap-4"
                             >
                                <UtensilsCrossed className="w-6 h-6" /> Complete Meal Serving
                             </button>
                        </div>
                    </div>
                </section>
            )}

            {/* ERROR TOAST */}
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 p-6 rounded-3xl flex items-center justify-between text-red-500 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-4 font-black">
                        <AlertCircle className="w-6 h-6" /> {error}
                    </div>
                    <button onClick={() => setError(null)}><X className="w-5 h-5" /></button>
                </div>
            )}

            {/* 🗂️ ACTIVE SCAN LIST (SESSION) */}
            {activeOrders.length > 0 && !scannedOrder && (
                <section className="flex items-center gap-4 overflow-x-auto pb-4 custom-scrollbar">
                    {activeOrders.map((order) => (
                        <button 
                            key={order.id}
                            onClick={() => {
                                setFocusedOrderId(order.id);
                                setTimeout(() => scanReviewRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                            }}
                            className={`flex flex-col items-start gap-1 p-6 min-w-[200px] rounded-[2rem] border-2 transition-all active:scale-95 ${
                                focusedOrderId === order.id ? 'bg-primary border-primary shadow-[0_10px_30px_rgba(249,115,22,0.3)]' : 'bg-white/[0.03] border-white/5 hover:border-white/20'
                            }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Session Token</span>
                            <span className="text-xl font-black tracking-tighter">#{order.id.slice(-6).toUpperCase()}</span>
                            <span className="text-xs font-bold truncate w-full text-left">{order.userName}</span>
                        </button>
                    ))}
                </section>
            )}

            {scannedOrder && (
                <div className="flex justify-center mt-8">
                    <button 
                        onClick={() => setFocusedOrderId(null)}
                        className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-[0.2em] text-sm rounded-full transition-all active:scale-95 flex items-center gap-3"
                    >
                        <XCircle className="w-5 h-5" /> Clear Focus
                    </button>
                </div>
            )}

            <div className={`grid grid-cols-1 lg:grid-cols-12 gap-12 transition-all duration-700 ${scannedOrder ? 'opacity-20 blur-sm pointer-events-none translate-y-20' : 'opacity-100'}`}>
                
                {/* 🟡 SECTION 2: ACTIVE BATCH (COOK CONTROL) */}
                <section className="lg:col-span-12 xl:col-span-7 space-y-8">
                    <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-8 bg-amber-500 rounded-full" />
                            <h3 className="text-xl font-black uppercase tracking-[0.4em]">Current Batch</h3>
                        </div>
                        {activeBatchSlot && (
                            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 px-6 py-2 rounded-full">
                                <Clock className="w-5 h-5 text-amber-500" />
                                <span className="text-xl font-black font-mono tracking-tighter text-amber-500">{formatSlot(activeBatchSlot)}</span>
                            </div>
                        )}
                    </div>

                    {!activeBatchSlot ? (
                        <div className="bg-white/[0.02] border border-white/5 rounded-[4rem] h-96 flex flex-col items-center justify-center text-center p-12">
                            <ChefHat className="w-24 h-24 text-white/5 mb-8" />
                            <h4 className="text-3xl font-black text-white/20 tracking-tighter mb-4">NO ACTIVE BATCH</h4>
                            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em] max-w-xs">Waiting for new orders to arrive in the queue.</p>
                        </div>
                    ) : (
                        <div className="bg-white/[0.03] border border-white/10 rounded-[4rem] p-10 lg:p-14 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10">
                                <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${
                                    activeBatchStatus === 'READY' ? 'bg-green-500/10 border-green-500/50 text-green-500' :
                                    activeBatchStatus === 'PREPARING' ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 animate-pulse' :
                                    'bg-blue-500/10 border-blue-500/50 text-blue-500'
                                }`}>
                                    {activeBatchStatus}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] px-2 mb-4">Required Ingredients</p>
                                    <div className="space-y-4">
                                        {activeBatchItems.map(item => (
                                            <div key={item.id} className="flex items-center justify-between bg-black/40 border border-white/5 p-6 rounded-3xl hover:border-white/10 transition-all">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10">
                                                        <img src={(item as any).imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'} className="w-full h-full object-cover" alt={item.itemName} />
                                                    </div>
                                                    <h5 className="text-2xl font-black tracking-tight">{item.itemName}</h5>
                                                </div>
                                                <span className="text-4xl font-black italic text-amber-500">×{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center gap-6">
                                    <div className="bg-amber-500/5 border border-amber-500/20 p-8 rounded-3xl text-center">
                                         <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-4">Estimated Start Time</p>
                                         <p className="text-6xl font-black font-mono tracking-tighter text-amber-500/80">
                                            {(() => {
                                                const h = Math.floor(activeBatchSlot / 100);
                                                const m = activeBatchSlot % 100;
                                                const startM = m - 15;
                                                const finalH = startM < 0 ? h - 1 : h;
                                                const finalM = startM < 0 ? 60 + startM : startM;
                                                return `${finalH.toString().padStart(2, '0')}:${finalM.toString().padStart(2, '0')}`;
                                            })()}
                                         </p>
                                         <p className="text-[10px] font-bold text-gray-500 uppercase mt-4">15 Minute Lead Time Calculated</p>
                                    </div>
                                    <div className="space-y-4">
                                        <button 
                                            onClick={() => updateSlotStatus(activeBatchSlot, 'PREPARING')}
                                            disabled={activeBatchStatus !== 'QUEUED'}
                                            className="w-full h-20 bg-amber-500 text-black font-black uppercase tracking-[0.2em] text-sm rounded-3xl shadow-[0_0_40px_rgba(245,158,11,0.2)] active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-4"
                                        >
                                            <Flame className="w-6 h-6" /> Start Preparing Batch
                                        </button>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button 
                                                onClick={() => updateSlotStatus(activeBatchSlot, 'ALMOST_READY')}
                                                disabled={activeBatchStatus !== 'PREPARING'}
                                                className="h-20 bg-orange-600/10 border border-orange-600/30 text-orange-500 font-black uppercase tracking-[0.1em] text-[10px] rounded-3xl active:scale-95 disabled:opacity-20 transition-all"
                                            >
                                                Mark Almost Ready
                                            </button>
                                            <button 
                                                onClick={() => updateSlotStatus(activeBatchSlot, 'READY')}
                                                disabled={activeBatchStatus !== 'ALMOST_READY'}
                                                className="h-20 bg-green-500 text-white font-black uppercase tracking-[0.1em] text-[10px] rounded-3xl shadow-[0_0_40px_rgba(34,197,94,0.2)] active:scale-95 disabled:opacity-20 transition-all"
                                            >
                                                Mark Batch Ready
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {/* 🟢 SECTION 3: READY TO SERVE (SERVER SUPPORT) */}
                <section className="lg:col-span-12 xl:col-span-5 space-y-8">
                    <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-8 bg-green-500 rounded-full" />
                            <h3 className="text-xl font-black uppercase tracking-[0.4em]">Available to Serve</h3>
                        </div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{readyPool.length} Ready Items</span>
                    </div>

                    <div className="bg-white/[0.03] border border-white/5 rounded-[4rem] overflow-hidden flex flex-col h-[600px] shadow-2xl">
                        <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Only items from scanned tokens appear here</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                            {readyPool.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-12">
                                    <PackageCheck className="w-20 h-20 mb-6" />
                                    <p className="text-sm font-black uppercase tracking-widest">Waiting for pick-ups</p>
                                    <p className="text-[10px] font-bold mt-2">Ready items will cluster here after kitchen completion.</p>
                                </div>
                            ) : (
                                readyPool.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-black/40 border border-white/5 p-6 rounded-[2.5rem] transition-all hover:border-green-500/30 group animate-in slide-in-from-right duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 group-hover:scale-110 transition-transform">
                                                <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                                            </div>
                                            <div>
                                                <h5 className="text-xl font-black tracking-tighter truncate max-w-[120px]">{item.name}</h5>
                                                <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                                                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" /> Ready
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="text-4xl font-black text-green-500 italic leading-none">×{item.total}</p>
                                                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">In Stock</p>
                                            </div>
                                            <ChevronRight className="w-6 h-6 text-white/5 group-hover:text-green-500 transition-colors" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-8 bg-green-500/5 text-center">
                            <button className="text-[10px] font-black text-green-500 uppercase tracking-[0.4em] hover:opacity-80 transition-opacity">
                                View Full Serve Queue <ArrowRight className="inline w-3 h-3 ml-2" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* 🔵 SECTION 4: UPCOMING BATCHES */}
                <section className="lg:col-span-12 space-y-8">
                    <div className="flex items-center gap-4 px-4">
                        <div className="w-2 h-8 bg-blue-500 rounded-full" />
                        <h3 className="text-xl font-black uppercase tracking-[0.4em]">Upcoming Pipeline</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {upcomingBatches.slice(0, 4).map((batch, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/[0.08] transition-all group relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
                                    <Clock className="w-16 h-16 -mr-8 -mt-8" />
                                </div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg">
                                        <span className="text-xs font-black text-blue-500 font-mono italic">{formatSlot(batch.arrivalTimeSlot)}</span>
                                    </div>
                                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">In {idx * 15 + 15}m</span>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/5 overflow-hidden flex-shrink-0">
                                            <img src={(batch as any).imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'} className="w-full h-full object-cover" alt={batch.itemName} />
                                        </div>
                                        <h6 className="font-black truncate flex-1 tracking-tight">{batch.itemName}</h6>
                                        <span className="text-xl font-black text-blue-500 italic">×{batch.quantity}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {upcomingBatches.length === 0 && (
                            <div className="col-span-full py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem]">
                                <p className="text-xs font-black text-white/10 uppercase tracking-[0.5em]">No further batches scheduled</p>
                            </div>
                        )}
                    </div>
                </section>

            </div>
        </div>
      </main>

      {/* ── CAMERA OVERLAY ── */}
      {isCameraOpen && (
        <QRScanner 
          onScan={(data) => { setIsCameraOpen(false); handleQRScan(data); }}
          onClose={() => setIsCameraOpen(false)}
          isScanning={isScanning}
        />
      )}
    </div>
  );
};

export default UnifiedKitchenConsole;
