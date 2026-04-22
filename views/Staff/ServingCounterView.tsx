import React, { useState, useRef, useCallback } from 'react';
import { LogOut, CheckCircle, AlertCircle, Clock, ChefHat, Zap } from 'lucide-react';
import { UserProfile } from '../../types';
import { validateQRForServing, serveOrderItemsAtomic } from '../../services/firestore-db';
import { STATION_ID_BY_ITEM_ID, PREPARATION_STATIONS } from '../../constants';
import QRScanner from '../../components/QRScanner';

interface Props {
  profile: UserProfile;
  onLogout?: () => void;
  onOpenKitchen?: () => void;
}

type ScanState = 'IDLE' | 'SUCCESS' | 'ERROR' | 'COOKING';

const ServingCounterView: React.FC<Props> = ({ profile, onLogout }) => {
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [scanState, setScanState] = useState<ScanState>('IDLE');
  const [feedback, setFeedback] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [servedItems, setServedItems] = useState<string[]>([]);
  
  // 🥊 ASYNC LOCKS (Microsecond Precision)
  const isProcessingScannerRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);

  const resetToIdle = useCallback((delay = 800) => {
    setTimeout(() => {
      setScanState('IDLE');
      setFeedback('');
      setStudentName('');
      setServedItems([]);
      isProcessingScannerRef.current = false;
    }, delay);
  }, []);

  // ⚡ SUPERSONIC ZERO-WAIT SERVE ENGINE
  const processQRScan = useCallback(async (data: string) => {
    const now = Date.now();
    const token = data.trim();
    
    // 🛡️ [RAPID-DEBOUNCE]: Fast-track next scanner (800ms ttl)
    if (lastScannedTokenRef.current?.token === token && now - lastScannedTokenRef.current.time < 800) return;
    if (isProcessingScannerRef.current) return;
    
    isProcessingScannerRef.current = true;
    lastScannedTokenRef.current = { token, time: now };

    try {
      // 🚀 [HYPER-CORE]: Unlock the scanner 1ms after DB results to permit "Rapid-Fire" multi-student intake
      // Success modal stays up for visibility, but doesn't block the NEXT scan.
      
      const { order, result } = await validateQRForServing(token, profile.uid, true); // true = autoServeReady

      // ✅ CONSUMED = all fast-items were just served atomically RIGHT NOW → big success
      // ✅ MANIFESTED = dynamic/prep items queued for kitchen → success (waiting)
      // ✅ ALREADY_MANIFESTED = re-scan of prep order, kitchen still cooking → show success
      if (result === 'CONSUMED' || result === 'MANIFESTED' || result === 'ALREADY_MANIFESTED') {
        setScanState('SUCCESS');
        setStudentName(order.userName || 'Student');

        // Show items that were just served (within 5s) or all served items for CONSUMED
        const justServed = order.items?.filter((i: any) =>
          i.status === 'SERVED' && (result === 'CONSUMED' || (Date.now() - (i.servedAt || 0) < 5000))
        ).map((i: any) => i.name) || [];
        setServedItems(justServed);

        // Haptic feedback
        if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);

        // ⚡ RELEASE LOCK EARLY: Next student can be scanned immediately
        isProcessingScannerRef.current = false;
        resetToIdle(result === 'ALREADY_MANIFESTED' ? 3000 : 2000);
        return;
      }

      // AWAITING_PAYMENT: rare edge case
      setScanState('ERROR');
      setFeedback('PAYMENT PENDING');
      isProcessingScannerRef.current = false;
      resetToIdle(1500);

    } catch (err: any) {
      // Translate raw Firebase/internal error codes into human-readable messages
      const msg: string = err.message || '';
      let display = 'SCAN ERROR';
      if (msg.includes('ALREADY_CONSUMED') || msg.includes('ALREADY_SERVED'))  display = 'ALREADY SERVED';
      else if (msg.includes('ORDER_NOT_FOUND'))                                 display = 'ORDER NOT FOUND';
      else if (msg.includes('INVALID_QR') || msg.includes('INVALID_PAYLOAD'))  display = 'INVALID QR CODE';
      else if (msg.includes('SECURITY_BREACH'))                                 display = 'SECURITY ALERT';
      else if (msg.includes('PAYMENT'))                                         display = 'PAYMENT NOT VERIFIED';
      else if (msg.includes('EXPIRED'))                                         display = 'QR CODE EXPIRED';

      setScanState('ERROR');
      setFeedback(display);
      isProcessingScannerRef.current = false;
      resetToIdle(1500);
    }
  }, [profile.uid, resetToIdle]);

  return (
    <div className="h-[100dvh] w-screen bg-black overflow-hidden relative font-sans text-white select-none">
      
      {/* 🍱 HEADER / STATUS */}
      <div className="absolute top-0 left-0 right-0 z-[150] bg-zinc-900/40 backdrop-blur-3xl border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400" />
           <div>
             <h2 className="text-xs font-black uppercase tracking-widest text-white leading-none">Universal Scanner</h2>
             <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1 italic animate-pulse tracking-[0.2em]">Ready for Pickup</p>
           </div>
        </div>
        <button onClick={onLogout} className="p-3 bg-white/5 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all active:scale-90">
           <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* 1. CAMERA FEED (Sonic Mode) */}
      <div className="absolute inset-0 z-0">
        <QRScanner onScan={processQRScan} onClose={() => {}} />
      </div>

      {/* 2. RAPID FEEDBACK ENGINE (HUD) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">

        {/* Scan Status Modal (Minimal) */}
        {scanState !== 'IDLE' && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-50 duration-200">
            
            <div className={`w-40 h-40 rounded-[3rem] flex items-center justify-center shadow-2xl transition-colors duration-300 ${
              scanState === 'SUCCESS' ? 'bg-emerald-500 shadow-emerald-500/60' : 
              scanState === 'COOKING' ? 'bg-amber-500 shadow-amber-500/60' : 
              'bg-red-600 shadow-red-600/60'
            }`}>
              {scanState === 'SUCCESS' ? <CheckCircle className="w-20 h-20 text-black" strokeWidth={3} /> : 
               scanState === 'COOKING' ? <ChefHat className="w-20 h-20 text-black" strokeWidth={2.5} /> : 
               <AlertCircle className="w-20 h-20 text-white" strokeWidth={3} />}
            </div>

            <div className="text-center bg-black/80 backdrop-blur-2xl px-12 py-8 rounded-[3rem] border border-white/10 shadow-3xl max-w-[85vw]">
               <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 ${
                 scanState === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'
               }`}>
                 {scanState === 'SUCCESS' ? 'Order Served' : 'Handover Restricted'}
               </h3>
               <p className="text-4xl font-black italic tracking-tighter leading-none mb-4">
                 {scanState === 'SUCCESS' ? studentName : feedback}
               </p>
               {scanState === 'SUCCESS' && servedItems.length > 0 && (
                 <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {servedItems.map((item, idx) => (
                      <span key={idx} className="px-5 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400">
                        {item}
                      </span>
                    ))}
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Target Finder (Only visible when IDLE) */}
        {scanState === 'IDLE' && (
          <div className="relative opacity-20 transition-opacity">
            <div className="w-80 h-80 rounded-[4rem] border-4 border-dashed border-white animate-[pulse_2s_infinite]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_15px_white]" />
            </div>
          </div>
        )}
      </div>

      {/* 3. STATUS TAIL (Bottom UI) */}
      <div className="absolute bottom-10 inset-x-0 flex justify-center z-20 pointer-events-none">
        <div className="px-10 py-4 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-xl flex items-center gap-3">
          <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Sonic Mode Active</p>
        </div>
      </div>

    </div>
  );
};

export default ServingCounterView;
