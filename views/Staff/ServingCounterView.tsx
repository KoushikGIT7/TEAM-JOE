import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LogOut, ShieldCheck, AlertTriangle, Volume2, VolumeX } from 'lucide-react';
import { UserProfile } from '../../types';
import { validateQRForServing } from '../../services/firestore-db';
import { triggerOneSignalWebhook } from '../../services/onesignal-webhook';
import QRScanner from '../../components/QRScanner';
import { joeSounds } from '../../utils/audio';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import ServerConsoleWorkspace from './ServerConsoleWorkspace';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
  onOpenKitchen?: () => void;
}

const ServingCounterView: React.FC<Props> = ({ profile, onLogout }) => {
  const [hudState, setHudState] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [hudMessage, setHudMessage] = useState('');
  const [hudPayload, setHudPayload] = useState<{ 
     studentName: string; 
     itemNames: string[];
     customTitle?: string;
     customFrameColor?: string;
     customAvatarDecoration?: string;
  } | null>(null);

  const [audioStatus, setAudioStatus] = useState(joeSounds.getMutedState());
  const [isCameraOpen, setIsCameraOpen] = useState(true);
  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const isProcessingScannerRef = useRef(false);
  const lastScannedTokenRef = useRef<{ token: string; time: number } | null>(null);

  useEffect(() => {
    return joeSounds.subscribe(() => {
       setAudioStatus(joeSounds.getMutedState());
    });
  }, []);

  const resetToIdle = useCallback((delay = 800) => {
    setTimeout(() => {
      setHudState('IDLE');
      setHudMessage('');
      setHudPayload(null);
      isProcessingScannerRef.current = false;
    }, delay);
  }, []);

  const processQRScan = useCallback(async (data: string) => {
    const now = Date.now();
    const token = data.trim();

    if (lastScannedTokenRef.current?.token === token && now - lastScannedTokenRef.current.time < 4000) return;
    if (isProcessingScannerRef.current) return;

    isProcessingScannerRef.current = true;
    lastScannedTokenRef.current = { token, time: now };

    try {
      const { order, result } = await validateQRForServing(token, profile.uid, true); // true = autoServeReady

      if (result === 'CONSUMED' || result === 'MANIFESTED' || result === 'ALREADY_MANIFESTED') {
        if (order && order.userId) {
          const shortToken = order.tokenNumber || order.id.slice(-4).toUpperCase();
          if (result === 'CONSUMED') {
             triggerOneSignalWebhook(
                order.userId,
                '🎉 Enjoy your meal!',
                `Your order #${shortToken} has been successfully collected. Bon appétit!`,
                `/student/orders`
             ).catch(e => console.warn("OneSignal failed:", e));
          } else if (result === 'MANIFESTED') {
             triggerOneSignalWebhook(
                order.userId,
                '✅ Partial Handover Complete!',
                `Part of your order #${shortToken} has been collected.`,
                `/student/orders`
             ).catch(e => console.warn("OneSignal failed:", e));
          }
        }

        const justServed = order.items?.filter((i: any) =>
          i.status === 'SERVED' && (result === 'CONSUMED' || (Date.now() - (i.servedAt || 0) < 5000))
        ).map((i: any) => i.name) || [];

        // Fetch student customizations
        let customTitle = '';
        let customFrameColor = '';
        let customAvatarDecoration = '';
        try {
          const userSnap = await getDoc(doc(db, "users", order.userId));
          if (userSnap.exists()) {
             const userData = userSnap.data();
             customTitle = userData.customTitle || '';
             customFrameColor = userData.customFrameColor || '';
             customAvatarDecoration = userData.customAvatarDecoration || '';
          }
        } catch (e) {
          console.error("Failed to load user decorations on counter scan HUD:", e);
        }

        joeSounds.playServerScanSuccess();
        if ('vibrate' in navigator) navigator.vibrate([50, 30, 50]);

        setHudState('SUCCESS');
        setHudPayload({
          studentName: order.userName || 'Student',
          itemNames: justServed.length > 0 ? justServed : ['Order Items'],
          customTitle,
          customFrameColor,
          customAvatarDecoration
        });

        // Add order ID to scanQueue
        setScanQueue(prev => {
          if (prev.includes(order.id)) return prev;
          return [...prev, order.id];
        });

        isProcessingScannerRef.current = false;

        // Transition from Scanner to Console View after a short delay
        setTimeout(() => {
          setIsCameraOpen(false);
        }, 1500);

        resetToIdle(result === 'ALREADY_MANIFESTED' ? 3000 : 2000);
        return;
      }

      setHudState('ERROR');
      setHudMessage('PAYMENT PENDING');
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      joeSounds.stopAll();
      joeSounds.playErrorBuzzer();
      isProcessingScannerRef.current = false;
      resetToIdle(1500);

    } catch (err: any) {
      const msg: string = err.message || '';
      let display = 'SCAN ERROR';
      if (msg.includes('ALREADY_CONSUMED') || msg.includes('ALREADY_SERVED'))  display = 'ALREADY SERVED';
      else if (msg.includes('ORDER_NOT_FOUND'))                                 display = 'ORDER NOT FOUND';
      else if (msg.includes('INVALID_QR') || msg.includes('INVALID_PAYLOAD'))  display = 'INVALID QR CODE';
      else if (msg.includes('SECURITY_BREACH'))                                 display = 'SECURITY ALERT';
      else if (msg.includes('PAYMENT'))                                         display = 'PAYMENT NOT VERIFIED';
      else if (msg.includes('EXPIRED'))                                         display = 'QR CODE EXPIRED';

      setHudState('ERROR');
      setHudMessage(display);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      joeSounds.stopAll();
      joeSounds.playErrorBuzzer();
      isProcessingScannerRef.current = false;
      resetToIdle(1500);
    }
  }, [profile.uid, resetToIdle]);

  const handleAudioToggle = async () => {
    if (audioStatus === 'Silent') {
      await joeSounds.init();
    } else {
      joeSounds.toggleMute();
    }
  };

  // Switch to Server Console dashboard when scanner is closed
  if (!isCameraOpen) {
    return (
      <div className="relative w-full h-[100dvh] bg-surface-lowest text-white select-none overflow-hidden">
        <ServerConsoleWorkspace
          scanQueue={scanQueue}
          setScanQueue={setScanQueue}
          setIsCameraOpen={setIsCameraOpen}
          isMobile={false}
        />
        
        {/* Floating exit/logout action available on Console dashboard */}
        <button 
          onClick={() => {
            if (confirm('Are you sure you want to exit the serving counter?')) {
              onLogout();
            }
          }}
          className="absolute top-6 left-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer shadow-lg"
          title="Exit Counter"
        >
          <LogOut className="w-5 h-5" />
        </button>

        {/* Floating Audio Toggle button in Console dashboard */}
        <div className="absolute top-6 right-6 z-40 flex items-center gap-3">
           <button 
              onClick={handleAudioToggle}
              className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-[9px] font-mono font-black backdrop-blur-md transition active:scale-95 cursor-pointer shadow-lg ${
                 audioStatus === 'Connected' 
                    ? 'bg-brand-purple/20 border-brand-purple/40 text-brand-purple-light' 
                    : audioStatus === 'Muted'
                       ? 'bg-rose-500/25 border-rose-500/40 text-rose-400'
                       : 'bg-amber-500/25 border-amber-500/40 text-amber-400'
              }`}
           >
              {audioStatus === 'Connected' ? (
                 <>
                    <Volume2 className="w-3.5 h-3.5 text-brand-purple" />
                    <span>AUDIO: CENTRAL ACTIVE</span>
                 </>
              ) : audioStatus === 'Muted' ? (
                 <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    <span>AUDIO: MUTED</span>
                 </>
              ) : (
                 <>
                    <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>AUDIO: SILENT (TAP TO WAKE)</span>
                 </>
              )}
           </button>
        </div>
      </div>
    );
  }

  return (
    <div id="counter-serving-terminal" className="relative w-full h-[100dvh] bg-zinc-950 text-white select-none overflow-hidden">
      
      {/* 1. Immersive camera viewport */}
      <div className="absolute inset-0 w-full h-full z-0">
        <QRScanner onScan={processQRScan} onClose={() => {}} />
      </div>

      {/* 2. Floating exit/logout action */}
      <button 
        onClick={() => {
          if (confirm('Are you sure you want to exit the scanning counter?')) {
            onLogout();
          }
        }}
        className="absolute top-6 left-6 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white transition active:scale-95 cursor-pointer shadow-lg"
        title="Exit Scanner"
      >
        <LogOut className="w-5 h-5" />
      </button>

      {/* Floating Audio Toggle button at top right */}
      <div className="absolute top-6 right-6 z-40 flex items-center gap-3">
         <button 
            onClick={handleAudioToggle}
            className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-[9px] font-mono font-black backdrop-blur-md transition active:scale-95 cursor-pointer shadow-lg ${
               audioStatus === 'Connected' 
                  ? 'bg-brand-purple/20 border-brand-purple/40 text-brand-purple-light' 
                  : audioStatus === 'Muted'
                     ? 'bg-rose-500/25 border-rose-500/40 text-rose-400'
                     : 'bg-amber-500/25 border-amber-500/40 text-amber-400'
            }`}
         >
            {audioStatus === 'Connected' ? (
               <>
                  <Volume2 className="w-3.5 h-3.5 text-brand-purple" />
                  <span>AUDIO: CENTRAL ACTIVE</span>
               </>
            ) : audioStatus === 'Muted' ? (
               <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span>AUDIO: MUTED</span>
               </>
            ) : (
               <>
                  <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>AUDIO: SILENT (TAP TO WAKE)</span>
               </>
            )}
         </button>
      </div>

      {/* 3. Verification Success Overlay */}
      {hudState === 'SUCCESS' && hudPayload && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-[fade-in_0.2s_ease-out] pointer-events-none">
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
            <div className={`w-20 h-20 rounded-full border-2 ${
              hudPayload.customFrameColor || 'border-brand-purple/60'
            } bg-brand-purple/20 flex items-center justify-center text-brand-purple relative shadow-[0_0_30px_rgba(183,109,255,0.25)] animate-[scale-in_0.3s_ease-out]`}>
              <ShieldCheck className="w-10 h-10 text-brand-purple" />
              {hudPayload.customAvatarDecoration && (
                <span className="absolute -top-1 -right-1 text-lg animate-pulse">{hudPayload.customAvatarDecoration}</span>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-brand-purple uppercase">
                Authorized
              </span>
              <h2 className="text-lg font-black text-white uppercase tracking-wide leading-tight">
                {hudPayload.itemNames.join(', ')}
              </h2>
              <p className="text-zinc-200 text-xs font-bold uppercase font-mono flex items-center justify-center gap-1.5 mt-1">
                <span>{hudPayload.studentName}</span>
                {hudPayload.customTitle && (
                  <span className="text-[9px] text-[#ddb7ff] bg-[#b76dff]/25 px-2 py-0.5 rounded-full font-black border border-[#b76dff]/40">
                    {hudPayload.customTitle}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Verification Error Overlay */}
      {hudState === 'ERROR' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-[fade-in_0.2s_ease-out] pointer-events-none">
          <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] animate-[scale-in_0.3s_ease-out]">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                Rejected
              </span>
              <p className="text-sm font-bold text-zinc-200 uppercase max-w-xs leading-relaxed">
                {hudMessage}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ServingCounterView;
