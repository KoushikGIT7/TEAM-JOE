import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, CheckCircle2, Zap, Lock, ChefHat, 
  PackageCheck, Clock, Loader2, X
} from 'lucide-react';
import { serveSingleItem } from '../../services/firestore-db';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface ServerConsoleWorkspaceProps {
  scanQueue: string[];
  setScanQueue?: (fn: (prev: string[]) => string[]) => void;
  setIsCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile?: boolean;
}

interface LiveItem {
  itemId: string;
  name: string;
  quantity: number;
  status: string;
  orderType: string;
  category?: string;
  orderId: string;
  userName?: string;
  readyAt?: any;
}

/**
 * 🎯 [SCAN-DRIVEN SERVER CONSOLE]
 * 
 * FLOW:
 * 1. Student scans QR → processAtomicIntake runs
 *    - STATIC ONLY → order auto-completed (CONSUMED), shown as done
 *    - HAS DYNAMIC → order MANIFESTED, items appear in this console:
 *        • STATIC items  → Green badge "READY" → Serve button active
 *        • DYNAMIC items → Status badge shows cook progress (QUEUED/PREPARING)
 *                         Serve button LOCKED until cook marks READY
 * 2. Cook finalizes batch → item status becomes READY → serve button unlocks
 * 3. Server serves each item → all served → order completed
 */
