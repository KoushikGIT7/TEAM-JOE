import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Loader2, AlertCircle, XCircle, CheckCircle2, ChefHat, Clock, Zap, Check, Banknote, PackageCheck } from 'lucide-react';
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

// ─── Status configuration (Strict States) ────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; sub: string; icon: React.FC<any>; color: string; bg: string; border: string }> = {
  READY: { label: 'READY FOR PICKUP', sub: 'Show this QR at the counter now', icon: Zap, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  PREPARING: { label: 'PREPARING FOOD', sub: 'The kitchen is cooking your meal', icon: ChefHat, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  SCHEDULED: { label: 'SCHEDULED', sub: 'Waiting for your preparation slot', icon: Clock, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  CASH_PENDING: { label: 'AWAITING CASHIER', sub: 'Please pay at the cash counter now', icon: Banknote, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  MISSED: { label: 'RE-QUEUED', sub: 'Preparing for next available slot', icon: Clock, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  SERVED: { label: 'ORDER COMPLETED', sub: 'Thank you! Enjoy your meal 🎉', icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
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
  // 🔒 TERMINAL LATCH: Once we reach a served/terminal state, never go backwards
  // This prevents Firestore multi-write race conditions from causing status flashes
  const terminalLatch = useRef(false);

  const [globalDelayMins, setGlobalDelayMins] = useState(0);

  useEffect(() => {
    return listenToSystemSettings((settings) => {
      setGlobalDelayMins(settings.globalDelayMins || 0);
    });
  }, []);

  // 🔒 Top-level ticker: ensures isTimeExpired recalcs even if Firestore is quiet
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  // ─── Order listener ───────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenToOrder(orderId, (data) => {
      setOrder(data);
      setLoading(false);
      if (!data) { setQrString(null); return; }

      const qr = data.qr?.token || generateQRPayloadSync(data);
      setQrString(qr);
      if (!data.qr?.token && !qrRef.current) {
        qrRef.current = true;
        updateDoc(doc(db, 'orders', data.id), {
          qr: { token: qr, status: 'ACTIVE', createdAt: serverTimestamp() }
        }).catch(() => { });
      }
    });
    return unsub;
  }, [orderId]);

  // ─── Pickup timer ─────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const isReady = order?.serveFlowStatus === 'READY';
    const end = order?.pickupWindow?.endTime;
    if (!isReady || !end) { setTimeLeft(null); return; }

    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { setTimeLeft('0:00'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [order?.serveFlowStatus, order?.pickupWindow?.endTime]);

  // ─── Auto-navigation after scan ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!order) return;
    // Expanded terminal detection
    const isQrScanned = order.qrStatus === 'DESTROYED' || order.qrStatus === 'USED';
    const isDestroyed = order.qrStatus === 'DESTROYED' || order.qrStatus === 'USED';
    const isOrderServed = order.orderStatus === 'SERVED' || order.orderStatus === 'COMPLETED' || order.serveFlowStatus === 'SERVED';

    if (isQrScanned || isDestroyed || isOrderServed) {
      // FAST_ITEM (Static) should return home faster
      const isFast = order.orderType === 'FAST_ITEM';
      const delay = isFast ? 1200 : 2500;

      const timer = setTimeout(() => {
        if (onViewOrders) onViewOrders();
        else onBack();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [order?.qrStatus, order?.orderStatus, order?.serveFlowStatus, order?.qrState]);

  // ─── Haptic on READY & 2-Second Flash UI ────────────────────────────────────────────────────────
  const [flashState, setFlashState] = useState<'GREEN' | 'RED' | null>(null);
  const prevItemsRef = useRef<any[] | null>(null);

  useEffect(() => {
    const flow = order?.serveFlowStatus || '';
    if (flow === 'READY' && prevFlow.current !== 'READY') {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
    prevFlow.current = flow;

    // ⚡ Calculate Flash Transitions for exactly 2 seconds feedback
    if (order?.items) {
      if (prevItemsRef.current) {
        let gotReady = false;
        let gotServed = false;

        order.items.forEach(it => {
           const old = prevItemsRef.current!.find(o => o.id === it.id);
           if (!old) return;
           if (old.status !== 'READY' && it.status === 'READY') gotReady = true;
           if ((old.status !== 'SERVED' && it.status === 'SERVED') || (old.status !== 'COMPLETED' && it.status === 'COMPLETED')) {
               gotServed = true;
           }
        });

        if (gotServed || order.qrState === 'SCANNED' || order.qrStatus === 'DESTROYED') {
           setFlashState('RED');
           setTimeout(() => setFlashState(null), 2000);
        } else if (gotReady) {
           setFlashState('GREEN');
           setTimeout(() => setFlashState(null), 2000);
        }
      }
      prevItemsRef.current = order.items;
    }
  }, [order?.serveFlowStatus, order?.items, order?.qrState, order?.qrStatus]);

  // ─── Order count (for quotes) ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const h = JSON.parse(localStorage.getItem('joe_order_history') || '[]');
    if (!h.includes(orderId)) {
      h.push(orderId);
      localStorage.setItem('joe_order_history', JSON.stringify(h));
    }
    setOrderCount(h.length);
  }, [orderId]);

  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowLoader(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowLoader(false);
    }
  }, [loading]);

  if (loading) {
      if (!showLoader) return <div className="h-screen w-full bg-white" />; // Blank placeholder briefly
      return (
        <div className="h-screen w-full flex items-center justify-center bg-white">
          <FoodLoader />
        </div>
      );
  }

  if (!order) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-8 text-center uppercase tracking-widest">
      <AlertCircle className="w-10 h-10 text-red-100 mb-4" />
      <p className="text-xs font-black text-gray-400">Order Missing</p>
      <button onClick={onBack} className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black">Back to Menu</button>
    </div>
  );

  const uiState = getOrderUIState(order);
  const flow = order.serveFlowStatus || 'NEW';

  // ⏱️ Industry-grade Immediate Lockdown (Client-side)
  const isTimeExpired = order.pickupWindow?.endTime ? Date.now() > order.pickupWindow.endTime : false;

  // qrStatus=DESTROYED/USED means the order has exhausted its tokens
  const isQrScanned =
    (order.qrStatus as string) === 'USED' ||
    (order.qrStatus as string) === 'DESTROYED';

  const isServed =
    order.orderStatus === 'SERVED' ||
    order.orderStatus === 'COMPLETED' ||
    (order.serveFlowStatus as string) === 'SERVED' ||
    isQrScanned;

  // Lock the terminal latch — once served, never un-serve
  if (isServed) terminalLatch.current = true;
  const isTerminal = terminalLatch.current;

  const isMissed = !isTerminal && (uiState === 'MISSED' || order.orderStatus === 'MISSED' || isTimeExpired);

  // Resolve strict status — SERVED takes absolute priority
  let statusKey = 'SCHEDULED';
  if (isTerminal) statusKey = 'SERVED';
  else if (isMissed) statusKey = 'MISSED';
  else if (order.paymentType === 'CASH' && order.paymentStatus === 'PENDING') statusKey = 'CASH_PENDING';
  else if (flow === 'READY') statusKey = 'READY';
  // NOTE: 'SERVED_PARTIAL' stays PREPARING (partial serve is still in progress)
  // NOTE: qrState='SCANNED' is now handled by isTerminal — NOT mapped to PREPARING
  else if (flow === 'SERVED_PARTIAL') statusKey = 'PREPARING';
  else if (flow === 'PREPARING' || flow === 'ALMOST_READY') statusKey = 'PREPARING';
  else if (order.paymentStatus === 'SUCCESS') statusKey = 'SCHEDULED';

  const s = STATUS[statusKey] || STATUS.DEFAULT;
  const isReady = statusKey === 'READY' && !isTimeExpired;
  const qrVisible = shouldShowQR(order);

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-white font-sans overflow-x-hidden">

      {/* ─── Header ─── */}
      <div className="px-6 pt-10 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 active:scale-95 transition-all">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Queue ID</p>
          <p className="text-sm font-black text-gray-900 leading-none">#{order.id.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      {/* ─── Status Indicator ─── */}
      <div className="px-6 py-2">
        <div
          className="rounded-[2rem] p-6 border-2 transition-all duration-700"
          style={{ background: s.bg, borderColor: s.border }}
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`p-4 rounded-2xl block transition-all ${isReady ? 'bg-green-600 text-white animate-bounce' : ''}`} style={{ background: !isReady ? s.bg : undefined, border: !isReady ? `1px solid ${s.border}` : undefined }}>
              <s.icon className={`w-6 h-6 ${isReady ? 'text-white' : ''}`} style={{ color: !isReady ? s.color : undefined }} />
            </div>
            {isReady && timeLeft && (
              <div className="relative flex items-center justify-center w-24 h-24">
                {/* Circular Progress Ring */}
                <svg className="absolute w-full h-full -rotate-90">
                  <circle
                    cx="48" cy="48" r="42"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-green-100"
                  />
                  <circle
                    cx="48" cy="48" r="42"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray="264"
                    strokeDashoffset={264 - (264 * (Math.max(0, (order?.pickupWindow?.endTime || 0) - Date.now()) / 420000))}
                    className="text-green-600 transition-all duration-1000"
                  />
                </svg>
                <div className="text-center z-10">
                  <p className="text-[10px] font-black text-green-700 uppercase tracking-tighter leading-none">Min Left</p>
                  <p className="text-xl font-black text-green-700 font-mono tracking-tighter">{timeLeft}</p>
                </div>
              </div>
            )}
            {!isReady && order.arrivalTime && (
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                  Time Slot {globalDelayMins > 0 && <span className="text-red-500 animate-pulse">(Delayed)</span>}
                </p>
                <p className={`text-sm font-black uppercase flex items-center justify-end gap-1 ${globalDelayMins > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(() => {
                    let h = Math.floor(order.arrivalTime / 100);
                    let m = (order.arrivalTime % 100) + globalDelayMins;
                    
                    h += Math.floor(m / 60);
                    h = h % 24;
                    m = m % 60;

                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const h12 = h % 12 || 12;
                    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
                  })()}
                </p>
              </div>
            )}
          </div>

          <h1 className="text-2xl font-black tracking-tighter mb-1" style={{ color: s.color }}>{s.label}</h1>
          <p className="text-xs font-bold opacity-60 leading-relaxed" style={{ color: s.color }}>{s.sub}</p>

          {/* Progress Bar */}
          <div className="mt-6 h-1.5 bg-black/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                background: s.color,
                width: statusKey === 'SERVED' ? '100%' :
                  statusKey === 'READY' ? '100%' :
                    statusKey === 'PREPARING' ? '65%' : '25%'
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── The Static QR (Centerpiece) ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">

        {/* 🏃 Arrival Signal chip (non-blocking) - shown below status */}
        {!isReady && !isServed && order.arrivalTime && (
          <div className="w-full max-w-[320px] mb-4 animate-in fade-in duration-500">
            <div className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <ChefHat className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Scheduled Order</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tap when 2 mins away</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, 'orders', order.id), {
                    arrivalSignal: 'ARRIVED',
                    arrivalSignalAt: serverTimestamp()
                  });
                }}
                disabled={order.arrivalSignal === 'ARRIVED'}
                className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-[9px] uppercase tracking-[0.15em] flex items-center gap-2 transition-all active:scale-95 ${order.arrivalSignal === 'ARRIVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-900 text-white shadow-lg'
                  }`}
              >
                {order.arrivalSignal === 'ARRIVED' ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                {order.arrivalSignal === 'ARRIVED' ? 'Signalled' : "I'm Here"}
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-[320px] aspect-square bg-white border-[12px] border-gray-50 rounded-[3rem] shadow-2xl shadow-black/5 flex items-center justify-center relative overflow-hidden">

          <div className="p-4 relative bg-white w-full h-full flex items-center justify-center">
            {qrString ? (
              <>
                {/* ⚡ 2-Second Flash Overlay */}
                {flashState === 'GREEN' && (
                  <div className="absolute inset-0 bg-green-500 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-[100] m-2 rounded-[2.5rem]">
                     <CheckCircle2 className="w-24 h-24 text-white mb-2" />
                     <p className="text-xl font-black text-white uppercase tracking-widest">Meal Ready!</p>
                  </div>
                )}
                {flashState === 'RED' && (
                  <div className="absolute inset-0 bg-red-500 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 z-[100] m-2 rounded-[2.5rem]">
                     <PackageCheck className="w-24 h-24 text-white mb-2" />
                     <p className="text-xl font-black text-white uppercase tracking-widest">Scanned</p>
                  </div>
                )}

                <div className={`transition-all duration-700 ${qrVisible ? 'opacity-100 blur-0' : 'opacity-10 blur-xl scale-90 pointer-events-none'}`}>
                  <QRCodeSVG value={qrString} size={220} level="M" />
                </div>

                {!qrVisible && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-in fade-in zoom-in duration-500">
                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl mb-4 text-white ${isMissed ? 'bg-amber-600' : 'bg-gray-900'}`}>
                      {isMissed ? <Clock className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
                    </div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">{isMissed ? 'Expired' : 'Locked'}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1 text-center max-w-[200px]">
                      {isMissed ? 'Window missed - Order re-queued' : 'QR reveals when food is ready'}
                    </p>
                  </div>
                )}

                {isServed && (
                  <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center animate-in fade-in duration-500 z-20">
                    <CheckCircle2 className="w-20 h-20 text-green-500 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Served</span>
                  </div>
                )}
              </>
            ) : (
              <Loader2 className="w-10 h-10 animate-spin text-gray-100" />
            )}
          </div>

          {/* Real-time scan pulse */}
          {!isServed && statusKey === 'READY' && (
            <div className="absolute inset-0 border-4 border-green-500/20 rounded-[2.5rem] animate-pulse pointer-events-none z-30" />
          )}
        </div>
        <p className="mt-8 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] text-center px-10">
          {(isReady || isServed || order.items.some(i => i.orderType === 'FAST_ITEM')) ? 'Point this at counter scanner' : `Cooking in progress - #${order.id.slice(-6).toUpperCase()}`}
        </p>
      </div>

      {/* ─── Orders Details (Clean) ─── */}
      <div className="px-6 py-4 border-t border-gray-50">
        <div className="flex items-center gap-3 mb-6">
          <QuoteDisplay order={order} orderCount={orderCount} />
        </div>
        <div className="space-y-3">
          {order.items.map((item, idx) => {
            const isItemServed = item.status === 'SERVED' || item.status === 'COMPLETED' || (item.remainingQty === 0 && item.servedQty === item.quantity);
            const isItemReady = item.status === 'READY';
            return (
              <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isItemServed ? 'bg-green-50/50 border-green-100 opacity-80' :
                  isItemReady ? 'bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-50' : 'bg-gray-50 border-gray-100'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg overflow-hidden ${isItemServed ? 'grayscale opacity-40' : ''}`}>
                    <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-black ${isItemServed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.name}</h4>
                    <p className="text-[9px] font-bold text-gray-400">Qty: {item.quantity}</p>
                  </div>
                </div>
                {isItemServed ? (
                  <span className="text-[9px] font-black uppercase text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Received
                  </span>
                ) : isItemReady ? (
                  <span className="text-[8px] font-black uppercase text-indigo-600 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 animate-pulse">
                    Ready at Counter
                  </span>
                ) : (
                  <span className="text-[8px] font-black uppercase text-gray-400 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                    Reserved
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-6 pt-0">
        <button
          onClick={() => onViewOrders ? onViewOrders() : onBack()}
          className="w-full py-5 bg-gray-900 text-white rounded-[1.75rem] text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-gray-200"
        >
          View Order History
        </button>
      </div>

      {/* ─── Order Completion Animation (Overlay) ─── */}
      {isServed && (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-10 animate-in fade-in duration-700">
          <div className="w-32 h-32 bg-green-50 rounded-[3rem] flex items-center justify-center mb-10 animate-in zoom-in duration-1000 delay-300">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter text-center">Meal Received!</h2>
          <p className="text-gray-400 font-bold text-lg text-center leading-relaxed">Hope you enjoy every bite. Returning to the menu shortly.</p>
        </div>
      )}
    </div>
  );
};

export default QRView;
