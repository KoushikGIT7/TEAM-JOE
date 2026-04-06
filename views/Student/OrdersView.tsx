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
    const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const formattedTime = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const getStatusColor = () => {
      if (uiState === 'QR_ACTIVE') return 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse';
      if (uiState === 'SCANNED' || uiState === 'COMPLETED' || order.orderStatus === 'SERVED') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      if (uiState === 'REJECTED' || uiState === 'CANCELLED') return 'bg-rose-50 text-rose-600 border-rose-100';
      return 'bg-amber-50 text-amber-600 border-amber-100';
    };

    return (
      <div 
        className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm transition-all active:scale-[0.98] cursor-pointer hover:shadow-md mb-4"
        onClick={() => canShowQR && onQROpen?.(order.id)}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
              <Receipt className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 tracking-tight">Order #{order.id.slice(-6).toUpperCase()}</h4>
              <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-tighter">
                {formattedDate} • {formattedTime}
              </p>
            </div>
          </div>
          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${getStatusColor()}`}>
            {statusMsg}
          </div>
        </div>

        {/* Dynamic Items List */}
        <div className="space-y-2 mb-6 ml-1">
          {(order.items || []).map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-600">{item.quantity}x {item.name}</span>
              <span className="font-black text-slate-300 text-[10px]">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-dashed border-slate-100">
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Paid Amount</span>
             <span className="text-lg font-black italic text-slate-900">₹{order.totalAmount || 0}</span>
          </div>
          {canShowQR ? (
            <button 
              onClick={(e) => { e.stopPropagation(); onQROpen?.(order.id); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-90 transition-all"
            >
              <QrCode className="w-4 h-4" /> View Token
            </button>
          ) : (
            <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
              Success <CheckCircle2 className="w-3" />
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
