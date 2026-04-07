import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, CheckCircle2, Zap, Lock, ChefHat, 
  PackageCheck, Loader2, X, XCircle
} from 'lucide-react';
import { serveItem } from '../../services/firestore-db';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
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
  const [showGreenLight, setShowGreenLight] = useState(false);
  const unsubRefs = useRef<Record<string, () => void>>({});

  // 🥘 [READY-SHELF] Proactive listen for kitchen output
  useEffect(() => {
    const q = query(collection(db, 'prepBatches'), where('status', '==', 'READY'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      setReadyShelf(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // 📡 Real-time listen for scanned orders
  useEffect(() => {
    scanQueue.forEach(orderId => {
      if (unsubRefs.current[orderId]) return;
      unsubRefs.current[orderId] = onSnapshot(collection(db, 'orders', orderId, 'items'), (snap) => {
        const items = snap.docs.map(d => ({ itemId: d.id, orderId, ...d.data() as any }));
        setOrderItemsMap(prev => ({ ...prev, [orderId]: items }));

        // 🟢 [GREEN-LIGHT-LOGIC]
        // Trigger if ALL scanned items are READY (including instant-ready bypass)
        const allReady = items.length > 0 && items.every(it => it.status === 'READY');
        if (allReady) {
           if (window.navigator.vibrate) window.navigator.vibrate(200);
           setShowGreenLight(true);
           setTimeout(() => setShowGreenLight(false), 1200);
        }
      });
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
    <div className="flex-1 flex flex-col h-full bg-[#f0f2f5] select-none overflow-hidden relative">
      
      {/* 🟢 FULL-SCREEN GREEN LIGHT OVERLAY */}
      {showGreenLight && (
         <div className="absolute inset-0 z-[100] bg-emerald-500 flex flex-col items-center justify-center text-white animate-in fade-in zoom-in duration-150">
           <CheckCircle2 className="w-48 h-48 mb-8 animate-bounce" />
           <h1 className="text-8xl font-black italic uppercase tracking-tighter">GOOD TO SERVE!</h1>
         </div>
      )}

      {/* 🚀 ZERO-TOUCH HEADER */}
      <div className="bg-white px-8 py-6 border-b-4 border-slate-100 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-xl">
              <PackageCheck className="w-8 h-8 text-white" />
           </div>
           <div>
              <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Handover Station</h2>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mt-1 animate-pulse">● QR SENSOR ACTIVE</p>
           </div>
        </div>

        <button
          onClick={() => setIsCameraOpen(true)}
          className="h-16 px-12 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-2xl active:scale-95 transition-all flex items-center gap-4 border-b-8 border-black"
        >
          <Camera className="w-6 h-6 text-emerald-400" />
          SCAN TOKEN
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
        {scanQueue.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-10 grayscale py-20">
            <Camera className="w-32 h-32 text-slate-900 mb-8" />
            <h3 className="text-4xl font-black text-slate-900 uppercase italic">Waiting for Scanner...</h3>
          </div>
        ) : (
          scanQueue.map(orderId => {
            const items = orderItemsMap[orderId] || [];
            const readyItems = items.filter(it => 
               it.status === 'READY' || readyShelf.some(b => b.items.some((bi: any) => bi.orderId === it.orderId && bi.itemId === it.itemId))
            ).filter(it => !servedKeys.has(`${orderId}-${it.itemId}`) && it.status !== 'SERVED');

            const isFullyReady = readyItems.length > 0 && readyItems.length === items.filter(it => !servedKeys.has(`${orderId}-${it.itemId}`) && it.status !== 'SERVED').length;
            const isProcessing = serveAllProcessing === orderId;

            return (
              <div key={orderId} className={`rounded-[3rem] border-8 transition-all duration-300 ${
                isFullyReady ? 'border-emerald-500 bg-emerald-50 shadow-emerald-500/20 shadow-2xl scale-[1.02]' : 'border-slate-200 bg-white shadow-xl'
              }`}>
                
                <div className={`p-8 flex items-center justify-between ${isFullyReady ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                   <div className="flex items-center gap-6">
                      <button onClick={() => setScanQueue?.(p => p.filter(q => q !== orderId))} className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center"><X className="w-6 h-6" /></button>
                      <div>
                         <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">ORDER TOKEN</p>
                         <h3 className="text-5xl font-black font-mono">#{orderId.slice(-4).toUpperCase()}</h3>
                      </div>
                   </div>

                   {readyItems.length > 0 && (
                      <button 
                        onClick={() => handleServeAll(orderId, readyItems)}
                        disabled={isProcessing}
                        className="h-20 px-12 bg-white text-slate-900 rounded-[1.5rem] font-black uppercase text-xl italic tracking-tighter shadow-2xl active:scale-95 transition-all flex items-center gap-4 border-b-8 border-slate-200"
                      >
                        {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <><Zap className="w-8 h-8 fill-slate-900" /><span>SERVE EVERYTHING</span></>}
                      </button>
                   )}
                </div>

                <div className="p-10 space-y-6">
                   {items.filter(it => !servedKeys.has(`${orderId}-${it.itemId}`) && it.status !== 'SERVED').map((it, idx) => {
                      const isItemReady = it.status === 'READY' || readyShelf.some(b => b.items.some((bi: any) => bi.orderId === it.orderId && bi.itemId === it.itemId));
                      return (
                         <div key={`${orderId}-${idx}`} className={`p-6 rounded-3xl border-2 flex items-center justify-between transition-all ${isItemReady ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-100 bg-slate-50 opacity-40'}`}>
                            <div className="flex items-center gap-6">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black ${isItemReady ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                  {it.quantity}
                               </div>
                               <div>
                                  <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{it.name || 'Unnamed Item'}</h4>
                                  <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{isItemReady ? 'KITCHEN READY' : 'PREPARING...'}</p>
                               </div>
                            </div>
                            {isItemReady && (
                               <button 
                                 onClick={() => handleServeSingle(orderId, it.itemId)}
                                 disabled={processingKey === `${orderId}-${it.itemId}`}
                                 className="w-16 h-16 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center shadow-md active:scale-90 transition-all hover:bg-emerald-50"
                               >
                                  {processingKey === `${orderId}-${it.itemId}` ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500" /> : <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                               </button>
                            )}
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
