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
      if (uiState === 'QR_ACTIVE') return 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse';
      if (uiState === 'SCANNED' || uiState === 'COMPLETED' || order.orderStatus === 'SERVED') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      if (uiState === 'REJECTED' || uiState === 'CANCELLED') return 'bg-rose-50 text-rose-600 border-rose-100';
      return 'bg-amber-50 text-amber-600 border-amber-100';
    };

    const getItemBadge = (status: string) => {
      switch (status) {
        case 'SERVED': return <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter flex items-center gap-0.5"><CheckCircle2 className="w-2" /> SERVED</span>;
        case 'READY': return <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter animate-pulse">READY</span>;
        case 'PREPARING': return <span className="text-[8px] font-black text-orange-400 uppercase tracking-tighter">COOKING</span>;
        default: return <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">QUEUED</span>;
      }
    };

    return (
      <div 
        className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm transition-all active:scale-[0.98] cursor-pointer hover:shadow-md mb-6"
        onClick={() => canShowQR && onQROpen?.(order.id)}
      >
        <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
              <Receipt className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5 italic">Order Verified</p>
              <h4 className="text-base font-black text-slate-800 tracking-tighter leading-none">#{order.id.slice(-8).toUpperCase()}</h4>
            </div>
          </div>
          <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${getStatusColor()}`}>
            {statusMsg}
          </div>
        </div>

        {/* Dynamic Items List */}
        <div className="space-y-3 mb-6">
          {(order.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between items-start">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-700 leading-none">{item.quantity}x {item.name}</span>
                <div className="mt-1">{getItemBadge(item.status)}</div>
              </div>
              <span className="font-black text-slate-400 text-[10px]">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-5 border-t border-dashed border-slate-200">
          <div className="flex flex-col">
             <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider">Total Amount</span>
             <span className="text-xl font-black italic text-slate-900 leading-none mt-1">₹{order.totalAmount || 0}</span>
             <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
               {formattedDate} • {formattedTime}
             </p>
          </div>
          {canShowQR ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onQROpen?.(order.id); }}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-[1.2rem] font-black text-[10px] uppercase tracking-widest active:scale-90 transition-all shadow-lg shadow-primary/20"
            >
              <QrCode className="w-4 h-4" /> View Token
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1">
               <div className="px-3 py-1 bg-emerald-50 text-emerald-500 rounded-lg font-black text-[8px] uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
                 Verified <CheckCircle2 className="w-2.5" />
               </div>
               {order.paymentType && (
                 <span className="text-[8px] font-black text-slate-300 uppercase">{order.paymentType} Payment</span>
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
