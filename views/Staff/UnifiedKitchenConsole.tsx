import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  Zap, 
  Send, 
  Sparkles, 
  Search, 
  ChevronLeft, 
  CheckCircle2, 
  ClipboardList,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  X
} from 'lucide-react';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { PrepBatch, Order, UserProfile } from '../../types';
import { 
  listenToBatches, 
  listenToActiveOrders, 
  startBatchPreparation, 
  markBatchAlmostReady,
  markBatchReady,
  serveItemBatch,
  serveOrderItemsAtomic,
  forceReadyOrder,
  validateQRForServing,
  broadcastSystemMessage,
  processAtomicIntake,
  flushMissedPickups,
  serveFullOrder,
  abandonItem
} from '../../services/firestore-db';
import { parseQRPayload, parseServingQR } from '../../services/qr';
import { initializeScanner } from '../../services/scanner';
import CookConsoleWorkspace from './CookConsoleWorkspace';
import ServerConsoleWorkspace from './ServerConsoleWorkspace';
import QRScanner from '../../components/QRScanner';

interface UnifiedKitchenConsoleProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
}

interface UnifiedHeaderProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
  currentTime: Date;
  activeWorkspace: 'COOK' | 'SERVER' | 'MARKETING';
  setActiveWorkspace: (workspace: 'COOK' | 'SERVER' | 'MARKETING') => void;
}

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({ profile, onLogout, onBack, currentTime, activeWorkspace, setActiveWorkspace }) => {
  return (
    <header className="bg-white px-8 h-20 flex items-center justify-between border-b border-slate-200 shrink-0 shadow-sm z-30">
      <div className="flex items-center gap-6">
         <div className="bg-slate-900 px-5 py-2 rounded-lg">
            <span className="text-white font-bold text-lg tracking-tight uppercase">JOE CAFE</span>
         </div>
         
         <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setActiveWorkspace('COOK')}
              className={`px-8 h-12 rounded-full font-black text-xs uppercase tracking-widest transition-all ${
                activeWorkspace === 'COOK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Cook Station
            </button>
            <button 
              onClick={() => setActiveWorkspace('SERVER')}
              className={`px-8 h-12 rounded-full font-black text-xs uppercase tracking-widest transition-all ${
                activeWorkspace === 'SERVER' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/50 text-indigo-900 border border-indigo-100 hover:bg-white'
              }`}
            >
              Server Console
            </button>
            <button 
              onClick={() => setActiveWorkspace('MARKETING')}
              className={`px-8 h-12 rounded-full font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeWorkspace === 'MARKETING' ? 'bg-rose-600 text-white shadow-lg' : 'bg-white/50 text-rose-900 border border-rose-100 hover:bg-white'
              }`}
            >
              📣 Marketing Hub <div className="bg-white/20 px-2 py-0.5 rounded-md text-[10px]">NEW</div>
            </button>
         </div>
      </div>

      <div className="flex items-center gap-8">
         <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live Ops Time</span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tighter leading-none">
               {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
         </div>
         
         <div className="h-10 w-[1px] bg-slate-200" />

         <div className="flex items-center gap-4">
            {profile.role === 'ADMIN' && onBack && (
              <button 
                onClick={onBack}
                className="px-4 h-11 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs uppercase hover:bg-slate-100 transition-all flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
            )}
            <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg">
               {profile.name?.charAt(0) || 'S'}
            </div>
            <button onClick={onLogout} className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all">
              <LogOut className="w-5 h-5" />
            </button>
         </div>
      </div>
    </header>
  );
};

const UnifiedKitchenConsole: React.FC<UnifiedKitchenConsoleProps> = ({ profile, onLogout, onBack }) => {
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<'COOK' | 'SERVER' | 'MARKETING'>('COOK');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [optimisticOrders, setOptimisticOrders] = useState<Record<string, Order>>({});
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localScanBuffer, setLocalScanBuffer] = useState<string[]>([]);

  const scanQueue = useMemo(() => {
    const merged = [...activeOrders];
    Object.values(optimisticOrders).forEach(oo => {
        if (!merged.find(m => m.id === oo.id)) merged.push(oo);
    });

    const firestoreQueue = merged
      .filter(o => {
        const realStatus = optimisticOrders[o.id]?.orderStatus || o.orderStatus;
        return (o.qrState === 'SCANNED' || o.qrStatus === 'SCANNED' || o.orderStatus === 'MISSED') && 
        realStatus !== 'SERVED' && 
        realStatus !== 'COMPLETED';
      })
      .sort((a, b) => (a.scannedAt || a.createdAt || 0) - (b.scannedAt || b.createdAt || 0))
      .map(o => o.id);
      
    return Array.from(new Set([...localScanBuffer, ...firestoreQueue]));
  }, [activeOrders, localScanBuffer, optimisticOrders]);

  const mergedActiveOrders = useMemo(() => {
    const merged = [...activeOrders];
    Object.values(optimisticOrders).forEach(oo => {
      const idx = merged.findIndex(m => m.id === oo.id);
      if (idx === -1) merged.push(oo);
      else merged[idx] = oo;
    });
    return merged;
  }, [activeOrders, optimisticOrders]);

  const [sonicMode, setSonicMode] = useState<{
    status: 'SUCCESS' | 'ERROR' | 'IDLE';
    title: string;
    sub: string;
    icon: 'CHECK' | 'X' | 'CLOCK';
  }>({ status: 'IDLE', title: '', sub: '', icon: 'CHECK' });

  const triggerSonicPulse = (status: 'SUCCESS' | 'ERROR', title: string, sub: string, persistent = false) => {
    setSonicMode({ status, title, sub, icon: status === 'SUCCESS' ? 'CHECK' : 'X' });
    if ('vibrate' in navigator) {
      if (status === 'SUCCESS') navigator.vibrate(100);
      else navigator.vibrate([200, 100, 200]);
    }
    
    if (status !== 'SUCCESS' || !persistent) {
        setTimeout(() => setSonicMode(prev => ({ ...prev, status: 'IDLE' })), status === 'SUCCESS' ? 700 : 2500);
    }
  };

  const scanLockRef = useRef(false);
  const scanHistoryRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const maintenanceLoop = setInterval(async () => {
      setCurrentTime(new Date());
      await flushMissedPickups(); 
    }, 15000); 

    const unsubBatches = listenToBatches(setBatches);
    const unsubOrders = listenToActiveOrders(setActiveOrders);

    return () => {
      clearInterval(maintenanceLoop);
      unsubBatches();
      unsubOrders();
    };
  }, []);

  const handleQRScan = async (rawData: string) => {
    if (!rawData?.trim() || scanLockRef.current) return;
    scanLockRef.current = true;

    const now = Date.now();
    const lastScan = scanHistoryRef.current[rawData] || 0;
    if (now - lastScan < 3000) {
       setTimeout(() => { scanLockRef.current = false; }, 500);
       return;
    }

    const intake = parseServingQR(rawData.trim());
    if (intake.orderId) {
       triggerSonicPulse('SUCCESS', 'VERIFYING...', `#${intake.orderId.slice(-4).toUpperCase()}`);
    }

    setIsCameraOpen(false);

    try {
        const { result, order } = await processAtomicIntake(rawData.trim(), profile.uid);
        setOptimisticOrders(prev => ({ ...prev, [order.id]: order }));
        
        if (result === 'AWAITING_PAYMENT') {
           triggerSonicPulse('SUCCESS', 'AWAITING CASH', `#${order.id.slice(-4).toUpperCase()} – Unpaid.`, true);
        } else if (result === 'CONSUMED') {
           triggerSonicPulse('SUCCESS', 'VALID: PASS', `#${order.id.slice(-4).toUpperCase()} – Served.`, false);
           setLocalScanBuffer(prev => prev.filter(id => id !== order.id));
        } else if (result === 'MANIFESTED' || result === 'ALREADY_MANIFESTED') {
           triggerSonicPulse('SUCCESS', 'MEAL VERIFIED', `#${order.id.slice(-4).toUpperCase()} – TAP TO SERVE`, true);
        }
        
        setTimeout(() => { scanLockRef.current = false; }, 1200);
    } catch (err: any) {
        const msg = err?.message || String(err);
        triggerSonicPulse('ERROR', 'SCAN ERROR', msg.slice(0, 30));
        setTimeout(() => { scanLockRef.current = false; }, 1200);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await serveItemBatch(orderId, itemId, qty, profile.uid);
      triggerSonicPulse('SUCCESS', 'ITEM SERVED', 'Manual Confirmation.');
    } catch (err: any) {
      console.error("Manual serve failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleServeFullOrder = async (orderId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await serveFullOrder(orderId, profile.uid);
      setLocalScanBuffer(prev => prev.filter(id => id !== orderId)); 
      triggerSonicPulse('SUCCESS', 'ORDER COMPLETED', 'All items fulfilled.');
    } catch (err: any) {
      console.error("Serve all failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceReady = async (orderId: string) => {
     try {
       await forceReadyOrder(orderId, profile.uid);
     } catch (err) {
       console.error("Force ready error:", err);
     }
  };

  const handleAbandonItem = async (orderId: string, itemId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await abandonItem(orderId, itemId);
    } catch (err: any) {
      setError(err.message || "Abandon failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans select-none">
      <div className="flex-1 flex flex-col min-w-0">
        <UnifiedHeader 
          profile={profile} 
          onLogout={onLogout} 
          currentTime={currentTime} 
          onBack={onBack}
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
        />

        <main className="flex-1 overflow-hidden relative">
          {activeWorkspace === 'COOK' && <CookConsoleWorkspace batches={batches} />}
          {activeWorkspace === 'SERVER' && (
             <ServerConsoleWorkspace 
                activeOrders={mergedActiveOrders}
                scanQueue={scanQueue}
                setScanQueue={setLocalScanBuffer}
                isCameraOpen={isCameraOpen}
                setIsCameraOpen={setIsCameraOpen}
                handleQRScan={handleQRScan}
                handleServeItem={handleServeItem}
                handleServeAll={handleServeFullOrder}
                handleForceReady={handleForceReady}
                handleAbandonItem={handleAbandonItem}
                isProcessing={isProcessing}
             />
          )}
          {activeWorkspace === 'MARKETING' && <MarketingHub />}

          {sonicMode.status !== 'IDLE' && (
            <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-75 ${
                sonicMode.status === 'SUCCESS' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
               <div className="bg-white/20 p-8 rounded-[3rem] backdrop-blur-3xl border border-white/30 shadow-2xl scale-110 mb-8">
                  {sonicMode.status === 'SUCCESS' ? <ShieldCheck className="w-24 h-24 text-white" /> : <ShieldAlert className="w-24 h-24 text-white" />}
               </div>
               <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic mb-4 drop-shadow-2xl">{sonicMode.title}</h1>
               <p className="text-xl font-black text-white/80 uppercase tracking-[0.3em] font-mono mb-12">{sonicMode.sub}</p>

               {sonicMode.status === 'SUCCESS' && (
                 <div className="w-full max-w-lg space-y-4 px-8">
                   <button 
                     onClick={() => {
                        const idMatch = sonicMode.sub.match(/#([A-Z0-9]{4})/);
                        if (idMatch) {
                           const targetOrder = mergedActiveOrders.find(o => o.id.toLowerCase().endsWith(idMatch[1].toLowerCase()));
                           if (targetOrder) handleServeFullOrder(targetOrder.id);
                        }
                        setSonicMode(prev => ({ ...prev, status: 'IDLE' }));
                     }}
                     className="w-full bg-white text-emerald-600 h-24 rounded-[2rem] font-black text-2xl uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                   >
                     Complete & Serve All <Zap className="w-8 h-8" />
                   </button>
                   <button 
                     onClick={() => setSonicMode(prev => ({ ...prev, status: 'IDLE' }))}
                     className="w-full bg-emerald-700/50 text-white/80 h-16 rounded-[1.5rem] font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
                   >
                     Dismiss
                   </button>
                 </div>
               )}
            </div>
          )}

          {isCameraOpen && (
            <QRScanner 
               onScan={(data) => handleQRScan(data)}
               onClose={() => setIsCameraOpen(false)}
            />
          )}
        </main>

        {error && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-black uppercase tracking-widest text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 bg-white/20 p-1 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const MarketingHub = () => {
    const [msg, setMsg] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'SENDING' | 'SENT'>('IDLE');

    const templates = [
        { label: "🍱 Lunch Rush", text: "JOE: Lunch is served! 🥘 Avoid the massive queue—book your 1:00 PM Pulse now and walk straight to the counter! 🚀" },
        { label: "🥐 Breakfast Hub", text: "JOE: Rise and grind! ☕ Your Masala Dosa is waiting. Catch the 8:45 hot window before it fills up! 🍱" },
        { label: "🍵 Tea Break", text: "JOE: Chai + Samosa o'clock! ☕ Enjoy your perfect 5-min break. Slots for 5:30 PM are opening now! ✨" }
    ];

    const pushMessage = async () => {
        if (!msg) return;
        setStatus('SENDING');
        try {
            await broadcastSystemMessage(msg);
            setStatus('SENT');
            setTimeout(() => setStatus('IDLE'), 3000);
            setMsg('');
        } catch (e) {
            setStatus('IDLE');
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 overflow-y-auto h-full pb-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-rose-100 p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-rose-100 p-4 rounded-[1.5rem]">
                            <Zap className="w-8 h-8 text-rose-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-rose-900">Digital Marketing Hub</h2>
                            <p className="text-sm font-bold text-rose-400">Target All 400 Students Instantly</p>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Message Campaign</label>
                        <textarea 
                            value={msg}
                            onChange={(e) => setMsg(e.target.value)}
                            placeholder="Type your Swiggy-style notification here..."
                            className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 font-bold text-slate-700 focus:border-rose-300 focus:ring-0 transition-all placeholder:text-slate-300 outline-none"
                        />
                    </div>

                    <button 
                        onClick={pushMessage}
                        disabled={status === 'SENDING' || !msg}
                        className={`w-full h-20 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-4 ${
                            status === 'SENT' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                        }`}
                    >
                        {status === 'SENDING' ? 'Broadcasting...' : status === 'SENT' ? 'Campaign Fired! 🚀' : 'Fire Pulse Campaign 📢'}
                        <Send className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="bg-rose-900 rounded-[2.5rem] p-8 text-white shadow-xl">
                        <h3 className="text-xl font-black mb-6 flex items-center gap-3">
                            <Sparkles className="w-6 h-6" /> Best-Selling Templates
                        </h3>
                        <div className="space-y-4">
                            {templates.map(t => (
                                <button 
                                    key={t.label}
                                    onClick={() => setMsg(t.text)}
                                    className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-[1.5rem] p-5 text-left transition-all group active:scale-[0.98]"
                                >
                                    <div className="text-[10px] font-black uppercase tracking-widest text-rose-300 mb-2">{t.label}</div>
                                    <div className="text-xs font-bold text-white/80 group-hover:text-white leading-relaxed">{t.text}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 italic font-bold text-slate-400 text-sm leading-relaxed">
                        "Pro Tip: Sending a notification 15 minutes before the lunch rush increases 'Pulse Bookings' by up to 40%."
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UnifiedKitchenConsole;
