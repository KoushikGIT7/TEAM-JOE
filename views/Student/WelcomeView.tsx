import React from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { ComplianceFooter } from './ComplianceView';

interface WelcomeViewProps {
  onGoogleLogin: () => void;
  onStaffLogin: () => void;
  onGuestLogin: () => void;
  onOpenCompliance: (view: 'privacy' | 'refund' | 'terms' | 'contact') => void;
  disabled?: boolean;
  googleLoading?: boolean;
  guestLoading?: boolean;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ 
  onGoogleLogin, 
  onStaffLogin, 
  onGuestLogin, 
  onOpenCompliance,
  disabled = false, 
  googleLoading = false,
  guestLoading = false
}) => {
  return (
    <div className="relative min-h-screen flex flex-col px-6 overflow-hidden bg-surface-lowest text-on-surface max-w-md mx-auto justify-between pb-8">
      
      {/* Background Glow Layers */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[90%] h-[60%] bg-brand-purple/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[-15%] w-[90%] h-[60%] bg-brand-purple/5 rounded-full blur-[110px]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 flex justify-between items-center w-full pt-8 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-purple to-brand-purple-dark flex items-center justify-center shadow-md shadow-brand-purple/30">
            <span className="font-display font-black text-white text-xs">CSE</span>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-brand-purple-light select-none font-semibold uppercase">
            Smart Cafeteria
          </span>
        </div>

        <button
          onClick={onStaffLogin}
          disabled={disabled || googleLoading || guestLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-mono font-medium text-brand-purple-light disabled:opacity-50 cursor-pointer"
          id="btn-staff-auth"
        >
          <KeyRound className="w-3.5 h-3.5 text-brand-purple" />
          STAFF / ADMIN
        </button>
      </header>

      {/* Main Content — Vertically Spaced and Breathable */}
      <main className="relative z-10 flex flex-col w-full py-6 gap-8 flex-1 justify-center">
        
        {/* Hero Title Block */}
        <div className="flex flex-col gap-4 text-center">
          <span className="font-mono text-[9px] tracking-widest text-brand-purple-light font-black uppercase opacity-75">
            ⚡️ CSE's Campus Digital Ordering Platform
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white leading-[1.2]">
            Order ahead.{' '}
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple to-brand-purple-light italic">
              Skip the Queue.
            </span>
          </h1>
          <p className="font-sans text-xs text-zinc-400 max-w-[90%] mx-auto leading-relaxed">
            Order your meals ahead, earn points, track statuses in real time — all right from your phone.
          </p>
        </div>

        {/* Feature Highlights - Spacious Horizontal (Side by Side) Cards */}
        <div className="grid grid-cols-3 gap-2.5 my-1">
          {[
            { emoji: '📱', title: 'Fast Mobile', sub: 'Order on the go', highlight: false },
            { emoji: '💎', title: 'Loyalty Perks', sub: 'Climb foodie tiers', highlight: false },
            { emoji: '🎟️', title: 'Deca-Drive', sub: '50% off tenth order', highlight: true },
          ].map((card) => (
            <div
              key={card.title}
              className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all hover:bg-white/5 ${
                card.highlight
                  ? 'border-brand-purple/30 bg-brand-purple/10'
                  : 'border-white/5 bg-white/5'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-base shrink-0 mb-1.5">
                {card.emoji}
              </div>
              <h3 className={`font-display font-black text-[9px] uppercase tracking-wider leading-tight ${card.highlight ? 'text-brand-purple-light' : 'text-white'}`}>
                {card.title}
              </h3>
              <p className="font-sans text-[9px] text-[#cbd5e1]/65 mt-1 leading-snug">
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Info notice block */}
        <div className="p-4 bg-brand-purple/5 border border-brand-purple/10 rounded-2xl flex items-start gap-3">
          <span className="text-sm shrink-0">💡</span>
          <p className="font-sans text-xs text-zinc-400 leading-relaxed text-left">
            Load your prepaid wallet at the cashier counter, then order straight to the express pickup lane.
          </p>
        </div>
      </main>

      {/* Footer CTAs */}
      <footer className="relative z-10 w-full flex flex-col gap-3 pt-4">
        
        {/* Primary: Google Login */}
        <button
          onClick={onGoogleLogin}
          disabled={disabled || googleLoading}
          type="button"
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs tracking-wider font-bold shadow-lg shadow-brand-purple/20 hover:scale-[1.01] active:scale-99 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          id="btn-login-google"
        >
          {googleLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>CONNECTING...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>CONTINUE WITH GOOGLE</span>
            </>
          )}
        </button>

        {/* Secondary: Guest */}
        <button
          onClick={onGuestLogin}
          disabled={disabled || googleLoading || guestLoading}
          type="button"
          className="w-full h-12 flex items-center justify-center font-mono text-xs font-bold text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50 tracking-wider"
          id="btn-login-guest"
        >
          {guestLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400 mr-2" />
              <span>SETTING UP SESSION...</span>
            </>
          ) : (
            <span>CONTINUE AS GUEST</span>
          )}
        </button>

        {/* Compliance Links */}
        <div className="border-t border-white/5 pt-4">
          <ComplianceFooter onOpen={onOpenCompliance} />
        </div>
      </footer>
    </div>
  );
};

export default WelcomeView;
