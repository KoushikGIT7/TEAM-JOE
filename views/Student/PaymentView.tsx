import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, CreditCard, Smartphone, Landmark, Banknote, ShieldCheck, Loader2, CheckCircle2, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import { UserProfile, CartItem } from '../../types';
import { createOrder, listenToOrder, getOrder, getOrderingEnabled } from '../../services/firestore-db';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { submitOrderUTR } from '../../services/firestore-db';
import { QRCodeSVG } from 'qrcode.react';


interface PaymentViewProps {
  profile: UserProfile | null;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

const UPI_PA = 'fcgtub@oksbi';
const UPI_PN = 'JOE Cafeteria';

const generateSecureUPILinks = (id: string, amt: number) => {
  const shortId = id.slice(-4).toUpperCase();
  const tn = encodeURIComponent(`ORD-${shortId}`);
  const pn = encodeURIComponent(UPI_PN);
  // 🛡️ [SECURE & CLEAN UPI INTENT] 
  // We remove 'tn' (note) because many banks flag intent links with custom notes 
  // as security risks for new merchant accounts.
  const query = `?pa=${UPI_PA}&pn=${pn}&am=${amt}&cu=INR`;
  
  return {
    generic: `upi://pay${query}`,
    phonepe: `phonepe://pay${query}`,
    gpay: `upi://pay${query}`, 
    paytm: `paytmmp://pay${query}`
  };
};

const PaymentView: React.FC<PaymentViewProps> = ({ profile, onBack, onSuccess }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [state, setState] = useState<'IDLE' | 'PROCESSING' | 'CASH_WAITING' | 'REJECTED' | 'SUCCESS'>('IDLE');
  const [selectedMethod, setSelectedMethod] = useState<string>('UPI');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<'PENDING' | 'APPROVED' | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string>('');
  const [orderingDisabled, setOrderingDisabled] = useState<boolean>(false);
  const [arrivalTime, setArrivalTime] = useState<number | null>(null);
  const [utr, setUtr] = useState<string>('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState<boolean>(false);
  const [payStatus, setPayStatus] = useState<string>('INITIATED');
  const [timer, setTimer] = useState<number>(60);
  const [showManualUtr, setShowManualUtr] = useState<boolean>(false);

  useEffect(() => {
    let interval: any;
    if (state === 'CASH_WAITING' && timer > 0 && selectedMethod === 'UPI') {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [state, timer, selectedMethod]);

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
          setPayStatus(order.paymentStatus);
          if (order.paymentStatus === 'SUCCESS' && order.qrStatus === 'ACTIVE') {
            setOrderStatus('APPROVED');
          } else if (order.paymentStatus === 'UTR_SUBMITTED' || order.paymentStatus === 'PENDING') {
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

  const handleUTRSubmit = async () => {
    if (!orderId || utr.length < 4) return;
    setIsSubmittingUtr(true);
    try {
      await submitOrderUTR(orderId, utr);
      // Logic handles the move to UTR_SUBMITTED
    } catch (err: any) {
      alert(err.message || 'Verification failed. Contact staff.');
    } finally {
      setIsSubmittingUtr(false);
    }
  };

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

  // 🛡️ RE-ORDERING ROOT FIX:
  // We use a state-locked attempt key. It stays the same during a single 'Processing' 
  // attempt to block double-clicks, but it is guaranteed to be unique for every 
  // fresh checkout session because it is initialized with the current millisecond.
  const [activeAttemptKey] = useState(() => `idemp_${profile?.uid || 'guest'}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);

  const handlePayment = async () => {
    if (state === 'PROCESSING') return;
    setState('PROCESSING');

    try {
      // 🛡️ [SONIC-PAY] UI Logic
      const isUPI = selectedMethod === 'UPI';
      const isCash = selectedMethod === 'CASH';
      const idempotencyKey = activeAttemptKey;

      // 🛑 Restriction: Max 1 Plate Meal per order
      const plateMealQty = cart
        .filter(it => it.category === 'Lunch')
        .reduce((sum, it) => sum + it.quantity, 0);
      
      if (plateMealQty > 1) {
        throw new Error("Restriction: Only 1 Plate Meal (Lunch) is allowed per person.");
      }

      // 👤 Identify Guest/User
      let guestId = profile?.uid;
      if (!guestId) {
        const stored = sessionStorage.getItem('joe_guest_id');
        guestId = stored || `guest_${Math.random().toString(36).substr(2, 12)}`;
        if (!stored) sessionStorage.setItem('joe_guest_id', guestId);
      }
      const guestName = profile?.name || 'Guest';

      const newOrderId = await createOrder({
        userId: guestId,
        userName: guestName,
        items: cart,
        totalAmount: total,
        paymentType: selectedMethod as any,
        paymentStatus: 'PENDING', 
        arrivalTime: isDynamic ? (arrivalTime ?? undefined) : undefined,
        orderStatus: 'PENDING',
        qrStatus: 'PENDING_PAYMENT',     // Correct type: waiting for cashier/UPISync
        cafeteriaId: 'MAIN_CAFE',
        idempotencyKey
      });

      setOrderId(newOrderId);
      localStorage.removeItem('joe_cart');
      
      // Move to the waiting/sync screen to allow real payment
      setState('CASH_WAITING');
      return;
      
    } catch (err: any) {
      console.error("Payment Flow Failed:", err);
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
      const isUPI = selectedMethod === 'UPI';
      const shortId = orderId?.slice(-4).toUpperCase();
      
      return (
          <div className="h-screen bg-white flex flex-col max-w-md mx-auto p-8 text-center animate-in fade-in duration-500 overflow-y-auto">
              <div className="flex-1 flex flex-col items-center justify-center">
                  {/* 🟢 TOP LAYER: VERIFICATION RADIUS */}
                  <div className="relative mb-12">
                     <div className={`w-48 h-48 rounded-[4rem] border-4 flex flex-col items-center justify-center transition-all duration-700 ${
                        orderStatus === 'APPROVED' ? 'bg-emerald-50 border-emerald-500 shadow-2xl shadow-emerald-500/10' :
                        'bg-slate-50 border-slate-200'
                     }`}>
                        {orderStatus === 'APPROVED' ? (
                           <div className="animate-in zoom-in duration-500 flex flex-col items-center">
                              <CheckCircle2 className="w-16 h-16 text-emerald-600 mb-2" />
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                           </div>
                        ) : (
                           <div className="flex flex-col items-center">
                              <span className="text-4xl font-black text-slate-900 tracking-tighter mb-1 select-all italic">#{shortId}</span>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Ref</span>
                           </div>
                        )}
                        
                        {/* 🟡 PULSE RING */}
                        {orderStatus !== 'APPROVED' && isUPI && (
                           <div className="absolute inset-0 border-[6px] border-emerald-500 rounded-[4rem] animate-ping opacity-10" />
                        )}
                     </div>
                     
                     {/* 💰 FLOATING PRICE TAG */}
                     <div className="absolute -bottom-4 bg-slate-900 text-white px-6 py-2 rounded-2xl shadow-xl border border-white/10">
                        <span className="text-lg font-black italic">₹{total}</span>
                     </div>
                  </div>

                  {/* 🟢 MIDDLE LAYER: STATUS & FEEDBACK */}
                  <div className="max-w-xs space-y-4 mb-10">
                    <h2 className="text-2xl font-black text-slate-900 uppercase italic leading-none tracking-tighter">
                      {orderStatus === 'APPROVED' ? 'Success! Move forward' : (isUPI ? 'Automatic Syncing...' : 'Awaiting Cashier')}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      {orderStatus === 'APPROVED' 
                        ? 'Payment confirmed by bank. Your food is in preparation.'
                        : (isUPI ? `Checking for your ₹${total} transaction. Time remaining: ${timer}s` : 'Show your phone screen to the cashier for manual activation.')
                      }
                    </p>
                   {/* 🟢 BOTTOM LAYER: PERMANENT UTR SYNC */}
                   {isUPI && orderStatus !== 'APPROVED' && (
                     <div className="w-full space-y-6">
                        {payStatus === 'UTR_SUBMITTED' ? (
                           <div className="w-full bg-emerald-50 p-10 rounded-[3rem] border-2 border-emerald-100 flex flex-col items-center animate-in zoom-in duration-500 text-center">
                              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-200">
                                 <CheckCircle2 className="w-10 h-10 text-white" />
                              </div>
                              <h3 className="text-xl font-black text-emerald-900 uppercase italic mb-2 tracking-tighter">Reference Submitted</h3>
                              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest leading-relaxed">
                                Our system is verifying your ₹{total} payment. <br/>
                                This takes 10–60 seconds.
                              </p>
                              <div className="mt-8 flex items-center gap-2">
                                 <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                                 <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Waiting for Bank Sync</span>
                              </div>
                           </div>
                        ) : (
                           <div className="flex flex-col items-center gap-6 w-full">
                              {/* 🛡️ THE SCANNER: Only QR Code */}
                              <div className="w-full bg-white p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center animate-in zoom-in duration-500">
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8">Official QR Scanner</div>
                                 
                                 <div className="p-4 bg-white rounded-[2.5rem] border-4 border-slate-50 shadow-inner mb-8">
                                    <QRCodeSVG 
                                      value={generateSecureUPILinks(orderId || '', total).generic} 
                                      size={200} 
                                      level="H" 
                                      className="bg-white p-2"
                                    />
                                 </div>

                                 {/* 📱 SMART INSTRUCTIONS */}
                                 <div className="w-full bg-slate-50/80 p-5 rounded-2xl border border-slate-100 flex flex-col gap-2 mb-2">
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Smart Guide:</p>
                                    <div className="flex flex-col gap-1.5">
                                       <div className="flex items-center gap-3">
                                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] flex items-center justify-center font-black">1</div>
                                          <p className="text-[11px] font-bold text-slate-600">Take a Screenshot of this QR</p>
                                       </div>
                                       <div className="flex items-center gap-3">
                                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] flex items-center justify-center font-black">2</div>
                                          <p className="text-[11px] font-bold text-slate-600">Open UPI App & Pay via Gallery</p>
                                       </div>
                                       <div className="flex items-center gap-3">
                                          <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] flex items-center justify-center font-black">3</div>
                                          <p className="text-[11px] font-bold text-slate-600">Enter your 4-digit Ref below</p>
                                       </div>
                                    </div>
                                 </div>
                                 <p className="text-[9px] font-black text-slate-200 uppercase tracking-widest mt-2">{UPI_PA}</p>
                              </div>

                              {/* 🏁 FINAL STEP: UTR SYNC */}
                              <div className="w-full bg-slate-900 p-8 rounded-[3rem] shadow-2xl shadow-slate-900/40 relative overflow-hidden">
                                 <div className="relative z-10">
                                    <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-6 text-center">Verify Transaction</p>
                                    <div className="relative mb-6">
                                       <input 
                                         type="text"
                                         maxLength={12}
                                         placeholder="LAST 4 DIGITS"
                                         className="w-full bg-white/10 border border-white/10 rounded-2xl px-6 py-5 text-center text-3xl font-mono font-black tracking-[0.3em] outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all text-white placeholder:text-white/20"
                                         value={utr}
                                         onChange={(e) => setUtr(e.target.value.replace(/\D/g, ''))}
                                       />
                                       {utr.length >= 4 && (
                                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 animate-in zoom-in"><ShieldCheck className="w-8 h-8" /></div>
                                       )}
                                    </div>
                                    <button 
                                      onClick={handleUTRSubmit}
                                      disabled={utr.length < 4 || isSubmittingUtr}
                                      className="w-full bg-emerald-500 text-white font-black py-6 rounded-2xl shadow-xl disabled:opacity-20 active:scale-95 transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-[0.3em] italic"
                                    >
                                       {isSubmittingUtr ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <CheckCircle2 className="w-6 h-6" />}
                                       CONFIRM PAYMENT
                                    </button>
                                 </div>
                                 <ShieldCheck className="absolute bottom-[-40px] right-[-40px] w-64 h-64 text-white/5 -rotate-12" />
                              </div>
                           </div>
                        )}
                     </div>
                   )}

                   {orderStatus === 'APPROVED' && (
                      <div className="w-full animate-in zoom-in duration-1000 delay-300">
                         <button 
                           onClick={() => orderId && onSuccess(orderId)}
                           className="w-full bg-emerald-600 text-white font-black py-6 rounded-2xl shadow-2xl shadow-emerald-900/40 flex items-center justify-center gap-4 active:scale-95 transition-all text-[12px] uppercase tracking-[0.3em]"
                         >
                           Show Meal QR <ChevronRight className="w-5 h-5" />
                         </button>
                      </div>
                   )}
                  </div>

                  {/* CANCEL OPS */}
                  <div className="mt-10 opacity-30">
                     <button onClick={handleCancelOrder} className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-1">Cancel Order Entry</button>
                  </div>
              </div>
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
