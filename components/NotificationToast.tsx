import React, { useEffect } from 'react';
import { X, Package, Clock } from 'lucide-react';
export interface OrderReadyPayload {
  orderId: string;
  itemNames?: string;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
}

export interface NotificationToastData {
  title?: string;
  body?: string;
  orderReady?: OrderReadyPayload;
}

interface NotificationToastProps {
  data: NotificationToastData;
  onDismiss: () => void;
  onViewOrder: (orderId: string) => void;
  autoHideMs?: number;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  data,
  onDismiss,
  onViewOrder,
  autoHideMs = 8000,
}) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [onDismiss, autoHideMs]);

  const orderId = data.orderReady?.orderId;
  const itemNames = data.orderReady?.itemNames || data.body || 'Your order';
  const windowText =
    data.orderReady?.pickupWindowStart && data.orderReady?.pickupWindowEnd
      ? `${data.orderReady.pickupWindowStart} – ${data.orderReady.pickupWindowEnd}`
      : null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-[200] max-w-md mx-auto bg-white rounded-2xl shadow-2xl border-2 border-primary/20 overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="p-4 flex gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm text-textMain truncate">
            {data.title || 'Order Ready'}
          </p>
          <p className="text-xs text-textSecondary mt-0.5 line-clamp-2">
            {itemNames}
          </p>
          {windowText && (
            <p className="text-xs font-bold text-primary mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Pickup: {windowText}
            </p>
          )}
          {orderId && (
            <button
              type="button"
              onClick={() => {
                onViewOrder(orderId);
                onDismiss();
              }}
              className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-wider active:scale-[0.98]"
            >
              View order
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-textSecondary"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
