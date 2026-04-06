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
  
  // 🥊 ASYNC LOCKS (Optimistic UI)
  const isProcessingScannerRef = useRef(false);

  const resetToIdle = useCallback((delay = 2000) => {
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
    // 🛡️ [PARALLEL-INTAKE]: Allow new scans while UI transitions
    if (isProcessingScannerRef.current) return;
    isProcessingScannerRef.current = true;

    try {
      // 🚀 [ZERO-LATENCY-BEEP]: Confirm scan instantly in the UI
      if ('vibrate' in navigator) navigator.vibrate(50);
      
      const { order, result } = await validateQRForServing(data.trim(), profile.uid);

      if (result === 'CONSUMED') {
        setScanState('ERROR');
        setFeedback('ALREADY SERVED');
        resetToIdle();
        return;
      }

      if (result === 'AWAITING_PAYMENT') {
        setScanState('ERROR');
        setFeedback('PAYMENT PENDING');
        resetToIdle();
        return;
      }

      // 🛡️ [STATION-SHIELD]: Filter items to only those belonging to this physical counter
      const allItems = order.items || [];
      const stationItems = allItems.filter(it => {
        const itemStation = STATION_ID_BY_ITEM_ID[it.id] || 'default';
        return selectedStation === 'all' || itemStation === selectedStation;
      });

      const readyItems = stationItems.filter(it =>
        it.status === 'READY' || it.status === 'PENDING' || it.orderType === 'FAST_ITEM'
      );
      
      const otherStationReady = allItems.filter(it => {
        const itemStation = STATION_ID_BY_ITEM_ID[it.id] || 'default';
        const isMatch = selectedStation === 'all' || itemStation === selectedStation;
        const isReady = it.status === 'READY' || it.status === 'PENDING' || it.orderType === 'FAST_ITEM';
        return !isMatch && isReady;
      });

      if (readyItems.length === 0) {
        if (otherStationReady.length > 0) {
            setScanState('ERROR');
            setFeedback("WRONG COUNTER - GO TO CORRECT STATION");
            resetToIdle(3000);
            return;
        }

        const cookingItems = stationItems.filter(it =>
            it.status !== 'READY' && it.status !== 'SERVED' && it.orderType !== 'FAST_ITEM' && it.status !== 'PENDING'
        );

        if (cookingItems.length > 0) {
            setScanState('COOKING');
            setFeedback("STILL COOKING - READY SOON");
            resetToIdle(3000);
            return;
        }
        
        throw new Error("NO READY ITEMS FOUND");
      }

      // 🧹 [ATOMIC-SERVE]: Use single transaction for rapid multi-item serving
      const readyItemIds = readyItems.map(i => i.id);
      await serveOrderItemsAtomic(order.id, readyItemIds, profile.uid);

      // 🎤 [SONIC-VOICE-FEEDBACK]: Snappy and confirmed
      if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance();
        msg.text = 'Order Completed';
        msg.rate = 1.4;
        window.speechSynthesis.speak(msg);
      }

      setScanState('SUCCESS');
      setStudentName(order.userName || 'Student');
      setServedItems(readyItems.map(i => i.name));
      resetToIdle(1800);

    } catch (err: any) {
      setScanState('ERROR');
      setFeedback(err.message || 'UNABLE TO SERVE');
      resetToIdle();
    }
  }, [profile.uid, resetToIdle, selectedStation]);

  return (
    <div className="h-[100dvh] w-screen bg-black overflow-hidden relative font-sans text-white select-none">
      
      {/* 🍱 STATION SELECTOR (Static Admin Overrides) */}
      <div className="absolute top-0 left-0 right-0 z-[150] bg-zinc-900/40 backdrop-blur-3xl border-b border-white/5 p-3 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pr-12">
           <button 
             onClick={() => setSelectedStation('all')}
             className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedStation === 'all' ? 'bg-primary text-white scale-105' : 'bg-white/5 text-white/40'}`}
           >
             All Counters
           </button>
           {Object.values(PREPARATION_STATIONS).map(station => (
             <button 
               key={station.id}
               onClick={() => setSelectedStation(station.id)}
               className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedStation === station.id ? 'bg-emerald-500 text-white scale-105 shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-white/40'}`}
             >
               {station.name}
             </button>
           ))}
        </div>
        <button onClick={onLogout} className="p-3 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all active:scale-90 absolute right-3">
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
