import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Loader2, AlertCircle, XCircle, CheckCircle2, ChefHat, Clock, Zap, Check, Banknote } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder, listenToSystemSettings } from '../../services/firestore-db';
import { Order } from '../../types';
import { shouldShowQR, getOrderUIState } from '../../utils/orderLifecycle';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQRPayloadSync } from '../../services/qr';
import QuoteDisplay from '../../components/QuoteDisplay';
import FoodLoader from '../../components/Common/FoodLoader';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

// ── Status configuration (Strict States) ───────────────────────────────────
const STATUS: Record<string, { label: string; sub: string; icon: React.FC<any>; color: string; bg: string; border: string }> = {
  READY: { label: 'PICK UP READY ✅', sub: 'Collect your meal at the counter now', icon: Zap, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  PREPARING: { label: 'KITCHEN COOKING...', sub: 'Your meal is being prepared', icon: ChefHat, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  SCHEDULED: { label: 'SCHEDULED', sub: 'Awaiting your preparation slot', icon: Clock, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  CASH_PENDING: { label: 'AWAITING CASHIER', sub: 'Please complete payment to start cooking', icon: Banknote, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  MISSED: { label: 'RE-QUEUED', sub: 'Preparing for next available slot', icon: Clock, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  IN_PROGRESS: { label: 'ENJOY YOUR FOOD 🍽️', sub: 'Remaining items are being prepared...', icon: ChefHat, color: '#f59e0b', bg: '#fffbeb', border: '#fef3c7' },
  SERVED: { label: 'ORDER COMPLETED ✅', sub: 'Thank you! Enjoy your meal 🎉', icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  DEFAULT: { label: 'ORDER PLACED', sub: 'Waiting to start...', icon: ChefHat, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(1);
  const prevFlow = useRef<string>('');
  const [, setTick] = useState(0);
  const terminalLatch = useRef(false);
  const [globalDelayMins, setGlobalDelayMins] = useState(0);

  useEffect(() => {
    return listenToSystemSettings((settings) => {
      setGlobalDelayMins(settings.globalDelayMins || 0);
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const unsub = listenToOrder(orderId, (data) => {
      setOrder(data);
      if (loading) setLoading(false);
    });
    return () => unsub();
  }, [orderId]);

  useEffect(() => {
    if (order) {
      const payload = generateQRPayloadSync(order.id, order.userId, order.cafeteriaId, order.createdAt);
      setQrString(payload);
    }
  }, [order]);

  useEffect(() => {
    if (!order?.pickupWindow?.endTime) {
      setTimeLeft(null);
      return;
    }
    const updateCountdown = () => {
      const now = Date.now();
      const end = order.pickupWindow!.endTime!;
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft('0:00');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [order?.pickupWindow?.endTime]);

  if (loading) return <FoodLoader message="Synchronizing Hub..." />;
  if (!order) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
       <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl flex flex-col items-center text-center border-4 border-slate-100">
          <XCircle className="w-20 h-20 text-rose-500 mb-8" />
          <h2 className="text-3xl font-black text-slate-900 mb-4">Tracking Lost</h2>
          <p className="text-slate-400 font-bold mb-10 leading-relaxed uppercase tracking-widest text-[10px]">Reference mismatch in Firestore Index</p>
          <button onClick={onBack} className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Back to Home</button>
       </div>
    </div>
  );

  const uiState = getOrderUIState(order);
  const flow = order.serveFlowStatus || 'NEW';

  // 🏁 LOGIC REINFORCEMENT: Order Status vs Scan Status
  // A scan alone does NOT complete the order if items are pending.
  const isTerminallyServed = (order.orderStatus === 'SERVED' || order.orderStatus === 'COMPLETED') || (order.serveFlowStatus === 'SERVED');
  
  if (isTerminallyServed) terminalLatch.current = true;
  const isTerminal = terminalLatch.current;

  // Resolve strict status — Terminal states take priority
  let statusKey = 'SCHEDULED';
  if (isTerminal) statusKey = 'SERVED';
  else if (order.paymentType === 'CASH' && order.paymentStatus === 'PENDING') statusKey = 'CASH_PENDING';
  else if (uiState === 'MISSED' || order.orderStatus === 'MISSED') statusKey = 'MISSED';
  else if (flow === 'READY') statusKey = 'READY';
  else if (order.orderStatus === 'IN_PROGRESS' || flow === 'SERVED_PARTIAL' || order.qrState === 'SCANNED') statusKey = 'IN_PROGRESS';
  else if (flow === 'PREPARING' || flow === 'ALMOST_READY' || order.kitchenStatus === 'COOKING') statusKey = 'PREPARING';
  else if (order.paymentStatus === 'SUCCESS') statusKey = 'SCHEDULED';

  const s = STATUS[statusKey] || STATUS.DEFAULT;
  const isReady = statusKey === 'READY';
  const qrVisible = shouldShowQR(order) && !isTerminal && statusKey !== 'IN_PROGRESS';

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-slate-50 font-sans overflow-x-hidden p-6">
      <div className="flex-1 space-y-8 mt-4">
        {/* Header */}
        <div className="flex items-center justify-between">
           <button onClick={onBack} className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-90 transition-all">
              <ChevronLeft className="w-5 h-5 text-slate-900" />
           </button>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Order Ref</p>
              <p className="text-sm font-black text-slate-900 leading-none">#{order.id.slice(-6).toUpperCase()}</p>
           </div>
        </div>

        {/* Status Card */}
        <div 
          className="rounded-[3.5rem] p-10 border-4 transition-all duration-700 shadow-2xl shadow-slate-200"
          style={{ background: s.bg, borderColor: s.border }}
        >
          <div className="flex justify-center mb-8">
             <div className="p-6 bg-white rounded-[2rem] shadow-xl">
                <s.icon className="w-10 h-10" style={{ color: s.color }} />
             </div>
          </div>
          <div className="text-center">
             <h1 className="text-2xl font-black uppercase tracking-tighter italic mb-2" style={{ color: s.color }}>{s.label}</h1>
             <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{s.sub}</p>
          </div>
        </div>

        {/* QR Section */}
        {qrVisible && qrString ? (
          <div className="bg-white rounded-[4rem] p-12 shadow-2xl border-4 border-slate-100 flex flex-col items-center animate-in zoom-in duration-500">
             <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100 shadow-inner mb-8">
                <QRCodeSVG value={qrString} size={200} level="H" includeMargin={false} />
             </div>
             <div className="bg-emerald-500 text-white px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/30">
                Live Validation Active
             </div>
          </div>
        ) : (
          !isTerminal && (
            <div className="bg-white rounded-[4rem] p-10 shadow-xl border-4 border-slate-100 flex flex-col items-center text-center">
               <ChefHat className="w-12 h-12 text-slate-200 mb-6" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] leading-relaxed">QR temporarily hidden while kitchen fulfills current sequence</p>
            </div>
          )
        )}

        {isTerminal && (
          <div className="bg-emerald-500 rounded-[4rem] p-12 text-center text-white shadow-2xl shadow-emerald-500/20 animate-in slide-in-from-bottom duration-700">
             <div className="flex justify-center mb-6">
                <div className="bg-white/20 p-6 rounded-[2.5rem] backdrop-blur-xl">
                   <CheckCircle2 className="w-16 h-16 text-white" />
                </div>
             </div>
             <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-2">Bon Appétit!</h2>
             <p className="text-white/80 font-bold text-[10px] uppercase tracking-widest">Order Handover Complete</p>
          </div>
        )}
      </div>

      <div className="py-8 text-center">
         <button onClick={onViewOrders} className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] hover:text-slate-900 transition-colors">Manage All Receipts</button>
      </div>
    </div>
  );
};

export default QRView;
