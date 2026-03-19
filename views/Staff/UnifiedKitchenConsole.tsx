import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Camera, Check, CheckCircle, X, ChevronRight, Utensils, Clock, Zap, AlertTriangle, Search, CookingPot, PackageCheck, ShieldCheck, ShieldAlert, LogOut, LayoutDashboard } from 'lucide-react';
import { startBatchPreparation, markBatchReady, serveItem, updateSlotStatus, requeueMissedOrder } from '../../services/cook-workflow';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { PrepBatch, Order, UserProfile } from '../../types';
import { 
  listenToBatches, 
  listenToActiveOrders, 
  flushMissedPickups, 
  validateQRForServing, 
  serveFullOrder,
  serveItemBatch,
  abandonItem
} from '../../services/firestore-db';
import { initializeScanner } from '../../services/scanner';
import CookConsoleWorkspace from './CookConsoleWorkspace';
import ServerConsoleWorkspace from './ServerConsoleWorkspace';
import QRScanner from '../../components/QRScanner';


interface UnifiedKitchenConsoleProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
}

// New UnifiedHeader component
interface UnifiedHeaderProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
  currentTime: Date;
  activeWorkspace: 'COOK' | 'SERVER';
  setActiveWorkspace: (workspace: 'COOK' | 'SERVER') => void;
}

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({ profile, onLogout, onBack, currentTime, activeWorkspace, setActiveWorkspace }) => {
  return (
    <header className="bg-white px-8 h-20 flex items-center justify-between border-b border-slate-200 shrink-0 shadow-sm z-30">
      <div className="flex items-center gap-6">
         <div className="bg-slate-900 px-5 py-2 rounded-lg">
            <span className="text-white font-bold text-lg tracking-tight uppercase">JOE CAFE</span>
         </div>
         
         {/* Workspace Switcher */}
         <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setActiveWorkspace('COOK')}
              className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                activeWorkspace === 'COOK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Cook Station
            </button>
            <button 
              onClick={() => setActiveWorkspace('SERVER')}
              className={`px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                activeWorkspace === 'SERVER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Server Desk
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
  // --- CORE DATA STATE ---
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  // Operational sync is handled by the global maintenance loop in the next useEffect.

  
  // --- UI STATE ---
  const [activeWorkspace, setActiveWorkspace] = useState<'COOK' | 'SERVER'>('SERVER');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [optimisticOrders, setOptimisticOrders] = useState<Record<string, Order>>({});
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localScanBuffer, setLocalScanBuffer] = useState<string[]>([]);


  // 🛡️ SCAN QUEUE SYNC: Derived from Firestore 'SCANNED' state
  // This ensures the queue survives page refresh, crashes, or multi-tablet environments.
  const scanQueue = useMemo(() => {
    const firestoreQueue = (activeOrders || [])
      .filter(o => 
        (o.qrState === 'SCANNED' || o.qrStatus === 'SCANNED' || o.orderStatus === 'MISSED') && 
        o.orderStatus !== 'SERVED' && 
        o.orderStatus !== 'COMPLETED'
      )
      .sort((a, b) => (a.scannedAt || a.createdAt || 0) - (b.scannedAt || b.createdAt || 0))
      .map(o => o.id);
    return Array.from(new Set([...localScanBuffer, ...firestoreQueue]));
  }, [activeOrders, localScanBuffer]);

  const mergedActiveOrders = useMemo(() => {
    // Merge optimistic (recently scanned) orders with active orders for sub-millisecond rendering
    const merged = [...activeOrders];
    Object.values(optimisticOrders).forEach(oo => {
      if (!merged.find(m => m.id === oo.id)) {
        merged.push(oo);
      }
    });
    return merged;
  }, [activeOrders, optimisticOrders]);

  // 🔊 [SONIC-SYNC] Full Screen Feedback State
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
    setTimeout(() => setSonicMode(prev => ({ ...prev, status: 'IDLE' })), status === 'SUCCESS' ? 1000 : 2500);
  };

  // --- REFS ---
  const inFlightTokenRef = useRef<string | null>(null);

  // --- ETIOLOGY: GLOBAL MAINTENANCE LOOP ---
  useEffect(() => {
    const maintenanceLoop = setInterval(async () => {
      setCurrentTime(new Date());
      await flushMissedPickups(); 
    }, 3000); 

    const unsubBatches = listenToBatches(setBatches);
    const unsubOrders = listenToActiveOrders(setActiveOrders);

    return () => {
      clearInterval(maintenanceLoop);
      unsubBatches();
      unsubOrders();
    };
  }, [profile.uid]);

  // --- HEADLESS SCANNER INPUT FOCUS ---
  useEffect(() => {
    if (activeWorkspace !== 'SERVER' || !isCameraOpen) return;

    const focusT = setInterval(() => {
      const el = document.getElementById('headless-scanner-input');
      if (el && document.activeElement !== el) el.focus();
    }, 1000);

    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true });
    scanner.onScan((data) => {
      // 🛡️ [Principal Architect] Double-gate: only scan if camera is open AND we aren't already processing
      if (activeWorkspace === 'SERVER' && isCameraOpen && !inFlightTokenRef.current) {
         // Lock immediately to prevent race conditions from millisecond frames
         inFlightTokenRef.current = 'PENDING'; 
         handleQRScan(data);
      }
    });

    return () => {
      clearInterval(focusT);
      scanner.destroy();
    };
  }, [activeWorkspace, isCameraOpen]);

  // --- OPERATIONAL HANDLERS ---
  const handleQRScan = async (rawData: string, resumeScanner: () => void = () => {}) => {
    if (!rawData?.trim()) {
      resumeScanner();
      return;
    }
    
    let orderId = rawData.trim();
    if (orderId.startsWith('v1.')) {
        orderId = orderId.split('.')[1]; 
    }

    // Auto-close camera immediately on a good scan to show items
    setIsCameraOpen(false);

    // 🔒 [SONIC-LOCK] Belt and suspenders application-level lock
    if (inFlightTokenRef.current === orderId) {
        resumeScanner();
        return;
    }
    inFlightTokenRef.current = orderId;

    const resetAndResume = (delayMs = 0) => {
      setTimeout(() => {
        inFlightTokenRef.current = null;
        resumeScanner();
      }, delayMs);
    };

    const cachedOrder = activeOrders?.find(o => o.id === orderId);
    let optimisticFired = false;

    // 🚀 MICROSECOND OPTIMISTIC UI
    if (cachedOrder && cachedOrder.qrStatus !== 'USED' && cachedOrder.orderStatus !== 'SERVED') {
       const isStatic = cachedOrder.items.every(it => it.orderType === 'FAST_ITEM');
       if (isStatic) {
          triggerSonicPulse('SUCCESS', 'VALID: PASS', `#${orderId.slice(-4).toUpperCase()} – Served.`);
       } else {
          setLocalScanBuffer(prev => prev.includes(orderId) ? prev : [orderId, ...prev]);
          if (!localScanBuffer.includes(orderId) && cachedOrder.qrStatus !== 'SCANNED') {
             triggerSonicPulse('SUCCESS', 'QUEUED', `#${orderId.slice(-4).toUpperCase()} – In Stack.`);
          } else {
             triggerSonicPulse('SUCCESS', 'IN QUEUE', `#${orderId.slice(-4).toUpperCase()} – Manifested.`);
          }
       }
       optimisticFired = true;
       // Fast release since we already assured the UI
       resetAndResume(800);
    }

    try {
      // Background / delayed decisive verification
      const { order, result } = await validateQRForServing(rawData.trim(), profile.uid);
      
      // 🧬 Rapid Render Sync: merge validated order into local cache to bypass Firestore push latency
      setOptimisticOrders(prev => ({ ...prev, [order.id]: order }));

      if (!optimisticFired) {
         if (result === 'CONSUMED') {
           triggerSonicPulse('SUCCESS', 'VALID: PASS', `#${order.id.slice(-4).toUpperCase()} – Served.`);
           resetAndResume(1200); 
         } else if (result === 'MANIFESTED') {
           setLocalScanBuffer(prev => prev.includes(order.id) ? prev : [order.id, ...prev]);
           triggerSonicPulse('SUCCESS', 'QUEUED', `#${order.id.slice(-4).toUpperCase()} – In Stack.`);
           resetAndResume(800);
         } else if (result === 'ALREADY_MANIFESTED') {
           triggerSonicPulse('SUCCESS', 'IN QUEUE', `#${order.id.slice(-4).toUpperCase()} – Manifested.`);
           resetAndResume(600);
         }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log('❌ SCAN FAILED:', msg);
      
      // Overwrite optimistic UI if it critically failed (e.g. signature forged, or exact millisecond race condition)
      if (msg.includes('ALREADY_CONSUMED')) {
        triggerSonicPulse('ERROR', 'ALREADY SERVED', 'Ticket was consumed.');
        resetAndResume(1200);
      } else if (msg.includes('SERVE_BLOCKED')) {
        triggerSonicPulse('ERROR', 'NOT READY', 'Please wait for preparation.');
        resetAndResume(1500);
      } else if (msg.includes('SECURITY_BREACH')) {
        triggerSonicPulse('ERROR', 'INVALID', 'Bad signature.');
        resetAndResume(1500);
      } else if (msg.includes('Order not found')) {
        triggerSonicPulse('ERROR', 'UNKNOWN TICKET', 'Not in system.');
        resetAndResume(1500);
      } else {
        triggerSonicPulse('ERROR', 'SCAN ERROR', msg);
        resetAndResume(1200);
      }
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      // [ROOT-FIX] Consolidate back to firestore-db serveItemBatch for atomic item-level consistency
      await serveItemBatch(orderId, itemId, qty, profile.uid);
    } catch (err: any) {
      setError(err.message || "Serving failed");
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
    } catch (err: any) {
      setError(err.message || "Completing order failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleForceReady = async (orderId: string) => {
     try {
       const orderRef = doc(db, 'orders', orderId);
       await updateDoc(orderRef, { serveFlowStatus: 'READY', updatedAt: serverTimestamp() });
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
    <div className="flex h-screen w-screen overflow-hidden bg-background font-sans select-none">
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
          {activeWorkspace === 'COOK' ? (
             <CookConsoleWorkspace batches={batches} />
          ) : (
             <ServerConsoleWorkspace 
                activeOrders={mergedActiveOrders}
                scanQueue={localScanBuffer}
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

          {/* ⚡ [SONIC] FEEDBACK OVERLAY (Principal UX lanes) */}
          {sonicMode.status !== 'IDLE' && (
            <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-150 ${
                sonicMode.status === 'SUCCESS' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
               <div className="bg-white/20 p-8 rounded-[3rem] backdrop-blur-3xl border border-white/30 shadow-2xl scale-110 mb-8">
                  {sonicMode.icon === 'CHECK' ? <ShieldCheck className="w-24 h-24 text-white" /> : <ShieldAlert className="w-24 h-24 text-white" />}
               </div>
               <h1 className="text-6xl font-black text-white uppercase tracking-tighter italic mb-4 drop-shadow-2xl">{sonicMode.title}</h1>
               <p className="text-xl font-black text-white/80 uppercase tracking-[0.3em] font-mono">{sonicMode.sub}</p>
            </div>
          )}

          {/* 📷 [SERVER] CAMERA SCANNER MODAL */}
          {activeWorkspace === 'SERVER' && isCameraOpen && (
            <QRScanner 
               onScan={(data, resume) => {
                 // Do not immediately close modal; modal closes only on X tap.
                 // handleQRScan takes the token, runs processing, triggers flash overlay, 
                 // and eventually calls resume to release the camera for next customer!
                 handleQRScan(data, resume);
               }}
               onClose={() => setIsCameraOpen(false)}
            />
          )}
        </main>

        {/* ERROR OVERLAY */}
        {error && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-red-600/90 backdrop-blur-md text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-4">
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

export default UnifiedKitchenConsole;
