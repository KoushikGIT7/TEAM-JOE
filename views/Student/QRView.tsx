import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ChevronLeft, CheckCircle2, ChefHat, Clock, Check, PackageCheck, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { listenToOrder } from '../../services/firestore-db';
import { Order, CartItem } from '../../types';
import { shouldShowQR } from '../../utils/orderLifecycle';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateQRPayloadSync } from '../../services/qr';
import FoodLoader from '../../components/Common/FoodLoader';

interface QRViewProps {
  orderId: string;
  onBack: () => void;
  onViewOrders?: () => void;
}

const ITEM_COLOR_MAP: Record<string, { color: string; glow: string; label: string; emoji: string }> = {
  'BKT01': { color: '#EF4444', glow: 'rgba(239,68,68,0.7)',   label: 'IDLI (2PCS)',   emoji: '🔴' },
  'BKT08': { color: '#EF4444', glow: 'rgba(239,68,68,0.7)',   label: 'POHA',         emoji: '🔴' },
  'BKT09': { color: '#EF4444', glow: 'rgba(239,68,68,0.7)',   label: 'UPMA',         emoji: '🔴' },
  'BKT03': { color: '#F97316', glow: 'rgba(249,115,22,0.7)',  label: 'MASALA DOSA',  emoji: '🟠' },
  'BKT06': { color: '#F97316', glow: 'rgba(249,115,22,0.7)',  label: 'ONION DOSA',   emoji: '🟠' },
  'BKT10': { color: '#F97316', glow: 'rgba(249,115,22,0.7)',  label: 'BREAD OMELETTE', emoji: '🟠' },
  'BKT04': { color: '#22C55E', glow: 'rgba(34,197,94,0.7)',   label: 'SET DOSA',     emoji: '🟢' },
  'BKT02': { color: '#22C55E', glow: 'rgba(34,197,94,0.7)',   label: 'TOMATO BATH',  emoji: '🟢' },
  'BKT05': { color: '#22C55E', glow: 'rgba(34,197,94,0.7)',   label: 'LEMON RICE',   emoji: '🟢' },
  'BKT07': { color: '#22C55E', glow: 'rgba(34,197,94,0.7)',   label: 'MEDU VADA',    emoji: '🟢' },
  'LCH01': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'PLATE MEAL',   emoji: '🟡' },
  'LCH02': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'EGG RICE',     emoji: '🟡' },
  'LCH03': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'JEERA RICE',   emoji: '🟡' },
  'LCH04': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'EGG BHURJI',   emoji: '🟡' },
  'LCH05': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'MASALA OMELETTE', emoji: '🟡' },
  'LCH06': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'VEG BIRYANI',  emoji: '🟡' },
  'LCH07': { color: '#EAB308', glow: 'rgba(234,179,8,0.7)',   label: 'CURD RICE',    emoji: '🟡' },
  'BEV01': { color: '#3B82F6', glow: 'rgba(59,130,246,0.7)',  label: 'CHAI / TEA',   emoji: '🔵' },
  'BEV02': { color: '#3B82F6', glow: 'rgba(59,130,246,0.7)',  label: 'COFFEE',       emoji: '🔵' },
  'BEV03': { color: '#3B82F6', glow: 'rgba(59,130,246,0.7)',  label: 'HOT MILK',     emoji: '🔵' },
};

const DEFAULT_COLOR = { color: '#8B5CF6', glow: 'rgba(139,92,246,0.7)', label: 'ITEM', emoji: '⭐' };
const getItemConfig = (itemId: string) => ITEM_COLOR_MAP[itemId] || DEFAULT_COLOR;

const getItemBadge = (item: CartItem): 'SERVED' | 'READY' | 'COOKING' | 'QUEUED' => {
  if (item.status === 'SERVED' || item.status === 'COMPLETED') return 'SERVED';
  if (item.status === 'READY') return 'READY';
  if (item.status === 'PREPARING' || item.status === 'QUEUED') return 'COOKING';
  return 'QUEUED';
};

const DOSA_LOCK_IDS = new Set(['BKT03', 'BKT04', 'BKT06']);

interface RichQRCardProps {
  qrString: string;
  activeItem: CartItem;
  isVisible: boolean;
  isServed: boolean;
  isMissed: boolean;
  activeColors: string[];
}

