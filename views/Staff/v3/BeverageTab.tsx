import React, { useState, useRef, useCallback } from 'react';
import { Camera, CheckCircle2, XCircle, Zap, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import QRScanner from '../../../components/QRScanner';
import { parseServingQR } from '../../../services/qr';
import { processAtomicIntake } from '../../../services/firestore-db';
import { auth } from '../../../firebase';

const BeverageTab: React.FC = () => {
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [scanResult, setScanResult] = useState<{ status: 'SUCCESS' | 'ERROR' | 'IDLE', title: string, sub: string }>({
        status: 'IDLE', title: '', sub: ''
    });
    const scanLockRef = useRef(false);

    const triggerSonicPulse = (status: 'SUCCESS' | 'ERROR', title: string, sub: string) => {
        setScanResult({ status, title, sub });
        if (window.navigator.vibrate) {
            if (status === 'SUCCESS') window.navigator.vibrate(100);
            else window.navigator.vibrate([200, 100, 200]);
        }

        setTimeout(() => {
            setScanResult(prev => {
                if (prev.status === 'IDLE') return prev;
                return { ...prev, status: 'IDLE' };
            });
        }, 1200);
    };

    const handleQRScan = useCallback(async (rawData: string) => {
        if (!rawData?.trim() || scanLockRef.current) return;

        scanLockRef.current = true;
        
        try {
            const intake = parseServingQR(rawData.trim());
            if (!intake.orderId) throw new Error("INVALID CHARGE");

            const { result, order } = await processAtomicIntake(rawData.trim(), auth.currentUser?.uid || 'fast-lane');

            if (result === 'ALREADY_MANIFESTED' || result === 'MANIFESTED' || result === 'CONSUMED') {
                const label = result === 'CONSUMED' ? 'ORDER COMPLETE ✅' : 'VERIFIED ✅';
                const sub = `${order.userName || 'Student'} • TOKEN #${order.id.slice(-4).toUpperCase()}`;
                triggerSonicPulse('SUCCESS', label, sub);
            } else {
                triggerSonicPulse('ERROR', 'INVALID SCAN', result.replace('_', ' '));
            }
        } catch (err: any) {
            triggerSonicPulse('ERROR', 'SCAN ERROR', (err.message || 'Unknown').toUpperCase().slice(0, 20));
        } finally {
            setTimeout(() => { scanLockRef.current = false; }, 800);
        }
    }, []);

    return (
        <div className="flex-1 flex flex-col bg-[#0f172a] text-white overflow-hidden relative">
            <div className="flex-1 flex flex-col lg:flex-row">
                {/* 📸 QR SENSOR ZONE */}
                <div className="flex-1 border-r border-white/5 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />
                    
                    <div className="w-64 h-64 bg-white/5 rounded-[4rem] border-4 border-dashed border-white/10 flex items-center justify-center mb-12 relative group cursor-pointer hover:border-emerald-500/50 transition-all active:scale-95" onClick={() => setIsCameraOpen(true)}>
                        <div className="absolute inset-0 bg-emerald-500/10 scale-0 group-hover:scale-100 rounded-[4rem] transition-all duration-500" />
                        <Camera className="w-24 h-24 text-white/20 group-hover:text-emerald-500 transition-colors" />
                        
                        <div className="absolute -top-4 -right-4 bg-emerald-500 text-black px-4 py-2 rounded-xl font-black text-xs tracking-widest animate-bounce">
                           SENSOR ACTIVE
                        </div>
                    </div>

                    <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-4">Fast Lane Scan</h1>
                    <p className="text-[14px] font-black uppercase tracking-[0.5em] text-white/30 max-w-sm leading-relaxed">
                       Point the student token towards the camera for instant validation.
                    </p>

                    <button 
                        onClick={() => setIsCameraOpen(true)}
                        className="mt-12 h-20 px-12 bg-white text-black rounded-[2rem] font-black uppercase text-xl italic tracking-tighter flex items-center gap-4 hover:bg-emerald-400 transition-all active:scale-95 shadow-2xl"
                    >
                        <Zap className="w-8 h-8 fill-black" />
                        <span>OPEN CAMERA</span>
                    </button>
                </div>

                {/* 📡 LIVE VALIDATION ZONE */}
                <div className="flex-1 bg-black/40 flex flex-col p-12">
                     <div className="flex items-center justify-between mb-12">
                         <div className="flex items-center gap-4">
                             <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Fast Lane Gateway Online</span>
                         </div>
                         <div className="text-4xl font-black font-mono text-white/20 italic">0.02s LATENCY</div>
                     </div>

                     <div className="flex-1 flex flex-col items-center justify-center text-center">
                         {scanResult.status === 'IDLE' ? (
                             <div className="opacity-10 animate-pulse flex flex-col items-center">
                                 <Sparkles className="w-32 h-32 mb-8" />
                                 <h2 className="text-4xl font-black italic uppercase tracking-widest">Awaiting Pulse...</h2>
                             </div>
                         ) : (
                             <div className={`animate-in fade-in zoom-in duration-150 flex flex-col items-center ${
                                 scanResult.status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'
                             }`}>
                                 <div className={`w-48 h-48 rounded-[3.5rem] flex items-center justify-center mb-8 border-8 shadow-2xl ${
                                     scanResult.status === 'SUCCESS' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-rose-500/10 border-rose-500'
                                 }`}>
                                     {scanResult.status === 'SUCCESS' ? <CheckCircle2 className="w-24 h-24" /> : <XCircle className="w-24 h-24" />}
                                 </div>
                                 <h2 className="text-7xl font-black italic uppercase tracking-tighter drop-shadow-2xl">{scanResult.title}</h2>
                                 <p className="text-[14px] font-black uppercase tracking-[0.4em] text-white/40 mt-4 font-mono">{scanResult.sub}</p>
                             </div>
                         )}
                     </div>

                     <div className="mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 flex items-center justify-between">
                         <div className="flex items-center gap-6">
                            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <p className="text-[11px] font-black uppercase tracking-widest leading-loose text-white/60">
                                This station validates and serves items instantly.<br/>
                                <span className="text-white">Use ONLY for Beverages & Snacks.</span>
                            </p>
                         </div>
                     </div>
                </div>
            </div>

            {isCameraOpen && (
                <div className="absolute inset-0 z-50 bg-black">
                    <QRScanner 
                        onScan={handleQRScan} 
                        onClose={() => setIsCameraOpen(false)} 
                    />
                </div>
            )}
        </div>
    );
};

export default BeverageTab;
