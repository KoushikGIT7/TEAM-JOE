import React, { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Loader2, AlertCircle, XCircle, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder } from '../../services/firestore-db';
import { Order } from '../../types';
import { shouldShowQR, getOrderUIState } from '../../utils/orderLifecycle';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQRPayloadSync } from '../../services/qr';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

// ─── Minimal status config ────────────────────────────────────────────────────
const STATUS_CONFIG = {
  READY:        { label: 'COLLECT NOW',    sub: 'Show this QR at the counter',      color: '#22c55e', bg: '#052e16' },
  ALMOST_READY: { label: 'ALMOST READY',   sub: 'Head to the counter shortly',       color: '#f97316', bg: '#1c0a00' },
  PREPARING:    { label: 'PREPARING',      sub: 'Your order is being cooked',        color: '#94a3b8', bg: '#0f0f0f' },
  MISSED:       { label: 'PICKUP MISSED',  sub: 'Reassigned to next available slot', color: '#f59e0b', bg: '#1c1000' },
  SERVED:       { label: 'ORDER SERVED',   sub: 'Thank you! Enjoy your meal',        color: '#22c55e', bg: '#052e16' },
  DEFAULT:      { label: 'IN QUEUE',       sub: 'Waiting for the kitchen',           color: '#64748b', bg: '#0f0f0f' },
};

const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  const [order, setOrder]     = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrString, setQrString] = useState<string | null>(null);
  const qrGeneratedRef        = useRef(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  // ── Order Listener ───────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = listenToOrder(orderId, (data) => {
      setOrder(data);
      setLoading(false);
      if (!data) { setQrString(null); return; }

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
              } catch (_) {}
            })();
          } catch (_) { setQrString(null); }
        }
      } else {
        setQrString(null);
      }
    });
    return unsub;
  }, [orderId]);

  // ── Pickup Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    const isCollecting = order?.pickupWindow?.status === 'COLLECTING';
    const endTime = order?.pickupWindow?.endTime;
    if (!isCollecting || !endTime) { setTimeLeft(null); return; }

    const tick = () => {
      const diff = endTime - Date.now();
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
  const prevFlow = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (order?.serveFlowStatus === 'READY' && prevFlow.current !== 'READY') {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
    prevFlow.current = order?.serveFlowStatus;
  }, [order?.serveFlowStatus]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#080808]">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#080808] p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-white font-black">Order not found.</p>
        <button onClick={onBack} className="mt-6 text-white/40 text-sm underline">Go Back</button>
      </div>
    );
  }

  // ── Terminal States ──────────────────────────────────────────────────────
  const uiState   = getOrderUIState(order);
  const isAbandoned = uiState === 'ABANDONED';
  const isRejected  = order.orderStatus === 'REJECTED';

  if (isRejected || isAbandoned) {
    return (
      <div className="h-screen w-full flex flex-col bg-[#080808] max-w-md mx-auto px-8">
        <div className="pt-10 pb-4">
          <button onClick={onBack} className="p-3 rounded-2xl bg-white/5 border border-white/10 active:scale-90 transition-all">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-8 ${isRejected ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
            <XCircle className={`w-10 h-10 ${isRejected ? 'text-red-500' : 'text-amber-500'}`} />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter mb-3">
            {isRejected ? 'Order Rejected' : 'Order Abandoned'}
          </h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs">
            {isRejected
              ? 'The kitchen could not process this order. Contact the cashier for a refund.'
              : 'Pickup window was missed multiple times. This token is expired.'}
          </p>
          <button onClick={onBack} className="mt-10 w-full py-5 rounded-3xl bg-white text-black font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
            Return to Menu
          </button>
        </div>
      </div>
    );
  }

  // ── Derive Status ────────────────────────────────────────────────────────
  const flow = order.serveFlowStatus || 'DEFAULT';
  const isMissed  = uiState === 'MISSED';
  const isServed  = order.orderStatus === 'SERVED';
  const isReady   = flow === 'READY' && !isMissed;

  const statusKey = isServed ? 'SERVED' : isMissed ? 'MISSED' : (STATUS_CONFIG as any)[flow] ? flow : 'DEFAULT';
  const { label, sub, color, bg } = (STATUS_CONFIG as any)[statusKey] || STATUS_CONFIG.DEFAULT;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full max-w-md mx-auto flex flex-col font-sans"
      style={{ background: '#080808', color: '#fff' }}
    >
      {/* ── Header: back + order ID ── */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl active:scale-90 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <span className="text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          #{order.id.slice(-6).toUpperCase()}
        </span>
      </div>

      {/* ── Status Line ── */}
      <div className="px-6 pb-1 text-center">
        <p
          className="text-[11px] font-black uppercase tracking-[0.4em]"
          style={{ color }}
        >
          {label}
        </p>
      </div>

      {/* ── Timer (READY only) ── */}
      {isReady && timeLeft && (
        <div className="text-center pb-2">
          <span
            className="text-5xl font-black font-mono tracking-tighter"
            style={{ color }}
          >
            {timeLeft}
          </span>
        </div>
      )}

      {/* ── QR Code Block (~70% of screen) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div
          className="w-full aspect-square max-w-[340px] rounded-[3rem] flex items-center justify-center relative"
          style={{
            background: bg,
            border: `2px solid ${color}22`,
            boxShadow: isReady ? `0 0 80px ${color}30` : 'none',
            transition: 'box-shadow 0.8s ease',
          }}
        >
          {/* Ready pulse ring */}
          {isReady && (
            <div
              className="absolute inset-0 rounded-[3rem] animate-ping"
              style={{ border: `2px solid ${color}`, opacity: 0.15 }}
            />
          )}

          <div className="p-6 bg-white rounded-[2.5rem] shadow-2xl relative">
            {qrString
              ? <QRCodeSVG value={qrString} size={240} level="H" />
              : <div className="w-60 h-60 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color }} />
                </div>
            }

            {/* Served checkmark overlay */}
            {isServed && (
              <div className="absolute inset-0 rounded-[2.5rem] bg-white/90 flex items-center justify-center">
                <CheckCircle2 className="w-20 h-20 text-green-500" />
              </div>
            )}
          </div>
        </div>

        {/* ── Instruction Line ── */}
        <p
          className="mt-6 text-[11px] font-black uppercase tracking-[0.35em] text-center"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          {sub}
        </p>
      </div>

      {/* ── Item Served Indicators (compact, bottom) ── */}
      <div className="px-6 pb-4 space-y-2">
        {order.items.map((item, idx) => {
          const rem  = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
          const done = rem <= 0;
          return (
            <div
              key={idx}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: done ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${done ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)'}`,
                opacity: done ? 0.5 : 1,
              }}
            >
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <span className="flex-1 text-sm font-black tracking-tight truncate">{item.name}</span>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: done ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                {done ? '✓ served' : `×${item.quantity}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Bottom Action ── */}
      <div className="px-6 pb-10">
        <button
          onClick={() => onViewOrders ? onViewOrders() : onBack()}
          className="w-full py-4 rounded-3xl font-black text-xs uppercase tracking-[0.35em] active:scale-95 transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          View All Orders
        </button>
      </div>
    </div>
  );
};

export default QRView;
