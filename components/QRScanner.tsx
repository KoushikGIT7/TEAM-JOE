import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isScanning?: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isScanning }) => {
  const [error, setError]             = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [detected, setDetected]       = useState(false);
  const qrRef                         = useRef<Html5Qrcode | null>(null);
  const firedRef                      = useRef(false); // prevent double-fire
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
    // Security context check
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setError('Camera requires HTTPS. Use localhost or configure HTTPS.');
      setIsInitializing(false);
      return;
    }

    const start = async () => {
      try {
        setIsInitializing(true);
        const scanner = new Html5Qrcode(regionId, { verbose: false });
        qrRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 30,
            qrbox: (w: number, h: number) => {
              const size = Math.floor(Math.min(w, h) * 0.80);
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            videoConstraints: {
              facingMode: { ideal: 'environment' },
              width:  { min: 640, ideal: 1920, max: 3840 },
              height: { min: 480, ideal: 1080, max: 2160 },
              focusMode: 'continuous',
              exposureMode: 'continuous',
              whiteBalanceMode: 'continuous',
            },
            disableFlip: false,
          } as any,

          async (decodedText) => {
            // Prevent double-callback on same frame
            if (firedRef.current) return;
            firedRef.current = true;

            // Instant haptic
            if ('vibrate' in navigator) navigator.vibrate(60);
            // Flash detected state
            setDetected(true);

            // Stop camera before calling onScan so parent renders instantly
            await stopCamera();
            onScan(decodedText);
          },
          () => {
            // Per-frame decode failure is expected noise — ignore
          }
        );

        setIsInitializing(false);
      } catch (err: any) {
        setError(err?.message || 'Camera permission denied or camera in use.');
        setIsInitializing(false);
      }
    };

    start();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = async () => {
    await stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-black animate-in fade-in duration-200">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 pt-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">QR Scanner</p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Camera Active</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Scanner Area ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6">
        <div className="w-full max-w-xs aspect-square relative">

          {/* Corner brackets */}
          {(['tl','tr','bl','br'] as const).map(pos => (
            <div
              key={pos}
              className="absolute w-10 h-10 pointer-events-none"
              style={{
                top:    pos.startsWith('t') ? 0 : undefined,
                bottom: pos.startsWith('b') ? 0 : undefined,
                left:   pos.endsWith('l')   ? 0 : undefined,
                right:  pos.endsWith('r')   ? 0 : undefined,
                borderTop:    pos.startsWith('t') ? '3px solid #f97316' : undefined,
                borderBottom: pos.startsWith('b') ? '3px solid #f97316' : undefined,
                borderLeft:   pos.endsWith('l')   ? '3px solid #f97316' : undefined,
                borderRight:  pos.endsWith('r')   ? '3px solid #f97316' : undefined,
                borderRadius: pos === 'tl' ? '12px 0 0 0' : pos === 'tr' ? '0 12px 0 0' : pos === 'bl' ? '0 0 0 12px' : '0 0 12px 0',
              }}
            />
          ))}

          {/* Camera feed */}
          <div
            id={regionId}
            className="w-full h-full rounded-2xl overflow-hidden bg-black"
            style={{ border: detected ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.06)', transition: 'border-color 0.2s' }}
          />

          {/* Laser scan line */}
          {!detected && !error && (
            <div className="absolute left-0 right-0 h-px bg-primary/70 pointer-events-none animate-laser" />
          )}

          {/* Initializing overlay */}
          {isInitializing && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-2xl">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}

          {/* Detected flash */}
          {detected && (
            <div className="absolute inset-0 bg-green-500/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-16 h-16 text-green-400 fill-current" />
            </div>
          )}

          {/* Processing overlay */}
          {isScanning && !detected && (
            <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 bg-red-950/90 rounded-2xl flex flex-col items-center justify-center gap-4 p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-red-200 font-bold leading-relaxed">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}
        </div>

        {/* Instruction */}
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.35em] text-center text-white/25">
          Point camera at the student QR code
        </p>
      </div>

      <style>{`
        @keyframes laser {
          0%   { top: 8%;  opacity: 0; }
          5%   { opacity: 0.8; }
          95%  { opacity: 0.8; }
          100% { top: 92%; opacity: 0; }
        }
        .animate-laser { animation: laser 1.4s ease-in-out infinite; position: absolute; }
        #qr-reader-region video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        /* Remove library's default UI chrome */
        #qr-reader-region img,
        #qr-reader-region > div:not(:has(video)) { display: none !important; }
      `}</style>
    </div>
  );
};

export default QRScanner;
