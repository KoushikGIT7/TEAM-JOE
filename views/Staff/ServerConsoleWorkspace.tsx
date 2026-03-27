import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, CheckCircle2, Zap, Lock, ChefHat, 
  PackageCheck, Loader2, X, XCircle
} from 'lucide-react';
import { serveSingleItem, rejectOrderItem, serveAllItems } from '../../services/firestore-db';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

interface ServerConsoleWorkspaceProps {
  scanQueue: string[];
  setScanQueue?: (fn: (prev: string[]) => string[]) => void;
  setIsCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile?: boolean;
  onOrderDataPreload?: (orderId: string, items: LiveItem[]) => void;
}

interface LiveItem {
  itemId: string;
  name: string;
  quantity: number;
  status: string;
  orderType: string;
  category?: string;
  orderId: string;
  imageUrl?: string | null;
  userName?: string;
  readyAt?: any;
}

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  scanQueue,
  setScanQueue,
  setIsCameraOpen,
  isMobile = false,
  onOrderDataPreload
}) => {
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, LiveItem[]>>({});
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [serveAllProcessing, setServeAllProcessing] = useState<string | null>(null);
  const [servedKeys, setServedKeys] = useState<Set<string>>(new Set());
  const [rejectedKeys, setRejectedKeys] = useState<Set<string>>(new Set());
  const unsubRefs = useRef<Record<string, () => void>>({});

  // 📡 Attach real-time listener to items subcollection for each scanned order
  useEffect(() => {
    scanQueue.forEach(orderId => {
      if (unsubRefs.current[orderId]) return;

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

  useEffect(() => {
    return () => { Object.values(unsubRefs.current).forEach(u => u()); };
  }, []);

  // Allow Zero-Lag preload from parent
  useEffect(() => {
    if (onOrderDataPreload) {
      (onOrderDataPreload as any)(setOrderItemsMap);
    }
  }, [onOrderDataPreload]);

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

  const handleReject = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    if (processingKey === key) return;
    setProcessingKey(key);
    try {
      // Reject by marking item as REJECTED in the order
      await rejectOrderItem(orderId, itemId);
      setRejectedKeys(prev => new Set(prev).add(key));
    } catch (err) {
      console.error('[REJECT-ERROR]', err);
      // Even if backend call fails, mark locally
      setRejectedKeys(prev => new Set(prev).add(key));
    } finally {
      setProcessingKey(null);
    }
  };

  const handleServeAll = async (orderId: string, readyItems: LiveItem[]) => {
    if (serveAllProcessing === orderId) return;
    setServeAllProcessing(orderId);
    try {
      await serveAllItems(orderId);
      // Optimistically mark all ready items locally
      setServedKeys(prev => {
        const next = new Set(prev);
        readyItems.forEach(it => next.add(`${orderId}-${it.itemId}`));
        return next;
      });
    } catch (err) {
      console.error('[SERVE-ALL-ERROR]', err);
    } finally {
      setServeAllProcessing(null);
    }
  };

  const [readyShelf, setReadyShelf] = useState<any[]>([]);

  // 🥘 [READY-SHELF] Proactively monitor kitchen handover
  useEffect(() => {
    const q = query(
      collection(db, 'prepBatches'),
      where('status', 'in', ['READY', 'ALMOST_READY']),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setReadyShelf(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const getStatusConfig = (item: LiveItem) => {
    const key = `${item.orderId}-${item.itemId}`;
    if (servedKeys.has(key) || item.status === 'SERVED') return {
      badge: 'SERVED ✓', badgeClass: 'bg-slate-200 text-slate-500',
      cardClass: 'opacity-40 grayscale', canAction: false,
      icon: <CheckCircle2 className="w-4 h-4 text-slate-400" />,
    };
    if (rejectedKeys.has(key) || item.status === 'REJECTED') return {
      badge: 'REJECTED', badgeClass: 'bg-red-100 text-red-500',
      cardClass: 'opacity-40', canAction: false,
      icon: <XCircle className="w-4 h-4 text-red-400" />,
    };
    
    // Check if this item exists in a batch on the ready shelf
    const onShelf = readyShelf.some(b => b.items.some((bi: any) => bi.orderId === item.orderId && bi.itemId === item.itemId));

    if (item.status === 'READY' || onShelf) return {
      badge: '⚡ READY TO SERVE', badgeClass: 'bg-emerald-500 text-white',
      cardClass: 'border-emerald-300 bg-emerald-50 ring-4 ring-emerald-500/10', canAction: true,
      icon: <Zap className="w-4 h-4 text-emerald-600 fill-current" />,
    };
    if (item.status === 'PREPARING') return {
      badge: '🍳 PREPARING', badgeClass: 'bg-amber-100 text-amber-700',
      cardClass: 'border-amber-100', canAction: false,
      icon: <ChefHat className="w-4 h-4 text-amber-500" />,
    };
    return {
      badge: '⏳ IN KITCHEN', badgeClass: 'bg-slate-100 text-slate-500',
      cardClass: 'border-slate-100', canAction: false,
      icon: <Lock className="w-4 h-4 text-slate-300" />,
    };
  };

  const activeScannedOrders = scanQueue;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f8f8] font-sans select-none overflow-hidden">

      {/* HEADER */}
      <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-5'} border-b border-slate-100 flex items-center justify-between shrink-0 bg-white shadow-sm z-10`}>
        <div className="flex items-center gap-3">
          <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-slate-900 rounded-xl flex items-center justify-center shadow-lg`}>
            <PackageCheck className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
          </div>
          <div>
            <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-black text-slate-900 uppercase italic tracking-tighter`}>Serving Console</h2>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
              {activeScannedOrders.length === 0 ? 'Ready to Scan' : `${activeScannedOrders.length} Active Manifests`}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCameraOpen(true)}
          className={`${isMobile ? 'h-10 px-4 text-[10px]' : 'h-12 px-8 text-[11px]'} bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2 hover:bg-black`}
        >
          <Camera className="w-3.5 h-3.5 text-emerald-400" />
          SCAN
        </button>
      </div>

      {/* READY SHELF BAR */}
      {readyShelf.length > 0 && (
        <div className="bg-emerald-50 border-b border-emerald-100 py-3 px-4 lg:px-8 flex items-center gap-4 overflow-x-auto no-scrollbar shrink-0 shadow-inner">
           <div className="flex items-center gap-2 shrink-0 border-r border-emerald-200 pr-4 mr-2">
             <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse">
               <ChefHat className="w-4 h-4 text-white" />
             </div>
             <div>
               <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest leading-none">Ready</p>
               <p className="text-[10px] font-black text-emerald-900 uppercase italic leading-none">Shelf</p>
             </div>
           </div>
           
           <div className="flex items-center gap-3">
             {readyShelf.map(batch => (
               <div key={batch.id} className="h-10 px-4 rounded-xl bg-white border border-emerald-200 shadow-sm flex items-center gap-3 shrink-0">
                 <div className="flex -space-x-2">
                   {batch.items.slice(0, 3).map((it: any, idx: number) => (
                     <div key={idx} className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-emerald-600">
                        {it.orderId.slice(-1).toUpperCase()}
                     </div>
                   ))}
                   {batch.items.length > 3 && (
                     <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black text-slate-500">
                       +{batch.items.length - 3}
                     </div>
                   )}
                 </div>
                 <div className="min-w-0">
                    <p className="text-[9px] font-black text-slate-900 uppercase truncate leading-tight">{batch.itemName}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Batch #{batch.id.slice(-4).toUpperCase()}</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
        {activeScannedOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-20">
            <Camera className="w-16 h-16 text-slate-400 mb-6" />
            <h3 className="text-2xl font-black text-slate-700 uppercase italic tracking-tighter">No Active Orders</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-3">
              Scan a student QR code to load their order
            </p>
          </div>
        ) : (
          activeScannedOrders.map(orderId => {
            const items = orderItemsMap[orderId] || [];
            const pendingCount = items.filter(it =>
              it.status !== 'SERVED' && !servedKeys.has(`${orderId}-${it.itemId}`) &&
              it.status !== 'REJECTED' && !rejectedKeys.has(`${orderId}-${it.itemId}`)
            ).length;

            const isLoading = items.length === 0;

            return (
              <div key={orderId} className={`rounded-3xl border-2 overflow-hidden shadow-xl transition-all duration-500 ${
                pendingCount === 0 && !isLoading ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}>
                
                {/* Order Header */}
                {(() => {
                  const readyItems = items.filter(it =>
                    it.status === 'READY' &&
                    !servedKeys.has(`${orderId}-${it.itemId}`) &&
                    !rejectedKeys.has(`${orderId}-${it.itemId}`)
                  );
                  const isServeAllRunning = serveAllProcessing === orderId;
                  return (
                    <div className={`${isMobile ? 'px-4 py-3' : 'px-6 py-4'} ${pendingCount === 0 && !isLoading ? 'bg-emerald-600' : 'bg-slate-900'} flex items-center justify-between gap-3`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setScanQueue?.(prev => prev.filter(q => q !== orderId));
                          }}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">ORDER TOKEN</p>
                          <h3 className={`${isMobile ? 'text-base' : 'text-xl'} font-black text-white font-mono tracking-tighter truncate`}>
                            #{orderId.slice(-6).toUpperCase()}
                          </h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* SERVE ALL button — only visible when at least one item is READY */}
                        {readyItems.length > 0 && pendingCount > 0 && (
                          <button
                            onClick={() => handleServeAll(orderId, readyItems)}
                            disabled={isServeAllRunning}
                            className={`${isMobile ? 'h-9 px-3 text-[9px]' : 'h-10 px-5 text-[10px]'} bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-1.5 shadow-lg ring-2 ring-emerald-400/40`}
                          >
                            {isServeAllRunning
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <><CheckCircle2 className="w-3 h-3" /><span>Serve All</span></>
                            }
                          </button>
                        )}
                        <div className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                          pendingCount === 0 && !isLoading ? 'bg-white text-emerald-700' : 'bg-white/10 text-white'
                        }`}>
                          {isLoading ? 'LOADING...' : pendingCount === 0 ? '✓ ALL DONE' : `${pendingCount} Left`}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Items List */}
                <div className={`${isMobile ? 'p-3 space-y-3' : 'p-5 space-y-4'}`}>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Loading items...</span>
                    </div>
                  ) : items.map(item => {
                    const cfg = getStatusConfig(item);
                    const key = `${orderId}-${item.itemId}`;
                    const isProcessing = processingKey === key;
                    const isDone = servedKeys.has(key) || item.status === 'SERVED' || rejectedKeys.has(key) || item.status === 'REJECTED';

                    return (
                      <div
                        key={item.itemId}
                        className={`flex items-center gap-4 ${isMobile ? 'p-3 rounded-2xl' : 'p-4 rounded-2xl'} border-2 bg-white transition-all duration-300 ${cfg.cardClass}`}
                      >
                        {/* Food Image */}
                        <div className={`${isMobile ? 'w-14 h-14' : 'w-20 h-20'} rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200`}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {React.cloneElement(cfg.icon as React.ReactElement)}
                            </div>
                          )}
                        </div>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest mb-1.5 ${cfg.badgeClass}`}>
                            {cfg.badge}
                          </div>
                          <h4 className={`${isMobile ? 'text-sm' : 'text-base'} font-black text-slate-900 leading-tight truncate`}>
                            {item.name || 'Unknown Item'}
                          </h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {item.category} · Qty {item.quantity}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {cfg.canAction ? (
                            <>
                              <button
                                onClick={() => handleServe(orderId, item.itemId)}
                                disabled={!!isProcessing}
                                className={`${isMobile ? 'h-9 px-3 text-[9px]' : 'h-10 px-5 text-[10px]'} bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-1.5 shadow-md animate-pulse ring-2 ring-emerald-400/40`}
                              >
                                {isProcessing
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <><CheckCircle2 className="w-3 h-3" /><span>SERVE</span></>
                                }
                              </button>
                              <button
                                onClick={() => handleReject(orderId, item.itemId)}
                                disabled={!!isProcessing}
                                className={`${isMobile ? 'h-9 px-3 text-[9px]' : 'h-10 px-5 text-[10px]'} bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-500 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-1.5`}
                              >
                                <XCircle className="w-3 h-3" />
                                <span>REJECT</span>
                              </button>
                            </>
                          ) : isDone ? null : (
                            <div className={`${isMobile ? 'h-9 px-3 text-[8px]' : 'h-10 px-5 text-[9px]'} bg-slate-50 border-2 border-slate-100 text-slate-300 rounded-xl font-black uppercase tracking-widest flex items-center gap-1.5`}>
                              <Lock className="w-3 h-3" />
                              <span>{item.status === 'PREPARING' ? 'COOKING' : 'WAITING'}</span>
                            </div>
                          )}
                        </div>
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
