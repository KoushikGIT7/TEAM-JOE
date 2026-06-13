/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { OrdersView } from './OrdersView';
import { ComplianceView } from './ComplianceView';
import { 
  Key, Ticket, ShieldAlert, CheckCircle2, QrCode, 
  Trash2, X, AlertCircle, Copy, Check, Clock, ShieldCheck
} from 'lucide-react';

export const VaultView: React.FC = () => {
  const { studentTab, setStudentTab, setActiveOrderTrackId, redeemedRewards, useRedeemedReward } = useApp();
  const [vaultSubTab, setVaultSubTab] = useState<'VOUCHERS' | 'RECEIPTS' | 'COMPLIANCE'>('VOUCHERS');
  const [selectedVoucher, setSelectedVoucher] = useState<typeof redeemedRewards[0] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const subTabs = [
    { label: 'MY VOUCHERS', id: 'VOUCHERS', icon: Ticket },
    { label: 'RECEIPTS', id: 'RECEIPTS', icon: Clock },
    { label: 'LEGAL LOGS', id: 'COMPLIANCE', icon: ShieldCheck }
  ];

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClaimVoucher = (id: string) => {
    useRedeemedReward(id);
    if (selectedVoucher && selectedVoucher.id === id) {
      setSelectedVoucher(prev => prev ? { ...prev, status: 'USED' } : null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* View Header */}
      <header className="sticky top-0 z-40 bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5 select-none">
        <div className="px-5 py-4 flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-widest text-[#a3b8cc] font-extrabold uppercase leading-none">
            SECURE REPOSITORY
          </span>
          <h1 className="font-display text-lg font-black text-white leading-none mt-1">
            Campus Vault
          </h1>
        </div>

        {/* Outer Vault sub-tabs */}
        <div className="flex border-t border-b border-white/5 px-4 h-12 bg-surface-lowest">
          {subTabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = vaultSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setVaultSubTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 font-mono text-[9px] font-black tracking-widest border-b-2 transition-all cursor-pointer ${
                  isSelected 
                    ? 'border-brand-purple text-brand-purple-light' 
                    : 'border-transparent text-slate-300 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mt-4">
        {vaultSubTab === 'VOUCHERS' && (
          <section className="px-5 space-y-4 max-w-lg mx-auto">
            <p className="text-[10px] text-slate-300 leading-relaxed font-sans select-none">
              Vouchers represent reward tokens redeemed from the Student Store. Present claim passes at cashier counter to use them.
            </p>

            {redeemedRewards.length === 0 ? (
              <div className="text-center p-12 glass-bg rounded-2xl select-none text-slate-400 font-sans text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-white/5 mt-4">
                <Ticket className="w-8 h-8 text-slate-400/80 mb-1" />
                <span>Your vault is empty.</span>
                <button
                  onClick={() => setStudentTab('STORE')}
                  className="mt-3.5 px-4 py-2 rounded-xl bg-[#1e293b] border border-white/5 text-brand-purple-light font-mono text-[9px] font-black uppercase tracking-widest hover:bg-brand-purple/15 hover:text-white transition-all cursor-pointer"
                >
                  Buy with Points
                </button>
              </div>
            ) : (
              <div className="space-y-3 mt-4">
                {redeemedRewards.map((voucher) => {
                  const isUsed = voucher.status === 'USED';
                  return (
                    <div 
                      key={voucher.id}
                      className={`glass-bg glass-stroke rounded-2xl p-4 flex gap-4 items-center justify-between transition-all duration-300 ${
                        isUsed ? 'opacity-45' : 'hover:border-brand-purple/20'
                      }`}
                    >
                      <div className="flex gap-3 items-center min-w-0">
                        {/* Status Icon Indicator */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                          isUsed 
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-600' 
                            : 'bg-brand-purple/10 border-brand-purple/20 text-brand-purple-light animate-pulse'
                        }`}>
                          <Ticket className="w-4.5 h-4.5" />
                        </div>
                        
                        <div className="min-w-0">
                          <h4 className="font-display font-black text-xs text-white truncate leading-tight">
                            {voucher.name}
                          </h4>
                          <p className="font-sans text-[9px] text-zinc-400 mt-0.5">
                            Redeemed {new Date(voucher.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {isUsed ? (
                          <span className="font-mono text-[8px] bg-zinc-800 text-zinc-500 font-extrabold px-2 py-1 rounded">
                            USED
                          </span>
                        ) : (
                          <button
                            onClick={() => setSelectedVoucher(voucher)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#1e293b] border border-brand-purple/35 text-brand-purple-light hover:bg-brand-purple hover:text-surface-lowest font-mono text-[8px] font-black tracking-widest uppercase transition-all shrink-0 cursor-pointer"
                          >
                            OPEN PASS
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Renders pre-existing OrdersView inside our tab structure smoothly */}
        {vaultSubTab === 'RECEIPTS' && (
          <div className="max-w-lg mx-auto">
            <OrdersView 
              onBackToMenu={() => setStudentTab('HOME')}
              onNavigateToTracking={(id) => {
                setActiveOrderTrackId(id);
                setStudentTab('TRACKING');
              }}
            />
          </div>
        )}

        {/* Renders pre-existing ComplianceView inside our tab structure smoothly */}
        {vaultSubTab === 'COMPLIANCE' && (
          <div className="max-w-lg mx-auto">
            <ComplianceView onBackToMenu={() => setStudentTab('HOME')} />
          </div>
        )}
      </main>

      {/* Floating Ticket Drawer Modal Overlay Dialog popup */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/80 backdrop-blur-md select-none animate-fade-in">
          <div className="relative glass-bg p-6 rounded-3xl w-full max-w-sm text-center border border-brand-purple/40 shadow-2xl overflow-hidden bg-[#121824]">
            {/* Ambient visual background glow details */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-brand-purple/10 rounded-full blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Heading Control */}
            <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-5">
              <span className="font-mono text-[9px] text-brand-purple-light font-extrabold uppercase tracking-widest">
                VERIFICATION PASS
              </span>
              <button 
                onClick={() => setSelectedVoucher(null)} 
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-display font-black text-md text-[#f4f4f5] leading-tight">
              {selectedVoucher.name}
            </h3>
            <p className="text-[10px] text-slate-300 mt-1 font-sans">
              Present this code or QR at the school food counter.
            </p>

            {/* Aesthetic representation of Coupon scan barcode bar code */}
            <div className="my-5 p-5 bg-white rounded-2xl flex flex-col items-center justify-center gap-3 shadow-inner">
              
              {/* Simulated QR block layout */}
              <div className="w-28 h-28 bg-zinc-100 p-2 border border-zinc-200/50 rounded-xl relative flex items-center justify-center">
                <QrCode className="w-full h-full text-zinc-900" />
                <div className="absolute w-5 h-5 bg-white border border-zinc-200 rounded flex items-center justify-center">
                  <span className="font-display font-black italic text-[90%] text-brand-purple scale-75">JOE</span>
                </div>
              </div>

              {/* Dynamic Promo code selector */}
              <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-xl w-full justify-between">
                <span className="font-mono text-[10px] text-zinc-800 font-extrabold truncate">
                  {selectedVoucher.code}
                </span>

                <button
                  onClick={() => handleCopyCode(selectedVoucher.code)} 
                  className="w-6 h-6 rounded-md hover:bg-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
                  title="Copy verification code"
                >
                  {copiedId === selectedVoucher.code ? (
                    <Check className="w-3.5 h-3.5 text-brand-green" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Prompt actions to mark tickets as CLAIMED dynamically */}
            <div className="space-y-3.5 mt-5">
              {selectedVoucher.status === 'USED' ? (
                <div className="p-3 bg-brand-green/5 border border-brand-green/20 rounded-xl text-center select-none font-mono text-[9px] uppercase font-black text-brand-green tracking-widest flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>PASS CLAIM COMPLETED</span>
                </div>
              ) : (
                <>
                  <p className="text-[8.5px] text-slate-300 leading-snug font-sans">
                    ⚠️ cashier counter staff will mark this as CLAIMED once verified. If claiming yourself, tap the button below. This action is irreversible.
                  </p>
                  <button
                    onClick={() => handleClaimVoucher(selectedVoucher.id)}
                    className="w-full py-3 rounded-xl bg-brand-green hover:bg-brand-green/90 text-surface-lowest font-mono text-[9px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer"
                  >
                    CLAIM REWARD
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
