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
  X,
  Flame
} from 'lucide-react';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { PrepBatch, Order, UserProfile, OrderStatus } from '../../types';
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
                activeWorkspace === 'SERVER' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Server Center
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localScanBuffer, setLocalScanBuffer] = useState<string[]>([]);

  const [sonicMode, setSonicMode] = useState<{
    status: 'SUCCESS' | 'ERROR' | 'IDLE';
    title: string;
    sub: string;
    icon: 'CHECK' | 'X' | 'CLOCK';
  }>({ status: 'IDLE', title: '', sub: '', icon: 'CHECK' });

  const triggerSonicPulse = (status: 'SUCCESS' | 'ERROR', title: string, sub: string) => {
    setSonicMode({ status, title, sub, icon: status === 'SUCCESS' ? 'CHECK' : 'X' });
    if ('vibrate' in navigator) {
      if (status === 'SUCCESS') navigator.vibrate(100);
      else navigator.vibrate([200, 100, 200]);
    }
    
    // Fast Dismiss
    setTimeout(() => {
       setSonicMode(prev => {
          if (prev.status === 'IDLE') return prev;
          return { ...prev, status: 'IDLE' };
       });
    }, 1200);
  };

  const scanLockRef = useRef(false);

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
    
    // 🛑 [HARDWARE-GATE] Lockdown immediately 
    scanLockRef.current = true;
    setIsCameraOpen(false); 
    
    const intake = parseServingQR(rawData.trim());
    if (!intake.orderId) {
        triggerSonicPulse('ERROR', 'INVALID CODE', 'Protocol mismatch');
        scanLockRef.current = false;
        return;
    }

    // 🏎️ [OPTIMISTIC-VERIFY] Instant feedback before backend
    triggerSonicPulse('SUCCESS', 'VERIFYING...', `#${intake.orderId.slice(-4).toUpperCase()}`);

    try {
        const { result, order } = await processAtomicIntake(rawData.trim(), profile.uid);
        
        if (result as any === 'ALREADY_MANIFESTED' || result as any === 'ALREADY_CONSUMED') {
            return;
        }

        setOptimisticOrders(prev => ({ ...prev, [order.id]: order }));
        
        if (result === 'AWAITING_PAYMENT') {
           triggerSonicPulse('SUCCESS', 'UNPAID TOKEN', 'Please direct student to cashier.');
        } else if (result === 'CONSUMED') {
           triggerSonicPulse('SUCCESS', 'VERIFIED ✅', 'COLLECT YOUR MEAL');
           setLocalScanBuffer(prev => Array.from(new Set([...prev, order.id])));
        } else if (result === 'MANIFESTED') {
           triggerSonicPulse('SUCCESS', 'CONFIRMED ✅', 'MANIFEST CREATED IN KITCHEN');
        }
    } catch (err: any) {
        triggerSonicPulse('ERROR', 'SCAN ERROR', (err?.message || 'Transaction failed').toUpperCase());
    } finally {
        setTimeout(() => { scanLockRef.current = false; }, 1000);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await serveItemBatch(orderId, itemId, qty, profile.uid);
      triggerSonicPulse('SUCCESS', 'ITEM SERVED ✅', 'Confirmation Recorded.');
    } catch (err: any) {
      console.error("Manual serve failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const scanQueue = useMemo(() => {
    const list = activeOrders
      .filter(o => (o.qrState === 'SCANNED' || localScanBuffer.includes(o.id)) && o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'SERVED')
      .map(o => o.id);
    return Array.from(new Set([...localScanBuffer, ...list]));
  }, [activeOrders, localScanBuffer]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans select-none">
      <div className="flex-1 flex flex-col min-w-0">
        <UnifiedHeader 
          profile={profile} 
          onLogout={onLogout} 
          onBack={onBack} 
          currentTime={currentTime}
          activeWorkspace={activeWorkspace}
          setActiveWorkspace={setActiveWorkspace}
        />
        
        <main className="flex-1 overflow-hidden relative">
          {activeWorkspace === 'COOK' && <CookConsoleWorkspace batches={batches} />}
          {activeWorkspace === 'SERVER' && (
             <ServerConsoleWorkspace 
                activeOrders={activeOrders}
                scanQueue={scanQueue}
                setScanQueue={setLocalScanBuffer}
                isCameraOpen={isCameraOpen}
                setIsCameraOpen={setIsCameraOpen}
                handleQRScan={handleQRScan}
                handleServeItem={handleServeItem}
                isProcessing={isProcessing}
             />
          )}

          {sonicMode.status !== 'IDLE' && (
            <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-75 ${
                sonicMode.status === 'ERROR' ? 'bg-rose-600' : 'bg-emerald-600'
            }`}>
               <div className="bg-white/20 p-8 rounded-[3rem] backdrop-blur-3xl border border-white/30 shadow-2xl scale-110 mb-8">
                  {sonicMode.status === 'SUCCESS' ? <ShieldCheck className="w-24 h-24 text-white" /> : <ShieldAlert className="w-24 h-24 text-white" />}
               </div>
               <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic mb-4 drop-shadow-2xl">{sonicMode.title}</h1>
               <p className="text-xl font-black text-white/80 uppercase tracking-[0.3em] font-mono">{sonicMode.sub}</p>
            </div>
          )}

          {isCameraOpen && (
            <QRScanner
              onScan={(data) => { 
                 handleQRScan(data);
              }}
              onClose={() => setIsCameraOpen(false)}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default UnifiedKitchenConsole;
