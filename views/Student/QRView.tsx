/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder } from '../../services/firestore-db';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQRPayloadSync } from '../../services/qr';
import { Lock, CheckCircle2, ArrowLeft, RefreshCw, Sparkles, ShoppingBag, AlertCircle } from 'lucide-react';
import { Order, CartItem } from '../../types';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

const ITEM_COLOR_MAP: Record<string, { color: string; label: string; emoji: string }> = {
  'BKT01': { color: '#94A3B8', label: 'IDLI (2PCS)',   emoji: '⚪' },
  'BKT03': { color: '#F97316', label: 'MASALA DOSA',  emoji: '🟠' },
  'BKT06': { color: '#D946EF', label: 'ONION DOSA',   emoji: '🟣' },
  'BKT04': { color: '#22C55E', label: 'SET DOSA',     emoji: '🟢' },
  'BKT10': { color: '#F43F5E', label: 'BREAD OMELETTE', emoji: '🔴' },
  'BKT11': { color: '#b76dff', label: '2 IDLI + 2 MIRCHI', emoji: '🍽️' },
  'LCH01': { color: '#EAB308', label: 'PLATE MEAL',   emoji: '🟡' },
  'BEV01': { color: '#3B82F6', label: 'CHAI / TEA',   emoji: '🔵' },
  'BEV02': { color: '#3B82F6', label: 'COFFEE',       emoji: '🔵' },
};

const DEFAULT_COLOR = { color: '#8B5CF6', label: 'ITEM', emoji: '⭐' };
const getItemConfig = (itemId: string) => ITEM_COLOR_MAP[itemId] || DEFAULT_COLOR;

const getItemBadge = (item: CartItem): 'SERVED' | 'READY' | 'COOKING' | 'QUEUED' => {
  if (item.status === 'SERVED' || item.status === 'COMPLETED') return 'SERVED';
  if (item.status === 'READY') return 'READY';
  if (item.status === 'PREPARING' || item.status === 'QUEUED') return 'COOKING';
  return 'QUEUED';
};

