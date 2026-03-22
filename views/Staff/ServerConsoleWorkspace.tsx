import React, { useMemo, useState, useEffect } from 'react';
import { 
  Camera, Check, CheckCircle, Search, 
  PackageCheck, Zap, ShieldCheck, Clock, User 
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
  isProcessing: boolean;
}

/** 
 * [SONIC-LOGIC] Hardware Status Interpreter
 * Decodes Firestore status into rapid UI feedback tiers.
 */
const getItemMetadata = (item: CartItem) => {
  const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
  const s = item.status;
  
  if (rem <= 0 || s === 'SERVED' || s === 'COMPLETED') return { text: 'Served ✅', flavor: 'SERVED' };
  
  // 🛡️ [Principal Architect] Servability Gate
  // If Kitchen has marked it READY, or if it's a zero-wait Static item, it's READY.
  const isReady = s === 'READY' || s === 'COLLECTING' || s === 'READY_SERVED' || item.orderType === 'FAST_ITEM';
  
  if (isReady) return { text: 'Serve Now', flavor: 'READY' };
  return { text: 'Cooking...', flavor: 'WAITING' };
};

const ServerConsoleWorkspace: React.FC<ServerConsoleWorkspaceProps> = ({
  activeOrders,
  scanQueue,
  setScanQueue,
  setIsCameraOpen,
  handleServeItem,
}) => {
  const [filter, setFilter] = useState('');
  const [recentlyServed, setRecentlyServed] = useState<Set<string>>(new Set());
  const [fullyServedOrders, setFullyServedOrders] = useState<Set<string>>(new Set());

  // 🛡️ [Principal Architect] Order-Centric Manifest
  const groupedOrders = useMemo(() => {
     return scanQueue.map(orderId => {
        const order = activeOrders.find(o => o.id === orderId);
        if (!order) return null;

        const items = order.items.filter(it => {
            const uniqueKey = `${order.id}-${it.id}`;
            const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
            
            // Filter out auto-served lunch items unless recently served for feedback
            if (it.category === 'Lunch' && it.status === 'SERVED' && !recentlyServed.has(uniqueKey)) return false;
            
            // Hide already served items after they time out
            if (rem <= 0 && !recentlyServed.has(uniqueKey)) return false;

            if (filter && !it.name.toLowerCase().includes(filter.toLowerCase())) return false;
            return true;
        });

        if (items.length === 0 && !fullyServedOrders.has(orderId)) return null;
        return { ...order, items };
     }).filter(Boolean) as Order[];
  }, [scanQueue, activeOrders, filter, recentlyServed, fullyServedOrders]);

  const enhancedHandleServe = (orderId: string, itemId: string, qty: number) => {
    const key = `${orderId}-${itemId}`;
    
    // ⚡ [SONIC-STROKE] Instant UI Flip
    setRecentlyServed(prev => new Set(prev).add(key));
    
    // Silent background handover
    handleServeItem(orderId, itemId, qty);

    setTimeout(() => {
        setRecentlyServed(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
    }, 4000);
  };

  // Reconcile automatic cleanup
  useEffect(() => {
     groupedOrders.forEach(order => {
        const allItemsDone = order.items.every(it => {
           const rem = it.remainingQty ?? (it.quantity - (it.servedQty || 0));
           const isOptimistic = recentlyServed.has(`${order.id}-${it.id}`);
           return rem <= 0 || it.status === 'SERVED' || isOptimistic;
        });

        if (allItemsDone && order.items.length > 0 && !fullyServedOrders.has(order.id)) {
           setFullyServedOrders(prev => new Set(prev).add(order.id));
           setTimeout(() => {
              setScanQueue?.(prev => prev.filter(id => id !== order.id));
              setFullyServedOrders(prev => {
                 const next = new Set(prev);
                 next.delete(order.id);
                 return next;
              });
           }, 4000);
        }
     });
  }, [groupedOrders, recentlyServed]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden font-sans">
      <div className="px-8 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white shadow-sm z-20">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Kitchen Handover</span>
          <div className="flex items-center gap-2.5">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <h2 className="text-sm font-black text-slate-900 tracking-tight uppercase italic">{groupedOrders.length} Active Trays</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input 
              type="text" 
              placeholder="Find student tray..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-50 border border-slate-100 px-12 py-2.5 rounded-2xl text-xs font-black focus:outline-none focus:ring-4 focus:ring-slate-400/5 transition-all w-48 focus:w-64"
            />
          </div>
          <button 
            onClick={() => setIsCameraOpen(true)}
            className="h-11 px-8 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center gap-3 active:scale-95 transition-all"
          >
            <Camera className="w-5 h-5" /> Scan Intake
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10">
        {groupedOrders.length > 0 ? (
          <div className="max-w-5xl mx-auto space-y-8">
            {groupedOrders.map((order) => (
              <OrderCard 
                key={order.id}
                order={order}
                isFullyDone={fullyServedOrders.has(order.id)}
                recentlyServed={recentlyServed}
                onServeItem={enhancedHandleServe}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-40">
             <div className="w-40 h-40 bg-white rounded-[4rem] shadow-2xl flex items-center justify-center border-8 border-slate-100 mb-10 group overflow-hidden">
                <Zap className="w-16 h-16 text-slate-200 group-hover:text-amber-500 transition-all duration-500" />
             </div>
             <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic mb-4">Pipeline Clear</h3>
             <p className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] text-center max-w-[300px]">Waiting for next intake intake</p>
          </div>
        )}
      </div>
    </div>
  );
};

const OrderCard: React.FC<{
  order: Order;
  isFullyDone: boolean;
  recentlyServed: Set<string>;
  onServeItem: (orderId: string, itemId: string, qty: number) => void;
}> = ({ order, isFullyDone, recentlyServed, onServeItem }) => {
  return (
    <div className={`rounded-[3rem] border-2 transition-all duration-500 ${
      isFullyDone ? 'border-emerald-500 bg-emerald-50 shadow-2xl scale-[1.02]' : 'border-slate-100 bg-white shadow-xl'
    }`}>
      <div className="p-8 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-6">
           <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${isFullyDone ? 'bg-emerald-500' : 'bg-slate-900'} shadow-lg transition-colors`}>
              {isFullyDone ? <CheckCircle className="w-8 h-8 text-white animate-in zoom-in" /> : <User className="w-8 h-8 text-white" />}
           </div>
           <div>
              <div className="flex items-center gap-3">
                 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">Order #{order.id.slice(-6).toUpperCase()}</h2>
                 {isFullyDone && <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md">Fulfillment Finalized</span>}
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">{order.items.length} Remaining Items • Preparing Tray</p>
           </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {order.items.map(item => {
           const uniqueKey = `${order.id}-${item.id}`;
           const meta = getItemMetadata(item);
           const isPushed = recentlyServed.has(uniqueKey) || meta.flavor === 'SERVED';
           const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));

           return (
              <div key={item.id} className={`flex items-center p-4 rounded-[2.2rem] transition-all ${isPushed ? 'bg-emerald-50/50 opacity-60' : 'hover:bg-slate-50'}`}>
                 <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 border-2 border-white shadow-sm flex-shrink-0">
                    <SmoothImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                 </div>
                 <div className="flex-1 ml-5">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{item.name}</h4>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${
                       isPushed ? 'text-emerald-600' : 
                       meta.flavor === 'READY' ? 'text-amber-600' : 'text-slate-400'
                    }`}>
                       {meta.flavor === 'WAITING' ? (item.status === 'PREPARING' ? 'Kitchen Preparing' : 'Awaiting Kitchen') : (isPushed ? 'Fulfilled ✅' : 'Pick Up Ready')} • {isPushed ? '0' : rem}x
                    </p>
                 </div>

                 <div className="ml-4">
                    {isPushed ? (
                       <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <CheckCircle className="w-6 h-6" />
                       </div>
                    ) : meta.flavor === 'WAITING' ? (
                       <div className="px-5 py-3 rounded-2xl bg-rose-50 text-rose-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 italic">
                          <Clock className="w-4 h-4 text-rose-400" />
                          Wait
                       </div>
                    ) : (
                       <button 
                          onClick={() => onServeItem(order.id, item.id, rem)}
                          className="h-12 px-8 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center gap-2 hover:bg-black"
                       >
                          <Check className="w-4 h-4" /> Serve
                       </button>
                    )}
                 </div>
              </div>
           );
        })}
      </div>
    </div>
  );
};

export default ServerConsoleWorkspace;
