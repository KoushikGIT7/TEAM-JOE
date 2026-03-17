import React from 'react';
import { ShieldCheck, Loader2, Lock } from 'lucide-react';
import Logo from '../../components/Logo';

interface WelcomeViewProps {
  onStart: () => void;
  onStaffLogin: () => void; // Staff SSO
  onAdminLogin: () => void; // Admin Login
  disabled?: boolean;
  googleLoading?: boolean;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ onStaffLogin, onAdminLogin, disabled = false, googleLoading = false }) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-between p-8 bg-background max-w-md mx-auto relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />

      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <Logo size="xl" className="mb-6 sm:mb-8" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4 border border-primary/20">
          <ShieldCheck className="w-3 h-3" />
          Staff Portal
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-textMain leading-tight">
          Cafeteria Operations<br />Management System
        </h1>
        <p className="mt-4 text-textSecondary text-base px-2">
          Secure access for authorized cafeteria administrators, cashiers, and servers only.
        </p>
      </div>

      <div className="w-full space-y-3 mb-4">
        <button
          onClick={onStaffLogin}
          disabled={disabled || googleLoading}
          className="w-full bg-textMain text-background font-black py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed min-h-[56px] text-lg hover:bg-textMain/90"
        >
          {googleLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Staff SSO Login
            </>
          )}
        </button>

        <button
          onClick={onAdminLogin}
          disabled={disabled || googleLoading}
          className="w-full bg-background border-2 border-textMain/10 text-textMain font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 hover:bg-textMain/5 min-h-[56px]"
        >
          <Lock className="w-4 h-4" />
          Internal Admin Login
        </button>

        <div className="pt-6 text-center">
          <p className="text-xs text-textSecondary uppercase tracking-widest opacity-50">
            System v2.0 - RBAC Protected
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
