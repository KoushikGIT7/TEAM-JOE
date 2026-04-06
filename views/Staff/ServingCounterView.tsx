import React, { useState, useRef, useCallback } from 'react';
import { LogOut, CheckCircle, AlertCircle, Clock, ChefHat } from 'lucide-react';
import { UserProfile } from '../../types';
import { validateQRForServing, serveItemBatch } from '../../services/firestore-db';
import { STATION_ID_BY_ITEM_ID, PREPARATION_STATIONS } from '../../constants';
import QRScanner from '../../components/QRScanner';

interface Props {
  profile: UserProfile;
  onLogout?: () => void;
  onOpenKitchen?: () => void;
}

type ScanState = 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'COOKING';

const ServingCounterView: React.FC<Props> = ({ profile, onLogout }) => {
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [scanState, setScanState] = useState<ScanState>('IDLE');
  const [feedback, setFeedback] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [servedItems, setServedItems] = useState<string[]>([]);
  const cooldownRef = useRef(false);

  const resetToIdle = useCallback((delay = 2500) => {
    setTimeout(() => {
      setScanState('IDLE');
      setFeedback('');
      setStudentName('');
      setServedItems([]);
      cooldownRef.current = false;
    }, delay);
  }, []);

  // ⚡ ZERO-LATENCY FULLY-AUTOMATIC SERVE ENGINE
  const processQRScan = useCallback(async (data: string) => {
    // Hard cooldown — ignore all scans during processing
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setScanState('PROCESSING');

    try {
      const { order, result } = await validateQRForServing(data.trim(), profile.uid);

      if (result === 'CONSUMED') {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        setScanState('ERROR');
        setFeedback('ALREADY SERVED');
        resetToIdle();
        return;
      }

      if (result === 'AWAITING_PAYMENT') {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
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
            // 🎤 [WRONG-STATION-VOICE]: Guide the student to the correct station
            if ('speechSynthesis' in window) {
               const msg = new SpeechSynthesisUtterance("Wrong station. Go to correct counter.");
               msg.rate = 1.2;
               window.speechSynthesis.speak(msg);
            }
            setScanState('ERROR');
            setFeedback("WRONG STATION - GO TO CORRECT COUNTER");
            resetToIdle(3000);
            return;
        }

        const cookingItems = stationItems.filter(it =>
            it.status !== 'READY' && it.status !== 'SERVED' && it.orderType !== 'FAST_ITEM' && it.status !== 'PENDING'
        );

        if (cookingItems.length > 0) {
            if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
            setScanState('COOKING');
            setFeedback("BEING PREPARED - READY SOON");
            resetToIdle(3000);
            return;
        }
        
        throw new Error("NO_READY_ITEMS");
      }
      const servePromises = readyItems.map(item => {
        const remaining = item.remainingQty ?? (item.quantity - (item.servedQty || 0));
        if (remaining <= 0) return Promise.resolve();
        return serveItemBatch(order.id, item.id, remaining, profile.uid);
      });

      await Promise.all(servePromises);

      if ('vibrate' in navigator) navigator.vibrate([50, 50, 150]);
      
      // 🎤 [SONIC-QUANTIFIER]: Detailed auditory check for staff to prevent 'Extra Plate' fraud
      if ('speechSynthesis' in window) {
        const itemSummaries = readyItems.map(it => {
            const qty = it.quantity || 1;
            return `${qty} ${it.name}${qty > 1 ? 's' : ''}`;
        });
        
        const msg = new SpeechSynthesisUtterance();
        msg.text = `Serving ${itemSummaries.join(' and ')} for ${order.userName || 'student'}`;
        msg.rate = 1.05;
        msg.pitch = 1;
        window.speechSynthesis.speak(msg);
      }

      setScanState('SUCCESS');
      setServedItems(readyItems.map(i => i.name));
      resetToIdle(2000);

    } catch (err: any) {
      if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
      
      // 🎤 [SONIC-ERROR-VOICE]: announce error
      if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(err.message || 'Scan failed');
        msg.rate = 1.2;
        window.speechSynthesis.speak(msg);
      }

      setScanState('ERROR');
      setFeedback(err.message || 'SCAN FAILED');
      resetToIdle();
    }
  }, [profile.uid, resetToIdle]);

  return (
    <div className="h-[100dvh] w-screen bg-black overflow-hidden relative font-sans text-white select-none">
      
      {/* 🍱 STATION SELECTOR (Admin Bar) */}
      <div className="absolute top-0 left-0 right-0 z-[150] bg-zinc-900/80 backdrop-blur-md border-b border-white/5 p-3 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
           <button 
             onClick={() => setSelectedStation('all')}
             className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedStation === 'all' ? 'bg-white text-black scale-105' : 'bg-white/5 text-white/40'}`}
           >
             ALL STATIONS ಪೂರೈಕೆ
           </button>
           {Object.values(PREPARATION_STATIONS).map(station => (
             <button 
               key={station.id}
               onClick={() => setSelectedStation(station.id)}
               className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedStation === station.id ? 'bg-emerald-500 text-white scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white/5 text-white/40'}`}
             >
               {station.name} {station.nameKn}
             </button>
           ))}
        </div>
        <button onClick={onLogout} className="p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all active:scale-90">
           <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* 1. FULL SCREEN CAMERA — always running */}
      <div className="absolute inset-0 z-0">
        <QRScanner onScan={processQRScan} onClose={() => {}} />
      </div>

      {/* 2. HEADER */}
      <div className="absolute top-0 w-full z-10 px-6 py-8 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start pointer-events-none">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter drop-shadow-xl">SONIC SCAN</h1>
          <p className="text-[11px] uppercase font-black text-emerald-400 tracking-widest">{profile.name}</p>
        </div>
        <button
          onClick={onLogout}
          className="pointer-events-auto p-4 bg-white/5 backdrop-blur-md rounded-[1.5rem] border border-white/10 active:scale-90 transition-all"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      {/* 3. CENTER HUD — scan state overlays */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">

        {/* IDLE — aiming ring */}
        {scanState === 'IDLE' && (
          <div className="opacity-20 border-4 border-white shadow-[0_0_30px_white] rounded-[4rem] w-72 h-72 flex items-center justify-center animate-pulse">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
        )}

        {/* PROCESSING — spinner */}
        {scanState === 'PROCESSING' && (
          <div className="w-32 h-32 border-[6px] border-emerald-400 border-t-transparent rounded-full animate-spin shadow-[0_0_60px_rgba(52,211,153,0.6)]" />
        )}

        {/* SUCCESS — auto-served */}
        {scanState === 'SUCCESS' && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-200">
            <div className="w-40 h-40 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_100px_rgba(52,211,153,0.8)]">
              <CheckCircle className="w-20 h-20 text-black" strokeWidth={3} />
            </div>
            <div className="text-center bg-black/60 backdrop-blur-xl px-10 py-6 rounded-[2.5rem] border border-emerald-500/30">
              <p className="text-emerald-400 font-black tracking-widest uppercase text-xs mb-2">Served to</p>
              <p className="text-4xl font-black">{studentName}</p>
              {servedItems.length > 0 && (
                <p className="text-white/60 font-bold text-sm mt-2 truncate max-w-[260px]">
                  {servedItems.join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ERROR */}
        {scanState === 'ERROR' && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-200">
            <div className="w-40 h-40 rounded-full bg-red-600 flex items-center justify-center shadow-[0_0_100px_rgba(220,38,38,0.8)]">
              <AlertCircle className="w-20 h-20 text-white" strokeWidth={3} />
            </div>
            <div className="bg-red-600/90 backdrop-blur-xl px-10 py-6 rounded-[2.5rem] border border-red-400/30 text-center">
              <p className="text-4xl font-black italic tracking-tighter">{feedback}</p>
            </div>
          </div>
        )}

        {/* COOKING — item not ready */}
        {scanState === 'COOKING' && (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-200">
            <div className="w-40 h-40 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_100px_rgba(245,158,11,0.8)]">
              <ChefHat className="w-20 h-20 text-black" strokeWidth={2.5} />
            </div>
            <div className="bg-black/80 backdrop-blur-xl px-10 py-6 rounded-[2.5rem] border border-amber-500/40 text-center">
              <p className="text-amber-400 font-black tracking-widest uppercase text-xs mb-2">Still Cooking</p>
              <p className="text-xl font-bold text-white/80 max-w-[260px] text-center">{feedback}</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM STATUS BAR */}
      <div className="absolute bottom-0 w-full z-10 px-6 pb-10 pt-6 bg-gradient-to-t from-black/90 to-transparent flex justify-center pointer-events-none">
        <div className="px-8 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3">
          {scanState === 'IDLE' && (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-black uppercase tracking-widest text-white/60">Ready to Scan</p>
            </>
          )}
          {scanState === 'PROCESSING' && (
            <>
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
              <p className="text-xs font-black uppercase tracking-widest text-blue-400">Processing...</p>
            </>
          )}
          {scanState === 'SUCCESS' && (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Order Served!</p>
            </>
          )}
          {(scanState === 'ERROR' || scanState === 'COOKING') && (
            <>
              <Clock className="w-3 h-3 text-amber-400" />
              <p className="text-xs font-black uppercase tracking-widest text-amber-400">Scan Next</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServingCounterView;
