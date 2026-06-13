/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Mail, Lock, KeyRound, AlertCircle, ShieldEllipsis, Loader2 } from 'lucide-react';
import { signIn, signOut as authSignOut } from '../../services/auth';
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
  'auth/invalid-credential': 'Wrong email or password',
  'ACCESS_DENIED': 'Staff access only',
  'ACCOUNT_DEACTIVATED': 'Account deactivated',
  'PROFILE_MISSING': 'Account not activated',
  'PROFILE_INCOMPLETE': 'Account not activated',
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

  // Pre-seed credentials matching standard staff users in database
  const PRESET_CREDS = [
    { label: '🎫 Cashier (Verifications)', email: 'cashier@joe.com', pass: '123456' },
    { label: '🍳 Kitchen Cook (Orders Terminal)', email: 'cook@joe.com', pass: '123456' },
    { label: '📋 Supervisor (Demand tracking)', email: 'supervisor@joe.com', pass: '123456' },
    { label: '🤳 Counter Server (Scanner HUD)', email: 'server@joe.com', pass: '123456' },
    { label: '👑 Root Admin (System Controller)', email: 'admin@joe.com', pass: '123456' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      console.log('🔐 LoginView: Attempting Firebase sign in for', email);
      const { user: firebaseUser, profile: userProfile } = await signIn(email, password);

      if (!userProfile) {
        throw new Error('PROFILE_MISSING');
      }

      if (!userProfile.role || userProfile.role === 'STUDENT' || userProfile.role === 'GUEST') {
        await authSignOut();
        throw new Error('ROLE_DENIED');
      }

      if (!userProfile.active) {
        await authSignOut();
        throw new Error('ACCOUNT_DEACTIVATED');
      }

      console.log('✅ LoginView: Login successful for', userProfile.email);
      onSuccess(userProfile);
    } catch (err: any) {
      console.error('❌ LoginView: Login error:', err);
      setError(getErrorMessage(err));
      setIsSubmitting(false);

      setTimeout(() => {
        submitButtonRef.current?.focus();
      }, 100);
    }
  };

  const loadPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError('');
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between px-6 pt-10 pb-8 overflow-hidden bg-surface-lowest text-on-surface max-w-md mx-auto border-x border-white/5 shadow-2xl">
      {/* Background decoration blur glow */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[60%] bg-brand-purple/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] left-[-10%] w-[80%] h-[60%] bg-brand-purple-dark/10 rounded-full blur-[100px]" />
      </div>

      <header className="relative z-10 flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-brand-purple shrink-0 animate-bounce" />
          <span className="font-mono text-xs tracking-wider text-brand-purple-light select-none font-bold uppercase">
            STAFF & ADMIN PORTAL
          </span>
        </div>
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition-transform text-xs font-mono text-brand-purple-light cursor-pointer disabled:opacity-50"
        >
          Student Portal
        </button>
      </header>

      <main className="relative z-10 flex flex-col gap-6 w-full max-w-sm mx-auto py-8">
        <div className="text-center space-y-1.5 select-none">
          <ShieldEllipsis className="w-10 h-10 text-brand-purple mx-auto animate-pulse" />
          <h2 className="font-display text-xl font-extrabold text-white tracking-tight">
            Security Authentication
          </h2>
          <p className="font-sans text-xs text-on-surface-variant max-w-[90%] mx-auto leading-relaxed">
            Please authenticate using authorized credentials to open counter controls.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input field */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              AUTHORIZED EMAIL ADDRESS:
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-purple" />
              <input
                type="email"
                required
                disabled={isSubmitting}
                className="w-full h-11 bg-surface-mid/80 border border-white/5 rounded-xl pl-12 pr-4 text-xs text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-brand-purple disabled:opacity-50"
                placeholder="cashier@joe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input field */}
          <div className="space-y-1">
            <label className="font-mono text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              CRYPTOGRAPHIC SECURITY KEY:
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-purple" />
              <input
                type="password"
                required
                disabled={isSubmitting}
                className="w-full h-11 bg-surface-mid/80 border border-white/5 rounded-xl pl-12 pr-4 text-xs text-on-surface font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-brand-purple disabled:opacity-50"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex gap-2 items-center text-xs text-red-400 select-none">
              <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            ref={submitButtonRef}
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs font-bold tracking-widest active:scale-95 transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-brand-purple-light" />
                VERIFYING...
              </>
            ) : (
              'CONFIRM CREDENTIALS'
            )}
          </button>
        </form>

        {/* Instantly selectable credential presets */}
        <section className="space-y-2 border-t border-white/5 pt-4">
          <span className="font-mono text-[9px] text-zinc-400 font-bold uppercase tracking-widest block text-center select-none">
            ⚡️ Developer Credentials Presets
          </span>
          <p className="font-sans text-[10px] text-zinc-500 text-center leading-normal mb-1">
            (Select presets below to instantly test and control specific role HUD views)
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESET_CREDS.map((cred) => (
              <button
                key={cred.email}
                type="button"
                disabled={isSubmitting}
                onClick={() => loadPreset(cred.email, cred.pass)}
                className={`w-full py-2.5 px-3 rounded-lg border text-left text-[10.5px] font-mono leading-none flex justify-between items-center transition-colors cursor-pointer disabled:opacity-50 ${
                  email === cred.email
                    ? 'border-brand-purple bg-brand-purple/10 text-brand-purple-light font-bold'
                    : 'border-white/5 bg-white/5 hover:bg-white/10 text-on-surface-variant'
                }`}
              >
                <span>{cred.label}</span>
                <span className="text-[8.5px] font-mono text-zinc-400 lowercase">{cred.email}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default LoginView;