const RichQRCard: React.FC<RichQRCardProps> = ({
  qrString, activeItem, isVisible, isServed, isMissed, activeColors
}) => {
  const badge = getItemBadge(activeItem);
  const qty = activeItem.quantity ?? 1;
  const config = getItemConfig(activeItem.id);
  const isDosaType = DOSA_LOCK_IDS.has(activeItem.id);
  const qrUnlocked = isVisible && !isMissed && (!isDosaType || (badge !== 'QUEUED' && badge !== 'COOKING'));

  return (
    <div className="flex flex-col items-center">
      <div className="relative p-1.5 rounded-[3rem] transition-all duration-700">
        
        {/* 🌀 HIGH-VELOCITY RAINBOW LASER (Anti-Screenshot) */}
        <div className="absolute -inset-10 z-0 overflow-hidden rounded-[50%] blur-3xl pointer-events-none opacity-40">
           <div 
             className="absolute -inset-[50%] animate-rotate" 
             style={{ 
               background: `conic-gradient(from 0deg, #3b82f6, #ef4444, #22c55e, #eab308, #3b82f6)`
             }}
           />
        </div>

        <div className="relative w-[280px] h-[280px] rounded-[3rem] overflow-hidden bg-white shadow-2xl border-[6px] border-gray-50 flex items-center justify-center z-10 transition-transform duration-500 hover:scale-[1.02]">
          
          {/* ⚡ LASER SCAN LINE */}
          {qrUnlocked && (
            <div className="absolute inset-x-0 h-0.5 bg-emerald-500/40 blur-[2px] z-30 animate-scan pointer-events-none" />
          )}

          <div className={`transition-all duration-700 bg-white p-5 rounded-3xl shadow-inner contrast-[1.25] ${qrUnlocked ? 'opacity-100 blur-0 scale-100' : 'opacity-5 blur-2xl scale-95 pointer-events-none'}`}>
            <QRCodeSVG value={qrString} size={230} level="M" fgColor="#000000" bgColor="#FFFFFF" />
          </div>

          {/* 🛡️ LIVE SECURITY TICK (Prevents Screenshots) */}
          {qrUnlocked && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
               <span className="text-[10px] font-mono font-black text-white tracking-widest whitespace-nowrap">
                 {(new Date()).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                 <span className="opacity-50 ml-1">.{(Date.now() % 1000).toString().padStart(3, '0').slice(0, 1)}s</span>
               </span>
            </div>
          )}

          {qrUnlocked && (
            <div className="absolute bottom-4 right-4 z-20">
              <div className="text-white text-sm font-black px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5" style={{ background: config.color }}>
                <span className="text-[10px] opacity-70">QTY</span>
                <span className="text-base leading-none">{qty}</span>
              </div>
            </div>
          )}

          {!qrUnlocked && !isServed && !isMissed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95 animate-in fade-in duration-500">
               <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-xl ${badge === 'COOKING' ? 'bg-orange-500' : 'bg-gray-800'}`}>
                 {badge === 'COOKING' ? <ChefHat className="w-10 h-10 text-white" /> : <Clock className="w-10 h-10 text-white" />}
               </div>
               <div className="text-center px-6">
                 <p className="text-lg font-black text-gray-900 tracking-tight">{badge === 'COOKING' ? 'Cooking Now' : 'Queued'}</p>
                 <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-1.5">QR unlocks when ready</p>
               </div>
            </div>
          )}

          {isMissed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/98 z-30 animate-in fade-in duration-500">
              <AlertCircle className="w-14 h-14 text-amber-500" />
              <p className="text-sm font-black text-gray-800 uppercase tracking-widest">Window Missed</p>
            </div>
          )}

          {isServed && (
            <div className="absolute inset-0 bg-white/97 flex flex-col items-center justify-center animate-in fade-in duration-500 z-40">
              <CheckCircle2 className="w-20 h-20 text-green-500 mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-600">Served</span>
            </div>
          )}
        </div>
      </div>

      <div className={`mt-6 px-6 py-3 rounded-full flex items-center gap-4 transition-all duration-700 shadow-lg ${qrUnlocked ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-50'}`} style={{ background: qrUnlocked ? config.color : '#f1f5f9' }}>
        <span className="text-xl">{config.emoji}</span>
        <div className="flex flex-col">
          <p className={`text-xs font-black uppercase tracking-[0.1em] ${qrUnlocked ? 'text-white' : 'text-gray-400'}`}>{config.label}</p>
          <p className={`text-[9px] font-bold ${qrUnlocked ? 'text-white/80' : 'text-gray-400'}`}>
            {qrUnlocked ? `Fresh & Ready for Scan` : 'Being Prepared in Kitchen'}
          </p>
        </div>
        {qrUnlocked && <div className="ml-2 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-white">x{qty}</div>}
      </div>
    </div>
  );
};

const ItemDotByQR: React.FC<{ item: CartItem; isActive: boolean; onClick: () => void }> = ({ item, isActive, onClick }) => {
  const config = getItemConfig(item.id);
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all ${isActive ? 'scale-110' : 'scale-90 opacity-60'}`}>
      <div className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center text-xl transition-all ${isActive ? 'shadow-lg border-gray-900 bg-white' : 'border-gray-100 bg-gray-50'}`} style={{ borderColor: isActive ? config.color : undefined }}>
        {item.status === 'SERVED' || item.status === 'COMPLETED' ? <Check className="w-6 h-6 text-green-500" /> : config.emoji}
      </div>
    </button>
  );
};

