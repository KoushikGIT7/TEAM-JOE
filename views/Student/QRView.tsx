import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Loader2, AlertCircle, XCircle, CheckCircle2, ChefHat, Clock, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder } from '../../services/firestore-db';
import { Order } from '../../types';
import { shouldShowQR, getOrderUIState } from '../../utils/orderLifecycle';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQRPayloadSync } from '../../services/qr';
import QuoteDisplay from '../../components/QuoteDisplay';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

// ─── Status configuration ────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; sub: string; icon: React.FC<any>; color: string; bg: string; border: string }> = {
  READY:        { label: 'Ready — Collect Now',    sub: 'Head to the counter and show this QR code.',         icon: Zap,        color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  ALMOST_READY: { label: 'Almost Ready',           sub: 'Your order is being plated. Head over soon.',         icon: Clock,      color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  PREPARING:    { label: 'Preparing Your Order',   sub: 'The kitchen is working on it.',                       icon: ChefHat,    color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  MISSED:       { label: 'Pickup Missed',          sub: 'Reassigned to the next available slot.',              icon: Clock,      color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  SERVED:       { label: 'Order Served',           sub: 'Thank you! Enjoy your meal. 🎉',                     icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  NEW:          { label: 'Order Confirmed',        sub: 'Waiting to be scheduled for preparation.',            icon: ChefHat,    color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  DEFAULT:      { label: 'Order Confirmed',        sub: 'Sit tight — we\'ll notify you when it\'s ready.',    icon: ChefHat,    color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  const [order, setOrder]       = useState<Order | null>(null);
  const [loading, setLoading]   = useState(true);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrRef                   = useRef(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(1);
  const prevFlow = useRef<string>('');

  // ── Order listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenToOrder(orderId, (data) => {
      setOrder(data);
      setLoading(false);
      if (!data) { setQrString(null); return; }

      if (shouldShowQR(data)) {
        if (data.qr?.token) { setQrString(data.qr.token); qrRef.current = true; return; }
        if (!qrRef.current) {
          try {
            const qr = generateQRPayloadSync(data);
            setQrString(qr);
            qrRef.current = true;
            (async () => {
              try { await updateDoc(doc(db, 'orders', data.id), { qr: { token: qr, status: 'ACTIVE', createdAt: serverTimestamp() } }); } catch (_) {}
            })();
          } catch (_) { setQrString(null); }
        }
      } else {
        setQrString(null);
      }
    });
    return unsub;
  }, [orderId]);

  // ── Pickup timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const collecting = order?.pickupWindow?.status === 'COLLECTING';
    const end = order?.pickupWindow?.endTime;
    if (!collecting || !end) { setTimeLeft(null); return; }
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
  }, [order?.pickupWindow?.status, order?.pickupWindow?.endTime]);

  // ── Haptic on READY ──────────────────────────────────────────────────────
  useEffect(() => {
    const flow = order?.serveFlowStatus || '';
    if (flow === 'READY' && prevFlow.current !== 'READY') {
      if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]);
    }
    prevFlow.current = flow;
  }, [order?.serveFlowStatus]);

  // ── Order count ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) return;
    const h = JSON.parse(localStorage.getItem('joe_order_history') || '[]');
    if (!h.includes(orderId)) { h.push(orderId); localStorage.setItem('joe_order_history', JSON.stringify(h)); }
    setOrderCount(h.length);
  }, [orderId]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="font-semibold text-gray-700">Order not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-gray-400 underline">Go Back</button>
      </div>
    );
  }

  // ── Terminal states ──────────────────────────────────────────────────────
  const uiState    = getOrderUIState(order);
  const isAbandoned = uiState === 'ABANDONED';
  const isRejected  = order.orderStatus === 'REJECTED';

  if (isRejected || isAbandoned) {
    return (
      <div className="h-screen w-full flex flex-col bg-white max-w-md mx-auto">
        <div className="px-6 pt-10 pb-4">
          <button onClick={onBack} className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isRejected ? 'bg-red-50' : 'bg-amber-50'}`}>
            <XCircle className={`w-8 h-8 ${isRejected ? 'text-red-500' : 'text-amber-500'}`} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
            {isRejected ? 'Order Rejected' : 'Order Abandoned'}
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
            {isRejected
              ? 'The kitchen could not process this order. Please contact the cashier for a refund.'
              : 'Pickup window was missed multiple times. This token has expired.'}
          </p>
          <button onClick={onBack} className="mt-8 w-full py-4 rounded-2xl bg-gray-900 text-white font-semibold text-sm active:scale-95 transition-all">
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Resolve status ───────────────────────────────────────────────────────
  const flow    = order.serveFlowStatus || 'DEFAULT';
  const isMissed = uiState === 'MISSED';
  const isServed = order.orderStatus === 'SERVED';
  const statusKey = isServed ? 'SERVED' : isMissed ? 'MISSED' : STATUS[flow] ? flow : 'DEFAULT';
  const s = STATUS[statusKey] || STATUS.DEFAULT;
  const Icon = s.icon;
  const isReady = statusKey === 'READY';

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-white font-sans pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-8 pb-2">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl border border-gray-200 bg-gray-50 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          #{order.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* ── Status Badge ── */}
      <div className="px-5 pt-4 pb-2">
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{ background: s.bg, border: `1px solid ${s.border}` }}
        >
          <Icon className="w-4 h-4 flex-shrink-0" style={{ color: s.color }} />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ color: s.color }}>{s.label}</p>
            <p className="text-xs text-gray-500 leading-snug mt-0.5 truncate">{s.sub}</p>
          </div>
          {/* Timer inline when READY */}
          {isReady && timeLeft && (
            <span className="ml-auto text-lg font-bold font-mono flex-shrink-0" style={{ color: s.color }}>
              {timeLeft}
            </span>
          )}
        </div>
      </div>

      {/* ── QR Code (main focus) ── */}
      <div className="px-5 pt-3 flex-1 flex flex-col items-center justify-center">
        <div
          className="w-full rounded-3xl flex items-center justify-center relative"
          style={{
            padding: '24px',
            background: isReady ? s.bg : '#f8fafc',
            border: `2px solid ${isReady ? s.border : '#e2e8f0'}`,
            aspectRatio: '1',
            maxWidth: '340px',
            margin: '0 auto',
            transition: 'border-color 0.4s, background 0.4s',
          }}
        >
          {/* QR or loader */}
          <div className="bg-white rounded-2xl p-3 shadow-sm relative">
            {qrString
              ? <QRCodeSVG value={qrString} size={252} level="H" />
              : <div className="w-[252px] h-[252px] flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                </div>
            }
            {/* Served overlay */}
            {isServed && (
              <div className="absolute inset-0 bg-white/95 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              </div>
            )}
          </div>

          {/* Green dot pulse on READY */}
          {isReady && (
            <span
              className="absolute top-3 right-3 w-3 h-3 rounded-full animate-pulse"
              style={{ background: s.color }}
            />
          )}
        </div>

        {/* ── Instruction line ── */}
        <p className="text-xs text-gray-400 text-center mt-4 tracking-wide">
          {isServed ? 'This token has been used.' : 'Show this code to the server at the counter.'}
        </p>
      </div>

      {/* ── Item status (compact) ── */}
      <div className="px-5 pt-5 space-y-2">
        {order.items.map((item, idx) => {
          const rem  = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
          const done = rem <= 0;
          return (
            <div
              key={idx}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{
                background: done ? '#f0fdf4' : '#f8fafc',
                border: `1px solid ${done ? '#bbf7d0' : '#e2e8f0'}`,
              }}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <span className="flex-1 text-sm font-medium text-gray-700 truncate">{item.name}</span>
              <span className="text-xs font-semibold" style={{ color: done ? '#16a34a' : '#94a3b8' }}>
                {done ? '✓ served' : `×${item.quantity}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Quote (gold, subtle) ── */}
      <div className="px-5 pt-4">
        <QuoteDisplay order={order} orderCount={orderCount} />
      </div>

      {/* ── Bottom action ── */}
      <div className="px-5 pt-5">
        <button
          onClick={() => onViewOrders ? onViewOrders() : onBack()}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-50 border border-gray-200 active:scale-95 transition-all"
        >
          View All Orders
        </button>
      </div>
    </div>
  );
};

export default QRView;
