import React, { useState, useCallback } from 'react';
import {
  LogOut, Scan, CheckCircle, AlertCircle, RefreshCw,
  Smartphone, User, Clock, XCircle, ShoppingBag, Zap
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { 
  rejectOrderFromCounter, 
  forceReadyOrder, 
  listenToActiveOrders, 
  serveOrderItemsAtomic,
  validateQRForServing
} from '../../services/firestore-db';
import { parseQRPayload } from '../../services/qr';
import { FAST_ITEM_CATEGORIES } from '../../constants';
import Logo from '../../components/Logo';
import QRScanner from '../../components/QRScanner';

interface ScannerViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

type TerminalState = 'IDLE' | 'SCANNING' | 'REVIEW' | 'SUCCESS' | 'ERROR';

const ScannerView: React.FC<ScannerViewProps> = ({ profile, onLogout }) => {
  const [terminalState, setTerminalState] = useState<TerminalState>('IDLE');
  const [scannedOrder, setScannedOrder]   = useState<Order | null>(null);
  const [errorMsg, setErrorMsg]           = useState('');
  const [serving, setServing]             = useState(false);
  const [rejecting, setRejecting]         = useState(false);
  const [isCameraOpen, setIsCameraOpen]   = useState(false);

  const busy = serving || rejecting;

  const [activePool, setActivePool]       = useState<Order[]>([]);
  const lastScannedIdRef                  = React.useRef<string | null>(null);
  const scanLockRef                       = React.useRef<boolean>(false);

  // 🛡️ [Principal Architect] - Real-time sync of all active orders in the station.
  // This is the CORE CACHE that prevents Quota Exceeded errors.
  React.useEffect(() => {
    const unsub = listenToActiveOrders((data) => {
      setActivePool(data);
    });
    return () => unsub();
  }, []);

  const resumeScannerSafely = () => {
    setTerminalState('IDLE');
    setScannedOrder(null);
    setErrorMsg('');
    
    // Clear lock with a small delay so human movement doesn't instantly re-trigger
    setTimeout(() => {
       lastScannedIdRef.current = null;
       scanLockRef.current = false;
    }, 1500);
  };

  const handleScan = useCallback(async (rawData: string) => {
    // 🛡️ [STABLE-SHIELD] Synchronous gate to prevent scan-storm
    if (scanLockRef.current || terminalState !== 'IDLE') return;
    scanLockRef.current = true;

    setTerminalState('SCANNING');
    setErrorMsg('');

    try {
      const data = rawData.trim();
      
      // 1. Parsing payload locally first (0ms cost)
      let targetId = data;
      const parsed = await parseQRPayload(data);
      if (parsed) targetId = parsed.orderId;

      // Dedupe: Skip if we just scanned this 
      if (lastScannedIdRef.current === targetId) {
        scanLockRef.current = false;
        setTerminalState('IDLE');
        return;
      }
      lastScannedIdRef.current = targetId;

      // 2. [ROOT FIX] Look-up from local activeOrders cache (Zero Quota Usage!)
      const localMatched = activePool.find(o => o.id === targetId || o.id.slice(-8) === targetId.slice(-8));

      if (localMatched) {
        setScannedOrder(localMatched);
        setTerminalState('REVIEW');
        scanLockRef.current = false;
        return;
      }

      // 3. Fallback: Direct DB validation only if item is NOT in active cache (unlikely)
      const { order, result } = await validateQRForServing(data, profile.uid);
      setScannedOrder(order);
      setTerminalState(result === 'CONSUMED' ? 'SUCCESS' : 'REVIEW');
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification Error');
      setTerminalState('ERROR');
    } finally {
      scanLockRef.current = false;
    }
  }, [terminalState, profile.uid, activePool]);

  const handleServeAll = async () => {
    if (!scannedOrder || busy) return;
    setServing(true);

    try {
      // [DYNAMIC FLOW FIX] Isolate only items that are physically ready to be dispensed right now
      const targetItemIds = scannedOrder.items
        .filter(it => {
           const remaining = it.remainingQty !== undefined ? it.remainingQty : it.quantity;
           if (remaining <= 0) return false;
           const isFast = it.orderType === 'FAST_ITEM' || FAST_ITEM_CATEGORIES.includes(it.category);
           const isReady = it.status === 'READY' || isFast || scannedOrder.qrRedeemable;
           return isReady;
        })
        .map(it => it.id);

      if (targetItemIds.length === 0) {
        const hasUnserved = scannedOrder.items.some(it => (it.remainingQty || 0) > 0);
        if (hasUnserved) {
           throw new Error("Target items are still preparing. Check Kitchen progress.");
        } else {
           throw new Error("All items in this ticket have already been dispensed.");
        }
      }

      // ATOMIC PARTIAL SERVE
      await serveOrderItemsAtomic(scannedOrder.id, targetItemIds, profile.uid);
      
      setTerminalState('SUCCESS');
      setScannedOrder(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed');
      setTerminalState('ERROR');
    } finally {
      setServing(false);
    }
  };

  const handleForceReady = async () => {
     if (!scannedOrder || busy) return;
     setServing(true);
     try {
        await forceReadyOrder(scannedOrder.id, profile.uid);
        const updatedItems = scannedOrder.items.map(it => ({ ...it, status: 'READY' as any }));
        setScannedOrder({ ...scannedOrder, items: updatedItems, qrRedeemable: true });
        setServing(false);
        setTimeout(() => handleServeAll(), 50);
     } catch (err: any) {
        setErrorMsg(err.message || 'Override failed');
        setTerminalState('ERROR');
        setServing(false);
     }
  };

  const handleReject = async () => {
    if (!scannedOrder || busy) return;
    setRejecting(true);

    try {
      await rejectOrderFromCounter(scannedOrder.id, profile.uid);
      setErrorMsg('TICKET REJECTED');
      setTerminalState('ERROR');
      setScannedOrder(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Rejection error');
      setTerminalState('ERROR');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col max-w-lg mx-auto font-sans shadow-xl border-x border-slate-200">
      
      {/* 📸 CAMERA INTAKE */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[200]">
           <QRScanner
             onScan={(data, _resume) => { 
                setIsCameraOpen(false); // Unmount physical camera
                handleScan(data); // Start zero-latency pipeline
                // 🚫 DO NOT call resume() here. We explicitly unmount the camera.
                // Re-enabling the lock happens safely after 1.5s in resumeScannerSafely().
             }}
             onClose={() => setIsCameraOpen(false)}
             isScanning={terminalState === 'SCANNING'}
           />
        </div>
      )}

      {/* 🏷️ HEADER */}
      <div className="p-6 flex justify-between items-center bg-white border-b border-slate-200 shrink-0 shadow-sm">
        <Logo size="sm" className="!text-slate-900 !font-black !tracking-tight" />
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">SERVER STATION</p>
            <p className="text-sm font-bold mt-0.5 text-slate-700">{profile?.name || 'Authorized Staff'}</p>
          </div>
          <button onClick={onLogout} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 transition-all active:scale-90">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">

        {/* 📟 IDLE STATE */}
        {terminalState === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-10">
            <div className="w-64 h-64 border-2 border-slate-200 rounded-3xl flex items-center justify-center bg-white shadow-sm relative overflow-hidden group">
              <Scan className="w-24 h-24 text-slate-200 group-hover:text-green-500 transition-colors" />
              <div className="absolute inset-4 border border-slate-50 rounded-2xl" />
              <div className="absolute bottom-4 right-4 bg-slate-900 text-white p-3 rounded-xl shadow-lg">
                <Smartphone className="w-6 h-6" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">
                Awaiting Token
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] px-10">
                Position scan within frame or trigger camera below
              </p>
            </div>

            <button
              onClick={() => setIsCameraOpen(true)}
              className="w-full bg-slate-900 hover:bg-black py-6 rounded-2xl font-bold text-lg uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all text-white shadow-xl"
            >
              <Scan className="w-6 h-6" />
              Start Token Scan
            </button>
          </div>
        )}

        {/* 🔄 PROCESSING */}
        {terminalState === 'SCANNING' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <RefreshCw className="w-8 h-8 text-slate-900 animate-spin" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Verifying DB Link…</p>
          </div>
        )}

        {/* 📋 REVIEW STATE */}
        {terminalState === 'REVIEW' && scannedOrder && (
          <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
               <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Scanned ID</p>
                  <p className="font-mono text-2xl font-black text-slate-900">#{scannedOrder.id.slice(-6).toUpperCase()}</p>
               </div>
               <div className="bg-slate-100 px-4 py-2 rounded-xl text-slate-600 font-bold text-[10px] uppercase tracking-wider border border-slate-200">
                  {scannedOrder.items.length} Items Listed
               </div>
            </div>

            <div className="flex-1 space-y-3">
              {scannedOrder.items.map((item) => {
                const remaining = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
                const isFast = item.orderType === 'FAST_ITEM' || FAST_ITEM_CATEGORIES.includes(item.category);
                const isReady = item.status === 'READY' || isFast || scannedOrder.qrRedeemable;
                
                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex items-center p-4 gap-5 shadow-sm">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100">
                      <img
                        src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                         <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                         <p className={`text-[9px] font-bold uppercase tracking-widest ${isReady ? 'text-green-600' : 'text-amber-600'}`}>
                           {isReady ? 'Dispense Ready' : 'Prep in Progress'}
                         </p>
                      </div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">{item.name}</h3>
                      <p className="text-2xl font-bold text-slate-900 font-mono tracking-tighter mt-1 leading-none">×{remaining}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Verification Footer Overlay */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Authenticated Holder</p>
                <p className="font-bold text-lg text-slate-900 uppercase italic leading-none">{scannedOrder.userName}</p>
              </div>
            </div>

            {/* GRID ACTIONS */}
            <div className="grid grid-cols-4 gap-3 pt-2">
              <button
                onClick={handleReject}
                disabled={busy}
                className="col-span-1 bg-white h-16 rounded-xl border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all active:scale-95"
              >
                <XCircle className="w-5 h-5" />
              </button>
              
              <button
                onClick={handleServeAll}
                disabled={busy}
                className="col-span-3 bg-green-600 hover:bg-green-700 h-16 rounded-xl font-bold text-xs uppercase tracking-[0.2em] text-white shadow-xl shadow-green-900/10 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {serving ? <RefreshCw className="animate-spin w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                Dispense All Ready
              </button>

              {scannedOrder.items.some(it => it.status !== 'READY' && it.orderType === 'PREPARATION_ITEM' && (it.remainingQty || 0) > 0) && !scannedOrder.qrRedeemable && (
                <button
                  onClick={handleForceReady}
                  disabled={busy}
                  className="col-span-4 bg-amber-50 h-16 rounded-xl border border-amber-200 text-amber-600 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-amber-100 transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4" />
                  Kitchen Bypass Override
                </button>
              )}
            </div>
          </div>
        )}

        {/* ✅ SUCCESS STATE */}
        {terminalState === 'SUCCESS' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 rounded-2xl bg-green-600 flex items-center justify-center shadow-lg shadow-green-900/10">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900 italic">Verified</h2>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Transaction log updated</p>
            </div>
            <button onClick={resumeScannerSafely} className="w-full mt-6 bg-slate-900 text-white py-6 rounded-2xl font-bold uppercase tracking-widest active:scale-95 transition-all shadow-xl">
              Next Customer Scan
            </button>
          </div>
        )}

        {/* ❌ ERROR STATE */}
        {terminalState === 'ERROR' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-24 h-24 rounded-2xl bg-red-50 flex items-center justify-center border-2 border-red-100 text-red-500">
              <AlertCircle className="w-12 h-12" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-4xl font-black tracking-tighter uppercase text-red-600 italic">Rejected</h2>
              <p className="text-red-400 font-bold text-[10px] uppercase tracking-widest max-w-[200px] mx-auto">
                {errorMsg}
              </p>
            </div>
            <button onClick={resumeScannerSafely} className="w-full mt-6 bg-white border border-slate-200 py-6 rounded-2xl font-bold uppercase tracking-widest text-slate-700 active:scale-95 transition-all shadow-sm">
              Return to Scanning
            </button>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-200 flex justify-between items-center bg-white">
        <div className="flex items-center gap-2.5 opacity-40">
          <Clock className="w-4 h-4 text-slate-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Secure Station v2</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 opacity-60" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Ops Link</span>
        </div>
      </div>
    </div>
  );
};

export default ScannerView;
