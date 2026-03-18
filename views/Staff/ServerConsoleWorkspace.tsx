import React, { useMemo, useEffect, useState } from 'react';
import { Camera, Check, CheckCircle, X, ChevronRight, Utensils, Clock, Zap, AlertTriangle } from 'lucide-react';
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
  handleForceReady: (orderId: string) => void;
  isProcessing: boolean;
  scanFeedback: {
    status: 'VALID' | 'INVALID' | null;
    message?: string;
    subtext?: string;
    orderId?: string;
  };
}

const getStatusDisplay = (item: CartItem): { text: string; flavor: 'READY' | 'WAITING' | 'DONE' | 'PARTIAL' } => {
  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
  if (rem <= 0) return { text: 'Served', flavor: 'DONE' };
  if (item.status === 'READY' || item.orderType === 'FAST_ITEM') return { text: 'Ready', flavor: 'READY' };
  if (item.status === 'PREPARING') return { text: 'Preparing', flavor: 'WAITING' };
  if (item.status === 'PENDING') return { text: 'In Queue', flavor: 'WAITING' };
  if (item.status === 'ABANDONED') return { text: 'Manual', flavor: 'DONE' };
  if ((item.servedQty || 0) > 0) return { text: 'Partial', flavor: 'PARTIAL' };
  return { text: item.status || 'Active', flavor: 'WAITING' };
};

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  activeOrders,
  scanQueue,
  setScanQueue,
  isCameraOpen,
  setIsCameraOpen,
  handleServeItem,
  handleServeAll,
  handleForceReady,
  scanFeedback,
  isProcessing,
}) => {
  const focusedOrderId = useMemo(() => scanQueue[0] || null, [scanQueue]);
  const nextInQueueIds = useMemo(() => scanQueue.slice(1), [scanQueue]);

  const scannedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return activeOrders.find(o => o.id === focusedOrderId) || null;
  }, [activeOrders, focusedOrderId]);

  const sortedItems = useMemo(() => {
    if (!scannedOrder) return [];
    return [...scannedOrder.items].sort((a, b) => {
      const aRem = a.remainingQty ?? (a.quantity - (a.servedQty || 0));
      const bRem = b.remainingQty ?? (b.quantity - (b.servedQty || 0));
      if (aRem <= 0 && bRem > 0) return 1;
      if (bRem <= 0 && aRem > 0) return -1;
      const aReady = a.status === 'READY' || a.orderType === 'FAST_ITEM';
      const bReady = b.status === 'READY' || b.orderType === 'FAST_ITEM';
      return Number(bReady) - Number(aReady); 
    });
  }, [scannedOrder]);

  const [highlightFlash, setHighlightFlash] = useState(false);
  useEffect(() => {
    if (scannedOrder) {
      setHighlightFlash(true);
      const t = setTimeout(() => setHighlightFlash(false), 800);
      return () => clearTimeout(t);
    }
  }, [scannedOrder?.id]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* 1. COMPACT STATUS HEADER */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white z-10">
        <div className="flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Kitchen Link</span>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500" />
                 <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Operational Status: LIVE</p>
              </div>
           </div>
        </div>
        <button 
          onClick={() => setIsCameraOpen(true)}
          className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-2 shadow-sm"
        >
          <Camera className="w-4 h-4" /> Open Scanner
        </button>
      </div>

      {/* 2. MAIN ACTIVE AREA (CLINICALLY CLEAN & HIGH DENSITY) */}
      <div className="flex-1 flex flex-col p-6 relative overflow-hidden">
        {scannedOrder ? (
          <div className={`w-full max-w-6xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col flex-1 max-h-full transition-all duration-300 overflow-hidden ${
            highlightFlash ? 'ring-4 ring-green-100 border-green-500' : 'border-slate-200'
          }`}>
            
            {/* Order Identity Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
               <div className="flex items-center gap-8">
                  <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
                     <Utensils className="w-7 h-7" />
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Active Scanned Token</p>
                     <div className="flex items-baseline gap-4">
                        <h2 className="text-4xl font-bold text-slate-900 tracking-tight font-mono">
                          #{scannedOrder.id.slice(-6).toUpperCase()}
                        </h2>
                        <span className="text-lg font-semibold text-slate-500 uppercase tracking-widest">{scannedOrder.userName}</span>
                     </div>
                  </div>
               </div>
               
               <div className="flex items-center gap-4">
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleServeAll(scannedOrder.id)}
                    className={`h-14 px-8 rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
                      isProcessing ? 'bg-slate-100 text-slate-300' : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                     {isProcessing ? 'Confirming...' : 'Serve All Ready Items'} <ChevronRight className="w-5 h-5" />
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} 
                    className="h-14 px-6 rounded-xl border border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                  >
                    Close
                  </button>
               </div>
            </div>

            {/* Product Manifest - High Visibility */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30 custom-scrollbar">
              {sortedItems.map(it => {
                const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                const statusInfo = getStatusDisplay(it);
                
                return (
                  <div key={it.id} className={`flex items-center gap-6 p-4 rounded-xl border transition-all ${
                     statusInfo.flavor === 'DONE' ? 'border-slate-100 bg-slate-50 opacity-40 grayscale' :
                     statusInfo.flavor === 'READY' ? 'border-green-200 bg-white shadow-sm' :
                     'border-slate-200 bg-white shadow-sm'
                  }`}>
                    {/* Compact Recognition Image */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                       <img 
                         src={it.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'} 
                         alt={it.name}
                         className="w-full h-full object-cover"
                         loading="lazy"
                       />
                    </div>

                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                           <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-none">{it.name}</h3>
                           <span className="bg-slate-100 text-slate-500 text-[9px] font-bold uppercase px-2 py-0.5 rounded tracking-widest">
                              {it.category}
                           </span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.flavor === 'READY' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                           <span className={`text-[10px] uppercase font-bold tracking-[0.1em] ${statusInfo.flavor === 'READY' ? 'text-green-600' : 'text-slate-500'}`}>
                              {statusInfo.text}
                           </span>
                        </div>
                     </div>
                    
                    <div className="flex items-center gap-8">
                       {statusInfo.flavor !== 'DONE' && (
                         <div className="text-right">
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Quantity</p>
                             <div className="flex items-center gap-1 justify-end">
                                <span className={`text-2xl font-bold text-slate-900 font-mono tracking-tighter`}>{rem}</span>
                                <span className="text-[9px] font-bold text-slate-300 uppercase">Qty</span>
                             </div>
                         </div>
                       )}

                       <div className="flex items-center gap-2">
                          {/* Force Ready Override */}
                          {statusInfo.flavor === 'WAITING' && (
                             <button
                               onClick={() => handleForceReady(scannedOrder.id)}
                               className="h-14 px-4 flex flex-col items-center justify-center bg-amber-50 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-100 transition-all active:scale-95"
                               title="Kitchen Override"
                             >
                                <Zap className="w-5 h-5 mb-0.5" />
                                <span className="text-[8px] font-bold uppercase tracking-widest">Override</span>
                             </button>
                          )}

                          {statusInfo.flavor !== 'DONE' ? (
                            <button 
                              disabled={statusInfo.flavor !== 'READY' && statusInfo.flavor !== 'PARTIAL' || isProcessing}
                              onClick={() => handleServeItem(scannedOrder.id, it.id, rem)}
                              className={`h-14 px-10 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 ${
                                (statusInfo.flavor === 'READY' || statusInfo.flavor === 'PARTIAL') && !isProcessing
                                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200' 
                                  : 'bg-slate-100 text-slate-300 pointer-events-none border border-slate-200 shadow-none'
                              }`}
                            >
                              {isProcessing ? 'Serving...' : (statusInfo.flavor === 'READY' || statusInfo.flavor === 'PARTIAL') ? 'Dispense' : 'Not Ready'}
                            </button>
                          ) : (
                            <div className="h-14 w-32 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 gap-2 opacity-60">
                              <CheckCircle className="w-5 h-5" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Servit</span>
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
             <div className="w-48 h-48 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-center mb-10 relative overflow-hidden">
                <Zap className="w-16 h-16 text-slate-100" />
                <div className="absolute inset-4 border border-slate-50 rounded-2xl" />
             </div>
             <h3 className="text-3xl font-bold text-slate-900 tracking-tight mb-2 uppercase">Server Terminal Idle</h3>
             <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Awaiting customer scan verification</p>
          </div>
        )}
      </div>

      {/* 3. SIMPLIFIED QUEUE STRIP */}
      <div className="h-24 bg-white px-6 flex items-center shrink-0 border-t border-slate-200">
         <div className="mr-8 flex flex-col justify-center border-r border-slate-100 pr-8">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Scanned Backlog</span>
            <div className="flex items-center gap-3">
               <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg" />
               <span className="text-2xl font-bold text-slate-900 font-mono tracking-tighter">{nextInQueueIds.length}</span>
            </div>
         </div>

         <div className="flex-1 flex gap-3 overflow-x-auto no-scrollbar items-center py-2">
            {nextInQueueIds.map((id) => {
               const order = activeOrders.find(o => o.id === id);
               const isFullyReady = order?.items.every(it => {
                 const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                 return rem <= 0 || it.status === 'READY' || it.orderType === 'FAST_ITEM';
               });
               const isPartial = order?.items.some(it => (it.servedQty || 0) > 0 && (it.remainingQty ?? (it.quantity - (it.servedQty || 0))) > 0);

               return (
                  <button
                     key={id}
                     onClick={() => setScanQueue(prev => [id, ...prev.filter(qId => qId !== id)])}
                     className={`px-6 h-14 rounded-lg font-mono text-sm font-bold transition-all shrink-0 flex items-center gap-4 border group ${
                       isFullyReady 
                         ? 'bg-green-50 border-green-200 text-green-700 shadow-sm' 
                         : isPartial
                           ? 'bg-amber-50 border-amber-200 text-amber-700'
                           : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                     }`}
                  >
                     <div className="flex flex-col items-start leading-none gap-0.5">
                        <span className="text-[8px] uppercase tracking-widest opacity-60 font-bold">Token</span>
                        <span>{id.slice(-6).toUpperCase()}</span>
                     </div>
                     {isFullyReady && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </button>
               )
            })}
            {nextInQueueIds.length === 0 && (
               <div className="flex items-center gap-3 text-slate-300 italic">
                  <span className="text-[10px] font-bold uppercase tracking-widest">No pending scans in line</span>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
