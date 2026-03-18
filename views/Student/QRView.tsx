import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, CheckCircle2, Info, Share2, Clock, Loader2, AlertCircle, ChefHat, Timer, ChevronRight, Zap, Sparkles, Flame, XCircle, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen w-full flex flex-col bg-[#020202] text-white max-w-md mx-auto relative overflow-x-hidden font-sans pb-12">
      {/* Background Glow */}
      <div className={`absolute top-0 left-0 right-0 h-[30vh] blur-[120px] -z-10 transition-colors duration-1000 ${
        isAbandoned ? 'bg-red-500/20' :
        isMissed ? 'bg-amber-500/20' :
        flow === 'READY' ? 'bg-green-500/30' :
        'bg-primary/20'
      }`} />
      
      <header className="px-8 py-8 flex items-center justify-between">
          <button onClick={onBack} className="p-4 bg-white/5 rounded-2xl border border-white/10 active:scale-90 transition-all">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="text-right">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-1">Authenticated</p>
              <p className="text-xl font-black text-white italic tracking-tighter">#{order.id.slice(-6).toUpperCase()}</p>
          </div>
      </header>

      <div className="flex-1 px-8 space-y-8">
        {/* ⚡ HERO STATUS SECTION */}
        <section className={`rounded-[3.5rem] p-10 border-2 transition-all duration-700 relative overflow-hidden ${
            isMissed ? 'bg-amber-500/5 border-amber-500/40' :
            flow === 'READY' ? 'bg-green-500/10 border-green-500/60 shadow-[0_0_80px_rgba(34,197,94,0.2)]' :
            flow === 'ALMOST_READY' ? 'bg-orange-500/10 border-orange-500/40' :
            'bg-white/5 border-white/10'
        }`}>
            {flow === 'READY' && (
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-green-500/20 blur-[80px] rounded-full animate-pulse" />
            )}

            <div className="flex flex-col items-center text-center relative z-10">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${
                    isMissed ? 'bg-amber-500 shadow-amber-500/40 shadow-2xl' :
                    flow === 'READY' ? 'bg-green-500 shadow-green-500/40 shadow-2xl animate-bounce' :
                    'bg-primary shadow-primary/40 shadow-2xl'
                }`}>
                    {isMissed ? <Clock className="w-10 h-10 text-white" /> :
                     flow === 'READY' ? <Zap className="w-10 h-10 text-white fill-current" /> :
                     <ChefHat className="w-10 h-10 text-white" />}
                </div>

                <h2 className={`text-5xl font-black tracking-tighter mb-2 italic ${
                    isMissed ? 'text-amber-500' :
                    flow === 'READY' ? 'text-green-500 uppercase scale-110 transition-transform' :
                    'text-white'
                }`}>
                    {isMissed ? 'Missed it!' :
                     flow === 'READY' ? 'GO COLLECT!' :
                     flow === 'ALMOST_READY' ? 'Almost There' :
                     'Preparing...'}
                </h2>
                
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest px-4 leading-relaxed">
                    {isMissed ? 'Waiting for the next batch reassignment' :
                     flow === 'READY' ? 'Items are at the counter, show QR now.' :
                     flow === 'ALMOST_READY' ? 'Items are being plated by the chef.' :
                     'Your order is in the kitchen workflow.'}
                </p>

                {timeLeft && !isMissed && (
                    <div className="mt-8 flex flex-col items-center">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] mb-2">Window Closes In</span>
                        <div className="bg-white/5 px-8 py-4 rounded-[2rem] border border-white/10 shadow-inner">
                            <p className="text-6xl font-black font-mono tracking-tighter text-red-500 animate-pulse">{timeLeft}</p>
                        </div>
                    </div>
                )}
            </div>
        </section>

        {/* 🏁 SCAN ENGINE */}
        <div className={`bg-[#0A0A0A] rounded-[4rem] p-12 border border-white/5 flex flex-col items-center gap-10 shadow-2xl transition-all duration-700 ${
            flow !== 'READY' && !isMissed ? 'opacity-20 translate-y-8 grayscale' : 'opacity-100 translate-y-0 grayscale-0'
        }`}>
            <div className="p-6 bg-white rounded-[3rem] shadow-[0_0_60px_rgba(255,255,255,0.1)] relative group">
                {qrString ? <QRCodeSVG value={qrString} size={220} level="H" /> : <Loader2 className="w-16 h-16 animate-spin text-gray-200" />}
                {flow === 'READY' && (
                    <div className="absolute -top-4 -right-4 bg-green-500 text-white p-4 rounded-full border-8 border-[#0A0A0A] animate-ping" />
                )}
            </div>
            
            <div className="flex w-full items-center justify-center gap-12 border-t border-white/5 pt-10">
                <div className="text-center">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Bill</p>
                    <p className="text-3xl font-black italic text-white/90">₹{order.totalAmount}</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">State</p>
                    <p className={`text-3xl font-black italic ${isMissed ? 'text-amber-500' : 'text-green-500'}`}>VALID</p>
                </div>
            </div>
        </div>

        {/* 📋 MINI TRACKER */}
        <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] px-4">Item Status</h3>
            {order.items.map((item, idx) => {
                const rem = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
                const done = rem <= 0;
                return (
                    <div key={idx} className={`p-6 rounded-[2.5rem] border-2 flex items-center justify-between transition-all duration-500 ${
                        done ? 'bg-green-500/5 border-transparent opacity-30 grayscale' :
                        'bg-white/5 border-white/5 shadow-xl'
                    }`}>
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10">
                                <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name} />
                            </div>
                            <div>
                                <h4 className="font-black text-lg tracking-tight italic">{item.name}</h4>
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Qty: {item.quantity}</p>
                            </div>
                        </div>
                        {done ? <CheckCircle2 className="w-8 h-8 text-green-500" /> : <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                    </div>
                );
            })}
        </div>

        <QuoteDisplay order={order} orderCount={orderCount} />

        <div className="pt-10">
            <button 
                onClick={() => onViewOrders ? onViewOrders() : onBack()}
                className="w-full h-24 bg-white text-black font-black uppercase tracking-[0.4em] text-xs rounded-[2.5rem] active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)] flex items-center justify-center gap-4"
            >
                Explore More <ArrowRight className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default QRView;
