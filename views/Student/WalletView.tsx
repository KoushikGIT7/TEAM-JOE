/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../hooks/useAuth';
import { 
  ArrowLeft, Plus, ArrowUpRight, ArrowDownLeft, AlertCircle, 
  RotateCw, CreditCard, Award, Sparkles, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { 
  listenToWalletSummary, 
  listenToWalletTransactions, 
  listenToMyRechargeRequests, 
  WALLET_LOW_BALANCE_THRESHOLD 
} from '../../services/wallet';
import { WalletSummary, WalletTransaction, WalletRechargeRequest } from '../../types';

interface WalletViewProps {
  profile?: any;
  onBack?: () => void;
  onAddMoney?: () => void;
  onBackToMenu?: () => void;
  onNavigateToAddMoney?: () => void;
}

const txReasonLabel: Record<string, string> = {
  wallet_recharge: 'Recharge Refill',
  order_purchase: 'Order Checkout',
  refund: 'Refund Credit',
  adjustment: 'System Correction',
};

const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export const WalletView: React.FC<WalletViewProps> = ({ 
  profile, 
  onBack, 
  onAddMoney, 
  onBackToMenu, 
  onNavigateToAddMoney 
}) => {
  const { profile: authProfile } = useAuth();
  const { settings } = useApp();

  const activeProfile = profile || authProfile;
  const userId = activeProfile?.uid;

  const [summary, setSummary] = useState<WalletSummary>({ walletBalance: 0, totalRecharged: 0, totalSpent: 0 });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<WalletRechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const unsubs = [
      listenToWalletSummary(userId, (s) => { setSummary(s); setLoading(false); }),
      listenToWalletTransactions(userId, setTransactions),
      listenToMyRechargeRequests(userId, setRechargeRequests),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [userId]);

  const handleBack = () => {
    if (onBack) onBack();
    else if (onBackToMenu) onBackToMenu();
  };

  const handleAddMoney = () => {
    if (onAddMoney) onAddMoney();
    else if (onNavigateToAddMoney) onNavigateToAddMoney();
  };

  const isLowBalance = summary.walletBalance < (settings?.lowBalanceThreshold || WALLET_LOW_BALANCE_THRESHOLD);
  const pendingRecharge = rechargeRequests.find(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface max-w-md mx-auto border-x border-white/5 shadow-2xl">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-brand-purple" />
        </button>
        <div className="flex flex-col">
          <span className="font-mono text-[9px] tracking-widest text-brand-purple-light select-none font-bold uppercase leading-none">
            CAMPUS SECURE WALLET
          </span>
          <h1 className="font-display text-md font-black text-white leading-none mt-1">
            CSE Pay Manager
          </h1>
        </div>
      </header>

      {/* Main Wallet content */}
      <main className="px-5 mt-4 space-y-6">
        
        {/* Visa-style credit card visual container */}
        <section className="relative group">
          <div 
            className="w-full aspect-[1.6/1] rounded-[2rem] p-6 flex flex-col justify-between shadow-2xl relative z-10 overflow-hidden select-none border border-white/10"
            style={{
               background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F9D58 100%)'
            }}
          >
            {/* Decors circles */}
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 rounded-full bg-white/5 pointer-events-none blur-md" />
            <div className="absolute bottom-[-10%] left-[-20%] w-40 h-40 rounded-full bg-black/5 pointer-events-none blur-xs" />

            <div className="flex justify-between items-start z-10">
              <div className="space-y-0.5">
                <p className="font-mono text-[8px] font-black tracking-widest text-[#a3b8cc] uppercase">
                  CSE PLATINUM DEBIT
                </p>
                <h2 className="font-display text-sm font-black text-white tracking-tight leading-none mt-1">
                  Wallet Balance
                </h2>
              </div>
              <span className="font-display font-black text-white italic text-md opacity-35 bg-white/10 px-2.5 py-1 rounded-md">
                CSE
              </span>
            </div>

            <div className="flex justify-between items-end z-10">
              <div className="space-y-1">
                <span className="font-display text-3xl font-extrabold text-white tracking-tight drop-shadow-md">
                  ₹{summary.walletBalance.toFixed(2)}
                </span>
                <p className="font-mono text-[8.5px] tracking-wider text-[#cbd5e1] uppercase mt-1">
                  CARD OWNER: {activeProfile?.name?.toUpperCase() || 'STUDENT'}
                </p>
              </div>
              <div className="w-12 h-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center font-mono text-[80%] font-black border border-white/10 select-none text-white/70">
                RFID
              </div>
            </div>
          </div>
        </section>

        {/* Pilot Program Preference Notice */}
        <div className="p-3.5 bg-brand-purple-dark/5 border border-brand-purple/20 rounded-2xl flex gap-3 items-start select-none">
          <div className="w-7 h-7 rounded-lg bg-brand-purple/10 flex items-center justify-center shrink-0 border border-brand-purple/20 mt-0.5">
            <span className="text-xs">👨‍✈️</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[9px] font-black text-brand-purple-light tracking-wider uppercase">
              STUDENT WALLET PILOT PREFERENCE
            </span>
            <p className="font-sans text-[11px] text-zinc-300 leading-relaxed mt-0.5">
              We are pre-testing digital wallet checkout. Drop by the cashier desk or cafeteria counter to add secure cash credits with zero processing delay.
            </p>
          </div>
        </div>

        {/* Low-balance helper banner warning */}
        {isLowBalance && (
          <div className="p-3 bg-amber-400/10 border border-amber-400/25 rounded-xl flex items-center gap-2 select-none">
            <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
            <p className="font-sans text-[11px] text-amber-200 leading-snug">
              ⚠️ <strong>Low Balance Warning:</strong> Card funds dropped below ₹{(settings?.lowBalanceThreshold || WALLET_LOW_BALANCE_THRESHOLD).toFixed(2)}. Top up to prevent checkout locks.
            </p>
          </div>
        )}

        {/* Cash register transaction clock list if there is a pending approval */}
        {pendingRecharge && (
          <div className="p-3 bg-brand-purple-dark/10 border border-brand-purple/25 rounded-xl flex items-center justify-between gap-3 animate-pulse select-none">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-brand-purple animate-spin shrink-0" />
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase font-black text-brand-purple-light leading-none">
                  Approval Request Pending
                </span>
                <span className="font-sans text-[10px] text-zinc-400 mt-1 line-clamp-1">
                  Cashier verification queued for ₹{pendingRecharge.amount.toFixed(2)} deposit.
                </span>
              </div>
            </div>
            <span className="font-mono text-[9px] bg-brand-purple/20 text-brand-purple-light font-black px-2 py-0.5 rounded-full uppercase">
              QUEUED
            </span>
          </div>
        )}

        {/* Math Quick insights bento panel */}
        <section className="grid grid-cols-2 gap-4 select-none">
          <div className="glass-bg glass-stroke p-4 rounded-2xl flex gap-3 items-center">
            <div className="w-9 h-9 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-brand-green" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[10px] text-zinc-400 font-medium">Recharged total</span>
              <h4 className="font-mono text-sm font-black text-white mt-0.5">₹{summary.totalRecharged.toFixed(2)}</h4>
            </div>
          </div>

          <div className="glass-bg glass-stroke p-4 rounded-2xl flex gap-3 items-center">
            <div className="w-9 h-9 rounded-full bg-brand-purple/10 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-5 h-5 text-brand-purple" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[10px] text-zinc-400 font-medium">Spent total</span>
              <h4 className="font-mono text-sm font-black text-white mt-0.5">₹{summary.totalSpent.toFixed(2)}</h4>
            </div>
          </div>
        </section>

        {/* Gamification Achievements */}
        <section className="space-y-3 select-none">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5">
              <Award className="w-4.5 h-4.5 text-brand-purple" />
              Achievements
            </h3>
            <span className="font-mono text-[10px] text-brand-purple font-bold tracking-widest uppercase cursor-pointer">
              7 Days Active
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1">
            <div className="flex-shrink-0 w-32 p-3.5 glass-bg glass-stroke rounded-xl flex flex-col items-center justify-center text-center gap-2 border-brand-purple/20 bg-gradient-to-b from-surface-mid to-surface-low select-none">
              <div className="w-10 h-10 rounded-full bg-brand-purple/10 border border-brand-purple/30 flex items-center justify-center relative">
                <Sparkles className="w-5 h-5 text-brand-purple animate-pulse" />
                <span className="absolute -bottom-1 -right-1 bg-brand-green text-brand-green-dark scale-80 font-mono font-black text-[10px] px-1.5 py-0.5 rounded-full">
                  7D
                </span>
              </div>
              <span className="font-mono text-[10px] text-brand-purple-light font-bold">Daily Diner</span>
            </div>

            <div className="flex-shrink-0 w-32 p-3.5 glass-bg glass-stroke rounded-xl flex flex-col items-center justify-center text-center gap-2 opacity-40">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <RotateCw className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="font-mono text-[10px] text-zinc-400 font-bold">Gourmet Pro</span>
            </div>

            <div className="flex-shrink-0 w-32 p-3.5 glass-bg glass-stroke rounded-xl flex flex-col items-center justify-center text-center gap-2 opacity-40">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="font-mono text-[10px] text-zinc-400 font-bold">Eco Hero</span>
            </div>
          </div>
        </section>

        {/* Historical Ledger transaction stream */}
        <section className="space-y-3">
          <h3 className="font-display font-extrabold text-sm text-white">Transaction Ledger</h3>
          
          <div className="space-y-3.5 divide-y divide-white/5">
            {transactions.length === 0 && rechargeRequests.filter(r => r.status !== 'pending').length === 0 ? (
              <div className="text-center py-10 font-sans text-xs text-zinc-500">
                No ledger records found.
              </div>
            ) : (
              <>
                {/* Historical Recharge requests */}
                {rechargeRequests
                  .filter(r => r.status !== 'pending')
                  .map(r => (
                    <div key={r.id} className="flex justify-between items-center pt-3.5 first:pt-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          r.status === 'approved' ? 'bg-brand-green/10 text-brand-green' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {r.status === 'approved' ? (
                            <ArrowUpRight className="w-4 h-4 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 shrink-0" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-xs text-white">
                            {r.status === 'approved' ? 'Recharge Approved' : 'Recharge Rejected'}
                          </h4>
                          {r.rejectionNote && (
                            <p className="text-[10px] text-red-300 font-medium truncate leading-tight mt-0.5">
                              {r.rejectionNote}
                            </p>
                          )}
                          <p className="font-sans text-[9px] text-zinc-500 mt-1">
                            {formatTime(r.reviewedAt || r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-mono text-xs font-black ${
                          r.status === 'approved' ? 'text-brand-green' : 'text-zinc-500 line-through'
                        }`}>
                          +₹{r.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}

                {/* Ledger transactions */}
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center pt-3.5 first:pt-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        tx.type === 'credit' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-purple/10 text-brand-purple'
                      }`}>
                        {tx.type === 'credit' ? (
                          <ArrowUpRight className="w-4 h-4 shrink-0" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4 shrink-0" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-display font-bold text-xs text-white">
                          {txReasonLabel[tx.reason] || tx.reason}
                        </h4>
                        {tx.orderId && (
                          <p className="text-[10px] text-zinc-400 font-medium leading-none mt-1">
                            Order #{tx.orderId.slice(-6).toUpperCase()}
                          </p>
                        )}
                        <p className="font-sans text-[9px] text-zinc-500 mt-1">
                          {formatTime(tx.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono text-xs font-black ${
                        tx.type === 'credit' ? 'text-brand-green' : 'text-zinc-300'
                      }`}>
                        {tx.type === 'credit' ? '+' : '-'}₹{tx.amount.toFixed(2)}
                      </span>
                      <p className="font-mono text-[9px] text-zinc-500 mt-1">
                        bal: ₹{tx.balanceAfter.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

      </main>

      {/* Floating Action topup button */}
      <button
        onClick={handleAddMoney}
        disabled={!!pendingRecharge}
        type="button"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-gradient-to-tr from-brand-purple to-brand-purple-dark text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all z-40 neon-shadow-purple cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-6 h-6" />
        <span className="sr-only">Add Money</span>
      </button>
    </div>
  );
};

export default WalletView;
