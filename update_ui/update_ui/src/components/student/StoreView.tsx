/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp, INITIAL_REWARD_ITEMS } from '../../context/AppContext';
import { 
  Sparkles, Award, ShoppingBag, Coffee, Pizza, BadgePercent,
  CheckCircle2, AlertCircle, RefreshCw, Star, X
} from 'lucide-react';

export const StoreView: React.FC = () => {
  const { studentPoints, redeemReward } = useApp();
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'DRINKS' | 'MEALS' | 'EXCLUSIVE'>('ALL');
  const [successRedeemed, setSuccessRedeemed] = useState<{ name: string; code: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const categories = [
    { label: 'ALL', id: 'ALL' },
    { label: 'DRINKS', id: 'DRINKS' },
    { label: 'MEALS', id: 'MEALS' },
    { label: 'EXCLUSIVE', id: 'EXCLUSIVE' }
  ];

  // Filter rewards
  const rewards = INITIAL_REWARD_ITEMS.filter(it => {
    if (activeCategory === 'ALL') return true;
    return it.category === activeCategory;
  });

  const handleRedeem = (id: string) => {
    const result = redeemReward(id);
    if (result.success && result.reward) {
      setSuccessRedeemed({
        name: result.reward.name,
        code: result.reward.code
      });
      setErrorMessage(null);
    } else {
      setErrorMessage(result.error || 'Server rejected redemption');
      setSuccessRedeemed(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex flex-col justify-end px-5 h-20 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5 select-none">
        <div className="flex items-center justify-between pb-3.5">
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-widest text-brand-purple font-extrabold uppercase leading-none">
              LOYALTY REDEMPTION
            </span>
            <h1 className="font-display text-lg font-black text-white leading-none mt-1">
              Campus Store
            </h1>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1e293b] border border-white/10 shadow-lg select-none">
            <Award className="w-4 h-4 text-brand-purple-light" />
            <span className="font-mono text-[10px] text-white font-extrabold">
              {studentPoints.toLocaleString()} PTS
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid content */}
      <main className="px-5 mt-4 space-y-5 max-w-lg mx-auto">
        
        {/* Category filtering selection pills */}
        <div className="flex gap-2 select-none overflow-x-auto hide-scrollbar pb-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-[9px] font-extrabold tracking-widest transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-brand-purple text-surface-lowest font-black shadow-lg shadow-brand-purple/25 scale-[1.03]'
                  : 'bg-[#1e293b]/40 border border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Error notification bar if something went wrong */}
        {errorMessage && (
          <div className="p-3.5 bg-red-400/10 border border-red-400/20 rounded-2xl flex items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
              <p className="font-sans text-[11px] text-red-200 leading-snug">
                {errorMessage}
              </p>
            </div>
            <button 
              onClick={() => setErrorMessage(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Modal Overlay Dialog Popup */}
        {successRedeemed && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/75 backdrop-blur-md select-none animate-fade-in">
            <div className="relative glass-bg p-6 rounded-3xl w-full max-w-sm text-center border border-brand-purple/40 shadow-2xl relative overflow-hidden bg-[#121824]">
              {/* background ambient decoration nodes */}
              <div className="absolute -top-16 -left-16 w-32 h-32 bg-brand-purple/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-16 -right-16 w-38 h-38 bg-brand-green/5 rounded-full blur-2xl" />

              <div className="w-14 h-14 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center mx-auto mb-4 border border-brand-green/30">
                <CheckCircle2 className="w-8 h-8 animate-pulse" />
              </div>

              <h3 className="font-display font-black text-lg text-white leading-tight">
                Redeemed Successfully!
              </h3>
              <p className="text-[11px] text-zinc-400 font-sans mt-2 leading-relaxed">
                You've successfully claimed <strong>{successRedeemed.name}</strong>. The dynamic verification ticket has been generated.
              </p>

              {/* Promo Coupon Code Holder Card */}
              <div className="my-5 p-3.5 rounded-2xl bg-white/5 border border-white/5 font-mono text-center select-all">
                <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">REDEEM CODE</p>
                <h4 className="text-sm font-black text-brand-purple-light tracking-widest mt-1">
                  {successRedeemed.code}
                </h4>
              </div>

              <p className="text-[9px] text-[#22c55e] font-mono leading-none bg-brand-green/5 py-1.5 px-3 rounded-full inline-block font-extrabold uppercase tracking-widest">
                CLAIMED TICKET SAVED
              </p>

              <button
                type="button"
                onClick={() => setSuccessRedeemed(null)}
                className="w-full mt-6 py-3 rounded-xl bg-brand-purple hover:bg-brand-purple/90 font-mono text-[10px] font-black uppercase tracking-widest text-surface-lowest shadow-md hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer"
              >
                Go to Vault
              </button>
            </div>
          </div>
        )}

        {/* Catalog Items Grid Grid-Layout */}
        <section className="grid grid-cols-2 gap-4">
          {rewards.map((reward) => (
            <div 
              key={reward.id}
              className="glass-bg border border-white/5 hover:border-brand-purple/30 rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 group"
            >
              {/* Reward Image Header */}
              <div className="relative w-full aspect-[1.5/1] overflow-hidden shrink-0 bg-surface-mid">
                <img 
                  alt={reward.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 select-none" 
                  src={reward.image}
                  referrerPolicy="no-referrer"
                />
                
                {/* Custom badge at top of image if popular or rare */}
                {reward.badge && (
                  <span className="absolute top-2 left-2 font-mono text-[7px] bg-brand-purple text-surface-lowest px-1.5 py-0.5 rounded-md font-extrabold tracking-widest select-none uppercase shadow-md">
                    {reward.badge}
                  </span>
                )}
              </div>

              {/* Reward Information */}
              <div className="p-3.5 flex-grow flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-display text-xs font-black text-zinc-100 group-hover:text-white leading-tight">
                    {reward.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-sans leading-snug line-clamp-2">
                    {reward.description}
                  </p>
                </div>

                {/* Redeem Action Row */}
                <div className="pt-2 border-t border-white/5 flex flex-col gap-2 mt-auto">
                  <div className="flex justify-between items-center select-none">
                    <span className="font-mono text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest">
                      COST
                    </span>
                    <span className="font-mono text-xs text-brand-purple-light font-black">
                      {reward.pointsCost} PTS
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRedeem(reward.id)}
                    className={`w-full py-2 rounded-xl font-mono text-[9px] font-black uppercase tracking-widest transition-transform duration-200 cursor-pointer ${
                      studentPoints >= reward.pointsCost
                        ? 'bg-[#1e293b] hover:bg-brand-purple hover:text-surface-lowest text-white hover:scale-[1.02] border border-white/5 active:scale-95 shadow-md'
                        : 'bg-white/5 text-zinc-500 border border-transparent cursor-not-allowed opacity-50'
                    }`}
                  >
                    {studentPoints >= reward.pointsCost ? 'REDEEM' : 'LOCKED'}
                  </button>
                </div>
              </div>

            </div>
          ))}
        </section>

      </main>
    </div>
  );
};
