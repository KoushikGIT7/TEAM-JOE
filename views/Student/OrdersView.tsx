import React, { useEffect, useState } from 'react';
import { ArrowLeft, QrCode, CheckCircle2, Clock, AlertCircle, ShoppingBag, Receipt, ArrowRight } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToAllUserOrders } from '../../services/firestore-db';
import { getOrderStatusMessage, getOrderUIState, shouldShowQR, groupOrdersByStatus } from '../../utils/orderLifecycle';
import FoodLoader from '../../components/Common/FoodLoader';

interface OrdersViewProps {
  profile: UserProfile | null;
  onBack: () => void;
  onQROpen?: (orderId: string) => void;
}

const OrdersView: React.FC<OrdersViewProps> = ({ profile, onBack, onQROpen }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = listenToAllUserOrders(profile.uid, (data) => {
      const sorted = [...data].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(sorted);
      setLoading(false);
    });
    return unsub;
  }, [profile?.uid]);

  const { active, scanned, completed } = groupOrdersByStatus(orders);

  const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
    const uiState = getOrderUIState(order);
    const canShowQR = shouldShowQR(order);
    const statusMsg = getOrderStatusMessage(order);
    const dateObj = new Date(order.createdAt);
    const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const getStatusColor = () => {
      if (uiState === 'QR_ACTIVE') return 'bg-indigo-500 text-white border-transparent';
      if (uiState === 'SCANNED' || uiState === 'COMPLETED' || order.orderStatus === 'SERVED') return 'bg-emerald-500 text-white border-transparent';
      if (uiState === 'REJECTED' || uiState === 'CANCELLED') return 'bg-rose-500 text-white border-transparent';
      return 'bg-amber-500 text-white border-transparent';
    };

    const getItemBadge = (status: string) => {
      switch (status) {
        case 'SERVED': return <div className="px-3 py-1 bg-emerald-50 text-[7px] font-black uppercase text-emerald-500 rounded-lg flex items-center gap-1 border border-emerald-100">SERVED <CheckCircle2 className="w-2" /></div>;
        case 'READY': return <div className="px-3 py-1 bg-blue-50 text-[7px] font-black uppercase text-blue-500 rounded-lg animate-pulse border border-blue-100">READY</div>;
        case 'PREPARING': return <div className="px-3 py-1 bg-orange-50 text-[7px] font-black uppercase text-orange-500 rounded-lg border border-orange-100">COOKING</div>;
        default: return <div className="px-3 py-1 bg-slate-50 text-[7px] font-black uppercase text-slate-300 rounded-lg border border-slate-100 italic">QUEUED</div>;
      }
    };

    return (
      <div 
        className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm transition-all active:scale-[0.98] cursor-pointer hover:shadow-xl hover:shadow-slate-100 mb-8"
        onClick={() => canShowQR && onQROpen?.(order.id)}
      >
        {/* Header Area */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-50 rounded-[1.25rem] flex items-center justify-center border border-slate-100 shadow-inner">
              <Receipt className="w-7 h-7 text-slate-400" />
            </div>
            <div className="flex flex-col">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1 italic">Order Identifier</p>
              <h4 className="text-xl font-black text-slate-900 tracking-tighter leading-none italic">#{order.id.slice(-8).toUpperCase()}</h4>
            </div>
          </div>
          <div className={`px-5 py-2.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] shadow-lg shadow-current/10 border-2 border-white/20 transition-all ${getStatusColor()}`}>
            {statusMsg}
          </div>
        </div>

        {/* Items Manifest */}
        <div className="space-y-4 mb-8 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
          {(order.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-white/40 p-1 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-slate-800 leading-tight">
                  <span className="text-primary mr-1.5">{item.quantity}x</span> {item.name}
                </span>
                <div className="mt-2">{getItemBadge(item.status)}</div>
              </div>
              <div className="flex flex-col items-end">
                 <span className="font-black text-slate-900 text-xs tracking-tighter">₹{item.price * item.quantity}</span>
                 <span className="text-[8px] font-bold text-slate-300 uppercase mt-1">INC TAX</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-dashed border-slate-200">
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest mb-1 opacity-60">Order Total</span>
             <span className="text-3xl font-black italic text-slate-900 tracking-tighter leading-none">₹{order.totalAmount || 0}</span>
             <p className="text-[8px] font-black text-slate-400 mt-4 uppercase tracking-[0.2em] bg-slate-100 px-3 py-1 rounded-full w-fit">
               {formattedDate} • {formattedTime}
             </p>
          </div>
          {canShowQR ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onQROpen?.(order.id); }}
              className="group flex flex-col items-center gap-2 p-1 active:scale-95 transition-all"
            >
              <div className="w-16 h-16 bg-primary rounded-[1.5rem] flex items-center justify-center text-white shadow-huge shadow-primary/30 group-hover:scale-105 transition-transform">
                 <QrCode className="w-8 h-8" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest text-primary">View Token</span>
            </button>
          ) : (
            <div className="flex flex-col items-end gap-2">
               <div className="px-5 py-2 bg-emerald-500 text-white rounded-full font-black text-[8px] uppercase tracking-widest shadow-xl shadow-emerald-500/10 flex items-center gap-2">
                 Verified <CheckCircle2 className="w-3" />
               </div>
               {order.paymentType && (
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 opacity-50 italic">{order.paymentType} PAYMENT</span>
               )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white"><FoodLoader /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 max-w-md mx-auto relative overflow-x-hidden flex flex-col font-sans border-x border-slate-100 shadow-2xl">
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-50 p-6 border-b border-slate-100 flex items-center gap-4">
        <button onClick={onBack} className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-all">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-xl font-black text-slate-800 tracking-tighter">Receipts & Orders</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-center mb-6 shadow-sm">
              <ShoppingBag className="w-10 h-10 text-slate-200" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2 tracking-tighter">Kitchen is quiet...</h3>
            <p className="text-sm font-bold text-slate-400 max-w-[180px] mx-auto leading-relaxed">No orders found. Head to the menu to start your hunger journey.</p>
          </div>
        ) : (
          <div className="space-y-2">
             {active.length > 0 && (
               <div className="mb-8">
                 <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 ml-2">Active Tracker ({active.length})</h2>
                 {active.map(o => <OrderCard key={o.id} order={o} />)}
               </div>
             )}
             
             {scanned.length > 0 && (
               <div className="mb-8">
                 <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 ml-2">Currently Scanning ({scanned.length})</h2>
                 {scanned.map(o => <OrderCard key={o.id} order={o} />)}
               </div>
             )}

             {completed.length > 0 && (
               <div>
                 <h2 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 ml-2">History ({completed.length})</h2>
                 {completed.map(o => <OrderCard key={o.id} order={o} />)}
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersView;