const QRView: React.FC<QRViewProps> = ({ orderId, onBack, onViewOrders }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [liveItems, setLiveItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashState, setFlashState] = useState<'GREEN' | 'RED' | null>(null);
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [tick, setTick] = useState(0);

  const isMounted = useRef(true);
  const prevItemsRef = useRef<any[] | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const items = useMemo(() => {
    if (!order) return [];
    return (order.items || []).map(root => {
      const live = liveItems.find(it => it.id === root.id || it.itemId === root.id);
      return live ? { ...root, ...live } : root;
    });
  }, [order, liveItems]);

  const isFullyServed = useMemo(() => items.length > 0 && items.every(it => it.status === 'SERVED' || it.status === 'COMPLETED'), [items]);
  const qrVisible = !!order && (shouldShowQR(order) || items.some(i => i.status === 'READY'));
  const isDone = isFullyServed || order?.orderStatus === 'COMPLETED' || order?.orderStatus === 'SERVED';
  const isMissed = order?.orderStatus === 'MISSED';

  useEffect(() => {
    if (!qrVisible || isDone) return;
    const interval = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(interval);
  }, [qrVisible, isDone]);

  useEffect(() => {
    if (!orderId) return;
    return listenToOrder(orderId, (data) => {
      if (!isMounted.current) return;
      setOrder(data);
      setLoading(false);
    });
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    const q = query(collection(db, 'orders', orderId, 'items'));
    return onSnapshot(q, (snap) => {
      if (!isMounted.current) return;
      setLiveItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [orderId]);

  const activeColors = useMemo(() => {
    if (!order) return ['#3b82f6'];
    const colors: string[] = [];
    items.forEach(it => {
      if (it.status === 'READY') {
        const config = getItemConfig(it.id);
        if (!colors.includes(config.color)) colors.push(config.color);
      }
    });
    return colors.length > 0 ? colors : ['#3b82f6'];
  }, [order, items]);

  useEffect(() => {
    if (items.length === 0 || !prevItemsRef.current) {
      prevItemsRef.current = items;
      return;
    }
    
    let gotReady = false;
    items.forEach(it => {
      const prev = prevItemsRef.current!.find(p => p.id === it.id);
      if (prev && prev.status !== 'READY' && it.status === 'READY') gotReady = true;
    });

    if (gotReady) {
      setFlashState('GREEN');
      if ('vibrate' in navigator) navigator.vibrate([50, 50, 150]);
      if ('speechSynthesis' in window && !isFullyServed) {
         const msg = new SpeechSynthesisUtterance("Food is ready! Head to the counter.");
         msg.rate = 1.3;
         window.speechSynthesis.speak(msg);
      }
      setTimeout(() => setFlashState(null), 2500);
    }
    prevItemsRef.current = items;
  }, [items, isFullyServed]);

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white"><FoodLoader /></div>;
  if (!order) return <div className="h-screen w-full flex items-center justify-center bg-white">Order missing</div>;

  const activeItem = items[activeItemIdx] || items[0];

  return (
    <div className="min-h-screen w-full max-w-md mx-auto flex flex-col bg-white overflow-x-hidden font-sans select-none relative">
      <div className="px-6 py-8 flex items-center justify-between">
        <button onClick={onBack} className="p-3 bg-gray-50 rounded-2xl active:scale-95 transition-all">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Order ID</p>
          <p className="text-sm font-black text-gray-900 tracking-tight italic">#{orderId.slice(-6).toUpperCase()}</p>
        </div>
      </div>

      <div className="px-8 mb-8 text-center text-balance">
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter leading-none mb-2">
          {isDone ? 'Enjoy your meal!' : isMissed ? 'Slot Missed' : 'Scan to Collect'}
        </h1>
        <p className="text-sm font-bold text-gray-400 leading-tight">
          {isDone ? 'Handover completed successfully.' : 'Your QR code will unlock as soon as food is ready.'}
        </p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <RichQRCard 
          qrString={order.qr?.token || generateQRPayloadSync(order)}
          activeItem={activeItem}
          isVisible={qrVisible}
          isServed={isDone}
          isMissed={isMissed}
          activeColors={activeColors}
        />
      </div>

      {items.length > 1 && (
        <div className="px-6 py-6 border-t border-gray-50 bg-gray-50/30 overflow-x-auto">
          <div className="flex items-center justify-center gap-5">
            {items.map((item, idx) => (
              <ItemDotByQR key={idx} item={item} isActive={activeItemIdx === idx} onClick={() => setActiveItemIdx(idx)} />
            ))}
          </div>
        </div>
      )}

      <div className="px-6 pb-12 pt-4">
        <button 
          onClick={() => { if (onViewOrders) onViewOrders(); else onBack(); }}
          className="w-full py-5 bg-gray-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-gray-200"
        >
          {onViewOrders ? 'Review All Orders' : 'Back to Menu'}
        </button>
      </div>

      {isDone && (
         <div className="fixed inset-0 bg-white z-[100] flex flex-col items-center justify-center p-10 animate-in fade-in duration-500">
           <div className="w-40 h-40 bg-green-50 rounded-[3.5rem] flex items-center justify-center mb-10">
             <CheckCircle2 className="w-20 h-20 text-green-500" />
           </div>
           <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Meal Served!</h2>
           <p className="text-gray-400 font-bold text-center leading-relaxed max-w-xs mb-10 text-balance">
             Successfully handed over at the counter. Thank you!
           </p>
           <button onClick={onBack} className="w-full py-5 bg-green-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-lg">Done</button>
         </div>
      )}
    </div>
  );
};

export default QRView;
