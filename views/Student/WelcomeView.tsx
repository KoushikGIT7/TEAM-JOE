
import React from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import Logo from '../../components/Logo';

interface WelcomeViewProps {
  onStart: () => void;
  onStaffLogin: () => void; // Google sign-in (students)
  onAdminLogin: () => void; // Credential screen (admin/cashier/server)
  disabled?: boolean; // Disable button while auth is loading
  googleLoading?: boolean; // Show spinner on the Google button
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onStart, onStaffLogin, onAdminLogin, disabled = false, googleLoading = false }) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-between p-8 bg-white max-w-md mx-auto relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />

      {/* Admin/Staff Login (top-right) */}
      <div className="absolute top-0 right-0 p-4 sm:p-6 z-10">
        <button 
          onClick={onAdminLogin}
          disabled={disabled}
          className="px-4 py-2 rounded-full bg-white/80 backdrop-blur border border-black/10 text-textSecondary font-bold text-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Admin / Staff
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <Logo size="xl" className="mb-6 sm:mb-8" />
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-textMain leading-tight">
          Fast meals.<br />Zero chaos.
        </h1>
        <p className="mt-4 sm:mt-6 text-textSecondary text-base sm:text-lg md:text-xl px-4 sm:px-6">
          Order your favorite college meals in seconds. No queues, just food.
        </p>
      </div>

      <div className="w-full space-y-3">
        <button
          onClick={onStaffLogin}
          disabled={disabled || googleLoading}
          className="w-full bg-black text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed min-h-[56px] text-lg"
        >
          {googleLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              {/* Google G icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </>
          )}
        </button>
        <button
          onClick={onStart}
          disabled={disabled || googleLoading}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-5 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-primary/20 min-h-[56px] text-lg"
        >
          Start Ordering
          <ArrowRight className="ml-2 w-6 h-6" />
        </button>
        <p className="text-center text-sm text-textSecondary mt-6">
          Designed for Day Scholars @ Campus
        </p>
      </div>
    </div>
  );
};

export default WelcomeView;