const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  scanQueue,
  setIsCameraOpen,
  isMobile = false,
}) => {
  // Map: orderId → live items from Firestore subcollection
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, LiveItem[]>>({});
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [servedKeys, setServedKeys] = useState<Set<string>>(new Set());
  const unsubRefs = useRef<Record<string, () => void>>({});

  // 📡 [SCAN-TRIGGERED LISTENER]
  // For every newly scanned order in scanQueue, attach a real-time listener
  // to its items subcollection. This drives the status-aware serving manifest.
  useEffect(() => {
    scanQueue.forEach(orderId => {
      if (unsubRefs.current[orderId]) return; // Already listening

      console.log(`📡 [SERVER-SYNC] Attaching manifest listener: ${orderId}`);
      const itemsRef = collection(db, 'orders', orderId, 'items');
      const unsub = onSnapshot(itemsRef, (snap) => {
        const items: LiveItem[] = snap.docs.map(d => ({
          itemId: d.id,
          orderId,
          ...d.data() as any,
        }));
        setOrderItemsMap(prev => ({ ...prev, [orderId]: items }));
      });

      unsubRefs.current[orderId] = unsub;
    });

    // Cleanup listeners for orders no longer in scanQueue
    const activeIds = new Set(scanQueue);
    Object.keys(unsubRefs.current).forEach(id => {
      if (!activeIds.has(id)) {
        unsubRefs.current[id]();
        delete unsubRefs.current[id];
        setOrderItemsMap(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [scanQueue]);

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(unsubRefs.current).forEach(u => u());
    };
  }, []);

  const handleServe = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    if (processingKey === key) return;
    setProcessingKey(key);
    try {
      await serveSingleItem(orderId, itemId);
      setServedKeys(prev => new Set(prev).add(key));
    } catch (err) {
      console.error('[SERVE-ERROR]', err);
    } finally {
      setProcessingKey(null);
    }
  };

  const getStatusConfig = (item: LiveItem) => {
    const key = `${item.orderId}-${item.itemId}`;
    const alreadyServed = servedKeys.has(key) || item.status === 'SERVED';

    if (alreadyServed) return {
      badge: 'SERVED ✓',
      badgeClass: 'bg-slate-200 text-slate-500',
      cardClass: 'opacity-40 grayscale',
      canServe: false,
      icon: <CheckCircle2 className="w-5 h-5 text-slate-400" />,
    };

    if (item.status === 'READY') return {
      badge: 'READY',
      badgeClass: 'bg-emerald-500 text-white animate-pulse',
      cardClass: 'border-emerald-200 bg-emerald-50/50',
      canServe: true,
      icon: <Zap className="w-5 h-5 text-emerald-600 fill-current" />,
    };

    if (item.status === 'PREPARING') return {
      badge: '🍳 PREPARING',
      badgeClass: 'bg-amber-100 text-amber-700',
      cardClass: 'border-amber-100',
      canServe: false,
      icon: <ChefHat className="w-5 h-5 text-amber-500" />,
    };

    // QUEUED / PENDING
    return {
      badge: '⏳ IN KITCHEN',
      badgeClass: 'bg-slate-100 text-slate-500',
      cardClass: 'border-slate-100',
      canServe: false,
      icon: <Lock className="w-5 h-5 text-slate-300" />,
    };
  };

  // 🛡️ [MANIFEST-LOCK] 
  // Orders remain in this list if they are in the scanQueue.
  // We only filter if we are 100% sure the order is completely served 
  // based on the live subcollection data.
  const activeScannedOrders = scanQueue.filter(id => {
    const items = orderItemsMap[id];
    if (!items || items.length === 0) return true; // Keep while loading
    
    // An order is active if it has ANY item that is not yet served
    return items.some(it => {
      const status = it.status?.toUpperCase() || '';
      return !['SERVED', 'COMPLETED', 'READY_SERVED'].includes(status);
    });
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#fdfdfd] font-sans select-none overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-5'} border-b border-slate-100 flex items-center justify-between shrink-0 bg-white shadow-sm z-10`}>
        <div className="flex items-center gap-3 lg:gap-5">
          <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-slate-900 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg`}>
            <PackageCheck className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
          </div>
          <div>
            <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-black text-slate-900 uppercase italic tracking-tighter`}>Serving</h2>
            <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
              {activeScannedOrders.length === 0 ? 'Protocol Idle' : `${activeScannedOrders.length} Manifests Active`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCameraOpen(true)}
          className={`${isMobile ? 'h-10 px-4 text-[10px]' : 'h-12 px-8 text-[11px]'} bg-slate-900 text-white rounded-xl lg:rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2 hover:bg-black`}
        >
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          SCAN
        </button>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8">

        {activeScannedOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
            <Camera className="w-16 h-16 text-slate-400 mb-6" />
            <h3 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">No Active Tokens</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">
              Scan a student QR code to load their order
            </p>
          </div>
        ) : (
          activeScannedOrders.map(orderId => {
            const items = orderItemsMap[orderId] || [];
            const pendingCount = items.filter(it => it.status !== 'SERVED' && !servedKeys.has(`${orderId}-${it.itemId}`)).length;

            return (
              <div key={orderId} className={`rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden shadow-2xl ${
                pendingCount === 0 
                ? 'bg-emerald-600 border-emerald-500 scale-[1.02] active:scale-[0.98]' 
                : 'bg-white border-slate-100'
              }`}>
                
                {/* Order Header */}
                <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-5'} ${pendingCount === 0 ? 'bg-transparent' : 'bg-slate-900'} flex items-center justify-between`}>
                  <div>
                    <p className={`text-[8px] font-black uppercase tracking-widest ${pendingCount === 0 ? 'text-white/60' : 'text-slate-500'}`}>Manifest ID</p>
                    <h3 className={`${isMobile ? 'text-base' : 'text-xl'} font-black text-white font-mono tracking-tighter`}>#{orderId.slice(-6).toUpperCase()}</h3>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${
                    pendingCount === 0 ? 'bg-white text-emerald-600' : 'bg-white/10 text-white'
                  }`}>
                    {pendingCount === 0 ? '✓ READY' : `${pendingCount} Left`}
                  </div>
                </div>

                {/* Items List */}
                <div className={`${isMobile ? 'p-3 space-y-2' : 'p-6 space-y-4'} ${pendingCount === 0 ? 'bg-emerald-600/10' : ''}`}>
                  {items.map(item => {
                    const cfg = getStatusConfig(item);
                    const key = `${orderId}-${item.itemId}`;
                    const isServing = processingKey === key;

                    return (
                      <div
                        key={item.itemId}
                        className={`flex items-center justify-between ${isMobile ? 'p-3 rounded-xl' : 'p-5 rounded-[1.5rem]'} border-2 transition-all duration-300 ${cfg.cardClass}`}
                      >
                        {/* Item Info */}
                        <div className="flex items-center gap-3 lg:gap-5">
                          <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-white rounded-xl lg:rounded-2xl shadow flex items-center justify-center border border-slate-100`}>
                            {React.cloneElement(cfg.icon as React.ReactElement, { className: isMobile ? 'w-4 h-4' : 'w-5 h-5' })}
                          </div>
                          <div>
                            <div className={`px-2 py-0.5 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest w-fit mb-1 ${cfg.badgeClass}`}>
                              {cfg.badge}
                            </div>
                            <h4 className={`${isMobile ? 'text-sm' : 'text-lg'} font-black text-slate-900 uppercase italic tracking-tight leading-none truncate max-w-[120px] lg:max-w-none`}>
                              {item.name}
                            </h4>
                            <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                              Qty: {item.quantity}
                            </p>
                          </div>
                        </div>

                        {/* Serve Button */}
                        {cfg.canServe ? (
                          <button
                            onClick={() => handleServe(orderId, item.itemId)}
                            disabled={!!isServing}
                            className={`${isMobile ? 'h-10 px-4 text-[9px]' : 'h-14 px-8 text-[10px]'} bg-slate-900 text-white rounded-xl lg:rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all hover:bg-emerald-600 shadow-lg flex items-center gap-2 shrink-0 ${!isServing ? 'animate-[pulse_2s_infinite] ring-2 ring-emerald-500/30' : ''}`}
                          >
                            {isServing
                              ? <Loader2 className="w-3 h-3 lg:w-4 lg:h-4 animate-spin" />
                              : <CheckCircle2 className="w-3 h-3 lg:w-4 lg:h-4" />
                            }
                            {!isServing && <span>SERVE</span>}
                          </button>
                        ) : item.status !== 'SERVED' && !servedKeys.has(key) ? (
                          <div className={`${isMobile ? 'h-10 px-4 text-[8px]' : 'h-14 px-8 text-[9px]'} bg-slate-50 text-slate-300 rounded-xl lg:rounded-2xl font-black uppercase tracking-widest flex items-center gap-2 border-2 border-slate-100 shrink-0`}>
                            <Lock className={isMobile ? 'w-3 h-3' : 'w-4 h-4'} />
                            <span>{item.status === 'PREPARING' ? 'COOKING' : 'WAIT'}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
