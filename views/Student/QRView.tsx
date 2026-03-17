import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, CheckCircle2, Info, Share2, Clock, Loader2, AlertCircle, ChefHat, Timer, ChevronRight } from 'lucide-react';
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
}

const QRView: React.FC<QRViewProps> = ({ orderId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrGeneratedRef = useRef(false);
  const [orderCount, setOrderCount] = useState<number>(1);

  useEffect(() => {
    if (order?.orderStatus === 'REJECTED' || order?.orderStatus === 'SERVED') {
      const timer = setTimeout(onBack, 3000);
      return () => clearTimeout(timer);
    }
  }, [order?.orderStatus, onBack]);

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

  const uiState = getOrderUIState(order);
  const qrIsVisible = shouldShowQR(order) && qrString !== null;
  const isScanned = uiState === 'SCANNED';

  if (order?.orderStatus === 'REJECTED') {
    return (
      <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
        <div className="p-4 bg-white flex items-center gap-4 border-b">
          <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-textMain">Order Rejected</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Order Rejected</h3>
          <p className="text-gray-600 mb-8 font-medium">Please contact the cashier for assistance.</p>
          <button onClick={onBack} className="w-full bg-primary text-white font-bold py-4 rounded-2xl">Go Home</button>
        </div>
      </div>
    );
  }


  if (isScanned || uiState === 'COMPLETED') {
    const isServed = uiState === 'COMPLETED';
    return (
      <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto">
        <div className="p-4 bg-white flex items-center gap-4 border-b">
          <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold text-textMain">{isServed ? 'Fulfilled' : 'Validated'}</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-500">
          <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl ${isServed ? 'bg-primary text-white shadow-primary/30' : 'bg-success/10 text-success shadow-success/10'}`}>
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h3 className="text-3xl font-black text-textMain tracking-tighter mb-2">
            {isServed ? 'Order Served!' : 'Order Validated!'}
          </h3>
          <p className="text-textSecondary mb-10 font-medium">
            {isServed 
              ? 'Thank you for dining with JOE! Returning home...' 
              : 'Your token has been scanned. Handing over your meal now.'}
          </p>
          <button 
            onClick={onBack} 
            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all"
          >
            Go Home Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background max-w-md mx-auto px-4">
      <header className="py-4 flex items-center">
          <button onClick={onBack} className="p-2.5 rounded-2xl bg-white border border-black/5"><ChevronLeft className="w-5 h-5" /></button>
      </header>

      <div className="flex-1 flex flex-col items-center overflow-y-auto pb-10">
        {order?.serveFlowStatus === 'NEW' && order?.orderType === 'PREPARATION_ITEM' && (
          <div className="w-full bg-blue-50 text-blue-600 p-5 rounded-3xl flex flex-col gap-1 mb-6 border border-blue-100 animate-pulse">
            <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 font-black" />
                <p className="text-sm font-black uppercase tracking-tight">Arrival: {order.arrivalTime ? `${Math.floor(order.arrivalTime/100).toString().padStart(2,'0')}:${(order.arrivalTime%100).toString().padStart(2,'0')}` : 'Soon'}</p>
            </div>
            <p className="text-[10px] font-bold opacity-80">Chef will start preparing this 15 mins before your arrival.</p>
          </div>
        )}

        {order?.serveFlowStatus === 'PREPARING' && (
          <div className="w-full bg-amber-50 text-amber-600 p-5 rounded-3xl flex flex-col gap-1 mb-6 border border-amber-100">
            <div className="flex items-center gap-2">
                <ChefHat className="w-5 h-5 animate-bounce" />
                <p className="text-sm font-black uppercase tracking-tight">Chef is cooking...</p>
            </div>
            <p className="text-[10px] font-bold opacity-80">Almost there! Stay close to the counter.</p>
          </div>
        )}

        {order?.serveFlowStatus === 'READY' && (
          <div className="w-full bg-green-50 text-green-600 p-5 rounded-3xl flex flex-col gap-1 mb-6 border border-green-100">
            <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-black uppercase tracking-tight">Ready for Pickup!</p>
            </div>
            <p className="text-[10px] font-bold opacity-80">Please collect your items immediately from the counter.</p>
          </div>
        )}

        {qrIsVisible ? (
          <div className="w-full bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-primary/10 text-center">
            <QRCodeSVG value={qrString || ''} size={240} className="mx-auto mb-8 p-4 bg-white rounded-3xl border-4 border-primary" />
            <div className="space-y-1 mb-6">
              <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest">Order Reference</p>
              <p className="text-lg font-black text-textMain">#{order?.id?.slice(-8).toUpperCase()}</p>
            </div>
            <div className="pt-6 border-t border-dashed border-gray-100">
                <div className="flex justify-between items-center px-4">
                  <span className="text-[10px] font-black text-textSecondary uppercase">Total Paid</span>
                  <span className="text-xl font-black text-primary">₹{order?.totalAmount}</span>
                </div>
            </div>
          </div>
        ) : (
          <div className="p-20 text-center opacity-30">
             <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
             <p className="text-xs font-black uppercase tracking-widest">Order Validating...</p>
          </div>
        )}

        <QuoteDisplay order={order} orderCount={orderCount} forceRevenge={true} />

        <div className="w-full mt-Auto pt-8">
           <button 
             onClick={onBack}
             className="w-full bg-gray-50 text-textSecondary font-black py-5 rounded-3xl border border-black/5 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
           >
             Order More Items <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </div>
  );
};


export default QRView;
