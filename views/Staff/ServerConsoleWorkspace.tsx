import React, { useMemo, useEffect, useState } from 'react';
import { Camera, Check, CheckCircle, X, ChevronRight, Utensils, Clock, Zap, AlertTriangle, Search, CookingPot, PackageCheck } from 'lucide-react';
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

  // --- PARTITIONED LOGIC ---
  const { readyItems, pendingItems, servedItems } = useMemo(() => {
    if (!scannedOrder) return { readyItems: [], pendingItems: [], servedItems: [] };
    
    let items = [...scannedOrder.items];
    if (filter) {
      items = items.filter(it => it.name.toLowerCase().includes(filter.toLowerCase()));
    }

    const ready: CartItem[] = [];
    const pending: CartItem[] = [];
    const served: CartItem[] = [];

    items.forEach(it => {
      const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
      const flavor = getStatusDisplay(it).flavor;
      if (rem <= 0 || flavor === 'DONE') served.push(it);
      else if (flavor === 'READY' || flavor === 'PARTIAL') ready.push(it);
      else pending.push(it);
    });

    return { readyItems: ready, pendingItems: pending, servedItems: served };
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
    <div className="flex-1 flex flex-col h-full bg-slate-100/50 relative overflow-hidden">
      {/* 1. SLIM STATUS HEADER */}
      <div className="px-6 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white z-10 shadow-sm">
        <div className="flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Kitchen Operational Pulse</span>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                 <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Active Partition Tracking Syncing</p>
              </div>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           {scannedOrder && (
             <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Fast-find in manifest..." 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 px-9 py-1.5 rounded-lg text-xs font-bold focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all w-48 focus:w-60"
                />
             </div>
           )}
           <button 
             onClick={() => setIsCameraOpen(true)}
             className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-[9px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 shadow-lg"
           >
             <Camera className="w-4 h-4" /> Manual Intake
           </button>
        </div>
      </div>

      {/* 2. MAIN ACTIVE WORKSPACE (PARTITIONED) */}
      <div className="flex-1 flex flex-col p-4 relative overflow-hidden">
        {scannedOrder ? (
          <div className={`w-full max-w-7xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 max-h-full transition-all duration-300 overflow-hidden ${
            highlightFlash ? 'ring-2 ring-green-200 border-green-500' : 'border-slate-200'
          }`}>
            
            {/* Slim Profile Strip */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
               <div className="flex items-center gap-6">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter font-mono italic">#{scannedOrder.id.slice(-6).toUpperCase()}</h2>
                  <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">{scannedOrder.userName}</span>
               </div>
               
               <div className="flex items-center gap-3">
                  <button 
                    disabled={isProcessing || readyItems.length === 0}
                    onClick={() => handleServeAll(scannedOrder.id)}
                    className={`h-11 px-6 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isProcessing || readyItems.length === 0 ? 'bg-slate-100 text-slate-300' : 'bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-900/10'
                    }`}
                  >
                     Serve {readyItems.length} Ready Items <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setScanQueue(prev => prev.filter(id => id !== scannedOrder.id))} 
                    className="h-11 w-11 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-900 hover:bg-slate-50 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
               </div>
            </div>

            {/* SCROLLABLE PARTITIONED GRID */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/20 space-y-8">
              
              {/* SECTION: READY TO DISPENSE ✅ */}
              {readyItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <PackageCheck className="w-4 h-4 text-green-600" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-600">Dispense Ready Manifest</h4>
                    <div className="flex-1 h-px bg-green-100" />
                    <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-[9px]">{readyItems.length} Products</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {readyItems.map(it => (
                       <ItemCard key={it.id} item={it} onServe={handleServeItem} onOverride={handleForceReady} orderId={scannedOrder.id} isProcessing={isProcessing} />
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: KITCHEN INTAKE / PENDING 🟠 */}
              {pendingItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <CookingPot className="w-4 h-4 text-amber-500" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Staged in Kitchen</h4>
                    <div className="flex-1 h-px bg-amber-100" />
                    <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-[9px]">{pendingItems.length} Products</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {pendingItems.map(it => (
                       <ItemCard key={it.id} item={it} onServe={handleServeItem} onOverride={handleForceReady} orderId={scannedOrder.id} isProcessing={isProcessing} />
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION: RECENTLY SERVED 🏁 */}
              {servedItems.length > 0 && (
                <div className="space-y-4 opacity-50 grayscale transition-opacity hover:opacity-100">
                  <div className="flex items-center gap-3 px-2">
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Successfully Handed Over</h4>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                    {servedItems.map(it => (
                       <ItemCard key={it.id} item={it} onServe={handleServeItem} onOverride={handleForceReady} orderId={scannedOrder.id} isProcessing={isProcessing} />
                    ))}
                  </div>
                </div>
              )}

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
             <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-1 uppercase">Terminal Ready</h3>
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Awaiting intake partition scan</p>
          </div>
        )}
      </div>

      {/* 3. SIMPLIFIED QUEUE TAPE (FOOTER PIN) */}
      <div className="h-16 bg-white px-6 flex items-center shrink-0 border-t border-slate-200 relative z-20">
         <div className="mr-6 flex items-baseline border-r border-slate-100 pr-6">
            <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mr-3">Backlog</span>
            <span className="text-xl font-black text-slate-900 font-mono tracking-tighter leading-none">{nextInQueueIds.length}</span>
         </div>
         <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar items-center py-1">
            {nextInQueueIds.map((id) => (
                <button
                   key={id}
                   onClick={() => setScanQueue(prev => [id, ...prev.filter(qId => qId !== id)])}
                   className="px-4 h-9 rounded-lg font-mono text-[10px] font-bold transition-all shrink-0 flex items-center gap-3 border border-slate-100 text-slate-400 bg-slate-50 hover:bg-white hover:border-slate-300 active:scale-95"
                >
                   #{id.slice(-6).toUpperCase()}
                </button>
            ))}
         </div>
      </div>
    </div>
  );
};

// --- COMPACT REUSABLE ITEM CARD ---
const ItemCard: React.FC<{
  item: CartItem;
  orderId: string;
  isProcessing: boolean;
  onServe: (o: string, i: string, q: number) => void;
  onOverride: (o: string) => void;
}> = ({ item, orderId, isProcessing, onServe, onOverride }) => {
  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
  const statusInfo = getStatusDisplay(item);
  
  return (
    <div className={`flex items-center p-3 rounded-xl border bg-white transition-all group ${
       statusInfo.flavor === 'DONE' ? 'opacity-40 border-slate-100' :
       statusInfo.flavor === 'READY' ? 'border-green-200 shadow-sm ring-1 ring-green-50' :
       statusInfo.flavor === 'PARTIAL' ? 'border-amber-200' : 'border-slate-200'
    }`}>
      {/* Visual Image Feedback */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shrink-0 relative">
         <img 
           src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'} 
           alt={item.name}
           className="w-full h-full object-cover"
           loading="lazy"
         />
         {statusInfo.flavor === 'READY' && (
            <div className="absolute inset-0 bg-green-500/10 border border-green-500 rounded-lg animate-pulse" />
         )}
      </div>

      <div className="flex-1 ml-3 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate tracking-tight">{item.name}</h3>
          <p className={`text-[8px] uppercase font-bold tracking-widest ${statusInfo.flavor === 'READY' ? 'text-green-600' : 'text-slate-400'}`}>
            {statusInfo.text} • {item.category}
          </p>
       </div>
      
      <div className="flex items-center gap-3 ml-2">
         <div className="text-right">
             <div className="flex items-baseline leading-none">
                <span className={`text-xl font-bold font-mono tracking-tighter ${rem > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{rem}</span>
                <span className="text-[7px] font-bold text-slate-300 uppercase ml-0.5">X</span>
             </div>
         </div>

         <div className="flex items-center gap-1">
            {statusInfo.flavor === 'WAITING' && (
               <button
                 onClick={() => onOverride(orderId)}
                 className="w-8 h-9 flex items-center justify-center bg-amber-50 border border-amber-200 text-amber-600 rounded-lg hover:bg-amber-100 transition-all active:scale-95"
                 title="Kitchen Override"
               >
                  <Zap className="w-3.5 h-3.5" />
               </button>
            )}

            {statusInfo.flavor !== 'DONE' ? (
              <button 
                disabled={statusInfo.flavor !== 'READY' && statusInfo.flavor !== 'PARTIAL' || isProcessing}
                onClick={() => onServe(orderId, item.id, rem)}
                className={`h-9 px-4 font-bold text-[9px] uppercase tracking-widest rounded-lg transition-all active:scale-95 ${
                  (statusInfo.flavor === 'READY' || statusInfo.flavor === 'PARTIAL') && !isProcessing
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                    : 'bg-slate-50 text-slate-300 pointer-events-none border border-slate-100'
                }`}
              >
                {isProcessing ? '..' : 'SERVE'}
              </button>
            ) : (
              <div className="w-8 h-9 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center text-green-500">
                <Check className="w-4 h-4" />
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
