import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, CheckCircle2, Info, Share2, Clock, Loader2, AlertCircle, ChefHat, Timer, ChevronRight, Zap, Sparkles, Flame, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder } from '../../services/firestore-db';
import { Order } from '../../types';
import { shouldShowQR, getOrderUIState } from '../../utils/orderLifecycle';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import QuoteDisplay from '../../components/QuoteDisplay';
import { generateQRPayloadSync } from '../../services/qr';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrGeneratedRef = useRef(false);
  const [orderCount, setOrderCount] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // Timer Logic for Pickup Window
  useEffect(() => {
    const isCollecting = order?.pickupWindow?.status === 'COLLECTING';
    const endTime = order?.pickupWindow?.endTime;

    if (isCollecting && endTime) {
        const interval = setInterval(() => {
            const now = Date.now();
            const diff = endTime - now;
            if (diff <= 0) {
                setTimeLeft('WINDOW_MISSED');
                clearInterval(interval);
            } else {
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    } else {
        setTimeLeft(null);
    }
  }, [order?.pickupWindow?.status, order?.pickupWindow?.endTime]);

  useEffect(() => {
    if (!orderId) return;
    const history = JSON.parse(localStorage.getItem('joe_order_history') || '[]');
    if (!history.includes(orderId)) {
      history.push(orderId);
      localStorage.setItem('joe_order_history', JSON.stringify(history));
    }
    setOrderCount(history.length);
  }, [orderId]);

  useEffect(() => {
    const unsubscribe = listenToOrder(orderId, (data) => {
      setOrder(data);
      setLoading(false);
      
      if (!data) {
        setQrString(null);
        return;
      }

      if (shouldShowQR(data)) {
        if (data.qr?.token) {
          setQrString(data.qr.token);
          qrGeneratedRef.current = true;
          return;
        }

        if (!qrGeneratedRef.current) {
          try {
            const qr = generateQRPayloadSync(data);
            setQrString(qr);
            qrGeneratedRef.current = true;
            (async () => {
              try {
                await updateDoc(doc(db, 'orders', data.id), {
                  qr: { token: qr, status: 'ACTIVE', createdAt: serverTimestamp() }
                });
              } catch (err) {}
            })();
          } catch (err) {
            setQrString(null);
          }
        }
      } else {
        setQrString(null);
      }
    });
    
    return unsubscribe;
  }, [orderId]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!order) return <div className="p-10 text-center">Order not found.</div>;

  const flow = order.serveFlowStatus || 'NEW';
  const pickupStatus = order.pickupWindow?.status || 'AWAITING_READY';
  const uiState = getOrderUIState(order);
  const isMissed = uiState === 'MISSED';
  const isAbandoned = uiState === 'ABANDONED';

  if (order?.orderStatus === 'REJECTED' || isAbandoned) {
    const isRej = order?.orderStatus === 'REJECTED';
    return (
      <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
        <div className="p-6 flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white border border-black/5 rounded-2xl text-textMain"><ChevronLeft className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
          <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-2xl ${
              isRej ? 'bg-red-100 shadow-red-200' : 'bg-slate-100 shadow-slate-200'
          }`}>
            {isRej ? <AlertCircle className="w-12 h-12 text-red-600" /> : <XCircle className="w-12 h-12 text-slate-600" />}
          </div>
          <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tighter">
              {isRej ? 'Order Refused' : 'Order Abandoned'}
          </h3>
          <p className="text-gray-500 mb-10 font-medium leading-relaxed">
              {isRej ? 'The kitchen was unable to process this request. Please check with the cashier for a refund.' : 
               'Pickup window missed multiple times. This token is now expired. Please contact support if you believe this is an error.'}
          </p>
          <button onClick={onBack} className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all text-xs uppercase tracking-widest">Return to Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F8FAFC] max-w-md mx-auto relative overflow-x-hidden pb-12">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-primary/5 -skew-y-6 -mt-32 -z-10" />
      
      <header className="px-6 py-6 flex items-center justify-between">
          <button onClick={onBack} className="p-3.5 bg-white rounded-2xl border border-black/5 shadow-sm active:scale-90 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-right">
              <p className="text-[9px] font-black text-textSecondary uppercase tracking-widest">Active Token</p>
              <p className="text-sm font-black text-textMain">#{order.id.slice(-6).toUpperCase()}</p>
          </div>
      </header>

      <div className="flex-1 px-6 space-y-6">
        {/* Real-time Ticker / Status Banner */}
        <div className={`rounded-[2.5rem] p-6 border-2 transition-all duration-700 shadow-xl ${
            isMissed ? 'bg-amber-50 border-amber-500/30' :
            flow === 'READY' ? 'bg-green-50 border-green-500/30 animate-pulse-slow' :
            flow === 'ALMOST_READY' ? 'bg-orange-50 border-orange-500/30' :
            flow === 'QUEUED' || flow === 'PREPARING' ? 'bg-blue-50 border-blue-500/20' :
            'bg-white border-primary/20'
        }`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${
                        isMissed ? 'bg-amber-500 text-white' :
                        flow === 'READY' ? 'bg-green-500 text-white' :
                        flow === 'ALMOST_READY' ? 'bg-orange-500 text-white' :
                        'bg-primary/10 text-primary'
                    }`}>
                        {isMissed ? <Clock className="w-5 h-5" /> :
                         flow === 'READY' ? <Sparkles className="w-5 h-5" /> :
                         flow === 'ALMOST_READY' ? <Flame className="w-5 h-5" /> :
                         <ChefHat className="w-5 h-5" />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tighter">
                            {isMissed ? 'Re-preparing...' :
                             flow === 'READY' ? 'Serving Station' :
                             flow === 'ALMOST_READY' ? 'Plating Item...' :
                             flow === 'PREPARING' ? 'Cooking Now' :
                             'Preparing Order'}
                        </h3>
                        <p className="text-[10px] font-black text-textSecondary/60 uppercase tracking-widest leading-none mt-1">
                            {isMissed ? 'Token valid for next batch' :
                             flow === 'READY' ? 'Items at the counter' :
                             flow === 'ALMOST_READY' ? 'Move to pickup zone' :
                             'Chef is processing batch'}
                        </p>
                    </div>
                </div>
                {timeLeft && !isMissed && (
                    <div className="bg-white/80 px-3 py-1.5 rounded-xl border border-black/5 shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Pickup Timer</p>
                        <p className="text-xs font-black text-red-600 font-mono">{timeLeft}</p>
                    </div>
                )}
            </div>
            
            {isMissed && (
                <div className="mt-4 p-4 bg-amber-100/50 rounded-2xl border border-amber-200">
                    <p className="text-[11px] font-bold text-amber-800 leading-snug">
                       🕙 Window missed. Your QR is still active. Please wait while we prepare your items in another batch or talk to staff.
                    </p>
                </div>
            )}
        </div>

        {/* QR Engine */}
        {qrString && (
            <div className={`bg-white rounded-[3rem] p-10 shadow-2xl shadow-primary/5 flex flex-col items-center group transition-opacity duration-500 ${isMissed ? 'opacity-40 hover:opacity-100' : ''}`}>
                <div className="p-4 bg-white rounded-[2rem] border-4 border-slate-900 group-active:scale-95 transition-all duration-500 mb-8 relative">
                    <QRCodeSVG value={qrString} size={200} />
                    <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white border-4 border-white ${isMissed ? 'bg-amber-500' : 'bg-primary'}`}>
                        {isMissed ? <Clock className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
                    </div>
                </div>
                <div className="flex gap-10">
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                        <p className="text-lg font-black italic">₹{order.totalAmount}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                        <p className={`text-lg font-black italic ${isMissed ? 'text-amber-500' : 'text-primary'}`}>{isMissed ? 'PENDING' : 'VALID'}</p>
                    </div>
                </div>
            </div>
        )}

        {/* Individual Item Tracker List */}
        <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 mb-4 flex items-center gap-3">
                <div className="w-1 h-3 bg-primary rounded-full" /> Full Tracking Detail
            </h4>
            {order.items.map((item, idx) => {
                const remaining = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
                const isFullyServed = remaining <= 0;
                
                return (
                    <div key={idx} className={`rounded-[2rem] p-5 border-2 transition-all duration-500 flex items-center justify-between ${
                        isFullyServed ? 'bg-slate-100 border-transparent opacity-50' :
                        isMissed ? 'bg-amber-50 border-amber-500/10' :
                        flow === 'READY' ? 'bg-green-50 border-green-500/20' :
                        'bg-white border-white shadow-sm'
                    }`}>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-black/5 overflow-hidden flex-shrink-0">
                                <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div>
                                <h5 className="font-black text-sm text-slate-900">{item.name}</h5>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-slate-400">Qty: {item.quantity}</span>
                                    {!isFullyServed && (
                                        <div className="flex items-center gap-1">
                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${
                                                isMissed ? 'text-amber-600' :
                                                flow === 'READY' ? 'text-green-600' :
                                                flow === 'ALMOST_READY' ? 'text-orange-500' :
                                                'text-primary animate-pulse'
                                            }`}>
                                                {isMissed ? 'MISSED' : flow === 'READY' ? 'READY' : flow === 'ALMOST_READY' ? 'PLATING' : 'COOKING'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                             isFullyServed ? 'text-green-600 bg-green-100/50' :
                             isMissed ? 'text-amber-600 bg-amber-500/10' :
                             flow === 'READY' ? 'text-green-600 bg-green-500/10' :
                             'text-slate-200'
                        }`}>
                            {isFullyServed ? <CheckCircle2 className="w-6 h-6" /> : 
                             isMissed ? <Clock className="w-5 h-5" /> :
                             flow === 'READY' ? <Sparkles className="w-5 h-5 animate-pulse" /> : 
                             <div className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />}
                        </div>
                    </div>
                );
            })}
        </div>
        
        <QuoteDisplay order={order} orderCount={orderCount} />

        <div className="pt-6">
           <button 
             onClick={() => onViewOrders ? onViewOrders() : onBack()}
             className="w-full py-5 bg-slate-900 text-white font-black rounded-3xl active:scale-95 transition-all text-[10px] uppercase tracking-widest border-2 border-slate-900 hover:bg-white hover:text-slate-900 flex items-center justify-center gap-3"
           >
             Continue Exploring <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};

export default QRView;
