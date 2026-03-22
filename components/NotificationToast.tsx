import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, X, ChevronRight } from 'lucide-react';

export interface NotificationToastData {
  title: string;
  body: string;
  type?: 'success' | 'info' | 'warning' | 'error';
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

const ICON_MAP = {
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2.5} />,
  info:    <Clock        className="w-3.5 h-3.5 text-slate-400"   strokeWidth={2.5} />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400"  strokeWidth={2.5} />,
  error:   <AlertTriangle className="w-3.5 h-3.5 text-rose-400"   strokeWidth={2.5} />,
};

const ACCENT_MAP = {
  success: 'bg-emerald-500',
  info:    'bg-slate-300',
  warning: 'bg-amber-400',
  error:   'bg-rose-400',
};

const AUTO_DISMISS_MS = 6000;

const NotificationToast: React.FC<NotificationToastProps> = ({ data, onDismiss, onViewOrder }) => {
  const [progress, setProgress] = useState(100);
  const type = data.type ?? (data.orderReady ? 'success' : 'info');

  // Auto-dismiss with progress bar
  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(tick);
        onDismiss();
      }
    }, 50);
    return () => clearInterval(tick);
  }, [onDismiss]);

  return (
    <div className="w-full max-w-[340px] animate-in slide-in-from-top-3 fade-in duration-300 ease-out">
      <div className="relative bg-white border border-gray-100 rounded-2xl shadow-md shadow-black/5 overflow-hidden">

        {/* Progress bar — top edge */}
        <div
          className={`absolute top-0 left-0 h-[2px] transition-all ease-linear ${ACCENT_MAP[type]}`}
          style={{ width: `${progress}%`, transitionDuration: '50ms' }}
        />

        <div className="flex items-start gap-3 px-3.5 py-3">

          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
            {ICON_MAP[type]}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-800 leading-tight tracking-tight truncate">
              {data.title}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5 leading-snug line-clamp-2">
              {data.body}
            </p>

            {/* CTA for order-ready */}
            {data.orderReady && onViewOrder && (
              <button
                onClick={() => onViewOrder(data.orderReady!.orderId)}
                className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 transition-colors group"
              >
                View Order
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="flex-shrink-0 -mt-0.5 -mr-0.5 p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-all"
          >
            <X className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
