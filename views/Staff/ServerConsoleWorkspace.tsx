import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, CheckCircle2, Zap, PackageCheck, 
  Loader2, X, AlertCircle, Layers
} from 'lucide-react';
import { serveItem } from '../../services/firestore-db';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db, auth } from '../../firebase';

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
  orderId: string;
}

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  scanQueue,
  setScanQueue,
  setIsCameraOpen,
  isMobile = false
}) => {
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, LiveItem[]>>({});
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [serveAllProcessing, setServeAllProcessing] = useState<string | null>(null);
  const [servedKeys, setServedKeys] = useState<Set<string>>(new Set());
  const [readyShelf, setReadyShelf] = useState<any[]>([]);
  const [showPurpleLight, setShowPurpleLight] = useState(false);
  const unsubRefs = useRef<Record<string, () => void>>({});

  // 🥘 [READY-SHELF] Proactive listen for kitchen output
  useEffect(() => {
    const q = query(collection(db, 'prepBatches'), where('status', '==', 'READY'), limit(20));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReadyShelf(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.warn(`[ServerConsoleWorkspace:readyShelf] Listener error: ${error.message}`);
      }
    );
    return () => unsub();
  }, []);

  // 📡 Real-time listen for scanned orders
  useEffect(() => {
    scanQueue.forEach(orderId => {
      if (unsubRefs.current[orderId]) return;
      unsubRefs.current[orderId] = onSnapshot(
        collection(db, 'orders', orderId, 'items'),
        (snap) => {
          const items = snap.docs.map(d => ({ itemId: d.id, orderId, ...d.data() as any }));
          setOrderItemsMap(prev => ({ ...prev, [orderId]: items }));

          // 🟣 Trigger purple flash if ALL scanned items are READY
          const allReady = items.length > 0 && items.every(it => it.status === 'READY');
          if (allReady) {
            if (window.navigator.vibrate) window.navigator.vibrate(200);
            setShowPurpleLight(true);
            setTimeout(() => setShowPurpleLight(false), 1200);
          }
        },
        (error) => {
          console.warn(`[ServerConsoleWorkspace:items:${orderId}] Listener error: ${error.message}`);
        }
      );
    });
    return () => {
      const activeIds = new Set(scanQueue);
      Object.keys(unsubRefs.current).forEach(id => {
        if (!activeIds.has(id)) { unsubRefs.current[id](); delete unsubRefs.current[id]; }
      });
    };
  }, [scanQueue]);

  const handleServeAll = async (orderId: string, items: LiveItem[]) => {
    if (serveAllProcessing === orderId) return;
    setServeAllProcessing(orderId);
    try {
      const promises = items.map(it => serveItem(orderId, it.itemId, auth.currentUser?.uid || 'system'));
      await Promise.all(promises);
      setServedKeys(prev => {
        const next = new Set(prev);
        items.forEach(it => next.add(`${orderId}-${it.itemId}`));
        return next;
      });
      setTimeout(() => setScanQueue?.(prev => prev.filter(q => q !== orderId)), 800);
    } catch (err) { console.error(err); }
    finally { setServeAllProcessing(null); }
  };

  const handleServeSingle = async (orderId: string, itemId: string) => {
    const key = `${orderId}-${itemId}`;
    if (processingKey === key) return;
    setProcessingKey(key);
    try {
      await serveItem(orderId, itemId, auth.currentUser?.uid || 'system');
      setServedKeys(prev => new Set(prev).add(key));
    } catch (err) { console.error(err); }
    finally { setProcessingKey(null); }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-lowest text-white select-none overflow-hidden relative">

      {/* 🟣 FULL-SCREEN PURPLE LIGHT OVERLAY */}
      {showPurpleLight && (
        <div className="absolute inset-0 z-[100] bg-brand-purple flex flex-col items-center justify-center text-white animate-in fade-in zoom-in duration-150">
          <CheckCircle2 className="w-48 h-48 mb-8 animate-bounce text-white" />
          <h1 className="text-8xl font-display font-black italic uppercase tracking-tighter">GOOD TO SERVE!</h1>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-surface-low px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 pl-14"> {/* pl-14 leaves room for floating exit btn */}
          <div className="w-11 h-11 bg-surface-mid rounded-xl flex items-center justify-center border border-white/10 shadow-lg">
            <PackageCheck className="w-5 h-5 text-brand-purple" />
          </div>
          <div>
            <h2 className="text-xl font-display font-black text-white uppercase italic tracking-tight">Handover Station</h2>
            <span className="font-mono text-[9px] text-brand-purple bg-brand-purple/10 border border-brand-purple/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest leading-none mt-0.5 animate-pulse w-fit flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-purple" />
              Scanner Console HUD Active
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsCameraOpen(true)}
          className="h-11 px-6 bg-brand-purple hover:bg-brand-purple-light text-black rounded-xl font-display font-black uppercase text-xs tracking-wider shadow-md active:scale-95 transition-all flex items-center gap-2 border-b-2 border-brand-purple-dark cursor-pointer"
        >
          <Camera className="w-4 h-4 text-black" />
          SCAN TOKEN
        </button>
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Top section header */}
          <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-white">
                Active Order Queue
              </h3>
              <p className="font-sans text-xs text-zinc-500">
                Scanned tokens waiting for physical handover confirmation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-brand-purple bg-brand-purple/10 border border-brand-purple/20 px-3 py-1 rounded-full font-bold">
                {scanQueue.length} in queue
              </span>
            </div>
          </section>

          {/* Main grid: Orders | Ready Shelf */}
          <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left (col-span-2): Scanned order cards */}
            <section className="md:col-span-2 space-y-4">
              <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-brand-purple" />
                Scanned Tokens
              </h4>

              {scanQueue.length === 0 ? (
                <div className="glass-bg glass-stroke rounded-2xl p-12 text-center space-y-4">
                  <Camera className="w-12 h-12 text-zinc-600 mx-auto" />
                  <div>
                    <h3 className="font-display font-bold text-sm text-zinc-400">Awaiting Scanner Input</h3>
                    <p className="font-sans text-xs text-zinc-600 mt-1">
                      Scan a student's order QR code to add it to the queue.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCameraOpen(true)}
                    className="mx-auto h-10 px-6 rounded-xl bg-brand-purple hover:bg-brand-purple-light text-black font-mono text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer active:scale-95 transition-all shadow-md shadow-brand-purple/10"
                  >
                    <Camera className="w-3.5 h-3.5" /> OPEN SCANNER
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {scanQueue.map(orderId => {
                    const items = orderItemsMap[orderId] || [];
                    const pendingItems = items.filter(it =>
                      !servedKeys.has(`${orderId}-${it.itemId}`) && it.status !== 'SERVED'
                    );
                    const readyItems = pendingItems.filter(it =>
                      it.status === 'READY' || readyShelf.some(b =>
                        b.items?.some((bi: any) => bi.orderId === it.orderId && bi.itemId === it.itemId)
                      )
                    );

                    const isFullyReady = readyItems.length > 0 && readyItems.length === pendingItems.length;
                    const isProcessing = serveAllProcessing === orderId;

                    return (
                      <div
                        key={orderId}
                        className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                          isFullyReady
                            ? 'border-brand-purple/50 shadow-lg shadow-brand-purple/10'
                            : 'glass-stroke glass-bg'
                        }`}
                      >
                        {/* Order card header */}
                        <div className={`px-5 py-4 flex items-center justify-between border-b border-white/5 ${
                          isFullyReady ? 'bg-brand-purple/10' : 'bg-surface-mid/60'
                        }`}>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setScanQueue?.(p => p.filter(q => q !== orderId))}
                              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div>
                              <p className="text-[8px] font-mono font-bold uppercase tracking-widest text-zinc-500">ORDER TOKEN</p>
                              <h3 className="text-2xl font-display font-black font-mono text-white">
                                #{orderId.slice(-4).toUpperCase()}
                              </h3>
                            </div>
                          </div>

                          {readyItems.length > 0 && (
                            <button
                              onClick={() => handleServeAll(orderId, readyItems)}
                              disabled={isProcessing}
                              className={`h-10 px-5 rounded-xl font-display font-black uppercase text-xs tracking-wide shadow-md active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${
                                isFullyReady
                                  ? 'bg-brand-purple text-black hover:bg-brand-purple-light'
                                  : 'bg-surface-high text-white hover:bg-zinc-700 border border-white/10'
                              }`}
                            >
                              {isProcessing
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <><Zap className="w-4 h-4 fill-current" /><span>SERVE ALL</span></>
                              }
                            </button>
                          )}
                        </div>

                        {/* Order items list */}
                        <div className="p-4 space-y-2.5 bg-surface-low">
                          {pendingItems.length === 0 ? (
                            <p className="text-center py-4 font-sans text-xs text-zinc-500">All items served.</p>
                          ) : pendingItems.map((it, idx) => {
                            const isItemReady = it.status === 'READY' || readyShelf.some(b =>
                              b.items?.some((bi: any) => bi.orderId === it.orderId && bi.itemId === it.itemId)
                            );
                            return (
                              <div
                                key={`${orderId}-${idx}`}
                                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                                  isItemReady
                                    ? 'border-brand-purple/20 bg-brand-purple/5'
                                    : 'border-white/5 bg-surface-mid/30 opacity-40'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-display font-black text-sm ${
                                    isItemReady ? 'bg-brand-purple text-black' : 'bg-surface-high text-zinc-500 border border-white/5'
                                  }`}>
                                    {it.quantity}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-display font-extrabold text-white uppercase italic tracking-tight">
                                      {it.name || 'Unnamed Item'}
                                    </h4>
                                    <p className={`text-[9px] font-mono font-bold tracking-widest uppercase ${
                                      isItemReady ? 'text-brand-purple' : 'text-zinc-500'
                                    }`}>
                                      {isItemReady ? 'KITCHEN READY' : 'PREPARING...'}
                                    </p>
                                  </div>
                                </div>
                                {isItemReady && (
                                  <button
                                    onClick={() => handleServeSingle(orderId, it.itemId)}
                                    disabled={processingKey === `${orderId}-${it.itemId}`}
                                    className="w-10 h-10 bg-surface-mid border border-white/10 hover:bg-surface-high rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-all text-brand-purple cursor-pointer"
                                  >
                                    {processingKey === `${orderId}-${it.itemId}`
                                      ? <Loader2 className="w-4 h-4 animate-spin" />
                                      : <CheckCircle2 className="w-5 h-5" />
                                    }
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Right (col-span-1): Ready shelf / kitchen output */}
            <section className="space-y-4">
              <h4 className="font-display font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-purple" />
                Ready on Shelf
              </h4>

              <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-3">
                <div className="border-b border-white/5 pb-2">
                  <p className="font-sans text-[10px] text-zinc-500 leading-normal">
                    Items confirmed READY by the kitchen. Tap SERVE ALL on the left to dispatch.
                  </p>
                </div>

                {readyShelf.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="font-sans text-xs text-zinc-500">No items on ready shelf.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {readyShelf.map((batch: any) => (
                      <div key={batch.id} className="glass-bg glass-stroke rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="font-display font-bold text-xs text-white">{batch.mealName || 'Batch Item'}</p>
                          <span className="font-mono text-[9px] text-brand-purple uppercase tracking-widest">
                            {batch.items?.length || 0} orders
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-brand-purple bg-brand-purple/10 border border-brand-purple/20 px-2 py-0.5 rounded-full font-bold">
                          READY
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick actions panel */}
              <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-3">
                <div className="border-b border-white/5 pb-2">
                  <h5 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                    Quick Actions
                  </h5>
                </div>
                <button
                  onClick={() => setIsCameraOpen(true)}
                  className="w-full h-10 rounded-xl bg-brand-purple hover:bg-brand-purple-light text-black font-mono text-[10.5px] font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-brand-purple/10 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" /> SCAN NEXT TOKEN
                </button>
                <button
                  onClick={() => setScanQueue?.(() => [])}
                  disabled={scanQueue.length === 0}
                  className="w-full h-10 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-on-surface font-mono text-[10.5px] font-bold tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-30 cursor-pointer active:scale-95 transition-all"
                >
                  CLEAR ALL TOKENS
                </button>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
