import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  CheckCircle, ChevronRight, Clock, AlertTriangle, ShieldAlert, Zap, 
  Send, Sparkles, Search, ChevronLeft, CheckCircle2, ClipboardList,
  ShieldCheck, LayoutDashboard, LogOut, X, Flame
} from 'lucide-react';
import { onSnapshot, query, collectionGroup, where, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import { 
  processAtomicIntake,
  runBatchGenerator
} from '../../services/firestore-db';
import { parseServingQR } from '../../services/qr';
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
  activeWorkspace: 'COOK' | 'SERVER' | 'MIRROR';
  setActiveWorkspace: (workspace: 'COOK' | 'SERVER' | 'MIRROR') => void;
}

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({ profile, onLogout, onBack, currentTime, activeWorkspace, setActiveWorkspace }) => {
  return (
    <header className="bg-white px-4 lg:px-8 py-3 lg:h-20 flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-200 shrink-0 shadow-sm z-30 gap-4 lg:gap-0">
      <div className="flex items-center justify-between w-full lg:w-auto lg:justify-start gap-4 lg:gap-6">
         <div className="bg-slate-900 px-3 py-1.5 lg:px-5 lg:py-2 rounded-lg">
            <span className="text-white font-bold text-sm lg:text-lg tracking-tight uppercase">JOE CAFE</span>
         </div>
         
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full lg:w-auto overflow-x-auto custom-scrollbar flex-nowrap">
            <button 
              onClick={() => setActiveWorkspace('COOK')}
              className={`px-4 lg:px-6 h-9 lg:h-12 rounded-lg lg:rounded-full font-black text-[9px] lg:text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                activeWorkspace === 'COOK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Cook
            </button>
            <button 
              onClick={() => setActiveWorkspace('SERVER')}
              className={`px-4 lg:px-6 h-9 lg:h-12 rounded-lg lg:rounded-full font-black text-[9px] lg:text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                activeWorkspace === 'SERVER' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Server
            </button>
            <button 
              onClick={() => setActiveWorkspace('MIRROR')}
              className={`px-4 lg:px-6 h-9 lg:h-12 rounded-lg lg:rounded-full font-black text-[9px] lg:text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
                activeWorkspace === 'MIRROR' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Mirror
            </button>
          </div>
      </div>

      <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto gap-4 lg:gap-8 overflow-x-auto flex-nowrap pb-1 lg:pb-0">
         <div className="text-right flex flex-col items-start lg:items-end">
            <span className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live Ops</span>
            <span className="text-lg lg:text-2xl font-black text-slate-900 font-mono tracking-tighter leading-none whitespace-nowrap">
               {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
         </div>
         
         <div className="h-8 lg:h-10 w-[1px] bg-slate-200 shrink-0" />

         <div className="flex items-center gap-2 lg:gap-4 shrink-0">
            {profile.role === 'ADMIN' && onBack && (
              <button 
                onClick={onBack}
                className="px-3 lg:px-4 h-10 lg:h-11 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold text-[10px] lg:text-xs uppercase hover:bg-slate-100 transition-all flex items-center gap-1.5 lg:gap-2 whitespace-nowrap"
              >
                <LayoutDashboard className="w-3 h-3 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            )}
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg">
               {profile.name?.charAt(0) || 'S'}
            </div>
            <button onClick={onLogout} className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all">
              <LogOut className="w-4 h-4 lg:w-5 lg:h-5" />
            </button>
         </div>
      </div>
    </header>
  );
};

const KitchenConsoleInner: React.FC<{ profile: UserProfile; onLogout: () => void; onBack?: () => void }> = ({ profile, onLogout, onBack }) => {
  const [activeWorkspace, setActiveWorkspace] = useState<'COOK' | 'SERVER' | 'MIRROR'>('COOK');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
       window.removeEventListener('online', onOnline);
       window.removeEventListener('offline', onOffline);
    };
  }, []);
  
  const [scanQueue, setScanQueue] = useState<string[]>([]);

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
    
    setTimeout(() => {
       setSonicMode(prev => {
          if (prev.status === 'IDLE') return prev;
          return { ...prev, status: 'IDLE' };
       });
    }, 800);
  };

  const scanLockRef = useRef(false);
  const setExternalMapRef = useRef<any>(null);

  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    // Only the primary staff device running the SERVER workspace acts as the brain.
    const isBrainEligible = (profile.role === 'SERVER' || profile.role === 'ADMIN' || profile.role === 'COOK') && (activeWorkspace === 'SERVER' || activeWorkspace === 'COOK');
    
    if (isBrainEligible) {
       import('../../services/firestore-db').then(m => m.startSystemBrain(profile.uid));
    }

    const unsubGenerator = onSnapshot(
       query(collectionGroup(db, "items"), where("status", "in", ["PENDING", "RESERVED"]), limit(100)),
       (snap) => {
          if (!isBrainEligible) return; 
          if (snap.docs.length > 60) return; 
          runBatchGenerator(profile.uid);
       }
    );

    const onOnline = () => {
       if (isBrainEligible) runBatchGenerator(profile.uid);
    };
    window.addEventListener('online', onOnline);

    return () => {
      clearInterval(clockInterval);
      if (unsubGenerator) unsubGenerator();
      window.removeEventListener('online', onOnline);
      import('../../services/firestore-db').then(m => m.stopSystemBrain());
    };
  }, [profile.uid, activeWorkspace]);

  const handleQRScan = useCallback(async (rawData: string) => {
    if (!rawData?.trim() || scanLockRef.current) return;
    
    scanLockRef.current = true;
    setIsCameraOpen(false); 
    
    try {
        const intake = parseServingQR(rawData.trim());
        if (!intake.orderId) throw new Error("INVALID_QR");
        triggerSonicPulse('SUCCESS', 'VERIFYING...', `#${intake.orderId.slice(-4).toUpperCase()}`);

        const { result, order } = await processAtomicIntake(rawData.trim(), profile.uid);
        
        if (result === 'ALREADY_MANIFESTED' || result === 'MANIFESTED') {
            const label = result === 'ALREADY_MANIFESTED' ? 'TOKEN ACTIVE ✅' : 'PARTIAL RELEASE ✅';
            const sub = result === 'ALREADY_MANIFESTED' ? 'Order already on manifest' : 'ITEMS LOADED ON SCREEN';
            
            // 🚀 [ZERO-LAG-PUSH]: Inject scanned data directly into workspace memory
            if (setExternalMapRef.current && order.items) {
               setExternalMapRef.current((prev: any) => ({ ...prev, [order.id]: order.items }));
            }
            
            setScanQueue(prev => Array.from(new Set([...prev, order.id])));
            triggerSonicPulse('SUCCESS', label, sub);
        } else if (result === 'CONSUMED') {
            triggerSonicPulse('SUCCESS', 'ORDER COMPLETE ✅', 'ALL ITEMS AUTO-SERVED');
        } else {
            triggerSonicPulse('ERROR', 'SCAN ERROR', result.replace('_', ' '));
        }
    } catch (err: any) {
        triggerSonicPulse('ERROR', 'SCAN ERROR', (err.message || 'Unknown').toUpperCase().slice(0, 20));
    } finally {
        setTimeout(() => { scanLockRef.current = false; }, 800);
    }
  }, [profile.uid]);

  const handleOrderPreload = useCallback((setter: any) => {
    setExternalMapRef.current = setter;
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden text-slate-900 select-none">
      {isOffline && (
        <div className="bg-red-600 text-white px-8 py-2 text-center font-black text-[10px] uppercase tracking-widest animate-pulse flex items-center justify-center gap-3 shrink-0 z-50">
           <AlertTriangle className="w-3 h-3" /> Connection unstable. Reconnecting to kitchen brain...
        </div>
      )}
      <UnifiedHeader 
        profile={profile} 
        onLogout={onLogout} 
        onBack={onBack}
        currentTime={currentTime}
        activeWorkspace={activeWorkspace}
        setActiveWorkspace={setActiveWorkspace}
      />
      
      <main className="flex-1 overflow-hidden relative">
        {activeWorkspace === 'COOK' && (
          <CookConsoleWorkspace isMobile={isMobile} />
        )}
        
        {activeWorkspace === 'SERVER' && (
          <ServerConsoleWorkspace 
            scanQueue={scanQueue}
            setScanQueue={setScanQueue as any}
            setIsCameraOpen={setIsCameraOpen}
            isMobile={isMobile}
            onOrderDataPreload={handleOrderPreload}
          />
        )}
        
        {activeWorkspace === 'MIRROR' && (
          <div className="h-full w-full bg-[#0a0a0c] overflow-hidden">
            <CookConsoleWorkspace isPassive={true} />
          </div>
        )}

        {sonicMode.status !== 'IDLE' && (
          <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-75 ${
              sonicMode.status === 'ERROR' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}>
             <div className="bg-white/20 p-8 rounded-[3rem] backdrop-blur-3xl border border-white/30 shadow-2xl scale-110 mb-8">
                {sonicMode.status === 'SUCCESS' ? <ShieldCheck className="w-24 h-24 text-white" /> : <ShieldAlert className="w-24 h-24 text-white" />}
             </div>
             <h1 className="text-4xl lg:text-6xl font-black text-white uppercase tracking-tighter italic mb-4 drop-shadow-2xl">{sonicMode.title}</h1>
             <p className="text-base lg:text-xl font-black text-white/80 uppercase tracking-[0.3em] font-mono">{sonicMode.sub}</p>
          </div>
        )}

        {isCameraOpen && (
          <QRScanner
            onScan={handleQRScan}
            onClose={() => setIsCameraOpen(false)}
          />
        )}
      </main>
    </div>
  );
};

const UnifiedKitchenConsole: React.FC<UnifiedKitchenConsoleProps> = ({ profile, onLogout, onBack }) => {
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-white/20 font-black uppercase tracking-widest text-sm animate-pulse">
          Reconnecting to kitchen...
        </div>
      </div>
    );
  }
  return <KitchenConsoleInner profile={profile} onLogout={onLogout} onBack={onBack} />;
};

export default UnifiedKitchenConsole;
