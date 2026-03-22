import React, { useState, useRef } from 'react';
import { ChevronLeft, Mail, Lock, Loader2, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import Logo from '../../components/Logo';
import { signIn } from '../../services/auth';
import { UserProfile } from '../../types';

interface LoginViewProps {
  onSuccess: (profile: UserProfile) => void;
  onBack: () => void;
}

// Human-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Wrong password',
  'auth/user-not-found': 'Account not found',
  'auth/invalid-email': 'Invalid email address',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'PROFILE_MISSING': 'Account not activated',
  'PROFILE_INCOMPLETE': 'Account not activated',
  'ACCOUNT_DEACTIVATED': 'Account deactivated',
  'ROLE_DENIED': 'Access restricted',
};

const getErrorMessage = (error: any): string => {
  const code = error?.code || error?.message || '';
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[error?.message] || 'Login failed. Please try again.';
};

const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onBack }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    // Clear previous errors
    setError('');
    setIsSubmitting(true);
    
    try {
      console.log('🔐 LoginView: Attempting sign in for', email);
      
      // Sign in with Firebase - optimized for speed
      const { user: firebaseUser, profile: userProfile } = await signIn(email, password);
      
      // Profile is guaranteed to exist from signIn (throws if missing)
      if (!userProfile) {
        throw new Error('PROFILE_MISSING');
      }
      
      // Validate profile has required fields
      if (!userProfile.role) {
        throw new Error('PROFILE_INCOMPLETE');
      }
      
      // Check active status
      if (!userProfile.active) {
        throw new Error('ACCOUNT_DEACTIVATED');
      }
      
      console.log('✅ LoginView: Login successful:', {
        email: userProfile.email,
        role: userProfile.role,
        active: userProfile.active
      });
      
      // Success - call onSuccess immediately
      // Routing will happen instantly via App.tsx useEffect
      onSuccess(userProfile);
      
    } catch (err: any) {
      console.error('❌ LoginView: Login error:', err);
      setError(getErrorMessage(err));
      setIsSubmitting(false);
      
      // Refocus submit button for accessibility
      setTimeout(() => {
        submitButtonRef.current?.focus();
      }, 100);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-white max-w-md mx-auto relative overflow-hidden">
      {/* Back Button */}
      <div className="absolute top-0 left-0 p-4 sm:p-6 z-10">
        <button 
          onClick={onBack} 
          disabled={isSubmitting}
          className="p-3 bg-gray-50 rounded-2xl text-textSecondary active:scale-90 transition-all disabled:opacity-50 min-h-[48px] min-w-[48px] flex items-center justify-center"
          aria-label="Back to landing"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Header */}
      <div className="w-full text-center mb-10 mt-16 sm:mt-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider mb-6 border border-primary/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          Staff & Admin Portal
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-textMain tracking-tighter leading-tight">Authorize Access</h2>
        <p className="text-textSecondary text-base font-bold mt-2">Enter your secure credentials</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-6 max-w-sm">

        {/* Email Input */}
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs sm:text-sm font-black uppercase tracking-widest text-textSecondary ml-1 block">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-textSecondary pointer-events-none" />
            <input 
              id="email"
              type="email" 
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(''); // Clear error on input
              }}
              autoComplete="off"
              autoFocus
              disabled={isSubmitting}
              className="w-full bg-gray-50 border-none rounded-2xl py-4 sm:py-5 pl-14 pr-4 text-lg font-bold outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
              placeholder="admin@joecafe.com"
              required
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-2">
          <label htmlFor="password" className="text-xs sm:text-sm font-black uppercase tracking-widest text-textSecondary ml-1 block">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-textSecondary pointer-events-none" />
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(''); // Clear error on input
              }}
              autoComplete="off"
              disabled={isSubmitting}
              className="w-full bg-gray-50 border-none rounded-2xl py-4 sm:py-5 pl-14 pr-4 text-lg font-bold outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed min-h-[52px]"
              placeholder="Enter password"
              required
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-error/10 border-2 border-error/30 text-error text-base sm:text-lg font-bold p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          ref={submitButtonRef}
          type="submit"
          disabled={isSubmitting || !email || !password}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 min-h-[56px] text-lg sm:text-xl mt-6 sm:mt-8"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Authorize Access</span>
              <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginView;