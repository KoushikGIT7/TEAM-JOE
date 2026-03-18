import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  CheckCircle, Zap, Clock, Search, Camera, X, ChefHat, 
  UtensilsCrossed, Timer, AlertCircle, ChevronRight, 
  ArrowRight, ShieldCheck, RefreshCw, Layers, Users, 
  PackageCheck, Flame, Sparkles, LogOut, LayoutDashboard, XCircle,
  Check
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
  const [isFlushing, setIsFlushing] = useState(false); // This state is no longer used in the new UI, but kept for completeness if logic remains
  const [flushCount, setFlushCount] = useState<number | null>(null); // This state is no longer used in the new UI, but kept for completeness if logic remains
  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);
  const [priorityOrderId, setPriorityOrderId] = useState<string | null>(null); // This state is no longer used in the new UI, but kept for completeness if logic remains
  const [burstMode, setBurstMode] = useState(false); // This state is no longer used in the new UI, but kept for completeness if logic remains
  const [scanFeedback, setScanFeedback] = useState<{ 
    status: 'VALID' | 'INVALID' | null, 
    message?: string,
    subtext?: string,
    orderId?: string
  }>({ status: null });

  // --- WORKSPACE STATE ---
  const [activeWorkspace, setActiveWorkspace] = useState<'COOK' | 'SERVER'>('SERVER');

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
  const lastScanTimestamp = useRef<number>(0);
  const interactionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const burstCounterRef = useRef<{ count: number; lastReset: number }>({ count: 0, lastReset: Date.now() });

  // --- TIME & SCANNER ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);

    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true });
    scanner.onScan((data) => {
      // Only process scans if in SERVER workspace
      if (activeWorkspace === 'SERVER') {
        handleQRScan(data);
      }
    });

    return () => {
      clearInterval(t);
      scanner.destroy();
    };
  }, [activeWorkspace]);

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

        // 1. Fetch FULL Order
        const order = await validateQRForServing(data);

        // 2. Success Feedback (Traffic Signal Green)
        setScanFeedback({
          status: 'VALID',
          message: 'VALID',
          subtext: 'Meal Verified',
          orderId: order.id.slice(-6).toUpperCase()
        });

        // 3. Add to Queue and Focus
        setScanQueue(prev => {
          const exists = prev.includes(order.id);
          if (exists) {
            // Re-prioritize to front
            return [order.id, ...prev.filter(id => id !== order.id)];
          }
          return [order.id, ...prev];
        });

        // 4. Return to scan mode after 1.5 seconds (overlay fades)
        setTimeout(() => setScanFeedback({ status: null }), 1500);

    } catch (err: any) {
        // Failure Feedback (Traffic Signal Red)
        setScanFeedback({
          status: 'INVALID',
          message: 'INVALID',
          subtext: err.message || 'QR not valid'
        });
        
        setTimeout(() => setScanFeedback({ status: null }), 2000);
    } finally {
        setIsScanning(false);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    // 🔐 ACTIVE LOCK: Set interacting flag
    setIsInteracting(true);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => setIsInteracting(false), 5000);

    try {
        await serveItemBatch(orderId, itemId, qty, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate(50);

        // Auto-remove from queue if fully served
        const order = activeOrders.find(o => o.id === orderId);
        if (order) {
          const allDone = order.items.every(item => {
            const rem = item.id === itemId 
              ? (item.remainingQty ?? (item.quantity - (item.servedQty || 0))) - qty
              : (item.remainingQty ?? (item.quantity - (item.servedQty || 0)));
            return rem <= 0;
          });
          if (allDone) {
            setTimeout(() => setScanQueue(prev => prev.filter(id => id !== orderId)), 800);
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

  // --- WORKSPACE RENDERING ---

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] flex overflow-hidden font-sans text-slate-900">
      
      {/* ── SIDEBAR NAVIGATION (Minimal) ── */}
      <aside className="w-20 lg:w-24 bg-white border-r border-slate-100 flex flex-col items-center py-10 gap-8 z-50">
        <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-white mb-6">
          <UtensilsCrossed className="w-6 h-6" />
        </div>

        <button 
           onClick={() => setActiveWorkspace('SERVER')}
           className={`p-4 rounded-2xl transition-all duration-300 group relative ${activeWorkspace === 'SERVER' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-slate-600'}`}
        >
          <Camera className="w-6 h-6" />
          {activeWorkspace === 'SERVER' && <div className="absolute left-full ml-4 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">SERVER PORTAL</div>}
        </button>

        <button 
           onClick={() => setActiveWorkspace('COOK')}
           className={`p-4 rounded-2xl transition-all duration-300 group relative ${activeWorkspace === 'COOK' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-300 hover:text-slate-600'}`}
        >
          <ChefHat className="w-6 h-6" />
          {activeWorkspace === 'COOK' && <div className="absolute left-full ml-4 px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">COOK CONSOLE</div>}
        </button>

        <div className="mt-auto flex flex-col gap-6">
          <button onClick={onLogout} className="p-4 rounded-2xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Workspace Header */}
        <header className="h-20 border-b border-slate-100 bg-white/80 backdrop-blur-md px-10 flex items-center justify-between sticky top-0 z-40">
           <div className="flex items-center gap-4">
             <h1 className="text-xl font-black tracking-tight text-slate-900">
               {activeWorkspace === 'SERVER' ? 'Server Console' : 'Cook Console'}
             </h1>
             <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full border border-slate-100 uppercase tracking-widest">
               {activeWorkspace === 'SERVER' ? 'Scanning & Serving' : 'Production Pipeline'}
             </span>
           </div>

           <div className="flex items-center gap-8">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-black text-slate-900 leading-none mb-1">
                 {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
               </p>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Active</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
               <ShieldCheck className="w-5 h-5" />
             </div>
           </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden">
          {activeWorkspace === 'SERVER' ? (
            /* ======================================================================== */
            /* SERVER CONSOLE                                                           */
            /* ======================================================================== */
            <div className="h-full flex flex-col bg-[#FDFDFD]">
              
              {/* Queue Preview Strip */}
              <div className="px-10 py-4 bg-white border-b border-slate-50 flex items-center gap-4 overflow-x-auto no-scrollbar">
                <Users className="w-4 h-4 text-slate-300 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 whitespace-nowrap">Next scan:</span>
                {queuePreviewOrders.map(q => (
                  <button 
                    key={q.id}
                    onClick={() => setScanQueue(prev => [q.id, ...prev.filter(id => id !== q.id)])}
                    className="flex-shrink-0 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-slate-500 hover:bg-slate-100 transition-all uppercase"
                  >
                    #{q.id.slice(-6).toUpperCase()}
                  </button>
                ))}
                {queuePreviewOrders.length === 0 && <span className="text-[10px] font-bold text-slate-200 italic">Queue empty</span>}
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Scanner Interface (Centered Focus) */}
                <div className="flex-1 flex flex-col items-center justify-center p-10 border-r border-slate-100 bg-[#FCFCFC]">
                  {scannedOrder ? (
                    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden animate-in zoom-in-95 duration-500">
                      {/* Active Order Header */}
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-green-100">
                              <Check className="w-8 h-8 stroke-[3]" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serving Now</p>
                              <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">#{scannedOrder.id.slice(-6).toUpperCase()}</h2>
                           </div>
                        </div>
                        <button onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                           <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Items List */}
                      <div className="p-8 max-h-[40vh] overflow-y-auto space-y-3 custom-scrollbar">
                        {scannedOrder.items.map(it => {
                          const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                          const done = rem <= 0;
                          return (
                            <div key={it.id} className={`flex items-center justify-between p-6 rounded-3xl border transition-all ${done ? 'bg-green-50/50 border-green-100 opacity-60' : 'bg-slate-50/20 border-slate-100'}`}>
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 overflow-hidden grayscale">
                                   <img src={it.imageUrl} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div>
                                   <h4 className="text-sm font-black text-slate-800">{it.name}</h4>
                                   <p className="text-[10px] font-bold text-slate-400">Reserved: {it.quantity}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                 {!done && (
                                   <button 
                                     onClick={() => handleServeItem(scannedOrder.id, it.id, rem)}
                                     className="h-12 px-6 bg-green-600 text-white font-black text-[10px] uppercase rounded-xl shadow-lg shadow-green-100 active:scale-95 transition-all"
                                   >
                                     Serve ({rem})
                                   </button>
                                 )}
                                 {done && <CheckCircle className="w-6 h-6 text-green-500" />}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Actions */}
                      <div className="p-8 pt-0 grid grid-cols-2 gap-4">
                         <button 
                           onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))}
                           className="h-16 rounded-2xl border-2 border-slate-100 text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                         >
                           Later
                         </button>
                         <button 
                           onClick={() => handleServeAll(scannedOrder.id)}
                           className="h-16 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200"
                         >
                           Serve All
                         </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-40 h-40 bg-white border border-slate-100 rounded-[3rem] shadow-inner flex items-center justify-center mb-8 relative">
                         <Camera className="w-12 h-12 text-slate-100" />
                         <div className="absolute inset-4 border-2 border-slate-50 border-dashed rounded-[2rem] animate-pulse" />
                      </div>
                      <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic">Awaiting Scan</h3>
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Hardware scanner active</p>

                      <button onClick={() => setIsCameraOpen(true)} className="mt-12 group flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap">
                        <Zap className="w-4 h-4 text-primary group-hover:scale-125 transition-transform" />
                        Interactive Camera Mode
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================================== */
            /* COOK CONSOLE                                                            */
            /* ======================================================================== */
            <div className="h-full flex flex-col bg-[#FDFDFD]">
              <div className="p-10 grid grid-cols-12 gap-10">
                
                {/* Left: Upcoming Batches */}
                <div className="col-span-4 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">Incoming Slots</h3>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">Live</span>
                  </div>
                  <div className="space-y-4">
                    {Array.from(new Set(batches.filter(b => b.status === 'QUEUED').map(b => b.arrivalTimeSlot)))
                      .sort()
                      .map(slot => (
                        <div key={slot} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                           <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-300" />
                                <span className="text-xl font-black text-slate-900 font-mono italic">{formatSlot(slot)}</span>
                             </div>
                             <button 
                               onClick={() => updateSlotStatus(slot, 'PREPARING')}
                               className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all"
                             >
                               Start Preparation
                             </button>
                           </div>
                           <div className="space-y-2">
                             {batches.filter(bg => bg.arrivalTimeSlot === slot && bg.status === 'QUEUED').map(b => (
                               <div key={b.id} className="flex justify-between items-center">
                                 <span className="text-xs font-bold text-slate-600 truncate mr-4">{b.itemName}</span>
                                 <span className="text-sm font-black text-slate-400">×{b.quantity}</span>
                               </div>
                             ))}
                           </div>
                        </div>
                      ))}
                    {batches.filter(b => b.status === 'QUEUED').length === 0 && (
                      <div className="h-40 border-2 border-slate-50 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-200">
                        <Timer className="w-8 h-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Incoming Work</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Center: Current Preparing */}
                <div className="col-span-4 flex flex-col gap-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-600">Current Preparation</h3>
                  {batches.filter(b => b.status === 'PREPARING').length > 0 ? (
                    (() => {
                      const activeSlot = batches.find(b => b.status === 'PREPARING')?.arrivalTimeSlot;
                      const activeBatches = batches.filter(b => b.arrivalTimeSlot === activeSlot && b.status === 'PREPARING');
                      return (
                        <div className="bg-white border-2 border-indigo-600 rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                           <div className="flex items-center gap-3 mb-8">
                             <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                                <Flame className="w-6 h-6 animate-pulse" />
                             </div>
                             <h2 className="text-4xl font-black text-slate-900 font-mono tracking-tighter italic">{formatSlot(activeSlot || 0)}</h2>
                           </div>

                           <div className="space-y-6 mb-10">
                              {activeBatches.map(b => (
                                <div key={b.id} className="flex flex-col gap-2">
                                   <div className="flex justify-between items-end">
                                      <h4 className="text-lg font-black text-slate-800">{b.itemName}</h4>
                                      <p className="text-3xl font-black text-indigo-600">×{b.quantity}</p>
                                   </div>
                                   <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                                      <div className="h-full bg-indigo-500 animate-[shimmer_2s_infinite] w-full" />
                                   </div>
                                </div>
                              ))}
                           </div>

                           <button 
                             onClick={() => updateSlotStatus(activeSlot!, 'READY')}
                             className="w-full h-16 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                           >
                             Production Ready
                           </button>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="h-80 border-2 border-slate-50 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-slate-200">
                       <ChefHat className="w-12 h-12 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-center max-w-[150px]">Select a slot to start cooking</p>
                    </div>
                  )}
                </div>

                {/* Right: Ready Batches */}
                <div className="col-span-4 flex flex-col gap-6">
                   <h3 className="text-xs font-black uppercase tracking-[0.4em] text-green-600">Production Ready</h3>
                   <div className="space-y-4">
                     {batches.filter(b => b.status === 'READY')
                       .sort((a, b) => b.updatedAt - a.updatedAt)
                       .slice(0, 5)
                       .map(b => (
                         <div key={b.id} className="bg-green-50/50 border border-green-100 rounded-3xl p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="p-3 bg-white rounded-xl border border-green-100">
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                               </div>
                               <div>
                                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{b.itemName}</h4>
                                  <p className="text-[10px] font-bold text-green-600 font-mono">Slot: {formatSlot(b.arrivalTimeSlot)}</p>
                               </div>
                            </div>
                            <span className="text-2xl font-black text-slate-900 opacity-20">×{b.quantity}</span>
                         </div>
                       ))}
                      {batches.filter(b => b.status === 'READY').length === 0 && (
                        <div className="h-40 border-2 border-slate-50 border-dashed rounded-3xl flex items-center justify-center text-slate-200">
                          <p className="text-[10px] font-black uppercase tracking-widest italic">Nothing in Pass-through</p>
                        </div>
                      )}
                   </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- SHARED OVERLAYS --- */}

      {/* TRAFFIC SIGNAL SCAN OVERLAY */}
      {activeWorkspace === 'SERVER' && scanFeedback.status && (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-300 animate-in fade-in ${
          scanFeedback.status === 'VALID' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className="flex flex-col items-center text-white scale-125 md:scale-150">
            <div className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-white/20 flex items-center justify-center mb-8 backdrop-blur-md">
              {scanFeedback.status === 'VALID' ? (
                <Check className="w-20 h-20 md:w-32 md:h-32 text-white stroke-[4]" />
              ) : (
                <X className="w-20 h-20 md:w-32 md:h-32 text-white stroke-[4]" />
              )}
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-2 italic uppercase">{scanFeedback.message}</h1>
            <p className="text-lg md:text-2xl font-bold opacity-90 uppercase tracking-[0.2em]">{scanFeedback.subtext}</p>
            {scanFeedback.orderId && (
              <p className="mt-8 px-6 py-2 bg-black/20 rounded-full text-sm font-mono tracking-widest backdrop-blur-sm italic">
                TOKEN #{scanFeedback.orderId}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Manual Scanner Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button onClick={() => setIsCameraOpen(false)} className="absolute top-6 right-6 z-10 w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 border border-slate-100 hover:bg-slate-100 transition-all">
              <X className="w-6 h-6" />
            </button>
            <div className="bg-slate-900 p-10 pt-16 text-center text-white">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-primary" />
              <h2 className="text-3xl font-black tracking-tight mb-2 uppercase italic">Secure Scan Mode</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Validating encrypted student tokens</p>
            </div>
            <div className="p-10 bg-[#FAFAFA]">
              <div className="bg-white rounded-[2rem] overflow-hidden aspect-square flex items-center justify-center border-4 border-white shadow-2xl relative">
                <QRScanner
                  onScan={(data) => { setIsCameraOpen(false); handleQRScan(data); }}
                  onClose={() => setIsCameraOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Error Toast */}
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2rem] shadow-2xl z-[200] flex items-center gap-6 animate-in slide-in-from-bottom-10 duration-[600ms] cubic-bezier(0.2,0.8,0.2,1) border border-white/5">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <p className="font-bold text-sm tracking-tight">{error}</p>
          <button onClick={() => setError(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"><X className="w-4 h-4" /></button>
        </div>
      )}

    </div>
  );
};

export default UnifiedKitchenConsole;
