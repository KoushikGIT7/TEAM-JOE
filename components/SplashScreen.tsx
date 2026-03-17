/**
 * SplashScreen Component
 * Premium animated intro screen for JOE app
 * Shows during app initialization with smooth logo + tagline animation
 */

import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
  minDisplayTime?: number; // Minimum time to show splash (ms)
}

const SplashScreen: React.FC<SplashScreenProps> = () => {
  return (
    <div 
      className="fixed inset-0 z-50 pointer-events-auto bg-gradient-to-br from-[#0A0A0A] via-[#111111] to-[#0F9D58]/10 flex flex-col items-center justify-center"
    >
      {/* Animated Logo */}
      <div className="relative">
        {/* Logo with scale + fade in animation */}
        <div
          className="transform transition-all duration-700 ease-out scale-100 opacity-100 animate-[logoEntrance_0.7s_ease-out_0.1s_both]"
        >
          <img
            src="/JeoLogoFinal.png"
            alt="JOE Logo"
            className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] md:w-[180px] md:h-[180px] object-contain drop-shadow-2xl"
            onError={(e) => {
              // Fallback to text logo if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.nextElementSibling) {
                (target.nextElementSibling as HTMLElement).style.display = 'flex';
              }
            }}
          />
          
          {/* Fallback text logo */}
          <div 
            className="hidden items-center font-bold text-6xl sm:text-7xl text-white"
            style={{ display: 'none' }}
          >
            <span>JOE</span>
            <div className="bg-[#34D399] rounded-full ml-2 w-4 h-4" />
          </div>
        </div>

        {/* Subtle glow pulse effect */}
        <div
          className="absolute inset-0 -z-10 bg-primary/20 rounded-full blur-2xl transition-opacity duration-1000 opacity-100 animate-[glowPulse_2s_ease-in-out_infinite]"
          style={{
            width: '150%',
            height: '150%',
            top: '-25%',
            left: '-25%',
          }}
        />
      </div>

      {/* Tagline with slide-up + fade animation */}
      <div
        className="mt-8 text-center transform transition-all duration-600 ease-out translate-y-0 opacity-100 animate-[taglineEntrance_0.6s_ease-out_0.5s_both]"
      >
        <p className="text-white text-lg sm:text-xl md:text-2xl font-medium tracking-tight px-4">
          Fast food. No chaos.
        </p>
        
        {/* Subtle underline accent */}
        <div 
          className="mt-3 mx-auto w-16 h-0.5 bg-accent/60 rounded-full"
          style={{
            animation: 'taglineAccent 0.8s ease-out 0.7s both'
          }}
        />
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes logoEntrance {
          from {
            opacity: 0;
            transform: scale(0.85);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes taglineEntrance {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.05);
          }
        }

        @keyframes taglineAccent {
          from {
            width: 0;
            opacity: 0;
          }
          to {
            width: 64px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
