import React, { useMemo, useEffect, useState } from 'react';
import { Camera, Check, CheckCircle, X, ChevronRight } from 'lucide-react';
import { Order, CartItem } from '../../types';

interface ServerConsoleWorkspaceProps {
  activeOrders: Order[];
  scanQueue: string[];
  setScanQueue: React.Dispatch<React.SetStateAction<string[]>>;
  isCameraOpen: boolean;
  setIsCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleQRScan: (data: string) => void;
  handleServeItem: (orderId: string, itemId: string, qty: number) => void;
  handleServeAll: (orderId: string) => void;
  isProcessing: boolean;
  scanFeedback: {
    status: 'VALID' | 'INVALID' | null;
    message?: string;
    subtext?: string;
    orderId?: string;
  };
}

// Map raw status to user-friendly plain language strings
const getStatusDisplay = (item: CartItem): { text: string; flavor: 'READY' | 'WAITING' | 'DONE' } => {
  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
  if (rem <= 0) return { text: 'Served', flavor: 'DONE' };
  if (item.status === 'READY' || item.orderType === 'FAST_ITEM') return { text: 'Ready for pickup', flavor: 'READY' };
  if (item.status === 'PREPARING') return { text: 'Preparing', flavor: 'WAITING' };
  if (item.status === 'PENDING') return { text: 'Scheduled', flavor: 'WAITING' };
  if (item.status === 'ABANDONED') return { text: 'Re-queued for fresh prep', flavor: 'DONE' };
  return { text: item.status || 'Scheduled', flavor: 'WAITING' };
};

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  activeOrders,
  scanQueue,
  setScanQueue,
  isCameraOpen,
  setIsCameraOpen,
  handleServeItem,
  handleServeAll,
  scanFeedback,
  isProcessing,
}) => {
  const focusedOrderId = useMemo(() => scanQueue[0] || null, [scanQueue]);
  const nextInQueueIds = useMemo(() => scanQueue.slice(1), [scanQueue]);

  const scannedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return activeOrders.find(o => o.id === focusedOrderId) || null;
  }, [activeOrders, focusedOrderId]);

  // Force actionable items to the top to reduce eye-travel for the server
  const sortedItems = useMemo(() => {
    if (!scannedOrder) return [];
    return [...scannedOrder.items].sort((a, b) => {
      const aRem = a.remainingQty ?? (a.quantity - (a.servedQty || 0));
      const bRem = b.remainingQty ?? (b.quantity - (b.servedQty || 0));
      // Served items to bottom
      if (aRem <= 0 && bRem > 0) return 1;
      if (bRem <= 0 && aRem > 0) return -1;

      const aReady = a.status === 'READY' || a.orderType === 'FAST_ITEM';
      const bReady = b.status === 'READY' || b.orderType === 'FAST_ITEM';
      return Number(bReady) - Number(aReady); 
    });
  }, [scannedOrder]);

  // Highlight flash effect on new scan render
  const [highlightFlash, setHighlightFlash] = useState(false);
  useEffect(() => {
    if (scannedOrder) {
      setHighlightFlash(true);
      const t = setTimeout(() => setHighlightFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [scannedOrder?.id]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
      {/* SCAN FEEDBACK OVERLAY (Static meal fast path or scan results) */}
      {scanFeedback.status && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center transition-all duration-200 ${
          scanFeedback.status === 'VALID' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className="flex flex-col items-center text-white scale-125 md:scale-[2]">
            <div className={`w-36 h-36 rounded-[3rem] bg-white/20 flex items-center justify-center mb-10 backdrop-blur-md shadow-[0_0_100px_rgba(255,255,255,0.3)] ${scanFeedback.status === 'VALID' ? 'animate-[bounce_0.5s_ease-in-out_infinite]' : ''}`}>
              {scanFeedback.status === 'VALID' ? (
                <Check className="w-20 h-20 text-white stroke-[4]" />
              ) : (
                <X className="w-20 h-20 text-white stroke-[4]" />
              )}
            </div>
            <h1 className="text-8xl md:text-9xl font-black tracking-tighter mb-2 italic uppercase drop-shadow-2xl leading-none">
              {scanFeedback.message}
            </h1>
            <p className="text-3xl font-bold opacity-90 uppercase tracking-[0.3em] font-mono">{scanFeedback.subtext}</p>
            {scanFeedback.orderId && (
              <p className="mt-12 px-8 py-3 bg-black/30 border border-white/20 rounded-2xl text-2xl font-mono tracking-widest backdrop-blur-sm italic shadow-xl">
                TKT #{scanFeedback.orderId}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TOP: SCAN AREA HEADER / STATUS */}
      <div className="px-10 py-6 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Scanner Engine</h3>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Hardware Ready</p>
          </div>
        </div>
        <button 
          onClick={() => setIsCameraOpen(true)}
          className="px-8 py-4 bg-slate-100 hover:bg-slate-200 border-2 border-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-[0.2em] active:scale-[0.98] transition-all flex items-center gap-3"
        >
          <Camera className="w-5 h-5" /> Fallback Camera
        </button>
      </div>

      {/* MAIN FOCUS: ACTIVE ORDER */}
      <div className="flex-1 flex items-center justify-center p-10 bg-slate-50 relative overflow-hidden">
        {scannedOrder ? (
          <div className={`w-full max-w-4xl bg-white border rounded-[3rem] shadow-2xl flex flex-col max-h-full transition-all duration-300 ${
            highlightFlash ? 'ring-8 ring-green-100 ring-offset-4 border-green-200 scale-[1.02]' : 'border-slate-200 scale-100'
          }`}>
            {/* Active Order Header */}
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0 rounded-t-[3rem]">
               <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-slate-200/50">
                     <Check className="w-10 h-10 stroke-[3]" />
                  </div>
                  <div>
                     <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Active Dispatch</p>
                     <h2 className="text-6xl font-black text-slate-900 tracking-tighter italic leading-none font-mono">
                       #{scannedOrder.id.slice(-6).toUpperCase()}
                     </h2>
                  </div>
               </div>
               
               {/* Quick Resolve Actions */}
                <div className="flex flex-col gap-3">
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleServeAll(scannedOrder.id)}
                    className={`px-8 h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isProcessing ? 'bg-slate-400 text-slate-100 shadow-none cursor-wait' : 'bg-slate-900 hover:bg-black text-white shadow-slate-200'
                    }`}
                  >
                     {isProcessing ? 'SCANNING...' : 'Serve Ready Items'} <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} 
                    className={`px-8 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border-2 ${
                      isProcessing ? 'bg-slate-50 border-slate-100 text-slate-300' : 'bg-white border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
                    }`}
                  >
                    Push to pending
                  </button>
                </div>
            </div>

            {/* Items List */}
            <div className="p-10 overflow-y-auto space-y-4 custom-scrollbar bg-white">
              {sortedItems.map(it => {
                const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                const statusInfo = getStatusDisplay(it);
                
                return (
                  <div key={it.id} className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${
                     statusInfo.flavor === 'DONE' ? 'border-slate-100 bg-slate-50 grayscale opacity-60' :
                     statusInfo.flavor === 'READY' ? 'border-green-200 bg-white shadow-sm' :
                     'border-slate-100 bg-slate-50/80'
                  }`}>
                    <div className="flex items-center gap-6">
                       <h4 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase px-4">{it.name}</h4>
                       <span className={`text-[10px] md:text-xs font-black px-4 py-2 rounded-xl uppercase tracking-widest ${
                          statusInfo.flavor === 'READY' ? 'bg-green-100 text-green-700' :
                          statusInfo.flavor === 'DONE' ? 'bg-slate-200 text-slate-500' :
                          'bg-indigo-50 text-indigo-500' // WAITING
                       }`}>
                          {statusInfo.text}
                       </span>
                    </div>
                    
                    <div className="flex items-center gap-8">
                       {statusInfo.flavor !== 'DONE' && (
                         <div className="text-right flex flex-col justify-center items-end mr-4">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-1">Queue Size</span>
                            <span className="text-4xl font-black text-slate-900 font-mono tracking-tighter">×{rem}</span>
                         </div>
                       )}
                        {statusInfo.flavor !== 'DONE' ? (
                          <button 
                            disabled={statusInfo.flavor !== 'READY' || isProcessing}
                            onClick={() => handleServeItem(scannedOrder.id, it.id, rem)}
                            className={`h-20 w-40 font-black text-sm uppercase tracking-[0.2em] rounded-[1.5rem] transition-all shadow-xl active:scale-95 ${
                              statusInfo.flavor === 'READY' && !isProcessing
                                ? 'bg-green-500 hover:bg-green-600 text-white border-b-4 border-green-700 shadow-green-200' 
                                : 'bg-slate-200/50 text-slate-300 pointer-events-none shadow-none border-0 opacity-50'
                            }`}
                          >
                            {isProcessing ? 'SYNC...' : statusInfo.flavor === 'READY' ? 'SERVE' : 'WAIT'}
                          </button>
                       ) : (
                         <div className="h-20 w-40 rounded-[1.5rem] bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400">
                           <CheckCircle className="w-8 h-8" />
                         </div>
                       )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center max-w-lg">
             <div className="w-64 h-64 bg-white border border-slate-100 rounded-[5rem] shadow-xl flex items-center justify-center mb-12 relative">
                <Camera className="w-20 h-20 text-slate-200" />
                <div className="absolute inset-8 border-[4px] border-slate-100 border-dashed rounded-[4rem] animate-[spin_8s_linear_infinite]" />
             </div>
             <h3 className="text-6xl font-black text-slate-900 tracking-tighter mb-4 italic uppercase">Ready</h3>
             <p className="text-slate-400 text-lg font-bold uppercase tracking-[0.3em] font-mono">Present barcode overlay</p>
          </div>
        )}
      </div>

      {/* BOTTOM STRIP: COMPACT BUFFER QUEUE */}
      <div className="h-28 bg-slate-900 px-10 flex items-center shrink-0 border-t border-slate-800">
         <div className="mr-10 flex flex-col justify-center border-r border-slate-800 pr-10">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-2">Backlog</span>
            <div className="flex items-center gap-3 min-w-[120px]">
               <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" />
               <span className="text-xl font-black text-white font-mono tracking-tight">{nextInQueueIds.length} <span className="text-sm text-slate-600">Pending</span></span>
            </div>
         </div>

         <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar items-center py-4">
            {nextInQueueIds.map((id, index) => {
               const order = activeOrders.find(o => o.id === id);
               const isFullyReady = order?.items.every(it => {
                 const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                 return rem <= 0 || it.status === 'READY' || it.orderType === 'FAST_ITEM';
               });

               return (
                  <button
                     key={id}
                     onClick={() => setScanQueue(prev => [id, ...prev.filter(qId => qId !== id)])}
                     className={`px-8 h-16 rounded-[1.25rem] font-mono text-base font-black transition-all shrink-0 flex items-center gap-4 ${
                       isFullyReady 
                         ? 'bg-green-500 text-white shadow-lg shadow-green-900/20 hover:bg-green-400' 
                         : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                     }`}
                  >
                     <span className={`text-[11px] uppercase tracking-widest ${isFullyReady ? 'text-green-800' : 'text-slate-500'}`}>TKT</span>
                     #{id.slice(-6).toUpperCase()}
                     {isFullyReady && <div className="w-2 h-2 rounded-full bg-white ml-2 animate-pulse" />}
                  </button>
               )
            })}
            {nextInQueueIds.length === 0 && (
               <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-700 italic border border-slate-800 px-6 py-3 rounded-xl border-dashed">
                 Zero waiting tickets
               </span>
            )}
         </div>
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
