import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  CheckCircle, 
  XSquare, 
  AlertCircle,
  LogOut,
  Sparkles,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { UserProfile } from '../../types';
import { getScanLogs, processAtomicIntake } from '../../services/firestore-db';
import { triggerOneSignalWebhook } from '../../services/onesignal-webhook';
import QRScanner from '../../components/QRScanner';
import Logo from '../../components/Logo';
import { joeSounds } from '../../utils/audio';

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
    
    joeSounds.stopAll();
    
    if (state === 'SUCCESS') {
       if ('vibrate' in navigator) navigator.vibrate(100);
       joeSounds.playServerScanSuccess();
    } else {
       if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
       joeSounds.playErrorBuzzer();
    }

    // Auto-dismiss 
    setTimeout(() => {
       setTerminalState('IDLE');
       setLastResult(null);
    }, state === 'SUCCESS' ? 3000 : 4000);
  };

  const handleScan = async (data: string) => {
    if (!data?.trim() || terminalState !== 'IDLE') return;

    setLastResult({ title: 'VERIFYING...', sub: 'Checking Token Integrity' });
    setTerminalState('SUCCESS');

    try {
      const { result, order } = await processAtomicIntake(data.trim(), profile.uid, true);
      
      const res = result as string;
      
      if (res === 'ALREADY_MANIFESTED' || res === 'ALREADY_CONSUMED') {
         return;
      } else if (res === 'AWAITING_PAYMENT') {
        triggerStrobe('ERROR', 'UNPAID ORDER', 'Direct student to cashier');
      } else if (res === 'AWAITING_COOKING') {
        triggerStrobe('ERROR', 'NOT READY', 'Meal still in preparation');
      } else if (res === 'CONSUMED') {
        triggerStrobe('SUCCESS', 'VERIFIED ✅', 'RELEASE MEAL NOW');
        if (order && order.userId) {
          const shortToken = order.tokenNumber || order.id.slice(-4).toUpperCase();
          triggerOneSignalWebhook(
            order.userId,
            '🎉 Enjoy your meal!',
            `Your order #${shortToken} has been successfully collected. Bon appétit!`,
            `/student/orders`
          ).catch(e => console.warn("OneSignal failed:", e));
        }
      } else if (res === 'MANIFESTED') {
        triggerStrobe('SUCCESS', 'PARTIAL RELEASE ✅', 'ITEMS LOADED ON SCREEN');
        if (order && order.userId) {
          const shortToken = order.tokenNumber || order.id.slice(-4).toUpperCase();
          triggerOneSignalWebhook(
            order.userId,
            '✅ Partial Handover Complete!',
            `Part of your order #${shortToken} has been collected.`,
            `/student/orders`
          ).catch(e => console.warn("OneSignal failed:", e));
        }
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
    <div className="flex h-screen w-full bg-zinc-950 flex-col overflow-hidden font-sans text-zinc-100">
      
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
      <div className="px-8 h-20 flex justify-between items-center bg-zinc-900/40 backdrop-blur-md border-b border-white/5 shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
           <div className="bg-zinc-950 p-2 rounded-xl border border-white/5">
              <Logo size="sm" />
           </div>
           <h1 className="text-lg font-black text-white uppercase tracking-wider italic">Intake Console</h1>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Operator</p>
              <p className="text-sm font-black text-white">{profile?.name || 'Authorized Staff'}</p>
           </div>
           <div className="h-10 w-[1px] bg-white/5" />
           <button onClick={onLogout} className="p-3 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 rounded-xl text-zinc-400 hover:text-rose-500 transition-all">
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </div>

      <main className="flex-1 p-8 overflow-hidden flex gap-8">
        
        {/* ACTION PANEL */}
        <div className="w-[450px] space-y-6 h-full flex flex-col">
           <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 text-center text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                 <Sparkles className="w-32 h-32 text-purple-400 blur-xl" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-wider italic mb-6 relative z-10">Scan Student QR</h2>
              <p className="text-zinc-500 font-mono font-bold text-[9px] uppercase tracking-widest mb-8 relative z-10">Live Validation Protocol v4.0</p>
              <button 
                onClick={() => setIsCameraOpen(true)}
                className="w-full h-20 bg-brand-purple hover:bg-brand-purple-light text-white rounded-2xl font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center gap-4 relative z-10 cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                Initialize Intake
              </button>
           </div>

           {/* Feedback Area */}
           <div className="flex-1 relative bg-zinc-900/20 rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center text-center overflow-hidden">
              {terminalState === 'IDLE' ? (
                 <>
                    <Zap className="w-12 h-12 text-zinc-800 mb-4 animate-pulse" />
                    <h3 className="text-lg font-black text-zinc-600 uppercase tracking-widest">Awaiting Signal</h3>
                 </>
              ) : (
                 <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 animate-in zoom-in duration-150 ${
                    terminalState === 'SUCCESS' ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/20' : 'bg-rose-950/90 text-rose-400 border border-rose-500/20'
                 }`}>
                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl mb-4">
                       {terminalState === 'SUCCESS' ? <ShieldCheck className="w-12 h-12" /> : <AlertCircle className="w-12 h-12" />}
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-wider italic mb-2">{lastResult?.title}</h2>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-80">{lastResult?.sub}</p>
                 </div>
              )}
           </div>
        </div>

        {/* LOG PANEL */}
        <div className="flex-1 bg-zinc-900/30 border border-white/5 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
           <div className="p-8 border-b border-white/5 flex justify-between items-center bg-zinc-900/10">
              <div className="flex flex-col">
                 <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1">Operational Trail</span>
                 <h2 className="text-xl font-black text-white uppercase tracking-wider italic">Recent Intake Logs</h2>
              </div>
              <div className="bg-brand-purple/10 border border-brand-purple/20 px-4 py-1.5 rounded-xl text-[9px] font-mono font-bold text-brand-purple shadow-sm flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse" />
                 LIVE STREAM
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {recentScans.map((log: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-5 bg-zinc-900/50 border border-white/5 rounded-2xl group hover:bg-zinc-800/40 hover:border-white/10 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center border border-white/5 group-hover:border-white/10 transition-colors">
                         {log.result === 'SUCCESS' ? <CheckCircle className="w-5 h-5 text-brand-purple-light" /> : <XSquare className="w-5 h-5 text-rose-400" />}
                      </div>
                      <div>
                         <p className="text-sm font-black text-white uppercase tracking-wider font-mono">Order #{log.orderId?.slice(-6).toUpperCase()}</p>
                         <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mt-1">Status: {log.disposition || 'Processed'}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest leading-none mb-1">Log Time</p>
                      <p className="text-xs font-mono font-bold text-white italic">
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
