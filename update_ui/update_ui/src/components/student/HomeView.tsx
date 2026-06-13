/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MenuItem } from '../../types';
import { 
  Search, CupSoda, Coffee, Pizza, Cookie, 
  ChefHat, AlertTriangle, ChevronRight, ShoppingCart, 
  TrendingUp, Clock, Users, ArrowUpRight, LogOut, Pocket
} from 'lucide-react';

interface HomeViewProps {
  onOpenWallet: () => void;
  onOpenOrders: () => void;
  onNavigateToTracking: (orderId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenWallet, onOpenOrders, onNavigateToTracking }) => {
  const {
    studentName,
    walletBalance,
    menuItems,
    cart,
    addToCart,
    removeFromCart,
    getCartTotal,
    orders,
    setStudentTab,
    handleStudentLogout,
    isGuest,
    studentPoints
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Find if there is any active live tracking order (Queued, Cooking, or Ready)
  const activeOrder = orders.find(o => o.status === 'QUEUED' || o.status === 'COOKING' || o.status === 'READY');

  // Categories list
  const categories = [
    { id: 'ALL', label: 'ALL', icon: ChefHat },
    { id: 'BREAKFAST', label: 'BREAKFAST', icon: Coffee },
    { id: 'LUNCH', label: 'LUNCH', icon: Pizza },
    { id: 'SNACKS', label: 'SNACKS', icon: Cookie },
    { id: 'DRINKS', label: 'DRINKS', icon: CupSoda }
  ];

  // Filtering logic
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCartQuantity = (id: string) => {
    return cart.find(c => c.id === id)?.quantity || 0;
  };

  const cartItemCount = cart.reduce((acc, c) => acc + c.quantity, 0);

  return (
    <div className="relative min-h-screen bg-surface-lowest pb-36 text-on-surface">
      {/* Top App Bar Header sticky */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full bg-[#0b1326]/80 backdrop-blur-xl border-b border-white/5 select-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-brand-purple/35 overflow-hidden bg-gradient-to-tr from-brand-purple to-brand-purple-dark text-white font-extrabold flex items-center justify-center font-display shadow-md">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-widest text-[#a3b8cc] font-black uppercase">
              CAMPUS ELITE FOODIE
            </span>
            <span className="text-xs text-white font-sans font-bold">
              {studentName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Points tracker shortcut */}
          <button
            type="button"
            onClick={() => setStudentTab('STORE')}
            className="flex items-center gap-1.5 bg-amber-400/10 px-3 py-1.5 rounded-full border border-amber-400/25 active:scale-95 transition-all cursor-pointer hover:bg-amber-400/15"
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="font-mono text-[10px] font-black text-amber-300">
              {studentPoints} PTS
            </span>
          </button>

          {/* Wallet Balance shortcut tracker */}
          <button 
            type="button"
            onClick={onOpenWallet}
            className="flex items-center gap-1.5 bg-brand-purple/10 px-3.5 py-1.5 rounded-full border border-brand-purple/25 active:scale-95 transition-all cursor-pointer hover:bg-brand-purple/15"
          >
            <Pocket className="w-3.5 h-3.5 text-brand-purple-light" />
            <span className="font-mono text-xs font-black text-white">
              ${walletBalance.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      <div className="px-5 mt-5 space-y-6">

        {/* Live Active Order Status Bar widget */}
        {activeOrder && (
          <div 
            onClick={() => onNavigateToTracking(activeOrder.id)}
            className="flex items-center justify-between p-3 rounded-xl border border-brand-green/35 bg-brand-green-dark/10 hover:bg-brand-green-dark/20 animate-pulse transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-green shrink-0" />
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-green tracking-wide">
                  ORDER IN PROCESS: {activeOrder.tokenNumber}
                </span>
                <span className="text-xs text-on-surface-variant font-sans">
                  Status: <strong className="text-white uppercase">{activeOrder.status}</strong>
                </span>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-brand-green shrink-0" />
          </div>
        )}

        {/* Search bar widget */}
        <section className="relative w-full">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-purple">
            <Search className="w-5 h-5" />
          </span>
          <input
            className="w-full h-12 bg-surface-mid/80 border border-white/5 rounded-full pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-1 focus:ring-brand-purple backdrop-blur-md transition-all"
            placeholder="Crave something delicious?"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </section>

        {/* Dynamic Categories Chips slider */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-display text-lg font-bold text-white tracking-tight">Categories</h2>
            <span 
              onClick={() => setSelectedCategory('ALL')} 
              className="text-brand-purple font-mono text-[10px] font-bold cursor-pointer hover:underline uppercase"
            >
              See All
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1">
            {categories.map((cat) => {
              const IconComp = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl min-w-[76px] transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-brand-purple text-surface-lowest shadow-lg shadow-brand-purple/20' 
                      : 'glass-bg glass-stroke hover:bg-white/5'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                    isActive ? 'bg-white/95 text-brand-purple' : 'bg-white/5 text-brand-purple-light'
                  }`}>
                    <IconComp className="w-5 h-5 shrink-0" />
                  </div>
                  <span className={`font-mono text-[9px] font-bold uppercase ${
                    isActive ? 'text-surface-lowest' : 'text-on-surface-variant'
                  }`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Promotional Banner Sliders */}
        <section className="overflow-hidden py-1">
          <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory">
            {/* Banner slide 1 */}
            <div className="relative min-w-[85vw] sm:min-w-[70vw] h-40 rounded-2xl overflow-hidden shrink-0 snap-center select-none shadow-md">
              <img 
                className="absolute inset-0 w-full h-full object-cover brightness-70"
                alt="Midnight Ramen Feast" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAUCKwxhpP_iqnQHvQQ72Fo4FLFt6wZfPImijIoaptIfYezLC8kclZgy2h_GnRq_vZcMnlN7R7CCk6od4x7WLPqdG1fQlcCmWaIK7QwejF9KzKXedZgc7Y_YJ8_1W7iW7_K2KJ5jhkFXkq0hLS8Zusw3p_v1wd2Kq0b-NeP87lO4-nM9NZt_F-aYjIfIU7fnQJwfU-DWzNvprzSDoP91nNw80o2EEqk9VnwBwQCVvLzo4gt6wZkDTJCMvhQPkCxc_gSPUiIM7s_nKs"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-lowest via-transparent to-transparent opacity-85" />
              <div className="absolute bottom-3 left-4 right-4">
                <span className="bg-brand-green text-brand-green-dark text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  TRENDING TODAY
                </span>
                <h3 className="font-display text-sm font-extrabold text-white mt-1">Midnight Ramen Fest</h3>
                <p className="font-sans text-[10px] text-on-surface-variant">Get 20% off on all bowls after 8 PM</p>
              </div>
            </div>

            {/* Banner slide 2 */}
            <div className="relative min-w-[85vw] sm:min-w-[70vw] h-40 rounded-2xl overflow-hidden shrink-0 snap-center select-none shadow-md">
              <img 
                className="absolute inset-0 w-full h-full object-cover brightness-70"
                alt="Express Grill Station" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJhi0rXTCxqvsRuM2L-pvemHDy3uuUtOWKDHWTCdP_Zm62SfpVv6dyI7JkZDYlF70Nw2p6uH_mAtZ5D7UV0p-pOB1qny2_XQkYcNHeNL7BMW6CqMIFOjRhnjrwweUd1bPEW8qGYmEt1x3a_NWZgxk4vnfZhSlllGpbM67jg_MsOve4Zkqhen4KWsBxl-B4dVoqSgT6nTOhT24dErmKzCwCbMynWh4oUKiaunnIpeBZHlQb3NmDC-q6y3Kh2FHj-lS6MHt1alWH9Zo"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-lowest via-transparent to-transparent opacity-85" />
              <div className="absolute bottom-3 left-4 right-4">
                <span className="bg-brand-purple text-brand-purple-dark text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  FASTEST DISPATCH
                </span>
                <h3 className="font-display text-sm font-extrabold text-white mt-1">Express Grill Station</h3>
                <p className="font-sans text-[10px] text-on-surface-variant">Hot breakfast combos under 5 minutes</p>
              </div>
            </div>
          </div>
        </section>

        {/* Double Column Products Menu grid list */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-lg font-bold text-white tracking-tight">
              {selectedCategory === 'ALL' ? 'Recommended for You' : `${selectedCategory} catalog`}
            </h2>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm font-sans text-on-surface-variant">No meals match your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const q = getCartQuantity(item.id);
                const isOutOfStock = item.stock <= 0;

                return (
                  <div key={item.id} className="flex flex-col glass-bg glass-stroke rounded-2xl overflow-hidden hover:border-brand-purple/20 transition-all group">
                    {/* Food Product Cover Card */}
                    <div className="relative aspect-[4.2/5] overflow-hidden select-none bg-surface-mid">
                      <img 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        alt={item.name} 
                        src={item.image}
                      />
                      
                      {/* Specific badge configurations */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        {item.originalPrice && (
                          <span className="bg-yellow-400 text-black text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-md">
                            BEST SELLER
                          </span>
                        )}
                        {item.isFast ? (
                          <span className="bg-brand-green text-brand-green-dark text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-md">
                            FAST PICKUP
                          </span>
                        ) : (
                          <span className="bg-brand-purple text-brand-purple-dark text-[8px] font-mono font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-md">
                            PREPARATION
                          </span>
                        )}
                      </div>

                      {/* Stock warnings */}
                      {isOutOfStock ? (
                        <div className="absolute inset-0 bg-surface-lowest/70 backdrop-blur-xs flex items-center justify-center p-2 z-10">
                          <span className="text-white font-mono text-[9px] font-black border border-brand-green px-2 py-1 bg-brand-green-dark/30 rounded-md tracking-wider">
                            SOLD OUT
                          </span>
                        </div>
                      ) : (
                        item.stock <= 4 && (
                          <div className="absolute bottom-2 left-2 z-10">
                            <span className="text-[8px] font-mono font-black px-2 py-0.5 bg-brand-green/20 border border-brand-green/50 text-brand-green rounded-md">
                              ONLY {item.stock} LEFT
                            </span>
                          </div>
                        )
                      )}
                    </div>

                    {/* Metadata Content area */}
                    <div className="p-3.5 flex flex-col justify-between flex-grow gap-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-display font-black text-xs sm:text-sm text-white leading-tight">
                            {item.name}
                          </h4>
                          <span className="text-brand-purple font-mono font-extrabold text-xs shrink-0">
                            ${item.price.toFixed(2)}
                          </span>
                        </div>
                        <p className="font-sans text-[10px] text-on-surface-variant/80 line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex justify-between items-center pt-1 border-t border-white/5">
                        <div className="flex items-center gap-2 text-[9px] text-on-surface-variant font-mono">
                          <div className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-brand-purple" />
                            <span>{item.isFast ? '4m' : '12m'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-brand-purple" />
                            <span>qt: {item.stock}</span>
                          </div>
                        </div>

                        {/* Interactive Quantity Increment HUD controls */}
                        {!isOutOfStock && (
                          <div className="flex items-center gap-1.5">
                            {q > 0 ? (
                              <div className="flex items-center bg-brand-purple-dark/40 border border-brand-purple/20 rounded-full p-0.5">
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs text-brand-purple-light hover:bg-brand-purple/25 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs font-black px-1.5 text-white">
                                  {q}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => addToCart(item.id)}
                                  className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs text-brand-purple-light hover:bg-brand-purple/25 cursor-pointer"
                                  disabled={q >= 3 || q >= item.stock}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(item.id)}
                                className="w-6 h-6 rounded-full bg-brand-purple hover:bg-brand-purple-light text-surface-lowest flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer"
                              >
                                <span className="text-sm font-extrabold">+</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Slide-Up Bottom Drawer review if Cart has items */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-5 pb-5">
          <div className="w-full max-w-lg mx-auto bg-surface-high/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-slide-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center border border-brand-purple/30">
                <ShoppingCart className="w-5 h-5 text-brand-purple animate-bounce" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-black text-white uppercase">
                  {cartItemCount} item{cartItemCount > 1 ? 's' : ''} added
                </span>
                <span className="font-sans text-[10px] text-on-surface-variant">
                  Total Basket Price
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-base font-black text-brand-purple-light">
                ${getCartTotal().toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => setStudentTab('TRACKING')} // triggers payment panel view
                className="px-4 h-10 rounded-full bg-brand-purple hover:bg-brand-purple-light text-surface-lowest text-xs font-mono font-bold tracking-widest flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-md shadow-brand-purple/25"
              >
                CHECKOUT
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
