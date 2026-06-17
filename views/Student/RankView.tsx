/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { 
  Trophy, Flame, Award, Sparkles, Star, User, 
  ChevronRight, Compass, ShieldCheck, Heart, Moon, Sun,
  Gift, Zap, Eye, AlertCircle, CheckCircle2, X
} from 'lucide-react';

export const RankView: React.FC = () => {
  const { 
    studentName, 
    studentPoints, 
    studentXp, 
    studentLevel,
    magicBoxProgress,
    claimMagicBox,
    leaderboardUsers,
    orders
  } = useApp();

  const [subTab, setSubTab] = useState<'STATS' | 'LEADERBOARD'>('STATS');
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<{ rewardName: string; code: string; desc: string; percent: number } | null>(null);

  // Cse Points Loyalty Tier Calculations
  const totalOrdersPlaced = orders.length;
  let tierTitle = 'Bronze Foodie';
  let dynamicDiscount = '0%';
  let earningMultiplierText = '1.0x (Standard)';
  let nextBenefitInfo = 'Silver Gourmand unlocks at 4 orders to activate 5% off discounts.';
  let nextBenefitProgress = Math.min(100, Math.floor((totalOrdersPlaced / 4) * 100));
  let tierBadgeColor = 'bg-orange-500/10 text-orange-400 border-orange-500/20';

  if (totalOrdersPlaced >= 10) {
    tierTitle = 'Gold Gastronomer';
    dynamicDiscount = '10% Flat';
    earningMultiplierText = '1.5x (Elite)';
    nextBenefitInfo = 'Max Loyalty Tier achieved! Enjoy 10% off and 1.5x points on every order.';
    nextBenefitProgress = 100;
    tierBadgeColor = 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20';
  } else if (totalOrdersPlaced >= 4) {
    tierTitle = 'Silver Gourmand';
    dynamicDiscount = '5% Flat';
    earningMultiplierText = '1.2x (Booster)';
    nextBenefitInfo = `Achieve ${10 - totalOrdersPlaced} more order${10 - totalOrdersPlaced > 1 ? 's' : ''} to reach Gold Gastronomer for 10% Flat discounts!`;
    nextBenefitProgress = Math.min(100, Math.floor(((totalOrdersPlaced - 4) / 6) * 100));
    tierBadgeColor = 'bg-violet-500/10 text-violet-400 border-violet-500/20';
  }

  // Circular progress calculations for student levels
  const xpTarget = 1000;
  const xpPercentage = Math.min(100, Math.floor((studentXp / xpTarget) * 100));

  // Static streaks configuration for weekly trackers
  const streakDays = [
    { day: 'MON', active: true, isCurrent: false },
    { day: 'TUE', active: true, isCurrent: false },
    { day: 'WED', active: true, isCurrent: true },
    { day: 'THU', active: false, isCurrent: false },
    { day: 'FRI', active: false, isCurrent: false },
    { day: 'SAT', active: false, isCurrent: false },
    { day: 'SUN', active: false, isCurrent: false },
  ];

  // Handles the random selection of low-cost, high-retention rewards
  const handleSpinMagicBox = () => {
    setIsSpinning(true);
    setTimeout(async () => {
      const result = await claimMagicBox();
      setIsSpinning(false);
      if (result.success) {
        setSpinResult({
          rewardName: result.rewardName,
          code: result.discountCode,
          desc: result.description,
          percent: result.discountPercent
        });
      }
    }, 1800);
  };

  // Sort top 3 from context
  const podiumTop3 = leaderboardUsers.slice(0, 3);
  const rank1 = podiumTop3[0];
  const rank2 = podiumTop3[1];
  const rank3 = podiumTop3[2];
  const remainingCompetitors = leaderboardUsers.slice(3);

  return (
    <div className="min-h-screen bg-surface-lowest text-on-surface">
      {/* View Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 h-16 w-full bg-[#0b1326]/90 backdrop-blur-xl border-b border-white/5 select-none animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-brand-purple flex items-center justify-center bg-[#171f33] text-brand-purple-light font-black font-display text-sm">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-widest text-brand-purple font-extrabold uppercase leading-none">
              LEVEL {studentLevel}
            </span>
            <h1 className="font-display text-sm font-black text-white leading-none mt-1">
              Campus Elites
            </h1>
          </div>
        </div>

        {/* Sub-tab selection indicator pill */}
        <div className="flex bg-[#1e293b]/70 p-1 rounded-full border border-white/5">
          <button
            onClick={() => setSubTab('STATS')}
            className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              subTab === 'STATS' 
                ? 'bg-brand-purple text-surface-lowest font-black shadow-md shadow-brand-purple/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            My Stats
          </button>
          <button
            onClick={() => setSubTab('LEADERBOARD')}
            className={`px-3 py-1 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase transition-all cursor-pointer ${
              subTab === 'LEADERBOARD' 
                ? 'bg-brand-purple text-surface-lowest font-black shadow-md shadow-brand-purple/20' 
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Leaderboard
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="px-5 py-4 pb-28 space-y-6 max-w-lg mx-auto">
        {subTab === 'STATS' ? (
          <>
            {/* Circular Progress Ring Card */}
            <section className="relative">
              <div className="glass-bg glass-stroke rounded-3xl p-6 flex flex-col items-center text-center overflow-hidden bg-[#171f33]/40">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-purple/10 rounded-full blur-[100px] pointer-events-none" />
                
                {/* Find current user's rank from list */}
                {(() => {
                  const myItem = leaderboardUsers.find(u => u.name === studentName);
                  const myRank = myItem ? myItem.rank : 42;
                  return (
                    <div className="relative w-44 h-44 mb-4 select-none">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle 
                          className="text-white/5" 
                          cx="88" 
                          cy="88" 
                          fill="transparent" 
                          r="80" 
                          stroke="currentColor" 
                          strokeWidth="8"
                        />
                        <circle 
                          className="text-brand-purple transition-all duration-1000" 
                          cx="88" 
                          cy="88" 
                          fill="transparent" 
                          r="80" 
                          stroke="currentColor" 
                          strokeDasharray="502" 
                          strokeDashoffset={502 - (502 * xpPercentage) / 100} 
                          strokeWidth="10"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-[9px] text-brand-purple-light tracking-widest uppercase font-extrabold">Rank</span>
                        <span className="font-display text-3xl font-extrabold text-white">#{myRank}</span>
                      </div>
                    </div>
                  );
                })()}

                <h2 className="font-display font-extrabold text-xl text-white">Pro Foodie Elite</h2>
                <p className="text-zinc-400 font-sans text-xs mt-1">
                  {studentXp} / {xpTarget} XP to Next Milestone
                </p>

                <div className="flex gap-2.5 mt-5">
                  <div className="px-3.5 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/20 flex items-center gap-1.5 select-none">
                    <Flame className="w-3.5 h-3.5 text-brand-purple-light" />
                    <span className="font-mono text-[9px] text-brand-purple-light font-extrabold">LVL {studentLevel}</span>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-full bg-[#b76dff]/15 border border-[#b76dff]/30 flex items-center gap-1.5 select-none">
                    <Star className="w-3.5 h-3.5 text-brand-green animate-pulse" />
                    <span className="font-mono text-[9px] text-brand-green font-extrabold">PRO SPREE</span>
                  </div>
                </div>
              </div>
            </section>

            {/* CSE POINTS LOYALTY CARD AND TIER-BASED PROGRESS */}
            <section className="glass-bg glass-stroke rounded-3xl p-5 bg-[#171f33]/35 relative border border-white/5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/15">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-xs text-white uppercase tracking-wider">CSE Loyalty Engine</h3>
                    <p className="font-sans text-[10px] text-zinc-400">Order frequency and tier multiplier status</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full border text-[10px] font-mono font-black ${tierBadgeColor}`}>
                  {tierTitle}
                </div>
              </div>

              {/* Grid with core stats */}
              <div className="grid grid-cols-3 gap-2 py-1 text-center select-none">
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <span className="block font-mono text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Frequency</span>
                  <span className="font-display text-sm font-black text-white">{totalOrdersPlaced} Orders</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <span className="block font-mono text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Base Discount</span>
                  <span className="font-display text-sm font-black text-brand-green">{dynamicDiscount}</span>
                </div>
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <span className="block font-mono text-[8px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Cse Points</span>
                  <span className="font-display text-sm font-black text-brand-purple-light">{studentPoints} PTS</span>
                </div>
              </div>

              {/* Progress bar to next bonus level */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 font-bold uppercase">
                  <span>Loyalty Promotion Progress</span>
                  <span>{nextBenefitProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#8b5cf6] to-brand-green transition-all duration-500"
                    style={{ width: `${nextBenefitProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                  {nextBenefitInfo}
                </p>
              </div>

              {/* Informative Capping explanation box to ensure owner profitability */}
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl text-[10px] text-zinc-400 font-sans leading-relaxed flex gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-purple shrink-0 mt-0.5" />
                <span>
                  <strong>Owner Profitability Guarantee:</strong> Our special deca-multiplier milestones (e.g., 50% discount every 10th order) are automatically capped at $10 max. This keeps ingredients fully covered and secures steady margins for Mr. Cse.
                </span>
              </div>
            </section>

            {/* CYBER LOOT BOX INTERACTIVE GAME SEGMENT */}
            <section className="bg-gradient-to-r from-brand-purple/10 via-black/40 to-brand-green/10 rounded-3xl p-5 border border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#b76dff]/5 to-transparent pointer-events-none" />
              
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1">
                  <span className="font-mono text-[8px] bg-brand-purple/15 text-brand-purple-light px-2.5 py-1 rounded-full font-black uppercase tracking-widest leading-none">
                    Loot Box Campaign Active 🎁
                  </span>
                  <h3 className="font-display font-black text-sm text-white pt-2.5">Cyber-Eats Loot Chest</h3>
                  <p className="font-sans text-[11px] text-zinc-400 leading-relaxed max-w-[280px]">
                    Place frequent checkouts to charge cosmetic chest nodes! Open to win up to 50% discount codes instantly.
                  </p>
                </div>
                {/* Loot Box visual */}
                <div className="text-4xl animate-bounce shrink-0 select-none pt-2 font-black">
                  {magicBoxProgress >= 3 ? '🎁' : '🔒'}
                </div>
              </div>

              {/* Energy Progress Meter nodes */}
              <div className="space-y-2 mt-4 select-none">
                <div className="flex justify-between items-center font-mono text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                  <span>CRYSTAL Energy Charge Status</span>
                  <span className={magicBoxProgress >= 3 ? "text-brand-green font-black" : "text-[#ddb7ff]"}>
                    {magicBoxProgress}/3 CHARGED
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2.5 py-1">
                  {[1, 2, 3].map((node) => {
                    const isCharged = magicBoxProgress >= node;
                    return (
                      <div 
                        key={node} 
                        className={`h-2.5 rounded-full border transition-all ${
                          isCharged 
                            ? 'bg-gradient-to-r from-brand-purple to-brand-green border-brand-purple/40 shadow-[0_0_10px_rgba(183,109,255,0.4)]' 
                            : 'bg-white/5 border-white/5'
                        }`} 
                      />
                    );
                  })}
                </div>
              </div>

              {/* Trigger interactions */}
              <div className="mt-4">
                {magicBoxProgress >= 3 ? (
                  isSpinning ? (
                    <button 
                      disabled 
                      className="w-full py-2.5 rounded-xl bg-[#1e293b] border border-white/10 text-white font-mono text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse"
                    >
                      <Sparkles className="w-4.5 h-4.5 text-brand-purple-light animate-spin" />
                      <span>UNLOCKING COSMIC CHEST...</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleSpinMagicBox}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-purple via-[#9333ea] to-brand-green font-mono text-[10px] font-black text-[#0f172a] uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer text-center"
                    >
                      ⚡ UNLOCK COSMIC LOOT CHEST ⚡
                    </button>
                  )
                ) : (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center select-none font-mono text-[10px] text-zinc-400">
                    Need <strong className="text-brand-purple">{3 - magicBoxProgress} more order{3 - magicBoxProgress > 1 ? 's' : ''}</strong> to unlock coupon spins.
                  </div>
                )}
              </div>
            </section>

            {/* Custom Gacha Result Modal Overlay */}
            {spinResult && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/85 backdrop-blur-md select-none animate-fade-in">
                <div className="relative p-6 rounded-3xl w-full max-w-sm text-center border-2 border-brand-green/40 shadow-2xl overflow-hidden bg-[#0d131f]">
                  <div className="absolute -top-16 -left-16 w-32 h-32 bg-brand-green/10 rounded-full blur-2xl" />
                  <div className="absolute -bottom-16 -right-16 w-38 h-38 bg-brand-purple/5 rounded-full blur-2xl" />

                  <div className="w-14 h-14 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center mx-auto mb-4 border border-brand-green/30">
                    <CheckCircle2 className="w-8 h-8 animate-bounce" />
                  </div>

                  <h3 className="font-display font-black text-lg text-white leading-tight uppercase">
                    You Won {spinResult.percent}% Off!
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-sans mt-2 leading-relaxed">
                    <strong>{spinResult.rewardName}</strong>. Canteen owner margins are preserved, you get high performance discount coupons saved immediately into your secure app Vault!
                  </p>

                  <div className="my-5 p-3.5 rounded-2xl bg-white/5 border border-white/5 font-mono text-center">
                    <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">PROMO VAULT KEY</p>
                    <h4 className="text-sm font-black text-brand-green mt-1 tracking-widest">
                      {spinResult.code}
                    </h4>
                  </div>

                  <p className="text-[9px] text-[#22c55e] font-mono leading-none bg-brand-green/5 py-1.5 px-3 rounded-full inline-block font-extrabold uppercase tracking-widest mb-4">
                    TICKET SAVED IN VAULT
                  </p>

                  <button
                    type="button"
                    onClick={() => setSpinResult(null)}
                    className="w-full py-3 rounded-xl bg-brand-green hover:bg-brand-green/90 font-mono text-[10px] font-black uppercase tracking-widest text-[#070b13] shadow-md hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer"
                  >
                    AWESOME!
                  </button>
                </div>
              </div>
            )}

            {/* Daily Streaks Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between select-none">
                <h3 className="font-display font-black text-sm text-white">Daily Streaks</h3>
                <div className="flex items-center gap-1 text-[#b76dff] font-mono text-[10px] font-bold">
                  <Flame className="w-4 h-4 fill-[#b76dff]" />
                  <span>12 DAY HEAT</span>
                </div>
              </div>

              <div className="glass-bg glass-stroke rounded-2xl p-4 flex justify-between items-center bg-[#171f33]/30 overflow-x-auto hide-scrollbar select-none">
                {streakDays.map((item) => (
                  <div key={item.day} className="flex flex-col items-center gap-2 shrink-0">
                    <span className={`font-mono text-[8px] font-bold ${item.isCurrent ? 'text-brand-purple-light' : 'text-zinc-500'}`}>
                      {item.day}
                    </span>
                    <div className={`w-9 h-11 rounded-full flex items-center justify-center border transition-all ${
                      item.isCurrent 
                        ? 'bg-brand-purple/20 border-brand-purple shadow-lg shadow-brand-purple/10 animate-pulse' 
                        : item.active 
                          ? 'bg-brand-purple/10 border-brand-purple/30' 
                          : 'bg-white/5 border-white/5 opacity-40'
                    }`}>
                      <Flame className={`w-4.5 h-4.5 ${
                        item.isCurrent 
                          ? 'text-brand-purple-light' 
                          : item.active 
                            ? 'text-brand-green' 
                            : 'text-zinc-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Achievements */}
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-black text-sm text-[#cbd5e1]">Recent Achievements</h3>
                <span className="font-mono text-[9px] text-brand-purple font-extrabold tracking-widest uppercase cursor-pointer hover:underline">
                  View All
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="glass-bg glass-stroke rounded-2xl p-4 border-l-4 border-l-brand-purple flex flex-col gap-3 bg-[#171f33]/40 min-h-[140px]">
                  <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center shrink-0 border border-brand-purple/10">
                    <Moon className="w-5 h-5 text-brand-purple" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-xs font-black text-white leading-tight">Night Owl</h4>
                    <p className="text-[10px] text-zinc-400 leading-snug">Ordered after 10 PM 5 days in a row.</p>
                  </div>
                  <div className="w-full flex justify-between items-center mt-auto pt-2 border-t border-white/5 font-mono text-[8px]">
                    <span className="text-brand-purple-light font-bold">+250 PTS</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-purple/50" />
                  </div>
                </div>

                <div className="glass-bg glass-stroke rounded-2xl p-4 border-l-4 border-l-brand-green flex flex-col gap-3 bg-[#171f33]/40 min-h-[140px]">
                  <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center shrink-0 border border-brand-green/10">
                    <Heart className="w-5 h-5 text-brand-green" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-xs font-black text-white leading-tight">Healthy Hero</h4>
                    <p className="text-[10px] text-zinc-400 leading-snug">Chose 10 plant-based meals this month.</p>
                  </div>
                  <div className="w-full flex justify-between items-center mt-auto pt-2 border-t border-white/5 font-mono text-[8px]">
                    <span className="text-brand-green font-bold">+500 PTS</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-green/50" />
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          /* High-Fidelity Dynamic Leaderboard mapping */
          <section className="space-y-6">
            <h1 className="font-display text-md font-bold text-center text-white select-none">Campus Elites</h1>
            
            {/* Dynamic visual podium rendering */}
            <div className="flex items-end justify-center gap-3.5 h-52 mt-4 select-none">
              {/* Rank 2 Podium slot */}
              {rank2 && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="relative mb-2 shrink-0">
                    <div className={`w-12 h-12 rounded-full border-2 ${rank2.frameColor || 'border-white/10'} overflow-hidden bg-[#1e293b] p-0.5 relative`}>
                      <img 
                        alt="" 
                        className="w-full h-full object-cover rounded-full" 
                        src={rank2.avatar}
                        referrerPolicy="no-referrer"
                      />
                      {rank2.avatarDecoration && (
                        <span className="absolute -top-1 -right-1 text-[10px] animate-pulse z-20 select-none">{rank2.avatarDecoration}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-zinc-700 w-5 h-5 rounded-full flex items-center justify-center border border-white/10">
                      <span className="text-[8px] font-mono font-black text-zinc-300">2</span>
                    </div>
                  </div>
                  <div className="glass-bg border-b-0 border border-white/5 w-full h-16 rounded-t-xl flex flex-col items-center justify-center">
                    <p className="font-mono text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none truncate max-w-full px-1">{rank2.name}</p>
                    <p className="font-display font-extrabold text-xs text-brand-purple mt-1">{rank2.points.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Rank 1 Podium slot (Center, crown, scale overlay) */}
              {rank1 && (
                <div className="flex-1 flex flex-col items-center scale-110 shrink-0 transform translate-y-[-8px]">
                  <div className="relative mb-2.5">
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Award className="w-4.5 h-4.5 text-brand-green animate-bounce" />
                    </div>
                    <div className={`w-14 h-14 rounded-full border-2 ${rank1.frameColor || 'border-brand-purple'} overflow-hidden bg-[#1e293b] p-0.5 shadow-lg shadow-brand-purple/20 relative`}>
                      <img 
                        alt="" 
                        className="w-full h-full object-cover rounded-full" 
                        src={rank1.avatar}
                        referrerPolicy="no-referrer"
                      />
                      {rank1.avatarDecoration && (
                        <span className="absolute -top-1 -right-1 text-xs animate-pulse z-20 select-none">{rank1.avatarDecoration}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-brand-green w-6 h-6 rounded-full flex items-center justify-center border border-surface-lowest">
                      <span className="text-[9px] font-mono font-black text-surface-lowest">1</span>
                    </div>
                  </div>
                  <div className="glass-bg border-b-0 border border-brand-purple/30 w-full h-24 rounded-t-xl flex flex-col items-center justify-center bg-brand-purple/5">
                    <p className="font-mono text-[8px] text-brand-green font-bold uppercase tracking-widest leading-none truncate max-w-full px-1">{rank1.name}</p>
                    <p className="font-display font-extrabold text-[#f4f4f5] text-xs mt-1.5 leading-none">{rank1.points.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Rank 3 Podium slot */}
              {rank3 && (
                <div className="flex-1 flex flex-col items-center">
                  <div className="relative mb-2 shrink-0">
                    <div className={`w-12 h-12 rounded-full border-2 ${rank3.frameColor || 'border-white/10'} overflow-hidden bg-[#1e293b] p-0.5 relative`}>
                      <img 
                        alt="" 
                        className="w-full h-full object-cover rounded-full" 
                        src={rank3.avatar}
                        referrerPolicy="no-referrer"
                      />
                      {rank3.avatarDecoration && (
                        <span className="absolute -top-1 -right-1 text-[10px] animate-pulse z-20 select-none">{rank3.avatarDecoration}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-amber-800 w-5 h-5 rounded-full flex items-center justify-center border border-white/10">
                      <span className="text-[8px] font-mono font-black text-[#fed7aa]">3</span>
                    </div>
                  </div>
                  <div className="glass-bg border-b-0 border border-white/5 w-full h-14 rounded-t-xl flex flex-col items-center justify-center">
                    <p className="font-mono text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none truncate max-w-full px-1">{rank3.name}</p>
                    <p className="font-display font-extrabold text-xs text-brand-purple mt-1">{rank3.points.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Podium Base accent */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-brand-purple/45 to-transparent blur-xs select-none" />

            {/* Active Competitive Rankings Row mapping list */}
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center px-3 font-mono text-[9px] text-[#cbd5e1]/40 font-bold uppercase tracking-widest select-none">
                <span>Dynamic Standings</span>
                <span>Loyalty Points</span>
              </div>

              {remainingCompetitors.map((user, idx) => {
                const currentRank = (user.rank || (idx + 4));
                const isUser = user.name === studentName;
                
                return (
                  <div 
                    key={user.name} 
                    className={`p-3.5 rounded-xl border flex justify-between items-center transition-all ${
                      isUser 
                        ? 'border-brand-purple bg-brand-purple/10 shadow-lg shadow-brand-purple/5'
                        : 'border-white/5 bg-[#171f33]/25 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-zinc-500 w-5 text-center font-bold">{currentRank}</span>
                      <div className="relative shrink-0">
                        <img 
                          alt="" 
                          className={`w-8 h-8 rounded-full border-2 ${user.frameColor || 'border-white/5'} object-cover`} 
                          src={user.avatar}
                          referrerPolicy="no-referrer"
                        />
                        {user.avatarDecoration && (
                          <span className="absolute -top-1.5 -right-1.5 text-[9px] animate-pulse z-20 select-none">{user.avatarDecoration}</span>
                        )}
                      </div>
                      <div>
                        <span className="font-sans text-xs font-bold text-zinc-200 block">{user.name}</span>
                        <span className="font-mono text-[8.5px] text-[#93c5fd] font-bold uppercase tracking-tight">{user.title}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-brand-purple-light font-black block">{user.points.toLocaleString()}</span>
                      <span className="font-mono text-[8px] text-zinc-500 block leading-none">{user.frequency} checkouts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
