import React, { useState, useMemo, useEffect } from 'react';
import { 
  LogOut, ShoppingBag, Plus, Minus, Search, Loader2, 
  Menu, X as CloseIcon, User, Clock, ShieldCheck, 
  ChevronRight, MapPin, Coffee, ShoppingCart, Zap, CheckCircle2, AlertCircle, Sparkles
} from 'lucide-react';
import { UserProfile, MenuItem, CartItem, Order } from '../../types';
import { CATEGORIES, FAST_ITEM_CATEGORIES } from '../../constants';
import { listenToMenu, listenToUserOrders, saveCartDraft, getQueueEstimate } from '../../services/firestore-db';
import { useInventory } from '../../hooks/useInventory';
import { useMotivationalHeadline } from '../../hooks/useMotivationalHeadline';
import MotivationalHeadline from '../../components/MotivationalHeadline';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import Logo from '../../components/Logo';

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
  const { stockByItemId, isOutOfStock, canAddToCart } = useInventory();

  useEffect(() => {
    const unsubscribe = listenToMenu((items) => {
      setMenu(items);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const load = () => getQueueEstimate().then(setQueueEstimate).catch(() => setQueueEstimate(null));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (profile?.uid) {
      const unsubMain = listenToUserOrders(profile.uid, (orders) => {
        const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setMyOrders(sorted);

        // Show reject banner only for NEW rejections (not yet notified)
        const hasRejected = orders.some(o => 
          (o.paymentStatus === 'REJECTED' || o.orderStatus === 'CANCELLED') && 
          !o.notifiedAt
        );
        if (hasRejected) {
          setShowRejectNotice(true);
          // Banner stays for 5s then hides
          setTimeout(() => setShowRejectNotice(false), 5000);
        }
      });

      return () => {
        unsubMain();
      };
    }
  }, [profile?.uid]);

  const activeOrder = useMemo(() => {
    // Student-facing "active" order means:
    // - Cash order waiting for cashier (paymentStatus === 'PENDING'), OR
    // - Online / approved order with QR still ACTIVE and not yet scanned at counter
    return myOrders.find((o) => {
      if (o.paymentStatus === 'REJECTED' || o.orderStatus === 'CANCELLED') return false;
      if (o.paymentStatus === 'PENDING') return true;
      if (o.paymentStatus === 'SUCCESS' && o.qrStatus === 'ACTIVE') return true;
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
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart) as CartItem[];
        const cartMap: Record<string, CartItem> = {};
        parsed.forEach(item => { cartMap[item.id] = item; });
        setCart(cartMap);
      } catch (e) {
        console.error("Cart restore error", e);
      }
    }
  }, []);

  const cartItemsCount = Object.keys(cart).reduce((acc: number, key: string) => {
    const item = cart[key];
    return acc + (item ? item.quantity : 0);
  }, 0);

  const cartTotal = Object.keys(cart).reduce((acc: number, key: string) => {
    const item = cart[key];
    return acc + (item ? (item.price * item.quantity) : 0);
  }, 0);

  const filteredMenu = useMemo(() => {
    return menu.filter(item => 
      item.category === selectedCategory && 
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [selectedCategory, search, menu]);

  const updateCart = React.useCallback((item: MenuItem, delta: number) => {
    if (delta > 0 && isOutOfStock(item.id)) return;
    setCart(prev => {
      const newCart = { ...prev };
      if (!newCart[item.id]) {
        if (delta > 0) {
          const orderType = item.orderType || (FAST_ITEM_CATEGORIES.includes(item.category) ? 'FAST_ITEM' : 'PREPARATION_ITEM');
          newCart[item.id] = { ...item, quantity: 1, orderType };
        }
      } else {
        let newQty = newCart[item.id].quantity + delta;
        const maxAllowed = stockByItemId[item.id]?.available ?? 999;
        if (newQty > maxAllowed) newQty = maxAllowed;
        newCart[item.id].quantity = newQty;
        if (newCart[item.id].quantity <= 0) delete newCart[item.id];
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
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-full border border-primary/10">
             <MapPin className="w-3 h-3" />
             <span className="text-[9px] font-black uppercase tracking-tighter">Main Node</span>
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
                    <p className="text-[10px] font-bold text-textSecondary flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${activeOrderFlow === 'READY' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-primary'}`} />
                        {activeOrderFlow === 'READY' ? 'Collect from counter' : 'Optimal arrival in ~8m'}
                    </p>
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
        <div className="p-24 flex justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin opacity-40" />
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
          {filteredMenu.map(item => {
            const stock = stockByItemId[item.id];
            const available = stock?.available ?? 999;
            const status = stock?.status ?? 'AVAILABLE';
            const outOfStock = available <= 0;
            const lowStock = status === 'LOW_STOCK';
            const canAdd = !outOfStock && canAddToCart(item.id, cart[item.id]?.quantity ?? 0);
            return (
              <div key={item.id} className={`bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-black/5 group hover:border-primary/20 transition-all flex flex-col active:scale-[0.98] ${outOfStock ? 'opacity-80' : ''}`}>
                <div className="h-32 bg-gray-100 overflow-hidden relative">
                  <img 
                    src={item.imageUrl || 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400'} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';
                    }}
                  />
                  <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl text-xs font-black text-textMain shadow-lg border border-black/5">
                    ₹{item.price}
                  </div>
                  {stock && (
                    <div className={`absolute bottom-2 left-2 right-2 text-center text-[10px] font-bold py-1 rounded-lg ${
                      outOfStock ? 'bg-error/90 text-white' : lowStock ? 'bg-amber-500/90 text-white' : 'bg-success/90 text-white'
                    }`}>
                      {outOfStock ? 'Out of Stock' : lowStock ? `Low Stock (${available} left)` : `Available (${available} left)`}
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <h3 className="font-black text-textMain text-xs leading-relaxed mb-4">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    {cart[item.id] ? (
                      <div className="flex items-center gap-2 bg-gray-50 rounded-2xl p-1 w-full justify-between border border-black/5">
                        <button 
                          onClick={() => updateCart(item, -1)}
                          className="w-9 h-9 flex items-center justify-center bg-white text-textMain rounded-xl shadow-sm active:scale-75 transition-all border border-black/5"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-black text-xs text-textMain">{cart[item.id].quantity}</span>
                        <button 
                          onClick={() => canAdd && updateCart(item, 1)}
                          disabled={!canAdd}
                          className={`w-9 h-9 flex items-center justify-center rounded-xl shadow-lg active:scale-75 transition-all ${canAdd ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => canAdd && updateCart(item, 1)}
                        disabled={!canAdd}
                        className={`w-full py-3.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all active:scale-95 ${
                          outOfStock
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-primary/5 text-primary border-primary/20 hover:bg-primary hover:text-white'
                        }`}
                      >
                        <Plus className="w-3 h-3" /> {outOfStock ? 'Out of Stock' : 'Add Item'}
                      </button>
                    )}
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
    </div>
  );
};

export default HomeView;