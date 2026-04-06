import React, { useRef } from 'react';
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { X, Camera, Zap, AlertTriangle } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void; 
  onClose: () => void;
}

/** 
 * [ULTRA-FAST HARDWARE SCANNER]
 * Uses @yudiel/react-qr-scanner for direct MediaStream access.
 * Optimized for 'Rapid-Fire' scanning with 300ms payload debouncing.
 */
const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const lastScanRef = useRef<{ payload: string; time: number } | null>(null);

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    
    const token = detectedCodes[0].rawValue;
    if (!token) return;

    const now = Date.now();
    
    // ⚡ [RAPID-FIRE-LOGIC]: Extreme efficiency for high-traffic scenarios
    // 1. If it's a NEW token, scan it INSTANTLY (latency = 0)
    // 2. If it's the SAME token, wait 1.2s before re-triggering (allows double-orders but prevents loops)
    if (lastScanRef.current && lastScanRef.current.payload === token) {
        if (now - lastScanRef.current.time < 1200) return;
    }

    lastScanRef.current = { payload: token, time: now };
    
    // Physical feedback
    if ('vibrate' in navigator) navigator.vibrate(40);
    
    onScan(token);
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className="w-full max-w-lg p-8">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <div className="bg-emerald-500/20 p-3 rounded-2xl">
                 <Camera className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Sonic Scanner</h2>
           </div>
           <button onClick={onClose} className="p-4 bg-white/10 hover:bg-rose-600 rounded-2xl text-white transition-all active:scale-90">
              <X className="w-6 h-6" />
           </button>
        </div>

        {/* SCANNER VIEWPORT */}
        <div className="relative aspect-square w-full bg-black rounded-[4rem] overflow-hidden border-8 border-white/10 shadow-huge">
          
          <Scanner 
            onScan={handleScan}
            formats={['qr_code']}
            allowMultiple={true}
            scanDelay={100} // 🔥 [SONIC-SPEED]: Near-instant polling
            components={{
              onOff: true,
              torch: true,
              zoom: false,
              finder: false,
            }}
            styles={{
              container: { width: '100%', height: '100%' },
              video: { objectFit: 'cover' }
            }}
          />
           
           {/* Custom Target Overlay */}
           <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40" />
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-2 border-white/50 rounded-[2rem] pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute -top-1 -left-1 w-12 h-12 border-t-8 border-l-8 border-emerald-500 rounded-tl-3xl shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
              <div className="absolute -top-1 -right-1 w-12 h-12 border-t-8 border-r-8 border-emerald-500 rounded-tr-3xl shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
              <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-8 border-l-8 border-emerald-500 rounded-bl-3xl shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
              <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-8 border-r-8 border-emerald-500 rounded-br-3xl shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
           </div>
        </div>

        {/* SECURITY WARNING */}
        {(!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') && (
           <div className="mt-8 p-6 bg-rose-500/20 border border-rose-500/50 rounded-3xl flex items-center gap-4 animate-in slide-in-from-bottom duration-500">
              <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
              <p className="text-sm font-black text-white">Camera blocked: Action requires a secure HTTPS context.</p>
           </div>
        )}

        {/* METADATA */}
        <div className="mt-12 flex flex-col items-center gap-4 text-center opacity-40">
           <Zap className="w-6 h-6 text-white mb-2" />
           <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Zero-Latency Engine Active</p>
        </div>
        
      </div>
    </div>
  );
};

export default QRScanner;
