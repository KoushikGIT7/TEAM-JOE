import React, { useState, useEffect } from 'react';
import { ChevronLeft, Smartphone, Banknote, ChevronRight, CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { UserProfile, CartItem } from '../../types';
import { createOrder, listenToOrder, getOrderingEnabled } from '../../services/firestore-db';
import { doc, serverTimestamp } from 'firebase/firestore';
import { joeSounds } from '../../utils/audio';
import { sonicVoice } from '../../services/voice-engine';
import { deductWalletForOrder, listenToWalletSummary } from '../../services/wallet';

/** Generate a local order ID instantly (same format as firestore-db.ts) */
const genLocalOrderId = () => 'order_' + Math.random().toString(36).substr(2, 9);

interface PaymentViewProps {
  profile: UserProfile | null;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

const UPI_PA = 'fcgtub@oksbi';
const UPI_PN = 'JOE Cafeteria';

const PaymentView: React.FC<PaymentViewProps> = ({ profile, onBack, onSuccess }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [state, setState] = useState<'IDLE' | 'PROCESSING' | 'WAITING' | 'SUCCESS'>('IDLE');
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'CASH' | 'WALLET'>('UPI');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderingDisabled, setOrderingDisabled] = useState(false);
  const [activeAttemptKey] = useState(() => `idemp_${profile?.uid || 'guest'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('joe_cart');
    if (saved) { try { setCart(JSON.parse(saved)); } catch {} }
  }, []);

  useEffect(() => {
    getOrderingEnabled().then(e => setOrderingDisabled(!e)).catch(() => setOrderingDisabled(false));
  }, []);

  // Real-time wallet balance for authenticated students
  useEffect(() => {
    if (!profile?.uid || profile.role === 'GUEST') return;
    return listenToWalletSummary(profile.uid, (s) => setWalletBalance(s.walletBalance));
  }, [profile?.uid, profile?.role]);

  // Restore orphaned session
  useEffect(() => {
    const savedId = localStorage.getItem('activeOrderId');
    if (savedId && !orderId) { setOrderId(savedId); setState('WAITING'); }
  }, [orderId]);

  // Listen for cashier approval — CASH only
  useEffect(() => {
    if (!orderId || selectedMethod !== 'CASH') return;
    let navigated = false;
    const unsub = listenToOrder(orderId, (order) => {
      if (!order) return;
      if (order.paymentStatus === 'VERIFIED' || order.paymentStatus === 'SUCCESS') {
        localStorage.removeItem('activeOrderId');
        joeSounds.playPaymentConfirmed();
        sonicVoice.announceOrderComplete();
        if (!navigated) { navigated = true; onSuccess(orderId); }
      }
      if ((order.paymentStatus === 'REJECTED' || order.orderStatus === 'REJECTED') && !navigated) {
        localStorage.removeItem('activeOrderId');
        setOrderId(null);
        setState('IDLE');
      }
    });
    return unsub;
  }, [orderId, selectedMethod, onSuccess]);

  const total = cart.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const isWalletSufficient = walletBalance >= total;
  const isGuestUser = !profile?.uid || profile.role === 'GUEST';

  const handlePayment = async () => {
    if (state === 'PROCESSING') return;
    setWalletError(null);

    // ─── WALLET PAYMENT ────────────────────────────────────────────────────────
    if (selectedMethod === 'WALLET') {
      if (!profile?.uid) { setWalletError('Please sign in to use wallet'); return; }
      if (!isWalletSufficient) { setWalletError(`Insufficient balance. Available: ₹${walletBalance}`); return; }

      setState('PROCESSING');
      const optimisticOrderId = genLocalOrderId();
      try {
        // 1. Deduct wallet atomically (throws if balance insufficient)
        await deductWalletForOrder(profile.uid, total, optimisticOrderId);

        // 2. Build order payload (paymentStatus: SUCCESS — already paid from wallet)
        const orderPayload = {
          id: optimisticOrderId,
          userId: profile.uid,
          userName: profile.name || 'Student',
          items: cart,
          totalAmount: total,
          paymentType: 'WALLET' as any,
          paymentStatus: 'SUCCESS',
          queueStatus: 'NOT_IN_QUEUE',
          orderStatus: 'PENDING',
          qrStatus: 'ACTIVE',
          cafeteriaId: 'MAIN_CAFE',
          idempotencyKey: activeAttemptKey,
          createdAt: Date.now(),
        };

        localStorage.removeItem('joe_cart');
        sessionStorage.setItem('joe_optimistic_order', JSON.stringify(orderPayload));

        joeSounds.stopAll();
        joeSounds.playPaymentConfirmed();

        // 3. Commit to Firestore in background — UI already moved on
        createOrder(orderPayload as any).catch((e) => {
          console.warn('[WALLET-ORDER] Background order write failed:', e);
        });

        onSuccess(optimisticOrderId);
      } catch (err: any) {
        setState('IDLE');
        setWalletError(err.message || 'Wallet payment failed. Please try again.');
      }
      return;
    }

    // ─── UPI / CASH (unchanged original logic) ─────────────────────────────────
    const guestId = profile?.uid || (() => {
      const s = sessionStorage.getItem('joe_guest_id') || `guest_${Math.random().toString(36).substr(2, 12)}`;
      sessionStorage.setItem('joe_guest_id', s); return s;
    })();

    const optimisticOrderId = genLocalOrderId();
    localStorage.setItem('activeOrderId', optimisticOrderId);
    localStorage.removeItem('joe_cart');

    if (selectedMethod === 'UPI') {
      // UPI: play sound + open UPI app + go to QR screen — zero wait
      joeSounds.stopAll();
      joeSounds.playPaymentConfirmed();
      try {
        // Only trigger UPI deep link on mobile devices to prevent desktop console errors
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            const q = `?pa=${UPI_PA}&pn=${encodeURIComponent(UPI_PN)}&am=${total}&cu=INR`;
            const a = document.createElement('a');
            a.href = `upi://pay${q}`;
            a.click();
        }
      } catch (_) {}
      localStorage.removeItem('activeOrderId');

      const optimisticOrderPayload = {
        id: optimisticOrderId, // <-- FIXED: ensure Firestore uses the same ID UI is listening to
        userId: guestId,
        userName: profile?.name || 'Guest',
        items: cart,
        totalAmount: total,
        paymentType: 'UPI',
        paymentStatus: 'SUCCESS',
        queueStatus: 'NOT_IN_QUEUE',
        orderStatus: 'PENDING',
        qrStatus: 'ACTIVE',
        cafeteriaId: 'MAIN_CAFE',
        idempotencyKey: activeAttemptKey,
        createdAt: Date.now()
      };

      // ⚡ INSTANT HYDRATION: Save to sessionStorage so QRView renders with 0ms delay
      sessionStorage.setItem('joe_optimistic_order', JSON.stringify(optimisticOrderPayload));

      // 🔥 Commit to Firestore in background — UI already moved on
      createOrder(optimisticOrderPayload as any).catch(e => {
          console.warn('[OPTIMISTIC] Background UPI order write failed:', e);
          alert('Failed to process order on server: ' + (e.message || 'Unknown error'));
      });
      
      onSuccess(optimisticOrderId);
      return;
    }

    // CASH: show WAITING screen instantly, commit in background
    joeSounds.stopAll();
    joeSounds.playOrderPlaced();
    setOrderId(optimisticOrderId);
    setState('WAITING');

    // 🔥 Background commit — WAITING screen is already visible
    createOrder({
      id: optimisticOrderId, // <-- FIXED: ensure Firestore uses the same ID UI is listening to
      userId: guestId,
      userName: profile?.name || 'Guest',
      items: cart,
      totalAmount: total,
      paymentType: 'CASH',
      paymentStatus: 'AWAITING_CONFIRMATION',
      queueStatus: 'NOT_IN_QUEUE',
      orderStatus: 'PENDING',
      cashRequestedAt: serverTimestamp(),
      qrStatus: 'PENDING_PAYMENT',
      cafeteriaId: 'MAIN_CAFE',
      idempotencyKey: activeAttemptKey,
    } as any)
      .then(confirmedId => {
        // Swap to real Firestore ID once available (usually <2s, but UI already shown)
        localStorage.setItem('activeOrderId', confirmedId);
        setOrderId(confirmedId);
      })
      .catch(err => {
        // Firestore failed — roll back to IDLE and show error
        localStorage.removeItem('activeOrderId');
        setOrderId(null);
        setState('IDLE');
        alert(err?.message || 'Order failed. Please try again.');
      });
  };

  const handleCancel = async () => {
    if (orderId) {
      try {
        const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
        const { db } = await import('../../firebase');
        await updateDoc(firestoreDoc(db, 'orders', orderId), { orderStatus: 'CANCELLED', paymentStatus: 'REJECTED' });
      } catch {}
    }
    localStorage.removeItem('activeOrderId');
    onBack();
  };

  // ── WAITING STATE ──────────────────────────────────────────────────────────
  if (state === 'WAITING') {
    return (
      <div className="h-screen bg-white flex flex-col w-full max-w-md mx-auto p-8 overflow-hidden border-x border-slate-50">
        <div className="flex-1 flex flex-col items-center justify-center gap-8">

          {/* Animated waiting badge */}
          <div className="relative">
            <div className="w-40 h-40 rounded-[3.5rem] bg-gray-50 border-4 border-gray-100 flex flex-col items-center justify-center shadow-2xl shadow-black/5">
              {selectedMethod === 'UPI'
                ? <Smartphone className="w-14 h-14 text-blue-500 mb-2" />
                : <Banknote className="w-14 h-14 text-amber-500 mb-2" />
              }
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                {selectedMethod === 'UPI' ? 'UPI' : 'CASH'}
              </span>
            </div>
            <div className="absolute inset-0 border-4 border-blue-300 rounded-[3.5rem] animate-ping opacity-20" />
          </div>

          {/* Amount */}
          <div className="bg-gray-900 text-white px-10 py-4 rounded-2xl">
            <span className="text-4xl font-black italic">₹{total}</span>
          </div>

          {/* Status message */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              {selectedMethod === 'UPI' ? 'Awaiting Cashier Confirmation' : 'Visit the Cash Counter'}
            </h2>
            <p className="text-gray-400 font-medium text-sm leading-relaxed max-w-[280px] mx-auto">
              {selectedMethod === 'UPI'
                ? 'Pay via UPI and wait for staff to confirm your payment.'
                : 'Show your order reference to the cashier and pay cash.'}
            </p>
          </div>

          {/* Order reference */}
          {orderId && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl px-8 py-4 text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Order Reference</p>
              <p className="text-2xl font-black text-gray-900 tracking-widest">#{orderId.slice(-6).toUpperCase()}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">Waiting for confirmation...</span>
          </div>
        </div>

        <button
          onClick={handleCancel}
          className="w-full py-4 text-xs font-black uppercase tracking-widest text-gray-300 active:scale-95 transition-all"
        >
          Cancel Order
        </button>
      </div>
    );
  }

  // ── CHECKOUT (IDLE / PROCESSING) ───────────────────────────────────────────
  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col w-full max-w-md mx-auto border-x border-slate-50 relative">

      {/* Header */}
      <header className="px-5 py-5 bg-white flex items-center gap-4 border-b border-black/5">
        <button onClick={onBack} className="p-2.5 bg-gray-50 rounded-2xl border border-gray-100 active:scale-95 transition-all">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h2 className="text-xl font-black text-gray-900">Checkout</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-40">

        {/* Cart Summary */}
        <div className="bg-white rounded-[2rem] p-6 border border-black/5 shadow-sm">
          <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Your Order</h3>
          <div className="space-y-3">
            {cart.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{item.name}</p>
                    <p className="text-[10px] font-bold text-gray-400">×{item.quantity} · ₹{item.price} each</p>
                  </div>
                </div>
                <p className="text-sm font-black text-gray-900">₹{item.price * item.quantity}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Total</span>
            <span className="text-xl font-black text-gray-900">₹{total}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-[2rem] p-6 border border-black/5 shadow-sm">
          <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Payment Method</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">

            <button
              onClick={() => setSelectedMethod('UPI')}
              className={`flex flex-col items-center gap-3 p-5 rounded-[1.5rem] border-2 transition-all active:scale-95 ${
                selectedMethod === 'UPI'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedMethod === 'UPI' ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <Smartphone className={`w-6 h-6 ${selectedMethod === 'UPI' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-black ${selectedMethod === 'UPI' ? 'text-blue-600' : 'text-gray-700'}`}>UPI Pay</p>
                <p className="text-[9px] font-bold text-gray-400 mt-0.5">PhonePe · GPay</p>
              </div>
              {selectedMethod === 'UPI' && <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
            </button>

            <button
              onClick={() => setSelectedMethod('CASH')}
              className={`flex flex-col items-center gap-3 p-5 rounded-[1.5rem] border-2 transition-all active:scale-95 ${
                selectedMethod === 'CASH'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedMethod === 'CASH' ? 'bg-amber-500' : 'bg-gray-200'}`}>
                <Banknote className={`w-6 h-6 ${selectedMethod === 'CASH' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-black ${selectedMethod === 'CASH' ? 'text-amber-600' : 'text-gray-700'}`}>Cash</p>
                <p className="text-[9px] font-bold text-gray-400 mt-0.5">Pay at counter</p>
              </div>
              {selectedMethod === 'CASH' && <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
            </button>

          </div>

          {/* JOE Wallet option — full-width row */}
          {!isGuestUser && (
            <button
              onClick={() => setSelectedMethod('WALLET')}
              disabled={!isWalletSufficient}
              className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                selectedMethod === 'WALLET'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedMethod === 'WALLET' ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                  <Wallet className={`w-6 h-6 ${selectedMethod === 'WALLET' ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-black ${selectedMethod === 'WALLET' ? 'text-emerald-700' : 'text-gray-700'}`}>JOE Wallet</p>
                  <p className="text-[9px] font-bold mt-0.5">
                    {isWalletSufficient ? (
                      <span className="text-emerald-600">Balance: ₹{walletBalance} — Sufficient</span>
                    ) : (
                      <span className="text-red-500">Balance: ₹{walletBalance} — Insufficient</span>
                    )}
                  </p>
                </div>
              </div>
              {selectedMethod === 'WALLET' && <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
            </button>
          )}

          {/* Wallet error */}
          {walletError && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              <p className="text-xs font-bold text-red-600">{walletError}</p>
            </div>
          )}
        </div>

        {orderingDisabled && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center">
            <p className="text-xs font-black text-red-500 uppercase tracking-widest">Ordering is currently disabled</p>
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-5 bg-white/95 backdrop-blur-xl border-t border-black/5 z-20">
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payable</span>
          <span className="text-3xl font-black text-gray-900">₹{total}</span>
        </div>
        <button
          disabled={orderingDisabled || state === 'PROCESSING'}
          onClick={handlePayment}
          className="w-full h-16 bg-gray-900 text-white rounded-[1.5rem] font-black flex items-center justify-between px-8 shadow-xl active:scale-95 transition-all disabled:opacity-40"
        >
          <span className="text-sm uppercase tracking-widest">
            {state === 'PROCESSING' ? 'Processing...' : selectedMethod === 'CASH' ? 'Place Order' : selectedMethod === 'WALLET' ? 'Pay with Wallet' : 'Pay with UPI'}
          </span>
          {state === 'PROCESSING' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default PaymentView;
