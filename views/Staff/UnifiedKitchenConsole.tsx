import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, X, AlertCircle, LogOut
} from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile, Order, PrepBatch } from '../../types';
import {
  listenToBatches,
  validateQRForServing,
  serveItemBatch,
  serveFullOrder,
  listenToActiveOrders,
  flushMissedPickups,
  forceReadyOrder
} from '../../services/firestore-db';
import { initializeScanner } from '../../services/scanner';
import QRScanner from '../../components/QRScanner';

import CookConsoleWorkspace from './CookConsoleWorkspace';
import ServerConsoleWorkspace from './ServerConsoleWorkspace';

interface UnifiedKitchenConsoleProps {
  profile: UserProfile;
  onLogout: () => void;
}

const UnifiedKitchenConsole: React.FC<UnifiedKitchenConsoleProps> = ({ profile, onLogout }) => {
  // --- CORE DATA STATE ---
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  
  // --- UI STATE ---
  const [activeWorkspace, setActiveWorkspace] = useState<'COOK' | 'SERVER'>('SERVER');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 🛡️ SCAN QUEUE SYNC: Derived from Firestore 'SCANNED' state
  // This ensures the queue survives page refresh, crashes, or multi-tablet environments.
  const scanQueue = useMemo(() => {
    return activeOrders
      .filter(o => o.qrState === 'SCANNED' && o.orderStatus !== 'SERVED')
      .sort((a, b) => (a.scannedAt || 0) - (b.scannedAt || 0))
      .map(o => o.id);
  }, [activeOrders]);

  const [scanFeedback, setScanFeedback] = useState<{
    status: 'VALID' | 'INVALID' | null;
    message?: string;
    subtext?: string;
    orderId?: string;
  }>({ status: null });

  // --- REFS ---
  const lastScanTimestamp = useRef<number>(0);

  // --- MAINTENANCE & CLOCK ---
  useEffect(() => {
    const clockT = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // 🚀 PRODUCTION MAINTENANCE: Flush Missed Pickups (Every 60s)
    const maintenanceLoop = setInterval(async () => {
       const nodeId = `node_${profile.uid.slice(0,8)}`;
       await flushMissedPickups(nodeId).catch(console.warn);
    }, 60000);

    const unsubBatches = listenToBatches(setBatches);
    const unsubOrders = listenToActiveOrders(setActiveOrders);

    return () => {
      clearInterval(clockT);
      clearInterval(maintenanceLoop);
      unsubBatches();
      unsubOrders();
    };
  }, [profile.uid]);

  // --- HEADLESS SCANNER INPUT FOCUS ---
  useEffect(() => {
    if (activeWorkspace !== 'SERVER') return;

    const focusT = setInterval(() => {
      const el = document.getElementById('headless-scanner-input');
      if (el && document.activeElement !== el) el.focus();
    }, 1000);

    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true });
    scanner.onScan((data) => {
      if (activeWorkspace === 'SERVER') {
        handleQRScan(data);
      }
    });

    return () => {
      clearInterval(focusT);
      scanner.destroy();
    };
  }, [activeWorkspace]);

  // --- OPERATIONAL HANDLERS ---
  const handleQRScan = async (data: string) => {
    if (!data?.trim() || isScanning) return;

    const now = Date.now();
    if (now - lastScanTimestamp.current < 500) return;
    lastScanTimestamp.current = now;

    setIsScanning(true);
    setError(null);
    try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

        // 1. Validate & Mark as SCANNED in DB
        const order = await validateQRForServing(data);
        const isStaticMeal = order.items.every(it => it.orderType === 'FAST_ITEM');

        // 2. Success Feedback
        setScanFeedback({
          status: 'VALID',
          message: 'VALID',
          subtext: isStaticMeal ? 'Instant Serve' : 'Meal Verified',
          orderId: order.id.slice(-6).toUpperCase()
        });

        // 3. Fast Path completion
        if (isStaticMeal) {
           serveFullOrder(order.id, profile.uid).catch(console.error);
        }

        setTimeout(() => setScanFeedback({ status: null }), 1500);
    } catch (err: any) {
        setScanFeedback({
          status: 'INVALID',
          message: 'INVALID',
          subtext: err.message || 'Validation Failed'
        });
        setTimeout(() => setScanFeedback({ status: null }), 2000);
    } finally {
        setIsScanning(false);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        await serveItemBatch(orderId, itemId, qty, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate(50);
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleServeAll = async (orderId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        await serveFullOrder(orderId, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    } finally {
        setIsProcessing(false);
    }
  };

  const promoteOrder = async (orderId: string) => {
    try {
        await updateDoc(doc(db, 'orders', orderId), { scannedAt: Date.now() });
    } catch (err: any) {
        setError('Failed to focus order');
    }
  };

  const handleForceReady = async (orderId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
        await forceReadyOrder(orderId, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (err: any) {
        setError(err.message || 'Action Failed');
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans select-none overflow-hidden h-screen">
      {/* GLOBAL BACKGROUND FEEDBACK - STATIC FAST PATH */}
      {scanFeedback.status === 'VALID' && (
        <div className="fixed inset-0 z-[100] bg-green-600 flex flex-col items-center justify-center animate-in fade-in duration-300 pointer-events-none">
          <div className="bg-white/10 p-12 rounded-3xl backdrop-blur-md mb-8">
            <ShieldCheck className="w-32 h-32 text-white" />
          </div>
          <h1 className="text-7xl font-bold text-white tracking-widest uppercase animate-in zoom-in-95 duration-500">
            {scanFeedback.message}
          </h1>
          <p className="text-sm font-bold text-green-100 uppercase tracking-[0.5em] mt-6 border-t border-white/20 pt-6">
            {scanFeedback.subtext}
          </p>
        </div>
      )}

      {/* HEADER: OPERATIONAL DASHBOARD */}
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
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg">
                 {profile.name?.charAt(0) || 'S'}
              </div>
              <button onClick={onLogout} className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all">
                <LogOut className="w-5 h-5" />
              </button>
           </div>
        </div>
      </header>

      {/* MAIN WORKSPACE AREA */}
      <main className="flex-1 relative overflow-hidden bg-slate-50">
        {activeWorkspace === 'SERVER' ? (
           <ServerConsoleWorkspace 
              activeOrders={activeOrders}
              scanQueue={scanQueue}
              setScanQueue={(fn) => {
                 // Convert old functional setter usage to promoteOrder call
                 // This is a minimal shim to keep ServerConsoleWorkspace working
                 if (typeof fn === 'function') {
                    const nextId = fn([])[0];
                    if (nextId) promoteOrder(nextId);
                 }
              }}
              isCameraOpen={isCameraOpen}
              setIsCameraOpen={setIsCameraOpen}
              handleQRScan={handleQRScan}
              handleServeItem={handleServeItem}
              handleServeAll={handleServeAll}
              handleForceReady={handleForceReady}
              scanFeedback={scanFeedback}
              isProcessing={isProcessing}
           />
        ) : (
           <CookConsoleWorkspace batches={batches} />
        )}

        {/* ERROR OVERLAY */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-[110] animate-in slide-in-from-top duration-300">
            <AlertCircle className="w-6 h-6" />
            <span className="font-black uppercase tracking-widest text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 bg-white/20 p-1 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* HEADLESS SCANNER INPUT */}
        <input 
          id="headless-scanner-input"
          type="text" 
          className="absolute opacity-0 pointer-events-none"
          autoFocus
        />
        
        {/* CAMERA MODAL */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
            <button 
              onClick={() => setIsCameraOpen(false)}
              className="absolute top-8 right-8 w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white z-10"
            >
              <X className="w-8 h-8" />
            </button>
            <QRScanner
              onScan={(data) => {
                handleQRScan(data);
                setIsCameraOpen(false);
              }}
              onClose={() => setIsCameraOpen(false)}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default UnifiedKitchenConsole;
