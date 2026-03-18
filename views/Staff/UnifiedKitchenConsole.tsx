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
  const [isInteracting, setIsInteracting] = useState(false);
  const [priorityOrderId, setPriorityOrderId] = useState<string | null>(null);
  const [burstMode, setBurstMode] = useState(false);

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
  const interactionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const burstCounterRef = useRef<{ count: number; lastReset: number }>({ count: 0, lastReset: Date.now() });

  // --- TIME, SCANNER & MAINTENANCE ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);

    // ðŸ¤– Autonomous Maintenance Heartbeat (Runs every 30s)
    const maintenance = setInterval(async () => {
        try {
            await flushMissedPickups(profile.uid);
        } catch (err) {}
    }, 30000);

    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true });
    scanner.onScan((data) => handleQRScan(data));

    // Burst Mode Detection (Speed Mode)
    const burstMonitor = setInterval(() => {
        const now = Date.now();
        if (now - burstCounterRef.current.lastReset > 60000) {
            setBurstMode(burstCounterRef.current.count > 15);
            burstCounterRef.current = { count: 0, lastReset: now };
        }
    }, 10000);

    return () => {
        clearInterval(t);
        clearInterval(maintenance);
        clearInterval(burstMonitor);
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
    
    // ðŸ›¡ï¸ SCAN THROTTLING: Prevent repeated scans within 500ms (High Throughput)
    const now = Date.now();
    if (now - lastScanTimestamp.current < 500) return;
    lastScanTimestamp.current = now;

    setIsScanning(true);
    setError(null);
    try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        // Burst sound concept (subtle click)
        const order = await validateQRForServing(data);
        
        burstCounterRef.current.count++;
        
        setScanQueue(prev => {
            const exists = prev.includes(order.id);
            if (exists) {
                // ðŸ”„ PRIORITY FEEDBACK: Trigger pulse animation on re-scan
                setPriorityOrderId(order.id);
                setTimeout(() => setPriorityOrderId(null), 1000);
                return [order.id, ...prev.filter(id => id !== order.id)];
            } else {
                return [...prev, order.id];
            }
        });

        if (!burstMode) {
            setTimeout(() => {
                scanReviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    } catch (err: any) {
        setError(err.message || 'Scan Failed');
    } finally {
        setIsScanning(false);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    // ðŸ”’ ACTIVE LOCK: Set interacting flag
    setIsInteracting(true);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => setIsInteracting(false), 5000);

    try {
        await serveItemBatch(orderId, itemId, qty, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate(50);

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
                  if (!isInteracting) {
                    setScanQueue(prev => prev.filter(id => id !== orderId));
                  }
                }, burstMode ? 200 : 1200);
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
    <div className="h-screen w-screen bg-gray-50 text-gray-900 flex flex-col overflow-hidden font-sans">

      {/* ZONE 1: HEADER */}
      <header className="h-[10vh] bg-white border-b border-gray-200 px-8 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight leading-none text-gray-900">JOE <span className="text-green-600">Kitchen</span></h1>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">Serving Console</span>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 transition-all">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Scan or type token..."
              className="bg-transparent border-none outline-none text-sm font-medium placeholder:text-gray-300 w-72 text-gray-700"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQRScan((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
            <button onClick={() => setIsCameraOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-200 transition-all">
              <Camera className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <p className="text-xl font-bold font-mono text-gray-700 tabular-nums">
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-semibold text-gray-500">{profile.name}</p>
          </div>
          <div className="h-6 w-px bg-gray-200" />
          <button
            onClick={handleFlushMissed}
            disabled={isFlushing}
            className={`h-9 px-4 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
              flushCount !== null ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {isFlushing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
            {isFlushing ? 'Cleaning...' : flushCount !== null ? `${flushCount} cleared` : 'Cleanup'}
          </button>
          <button onClick={onLogout} className="h-9 px-4 rounded-xl border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 text-xs font-semibold transition-all flex items-center gap-2">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* MID SECTION */}
      <div className="flex-1 flex overflow-hidden">

        {/* ZONE 2: PREP (LEFT) */}
        <section className="w-[42%] border-r border-gray-200 bg-white p-8 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-gray-800">Kitchen Prep</h3>
              <p className="text-xs text-gray-400 mt-0.5">Current batch load</p>
            </div>
            {activeBatchSlot && (
              <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl text-lg font-bold font-mono border border-amber-200">
                {formatSlot(activeBatchSlot)}
              </div>
            )}
          </div>

          {!activeBatchSlot ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <ChefHat className="w-20 h-20 mb-4" />
              <p className="text-sm font-semibold uppercase tracking-widest">No Active Queue</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {activeBatchItems.map(item => (
                  <div key={item.id} className="bg-gray-50 border border-gray-200 p-5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200">
                        <img src={(item as any).imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'} className="w-full h-full object-cover" alt="" />
                      </div>
                      <span className="font-semibold text-gray-800">{item.itemName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-amber-600">Ã—{item.quantity}</span>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">needed</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateSlotStatus(activeBatchSlot, 'PREPARING')}
                  disabled={activeBatchStatus !== 'QUEUED'}
                  className="h-16 bg-amber-500 text-white font-bold text-sm rounded-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  <Flame className="w-4 h-4" /> Start Cooking
                </button>
                <button
                  onClick={() => updateSlotStatus(activeBatchSlot, 'READY')}
                  disabled={activeBatchStatus !== 'PREPARING' && activeBatchStatus !== 'ALMOST_READY'}
                  className="h-16 bg-green-600 text-white font-bold text-sm rounded-2xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Batch Ready
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ZONE 3: SERVE (RIGHT) */}
        <section className="w-[58%] bg-gray-50 p-8 flex flex-col overflow-hidden">

          {/* Queue preview strip */}
          {queuePreviewOrders.length > 0 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
              <span className="text-xs font-semibold text-gray-400 flex-shrink-0">Queue:</span>
              {queuePreviewOrders.slice(0, 8).map(qOrder => {
                const isReady = qOrder.serveFlowStatus === 'READY';
                const isPriority = qOrder.id === priorityOrderId;
                return (
                  <button
                    key={qOrder.id}
                    onClick={() => { if (!isInteracting) setScanQueue(prev => [qOrder.id, ...prev.filter(id => id !== qOrder.id)]); }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      isPriority ? 'bg-green-100 border-green-400 text-green-700 scale-105' :
                      isReady ? 'bg-green-50 border-green-300 text-green-700' :
                      'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-gray-300'}`} />
                    #{qOrder.id.slice(-4).toUpperCase()}
                  </button>
                );
              })}
              {queuePreviewOrders.length > 8 && (
                <span className="text-xs text-gray-400 flex-shrink-0">+{queuePreviewOrders.length - 8} more</span>
              )}
            </div>
          )}

          {scannedOrder ? (
            <div className="flex-1 flex flex-col overflow-hidden" ref={scanReviewRef}>
              {/* Order header */}
              <div className="flex items-center justify-between mb-5 bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
                <div>
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-1">âœ“ Verified</p>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">#{scannedOrder.id.slice(-6).toUpperCase()}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{scannedOrder.userName}</p>
                </div>
                <button
                  onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))}
                  className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                {scannedOrder.items.map(item => {
                  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
                  const done = rem <= 0;
                  const isNextInLine = !done && scannedOrder.items.find(i => (i.remainingQty ?? (i.quantity - (i.servedQty || 0))) > 0)?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                        done ? 'bg-green-50 border-green-200 opacity-50' :
                        isNextInLine ? 'bg-white border-green-400 shadow-sm' :
                        'bg-white border-gray-200'
                      }`}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0 relative">
                        <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                        {done && <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-white" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">{item.name}</h4>
                        <p className="text-xs text-gray-400">{done ? 'Served' : `${rem} remaining`}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-2xl font-black ${done ? 'text-green-500' : isNextInLine ? 'text-green-700' : 'text-gray-400'}`}>
                          {done ? 'âœ“' : rem}
                        </span>
                        {!done && (
                          <button
                            onClick={() => handleServeItem(scannedOrder.id, item.id, rem)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                              isNextInLine ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            <Zap className="w-5 h-5 fill-current" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="pt-4 flex gap-3">
                <button
                  onClick={async () => {
                    if (confirm('Reject this order?')) {
                      await rejectOrderFromCounter(scannedOrder.id, profile.uid);
                      setScanQueue(prev => prev.filter(id => id !== scannedOrder.id));
                    }
                  }}
                  className="h-14 px-5 rounded-2xl border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 text-sm font-semibold transition-all active:scale-95"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleServeAll(scannedOrder.id)}
                  className={`flex-1 h-14 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-3 ${
                    scannedOrder.items.some(i => (i.remainingQty ?? (i.quantity - (i.servedQty || 0))) > 0)
                      ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                      : 'bg-gray-800 text-white'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  {scannedOrder.items.every(i => (i.remainingQty ?? (i.quantity - (i.servedQty || 0))) <= 0) ? 'All Items Served' : 'Serve All Items'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-300">
              <Search className="w-16 h-16 mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Awaiting Scan</h3>
              <p className="text-sm text-gray-300 max-w-xs">
                Scan a student QR code to load their order here.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ZONE 4: PIPELINE FOOTER */}
      <footer className="h-[18vh] bg-white border-t border-gray-200 px-8 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Upcoming Batches</h4>
          <span className="text-xs text-gray-300">{upcomingPipeline.length} batches</span>
        </div>
        <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
          {upcomingPipeline.map(b => (
            <div key={b.id} className={`flex-shrink-0 min-w-[220px] p-4 rounded-2xl border transition-all ${
              b.status === 'READY' ? 'bg-green-50 border-green-200' :
              b.status === 'PREPARING' ? 'bg-amber-50 border-amber-200' :
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold font-mono text-gray-800">{formatSlot(b.arrivalTimeSlot)}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  b.status === 'READY' ? 'bg-green-100 text-green-700' :
                  b.status === 'PREPARING' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{b.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 truncate max-w-[130px]">{b.itemName}</span>
                <span className="text-lg font-black text-gray-700">Ã—{b.quantity}</span>
              </div>
            </div>
          ))}
          {upcomingPipeline.length === 0 && (
            <p className="text-sm text-gray-300 italic">No upcoming batches</p>
          )}
        </div>
      </footer>

      {/* Camera overlay */}
      {isCameraOpen && (
        <QRScanner
          onScan={(data) => { setIsCameraOpen(false); handleQRScan(data); }}
          onClose={() => setIsCameraOpen(false)}
          isScanning={isScanning}
        />
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-4 animate-in slide-in-from-bottom duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-semibold text-sm">{error}</p>
          <button onClick={() => setError(null)} className="p-1 rounded-lg hover:bg-red-700 transition-all"><X className="w-4 h-4" /></button>
        </div>
      )}

    </div>
  );
};

export default UnifiedKitchenConsole;