export const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  const { menuItems } = useApp();

  const [order, setOrder] = useState<Order | null>(() => {
    try {
      const opt = sessionStorage.getItem('joe_optimistic_order');
      if (opt) {
        const parsed = JSON.parse(opt);
        if (parsed.id === orderId) return parsed;
      }
    } catch {}
    return null;
  });

  const [liveItems, setLiveItems] = useState<any[]>(() => {
    try {
      const opt = sessionStorage.getItem('joe_optimistic_order');
      if (opt) {
        const parsed = JSON.parse(opt);
        if (parsed.id === orderId) return parsed.items || [];
      }
    } catch {}
    return [];
  });

  const [loading, setLoading] = useState(!order);
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [tickerTime, setTickerTime] = useState('');

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Secure rotating milliseconds ticker
  useEffect(() => {
    let active = true;
    const updateTime = () => {
      if (!active) return;
      const now = new Date();
      const secs = now.getSeconds().toString().padStart(2, '0');
      const ms = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
      setTickerTime(`SECURE TICKET SECS: ${secs}:${ms}`);
      requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => { active = false; };
  }, []);

  // Real-time order doc updates
  useEffect(() => {
    if (!orderId) return;
    return listenToOrder(orderId, (data) => {
      if (!isMounted.current) return;
      if (data) {
        setOrder(data);
        setLoading(false);
      }
    });
  }, [orderId]);

  // Real-time item subcollection updates
  useEffect(() => {
    if (!orderId) return;
    const q = query(collection(db, 'orders', orderId, 'items'));
    return onSnapshot(
      q,
      (snap) => {
        if (!isMounted.current) return;
        if (!snap.empty) {
          setLiveItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      },
      (error) => {
        console.warn(`[QRView:items] Live items listener stopped: ${error.message}`);
      }
    );
  }, [orderId]);

  // Merge items data
  const items = useMemo(() => {
    if (!order) return [];
    return (order.items || []).map(root => {
      const live = liveItems.find(it => it.id === root.id || it.itemId === root.id);
      return live ? { ...root, ...live } : root;
    });
  }, [order, liveItems]);

  const isFullyServed = useMemo(() => items.length > 0 && items.every(it => it.status === 'SERVED' || it.status === 'COMPLETED'), [items]);
  const isDone = isFullyServed || order?.orderStatus === 'COMPLETED' || order?.orderStatus === 'SERVED';
  const isMissed = order?.orderStatus === 'MISSED';

  // Back to menu redirect once order is complete
  useEffect(() => {
    if (isDone) {
      const timer = setTimeout(() => { onBack(); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isDone, onBack]);

  if (loading || !order) {
    return (
      <div className="min-h-screen bg-surface-lowest flex flex-col items-center justify-center p-6 text-center text-on-surface max-w-md mx-auto border-x border-white/5 shadow-2xl">
        <Sparkles className="w-12 h-12 text-brand-purple mb-4 animate-spin" />
        <h3 className="font-display text-lg font-bold">Connecting...</h3>
      </div>
    );
  }

  const activeItem = items[activeItemIdx] || items[0];
  if (!activeItem) return null;

  const itemConfig = getItemConfig(activeItem.id);
  const badge = getItemBadge(activeItem);
  const isAlreadyServed = activeItem.status === 'SERVED' || activeItem.status === 'COMPLETED';
  const isOrderPaid = order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'VERIFIED';
  const isQRActive = order.qrStatus === 'ACTIVE' || order.qr?.status === 'ACTIVE';

  // Supervisor has clicked "Notify Ready" → sets serveFlowStatus = 'READY' on the order
  const supervisorNotified = order.serveFlowStatus === 'READY';

  // Classify if this order has dynamic (live-prep) items — dosa, omelette, etc.
  // These MUST stay locked until supervisor explicitly clicks "Notify Ready"
  const isDynamicOrder = (order.items || []).some(it => {
    const n = (it.name || '').toLowerCase();
    const c = (it.category || '').toLowerCase();
    if (c === 'beverages') return false;
    return (
      n.includes('dosa') ||
      n.includes('omelette') ||
      n.includes('egg') ||
      n.includes('puri') ||
      n.includes('vada') ||
      n.includes('idli') ||
      n.includes('roti') ||
      n.includes('chapati')
    );
  });

  // ═══ QR UNLOCK GATE ══════════════════════════════════════════════
  //   DYNAMIC items (dosa/omelette/etc.):
  //     ❌ LOCKED  → payment confirmed but supervisor has NOT clicked Notify Ready
  //     ✅ UNLOCKED → supervisor clicked Notify Ready (serveFlowStatus === 'READY')
  //
  //   STATIC/FAST items (coffee, packaged, etc.):
  //     ✅ UNLOCKED → payment confirmed and qrStatus is ACTIVE
  // ════════════════════════════════════════════════════
  const qrUnlocked =
    !isMissed &&
    !isAlreadyServed &&
    isOrderPaid &&
    (isDynamicOrder
      ? supervisorNotified                 // dynamic: wait for supervisor
      : isQRActive || badge === 'READY'    // static: payment confirmed = unlock
    );

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface max-w-md mx-auto border-x border-white/5 shadow-2xl">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            disabled={isFullyServed}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5 text-brand-purple" />
          </button>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-widest text-brand-purple-light uppercase leading-none">ACTIVE SERVINGS</span>
            <h1 className="font-display font-black text-white text-md mt-1 leading-none">Token QR</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface-high border border-white/5 px-4 py-1.5 rounded-full select-none">
          <span className="font-mono text-xs font-black text-brand-purple-light tracking-widest uppercase">
            {order.tokenNumber ? `#${order.tokenNumber}` : `#${order.id.slice(-6).toUpperCase()}`}
          </span>
        </div>
      </header>

      {/* Main token display */}
      <main className="px-5 mt-6 space-y-6">
        {/* Carousel indicators if multiple items */}
        {items.length > 1 && !isFullyServed && (
          <section className="space-y-2 select-none">
            <p className="font-mono text-[9px] text-zinc-500 text-center tracking-widest uppercase">
              Tapping indexes switch token codes
            </p>
            <div className="flex justify-center gap-2 py-1 bg-surface-high/30 rounded-2xl border border-white/5 p-2 overflow-x-auto hide-scrollbar">
              {items.map((it, idx) => {
                const details = menuItems.find(m => m.id === it.id);
                const isServed = it.status === 'SERVED' || it.status === 'COMPLETED';
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveItemIdx(idx)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shrink-0 ${
                      activeItemIdx === idx
                        ? 'border-brand-purple bg-brand-purple/10 text-brand-purple-light'
                        : 'border-white/5 bg-white/5 hover:bg-white/10 text-zinc-400'
                    }`}
                  >
                    <span>{details?.name.split(' ')[0]}</span>
                    {isServed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-green font-black" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Token Card Base */}
        <section className="flex flex-col items-center">
          <div 
            className={`p-4 rounded-[2.5rem] bg-surface-mid w-full max-w-[300px] aspect-[0.85/1] flex flex-col justify-between border transition-all relative overflow-hidden ${
              qrUnlocked ? 'border-white/10' : 'border-white/5 shadow-2xl'
            }`}
            style={{
              boxShadow: qrUnlocked ? `0 0 25px ${(itemConfig.color || '#b76dff')}25` : undefined
            }}
          >
            
            {/* Countdown seconds milliseconds ticker */}
            <div className="flex justify-between items-center bg-surface-lowest/50 backdrop-blur-md border border-white/5 px-3 py-1 rounded-full z-10 w-full select-none">
              <span className="font-mono text-[8px] font-black tracking-widest text-brand-purple-light">
                {tickerTime}
              </span>
              <RefreshCw className="w-2.5 h-2.5 text-brand-purple animate-spin" />
            </div>

            {/* QR block or locker state */}
            <div className="relative w-full aspect-square flex items-center justify-center p-2 z-10 select-none">
              
              {/* ⚡ SONIC LASER BORDER (Item Color Linked) */}
              {qrUnlocked && (
                <div 
                  className="laser-container" 
                  style={{ 
                    '--laser-color': itemConfig.color || '#b76dff',
                    filter: `drop-shadow(0 0 10px ${itemConfig.color || '#b76dff'}) drop-shadow(0 0 3px ${itemConfig.color || '#b76dff'})`
                  } as React.CSSProperties}
                >
                  <div className="laser-line" />
                  <div className="laser-mask" style={{ background: '#ffffff' }} />
                </div>
              )}

              <div className={`relative w-full h-full rounded-[2.8rem] overflow-hidden bg-white flex items-center justify-center z-10 transition-all duration-700 p-4 border border-gray-100 shadow-inner`}>
                {isFullyServed || isAlreadyServed ? (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-brand-green/10 border border-brand-green flex items-center justify-center mb-2 animate-bounce">
                      <CheckCircle2 className="w-10 h-10 text-brand-green" />
                    </div>
                    <span className="font-display font-black text-slate-800 uppercase text-sm">
                      Handover Complete!
                    </span>
                    <span className="font-sans text-[10px] text-zinc-400 mt-1 leading-none">
                      Hope to see you soon
                    </span>
                  </div>
                ) : isMissed ? (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500 flex items-center justify-center mb-2 animate-pulse">
                      <AlertCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <span className="font-display font-black text-red-600 uppercase text-sm">
                      Window Missed
                    </span>
                  </div>
                ) : !qrUnlocked ? (
                  // Locked state — explain exactly why
                  <div className="absolute inset-0 bg-surface-lowest/90 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center p-4 rounded-[2rem] z-20">
                    <div className="w-11 h-11 rounded-full bg-brand-purple-dark/30 border border-brand-purple/40 flex items-center justify-center mb-2">
                      <Lock className="w-5 h-5 text-brand-purple animate-pulse" />
                    </div>
                    <h4 className="font-display font-bold text-xs text-brand-purple-light uppercase text-center tracking-wider leading-relaxed">
                      {!isOrderPaid
                        ? 'Payment Pending'
                        : isDynamicOrder
                          ? 'Being Prepared'
                          : 'Preparing Your Food'}
                    </h4>
                    <p className="font-sans text-[9px] text-zinc-400 max-w-[80%] text-center leading-normal mt-1.5">
                      {!isOrderPaid
                        ? 'Waiting for cashier to confirm your payment.'
                        : isDynamicOrder
                          ? 'Your QR unlocks the moment kitchen staff marks your food ready. You will get a push notification!'
                          : 'Your QR token unlocks once payment is confirmed.'}
                    </p>
                  </div>
                ) : (
                  // Full QR Code Display
                  <div className="relative w-full h-full p-2 bg-white flex items-center justify-center rounded-xl overflow-hidden">
                    <QRCodeSVG 
                      value={generateQRPayloadSync(order, activeItem.id)} 
                      size={200} 
                      level="M" 
                      fgColor="#000000" 
                      bgColor="#FFFFFF" 
                    />
                    {/* Sliding laser beam scanner effect */}
                    <div className="absolute inset-x-0 h-0.5 bg-brand-purple shadow-[0_0_8px_#b76dff] z-30 animate-scan pointer-events-none" />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom branding footer */}
            <div className="text-center z-10 w-full pt-1.5 border-t border-white/5 font-mono text-[8px] text-zinc-500 select-none">
              VERIFIED TICKET COMS • DIGITAL PILOT NO# 8842
            </div>

          </div>
        </section>

        {/* Selected Item detail panel */}
        <section className="glass-bg glass-stroke p-4 rounded-2xl flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-mid shrink-0 flex items-center justify-center">
            <img 
              className="w-full h-full object-cover" 
              alt={activeItem.name} 
              src={menuItems.find(m => m.id === activeItem.id || m.name === activeItem.name)?.imageUrl || activeItem.imageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeItem.name)}`} 
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                const menuDetail = menuItems.find(m => m.name === activeItem.name || m.id === activeItem.id);
                if (menuDetail?.imageUrl && target.src !== menuDetail.imageUrl) {
                  target.src = menuDetail.imageUrl;
                } else {
                  target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeItem.name)}`;
                }
              }}
            />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[9px] text-brand-purple tracking-widest uppercase">
                {activeItem.category}
              </span>
              <span className="font-mono text-xs text-brand-green font-bold uppercase leading-none">
                {activeItem.status}
              </span>
            </div>
            <h3 className="font-display font-extrabold text-xs text-white truncate mt-1">
              {activeItem.quantity}x {activeItem.name}
            </h3>
            <p className="font-sans text-[10px] text-on-surface-variant mt-0.5">
              Total price: ₹{(activeItem.price * activeItem.quantity).toFixed(2)}
            </p>
          </div>
        </section>

        {/* Action button */}
        <div className="pt-2 select-none">
          <button 
            onClick={onViewOrders}
            className="w-full py-4.5 bg-[#171f33]/60 hover:bg-white/5 text-white border border-white/10 rounded-full text-xs font-mono font-bold tracking-widest active:scale-95 transition-all cursor-pointer text-center"
          >
            Review All Receipts
          </button>
        </div>
      </main>
    </div>
  );
};

export default QRView;
