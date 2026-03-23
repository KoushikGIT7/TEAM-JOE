import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CheckCircle, 
  XSquare, 
  ChevronRight, 
  AlertCircle,
  Clock,
  LogOut,
  Sparkles,
  Zap,
  ShieldCheck,
  Timer
} from 'lucide-react';
import { Order, UserProfile } from '../../types';
import { getScanLogs, processAtomicIntake } from '../../services/firestore-db';
import QRScanner from '../../components/QRScanner';
import Logo from '../../components/Logo';

interface ScannerViewProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
}

const ScannerView: React.FC<ScannerViewProps> = ({ profile, onLogout }) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [terminalState, setTerminalState] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [lastResult, setLastResult] = useState<{ title: string; sub: string } | null>(null);

  // 🛡️ [Principal Architect] Sonic Feedback Engine
  const triggerStrobe = (state: 'SUCCESS' | 'ERROR', title: string, sub: string) => {
    setLastResult({ title, sub });
    setTerminalState(state);
    
    if ('vibrate' in navigator) {
       if (state === 'SUCCESS') navigator.vibrate(100);
       else navigator.vibrate([200, 100, 200]);
    }

    // Auto-dismiss 
    setTimeout(() => {
       setTerminalState('IDLE');
       setLastResult(null);
    }, state === 'SUCCESS' ? 1200 : 2500);
  };

  const handleScan = async (data: string) => {
    if (!data?.trim() || terminalState !== 'IDLE') return;

    // 🏎️ [PREDICTIVE-UI] Instant validation flash
    triggerStrobe('SUCCESS', 'VERIFYING...', 'Checking Token Integrity');

    try {
      const { result } = await processAtomicIntake(data.trim(), profile.uid);
      
      // [PHASED-AUDIT] Type-Cast for string comparison as result might be an extended enum
      const res = result as string;
      
      if (res === 'ALREADY_MANIFESTED' || res === 'ALREADY_CONSUMED') {
         // Silent re-scan gate
         return;
      }

      if (res === 'AWAITING_PAYMENT') {
        triggerStrobe('ERROR', 'UNPAID ORDER', 'Send student to cashier');
      } else if (res === 'CONSUMED') {
        triggerStrobe('SUCCESS', 'VERIFIED ✅', 'RELEASE MEAL NOW');
      } else if (res === 'MANIFESTED') {
        triggerStrobe('SUCCESS', 'CONFIRMED ✅', 'MANIFEST CREATED IN KITCHEN');
      }
      
      refreshLogs();
    } catch (err: any) {
      triggerStrobe('ERROR', 'SCAN ERROR', (err?.message || 'Transaction failed').toUpperCase());
    }
  };

  const refreshLogs = async () => {
    try {
      const logs = await getScanLogs(20);
      setRecentScans(logs);
    } catch (e) {
      console.error("Log refresh failed:", e);
    }
  };

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-slate-50 flex-col overflow-hidden font-sans">
      
      {/* 📸 CAMERA INTAKE */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[200]">
           <QRScanner
             onScan={(data) => { 
                setIsCameraOpen(false);
                handleScan(data);
             }}
             onClose={() => setIsCameraOpen(false)}
           />
        </div>
      )}

      {/* 🏷️ HEADER */}
      <div className="px-8 h-20 flex justify-between items-center bg-white border-b border-slate-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="bg-slate-900 p-2 rounded-lg">
              <Logo size="sm" />
           </div>
           <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Intake Console</h1>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Operator</p>
              <p className="text-sm font-black text-slate-900">{profile?.name || 'Authorized Staff'}</p>
           </div>
           <div className="h-10 w-[1px] bg-slate-200" />
           <button onClick={onLogout} className="p-3 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-xl text-slate-400 hover:text-rose-600 transition-all">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </div>

      <main className="flex-1 p-8 overflow-hidden flex gap-8">
        
        {/* ACTION PANEL */}
        <div className="w-[450px] space-y-8 h-full flex flex-col">
           <div className="bg-slate-900 rounded-[3rem] p-12 text-center text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                 <Sparkles className="w-32 h-32 text-white blur-xl" />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter italic mb-8 relative z-10">Scan Student QR</h2>
              <p className="text-white/40 font-bold text-[10px] uppercase tracking-[0.4em] mb-12 relative z-10">Live Validation Protocol v4.0</p>
              <button 
                onClick={() => setIsCameraOpen(true)}
                className="w-full h-24 bg-white text-slate-900 rounded-3xl font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-6 relative z-10"
              >
                <Camera className="w-8 h-8" />
                Initialize Intake
              </button>
           </div>

           {/* Feedback Area */}
           <div className="flex-1 relative bg-white rounded-[3.5rem] border-4 border-slate-100 p-12 flex flex-col items-center justify-center text-center overflow-hidden">
              {terminalState === 'IDLE' ? (
                 <>
                    <Zap className="w-16 h-16 text-slate-100 mb-6" />
                    <h3 className="text-2xl font-black text-slate-200 uppercase tracking-tighter">Awaiting Signal</h3>
                 </>
              ) : (
                <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 animate-in zoom-in duration-150 ${
                   terminalState === 'SUCCESS' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
                }`}>
                   <div className="bg-white/20 p-6 rounded-[2.5rem] mb-6">
                      {terminalState === 'SUCCESS' ? <ShieldCheck className="w-16 h-16" /> : <AlertCircle className="w-16 h-16" />}
                   </div>
                   <h2 className="text-4xl font-black uppercase tracking-tighter italic mb-2">{lastResult?.title}</h2>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80">{lastResult?.sub}</p>
                </div>
              )}
           </div>
        </div>

        {/* LOG PANEL */}
        <div className="flex-1 bg-white rounded-[4rem] border-4 border-slate-100 overflow-hidden flex flex-col shadow-huge">
           <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Operational Trail</span>
                 <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Recent Intake Logs</h2>
              </div>
              <div className="bg-white px-5 py-2 rounded-xl text-[10px] font-black text-emerald-600 border border-emerald-100 shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 LIVE STREAM
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-10 space-y-4">
              {recentScans.map((log: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl group hover:bg-slate-100 transition-colors">
                   <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center border border-slate-200 shadow-sm group-hover:border-slate-300 transition-colors">
                         {log.result === 'SUCCESS' ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <XSquare className="w-6 h-6 text-rose-500" />}
                      </div>
                      <div>
                         <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Order #{log.orderId?.slice(-6).toUpperCase()}</p>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: {log.disposition || 'Processed'}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Log Time</p>
                      <p className="text-xs font-black text-slate-900 font-mono italic">
                         {new Date(log.scanTime?.toDate?.() || log.scanTime).toLocaleTimeString()}
                      </p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </main>
    </div>
  );
};

export default ScannerView;
