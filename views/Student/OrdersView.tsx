import React, { useEffect, useState } from 'react';
import { ArrowLeft, QrCode, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToAllUserOrders } from '../../services/firestore-db';
import { getOrderStatusMessage, getOrderUIState, shouldShowQR, groupOrdersByStatus } from '../../utils/orderLifecycle';

interface OrdersViewProps {
  profile: UserProfile | null;
  onBack: () => void;
  onQROpen?: (orderId: string) => void;
}

const OrdersView: React.FC<OrdersViewProps> = ({ profile, onBack, onQROpen }) => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = listenToAllUserOrders(profile.uid, (data) => {
      // Real-time updates trigger instantly via Firestore listener
      const sorted = [...data].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setOrders(sorted);
    });
    return unsub;
  }, [profile?.uid]);

  const { active, scanned, completed } = groupOrdersByStatus(orders);

  const OrderCard: React.FC<{ order: Order }> = ({ order }) => {
    const uiState = getOrderUIState(order);
    const canShowQR = shouldShowQR(order);
    const statusMsg = getOrderStatusMessage(order);
    const createdTime = new Date(order.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const scannedTime = order.scannedAt ? new Date(order.scannedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;

    let statusIcon = <Clock className="w-4 h-4" />;
    let statusColor = 'text-primary';

    if (uiState === 'SCANNED' || uiState === 'COMPLETED') {
      statusIcon = <CheckCircle2 className="w-4 h-4" />;
      statusColor = 'text-success';
    } else if (uiState === 'REJECTED' || uiState === 'CANCELLED') {
      statusIcon = <AlertCircle className="w-4 h-4" />;
      statusColor = 'text-error';
    }

    return (
      <div 
        className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
        onClick={() => {
          if (canShowQR && onQROpen) {
            onQROpen(order.id);
          }
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-black text-textSecondary uppercase tracking-widest">Order</p>
            <p className="text-lg font-black text-textMain">#{order.id.slice(-8).toUpperCase()}</p>
          </div>
          <div className={`flex items-center gap-1 ${statusColor} text-xs font-black`}>
            {statusIcon}
            <span>{statusMsg}</span>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1 text-sm text-textSecondary mb-3">
          {order.items.map(it => (
            <div key={it.id} className="flex justify-between">
              <span>{it.name}</span>
              <span className="font-black text-textMain">x{it.quantity}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-3 flex justify-between items-center text-xs font-black text-textSecondary border-t border-black/5 pt-3">
          <div className="flex flex-col">
            <span>Created: {createdTime}</span>
            {scannedTime && <span>Scanned: {scannedTime}</span>}
          </div>
          <span className="text-textMain">₹{order.totalAmount}</span>
        </div>

        {/* QR Action */}
        {canShowQR && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onQROpen?.(order.id);
            }}
            className="w-full mt-3 bg-primary/10 text-primary font-black py-2 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <QrCode className="w-4 h-4" />
            Show QR
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-10 max-w-md mx-auto">
      <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-black/5 p-4 flex items-center gap-3 z-10">
        <button onClick={onBack} className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center border border-black/5 active:scale-95 transition-all">
          <ArrowLeft className="w-5 h-5 text-textSecondary" />
        </button>
        <h1 className="text-xl font-black text-textMain">My Orders</h1>
        {orders.length > 0 && <span className="ml-auto text-xs font-black text-textSecondary bg-gray-100 px-3 py-1 rounded-full">{orders.length}</span>}
      </div>

      {orders.length === 0 ? (
        <div className="p-10 text-center">
          <Clock className="w-12 h-12 text-textSecondary/30 mx-auto mb-4" />
          <p className="text-textSecondary font-bold">No orders found</p>
          <p className="text-xs text-textSecondary/60 mt-2">Your orders will appear here</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Active Orders */}
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-3 px-2">Active Orders ({active.length})</h2>
              <div className="space-y-3">
                {active.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          )}

          {/* Scanned Orders */}
          {scanned.length > 0 && (
            <div>
              <h2 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-3 px-2 mt-6">Scanned ({scanned.length})</h2>
              <div className="space-y-3">
                {scanned.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          )}

          {/* Completed Orders */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-3 px-2 mt-6">Completed ({completed.length})</h2>
              <div className="space-y-3">
                {completed.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrdersView;
