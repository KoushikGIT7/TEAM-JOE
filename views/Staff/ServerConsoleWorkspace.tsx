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
      <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
            <PackageCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Serving Counter</h2>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {activeScannedOrders.length > 0
                ? `${activeScannedOrders.length} Active Order${activeScannedOrders.length > 1 ? 's' : ''} on Manifest`
                : 'Scan a student QR to begin'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCameraOpen(true)}
          className="h-12 px-8 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 hover:bg-black"
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          SCAN QR
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
              <div key={orderId} className="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-xl overflow-hidden">
                
                {/* Order Header */}
                <div className="px-8 py-5 bg-slate-900 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Manifest ID</p>
                    <h3 className="text-xl font-black text-white font-mono tracking-tighter">#{orderId.slice(-6).toUpperCase()}</h3>
                  </div>
                  <div className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    pendingCount === 0 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white'
                  }`}>
                    {pendingCount === 0 ? '✓ Complete' : `${pendingCount} Remaining`}
                  </div>
                </div>

                {/* Items List */}
                <div className="p-6 space-y-4">
                  {items.map(item => {
                    const cfg = getStatusConfig(item);
                    const key = `${orderId}-${item.itemId}`;
                    const isServing = processingKey === key;

                    return (
                      <div
                        key={item.itemId}
                        className={`flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all duration-300 ${cfg.cardClass}`}
                      >
                        {/* Item Info */}
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-white rounded-2xl shadow flex items-center justify-center border border-slate-100">
                            {cfg.icon}
                          </div>
                          <div>
                            <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest w-fit mb-1.5 ${cfg.badgeClass}`}>
                              {cfg.badge}
                            </div>
                            <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tight leading-none">
                              {item.name}
                            </h4>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                              Qty: {item.quantity}
                            </p>
                          </div>
                        </div>

                        {/* Serve Button */}
                        {cfg.canServe ? (
                          <button
                            onClick={() => handleServe(orderId, item.itemId)}
                            disabled={!!isServing}
                            className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-emerald-600 shadow-lg flex items-center gap-2 shrink-0"
                          >
                            {isServing
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <><CheckCircle2 className="w-4 h-4" /> SERVE</>
                            }
                          </button>
                        ) : item.status !== 'SERVED' && !servedKeys.has(key) ? (
                          <div className="h-14 px-8 bg-slate-50 text-slate-300 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border-2 border-slate-100 shrink-0">
                            <Lock className="w-4 h-4" />
                            {item.status === 'PREPARING' ? 'COOKING...' : 'WAITING'}
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
