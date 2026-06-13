/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  History, CreditCard, ShieldCheck, Lock, Headphones, 
  Palette, LogOut, QrCode, ChevronRight, Award, Info, 
  CheckCircle2, X, Tv
} from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { 
    studentName, 
    walletBalance, 
    studentLevel, 
    setStudentTab, 
    handleStudentLogout,
    setPortalMode
  } = useApp();

  const [activeTheme, setActiveTheme] = useState<'DARK' | 'LIGHT'>('DARK');
  const [modalType, setModalType] = useState<'PERKS' | 'SECURITY' | 'SUPPORT' | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <div className="relative min-h-screen bg-[#0b1326] text-[#dae2fd] overflow-x-hidden pt-20 pb-28">
      
      {/* Decorative Gradients */}
      <div className="fixed top-[-10%] right-[-10%] w-96 h-96 bg-[#b76dff]/10 rounded-full blur-[120px] -z-20 pointer-events-none" />
      <div className="fixed bottom-[10%] left-[-10%] w-80 h-80 bg-[#4ae176]/5 rounded-full blur-[100px] -z-20 pointer-events-none" />

      {/* Fixed Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#171f33]/60 backdrop-blur-xl border-b border-white/10 shadow-2xl flex justify-between items-center px-5 py-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#b76dff] flex items-center justify-center bg-[#171f33] overflow-hidden">
            <span className="font-display font-black text-sm text-[#ddb7ff] tracking-tight">
              {getInitials(studentName)}
            </span>
          </div>
          <span className="font-display text-lg font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[#b76dff] to-[#4ae176] uppercase">
            CYBER·EATS
          </span>
        </div>
        <button 
          onClick={() => setStudentTab('WALLET')}
          className="bg-[#222a3d] px-3.5 py-1.5 rounded-full border border-white/10 active:scale-95 duration-200 transition-opacity hover:opacity-80 cursor-pointer"
        >
          <span className="font-mono text-xs font-bold text-[#4ae176] tracking-wider">
            ${walletBalance.toFixed(2)}
          </span>
        </button>
      </header>

      {/* Main Profile Body Content */}
      <main className="px-5 max-w-lg mx-auto space-y-8">
        
        {/* Student Identity Card Section */}
        <section className="mt-4">
          <div className="relative group perspective">
            {/* Glowing Aura background */}
            <div className="absolute inset-0 bg-[#b76dff]/20 blur-[60px] rounded-[32px] -z-10 pointer-events-none" />
            
            {/* Digital ID Card container */}
            <div className="relative bg-[#171f33]/60 backdrop-blur-xl border border-white/20 rounded-[32px] p-6 shadow-2xl overflow-hidden bg-gradient-to-br from-[#b76dff]/20 to-[#4d8eff]/10">
              
              {/* Scanline CRT overlay laser bar */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#4ae176] to-transparent opacity-30 animate-pulse" />

              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-[#ddb7ff] uppercase font-bold mb-1">
                    STUDENT IDENTITY
                  </p>
                  <h1 className="font-display text-2xl font-extrabold text-[#dae2fd] tracking-tight">
                    {studentName}
                  </h1>
                  <p className="text-xs text-[#cfc2d6] font-medium mt-0.5">
                    Class of 2026 • Tech Institute
                  </p>
                </div>
                
                {/* Ranking Badge indicator */}
                <div className="bg-[#4ae176]/10 border border-[#4ae176]/30 rounded-2xl px-3 py-2 backdrop-blur-md shadow-[0_0_15px_rgba(74,225,118,0.3)] text-center">
                  <span className="block font-mono text-[9px] text-[#4ae176] font-bold tracking-wider uppercase leading-none">RANK</span>
                  <span className="block font-display text-xl font-extrabold text-[#4ae176] mt-1 leading-none">#42</span>
                </div>
              </div>

              {/* Status block & badges array card footer */}
              <div className="flex items-end justify-between pt-2">
                <div className="space-y-3.5">
                  <div className="flex items-center gap-1.5 select-none">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ae176] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ae176]"></span>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#dae2fd] tracking-widest uppercase">
                      PRO FOODIE STATUS
                    </span>
                  </div>

                  {/* Level achievement Badges of ALEX */}
                  <div className="flex -space-x-1.5">
                    <div className="w-8 h-8 rounded-full border-2 border-[#131b2e] bg-[#b76dff] flex items-center justify-center text-xs font-bold shadow-md select-none hover:scale-110 transition-transform">
                      🏆
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#131b2e] bg-[#adc6ff] flex items-center justify-center text-xs font-bold shadow-md select-none hover:scale-110 transition-transform">
                      🔥
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#131b2e] bg-[#4ae176] flex items-center justify-center text-xs font-bold shadow-md select-none hover:scale-110 transition-transform">
                      💎
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => setStudentTab('TRACKING')}
                  className="opacity-40 hover:opacity-100 transition-opacity cursor-pointer flex flex-col items-center gap-0.5"
                  title="My Secure Scanner Ticket"
                >
                  <QrCode className="w-12 h-12 text-[#dae2fd]" />
                  <span className="font-mono text-[8px] tracking-wider uppercase text-zinc-400">View QR</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Account Ecosystem Options Navigation Menu */}
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-bold tracking-widest text-[#cfc2d6] uppercase px-1">
            ACCOUNT ECOSYSTEM
          </h2>

          {/* Menu Item: Order History */}
          <button 
            onClick={() => setStudentTab('ORDERS')}
            className="w-full bg-[#171f33]/60 backdrop-blur-md border border-white/10 flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#b76dff]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <History className="w-5 h-5 text-[#b76dff]" />
              </div>
              <span className="text-sm font-semibold text-[#dae2fd]">Order History</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#cfc2d6]/70 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Menu Item: Payment Methods */}
          <button 
            onClick={() => setStudentTab('WALLET')}
            className="w-full bg-[#171f33]/60 backdrop-blur-md border border-white/10 flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#4ae176]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="w-5 h-5 text-[#4ae176]" />
              </div>
              <span className="text-sm font-semibold text-[#dae2fd]">Payment Methods</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#4ae176] font-bold">2 Linked</span>
              <ChevronRight className="w-5 h-5 text-[#cfc2d6]/70 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Menu Item: Campus Perks */}
          <button 
            onClick={() => setModalType('PERKS')}
            className="w-full bg-[#171f33]/60 backdrop-blur-md border border-white/10 flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#4d8eff]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5 text-[#4d8eff]" />
              </div>
              <span className="text-sm font-semibold text-[#dae2fd]">Campus Perks</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#cfc2d6]/70 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Menu Item: Security Settings */}
          <button 
            onClick={() => setModalType('SECURITY')}
            className="w-full bg-[#171f33]/60 backdrop-blur-md border border-white/10 flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2d3449] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Lock className="w-5 h-5 text-[#cfc2d6]" />
              </div>
              <span className="text-sm font-semibold text-[#dae2fd]">Security</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#cfc2d6]/70 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Menu Item: Help & Support */}
          <button 
            onClick={() => setModalType('SUPPORT')}
            className="w-full bg-[#171f33]/60 backdrop-blur-md border border-white/10 flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-all group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2d3449] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Headphones className="w-5 h-5 text-[#cfc2d6]" />
              </div>
              <span className="text-sm font-semibold text-[#dae2fd]">Help &amp; Support</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#cfc2d6]/70 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Menu Item: Cafeteria TV Monitor Screen link */}
          <button 
            onClick={() => setPortalMode('MONITOR')}
            className="w-full bg-[#171f33]/60 backdrop-blur-md border border-teal-500/20 flex items-center justify-between p-4 rounded-2xl hover:bg-teal-500/5 transition-all group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Tv className="w-5 h-5 text-teal-400" />
              </div>
              <div className="text-left">
                <span className="text-sm font-semibold text-[#dae2fd] block">Cafeteria TV Monitor</span>
                <span className="text-[9px] text-[#2dd4bf] block font-mono uppercase tracking-widest leading-none mt-0.5">LAUNCH LIVE BIG SCREEN DISPLAY</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#cfc2d6]/70 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </section>

        {/* Theme Preferences card segment with grid options */}
        <section className="mt-4">
          <div className="bg-[#171f33]/60 backdrop-blur-xl border border-[#b76dff]/20 p-5 rounded-[24px]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-[#b76dff]" />
                <h3 className="font-display text-sm font-bold text-white">Theme Preferences</h3>
              </div>
              <span className="font-mono text-[9px] text-[#b76dff] bg-[#b76dff]/15 px-2.5 py-1 rounded-full font-black uppercase">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Option 1: Cyber Dark (Default) */}
              <button 
                onClick={() => setActiveTheme('DARK')}
                className={`flex flex-col items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                  activeTheme === 'DARK'
                    ? 'bg-[#b76dff]/20 border-[#b76dff] shadow-[0_0_15px_rgba(183,109,255,0.3)]'
                    : 'bg-white/5 border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className="w-full aspect-video rounded-lg bg-[#0b1326] border border-white/10 flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#b76dff]/10 to-transparent" />
                  <div className="flex gap-1.5 z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#b76dff] animate-pulse" />
                    <div className="w-12 h-2.5 rounded-full bg-[#2d3449]" />
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase font-bold text-[#dae2fd]">CYBER DARK</span>
              </button>

              {/* Option 2: Neon Light */}
              <button 
                onClick={() => setActiveTheme('LIGHT')}
                className={`flex flex-col items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                  activeTheme === 'LIGHT'
                    ? 'bg-white/20 border-[#4ae176] shadow-[0_0_15px_rgba(74,225,118,0.35)]'
                    : 'bg-white/5 border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <div className="w-full aspect-video rounded-lg bg-zinc-100 border border-black/10 flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4ae176]/10 to-transparent" />
                  <div className="flex gap-1.5 z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#4ae176] animate-pulse" />
                    <div className="w-12 h-2.5 rounded-full bg-zinc-300" />
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase font-bold text-[#dae2fd]">NEON LIGHT</span>
              </button>
            </div>
          </div>
        </section>

        {/* Global Exit Session CTA Button */}
        <div className="text-center pt-2">
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to sign out of this student app session?')) {
                handleStudentLogout();
              }
            }}
            className="font-mono text-xs text-[#ffb4ab] uppercase font-extrabold tracking-widest opacity-60 hover:opacity-100 transition-opacity cursor-pointer bg-red-500/5 hover:bg-red-500/10 px-5 py-2.5 rounded-full border border-red-500/15"
          >
            SIGN OUT OF SESSION
          </button>
        </div>

      </main>

      {/* --- Contextual Overlays / Modals --- */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#171f33] border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setModalType(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full cursor-pointer transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Perks modal content */}
            {modalType === 'PERKS' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-[#4d8eff]">
                  <Award className="w-6 h-6" />
                  <h3 className="font-display font-bold text-base text-white">Your Campus Perks</h3>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  As a **Pro Foodie LVL {studentLevel}** tier student, your cyber privileges at Joe's counters are fully active:
                </p>
                <div className="space-y-2.5 font-sans">
                  <div className="flex gap-2 text-xs text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-[#4ae176] shrink-0" />
                    <span><strong>Skip-The-Line:</strong> Priority checkout at all central server lanes.</span>
                  </div>
                  <div className="flex gap-2 text-xs text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-[#4ae176] shrink-0" />
                    <span><strong>2% Cashback:</strong> Rewards score multiplier active on every ramen checkout.</span>
                  </div>
                  <div className="flex gap-2 text-xs text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-[#4ae176] shrink-0" />
                    <span><strong>Hot Food Priority:</strong> Kitchen cook notifications highlight your order.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Security modal content */}
            {modalType === 'SECURITY' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-[#cfc2d6]">
                  <Lock className="w-6 h-6" />
                  <h3 className="font-display font-bold text-base text-white">Secure Verification Systems</h3>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  CYBER-EATS runs on fully cryptographic order-verification protocol:
                </p>
                <div className="space-y-2.5 font-sans text-xs text-zinc-400">
                  <p>✓ All student tickets are hashed with secure rotating signatures to prevent offline clones.</p>
                  <p>✓ Automated cash verification requests require manual clerk authority before state settlement.</p>
                  <p>✓ Encoded QR payloads rotate dynamically to limit interception of transaction tickets.</p>
                </div>
              </div>
            )}

            {/* Support modal content */}
            {modalType === 'SUPPORT' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-[#ddb7ff]">
                  <Headphones className="w-6 h-6" />
                  <h3 className="font-display font-bold text-base text-white">Cyber-Eats Support Network</h3>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                  Encountered an issue with payments or canteen pickup? We're on call:
                </p>
                <div className="space-y-2 font-sans text-xs text-zinc-400">
                  <div>📞 <strong>Campus hotline:</strong> 1-800-555-EATS</div>
                  <div>🏢 <strong>In-Person Helpdesk:</strong> Lounge Room 304, Level 3</div>
                  <div>✉ <strong>Email:</strong> support@cyber-eats.edu</div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setModalType(null)}
              className="w-full py-2.5 bg-[#b76dff]/20 hover:bg-[#b76dff]/30 text-[#ddb7ff] font-mono text-[10px] uppercase font-bold tracking-widest rounded-xl transition cursor-pointer"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
