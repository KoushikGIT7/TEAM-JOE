import React, { useEffect } from 'react';
import { X, CheckCircle, Clock } from 'lucide-react';

export interface NotificationToastData {
  title: string;
  body: string;
  orderReady?: {
    type: 'ORDER_READY';
    orderId: string;
    pickupWindowStart?: number;
    pickupWindowEnd?: number;
  };
}

interface NotificationToastProps {
  data: NotificationToastData;
  onDismiss: () => void;
  onViewOrder?: (orderId: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ data, onDismiss, onViewOrder }) => {
  useEffect(() => {
    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-sm z-[9999] px-4 pointer-events-none animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 shadow-2xl flex items-start gap-4 pointer-events-auto transition-all">
        
        <div className="flex-shrink-0 mt-1">
          {data.orderReady ? (
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{data.title}</p>
          <p className="text-gray-600 text-xs mt-1 leading-snug">{data.body}</p>

          {data.orderReady && onViewOrder && (
            <button
              onClick={() => onViewOrder(data.orderReady!.orderId)}
              className="mt-3 w-full bg-primary hover:bg-primary/90 text-white text-xs font-bold py-2 rounded-xl transition-colors"
            >
              View Order
            </button>
          )}
        </div>

        <button 
          onClick={onDismiss}
          className="flex-shrink-0 p-2 -m-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationToast;
