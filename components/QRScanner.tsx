import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void; 
  onClose: () => void;
}

/** 
 * [HARDWARE-GRADE] QR Intake Controller
 * Enforces a strict one-scan-per-session rule.
 * The camera is stopped IMMEDIATELY after a successful decode.
 */
const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const [error, setError]             = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const qrRef                         = useRef<Html5Qrcode | null>(null);
  const hasScanned                    = useRef(false);
  const regionId                      = 'qr-reader-region';

  const stopCamera = useCallback(async () => {
    try {
      if (qrRef.current?.isScanning) {
        await qrRef.current.stop();
        qrRef.current.clear();
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    // Security Context Enforcement
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setError('Camera requires HTTPS. Please configure your environment.');
      setIsInitializing(false);
      return;
    }

    const start = async () => {
      try {
        setIsInitializing(true);
        const scanner = new Html5Qrcode(regionId, { verbose: false });
        qrRef.current = scanner;
        
        hasScanned.current = false; // Reset on startup

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15, // Higher FPS for responsive capture
            qrbox: { width: 320, height: 320 },
            disableFlip: false,
          },
          async (decodedText) => {
            if (hasScanned.current) return; // Drop duplicate concurrent frames
            hasScanned.current = true;
            
            // 🛑 [HARD-LOCK] Stop camera hardware first
            stopCamera();
            
            // Haptic feedback
            if ('vibrate' in navigator) navigator.vibrate(100);
            
            // Handover to parent
            onScan(decodedText);
          },
          () => { /* Search noise */ }
        );

        setIsInitializing(false);
      } catch (err: any) {
        setError(err?.message || 'Camera access failure.');
        setIsInitializing(false);
      }
    };

    start();
    return () => { stopCamera(); };
  }, [onScan, stopCamera]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className="w-full max-w-lg p-8">
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl">
                 <Camera className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Intake Scanner</h2>
           </div>
           <button onClick={onClose} className="p-4 bg-white/10 hover:bg-rose-600 rounded-2xl text-white transition-all active:scale-90">
              <X className="w-6 h-6" />
           </button>
        </div>

        <div className="relative aspect-square w-full bg-black rounded-[4rem] overflow-hidden border-8 border-white/10 shadow-huge group">
           <div id={regionId} className="w-full h-full" />
           {isInitializing && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4">
                <RefreshCw className="w-10 h-10 text-white animate-spin" />
                <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Initializing Glass...</p>
             </div>
           )}
           
           {/* Visual Guide Overlay */}
           <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none" />
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border-2 border-white/50 rounded-[2rem] pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute -top-1 -left-1 w-12 h-12 border-t-8 border-l-8 border-emerald-500 rounded-tl-3xl opacity-100" />
              <div className="absolute -top-1 -right-1 w-12 h-12 border-t-8 border-r-8 border-emerald-500 rounded-tr-3xl" />
              <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-8 border-l-8 border-emerald-500 rounded-bl-3xl" />
              <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-8 border-r-8 border-emerald-500 rounded-br-3xl" />
           </div>
        </div>

        {error && (
           <div className="mt-8 p-6 bg-rose-500/20 border border-rose-500/50 rounded-3xl flex items-center gap-4 animate-in slide-in-from-bottom duration-500">
              <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
              <p className="text-sm font-black text-white">{error}</p>
           </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-4 text-center opacity-40">
           <Zap className="w-6 h-6 text-white mb-2" />
           <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Optimized for Fast-Capture</p>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
