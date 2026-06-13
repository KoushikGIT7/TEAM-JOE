/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Trophy, Zap, ShieldAlert, KeyRound } from 'lucide-react';

interface WelcomeViewProps {
  onEnterStaffPortal: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onEnterStaffPortal }) => {
  const { handleStudentLogin } = useApp();

  const mockGoogleLogin = () => {
    handleStudentLogin('kabir.dev@gmail.com', 'Kabir Dev', 'GOOGLE');
  };

  const mockGuestLogin = () => {
    handleStudentLogin('guest@joe.com', 'Guest Client', 'GUEST');
  };

  return (
    <div className="relative min-h-[85vh] flex flex-col justify-between px-6 pt-10 pb-8 overflow-hidden bg-surface-lowest text-on-surface">
      {/* Background Layering */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[60%] bg-brand-purple/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] left-[-10%] w-[80%] h-[60%] bg-brand-green/5 rounded-full blur-[100px]" />
      </div>

      {/* Top Header Row with Portal Shortcuts */}
      <header className="relative z-10 flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-linear-to-tr from-brand-purple to-brand-purple-dark flex items-center justify-center shadow-md">
            <span className="font-display font-black text-white text-xs">JOE</span>
          </div>
          <span className="font-mono text-xs tracking-wider text-brand-purple-light select-none font-semibold uppercase">
            SMART CAFETERIA
          </span>
        </div>

        {/* Staff & Admin Entry Trigger */}
        <button
          onClick={onEnterStaffPortal}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-caption text-xs font-mono font-medium text-brand-purple-light"
          id="btn-staff-auth"
        >
          <KeyRound className="w-3.5 h-3.5 text-brand-purple" />
          STAFF / ADMIN
        </button>
      </header>

      {/* Main Display Title Area */}
      <main className="relative z-10 flex flex-col gap-5 w-full max-w-lg mx-auto py-6 animate-fade-in">
        <div className="flex flex-col gap-1.5 text-center">
          <span className="font-mono text-[9px] tracking-widest text-brand-purple-light font-black uppercase">
            ⚡️ JOE'S CAMPUS DIGITAL SIGNAGE & CUSTOMER APP
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
            Order Smarter. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple to-brand-purple-light italic">
              Skip Cafeteria Queues.
            </span>
          </h1>
          <p className="font-sans text-xs text-zinc-400 max-w-[90%] mx-auto mt-1 leading-relaxed">
            Order ahead physically, preheat your dining loyalty, track levels, and check out with our seamless system.
          </p>
        </div>

        {/* Bite-Sized Premium Key Value Highlights */}
        <div className="grid grid-cols-3 gap-2.5 my-1">
          <div className="p-3 rounded-xl border border-white/5 bg-white/5 text-center">
            <span className="text-base block">📱</span>
            <span className="font-display font-black text-[10px] text-white block mt-1 uppercase tracking-wider">Fast Mobile</span>
            <span className="font-sans text-[9px] text-[#cbd5e1]/65 block mt-0.5">Order on the go</span>
          </div>

          <div className="p-3 rounded-xl border border-white/5 bg-white/5 text-center">
            <span className="text-base block">💎</span>
            <span className="font-display font-black text-[10px] text-white block mt-1 uppercase tracking-wider">Loyalty Perks</span>
            <span className="font-sans text-[9px] text-[#cbd5e1]/65 block mt-0.5">Climb foodie tiers</span>
          </div>

          <div className="p-3 rounded-xl border border-white/5 bg-white/5 text-center">
            <span className="text-base block">🎟️</span>
            <span className="font-display font-black text-[10px] text-brand-purple-light block mt-1 uppercase tracking-wider">Deca-Drive</span>
            <span className="font-sans text-[9px] text-[#cbd5e1]/65 block mt-0.5">50% off tenth order</span>
          </div>
        </div>

        {/* Concise info banner */}
        <div className="p-3 bg-brand-purple-dark/5 border border-brand-purple/20 rounded-xl text-center select-none">
          <p className="font-sans text-[10px] text-zinc-300 leading-snug">
            💡 Setup your prepaid secure wallet at the register with the cashier, then order straight to priority express counters!
          </p>
        </div>
      </main>

      {/* Footer Branding & Unified Action Controllers */}
      <footer className="relative z-10 w-full max-w-sm mx-auto flex flex-col gap-3">
        <button
          onClick={mockGoogleLogin}
          type="button"
          className="w-full h-14 rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs tracking-wider font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          id="btn-login-google"
        >
          {/* Custom inline Google Emblem Icon */}
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          CONTINUE WITH GOOGLE
        </button>

        <button
          onClick={mockGuestLogin}
          type="button"
          className="w-full h-12 flex items-center justify-center font-mono text-xs font-bold text-on-surface-variant hover:text-white transition-colors cursor-pointer"
          id="btn-login-guest"
        >
          CONTINUE AS GUEST
        </button>
      </footer>
    </div>
  );
};
