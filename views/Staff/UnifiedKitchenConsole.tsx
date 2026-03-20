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
  abandonItem,
  serveOrderItemsAtomic,
  processAtomicIntake
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
    // [ROOT-FIX] Use mergedActiveOrders so scanning creates an optimistic queue entry
    const merged = [...activeOrders];
    Object.values(optimisticOrders).forEach(oo => {
        if (!merged.find(m => m.id === oo.id)) merged.push(oo);
    });

    const firestoreQueue = merged
      .filter(o => {
        // Optimistic state might already be completed
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
    // Merge optimistic (recently scanned) orders with active orders for sub-millisecond rendering
    const merged = [...activeOrders];
    Object.values(optimisticOrders).forEach(oo => {
      const idx = merged.findIndex(m => m.id === oo.id);
      if (idx === -1) {
        merged.push(oo);
      } else {
        merged[idx] = oo; // Overlay optimistic over stale firestore
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
    setTimeout(() => setSonicMode(prev => ({ ...prev, status: 'IDLE' })), status === 'SUCCESS' ? 700 : 2500);
  };

  // --- REFS ---
  const inFlightTokenRef = useRef<string | null>(null);
  const lastSuccessRef = useRef<{ id: string; time: number } | null>(null);

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

  // --- SONIC SCAN LOCKS (Hard synchronous gates) ---
  const scanLockRef = useRef(false);
  const scanHistoryRef = useRef<Record<string, number>>({});

  // --- OPERATIONAL HANDLERS ---
  const handleQRScan = async (rawData: string, resumeScanner: () => void = () => {}) => {
    if (!rawData?.trim()) return;
    
    // 🛡️ [PRINCIPAL-LOCK] Hard synchronous gate to block redundant frames instantly
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    // 🛡️ [COOLDOWN-SHIELD] 3-second mandatory ignore window for the same token
    const now = Date.now();
    const lastScan = scanHistoryRef.current[rawData] || 0;
    if (now - lastScan < 3000) {
       // Silent ignore for 3 seconds per business rule
       setTimeout(() => { scanLockRef.current = false; }, 500); // Quick release for different items
       return;
    }
    // 🔊 [SONIC-BOOST] Instant Haptic Feedback
    if ('vibrate' in navigator) navigator.vibrate(80);

    const intake = parseServingQR(rawData.trim());
    
    // [SONIC-PULSE] PRELIMINARY OPTIMISTIC FEEDBACK
    if (intake.orderId) {
       triggerSonicPulse('SUCCESS', 'VERIFYING...', `#${intake.orderId.slice(-4).toUpperCase()}`);
    }

    // 🛑 STOP CAMERA IMMEDIATELY
    setIsCameraOpen(false);

    // [SONIC-SYNC] Reset Timeout (REDUCED: 1.2s for rapid-fire)
    const releaseLock = (delay = 1200) => {
        setTimeout(() => {
            scanLockRef.current = false;
        }, delay);
    };

    try {
        // ⚡ [SONIC-ATOMIC] Hand off entirely to the single backend transaction
        const { result, order } = await processAtomicIntake(rawData.trim(), profile.uid);

        // [SONIC-SYNC] Immediately update optimistic state 
        setOptimisticOrders(prev => ({ ...prev, [order.id]: order }));
        
        if (result === 'AWAITING_PAYMENT') {
           setLocalScanBuffer(prev => prev.includes(order.id) ? prev : [order.id, ...prev]);
           triggerSonicPulse('SUCCESS', 'AWAITING CASH', `#${order.id.slice(-4).toUpperCase()} – Unpaid.`);
        } else if (result === 'CONSUMED') {
           triggerSonicPulse('SUCCESS', 'VALID: PASS', `#${order.id.slice(-4).toUpperCase()} – Served.`);
           setLocalScanBuffer(prev => prev.filter(id => id !== order.id)); // Instantly remove from queue
        } else if (result === 'MANIFESTED') {
           setLocalScanBuffer(prev => prev.includes(order.id) ? prev : [order.id, ...prev]);
           triggerSonicPulse('SUCCESS', 'MEAL VERIFIED', `#${order.id.slice(-4).toUpperCase()} – Added.`);
        } else if (result === 'ALREADY_MANIFESTED') {
           triggerSonicPulse('SUCCESS', 'IN QUEUE', 'Items already on manifest.');
        }
        
        releaseLock(1200); // 1.2s rapid recovery
    } catch (err: any) {
        const msg = err?.message || String(err);
        
        if (msg.includes('ALREADY_CONSUMED')) {
            triggerSonicPulse('ERROR', 'ALREADY SERVED', 'Ticket was consumed.');
        } else if (msg.includes('ALREADY_SCANNED')) {
            triggerSonicPulse('ERROR', 'ALREADY SCANNED', 'In manifests.');
        } else if (msg.includes('SECURITY_BREACH')) {
            triggerSonicPulse('ERROR', 'INVALID TOKEN', 'Verification failed.');
        } else {
            triggerSonicPulse('ERROR', 'SCAN ERROR', msg.slice(0, 30));
        }
        
        releaseLock(1200); // 1.2s rapid recovery
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    if (isProcessing) return;
    
    // ⚡ [SONIC-SYNC] Optimistic local update for sub-millisecond removal from manifest
    setOptimisticOrders(prev => {
      const order = prev[orderId] || activeOrders.find(o => o.id === orderId);
      if (!order) return prev;
      const updatedItems = order.items.map(it => 
        it.id === itemId ? { ...it, status: 'SERVED' as any, remainingQty: 0, servedQty: it.quantity } : it
      );
      return { ...prev, [orderId]: { ...order, items: updatedItems } };
    });

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

    // ⚡ [SONIC-SYNC] Optimistic local update
    setOptimisticOrders(prev => {
       const order = prev[orderId] || activeOrders.find(o => o.id === orderId);
       if (!order) return prev;
       const updatedItems = order.items.map(it => ({ ...it, status: 'SERVED' as any, remainingQty: 0, servedQty: it.quantity }));
       return { ...prev, [orderId]: { ...order, items: updatedItems, orderStatus: 'COMPLETED' as any, qrStatus: 'DESTROYED' as any } };
    });

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

          {/* ⚡ [SONIC] FEEDBACK OVERLAY (Principal UX lanes) */}
          {sonicMode.status !== 'IDLE' && (
            <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-75 ${
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
                 handleQRScan(data, resume);
               }}
               onClose={() => setIsCameraOpen(false)}
            />
          )}
        </main>

        {/* 🧩 [HEADLESS] HIDDEN INPUT FOR HARDWARE SCANNERS */}
        <input 
          id="headless-scanner-input"
          type="text"
          className="fixed -top-10 opacity-0 pointer-events-none"
          autoComplete="off"
          readOnly
        />

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
