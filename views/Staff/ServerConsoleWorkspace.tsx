import React, { useMemo, useState } from 'react';
import { 
  Camera, Check, CheckCircle, X, ChevronRight, Search, 
  CookingPot, PackageCheck, Zap, ShieldCheck, RefreshCcw, ShieldAlert 
} from 'lucide-react';
import { Order, CartItem } from '../../types';
import SmoothImage from '../../components/SmoothImage';

interface ServerConsoleWorkspaceProps {
  activeOrders: Order[];
  scanQueue: string[]; // Order IDs
  setScanQueue?: (fn: (prev: string[]) => string[]) => void;
  isCameraOpen: boolean;
  setIsCameraOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleQRScan: (data: string) => void;
  handleServeItem: (orderId: string, itemId: string, qty: number) => void;
  handleServeAll: (orderId: string) => void;
  handleForceReady: (orderId: string) => void;
  handleAbandonItem: (orderId: string, itemId: string) => void;
  isProcessing: boolean;
}

/** 
 * Sonic Display Logic 
 * Determines if an item can be served, and its visual 'flavor' 
 */
const getItemMetadata = (item: CartItem) => {
  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
  const s = item.status;
  
  if (rem <= 0) return { text: 'Done', flavor: 'SERVED' };
  if (s === 'READY' || s === 'COLLECTING' || item.orderType === 'FAST_ITEM') return { text: 'Ready', flavor: 'READY' };
  if (s === 'MISSED' || s === 'MISSED_PREVIOUS') return { text: 'Missed', flavor: 'STALE' };
  if (s === 'ABANDONED') return { text: 'Void', flavor: 'SERVED' };
  return { text: 'Prep', flavor: 'WAITING' };
};

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  activeOrders,
  scanQueue,
  setScanQueue,
  setIsCameraOpen,
  handleServeItem,
  handleServeAll,
  handleForceReady,
  handleAbandonItem,
  isProcessing,
}) => {
  const [filter, setFilter] = useState('');

  // 🛡️ [Principal Architect] Flattened Operational Manifest
  // We extract every item from every scanned order into a linear "Sonic Stack"
  const flattenedQueue = useMemo(() => {
    const items: (CartItem & { parentOrderId: string })[] = [];
    scanQueue.forEach(orderId => {
       const order = activeOrders.find(o => o.id === orderId);
       if (order) {
          order.items.forEach(it => {
             // [ARCHITECT-FIX] Strictly exclude Lunch items from manual manifest – they are auto-delivered on scan.
             if (it.category === 'Lunch') return;

             // [ARCHITECT-FIX] If item is already served, remove from the live manifest immediately
             const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
             if (rem <= 0 || it.status === 'SERVED' || it.status === 'COMPLETED') return;
             
             if (filter && !it.name.toLowerCase().includes(filter.toLowerCase())) return;
             items.push({ ...it, parentOrderId: order.id });
          });
       }
    });
    // Sort items so Ready/Stale are at the top, Served at the bottom
    return items.sort((a, b) => {
       const aMeta = getItemMetadata(a);
       const bMeta = getItemMetadata(b);
       const score = (f: string) => (f === 'READY' ? 0 : f === 'STALE' ? 1 : f === 'WAITING' ? 2 : 3);
       return score(aMeta.flavor) - score(bMeta.flavor);
    });
  }, [scanQueue, activeOrders, filter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/30 relative overflow-hidden font-sans">
       
       {/* 🧩 MANIFEST CONTROL BAR */}
       <div className="px-8 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white shadow-sm z-20">
          <div className="flex items-center gap-8">
             <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Operational Manifest</span>
                <div className="flex items-center gap-2.5">
                   <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" />
                   <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase italic">{flattenedQueue.length} Active Food Items</h2>
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Find product..." 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-100 px-12 py-2.5 rounded-2xl text-xs font-black focus:outline-none focus:ring-4 focus:ring-slate-400/5 transition-all w-48 focus:w-64"
                />
             </div>
             
             {/* CLEAR STACK OPTION */}
             <button 
               onClick={() => setScanQueue?.(() => [])}
               className="h-11 px-6 rounded-2xl border-2 border-slate-900 text-slate-900 font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all active:scale-95"
             >
                Reset Intake
             </button>

             <button 
               onClick={() => setIsCameraOpen(true)}
               className="h-11 px-8 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] active:scale-90 transition-all shadow-2xl shadow-slate-900/20 flex items-center gap-3"
             >
               <Camera className="w-5 h-5" /> Start Scan
             </button>
          </div>
       </div>

       {/* 🗂️ THE SONIC STACK (Item Feed) */}
       <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/10">
          {flattenedQueue.length > 0 ? (
            <div className="max-w-7xl mx-auto space-y-3">
               {flattenedQueue.map((item) => (
                  <IntakeItemCard 
                    key={`${item.parentOrderId}-${item.id}`}
                    item={item}
                    isProcessing={isProcessing}
                    onServe={() => handleServeItem(item.parentOrderId, item.id, item.remainingQty ?? (item.quantity - (item.servedQty || 0)))}
                    onReject={() => {
                       handleAbandonItem(item.parentOrderId, item.id);
                    }}
                    onOverride={() => handleForceReady(item.parentOrderId)}
                  />
               ))}
               
               {/* 🏁 END OF STACK INDICATOR */}
               <div className="py-12 flex flex-col items-center justify-center opacity-20 select-none">
                  <PackageCheck className="w-8 h-8 text-slate-400 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">End of Current Queue</p>
               </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-40 select-none">
               <div className="w-40 h-40 bg-white rounded-[4rem] shadow-2xl flex items-center justify-center border-8 border-slate-50 mb-10 group relative overflow-hidden transition-all duration-700 hover:rotate-12 hover:scale-110">
                  <Zap className="w-16 h-16 text-slate-100 group-hover:text-amber-500 transition-colors duration-500 z-10" />
                  <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity" />
               </div>
               <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic mb-4">Intake Waiting</h3>
               <p className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] text-center max-w-[300px] leading-relaxed">Scan QR codes to stack your manifest</p>
            </div>
          )}
       </div>
    </div>
  );
};

