import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LogOut, ShoppingBag, Plus, Minus, Search, Loader2, 
  Menu, X as CloseIcon, User, Clock, ShieldCheck, 
  ChevronRight, MapPin, Coffee, ShoppingCart, Zap, CheckCircle2, AlertCircle, Sparkles, Image as ImageIcon,
  Bell, BellRing, Check
} from 'lucide-react';
import SmartImage from '../../components/Common/SmartImage';
import FoodLoader from '../../components/Common/FoodLoader';
import { UserProfile, MenuItem, CartItem, Order } from '../../types';
import { CATEGORIES, FAST_ITEM_CATEGORIES } from '../../constants';
import { getMenuOnce, listenToUserOrders, saveCartDraft, getQueueEstimate } from '../../services/firestore-db';
import { useInventory } from '../../hooks/useInventory';
import { useMotivationalHeadline } from '../../hooks/useMotivationalHeadline';
import MotivationalHeadline from '../../components/MotivationalHeadline';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import Logo from '../../components/Logo';
import { joeSounds } from '../../utils/audio';
import { syncOneSignal } from '../../services/onesignal-push';

interface HomeViewProps {
  profile: UserProfile | null;
  onProceed: () => void;
  onViewOrders?: () => void;
  onViewQR?: (orderId: string) => void;
  onLogout: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ profile, onProceed, onViewOrders, onViewQR, onLogout }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Breakfast');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState('');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [showRejectNotice, setShowRejectNotice] = useState(false);
  const [queueEstimate, setQueueEstimate] = useState<{ minutes: number; pendingCount: number } | null>(null);
  const [notifSubscribed, setNotifSubscribed] = useState(false);
  const [notifRinging, setNotifRinging] = useState(false);
  const [showPulsePopup, setShowPulsePopup] = useState(false);
  const { stockByItemId, isOutOfStock, canAddToCart } = useInventory();

  // 🔔 [FIRST-VISIT-POPUP] Show once per device
  useEffect(() => {
    const alreadySeen = localStorage.getItem('joe_pulse_seen');
    const alreadyGranted = Notification.permission === 'granted';
    if (!alreadySeen && !alreadyGranted) {
      // Show after a small delay so the page renders first
      const t = setTimeout(() => setShowPulsePopup(true), 800);
      return () => clearTimeout(t);
    } else if (alreadyGranted) {
      setNotifSubscribed(true);
    }

    // 📣 [SONIC-HANDSHAKE] Instant UI sync for custom event
    const handleGranted = () => {
      setNotifSubscribed(true);
      syncOneSignal(profile?.uid || null);
    };
    window.addEventListener('joe_notif_granted', handleGranted);
    return () => window.removeEventListener('joe_notif_granted', handleGranted);
  }, [profile?.uid]);

  // 🔔 [BELL-RING] Auto-ring bell every 8s to attract attention
  useEffect(() => {
    if (notifSubscribed) return;
    const interval = setInterval(() => {
      setNotifRinging(true);
      setTimeout(() => setNotifRinging(false), 1000);
    }, 8000);
    // Ring immediately on mount after 2s
    const initial = setTimeout(() => {
      setNotifRinging(true);
      setTimeout(() => setNotifRinging(false), 1000);
    }, 2000);
    return () => { clearInterval(interval); clearTimeout(initial); };
  }, [notifSubscribed]);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const items = await getMenuOnce();
        setMenu(items);
        setLoading(false);
      } catch (e) {
        console.error("Menu fetch failed:", e);
        setLoading(false);
      }
    };
    loadMenu();
  }, []);

  useEffect(() => {
    const load = () => getQueueEstimate().then(setQueueEstimate).catch(() => setQueueEstimate(null));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // 🔊 [AUDIO-TRACKER] Track previous order states to detect real transitions
  const prevOrderStatuses = React.useRef<Record<string, { payment: string; order: string }>>({});

  useEffect(() => {
    if (profile?.uid) {
      const unsubMain = listenToUserOrders(profile.uid, (orders) => {
        const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setMyOrders(sorted);

        // ─── Order Sync ───────────────────────────────────────────────
        orders.forEach(order => {
          const prev = prevOrderStatuses.current[order.id];
          const currPayment = order.paymentStatus;
          const currOrder   = order.orderStatus;

          if (!prev) {
            prevOrderStatuses.current[order.id] = { payment: currPayment, order: currOrder };
            return;
          }

          // Show rejection notice (Visual only, Audio handled by App hook)
          if ((prev.payment !== 'REJECTED' && currPayment === 'REJECTED') || (prev.order !== 'CANCELLED' && currOrder === 'CANCELLED')) {
            setShowRejectNotice(true);
            setTimeout(() => setShowRejectNotice(false), 5000);
          }

          // Update tracker
          prevOrderStatuses.current[order.id] = { payment: currPayment, order: currOrder };
        });
        // ─────────────────────────────────────────────────────────────

        // Legacy reject banner fallback
        const hasRejected = orders.some(o =>
          (o.paymentStatus === 'REJECTED' || o.orderStatus === 'CANCELLED') &&
          !o.notifiedAt
        );
        if (hasRejected && !orders.some(o => prevOrderStatuses.current[o.id])) {
          setShowRejectNotice(true);
          setTimeout(() => setShowRejectNotice(false), 5000);
        }
      });

      return () => { unsubMain(); };
    }
  }, [profile?.uid]);

  const activeOrder = useMemo(() => {
    // Student-facing "active" order means:
    // - Cash order waiting for cashier (paymentStatus === 'PENDING'), OR
    // - Online / approved order with QR still ACTIVE and not yet scanned at counter
    return myOrders.find((o) => {
      // 🛑 Exclude Terminal/Completed states immediately
      if (['REJECTED', 'CANCELLED', 'COMPLETED', 'SERVED', 'EXPIRED', 'ABANDONED'].includes(o.orderStatus)) return false;
      
      // 💰 Cash orders waiting for confirmation are ACTIVE
      if (o.paymentStatus === 'PENDING') return true;

      // 🥗 Paid orders are ACTIVE if they are still preparing or waiting for scan
      // We also check for 'SCANNED' because dynamic orders stay active after scan until fully served
      if (o.paymentStatus === 'SUCCESS' && (o.qrStatus === 'ACTIVE' || o.qrStatus === 'SCANNED')) return true;
      
      return false;
    });
  }, [myOrders]);

  const isPrepWaiting =
    !!activeOrder &&
    activeOrder.orderType === 'PREPARATION_ITEM' &&
    activeOrder.paymentStatus === 'SUCCESS' &&
    ['NEW', 'QUEUED', 'PREPARING'].includes(activeOrder.serveFlowStatus || 'NEW');
  const { visible: showHeadline, headline } = useMotivationalHeadline(isPrepWaiting);

  // Derive flow for Haptic Feedback + UI, safe when activeOrder is null
  const activeOrderFlow = activeOrder?.serveFlowStatus || (activeOrder?.paymentStatus === 'SUCCESS' ? 'PAID' : 'NEW');

  // Haptic Feedback for READY state (triggered by flow change), moved to top level
  useEffect(() => {
    if (activeOrderFlow === 'READY' && ('vibrate' in navigator)) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [activeOrderFlow]);

  useEffect(() => {
    const savedCart = localStorage.getItem('joe_cart');
    if (savedCart && menu.length > 0) {
      try {
        const parsed = JSON.parse(savedCart) as CartItem[];
        // LEGACY CLEANUP: If items have old numeric IDs ('1', '2'...), clear them entirely
        const hasLegacy = parsed.some(it => !isNaN(Number(it.id)));
        
        if (hasLegacy) {
          localStorage.removeItem('joe_cart');
          setCart({});
          return;
        }

        const cartMap: Record<string, CartItem> = {};
        let changed = false;
        
        parsed.forEach(item => { 
          if (menu.find(m => m.id === item.id)) {
            cartMap[item.id] = item; 
          } else {
            changed = true;
          }
        });
        
        setCart(cartMap);
        if (changed) {
          localStorage.setItem('joe_cart', JSON.stringify(Object.values(cartMap)));
        }
      } catch (e) {
        console.error("Cart restore error", e);
      }
    }
  }, [menu]);

  const cartItemsCount = Object.keys(cart).reduce((acc: number, key: string) => {
    return acc + (cart[key]?.quantity || 0);
  }, 0);

  const cartTotal = Object.keys(cart).reduce((acc: number, key: string) => {
    const item = cart[key];
    return acc + (item ? (item.price * item.quantity) : 0);
  }, 0);

  const filteredMenu = useMemo(() => {
    const filtered = menu.filter(item => 
      item.category === selectedCategory && 
      item.name.toLowerCase().includes(search.toLowerCase())
    );
    // Sort Breakfast items to keep common things like Idli/Dosa at top
    return filtered.sort((a, b) => a.id.localeCompare(b.id));
  }, [selectedCategory, search, menu]);

  const updateCart = React.useCallback((item: MenuItem, delta: number) => {
    if (delta > 0 && isOutOfStock(item.id)) return;
    setCart(prev => {
      const newCart = { ...prev };
      if (!newCart[item.id]) {
        if (delta > 0) {
          const orderType = item.orderType || (FAST_ITEM_CATEGORIES.includes(item.category) ? 'FAST_ITEM' : 'PREPARATION_ITEM');
          newCart[item.id] = { ...item, quantity: 1, orderType, status: 'PENDING' };
        }
      } else {
        let newQty = newCart[item.id].quantity + delta;

        // 🛑 MORNING DOSA LIMIT (Max 2 per student)
        const currentHour = new Date().getHours();
        const isMorning = currentHour >= 7 && currentHour <= 9;
        const isDosa = item.name.toLowerCase().includes('dosa');
        if (isMorning && isDosa) {
           if (newQty > 2) {
             alert("Maximum 2 Dosas allowed per student during morning rush.");
             newQty = 2; // Strict limit 2 per person
           }
        }

        // 🛑 MEAL LIMIT (Max 1 per student)
        if (item.category === 'Lunch' || item.name.toLowerCase().includes('meal')) {
           if (newQty > 1) {
             alert("Only 1 meal can be ordered at a time per order. Please complete this order and place a new one if you need another.");
             newQty = 1; // Strict limit 1 for meals
           }
        }

        const maxAllowed = stockByItemId[item.id]?.available ?? 999;
        if (newQty > maxAllowed) newQty = maxAllowed;
        
        // Fix StrictMode double increment by avoiding direct object mutation
        if (newQty <= 0) {
          delete newCart[item.id];
        } else {
          newCart[item.id] = { ...newCart[item.id], quantity: newQty };
        }
      }
      const cartArray = Object.values(newCart);
      localStorage.setItem('joe_cart', JSON.stringify(cartArray));
      if (profile?.uid) saveCartDraft(profile.uid, cartArray);
      return newCart;
    });
  }, [profile?.uid, isOutOfStock, stockByItemId]);

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background pb-32 max-w-md mx-auto relative overflow-x-hidden">

      {/* 🔔 [PULSE-POPUP] First-visit notification opt-in overlay */}
      {showPulsePopup && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 animate-in fade-in duration-300">
          {/* Blurred backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

          {/* Card */}
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            
            {/* Top gradient band */}
            <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-8 pt-10 pb-16 text-center relative overflow-hidden">
              {/* Decorative rings */}
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-4 -left-4 w-28 h-28 rounded-full bg-white/10" />

              {/* Animated Bell */}
              <div className="relative inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-3xl backdrop-blur-sm mb-4 ring-4 ring-white/30">
                <span className="absolute inset-0 rounded-3xl bg-white/20 animate-ping" />
                <BellRing className="w-10 h-10 text-white animate-bounce" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-400 rounded-full border-2 border-white animate-pulse" />
              </div>

              <h2 className="text-white font-black text-2xl tracking-tight mb-1">Get Exclusive Deals!</h2>
              <p className="text-white/80 text-sm font-medium">Be first to know about special offers,<br/>flash deals & meal combos 🎉</p>
            </div>

            {/* Perks list overlapping the band */}
            <div className="relative -mt-8 mx-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-3">
              {[
                { emoji: '⚡', text: 'Flash sale alerts before anyone else' },
                { emoji: '🍱', text: 'Daily meal combo notifications' },
                { emoji: '🎁', text: 'Surprise reward drops just for you' },
              ].map(({ emoji, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <span className="text-xl">{emoji}</span>
                  <span className="text-sm font-bold text-gray-700">{text}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="px-6 py-6 space-y-3">
              <button
                onClick={async () => {
                  localStorage.setItem('joe_pulse_seen', 'true');
                  setShowPulsePopup(false);
                  const joeSubscribe = (window as any).joeSubscribe;
                  if (typeof joeSubscribe === 'function') {
                    joeSubscribe();
                    setTimeout(() => {
                      if (Notification.permission === 'granted') setNotifSubscribed(true);
                    }, 1500);
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Enable Deal Alerts
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('joe_pulse_seen', 'true');
                  setShowPulsePopup(false);
                }}
                className="w-full py-3 text-gray-400 font-bold text-xs tracking-widest uppercase active:scale-95 transition-all"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Profile Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity animate-in fade-in duration-300"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Profile Drawer Slide-out */}
      <aside className={`
        fixed inset-y-0 left-0 w-4/5 bg-white z-[110] transition-transform duration-500 p-8 shadow-2xl flex flex-col
        ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex justify-between items-center mb-12">
          <Logo size="sm" />
          <button onClick={() => setIsDrawerOpen(false)} className="p-3 bg-gray-50 rounded-2xl text-textSecondary active:scale-90 transition-all">
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-24 h-24 bg-primary text-white rounded-[2.5rem] flex items-center justify-center font-black text-4xl shadow-2xl shadow-primary/20 mb-4 border-4 border-white">
            {profile?.name?.[0] || 'U'}
          </div>
          <h3 className="text-2xl font-black text-textMain tracking-tight">{profile?.name || 'Explorer'}</h3>
          <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest mt-2 px-4 py-1.5 bg-gray-50 rounded-full border border-black/5">
            {profile?.studentType || 'Day Scholar'}
          </p>
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto hide-scrollbar">
          <div className="p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
             <div className="flex items-center gap-3 mb-6 text-primary">
               <Clock className="w-5 h-5" />
               <span className="text-[10px] font-black uppercase tracking-widest">Recent Activity</span>
             </div>
             {myOrders.slice(0, 3).length > 0 ? (
               <div className="space-y-4">
                 {myOrders.slice(0, 3).map(order => (
                   <div key={order.id} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-black/5">
                     <div className="min-w-0">
                        <p className="text-xs font-black text-textMain truncate">#{order.id.slice(-6).toUpperCase()}</p>
                        <p className="text-[9px] text-textSecondary font-bold mt-0.5">₹{order.totalAmount} • {new Date(order.createdAt).toLocaleDateString()}</p>
                     </div>
                     <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${order.orderStatus === 'SERVED' ? 'bg-success/10 text-success' : 'bg-cash/10 text-cash'}`}>
                       {order.orderStatus}
                     </span>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-4">
                 <p className="text-xs font-bold text-primary/40 italic">No orders logged yet.</p>
               </div>
             )}
          </div>

          {/* (Removed extra placeholder buttons to keep home UX clean) */}
        </div>

        <div className="space-y-3 mt-8">
          {onViewOrders && (
            <button 
              onClick={() => {
                setIsDrawerOpen(false);
                onViewOrders();
              }}
              className="w-full py-5 bg-primary/5 text-primary rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 hover:bg-primary hover:text-white transition-all"
            >
              <ShoppingBag className="w-4 h-4" /> My Orders
            </button>
          )}
          
          <button 
            onClick={onLogout}
            className="w-full py-5 bg-error/5 text-error rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 hover:bg-error hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" /> End Session
          </button>
        </div>
      </aside>

      {/* Main Home Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-40 p-4 shadow-sm border-b border-black/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="w-12 h-12 bg-white border border-black/5 rounded-2xl flex items-center justify-center text-textMain active:scale-90 transition-all shadow-sm hover:border-primary/20"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest">Logged in as,</p>
              <h2 className="text-lg font-black text-textMain tracking-tighter truncate max-w-[120px]">{profile?.name || 'Explorer'}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 📣 [ANIMATED-BELL] Premium Notification Subscribe Icon */}
            <button
              onClick={() => {
                const joeSubscribe = (window as any).joeSubscribe;
                if (typeof joeSubscribe === 'function') joeSubscribe();
              }}
              title={notifSubscribed ? 'Subscribed to Deals!' : 'Tap to get Exclusive Deals!'}
              className={`relative flex items-center justify-center transition-all duration-500 active:scale-90
                ${ notifSubscribed
                  ? 'w-11 h-11 rounded-2xl bg-emerald-500 shadow-lg shadow-emerald-200 ring-4 ring-emerald-100'
                  : 'w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-300 ring-4 ring-indigo-100 hover:shadow-indigo-400'
                }`}
            >
              {/* Pulse ring animation when not subscribed */}
              {!notifSubscribed && (
                <>
                  <span className="absolute inset-0 rounded-2xl bg-indigo-400 animate-ping opacity-30" />
                  <span className="absolute inset-0 rounded-2xl bg-violet-400 animate-pulse opacity-20" />
                </>
              )}

              {/* Icon swap: Bell → Check */}
              {notifSubscribed ? (
                <Check className="w-5 h-5 text-white drop-shadow" strokeWidth={3} />
              ) : notifRinging ? (
                <BellRing className="w-5 h-5 text-white drop-shadow animate-bounce" />
              ) : (
                <Bell className="w-5 h-5 text-white drop-shadow" />
              )}

              {/* Red dot if not subscribed */}
              {!notifSubscribed && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
              )}
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary" />
          <input 
            type="text" 
            placeholder="Search meal engine..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-[1.25rem] py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 text-sm font-bold outline-none shadow-inner"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-background text-textSecondary border border-transparent hover:border-black/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {showRejectNotice && (
        <div className="mx-4 my-3 bg-error/10 border border-error/20 text-error rounded-2xl p-4 flex items-center gap-3 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="text-sm font-black">Payment rejected by cashier</p>
            <p className="text-xs text-error/80">Please review and place a new order.</p>
          </div>
        </div>
      )}
      {/* Live Order Tracker Banner (Senior UX) */}
      {activeOrder && (
         <div className="p-4 animate-in slide-in-from-top-4 duration-700">
            <div 
              onClick={() => onViewQR && onViewQR(activeOrder.id)}
              className={`p-6 rounded-[2.5rem] border-2 flex flex-col gap-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-500 group ${
                activeOrder.paymentStatus === 'PENDING' ? 'border-amber-500 bg-amber-500/5 shadow-amber-900/10' :
                activeOrderFlow === 'READY' ? 'border-green-500 bg-green-500/5 shadow-green-900/20' :
                activeOrderFlow === 'ALMOST_READY' ? 'border-orange-500 bg-orange-500/5 shadow-orange-900/10' :
                'border-primary bg-primary/5 shadow-primary-900/10'
              }`}
            >
              {/* Ready State Pulsing Glow */}
              {activeOrderFlow === 'READY' && (
                <div className="absolute inset-0 bg-green-500/10 animate-pulse-slow pointer-events-none" />
              )}
              
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${activeOrderFlow === 'READY' ? 'bg-green-500 text-white animate-bounce' : 'bg-white shadow-sm'}`}>
                    {activeOrderFlow === 'READY' ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-textSecondary opacity-60">Real-time Order Tracking</p>
                    <h4 className="text-xl font-black text-textMain tracking-tighter">
                      {activeOrder.paymentStatus === 'PENDING' ? 'Pay to Start Cooking' : 
                       activeOrderFlow === 'READY' ? '🎉 Food is Ready!' : 
                       activeOrderFlow === 'ALMOST_READY' ? '🔥 Almost Ready...' : '🥣 Preparing Meal'}
                    </h4>
                  </div>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Queue ID</p>
                    <p className="text-sm font-black text-textMain">#{activeOrder.id.slice(-4).toUpperCase()}</p>
                </div>
              </div>

              {/* Multi-item Preview */}
              <div className="flex flex-wrap gap-2 relative z-10">
                 {activeOrder.items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="px-3 py-1.5 bg-white/50 backdrop-blur rounded-xl border border-black/5 flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${activeOrderFlow === 'READY' ? 'bg-green-500' : 'bg-primary animate-pulse'}`} />
                        <span className="text-[9px] font-black text-textMain">{item.name}</span>
                    </div>
                 ))}
                 {activeOrder.items.length > 3 && (
                    <div className="px-3 py-1.5 bg-black/5 rounded-xl border border-black/5 text-[9px] font-black text-textSecondary">
                        +{activeOrder.items.length - 3} more
                    </div>
                 )}
              </div>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-end">
                    <div className="text-[10px] font-bold text-textSecondary flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${activeOrderFlow === 'READY' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-primary'}`} />
                        {activeOrderFlow === 'READY' ? 'Collect from counter' : 'Optimal arrival in ~8m'}
                    </div>
                    <ChevronRight className="w-4 h-4 text-textSecondary opacity-30 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ease-out rounded-full ${activeOrderFlow === 'READY' ? 'bg-green-500' : 'bg-primary'} ${
                      activeOrder.paymentStatus === 'PENDING' ? 'w-1/4' :
                      activeOrderFlow === 'READY' ? 'w-full' :
                      activeOrderFlow === 'ALMOST_READY' ? 'w-5/6' :
                      activeOrderFlow === 'PREPARING' ? 'w-2/3' : 'w-1/2'
                    }`} />
                </div>
              </div>
            </div>
          </div>
      )}


      {/* Dynamic Menu Container */}
      {loading ? (
        <div className="p-24 flex flex-col items-center justify-center">
          <FoodLoader />
        </div>
      ) : filteredMenu.length === 0 ? (
        <div className="p-20 text-center space-y-6">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto border border-black/5">
            <Search className="w-8 h-8 text-textSecondary/20" />
          </div>
          <div className="space-y-1">
            <p className="font-black text-textMain uppercase text-xs tracking-widest">Null Reference</p>
            <p className="text-[10px] text-textSecondary font-bold">No assets found in current category.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 gap-4 animate-in fade-in duration-500">
          {filteredMenu.map((item, idx) => {
            const stock = stockByItemId[item.id];
            const available = stock?.available ?? 999;
            const status = stock?.status ?? 'AVAILABLE';
            const outOfStock = available <= 0;
            const lowStock = status === 'LOW_STOCK';
            const canAdd = !outOfStock && canAddToCart(item.id, cart[item.id]?.quantity ?? 0);

            return (
              <div key={item.id} className={`bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 flex flex-col h-full group transition-all duration-300 ${outOfStock ? 'grayscale-[0.5] opacity-80' : 'hover:shadow-md'}`}>
                {/* 📸 IMAGE HERO SLIGHTLY LARGER */}
                <div className="relative h-44 w-full bg-slate-50 overflow-hidden">
                  <SmartImage 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      priority={idx < 4 ? 'high' : 'auto'}
                  />
                  {/* VEG INDICATOR FLOATING TOP LEFT */}
                  <div className="absolute top-3 left-3 bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-black/5">
                     <div className="w-2.5 h-2.5 border-2 border-green-600 flex items-center justify-center rounded-sm">
                        <div className="w-1 h-1 bg-green-600 rounded-full" />
                     </div>
                  </div>
                  
                  {/* STATUS FLOATING BOTTOM CENTER */}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                       <span className="bg-white/95 text-slate-900 px-4 py-2 rounded-full text-[10px] font-black tracking-widest uppercase">Sold Out</span>
                    </div>
                  )}
                  
                  {lowStock && !outOfStock && (
                    <div className="absolute bottom-3 left-3 bg-amber-500/90 text-white px-2.5 py-1 rounded-full text-[9px] font-black tracking-tight border border-white/20">
                       Only {available} Left
                    </div>
                  )}
                </div>

                {/* 📝 CONTENT COMPACT & SIMPLE */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="mb-4">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.category}</p>
                    <h3 className="text-sm font-black text-slate-800 leading-tight tracking-tight line-clamp-2 min-h-[40px]">{item.name}</h3>
                  </div>

                  {/* 💰 PRICE & ACTION - CLEAN SPACED */}
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold tracking-tight">Price</span>
                      <span className="text-base font-black text-slate-900 tracking-tighter">₹{item.price}</span>
                    </div>

                    <div>
                      {cart[item.id] ? (
                        <div className="flex items-center bg-slate-100 rounded-full p-0.5 border border-slate-200">
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateCart(item, -1); }}
                            className="w-8 h-8 flex items-center justify-center bg-white text-slate-900 rounded-full shadow-sm active:scale-95 transition-all"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-black text-slate-900">{cart[item.id].quantity}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); canAdd && updateCart(item, 1); }}
                            className={`w-8 h-8 flex items-center justify-center bg-primary text-white rounded-full shadow-lg active:scale-95 transition-all ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); canAdd && updateCart(item, 1); }}
                          disabled={!canAdd}
                          className={`
                            px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95
                            ${!canAdd 
                              ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed' 
                              : 'bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/40'
                            }
                          `}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Cart Indicator */}
      {cartItemsCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-2xl border-t border-black/5 z-40 animate-in slide-in-from-bottom-full duration-700">
          {queueEstimate != null && queueEstimate.pendingCount > 0 && (
            <p className="text-center text-[10px] font-bold text-textSecondary mb-2 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Estimated wait: ~{queueEstimate.minutes} min
            </p>
          )}
          <div className="max-w-md mx-auto flex items-center justify-between gap-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-textSecondary uppercase tracking-widest">{cartItemsCount} Units Selected</span>
              <span className="text-2xl font-black text-textMain tracking-tight">₹{cartTotal}</span>
            </div>
            <button 
              onClick={onProceed}
              className="flex-1 bg-primary text-white font-black text-xs uppercase tracking-widest py-5 rounded-[1.75rem] flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 active:scale-95 transition-all group"
            >
              Process Order
              <ShoppingBag className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        </div>
      )}
      {/* 📣 [SONIC-PULSE-PROMPT] Smart permission onboarding modal */}
      {showPulsePopup && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
           <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
              <div className="p-8 pb-4">
                 <div className="w-16 h-16 bg-indigo-500 rounded-3xl flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-200 ring-4 ring-indigo-50">
                    <BellRing className="w-8 h-8 animate-bounce" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-900 tracking-tighter leading-tight mb-2">
                    Never Miss a Hot Meal
                 </h3>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed">
                    Get real-time pulses when your food is ready and unlock exclusive high-priority limited deals.
                 </p>
              </div>
              
              <div className="p-8 flex flex-col gap-3">
                 <button 
                  onClick={() => {
                    localStorage.setItem('joe_pulse_seen', 'true');
                    setShowPulsePopup(false);
                    const joeSubscribe = (window as any).joeSubscribe;
                    if (typeof joeSubscribe === 'function') joeSubscribe();
                  }}
                  className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all"
                 >
                    Enable Alerts
                 </button>
                 <button 
                  onClick={() => {
                    localStorage.setItem('joe_pulse_seen', 'true');
                    setShowPulsePopup(false);
                  }}
                  className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                 >
                    Maybe later
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;