import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, X, AlertCircle, LogOut
} from 'lucide-react';
import { UserProfile, Order, PrepBatch } from '../../types';
import {
  listenToBatches,
  validateQRForServing,
  serveItemBatch,
  serveFullOrder,
  listenToActiveOrders
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
  // --- STATE ---
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const [scanFeedback, setScanFeedback] = useState<{ 
    status: 'VALID' | 'INVALID' | null, 
    message?: string,
    subtext?: string,
    orderId?: string
  }>({ status: null });

  // --- WORKSPACE STATE ---
  const [activeWorkspace, setActiveWorkspace] = useState<'COOK' | 'SERVER'>('SERVER');

  // --- REFS ---
  const lastScanTimestamp = useRef<number>(0);

  // --- TIME & SCANNER ---
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);

    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true });
    scanner.onScan((data) => {
      // Only process scans if in SERVER workspace
      if (activeWorkspace === 'SERVER') {
        handleQRScan(data);
      }
    });

    return () => {
      clearInterval(t);
      scanner.destroy();
    };
  }, [activeWorkspace]);

  // --- LISTENERS ---
  useEffect(() => {
    const unsubBatches = listenToBatches(setBatches);
    const unsubOrders = listenToActiveOrders(setActiveOrders);
    return () => {
        unsubBatches();
        unsubOrders();
    };
  }, []);

  // --- HANDLERS ---
  const handleQRScan = async (data: string) => {
    if (!data?.trim() || isScanning) return;

    // 🛡️ SCAN THROTTLING: Prevent repeated scans within 500ms (High Throughput)
    const now = Date.now();
    if (now - lastScanTimestamp.current < 500) return;
    lastScanTimestamp.current = now;

    setIsScanning(true);
    setError(null);
    try {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

        // 1. Fetch FULL Order
        const order = await validateQRForServing(data);
        
        // Check if fully static (no prep needed) -> Fast Path Static Meal
        const isStaticMeal = order.items.every(it => it.orderType === 'FAST_ITEM');

        // 2. Success Feedback (Traffic Signal Green)
        setScanFeedback({
          status: 'VALID',
          message: 'VALID',
          subtext: isStaticMeal ? 'Instant Serve' : 'Meal Verified',
          orderId: order.id.slice(-6).toUpperCase()
        });

        if (isStaticMeal) {
           // Auto-serve in background, do not clutter queue
           serveFullOrder(order.id, profile.uid).catch(console.error);
        } else {
           // 3. Add to Queue and Focus (for prep items)
           setScanQueue(prev => {
             const exists = prev.includes(order.id);
             if (exists) {
               // Re-prioritize to front
               return [order.id, ...prev.filter(id => id !== order.id)];
             }
             return [order.id, ...prev];
           });
        }

        // 4. Return to scan mode after 1.2 seconds (overlay fades quickly)
        setTimeout(() => setScanFeedback({ status: null }), 1200);

    } catch (err: any) {
        // Failure Feedback (Traffic Signal Red)
        setScanFeedback({
          status: 'INVALID',
          message: 'INVALID',
          subtext: err.message || 'QR not valid'
        });
        
        setTimeout(() => setScanFeedback({ status: null }), 1500);
    } finally {
        setIsScanning(false);
    }
  };

  const handleServeItem = async (orderId: string, itemId: string, qty: number) => {
    try {
        await serveItemBatch(orderId, itemId, qty, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate(50);

        // Auto-remove from queue if fully served
        const order = activeOrders.find(o => o.id === orderId);
        if (order) {
          const allDone = order.items.every(item => {
            const rem = item.id === itemId 
              ? (item.remainingQty ?? (item.quantity - (item.servedQty || 0))) - qty
              : (item.remainingQty ?? (item.quantity - (item.servedQty || 0)));
            return rem <= 0;
          });
          if (allDone) {
            // Auto complete immediately if 0 items remaining
            setTimeout(() => setScanQueue(prev => prev.filter(id => id !== orderId)), 300);
          }
        }
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    }
  };

  const handleServeAll = async (orderId: string) => {
    try {
        setScanQueue(prev => prev.filter(id => id !== orderId));
        await serveFullOrder(orderId, profile.uid);
        if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
    } catch (err: any) {
        setError(err.message || 'Serve Failed');
    }
  };

  // --- WORKSPACE RENDERING ---

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] flex flex-col font-sans text-slate-900 overflow-hidden">
      
      {/* Workspace Header - Top Bar */}
      <header className="h-20 border-b border-slate-200 bg-white px-8 flex items-center justify-between shrink-0 z-40">
         <div className="flex items-center gap-6">
           {/* Segmented Workspace Switch */}
           <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
              <button 
                onClick={() => setActiveWorkspace('COOK')}
                className={`px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${
                  activeWorkspace === 'COOK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Production Pipeline
              </button>
              <button 
                onClick={() => setActiveWorkspace('SERVER')}
                className={`px-6 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${
                  activeWorkspace === 'SERVER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Scan & Serve
              </button>
           </div>
         </div>

         <div className="flex items-center gap-8">
           <div className="text-right hidden sm:block">
             <p className="text-sm font-black text-slate-900 leading-none mb-1">
               {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
             </p>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               {activeWorkspace === 'COOK' ? 'Kitchen Mode' : 'Counter Mode'}
             </p>
           </div>
           <button onClick={onLogout} className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm hover:text-red-500 hover:bg-red-50 transition-all">
             <LogOut className="w-5 h-5" />
           </button>
         </div>
      </header>

      {/* Dynamic Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative w-full">
        {activeWorkspace === 'SERVER' ? (
           <ServerConsoleWorkspace 
              activeOrders={activeOrders}
              scanQueue={scanQueue}
              setScanQueue={setScanQueue}
              isCameraOpen={isCameraOpen}
              setIsCameraOpen={setIsCameraOpen}
              handleQRScan={handleQRScan}
              handleServeItem={handleServeItem}
              handleServeAll={handleServeAll}
              scanFeedback={scanFeedback}
           />
        ) : (
           <CookConsoleWorkspace batches={batches} />
        )}
      </main>

      {/* Manual Scanner Modal overlay */}
      {isCameraOpen && activeWorkspace === 'SERVER' && (
        <div className="fixed inset-0 z-[110] bg-slate-950/95 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
            <button onClick={() => setIsCameraOpen(false)} className="absolute top-6 right-6 z-10 w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-900 border border-slate-200 hover:bg-slate-100 transition-all">
              <X className="w-6 h-6" />
            </button>
            <div className="bg-slate-900 p-10 pt-16 text-center text-white">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
              <h2 className="text-3xl font-black tracking-tight mb-2 uppercase italic">Secure Scan Mode</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">Validating student tokens manually</p>
            </div>
            <div className="p-10 bg-[#FAFAFA]">
              <div className="bg-white rounded-[2.5rem] overflow-hidden aspect-square flex items-center justify-center border-2 border-slate-100 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] relative">
                <QRScanner
                  onScan={(data) => { setIsCameraOpen(false); handleQRScan(data); }}
                  onClose={() => setIsCameraOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Error Toast */}
      {error && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2rem] shadow-2xl z-[200] flex items-center gap-6 animate-in slide-in-from-bottom-10 duration-[600ms] border border-white/5 whitespace-nowrap">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <p className="font-bold text-sm tracking-tight">{error}</p>
          <button onClick={() => setError(null)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all ml-4">
             <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
};

export default UnifiedKitchenConsole;
