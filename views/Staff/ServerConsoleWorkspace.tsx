import React, { useMemo } from 'react';
import { Camera, Check, CheckCircle, Zap, X } from 'lucide-react';
import { Order } from '../../types';

interface ServerConsoleWorkspaceProps {
  activeOrders: Order[];
  scanQueue: string[];
  setScanQueue: React.Dispatch<React.SetStateAction<string[]>>;
  isCameraOpen: boolean;
  setIsCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleQRScan: (data: string) => void;
  handleServeItem: (orderId: string, itemId: string, qty: number) => void;
  handleServeAll: (orderId: string) => void;
  scanFeedback: {
    status: 'VALID' | 'INVALID' | null;
    message?: string;
    subtext?: string;
    orderId?: string;
  };
}

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  activeOrders,
  scanQueue,
  setScanQueue,
  isCameraOpen,
  setIsCameraOpen,
  handleServeItem,
  handleServeAll,
  scanFeedback,
}) => {
  const focusedOrderId = useMemo(() => scanQueue[0] || null, [scanQueue]);
  const nextInQueueIds = useMemo(() => scanQueue.slice(1), [scanQueue]);

  const scannedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return activeOrders.find(o => o.id === focusedOrderId) || null;
  }, [activeOrders, focusedOrderId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FDFDFD] relative">
      {/* SCAN FEEDBACK OVERLAY (Static meal fast path or scan results) */}
      {scanFeedback.status && (
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center transition-all duration-300 animate-in fade-in ${
          scanFeedback.status === 'VALID' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          <div className="flex flex-col items-center text-white scale-125">
            <div className="w-48 h-48 rounded-full bg-white/20 flex items-center justify-center mb-8 backdrop-blur-md">
              {scanFeedback.status === 'VALID' ? (
                <Check className="w-32 h-32 text-white stroke-[4]" />
              ) : (
                <X className="w-32 h-32 text-white stroke-[4]" />
              )}
            </div>
            <h1 className="text-8xl font-black tracking-tighter mb-2 italic uppercase">{scanFeedback.message}</h1>
            <p className="text-2xl font-bold opacity-90 uppercase tracking-[0.2em]">{scanFeedback.subtext}</p>
            {scanFeedback.orderId && (
              <p className="mt-8 px-6 py-2 bg-black/20 rounded-full text-sm font-mono tracking-widest backdrop-blur-sm italic">
                TOKEN #{scanFeedback.orderId}
              </p>
            )}
          </div>
        </div>
      )}

      {/* TOP: SCAN AREA HEADER / STATUS */}
      <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">Scanner Status</h3>
          <p className="text-xs font-bold text-green-500 uppercase tracking-widest">Hardware active • Ready</p>
        </div>
        <button 
          onClick={() => setIsCameraOpen(true)}
          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
        >
          <Camera className="w-4 h-4" /> Open Interactive Camera
        </button>
      </div>

      {/* MAIN FOCUS: ACTIVE ORDER */}
      <div className="flex-1 flex items-center justify-center p-10 bg-slate-50/50 relative overflow-hidden">
        {scannedOrder ? (
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-[3rem] shadow-2xl shadow-slate-200/50 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-full">
            {/* Active Order Header */}
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl">
                     <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serving Now</p>
                     <h2 className="text-4xl font-black text-slate-900 tracking-tighter italic leading-none">
                       #{scannedOrder.id.slice(-6).toUpperCase()}
                     </h2>
                  </div>
               </div>
               <button 
                 onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} 
                 className="w-12 h-12 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
               >
                 <X className="w-5 h-5" />
               </button>
            </div>

            {/* Items List */}
            <div className="p-8 overflow-y-auto space-y-4 custom-scrollbar">
              {scannedOrder.items.map(it => {
                const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                const done = rem <= 0;
                // Determine if it's cookable or static (For aesthetic coloring only)
                const isReady = it.status === 'READY' || done || it.orderType === 'FAST_ITEM';
                
                return (
                  <div key={it.id} className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${
                    done 
                      ? 'bg-green-50/50 border-green-100 opacity-60' 
                      : (isReady ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-80')
                  }`}>
                    <div className="flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl overflow-hidden shadow-inner ${done ? 'grayscale' : ''}`}>
                         <img src={it.imageUrl} className="w-full h-full object-cover" alt={it.name} />
                      </div>
                      <div>
                         <h4 className="text-lg font-black text-slate-900 leading-none mb-1">{it.name}</h4>
                         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                           {done ? 'Completed' : (isReady ? 'Ready to serve' : 'Wait... Preparing')}
                         </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                       {!done && (
                         <div className="flex flex-col items-center justify-center mr-4">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Qty</span>
                            <span className="text-2xl font-black text-slate-900">{rem}</span>
                         </div>
                       )}
                       {!done ? (
                         <button 
                           onClick={() => handleServeItem(scannedOrder.id, it.id, rem)}
                           disabled={!isReady}
                           className={`h-14 px-8 font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-95 ${
                             isReady 
                               ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-200' 
                               : 'bg-slate-100 text-slate-300 pointer-events-none shadow-none'
                           }`}
                         >
                           {isReady ? 'Serve' : 'Waiting'}
                         </button>
                       ) : (
                         <div className="h-14 w-14 rounded-2xl bg-green-100 flex items-center justify-center text-green-600">
                           <CheckCircle className="w-8 h-8" />
                         </div>
                       )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions Footer */}
            <div className="p-8 pt-0 border-t border-slate-100 mt-auto bg-slate-50/30 flex gap-4 shrink-0">
               <button 
                 onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))}
                 className="flex-1 h-16 rounded-2xl border-2 border-slate-200 text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all hover:text-slate-900"
               >
                 Dismiss to Later
               </button>
               <button 
                 onClick={() => handleServeAll(scannedOrder.id)}
                 className="flex-[2] h-16 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-slate-200"
               >
                 Serve Entire Order
               </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
             <div className="w-48 h-48 bg-white border border-slate-100 rounded-[4rem] shadow-inner flex items-center justify-center mb-8 relative">
                <Camera className="w-16 h-16 text-slate-200" />
                <div className="absolute inset-6 border-[3px] border-slate-100 border-dashed rounded-[3rem] animate-[spin_10s_linear_infinite]" />
             </div>
             <h3 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 italic">Ready to Scan</h3>
             <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em]">Point standard barcode scanner at QR code</p>
          </div>
        )}
      </div>

      {/* BOTTOM STRIP: QUEUE PREVIEW */}
      <div className="h-24 bg-slate-900 px-10 flex items-center shrink-0 border-t border-slate-800">
         <div className="mr-8 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Scan Queue</span>
         </div>
         <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar items-center">
            {nextInQueueIds.map((id, index) => (
               <button
                  key={id}
                  onClick={() => setScanQueue(prev => [id, ...prev.filter(qId => qId !== id)])}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-mono text-sm font-bold transition-all shrink-0 flex items-center gap-3"
               >
                  <span className="text-[10px] text-slate-500">#{index + 2}</span>
                  {id.slice(-6).toUpperCase()}
               </button>
            ))}
            {nextInQueueIds.length === 0 && (
               <span className="text-xs font-bold text-slate-600 italic">Queue is currently empty.</span>
            )}
         </div>
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
