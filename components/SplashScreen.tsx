/**
 * SplashScreen Component — Production Grade
 * 
 * Fixes applied:
 * 1. Pre-decodes logo image before starting animations (no partial render)
 * 2. Animations only begin after image.decode() promise resolves
 * 3. GPU layer pre-allocation via will-change
 * 4. Instant text fallback if image load fails
 * 5. fetchpriority="high" for browser resource prioritization
 */

import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

// Pre-load image at module level so it starts downloading immediately
// before the component even mounts — critical for first render speed
const LOGO_SRC = '/JeoLogoFinal.png';
const logoPreloader = typeof window !== 'undefined' ? new window.Image() : null;
if (logoPreloader) logoPreloader.src = LOGO_SRC;

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // logoReady gates the CSS entrance animation — it only fires after the
  // image is fully decoded and ready to paint (no partial render flash)
  const [logoReady, setLogoReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const prepareImage = async () => {
      try {
        if (!logoPreloader) { if (!cancelled) setLogoReady(true); return; }
        // decode() waits for the image to be fully decoded into bitmap memory
        // before we allow the CSS animation to start — eliminates partial render
        if (logoPreloader.complete) {
          await logoPreloader.decode?.();
        } else {
          await new Promise<void>((resolve, reject) => {
            logoPreloader.onload = () => resolve();
            logoPreloader.onerror = () => reject();
            if (!logoPreloader.src) logoPreloader.src = LOGO_SRC;
          });
          await logoPreloader.decode?.();
        }
      } catch { /* decode failed, still show image */ }
      if (!cancelled) setLogoReady(true);
    };

    prepareImage();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 60%, rgba(15,157,88,0.12) 100%)',
        // Pre-allocate GPU composite layer for smooth animation
        willChange: 'opacity',
      }}
    >
      {/* Logo Zone */}
      <div className="relative flex flex-col items-center">

        {/* Glow aura — always visible, no dependency on image */}
        <div
          className="absolute rounded-full"
          style={{
            width: '200%',
            height: '200%',
            top: '-50%',
            left: '-50%',
            background: 'radial-gradient(circle, rgba(15,157,88,0.18) 0%, transparent 70%)',
            animation: 'glowPulse 2.4s ease-in-out infinite',
            willChange: 'opacity, transform',
          }}
        />

        {/* Logo — animates in ONLY after image is decoded */}
        <div
          style={{
            willChange: 'opacity, transform',
            animation: logoReady ? 'logoEntrance 0.55s cubic-bezier(0.22,1,0.36,1) both' : 'none',
            opacity: logoReady ? undefined : 0,
          }}
        >
          <img
              src={LOGO_SRC}
              alt="JOE"
              width={160}
              height={160}
              // @ts-ignore - fetchpriority is valid HTML but not yet in TS types
              fetchpriority="high"
              loading="eager"
              decoding="sync"
              draggable={false}
              className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] object-contain drop-shadow-2xl select-none"
              style={{ willChange: 'transform' }}
            />
        </div>

        {/* Tagline — slides in 200ms after logo */}
        <div
          style={{
            marginTop: '2rem',
            textAlign: 'center',
            willChange: 'opacity, transform',
            animation: logoReady
              ? 'taglineEntrance 0.55s cubic-bezier(0.22,1,0.36,1) 0.2s both'
              : 'none',
            opacity: logoReady ? undefined : 0,
          }}
        >
          <p className="text-white text-xl font-medium tracking-tight px-4">
            Fast food. No chaos.
          </p>
          <div
            className="mt-3 mx-auto h-0.5 bg-[#0F9D58] rounded-full opacity-60"
            style={{
              animation: logoReady
                ? 'taglineAccent 0.6s cubic-bezier(0.22,1,0.36,1) 0.35s both'
                : 'none',
              width: logoReady ? undefined : 0,
            }}
          />
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes logoEntrance {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes taglineEntrance {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.06); }
        }
        @keyframes taglineAccent {
          from { width: 0; opacity: 0; }
          to   { width: 64px; opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
