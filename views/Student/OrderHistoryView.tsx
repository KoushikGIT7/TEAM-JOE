import React from 'react';
import { ChevronLeft, Receipt, Calendar, CheckCircle2, Clock, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { Order } from '../../types';
import FoodLoader from '../../components/Common/FoodLoader';

interface OrderHistoryViewProps {
  orders: Order[];
  loading: boolean;
  onBack: () => void;
  onViewQR: (orderId: string) => void;
}

const OrderHistoryView: React.FC<OrderHistoryViewProps> = ({ orders, loading, onBack, onViewQR }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SERVED':
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'PENDING':
      case 'QUEUED':
      case 'PREPARING': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'READY': return 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse';
      case 'CANCELLED':
      case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-100';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return 'Unknown Date';
    const date = new Date(ts);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white"><FoodLoader /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 max-w-md mx-auto relative overflow-x-hidden flex flex-col font-sans border-x border-slate-100 shadow-2xl">
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-50 p-6 border-b border-slate-100 flex items-center gap-4">
        <button onClick={onBack} className="w-11 h-11 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-all">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-xl font-black text-slate-800 tracking-tighter">Order History</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-10">
            <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-6">
              <ShoppingBag className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">No Orders Yet</h3>
            <p className="text-sm font-bold text-slate-400">Order from the menu to see your history here.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div 
              key={order.id} 
              onClick={() => (order.orderStatus !== 'SERVED' && order.orderStatus !== 'COMPLETED') && onViewQR(order.id)}
              className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm transition-all active:scale-[0.98] cursor-pointer hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Order #{order.id.slice(-6).toUpperCase()}</h4>
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" /> {formatDate(order.createdAt)}
                    </p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(order.orderStatus)}`}>
                  {order.orderStatus.replace('_', ' ')}
                </div>
              </div>

              <div className="space-y-2 mb-6 ml-1 flex flex-col">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-600 line-clamp-1">{item.quantity}x {item.name}</span>
                    <span className="font-black text-slate-400 text-[10px]">₹{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-dashed border-slate-100">
                <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">Total Paid</span>
                   <span className="text-lg font-black italic text-slate-900">₹{order.totalAmount || 0}</span>
                </div>
                {(order.orderStatus !== 'SERVED' && order.orderStatus !== 'COMPLETED') ? (
                  <button className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                    View Token <ArrowRight className="w-3" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-widest">
                    Collected <CheckCircle2 className="w-3" />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OrderHistoryView;
