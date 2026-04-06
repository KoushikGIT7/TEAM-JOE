import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LogOut, ShoppingBag, Plus, Minus, Search, Menu, X as CloseIcon, Clock, ChevronRight, CheckCircle2, AlertCircle, Sparkles, Bell, BellRing, Check } from 'lucide-react';
import { getOrderUIState } from '../../utils/orderLifecycle';
import SmartImage from '../../components/Common/SmartImage';
import FoodLoader from '../../components/Common/FoodLoader';
import { UserProfile, MenuItem, CartItem, Order } from '../../types';
import { CATEGORIES, FAST_ITEM_CATEGORIES } from '../../constants';
import { getMenuOnce, listenToUserOrders, saveCartDraft, getQueueEstimate } from '../../services/firestore-db';
import { useInventory } from '../../hooks/useInventory';
import { useMotivationalHeadline } from '../../hooks/useMotivationalHeadline';
import Logo from '../../components/Logo';
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
  const { stockByItemId, isOutOfStock, canAddToCart } = useInventory();

  useEffect(() => {
    getMenuOnce().then(items => { setMenu(items); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (profile?.uid) {
      return listenToUserOrders(profile.uid, (orders) => {
        setMyOrders([...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      });
    }
  }, [profile?.uid]);

  const activeOrder = useMemo(() => {
    return myOrders.find((o) => {
      // 🛡️ [BANNER-PURGE]: Remove order from home screen if it is terminal or already checked-in/scanned
      const terminalStates = ['REJECTED', 'CANCELLED', 'COMPLETED', 'SERVED', 'EXPIRED', 'ABANDONED'];
      if (terminalStates.includes(o.orderStatus)) return false;
      if (o.qrState === 'SCANNED' || o.serveFlowStatus === 'SERVED' || o.serveFlowStatus === 'SERVED_PARTIAL') return false;
      
      return o.paymentStatus === 'SUCCESS' || o.paymentStatus === 'VERIFIED' || o.paymentStatus === 'PENDING';
    });
  }, [myOrders]);

  const uiState = useMemo(() => activeOrder ? getOrderUIState(activeOrder) : null, [activeOrder]);
  const activeOrderFlow = useMemo(() => {
    if (!activeOrder) return 'NEW';
    // If any item is physically marked READY or is a FAST_ITEM that is PAID, show as ready
    const isPaid = activeOrder.paymentStatus === 'SUCCESS' || activeOrder.paymentStatus === 'VERIFIED';
    const anyReady = activeOrder.items?.some(it => it.status === 'READY' || (isPaid && it.orderType === 'FAST_ITEM'));
    return anyReady ? 'READY' : (activeOrder.serveFlowStatus || 'NEW');
  }, [activeOrder]);

  const cartItemsCount = Object.values(cart).reduce((acc, item) => acc + (item.quantity || 0), 0);
  const cartTotal = Object.values(cart).reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const filteredMenu = useMemo(() => {
    return menu.filter(item => item.category === selectedCategory && item.name.toLowerCase().includes(search.toLowerCase()))
               .sort((a, b) => a.id.localeCompare(b.id));
  }, [selectedCategory, search, menu]);

  const updateCart = (item: MenuItem, delta: number) => {
    if (delta > 0 && isOutOfStock(item.id)) return;
    setCart(prev => {
      const newCart = { ...prev };
      if (!newCart[item.id]) {
        if (delta > 0) newCart[item.id] = { ...item, quantity: 1, orderType: item.orderType || 'PREPARATION_ITEM', status: 'PENDING' };
      } else {
        let newQty = newCart[item.id].quantity + delta;
        if (newQty <= 0) delete newCart[item.id];
        else newCart[item.id] = { ...newCart[item.id], quantity: newQty };
      }
      const cartArray = Object.values(newCart);
      localStorage.setItem('joe_cart', JSON.stringify(cartArray));
      if (profile?.uid) saveCartDraft(profile.uid, cartArray);
      return newCart;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 max-w-md mx-auto relative overflow-hidden flex flex-col font-sans">
      
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setIsDrawerOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 w-4/5 bg-white z-[110] transition-transform duration-500 p-8 shadow-2xl flex flex-col ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-12">
          <Logo size="sm" />
          <button onClick={() => setIsDrawerOpen(false)} className="p-3 bg-gray-50 rounded-2xl"><CloseIcon /></button>
        </div>
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center font-black text-3xl mb-4">{profile?.name?.[0] || 'U'}</div>
          <h3 className="text-xl font-black text-slate-800">{profile?.name || 'User'}</h3>
        </div>
        <div className="space-y-4">
          <button onClick={onLogout} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2">Logout</button>
        </div>
      </aside>

      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-50 p-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDrawerOpen(true)} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center"><Menu className="w-6 h-6" /></button>
            <h2 className="text-lg font-black text-slate-800 tracking-tighter">{profile?.name || 'Welcome'}</h2>
          </div>
          <button className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center"><Bell className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input type="text" placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedCategory === cat ? 'bg-primary text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4">
        {activeOrder && (
          <div className="px-4 mb-6">
            <div onClick={() => onViewQR && onViewQR(activeOrder.id)} className={`p-6 rounded-[2rem] border-2 shadow-sm transition-all active:scale-95 ${uiState === 'MISSED' ? 'bg-rose-50 border-rose-200 animate-pulse' : activeOrderFlow === 'READY' ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
              <div className="flex gap-4 items-center">
                <div className={`p-3 rounded-2xl ${uiState === 'MISSED' ? 'bg-rose-500' : activeOrderFlow === 'READY' ? 'bg-emerald-500' : 'bg-white shadow-sm'}`}>
                  {uiState === 'MISSED' ? <AlertCircle className="text-white" /> : activeOrderFlow === 'READY' ? <Sparkles className="text-white" /> : <Clock className="text-indigo-500" />}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800">
                    {uiState === 'MISSED' ? '⚠️ Slot Missed - Re-Queuing' : activeOrderFlow === 'READY' ? '🎉 Food is Ready!' : '🥣 Preparing Meal'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{activeOrder.id.slice(-6).toUpperCase()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-20 flex justify-center"><FoodLoader /></div>
        ) : (
          <div className="px-4 grid grid-cols-2 gap-4">
            {filteredMenu.map(item => {
              const inStock = !isOutOfStock(item.id);
              const qty = cart[item.id]?.quantity || 0;
              return (
                <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 flex flex-col">
                  <div className="h-40 relative">
                    <SmartImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    {!inStock && <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-white text-[10px] font-black uppercase">Sold Out</div>}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-sm font-black text-slate-800 line-clamp-2 min-h-[40px]">{item.name}</h3>
                    <div className="mt-auto flex items-center justify-between pt-2">
                       <span className="text-base font-black text-slate-900">₹{item.price}</span>
                       {qty > 0 ? (
                         <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-full border border-slate-100">
                           <button onClick={() => updateCart(item, -1)} className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm"><Minus className="w-3" /></button>
                           <span className="text-xs font-black">{qty}</span>
                           <button onClick={() => updateCart(item, 1)} className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center shadow-sm"><Plus className="w-3" /></button>
                         </div>
                       ) : (
                         <button onClick={() => updateCart(item, 1)} disabled={!inStock} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase ${inStock ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-300'}`}>Add</button>
                       )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartItemsCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 p-6 bg-white/90 backdrop-blur-2xl border-t z-50">
          <div className="flex items-center justify-between gap-6">
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cartItemsCount} Items</p><p className="text-2xl font-black text-slate-900">₹{cartTotal}</p></div>
            <button onClick={onProceed} className="flex-1 bg-primary text-white font-black text-sm uppercase py-5 rounded-2xl shadow-xl active:scale-95 transition-all">Process Order</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;