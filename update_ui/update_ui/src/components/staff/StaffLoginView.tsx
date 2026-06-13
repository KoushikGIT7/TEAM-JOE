/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StaffRole } from '../../types';
import { Mail, Lock, KeyRound, AlertCircle, ShieldEllipsis } from 'lucide-react';

interface StaffLoginViewProps {
  onBackToStudentPortal: () => void;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ onBackToStudentPortal }) => {
  const { setPortalMode, setStaffRole, setIsStaffLoggedIn } = useApp();

  const [email, setEmail] = useState('cashier@joe.com');
  const [password, setPassword] = useState('123456');
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-seed user credentials list for beautiful testing experience in iframe
  const PRESET_CREDS = [
    { label: '🎫 Cashier (Verifications)', email: 'cashier@joe.com', role: 'CASHIER' as StaffRole },
    { label: '🍳 Kitchen Cook (Orders Terminal)', email: 'cook@joe.com', role: 'COOK' as StaffRole },
    { label: '📋 Supervisor (Demand tracking)', email: 'supervisor@joe.com', role: 'SUPERVISOR' as StaffRole },
    { label: '🤳 Counter Server (Scanner HUD)', email: 'server@joe.com', role: 'SERVER' as StaffRole },
    { label: '👑 Root Admin (System Controller)', email: 'admin@joe.com', role: 'ADMIN' as StaffRole },
  ];

  const handleStaffLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.includes('@joe.com') && email !== 'admin@joe.com') {
      setErrorMessage('Access restricted: Only authorized institutional email addresses are permitted.');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Security Alert: Authentication signature requires at least 4 digits.');
      return;
    }

    // Capture specific staff roles based on simulated credentials
    let role: StaffRole = 'CASHIER';
    if (email.includes('cook')) role = 'COOK';
    else if (email.includes('supervisor')) role = 'SUPERVISOR';
    else if (email.includes('server')) role = 'SERVER';
    else if (email.includes('admin')) role = 'ADMIN';

    setStaffRole(role);
    setIsStaffLoggedIn(true);
    setPortalMode('STAFF');
  };

  const loadPreset = (presetEmail: string, presetRole: StaffRole) => {
    setEmail(presetEmail);
    setPassword('123456');
    setErrorMessage('');
  };

  return (
    <div className="relative min-h-[90vh] flex flex-col justify-between px-6 pt-10 pb-8 overflow-hidden bg-surface-lowest text-on-surface">
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
          onClick={onBackToStudentPortal}
          className="px-3.5 py-1.5 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 active:scale-95 transition-transform text-xs font-mono text-brand-purple-light underline"
        >
          Student Portal
        </button>
      </header>

      <main className="relative z-10 flex flex-col gap-6 w-full max-w-sm mx-auto py-8">
        <div className="text-center space-y-1.5 select-none">
          <ShieldEllipsis className="w-10 h-10 text-brand-purple mx-auto" />
          <h2 className="font-display text-xl font-extrabold text-white tracking-tight">
            Security Authentication
          </h2>
          <p className="font-sans text-xs text-on-surface-variant max-w-[90%] mx-auto leading-relaxed">
            Please authenticate using authorized credentials to open counter controls.
          </p>
        </div>

        <form onSubmit={handleStaffLoginSubmit} className="space-y-4">
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
                className="w-full h-11 bg-surface-mid/80 border border-white/5 rounded-xl pl-9 pr-4 text-xs text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-brand-purple"
                placeholder="cashier@joe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input field */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="font-mono text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
                CRYPTOGRAPHIC SECURITY KEY:
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-purple" />
              <input
                type="password"
                required
                className="w-full h-11 bg-surface-mid/80 border border-white/5 rounded-xl pl-9 pr-4 text-xs text-on-surface font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-brand-purple"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Friendly alert tag warnings */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex gap-2 items-center text-xs text-red-200 select-none">
              <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full h-12 rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs font-bold tracking-widest active:scale-95 transition-transform shadow-lg cursor-pointer"
          >
            CONFIRM CREDENTIALS
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
                onClick={() => loadPreset(cred.email, cred.role)}
                className={`w-full py-2.5 px-3 rounded-lg border text-left text-[10.5px] font-mono leading-none flex justify-between items-center transition-colors cursor-pointer ${
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