/** 🏷️ INTAKE ITEM CARD (Production Grade) */
const IntakeItemCard: React.FC<{
  item: CartItem & { parentOrderId: string };
  isProcessing: boolean;
  onServe: () => void;
  onReject: () => void;
  onOverride: () => void;
}> = ({ item, isProcessing, onServe, onReject, onOverride }) => {
  const meta = getItemMetadata(item);
  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
  
  return (
    <div className={`group flex items-center p-5 bg-white rounded-[2.5rem] border-2 transition-all hover:scale-[1.01] hover:shadow-2xl ${
       meta.flavor === 'READY' ? 'border-green-200 shadow-xl shadow-green-900/5' :
       meta.flavor === 'STALE' ? 'border-amber-400 bg-amber-50/30' : 
       meta.flavor === 'SERVED' ? 'opacity-40 border-slate-100 bg-slate-50/50' : 'border-slate-100 shadow-sm'
    }`}>
       
       {/* 1. PRODUCT VISUAL */}
       <div className="w-20 h-20 rounded-[2rem] overflow-hidden bg-slate-100 border-4 border-white shadow-xl flex-shrink-0 relative group-hover:rotate-3 transition-transform">
          <SmoothImage 
            src={item.imageUrl} 
            alt={item.name} 
            className="w-full h-full object-cover" 
            containerClassName="w-20 h-20"
            quality={100} 
          />
          {meta.flavor === 'READY' && (
             <div className="absolute inset-0 bg-green-500/10 border-4 border-green-500 rounded-[2rem] animate-pulse" />
          )}
          {meta.flavor === 'STALE' && (
             <div className="absolute inset-0 bg-amber-500/10 border-4 border-amber-500 rounded-[2rem]" />
          )}
       </div>

       {/* 2. PRODUCT INTEL */}
       <div className="flex-1 ml-6 min-w-0">
          <div className="flex items-center gap-3 mb-1">
             <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">{item.name}</h3>
             <span className="text-[10px] font-mono text-slate-300 font-bold uppercase tracking-widest">#{item.parentOrderId.slice(-6).toUpperCase()}</span>
          </div>
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
             meta.flavor === 'READY' ? 'text-green-600' :
             meta.flavor === 'STALE' ? 'text-amber-700' : 'text-slate-400'
          }`}>
             {item.category || 'Special Order'} • {meta.text} • {rem > 0 ? `${rem}x Pending` : 'Fulfilled'}
          </p>
       </div>

        {/* 3. SONIC ACTIONS */}
        <div className="flex items-center gap-4 ml-6">
           {meta.flavor === 'WAITING' && (
              <div className="flex items-center gap-2">
                 <button 
                   onClick={onOverride}
                   title="Force READY"
                   className="w-11 h-11 rounded-2xl bg-amber-50 border-2 border-amber-200 text-amber-600 flex items-center justify-center hover:bg-amber-100 transition-all active:scale-90"
                 >
                    <Zap className="w-5 h-5" />
                 </button>
                 <button 
                   onClick={onServe}
                   title="FORCE SERVE"
                   className="w-11 h-11 rounded-2xl bg-red-50 border-2 border-red-200 text-red-600 flex items-center justify-center hover:bg-red-100 transition-all active:scale-90"
                 >
                    <ShieldAlert className="w-5 h-5" />
                 </button>
              </div>
           )}

          {meta.flavor !== 'SERVED' ? (
             <div className="flex items-center gap-3">
                <button 
                   onClick={onReject}
                   className="h-11 px-5 border-2 border-slate-100 text-slate-300 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:border-slate-300 hover:text-slate-900 transition-all"
                >
                   Release
                </button>
                <button 
                   disabled={meta.flavor === 'WAITING' || isProcessing}
                   onClick={onServe}
                   className={`h-11 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-2xl ${
                      (meta.flavor === 'READY' || meta.flavor === 'STALE') && !isProcessing
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
                      : 'bg-slate-50 text-slate-300 pointer-events-none'
                   }`}
                >
                   {isProcessing ? '..' : 'SERVE FOOD'}
                </button>
             </div>
          ) : (
             <div className="w-11 h-11 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center text-green-500">
                <CheckCircle className="w-6 h-6" />
             </div>
          )}
       </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
