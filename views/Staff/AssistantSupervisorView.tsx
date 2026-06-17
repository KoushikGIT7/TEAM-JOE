/**
 * AssistantSupervisorView — Kitchen Coordinator Dashboard
 * Theme: Cyber-Bento & Street-Tech (v2026 AI Era)
 * Role: Monitor dynamic items, notify ready (FCM + QR Unlock), display static counts.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { listenToActiveSupervisorOrders } from '../../services/firestore-db';
import { triggerOneSignalWebhook } from '../../services/onesignal-webhook';
import { Order, UserProfile, CartItem } from '../../types';
import { LogOut, Volume2, VolumeX, Clock, BellRing, RefreshCw, ChefHat } from 'lucide-react';
import { cseSounds } from '../../utils/audio';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
}

type Lang = 'EN' | 'TE';

const TRANSLATIONS = {
  EN: {
    title: "KUCafe Kitchen Coordinator",
    live: "LIVE QUEUE",
    logout: "Logout",
    langLabel: "తెలుగు",
    dynamicHeader: "🥞 Prepared Live (Dosa, Omelette, Breakfasts)",
    staticHeader: "📦 Continuous Prep (Fried Rice, Coffee, packaged items)",
    token: "Token",
    timeAgo: "ago",
    justNow: "Just now",
    notifyBtn: "🔔 Notify Ready",
    notifying: "Notifying...",
    emptyDynamic: "No active Dosa / Omelette orders. Kitchen is clear!",
    emptyStatic: "No static items in demand.",
    tellKitchen: "📢 Tell Kitchen",
    tip: "💡 Press 'Notify Ready' as soon as food is cooked. This automatically notifies the student and unlocks their collection QR code. Student scans it to complete handover."
  },
  TE: {
    title: "KUCafe కిచెన్ కోఆర్డినేటర్",
    live: "లైవ్ క్యూ",
    langLabel: "English",
    dynamicHeader: "🥞 లైవ్ తయారీ (దోశ, ఆమ్లెట్, టిఫిన్స్)",
    staticHeader: "📦 నిరంతర తయారీ (ఫ్రైడ్ రైస్, కాఫీ, మొదలైనవి)",
    token: "టోకెన్",
    timeAgo: "క్రితం",
    justNow: "ఇప్పుడే",
    notifyBtn: "🔔 సిద్ధంగా ఉంది చెప్పండి",
    notifying: "చెబుతున్నాము...",
    emptyDynamic: "వేడి దోశ లేదా ఆమ్లెట్ ఆర్డర్లు ఏమీ లేవు. కిచెన్ ప్రశాంతంగా ఉంది!",
    emptyStatic: "ఇతర వస్తువుల డిమాండ్ ఏమీ లేదు.",
    tellKitchen: "📢 కిచెన్‌కి చెప్పండి",
    tip: "💡 వంట పూర్తయిన తర్వాత 'సిద్ధంగా ఉంది చెప్పండి' నొక్కండి. ఇది విద్యార్థికి మెసేజ్ పంపి QR కోడ్ అన్‌లాక్ చేస్తుంది. విద్యార్థి స్కాన్ చేసినప్పుడు సర్వ్ అయినట్టు ఆటోమేటిక్‌గా అప్‌డేట్ అవుతుంది."
  }
};

export const AssistantSupervisorView: React.FC<Props> = ({ profile, onLogout }) => {
  const { menuItems } = useApp();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [lang, setLang] = useState<Lang>('TE'); // Default to Telugu
  const [audioStatus, setAudioStatus] = useState(cseSounds.getMutedState());
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [, setForceTick] = useState(0);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // New Order Received Local Chime & Telugu TTS Alert
  useEffect(() => {
    if (activeOrders.length === 0) return;

    if (isFirstLoadRef.current) {
      activeOrders.forEach(o => knownOrderIdsRef.current.add(o.id));
      isFirstLoadRef.current = false;
      return;
    }

    activeOrders.forEach(o => {
      if (!knownOrderIdsRef.current.has(o.id)) {
        knownOrderIdsRef.current.add(o.id);

        // Notify if the order was created recently (last 2 minutes)
        if (Date.now() - o.createdAt < 120000) {
          // Play local chime sound if not muted
          if (audioStatus !== 'Muted') {
            cseSounds.playIncomingAlert().catch(() => {});
          }

          // Telugu TTS announcement
          try {
            const rawToken = o.tokenNumber || o.id.slice(-4).toUpperCase();
            const tokenSpeech = rawToken.replace('#', '');
            const speakText = `కొత్త ఆర్డర్ వచ్చింది. టోకెన్ సంఖ్య ${tokenSpeech}.`;
            const utter = new SpeechSynthesisUtterance(speakText);
            utter.lang = 'te-IN';
            utter.rate = 0.85;
            
            if (typeof window !== 'undefined' && window.speechSynthesis) {
              window.speechSynthesis.speak(utter);
            }
          } catch (e) {
            console.error("Supervisor TTS error:", e);
          }
        }
      }
    });
  }, [activeOrders, audioStatus]);

  // Live Database Sync
  useEffect(() => {
    const unsubscribe = listenToActiveSupervisorOrders((updatedOrders) => {
      setActiveOrders(updatedOrders);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  // Time Ticker (every 10s)
  useEffect(() => {
    const interval = setInterval(() => {
      setForceTick(t => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Audio Subscription
  useEffect(() => {
    return cseSounds.subscribe(() => {
      setAudioStatus(cseSounds.getMutedState());
    });
  }, []);

  // Emojis for breakfast items
  const getEmoji = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('dosa')) return '🥞';
    if (n.includes('rice') || n.includes('biryani')) return '🍚';
    if (n.includes('omelette') || n.includes('egg')) return '🍳';
    if (n.includes('idli')) return '🍙';
    if (n.includes('vada')) return '🍩';
    if (n.includes('puri')) return '🫓';
    if (n.includes('chapati') || n.includes('roti')) return '🫓';
    if (n.includes('coffee') || n.includes('tea')) return '☕';
    if (n.includes('coke') || n.includes('soda') || n.includes('drink') || n.includes('juice')) return '🥤';
    return '🍽️';
  };

  // Helper to classify if item is dynamic (live breakfasts needing coordinator notify)
  const isDynamicItem = (name: string, cat?: string) => {
    const n = name.toLowerCase();
    const c = cat?.toLowerCase() || '';
    if (c === 'beverages') return false; // Beverages are static
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
  };

  // 1. FILTERED ACTIVE ORDERS (CASH or UPI success, not completed)
  const processedOrders = useMemo(() => {
    return activeOrders.filter(o => {
      const paymentType = o.paymentType || 'WALLET';
      const paymentStatus = o.paymentStatus;
      if (paymentType !== 'CASH' && paymentStatus !== 'SUCCESS' && paymentStatus !== 'VERIFIED') return false;
      if (o.orderStatus === 'SERVED' || o.orderStatus === 'COMPLETED' || o.orderStatus === 'CANCELLED') return false;
      return true;
    });
  }, [activeOrders]);

  // 2. PROCESS AND SMART SORT ITEMS
  const aggregatedDemands = useMemo(() => {
    const dynamics: Record<string, {
      name: string;
      itemId: string;
      isDynamic: boolean;
      students: { studentName: string; orderTime: string; orderId: string; userId: string; tokenNumber: string; createdAt: number; cartItem: CartItem }[];
    }> = {};

    const statics: Record<string, {
      name: string;
      itemId: string;
      isDynamic: boolean;
      count: number;
    }> = {};

    processedOrders.forEach(o => {
      const orderTimeStr = new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      o.items.forEach(it => {
        // Only count items that are NOT yet ready or served
        if (it.status === 'READY' || it.status === 'SERVED' || it.status === 'COMPLETED' || (it.status as string) === 'CANCELLED') return;

        const m = menuItems.find(item => item.id === it.id);
        const dynamic = isDynamicItem(it.name, m?.category);

        if (dynamic) {
          if (!dynamics[it.name]) {
            dynamics[it.name] = {
              name: it.name,
              itemId: it.id,
              isDynamic: true,
              students: []
            };
          }
          for (let i = 0; i < it.quantity; i++) {
            dynamics[it.name].students.push({
              studentName: o.userName || 'Student',
              orderTime: orderTimeStr,
              orderId: o.id,
              userId: o.userId,
              tokenNumber: o.tokenNumber,
              createdAt: o.createdAt,
              cartItem: it
            });
          }
        } else {
          // Static item
          if (!statics[it.name]) {
            statics[it.name] = {
              name: it.name,
              itemId: it.id,
              isDynamic: false,
              count: 0
            };
          }
          statics[it.name].count += it.quantity;
        }
      });
    });

    // Sort dynamic students oldest first (FIFO)
    Object.values(dynamics).forEach(d => {
      d.students.sort((a, b) => a.createdAt - b.createdAt);
    });

    // Sort lists: highest counts first
    const sortedDynamics = Object.values(dynamics).sort((a, b) => b.students.length - a.students.length);
    const sortedStatics = Object.values(statics).sort((a, b) => b.count - a.count);

    return {
      dynamics: sortedDynamics,
      statics: sortedStatics
    };
  }, [processedOrders, menuItems]);

  // 3. ACTION: Notify Student Ready (FCM/OneSignal Push + QR Unlock)
  const handleNotifyReady = async (orderId: string, item: CartItem, userId: string, token: string) => {
    const actionKey = `notify-${orderId}-${item.id}`;
    if (loadingAction === actionKey) return;
    setLoadingAction(actionKey);
    try {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

      const orderRef = doc(db, 'orders', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) return;
      const orderData = snap.data() as Order;

      const now = Date.now();
      const updatedItems = orderData.items.map(it => {
        if (it.id === item.id) {
          return { ...it, status: 'READY' as any };
        }
        return it;
      });

      const pickupWindow = orderData.pickupWindow?.status === 'COLLECTING'
        ? orderData.pickupWindow
        : {
            startTime: now,
            endTime: now + 300000, // 5 min pickup window
            durationMs: 300000,
            status: 'COLLECTING'
          };

      // Set item status to READY, update order serveFlowStatus & unlock QR code
      await updateDoc(orderRef, {
        items: updatedItems,
        serveFlowStatus: 'READY',
        pickupWindow: pickupWindow,
        updatedAt: serverTimestamp()
      });

      // Sync specific subcollection item
      const itemRef = doc(db, 'orders', orderId, 'items', item.id);
      await updateDoc(itemRef, {
        status: 'READY',
        updatedAt: serverTimestamp()
      }).catch(err => console.error("Subcollection sync failed:", err));

      // Trigger Push Notification to Student Account (OneSignal)
      try {
        const shortToken = token;
        await triggerOneSignalWebhook(
          userId,
          lang === 'TE' ? "🥞 మీ ఆహారం సిద్ధంగా ఉంది!" : "🥞 Food Ready for Pickup!",
          lang === 'TE'
            ? `టోకెన్ #${shortToken}: మీ వేడి వేడి ${item.name} సిద్ధంగా ఉంది. దయచేసి కౌంటర్ వద్ద తీసుకోండి.`
            : `Token #${shortToken}: Your hot ${item.name} is ready. Please collect at the counter.`,
          `/student/orders`
        );
      } catch (pushErr) {
        console.warn("Push notify error:", pushErr);
      }
    } catch (err) {
      console.error("Notify ready failed:", err);
      alert(lang === 'TE' ? "నోటిఫై చేయడంలో సమస్య వచ్చింది." : "Failed to notify student.");
    } finally {
      setLoadingAction(null);
    }
  };

  // Helper to tell kitchen verbally
  const handleTellKitchen = (name: string, qty: number) => {
    if ('vibrate' in navigator) navigator.vibrate(60);
    const speechEN = `Cook ${qty} ${name}`;
    const speechTE = `${qty} ${name} తయారు చేయండి`;
    const utter = new SpeechSynthesisUtterance(lang === 'TE' ? speechTE : speechEN);
    utter.lang = lang === 'TE' ? 'te-IN' : 'en-IN';
    utter.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  const getTimeAgo = (createdAt: number) => {
    const diff = Date.now() - createdAt;
    const mins = Math.floor(diff / 60000);
    if (mins <= 0) return lang === 'TE' ? TRANSLATIONS.TE.justNow : TRANSLATIONS.EN.justNow;
    return `${mins} ${lang === 'TE' ? TRANSLATIONS.TE.timeAgo : TRANSLATIONS.EN.timeAgo}`;
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white pb-28 font-sans select-none overflow-x-hidden">
      
      {/* 🔮 NEON GLOW 🔮 */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* ── STICKY BILINGUAL HEADER ── */}
      <header className="bg-zinc-950/85 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between sticky top-0 z-50 max-w-xl mx-auto shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-3xl animate-bounce">🥞</span>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none text-white uppercase">
              {TRANSLATIONS[lang].title}
            </h1>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">
                {TRANSLATIONS[lang].live}
              </span>
            </div>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLang(l => l === 'TE' ? 'EN' : 'TE')}
            className="px-3.5 py-2 bg-white text-black font-black text-xs rounded-xl active:scale-95 transition-all shadow-md min-h-[40px] cursor-pointer"
          >
            {TRANSLATIONS[lang].langLabel}
          </button>

          <button 
             onClick={async () => {
                if (audioStatus === 'Silent') {
                   await cseSounds.init();
                } else {
                   cseSounds.toggleMute();
                }
             }}
             className={`p-2.5 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer min-h-[40px] ${
                audioStatus === 'Connected' 
                   ? 'bg-[#b76dff]/15 border-[#b76dff]/30 text-[#ddb7ff]' 
                   : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
             }`}
          >
             {audioStatus === 'Connected' ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button onClick={onLogout} className="p-2.5 bg-zinc-900 border border-white/5 hover:border-red-500/20 hover:text-red-400 rounded-xl text-zinc-400 transition active:scale-95 cursor-pointer min-h-[40px]">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE ── */}
      <main className="max-w-xl mx-auto px-4 mt-6 space-y-8">

        {/* Guidelines Tip */}
        <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider bg-zinc-950/40 border border-white/5 px-4 py-3 rounded-2xl">
          {TRANSLATIONS[lang].tip}
        </p>

        {/* ── SECTION 1: DYNAMIC ITEMS (BATCHED SIMILAR ITEMS FIRST) ── */}
        <div className="space-y-4">
          <h2 className="text-sm font-black text-[#ddb7ff] tracking-tight uppercase flex items-center gap-2 pl-1">
            <span>🥞</span>
            <span>{TRANSLATIONS[lang].dynamicHeader}</span>
          </h2>

          {aggregatedDemands.dynamics.length === 0 ? (
            <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-12 text-center text-zinc-500">
              <ChefHat className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <p className="text-sm font-bold">
                {TRANSLATIONS[lang].emptyDynamic}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {aggregatedDemands.dynamics.map((item) => (
                <div 
                  key={item.name}
                  className="bg-[#111219]/65 border border-purple-500/25 rounded-[2rem] p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-[40px] rounded-full pointer-events-none" />

                  {/* Item Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl shrink-0">{getEmoji(item.name)}</span>
                      <div>
                        <h3 className="text-lg font-black text-white leading-tight uppercase italic">{item.name}</h3>
                        <button 
                          onClick={() => handleTellKitchen(item.name, item.students.length)}
                          className="text-[9px] text-[#b76dff] font-extrabold uppercase mt-1 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          {TRANSLATIONS[lang].tellKitchen} ({item.students.length}x)
                        </button>
                      </div>
                    </div>

                    <div className="bg-purple-600 text-black px-4 py-2 rounded-2xl font-mono font-black text-2xl">
                      {item.students.length}x
                    </div>
                  </div>

                  {/* List of Waiting Students (FIFO order) */}
                  <div className="space-y-2.5">
                    {item.students.map((st, sidx) => {
                      const actionKey = `notify-${st.orderId}-${st.cartItem.id}`;
                      const isBtnLoading = loadingAction === actionKey;
                      const shortToken = st.tokenNumber;

                      return (
                        <div 
                          key={sidx}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5"
                        >
                          <div>
                            <span className="text-sm text-zinc-200 font-black block leading-none mb-1">
                              {st.studentName}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider flex items-center gap-1.5">
                              <span>#{shortToken}</span>
                              <span className="w-1 h-1 rounded-full bg-zinc-750" />
                              <span>{getTimeAgo(st.createdAt)}</span>
                            </span>
                          </div>

                          <button
                            disabled={!!loadingAction}
                            onClick={() => handleNotifyReady(st.orderId, st.cartItem, st.userId, shortToken)}
                            className="h-12 px-4.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 active:scale-95 text-black font-black text-xs uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer"
                          >
                            {isBtnLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <BellRing className="w-3.5 h-3.5" />
                            )}
                            <span>{TRANSLATIONS[lang].notifyBtn}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION 2: STATIC ITEMS (COUNT SHOWN BELOW EVERYTHING) ── */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest pl-1">
            {TRANSLATIONS[lang].staticHeader}
          </h2>

          {aggregatedDemands.statics.length === 0 ? (
            <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-8 text-center text-zinc-650">
              <p className="text-xs font-bold">{TRANSLATIONS[lang].emptyStatic}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {aggregatedDemands.statics.map((item) => (
                <div 
                  key={item.name}
                  className="bg-zinc-900/35 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl shrink-0">{getEmoji(item.name)}</span>
                    <span className="text-sm font-black text-zinc-200 uppercase truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <div className="bg-zinc-800 text-zinc-300 font-mono font-black text-lg px-3.5 py-1.5 rounded-xl">
                    {item.count}x
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

    </div>
  );
};

export default AssistantSupervisorView;
