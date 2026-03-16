import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Sparkles, Camera, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  isScanning?: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, isScanning }) => {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const qrCodeInstance = useRef<Html5Qrcode | null>(null);
  const regionId = "qr-reader-region";

  useEffect(() => {
    // Check for Secure Context (Required for Camera on non-localhost mobile)
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setError("CAMERA_INSECURE_CONTEXT: Camera access requires HTTPS when using an IP address. Please use localhost or setup HTTPS.");
      setIsInitializing(false);
      return;
    }

    const startScanner = async () => {
      try {
        setIsInitializing(true);
        const html5QrCode = new Html5Qrcode(regionId);
        qrCodeInstance.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        // Preference: back camera
        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            console.log(`[QR-SCANNER] Success: ${decodedText}`);
            onScan(decodedText);
          },
          (errorMessage) => {
            // Noise from frame-by-frame missing QR
          }
        );
        
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Failed to start scanner:", err);
        setError(`Camera Error: ${err.message || "Permission denied or camera in use"}`);
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
        qrCodeInstance.current.stop()
          .then(() => qrCodeInstance.current?.clear())
          .catch(err => console.error("Error stopping scanner:", err));
      }
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-black/98 backdrop-blur-2xl animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border-2 border-primary/40 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 leading-none">
              JOE <span className="text-primary">Lens</span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400">Secure AI Scanner</p>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-90 border border-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-sm aspect-square relative group">
            {/* Corner Markers */}
            <div className="absolute inset-0 z-20 pointer-events-none p-4">
                <div className="absolute top-0 left-0 w-16 h-16 border-t-[6px] border-l-[6px] border-primary rounded-tl-[3rem] shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all duration-300 group-hover:scale-110" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-[6px] border-r-[6px] border-primary rounded-tr-[3rem] shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all duration-300 group-hover:scale-110" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-[6px] border-l-[6px] border-primary rounded-bl-[3rem] shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all duration-300 group-hover:scale-110" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[6px] border-r-[6px] border-primary rounded-br-[3rem] shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all duration-300 group-hover:scale-110" />
            </div>

            {/* Scanning Laser animation */}
            <div className="absolute top-0 left-0 right-0 z-20 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-laser opacity-80" />

            {/* Camera Feed */}
            <div id={regionId} className="w-full h-full rounded-[3rem] overflow-hidden bg-gray-900 shadow-2xl border-2 border-white/10" />
            
            {/* Loading/Initializing State */}
            {(isInitializing || isScanning) && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-30 rounded-[3rem] border-2 border-primary/20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(249,115,22,0.5)]" />
                        <p className="text-white font-black uppercase text-sm tracking-widest animate-pulse">
                          {isScanning ? 'Processing Token' : 'Warming up Camera'}
                        </p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && (
              <div className="absolute inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center z-40 rounded-[3rem] p-8 text-center border-4 border-red-500/30">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500/50">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white mb-2">SCANNER BLOCKED</h3>
                    <p className="text-sm text-red-100 font-bold leading-relaxed">{error}</p>
                    {error.includes("HTTPS") && (
                      <p className="mt-4 text-[10px] text-red-300 uppercase font-black tracking-widest bg-red-500/20 py-2 px-4 rounded-xl">
                        Tip: Open on laptop or Use HTTPS
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={handleRetry}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase transition-all active:scale-95 shadow-xl"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry Access
                  </button>
                </div>
              </div>
            )}
        </div>

        {/* Status & Instructions */}
        <div className="mt-12 w-full max-w-sm space-y-4">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 flex items-start gap-4 shadow-2xl">
                <ShieldCheck className="w-6 h-6 text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  Align the <strong className="text-primary">Meal Token</strong> within the frame. 
                  Validation occurs automatically upon detection.
                </p>
            </div>
            
            <div className="flex items-center justify-center gap-3 text-[10px] text-white/30 font-black uppercase tracking-[0.3em] py-2">
                <Sparkles className="w-3 h-3" />
                Zero-Latency Verification Active
            </div>
        </div>
      </div>

      <style>{`
        @keyframes laser {
            0% { top: 0%; opacity: 0 }
            10% { opacity: 0.8 }
            90% { opacity: 0.8 }
            100% { top: 100%; opacity: 0 }
        }
        .animate-laser {
            animation: laser 2.5s ease-in-out infinite;
        }
        #qr-reader-region video {
            object-fit: cover !important;
            width: 100% !important;
            height: 100% !important;
            transform: scale(1.1); /* Slight zoom to fill frame better */
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
