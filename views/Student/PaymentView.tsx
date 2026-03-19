import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, CreditCard, Smartphone, Landmark, Banknote, ShieldCheck, Loader2, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { UserProfile, CartItem } from '../../types';
import { createOrder, listenToOrder, getOrder, getOrderingEnabled } from '../../services/firestore-db';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface PaymentViewProps {
  profile: UserProfile | null;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

const PaymentView: React.FC<PaymentViewProps> = ({ profile, onBack, onSuccess }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [state, setState] = useState<'IDLE' | 'PROCESSING' | 'CASH_WAITING' | 'REJECTED' | 'SUCCESS'>('IDLE');
  const [selectedMethod, setSelectedMethod] = useState<string>('UPI');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'PENDING' | 'APPROVED' | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string>('');
  const [orderingDisabled, setOrderingDisabled] = useState<boolean>(false);
  const [arrivalTime, setArrivalTime] = useState<number | null>(null);

  useEffect(() => {
    const savedCart = localStorage.getItem('joe_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Cart parse error", e);
      }
    }
  }, []);

  useEffect(() => {
    getOrderingEnabled().then((enabled) => setOrderingDisabled(!enabled)).catch(() => setOrderingDisabled(false));
  }, []);
  
  useEffect(() => {
    if (state === 'CASH_WAITING' && orderId) {
      let hasNavigated = false;
      const unsubscribe = listenToOrder(orderId, (order) => {
        if (order) {
          if (order.paymentStatus === 'SUCCESS' && order.qrStatus === 'ACTIVE') {
            setOrderStatus('APPROVED');
          } else if (order.paymentStatus === 'PENDING') {
            setOrderStatus('PENDING');
          }
        }
        
        // For cash waiting, we still auto-navigate to QR once approved because it's a "gate"
        if (order && order.paymentStatus === 'SUCCESS' && order.qrStatus === 'ACTIVE' && !hasNavigated) {
          hasNavigated = true;
          onSuccess(orderId);
          return;
        }

        if (order && order.paymentStatus === 'REJECTED' && !hasNavigated) {
          hasNavigated = true;
          setOrderStatus(null);
          setRejectionMessage('Your payment was rejected by the cashier.');
          setState('REJECTED');
          setTimeout(() => onBack(), 3000);
        }
      });
      return unsubscribe;
    }
  }, [state, orderId, onSuccess, onBack]);

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const isDynamic = cart.some(it => it.orderType === 'PREPARATION_ITEM');

  const slots = useMemo(() => {
    const s = [];
    const now = new Date();
    let current = new Date(now);
    current.setMinutes(Math.ceil(current.getMinutes() / 15) * 15, 0, 0);
    current.setMinutes(current.getMinutes() + 15);

    for (let i = 0; i < 12; i++) {
        const h = current.getHours();
        const m = current.getMinutes();
        const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const value = h * 100 + m;
        s.push({ label, value });
        current.setMinutes(current.getMinutes() + 15);
    }
    return s;
  }, []);

  const handlePayment = async () => {
    if (state === 'PROCESSING') return;
    setState('PROCESSING');

    try {
      const isCash = selectedMethod === 'CASH';
      // Use a stable guest ID for this session to avoid creating a new guest on
      // every click. Persisted in sessionStorage so a refresh still deduplicates.
      let guestId = profile?.uid;
      if (!guestId) {
        const stored = sessionStorage.getItem('joe_guest_id');
        if (stored) {
          guestId = stored;
        } else {
          guestId = `guest_${Math.random().toString(36).substr(2, 12)}`;
          sessionStorage.setItem('joe_guest_id', guestId);
        }
      }
      const guestName = profile?.name || 'Guest';

      // Stable idempotency key: same user + same cart total + same payment method
      // + same arrival slot won't create a duplicate order within the same session.
      // Using a hash of stable fields prevents double-click AND page-refresh duplicates.
      const cartFingerprint = cart.map(i => `${i.id}:${i.quantity}`).sort().join(',');
      const idempotencyKey = `idemp_${guestId}_${total}_${selectedMethod}_${isDynamic ? arrivalTime : 0}_${cartFingerprint}`
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .slice(0, 100); // Firestore doc IDs max 1500 bytes, we stay well under

      const newOrderId = await createOrder({
        userId: guestId,
        userName: guestName,
        items: cart,
        totalAmount: total,
        paymentType: selectedMethod as any,
        paymentStatus: isCash ? 'PENDING' : 'SUCCESS',
        arrivalTime: isDynamic ? (arrivalTime ?? undefined) : undefined,
        orderStatus: 'PENDING',
        qrStatus: isCash ? 'PENDING_PAYMENT' : 'ACTIVE',
        cafeteriaId: 'MAIN_CAFE',
        idempotencyKey
      });

      setOrderId(newOrderId);
      localStorage.removeItem('joe_cart');
      
      // Navigate to QR View / Manifest immediately so user sees "Awaiting Cashier"
      onSuccess(newOrderId);
    } catch (err: any) {
      setState('IDLE');
      alert(err?.message || 'Payment failed. Please try again.');
    }
  };

  const handleCancelOrder = async () => {
    if (orderId) {
       try {
         // Only update orderStatus — the rule for update only checks
         // that staff OR owner-updates-notifiedAt. Cancel is a staff action
         // in the strict model, but the customer is explicitly waiting for
         // cash and should be able to cancel their own pending-payment order.
         // The order rule allows staff update; for now we attempt it and
         // navigate back either way.
         await updateDoc(doc(db, 'orders', orderId), {
           orderStatus: 'CANCELLED',
           paymentStatus: 'REJECTED'
         });
       } catch (err) {
         // Non-fatal: cashier can also cancel at the counter
         console.warn('Could not auto-cancel order:', err);
       }
    }
    // Always navigate back regardless of cancel success
    onBack();
  };

  const methods = [
    { id: 'UPI', name: 'UPI Pay', icon: Smartphone, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { id: 'CARD', name: 'Debit/Credit Card', icon: CreditCard, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'NET', name: 'Net Banking', icon: Landmark, color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { id: 'CASH', name: 'Pay with Cash', icon: Banknote, color: 'bg-amber-50 text-amber-600 border-amber-100' }
  ];

  if (state === 'SUCCESS') {
    return (
      <div className="h-screen bg-white flex flex-col max-w-md mx-auto p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-success/10 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-success/10">
                <CheckCircle2 className="w-12 h-12 text-success" />
            </div>
            <h2 className="text-3xl font-black text-textMain mb-4 tracking-tighter">Payment Success!</h2>
            <p className="text-textSecondary mb-10 text-lg font-medium">Your order has been placed and is being processed.</p>
            
            <div className="w-full space-y-4">
              <button 
                onClick={() => orderId && onSuccess(orderId)}
                className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all text-lg"
              >
                Show Meal Token <ChevronRight className="w-6 h-6" />
              </button>
              
              <button 
                onClick={onBack}
                className="w-full bg-gray-50 text-textSecondary font-black py-5 rounded-2xl border border-black/5 active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                Back to Menu
              </button>
            </div>
        </div>
      </div>
    );
  }

  if (state === 'CASH_WAITING') {
      return (
          <div className="h-screen bg-white flex flex-col max-w-md mx-auto p-6 text-center animate-in fade-in duration-500">
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Clock className="w-10 h-10 text-amber-600" />
                  </div>
                  <h2 className="text-2xl font-black text-textMain mb-2">Awaiting Cash Payment</h2>
                  <p className="text-textSecondary mb-8">Please pay <span className="text-primary font-black">₹{total}</span> at the counter to activate your order.</p>
                  
                  <div className="w-full bg-gray-50 rounded-2xl p-4 border border-black/5 text-left">
                      <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest mb-1">Status</p>
                      <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                          <p className="text-sm font-bold text-textMain">{orderStatus === 'PENDING' ? 'Waiting for Cashier...' : 'Order Placed'}</p>
                      </div>
                  </div>
              </div>
              <button 
                onClick={handleCancelOrder}
                className="w-full py-4 text-textSecondary font-bold"
              >
                  Cancel Order
              </button>
          </div>
      );
  }

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col max-w-md mx-auto">
      <header className="p-4 bg-white flex items-center gap-4 border-b border-black/5">
        <button onClick={onBack} className="p-2 -ml-2 text-textMain"><ChevronLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-black text-textMain">Checkout</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {isDynamic && (
            <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-black text-textMain">Arrival Time</h2>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {slots.map(slot => (
                        <button
                            key={slot.value}
                            onClick={() => setArrivalTime(slot.value)}
                            className={`py-2 rounded-xl text-xs font-black border-2 transition-all ${
                                arrivalTime === slot.value 
                                ? 'bg-primary border-primary text-white shadow-lg' 
                                : 'bg-gray-50 border-transparent text-textSecondary hover:bg-gray-100'
                            }`}
                        >
                            {slot.label}
                        </button>
                    ))}
                </div>
            </div>
        )}

        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-4">Payment Method</h3>
            <div className="space-y-3">
              {methods.map(method => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                    selectedMethod === method.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-transparent bg-gray-50'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${method.color}`}>
                    <method.icon className="w-5 h-5" />
                  </div>
                  <span className={`font-black ${selectedMethod === method.id ? 'text-primary' : 'text-textMain'}`}>{method.name}</span>
                  {selectedMethod === method.id && <div className="ml-auto w-5 h-5 bg-primary rounded-full flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
                </button>
              ))}
            </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-black/5 z-20 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4 px-2">
            <span className="text-sm font-bold text-textSecondary uppercase tracking-widest">Total Payable</span>
            <span className="text-2xl font-black text-textMain">₹{total}</span>
        </div>
        <button 
          disabled={state === 'PROCESSING' || (isDynamic && !arrivalTime)}
          onClick={handlePayment}
          className="w-full h-16 bg-textMain text-white rounded-2xl font-black flex items-center justify-between px-8 shadow-xl active:scale-95 transition-all disabled:opacity-50"
        >
          <span>{state === 'PROCESSING' ? 'Processing...' : (selectedMethod === 'CASH' ? 'Place Order' : 'Pay Now')}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default PaymentView;
