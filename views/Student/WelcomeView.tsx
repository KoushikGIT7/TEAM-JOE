import React from 'react';
import { ShieldCheck, Loader2, UserCircle } from 'lucide-react';
import Logo from '../../components/Logo';

interface WelcomeViewProps {
  onGoogleLogin: () => void;
  onStaffLogin: () => void;
  onGuestLogin: () => void;
  disabled?: boolean;
  googleLoading?: boolean;
  guestLoading?: boolean;
}

const WelcomeView: React.FC<WelcomeViewProps> = ({ 
  onGoogleLogin, 
  onStaffLogin, 
  onGuestLogin, 
  disabled = false, 
  googleLoading = false,
  guestLoading = false
}) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-between p-6 sm:p-8 bg-white max-w-md mx-auto relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />

      {/* Top Header - Staff Login Entry */}
      <div className="w-full flex justify-end items-center py-2 z-10">
        <button 
          onClick={onStaffLogin}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 text-textSecondary text-sm font-bold hover:bg-gray-100 transition-colors border border-gray-100"
        >
          <ShieldCheck className="w-4 h-4" />
          Staff Login
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 w-full">
        <Logo size="xl" className="mb-8" />
        
        <div className="space-y-4 mb-12">
          <h1 className="text-3xl sm:text-4xl font-black text-textMain tracking-tight leading-tight">
            Welcome to<br />
            <span className="text-primary">Cafeteria System</span>
          </h1>
          <p className="text-textSecondary text-lg font-medium max-w-[280px] mx-auto">
            Experience the fastest way to order your favorite meals.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-4">
          <button
            onClick={onGoogleLogin}
            disabled={disabled || googleLoading}
            className="w-full bg-textMain text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-textMain/10 disabled:opacity-70 disabled:cursor-not-allowed text-lg hover:shadow-2xl"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 bg-white rounded-full p-1" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <button
            onClick={onGuestLogin}
            disabled={disabled || googleLoading || guestLoading}
            className="w-full bg-gray-50 text-textMain font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 border-2 border-transparent hover:border-gray-200 text-lg disabled:opacity-70"
          >
            {guestLoading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-textSecondary" />
                <span>Setting up your session...</span>
              </>
            ) : (
              <>
                <UserCircle className="w-6 h-6 text-textSecondary" />
                <span>Continue as Guest</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full py-4 text-center">
        <p className="text-[10px] text-textSecondary uppercase tracking-widest opacity-40 font-black">
          Powered by JOE Cafeteria • SECURE AUTH
        </p>
      </div>
    </div>
  );
};

export default WelcomeView;

