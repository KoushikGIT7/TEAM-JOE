import React, { useState, useMemo, useEffect } from 'react';
import { LogOut, Plus, Minus, Search, Menu, X as CloseIcon, Clock, AlertCircle, Sparkles, Bell, Receipt } from 'lucide-react';
import { getOrderUIState } from '../../utils/orderLifecycle';
import SmartImage from '../../components/Common/SmartImage';
import FoodLoader from '../../components/Common/FoodLoader';
import { UserProfile, MenuItem, CartItem, Order } from '../../types';
import { CATEGORIES, STATION_ID_BY_ITEM_ID, FAST_ITEM_CATEGORIES } from '../../constants';
import { getMenuOnce, listenToUserOrders, saveCartDraft } from '../../services/firestore-db';
import { useInventory } from '../../hooks/useInventory';
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
  const [isNotifGranted, setIsNotifGranted] = useState(Notification.permission === 'granted');
  const { stockByItemId, isOutOfStock } = useInventory();

  useEffect(() => {
    const handleNotifUpdate = () => setIsNotifGranted(true);
    window.addEventListener('joe_notif_granted', handleNotifUpdate);
    return () => window.removeEventListener('joe_notif_granted', handleNotifUpdate);
  }, []);

  useEffect(() => {
    getMenuOnce().then(items => { setMenu(items); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (profile?.uid) {
      if ((window as any).joeSyncUser) {
        (window as any).joeSyncUser(profile.uid);
      }
      return listenToUserOrders(profile.uid, (orders) => {
        setMyOrders([...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      });
    }
  }, [profile?.uid]);

  const activeOrder = useMemo(() => {
    return myOrders.find((o) => {
      const terminalStates = ['REJECTED', 'CANCELLED', 'COMPLETED', 'SERVED', 'EXPIRED', 'ABANDONED'];
      if (terminalStates.includes(o.orderStatus)) return false;
      if (o.qrState === 'SCANNED' || o.serveFlowStatus === 'SERVED' || o.serveFlowStatus === 'SERVED_PARTIAL') return false;
      return o.paymentStatus === 'SUCCESS' || o.paymentStatus === 'VERIFIED' || o.paymentStatus === 'PENDING';
    });
  }, [myOrders]);

  const uiState = useMemo(() => activeOrder ? getOrderUIState(activeOrder) : null, [activeOrder]);
  const activeOrderFlow = useMemo(() => {
    if (!activeOrder) return 'NEW';
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
        if (delta > 0) {
            const hasStation = !!STATION_ID_BY_ITEM_ID[item.id];
            const isCategoryFast = !!FAST_ITEM_CATEGORIES.includes(item.category || '');
            const resolvedOrderType = hasStation ? 'PREPARATION_ITEM' : (isCategoryFast ? 'FAST_ITEM' : 'PREPARATION_ITEM');
            
            newCart[item.id] = { 
                ...item, 
                quantity: 1, 
                itemId: item.id,
                orderType: resolvedOrderType, 
                status: (resolvedOrderType === 'FAST_ITEM' ? 'READY' : 'PENDING') 
            };
        }
      } else {
        let newQty = newCart[item.id].quantity + delta;
        const isDosa = item.name.toLowerCase().includes('dosa');
        if (isDosa && newQty > 1) {
            alert("Maximum 1 Dosa allowed per scan.");
            newQty = 1;
        }
        if ((item.category === 'Lunch' || item.name.toLowerCase().includes('meal')) && newQty > 1) {
            alert("Items in this category are limited to 1 per scan.");
            newQty = 1;
        }
        const maxAllowed = stockByItemId[item.id]?.available ?? 999;
        if (newQty > maxAllowed) newQty = maxAllowed;
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
    <div className="min-h-screen bg-slate-50 pb-32 max-w-md mx-auto relative overflow-x-hidden flex flex-col font-sans border-x border-slate-100 shadow-2xl">
      
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setIsDrawerOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 w-4/5 max-w-[320px] bg-white z-[110] transition-transform duration-500 p-8 shadow-2xl flex flex-col ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex justify-between items-center mb-12">
          <Logo size="sm" />
          <button onClick={() => setIsDrawerOpen(false)} className="p-3 bg-gray-50 rounded-2xl"><CloseIcon /></button>
        </div>
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-primary text-white rounded-3xl flex items-center justify-center font-black text-3xl mb-4 shadow-xl shadow-primary/20">{profile?.name?.[0] || 'U'}</div>
          <h3 className="text-xl font-black text-slate-800">{profile?.name || 'User'}</h3>
          <p className="text-[10px] uppercase font-black text-slate-300 tracking-[0.2em] mt-1 italic">Verified Official Profile</p>
        </div>
        <div className="space-y-4">
          <button 
             onClick={() => { setIsDrawerOpen(false); if (onViewOrders) onViewOrders(); }}
             className="w-full py-5 bg-slate-50 text-slate-700 rounded-3xl font-black text-xs uppercase flex items-center justify-center gap-3 active:scale-95 transition-all border border-slate-100"
          >
            <Receipt className="w-4 h-4" /> My Order History
          </button>
          <div className="pt-2 border-t border-slate-50">
            <button onClick={onLogout} className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-50 p-4 border-b border-slate-100 max-w-md mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsDrawerOpen(true)} className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-all"><Menu className="w-6 h-6 text-slate-600" /></button>
            <h2 className="text-lg font-black text-slate-800 tracking-tighter">{profile?.name || 'Welcome'}</h2>
          </div>
          <button 
            onClick={() => (window as any).joeSubscribe?.()}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-all duration-700 active:scale-90 ${
              isNotifGranted 
              ? 'bg-emerald-50 text-emerald-500 border-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
              : 'bg-slate-50 text-slate-400 border-slate-100'
            }`}
          >
            <Bell className={`w-5 h-5 ${isNotifGranted ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input type="text" placeholder="Search menu..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none ring-primary/10 focus:ring-4 transition-all" />
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar scroll-smooth">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-white text-slate-400 border border-slate-100'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 pb-4">
        {activeOrder && (
          <div className="px-4 mb-6">
            <div onClick={() => onViewQR && onViewQR(activeOrder.id)} className={`p-6 rounded-[2rem] border-2 shadow-sm transition-all active:scale-95 cursor-pointer ${uiState === 'MISSED' ? 'bg-rose-50 border-rose-200 animate-pulse' : activeOrderFlow === 'READY' ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}>
              <div className="flex gap-4 items-center">
                <div className={`p-4 rounded-2xl ${uiState === 'MISSED' ? 'bg-rose-500 shadow-lg shadow-rose-200' : activeOrderFlow === 'READY' ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-white shadow-sm'}`}>
                  {uiState === 'MISSED' ? <AlertCircle className="text-white" /> : activeOrderFlow === 'READY' ? <Sparkles className="text-white animate-spin-slow" /> : <Clock className="text-indigo-500 animate-pulse" />}
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 leading-tight">
                    {uiState === 'MISSED' ? '⚠️ Slot Missed - Re-Queuing' : activeOrderFlow === 'READY' ? '🎉 Food is Ready!' : '🥣 Preparing Meal'}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{activeOrder.id.slice(-6).toUpperCase()}</p>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <p className="text-[10px] font-bold text-primary uppercase">Tap to View QR</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-20 flex justify-center"><FoodLoader /></div>
        ) : (
          <div className="px-4 grid grid-cols-2 gap-5 pb-20">
            {filteredMenu.map(item => {
              const inStock = !isOutOfStock(item.id);
              const qty = cart[item.id]?.quantity || 0;
              return (
                <div key={item.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 flex flex-col transition-all active:scale-[0.98] h-full">
                  <div className="h-44 relative bg-slate-50 border-b border-slate-50/50 overflow-hidden shrink-0">
                    <SmartImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    {!inStock && <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center text-white text-[8px] font-black uppercase tracking-widest px-2 text-center leading-tight">Sold Out</div>}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl text-[7px] font-black uppercase text-slate-500 border border-slate-100 shadow-sm">
                        {item.category}
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1 gap-3 min-h-[140px]">
                    <h3 className="text-[12px] font-black text-slate-900 leading-tight line-clamp-2 min-h-[2.4em] tracking-tight">
                      {item.name}
                    </h3>
                    
                    <div className="mt-auto pt-2">
                      <div className="flex items-center gap-1.5 mb-4 opacity-70">
                        {item.orderType === 'FAST_ITEM' ? (
                          <span className="text-[7px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">⚡ Instant</span>
                        ) : (
                          <span className="text-[7px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">🥣 Prep Station</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-300 line-through opacity-50 mb-0.5">₹{(item.price * 1.15).toFixed(0)}</span>
                            <span className="text-base font-black text-slate-900 italic tracking-tighter">₹{item.price}</span>
                         </div>
                         
                         {qty > 0 ? (
                           <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                             <button onClick={() => updateCart(item, -1)} className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-200 active:scale-90 transition-all"><Minus className="w-4 text-slate-400" /></button>
                             <span className="text-[11px] font-black min-w-[14px] text-center text-slate-800">{qty}</span>
                             <button onClick={() => updateCart(item, 1)} className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-all text-white"><Plus className="w-4" /></button>
                           </div>
                         ) : (
                           <button onClick={() => updateCart(item, 1)} disabled={!inStock} className={`h-11 px-5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${inStock ? 'bg-primary text-white shadow-primary/20' : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'}`}>Add</button>
                         )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartItemsCount > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-white/90 backdrop-blur-2xl border-t border-slate-100 z-50">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cartItemsCount} {cartItemsCount === 1 ? 'Item' : 'Items'} Selected</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight italic">₹{cartTotal}</p>
            </div>
            <button 
                onClick={onProceed} 
                className="flex-1 bg-gray-900 text-white font-black text-xs uppercase tracking-widest py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              Process Order
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{cartItemsCount}</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;