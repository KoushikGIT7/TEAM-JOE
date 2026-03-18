import React, { useMemo, useEffect, useState } from 'react';
import { Camera, Check, CheckCircle, X, ChevronRight, Utensils, Clock, Zap, AlertTriangle, Search } from 'lucide-react';
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
  if (item.status === 'PREPARING') return { text: 'Prep', flavor: 'WAITING' };
  if (item.status === 'PENDING') return { text: 'Queue', flavor: 'WAITING' };
  if (item.status === 'ABANDONED') return { text: 'Void', flavor: 'DONE' };
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
  const [filter, setFilter] = useState('');
  const focusedOrderId = useMemo(() => scanQueue[0] || null, [scanQueue]);
  const nextInQueueIds = useMemo(() => scanQueue.slice(1), [scanQueue]);

  const scannedOrder = useMemo(() => {
    if (!focusedOrderId) return null;
    return activeOrders.find(o => o.id === focusedOrderId) || null;
  }, [activeOrders, focusedOrderId]);

  const filteredItems = useMemo(() => {
    if (!scannedOrder) return [];
    let items = [...scannedOrder.items];
    if (filter) {
      items = items.filter(it => it.name.toLowerCase().includes(filter.toLowerCase()));
    }
    return items.sort((a, b) => {
      const aRem = a.remainingQty ?? (a.quantity - (a.servedQty || 0));
      const bRem = b.remainingQty ?? (b.quantity - (b.servedQty || 0));
      if (aRem <= 0 && bRem > 0) return 1;
      if (bRem <= 0 && aRem > 0) return -1;
      const aReady = a.status === 'READY' || a.orderType === 'FAST_ITEM';
      const bReady = b.status === 'READY' || b.orderType === 'FAST_ITEM';
      return Number(bReady) - Number(aReady); 
    });
  }, [scannedOrder, filter]);

  const [highlightFlash, setHighlightFlash] = useState(false);
  useEffect(() => {
    if (scannedOrder) {
      setHighlightFlash(true);
      const t = setTimeout(() => setHighlightFlash(false), 500);
      return () => clearTimeout(t);
    }
  }, [scannedOrder?.id]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* 1. COMPACT STATUS HEADER */}
      <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Inventory Link</span>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                 <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Sync Active: 100+ SKU Support</p>
              </div>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
           {scannedOrder && (
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Filter manifest..." 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 px-10 py-2 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all w-48 focus:w-64"
                />
                {filter && <button onClick={() => setFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-slate-400" /></button>}
             </div>
           )}
           <button 
             onClick={() => setIsCameraOpen(true)}
             className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 shadow-lg"
           >
             <Camera className="w-4 h-4" /> Next Scan
           </button>
        </div>
      </div>

      {/* 2. HIGH-CAPACITY ACTIVE AREA (GRID SUPPORT FOR 100+ ITEMS) */}
      <div className="flex-1 flex flex-col p-4 relative overflow-hidden">
        {scannedOrder ? (
          <div className={`w-full max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 max-h-full transition-all duration-300 overflow-hidden ${
            highlightFlash ? 'ring-4 ring-green-100 border-green-500 scale-[0.995]' : 'border-slate-200'
          }`}>
            
            {/* Identity Header (Ultra Slim) */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
               <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                     <Utensils className="w-6 h-6" />
                  </div>
                  <div>
                     <div className="flex items-baseline gap-3">
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-mono">#{scannedOrder.id.slice(-6).toUpperCase()}</h2>
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{scannedOrder.userName}</span>
                     </div>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{filteredItems.length} Products in List</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-3">
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleServeAll(scannedOrder.id)}
                    className={`h-12 px-6 rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isProcessing ? 'bg-slate-100 text-slate-300' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/10'
                    }`}
                  >
                     {isProcessing ? 'Syncing...' : 'Serve All Ready'} <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} 
                    className="h-12 w-12 rounded-lg border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
               </div>
            </div>

            {/* HIGH-DENSITY GRID (Optimized for 100 items) */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/20">
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                {filteredItems.map(it => {
                  const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
                  const statusInfo = getStatusDisplay(it);
                  
                  return (
                    <div key={it.id} className={`flex items-center p-3 rounded-xl border bg-white transition-all group ${
                       statusInfo.flavor === 'DONE' ? 'opacity-40 grayscale border-slate-100' :
                       statusInfo.flavor === 'READY' ? 'border-green-200 shadow-sm ring-1 ring-green-50' :
                       'border-slate-200'
                    }`}>
                      {/* Compact Image Recognition */}
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shrink-0 relative">
                         <img 
                           src={it.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'} 
                           alt={it.name}
                           className="w-full h-full object-cover"
                           loading="lazy"
                         />
                         {statusInfo.flavor === 'READY' && (
                            <div className="absolute inset-0 bg-green-500/10 border-2 border-green-500 rounded-lg animate-pulse" />
                         )}
                      </div>

                      <div className="flex-1 ml-4 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 truncate leading-tight mb-0.5">{it.name}</h3>
                          <div className="flex items-center gap-2">
                             <div className={`w-1 h-1 rounded-full ${statusInfo.flavor === 'READY' ? 'bg-green-500' : 'bg-slate-300'}`} />
                             <span className={`text-[8px] uppercase font-bold tracking-widest ${statusInfo.flavor === 'READY' ? 'text-green-600' : 'text-slate-400'}`}>
                                {statusInfo.text}
                             </span>
                          </div>
                       </div>
                      
                      <div className="flex items-center gap-4 ml-2">
                         <div className="text-right">
                             <div className="flex items-baseline gap-0.5">
                                <span className={`text-xl font-bold font-mono tracking-tighter ${rem > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{rem}</span>
                                <span className="text-[7px] font-bold text-slate-300 uppercase">Qty</span>
                             </div>
                         </div>

                         <div className="flex items-center gap-1.5 px-1">
                            {statusInfo.flavor === 'WAITING' && (
                               <button
                                 onClick={() => handleForceReady(scannedOrder.id)}
                                 className="w-8 h-10 flex items-center justify-center bg-amber-50 border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-100 transition-all active:scale-95"
                                 title="Override"
                               >
                                  <Zap className="w-4 h-4" />
                               </button>
                            )}

                            {statusInfo.flavor !== 'DONE' ? (
                              <button 
                                disabled={statusInfo.flavor !== 'READY' && statusInfo.flavor !== 'PARTIAL' || isProcessing}
                                onClick={() => handleServeItem(scannedOrder.id, it.id, rem)}
                                className={`h-10 px-4 font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all active:scale-95 ${
                                  (statusInfo.flavor === 'READY' || statusInfo.flavor === 'PARTIAL') && !isProcessing
                                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-900/10' 
                                    : 'bg-slate-50 text-slate-300 pointer-events-none border border-slate-100'
                                }`}
                              >
                                {isProcessing ? '..' : 'Serve'}
                              </button>
                            ) : (
                              <div className="w-8 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-green-500 opacity-60">
                                <CheckCircle className="w-5 h-5" />
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {filteredItems.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-300 italic">
                    <Search className="w-10 h-10 mb-2 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No matching items found</p>
                 </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
             <div className="w-32 h-32 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center mb-6 relative group transition-all duration-500 hover:border-green-500">
                <Zap className="w-10 h-10 text-slate-100 group-hover:text-green-500 transition-colors" />
             </div>
             <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1 uppercase">Terminal Entry Point</h3>
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Scalable to 1,000+ Operational SKUs</p>
          </div>
        )}
      </div>

      {/* 3. SIMPLIFIED QUEUE STRIP (THIN PINNED FOOTER) */}
      <div className="h-20 bg-white px-6 flex items-center shrink-0 border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
         <div className="mr-8 flex items-center border-r border-slate-100 pr-8 h-10">
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-4">Staged</span>
            <span className="text-2xl font-bold text-slate-900 font-mono tracking-tighter">{nextInQueueIds.length}</span>
         </div>

         <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar items-center py-2">
            {nextInQueueIds.map((id) => (
                <button
                   key={id}
                   onClick={() => setScanQueue(prev => [id, ...prev.filter(qId => qId !== id)])}
                   className="px-4 h-10 rounded-lg font-mono text-xs font-bold transition-all shrink-0 flex items-center gap-3 border border-slate-200 text-slate-500 bg-white hover:border-slate-400 active:scale-95"
                >
                   <span>#{id.slice(-6).toUpperCase()}</span>
                </button>
            ))}
            {nextInQueueIds.length === 0 && (
               <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300 italic">No incoming scan backlog</div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
