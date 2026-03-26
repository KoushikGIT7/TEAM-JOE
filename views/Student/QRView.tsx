import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ChevronLeft, Loader2, AlertCircle, XCircle, CheckCircle2, ChefHat, Clock, Zap, Check, Banknote, PackageCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder, listenToSystemSettings } from '../../services/firestore-db';
import { Order } from '../../types';
import { shouldShowQR, getOrderUIState } from '../../utils/orderLifecycle';
import { updateDoc, doc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQRPayloadSync } from '../../services/qr';
import QuoteDisplay from '../../components/QuoteDisplay';
import FoodLoader from '../../components/Common/FoodLoader';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

const STATUS: Record<string, { label: string; sub: string; icon: React.FC<any>; color: string; bg: string; border: string }> = {
  READY: { label: 'READY FOR PICKUP', sub: 'Show this QR at the counter now', icon: Zap, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  PREPARING: { label: 'PREPARING FOOD', sub: 'The kitchen is cooking your meal', icon: ChefHat, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  SCHEDULED: { label: 'SCHEDULED', sub: 'Waiting for your preparation slot', icon: Clock, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  CASH_PENDING: { label: 'AWAITING CASHIER', sub: 'Please pay at the cash counter now', icon: Banknote, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  MISSED: { label: 'RE-QUEUED', sub: 'Preparing for next available slot', icon: Clock, color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  SERVED: { label: 'ORDER COMPLETED', sub: 'Thank you! Enjoy your meal 🍕', icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  DEFAULT: { label: 'ORDER PLACED', sub: 'Waiting to start...', icon: ChefHat, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  // ── ALL HOOKS MUST BE UNCONDITIONAL ──────────────────────────────────────────
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<any[]>([]);

  const mergedOrder = useMemo(() => {
    if (!order) return null;
    if (items.length === 0) return order;
    return {
      ...order,
      items: (order.items || []).map(rootItem => {
        const fresh = items.find(it => it.id === rootItem.id || it.itemId === rootItem.id);
        return fresh ? { ...rootItem, ...fresh } : rootItem;
      })
    };
  }, [order, items]);

  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(1);
  const prevFlow = useRef<string>('');
  const [, setTick] = useState(0);
  const terminalLatch = useRef(false);
  const isMounted = useRef(true);
  const [globalDelayMins, setGlobalDelayMins] = useState(0);
  const [flashState, setFlashState] = useState<'GREEN' | 'RED' | null>(null);
  const prevItemsRef = useRef<any[] | null>(null);
  const [showLoader, setShowLoader] = useState(false);

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
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      setQrLoading(false);
      setIsGenerating(false);
    };
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const q = query(collection(db, 'orders', orderId, 'items'), where('status', 'in', ['READY', 'SERVED']));
    const unsub = onSnapshot(q, (snap) => {
       if (!isMounted.current) return;
       const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
       setItems(docs);
    });
    return unsub;
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    setIsGenerating(true);
    
    const unsub = listenToOrder(orderId, (data) => {
      if (!isMounted.current) return;
      setOrder(data);
      setLoading(false);
      setQrLoading(false);
      setIsGenerating(false);
      
      if (!data) return;
      
      if (data.items) setItems(data.items);

      const qr = data.qr?.token || generateQRPayloadSync(data);
      setQrString(qr);
      
      if ((!data.qr?.token || data.qrStatus !== 'ACTIVE') && !qrRef.current) {
        qrRef.current = true;
        updateDoc(doc(db, 'orders', data.id), {
          qrStatus: 'ACTIVE',
          qr: { token: qr, status: 'ACTIVE', createdAt: serverTimestamp() }
        }).catch(() => { });
      }
    });
    return unsub;
  }, [orderId]);

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

  useEffect(() => {
    const flow = order?.serveFlowStatus || '';
    if (flow === 'READY' && prevFlow.current !== 'READY') {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
    prevFlow.current = flow;

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

  useEffect(() => {
    if (!orderId) return;
    const h = JSON.parse(localStorage.getItem('joe_order_history') || '[]');
    if (!h.includes(orderId)) {
      h.push(orderId);
      localStorage.setItem('joe_order_history', JSON.stringify(h));
    }
    setOrderCount(h.length);
  }, [orderId]);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setShowLoader(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowLoader(false);
    }
  }, [loading]);

  // 🛡️ Derive the state values needed for the final useEffect BEFORE calling it
  const orderForUI = mergedOrder;
  const uiState = orderForUI ? getOrderUIState(orderForUI) : null;
  const flow = orderForUI?.serveFlowStatus || 'NEW';
  const isTimeExpired = orderForUI?.pickupWindow?.endTime ? Date.now() > orderForUI.pickupWindow.endTime : false;
  const isQrScanned = (orderForUI?.qrStatus as string) === 'USED' || (orderForUI?.qrStatus as string) === 'DESTROYED';
  const isScanned = orderForUI?.qrState === 'SCANNED' || (orderForUI?.qrStatus as string) === 'SCANNED';
  const isServed = !!orderForUI && (
    orderForUI.orderStatus === 'SERVED' ||
    orderForUI.orderStatus === 'COMPLETED' ||
    (orderForUI.serveFlowStatus as string) === 'SERVED' ||
    isQrScanned ||
    (orderForUI.orderStatus === 'IN_PROGRESS' && isScanned)
  );
  if (isServed) terminalLatch.current = true;
  const isTerminal = terminalLatch.current;
  const isMissed = !isTerminal && (uiState === 'MISSED' || orderForUI?.orderStatus === 'MISSED' || isTimeExpired);

  // ✅ This useEffect is now unconditional and below NO early returns
  useEffect(() => {
    if (!order || !orderForUI) return;
    if (isServed || isTerminal) {
      const timer = setTimeout(() => {
        if (onViewOrders) onViewOrders();
        else onBack();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [order?.qrStatus, order?.orderStatus, order?.serveFlowStatus, order?.qrState, isServed, isTerminal]);

  // ── EARLY RETURNS (safe now — all hooks declared above) ──────────────────────
  if (loading) {
    if (!showLoader) return <div className="h-screen w-full bg-white" />;
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <FoodLoader />
      </div>
    );
  }

  if (!orderForUI) return <div className="h-screen w-full flex items-center justify-center bg-white"><FoodLoader /></div>;

  // ── DERIVED UI VALUES ─────────────────────────────────────────────────────────
  let statusKey = 'SCHEDULED';
  if (isTerminal) statusKey = 'SERVED';
  else if (isScanned) statusKey = 'SERVED';
  else if (isMissed) statusKey = 'MISSED';
  else if (orderForUI.paymentType === 'CASH' && orderForUI.paymentStatus === 'AWAITING_CONFIRMATION') statusKey = 'CASH_PENDING';
  else if (flow === 'READY') statusKey = 'READY';
  else if (flow === 'SERVED_PARTIAL' || orderForUI.orderStatus === 'IN_PROGRESS') statusKey = 'PREPARING';
  else if (flow === 'PREPARING' || flow === 'ALMOST_READY') statusKey = 'PREPARING';
  else if (orderForUI.paymentStatus === 'SUCCESS' || orderForUI.paymentStatus === 'VERIFIED') statusKey = 'SCHEDULED';

  const s = STATUS[statusKey] || STATUS.DEFAULT;
  const isReady = (statusKey === 'READY' || (orderForUI.items || []).some(i => i.status === 'READY')) && !isTimeExpired;
  const isUnlocked = isReady || (orderForUI.items || []).some(it => it.orderType === 'FAST_ITEM') || orderForUI.serveFlowStatus === 'READY';
  const qrVisible = shouldShowQR(orderForUI) || isUnlocked;

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-white font-sans overflow-x-hidden">

      {/* ─── Header ─── */}
      <div className="px-6 pt-10 pb-4 flex items-center justify-between">
        <button onClick={onBack} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 active:scale-95 transition-all">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none mb-1">Queue ID</p>
          <p className="text-sm font-black text-gray-900 leading-none">#{order!.id.slice(-6).toUpperCase()}</p>
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
                <svg className="absolute w-full h-full -rotate-90">
                  <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-green-100" />
                  <circle cx="48" cy="48" r="42" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * (Math.max(0, (order?.pickupWindow?.endTime || 0) - Date.now()) / 420000))} className="text-green-600 transition-all duration-1000" />
                </svg>
                <div className="text-center z-10">
                  <p className="text-[10px] font-black text-green-700 uppercase tracking-tighter leading-none">Min Left</p>
                  <p className="text-xl font-black text-green-700 font-mono tracking-tighter">{timeLeft}</p>
                </div>
              </div>
            )}
            {!isReady && order!.arrivalTime && (
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                  Time Slot {globalDelayMins > 0 && <span className="text-red-500 animate-pulse">(Delayed)</span>}
                </p>
                <p className={`text-sm font-black uppercase flex items-center justify-end gap-1 ${globalDelayMins > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {(() => {
                    let h = Math.floor(order!.arrivalTime! / 100);
                    let m = (order!.arrivalTime! % 100) + globalDelayMins;
                    h += Math.floor(m / 60);
                    h = h % 24; m = m % 60;
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
          <div className="mt-6 h-1.5 bg-black/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ background: s.color, width: statusKey === 'SERVED' ? '100%' : statusKey === 'READY' ? '100%' : statusKey === 'PREPARING' ? '65%' : '25%' }} />
          </div>
        </div>
      </div>

      {/* ─── The Static QR (Centerpiece) ─── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        {!isReady && !isServed && order!.arrivalTime && (
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
                  await updateDoc(doc(db, 'orders', order!.id), { arrivalSignal: 'ARRIVED', arrivalSignalAt: serverTimestamp() });
                }}
                disabled={order!.arrivalSignal === 'ARRIVED'}
                className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-[9px] uppercase tracking-[0.15em] flex items-center gap-2 transition-all active:scale-95 ${order!.arrivalSignal === 'ARRIVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white shadow-lg'}`}
              >
                {order!.arrivalSignal === 'ARRIVED' ? <Check className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                {order!.arrivalSignal === 'ARRIVED' ? 'Signalled' : "I'm Here"}
              </button>
            </div>
          </div>
        )}
        <div className="w-full max-w-[320px] aspect-square bg-white border-[12px] border-gray-50 rounded-[3rem] shadow-2xl shadow-black/5 flex items-center justify-center relative overflow-hidden">
          <div className="p-4 relative bg-white w-full h-full flex items-center justify-center">
            {qrString ? (
              <>
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
                      <Clock className="w-10 h-10" />
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
          {!isServed && statusKey === 'READY' && (
            <div className="absolute inset-0 border-4 border-green-500/20 rounded-[2.5rem] animate-pulse pointer-events-none z-30" />
          )}
        </div>
        <div className="mt-8 flex flex-col items-center gap-2 px-10">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] text-center">
            {isServed ? 'Order Completed' : 
             (isReady || (orderForUI.items || []).some(i => i.orderType === 'FAST_ITEM' || ['Lunch', 'Beverages', 'Snacks'].includes(i.category || ''))) ? 
             'Point this at counter scanner' : 
             `Cooking in progress - #${orderForUI.id.slice(-6).toUpperCase()}`}
          </p>
          {!isServed && (orderForUI.items || []).length > 1 && (
             <div className="flex items-center gap-2">
                <div className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                   { (orderForUI.items || []).filter(i => i.status === 'READY' || i.status === 'SERVED').length } of { (orderForUI.items || []).length } items ready 🚀
                </div>
             </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-50">
        <div className="flex items-center gap-3 mb-6">
          <QuoteDisplay order={orderForUI} orderCount={orderCount} />
        </div>
        <div className="space-y-3">
          {(orderForUI.items || []).map((item, idx) => {
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

      {(isServed || isTerminal) && (
        <div className="fixed inset-0 bg-white z-[150] flex flex-col items-center justify-center p-10 animate-in fade-in slide-in-from-bottom duration-700">
          <div className="w-32 h-32 bg-green-50 rounded-[3rem] flex items-center justify-center mb-10 animate-in zoom-in spin-in-12 duration-1000 delay-300">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter text-center scale-in-90 animate-in duration-500 delay-500">Meal Received!</h2>
          <p className="text-gray-400 font-bold text-lg text-center leading-relaxed max-w-[280px]">Order confirmed. Enjoy your delicious meal at JOE Cafe! 🍕</p>
          <div className="mt-12 flex items-center gap-2 px-10">
             <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 animate-progress origin-left" />
             </div>
          </div>
          <p className="mt-4 text-[10px] font-black uppercase text-gray-300 tracking-[0.3em]">Returning to menu</p>
        </div>
      )}
    </div>
  );
};

export default QRView;
