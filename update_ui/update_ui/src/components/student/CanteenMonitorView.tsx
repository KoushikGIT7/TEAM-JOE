/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Trophy, Tv, Clock, Sparkles, Volume2, VolumeX, ArrowLeft,
  Utensils, CheckCircle, Flame, Shield, Play, Percent, Gift,
  TrendingUp, Award, Zap, Bell, Sparkle
} from 'lucide-react';

interface SimulatedLivePromoEvent {
  id: string;
  studentName: string;
  type: 'TIER_UP' | 'GACHA_WIN' | 'MILESTONE' | 'STREAK';
  detail: string;
  pointsEarned?: number;
  highlightText: string;
  timestamp: string;
}

export const CanteenMonitorView: React.FC = () => {
  const { leaderboardUsers, setPortalMode, orders } = useApp();
  const [speakAlerts, setSpeakAlerts] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time clock for top-tier corporate digital signage feel
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Simulated live cafeteria activity list to induce FOMO and make students order more
  const [livePromoFeed, setLivePromoFeed] = useState<SimulatedLivePromoEvent[]>([
    {
      id: 'e1',
      studentName: 'Priya Sharma',
      type: 'GACHA_WIN',
      detail: 'opened Cyber-Loot Chest',
      highlightText: 'Won 50% OFF Masala Chai!',
      pointsEarned: 150,
      timestamp: 'Just now'
    },
    {
      id: 'e2',
      studentName: 'Rahul Kapur',
      type: 'TIER_UP',
      detail: 'promoted to Gold Gastronomer',
      highlightText: 'Unlocked 1.5x Multiplier!',
      pointsEarned: 500,
      timestamp: '2 mins ago'
    },
    {
      id: 'e3',
      studentName: 'Aisha Rao',
      type: 'MILESTONE',
      detail: 'hit 10th Deca-Drive Order',
      highlightText: 'Claimed 50% OFF Flat Coupon!',
      pointsEarned: 250,
      timestamp: '5 mins ago'
    },
    {
      id: 'e4',
      studentName: 'Siddharth Sen',
      type: 'STREAK',
      detail: 'unlocked 12-Day Heat streak',
      highlightText: 'Earned +500 XP!',
      pointsEarned: 120,
      timestamp: '8 mins ago'
    },
    {
      id: 'e5',
      studentName: 'Sneha Patel',
      type: 'GACHA_WIN',
      detail: 'opened Cosmic Chest',
      highlightText: 'Won 30% OFF Oreo Shake!',
      pointsEarned: 80,
      timestamp: '12 mins ago'
    }
  ]);

  // Periodic simulation of new student promotional occurrences (every 14 seconds)
  useEffect(() => {
    const studentNames = [
      'Vikram Johar', 'Meera Soni', 'Kabir Lal', 'Ananya Roy', 'Rohan Das', 
      'Tanya Mehta', 'Rishi Verma', 'Diya Kapoor', 'Aditya Nair', 'Neha Gill'
    ];
    
    const events: Array<{
      type: 'TIER_UP' | 'GACHA_WIN' | 'MILESTONE' | 'STREAK';
      detail: string;
      highlightText: string;
      pointsEarned: number;
    }> = [
      {
        type: 'GACHA_WIN',
        detail: 'unlocked a Cozy-Eats coupon',
        highlightText: 'Won 40% OFF Schezwan Maggi!',
        pointsEarned: 120
      },
      {
        type: 'TIER_UP',
        detail: 'promoted to Silver Gourmand',
        highlightText: 'Unlocked 1.2x Booster!',
        pointsEarned: 300
      },
      {
        type: 'STREAK',
        detail: 'ordered 5 days in a row',
        highlightText: 'Earned Healthy Hero Badge!',
        pointsEarned: 200
      },
      {
        type: 'MILESTONE',
        detail: 'completed order gacha tier',
        highlightText: 'Won free Samosa Ticket!',
        pointsEarned: 180
      },
      {
        type: 'GACHA_WIN',
        detail: 'opened a Golden Chest',
        highlightText: 'Won 50% OFF Cold Coffee!',
        pointsEarned: 220
      }
    ];

    const interval = setInterval(() => {
      const randomName = studentNames[Math.floor(Math.random() * studentNames.length)];
      const randomEv = events[Math.floor(Math.random() * events.length)];
      const uniqueId = 'e_rand_' + Date.now().toString();

      const newEvent: SimulatedLivePromoEvent = {
        id: uniqueId,
        studentName: randomName,
        type: randomEv.type,
        detail: randomEv.detail,
        highlightText: randomEv.highlightText,
        pointsEarned: randomEv.pointsEarned,
        timestamp: 'Just now'
      };

      // Speak live mock audio alert about canteen achievements (pure hype generation!)
      if (speakAlerts) {
        const synth = window.speechSynthesis;
        if (synth) {
          let phrase = '';
          if (randomEv.type === 'GACHA_WIN') {
            phrase = `Congratulations to ${randomName} for winning a 40 percent discount coupon!`;
          } else if (randomEv.type === 'TIER_UP') {
            phrase = `${randomName} has just leveled up to a premium canteen tier with increased points!`;
          } else {
            phrase = `Hype alert! ${randomName} just earned a cool reward in the Cse Canteen Loyalty program!`;
          }
          const utterance = new SpeechSynthesisUtterance(phrase);
          utterance.rate = 1.0;
          utterance.pitch = 1.1;
          synth.speak(utterance);
        }
      }

      setLivePromoFeed(prev => {
        // Update previous 'Just now' to '1 min ago' etc
        const updated = prev.map(ev => {
          if (ev.timestamp === 'Just now') return { ...ev, timestamp: '1 min ago' };
          if (ev.timestamp === '1 min ago') return { ...ev, timestamp: '3 mins ago' };
          if (ev.timestamp === '2 mins ago') return { ...ev, timestamp: '4 mins ago' };
          if (ev.timestamp === '3 mins ago') return { ...ev, timestamp: '6 mins ago' };
          return ev;
        });
        return [newEvent, ...updated.slice(0, 4)];
      });
    }, 14000);

    return () => clearInterval(interval);
  }, [speakAlerts]);

  // Rolling promotional taglines for bottom ticker banner
  const tickerStories = [
    "🔥 DECA-DRIVE SYSTEM: Get 50% OFF automatically on every 10th order you authorize! High loyalty, maximum savings!",
    "🚀 BYPASS CELL CHAOS: Setup your pre-funded secure CSE-Wallet. Order from your classroom and simply collect your food!",
    "⭐ THE POINT MULTIPLIER: Gold Gastronomer tier gives you a 1.5x points multiplier + 10% Flat off absolutely everything!",
    "🎁 UNLOCK THE LOOT CHEST: Charge your crystal energy node with 3 order checkouts to earn random custom coupon spins!",
    "🏆 BRAGGING RIGHTS: Earn XP, rise through the Campus Elite Leaderboards, and get praised on the live cafeteria widescreen!"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % tickerStories.length);
    }, 8500);
    return () => clearInterval(interval);
  }, [tickerStories.length]);

  return (
    <div className="min-h-screen bg-[#070b13] text-[#f4f4f5] font-sans flex flex-col justify-between overflow-x-hidden relative p-5 lg:p-7">
      
      {/* Dynamic Futuristic Neon Visual Background Elements */}
      <div className="absolute top-0 left-10 w-[35rem] h-[35rem] bg-brand-purple/5 rounded-full blur-[12rem] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[40rem] h-[30rem] bg-teal-500/5 rounded-full blur-[14rem] pointer-events-none" />
      <div className="absolute bottom-5 left-1/3 w-[30rem] h-[25rem] bg-brand-green/5 rounded-full blur-[10rem] pointer-events-none" />

      {/* Grid Monitor Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-4 mb-6 relative z-10 gap-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-xl lg:text-2xl tracking-wider uppercase text-white">
              CSE'S REWARDS STATION
            </h1>
            <span className="text-[9px] bg-brand-purple/20 text-brand-purple-light border border-brand-purple/20 px-2.5 py-0.5 rounded-full font-mono uppercase font-black tracking-widest animate-pulse">
              PROMOTIONS Live
            </span>
          </div>
          <p className="font-sans text-xs text-[#cbd5e1]/75 mt-1">
            Order on the Mobile App, skip the counter queue, and climb loyalty tiers to unlock up to 50% off!
          </p>
        </div>

        {/* Real-time Ticking Signage Clock & Live Feed Indicator */}
        <div className="flex items-center gap-4 text-right self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </span>
            <span className="font-mono text-[9px] text-[#cbd5e1]/45 uppercase tracking-widest font-bold">
              Broadcasting Live
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
            <Clock className="w-3.5 h-3.5 text-brand-purple-light" />
            <span className="font-mono text-xs font-bold text-white tracking-wider">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </header>

      {/* Main 3-Column Promos Highlight Board */}
      <main className="grid grid-cols-12 gap-6 flex-grow relative z-10 items-stretch">
        
        {/* COLUMN 1: THE CSE POINTS REWARDS PROGRAM DECK (Span 4) */}
        <section className="col-span-12 lg:col-span-4 bg-[#0a1122]/55 border border-white/5 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 select-none">
                <Shield className="w-5 h-5 text-brand-purple" />
                <h2 className="font-display font-black text-xs tracking-wider uppercase text-[#f4f4f5]">
                  LOYALTY MECHANICS ⚡
                </h2>
              </div>
              <span className="font-mono text-[8px] bg-brand-purple/10 border border-brand-purple/20 text-brand-purple-light px-2 py-0.5 rounded-full font-bold">
                100% REAL MARGINS
              </span>
            </div>

            {/* Loyalty tier roadmap card */}
            <div className="space-y-3">
              <p className="font-sans text-[11px] text-zinc-400 leading-relaxed">
                Why purchase the traditional way when you can climb tiers, rack up <strong className="text-white">Cse Points</strong> automatically, and bypass queues seamlessly?
              </p>

              {/* Tier Cards Row */}
              <div className="space-y-2.5">
                {/* Bronze */}
                <div className="p-3 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center relative overflow-hidden">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-widest font-extrabold leading-none">Starting Tier</span>
                    <h4 className="font-display text-xs font-black text-orange-400">Bronze Foodie</h4>
                    <p className="font-sans text-[10px] text-zinc-400 leading-tight">Every $1 spent earns 10 Cse Points</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[9px] font-bold text-zinc-400 bg-white/5 px-2 py-1 rounded-lg uppercase">1.0x Rate</span>
                  </div>
                </div>

                {/* Silver */}
                <div className="p-3 bg-[#1e1b4b]/20 border border-violet-500/20 rounded-2xl flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-violet-500/5 rounded-full blur-lg pointer-events-none" />
                  <div className="space-y-0.5">
                    <span className="font-mono text-[8px] text-violet-400 uppercase tracking-widest font-bold leading-none">Requires 4 Orders</span>
                    <h4 className="font-display text-xs font-black text-violet-400">Silver Gourmand</h4>
                    <p className="font-sans text-[10px] text-zinc-400 leading-tight">Unlocked benefit: <strong className="text-white">5% Flat Off</strong> orders</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[9px] font-black text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-lg uppercase">1.2x Rate</span>
                  </div>
                </div>

                {/* Gold */}
                <div className="p-3 bg-[#14532d]/10 border border-[#10b981]/25 rounded-2xl flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-brand-green/5 rounded-full blur-lg pointer-events-none" />
                  <div className="space-y-0.5">
                    <span className="font-mono text-[8px] text-brand-green font-bold leading-none uppercase tracking-widest">Requires 10 Orders</span>
                    <h4 className="font-display text-xs font-black text-brand-green">Gold Gastronomer</h4>
                    <p className="font-sans text-[10px] text-zinc-400 leading-tight">Unlocked benefit: <strong className="text-white">10% Flat Off</strong> orders</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[9px] font-black text-brand-green bg-brand-green/10 border border-[#10b981]/20 px-2 py-1 rounded-lg uppercase">1.5x Rate</span>
                  </div>
                </div>
              </div>

              {/* Deca-Drive highlight Box */}
              <div className="p-4 bg-gradient-to-r from-brand-purple/10 to-brand-green/10 rounded-2xl border border-white/5 space-y-1.5 relative overflow-hidden">
                <div className="absolute -right-3 -bottom-3 text-4xl opacity-15 select-none pointer-events-none font-black">
                  🔥
                </div>
                <div className="flex items-center gap-1.5">
                  <Percent className="w-4 h-4 text-brand-green animate-pulse" />
                  <span className="font-display text-xs font-black text-brand-green uppercase tracking-wide">
                    🎁 DECA-DRIVE DECENTRALIZED REWARD
                  </span>
                </div>
                <p className="font-sans text-[10px] text-zinc-300 leading-relaxed">
                  Every <strong className="text-white">10th authorized purchase</strong> trigger automatic <strong className="text-brand-green">50% discount</strong>! No complex coupon key setups—our app calculates order frequency natively.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Summary Banner */}
          <div className="p-3 bg-white/5 border border-white/5 rounded-2xl space-y-2 mt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-purple-light" />
              <span className="font-mono text-[9px] text-[#cbd5e1] font-bold uppercase tracking-wider">Canteen Loyalty Progress</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-zinc-400 font-sans text-[10px]">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="block text-white font-extrabold font-mono text-xs">93%</span>
                <span>Active adoption rate</span>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <span className="block text-white font-extrabold font-mono text-xs">24,500+</span>
                <span>Total Cse Points issued</span>
              </div>
            </div>
          </div>
        </section>

        {/* COLUMN 2: LIVE CAFETIERA ACHIEVEMENT FEED (FOMO DRIVER) (Span 4) */}
        <section className="col-span-12 lg:col-span-4 bg-[#0a1122]/55 border border-white/5 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
          <div className="flex flex-col flex-grow">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 select-none shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-teal-400 animate-swing" />
                <h2 className="font-display font-black text-xs tracking-wider uppercase text-[#f4f4f5]">
                  Live Activity Broadcast ⚡
                </h2>
              </div>
              <span className="font-mono text-[8px] bg-[#10b981]/15 text-[#10b981] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold animate-pulse">
                HYPE LIVE FEED
              </span>
            </div>

            {/* Dynamic feed of wins and level ups */}
            <div className="space-y-3 flex-grow overflow-y-auto pr-1 hide-scrollbar">
              {livePromoFeed.map((ev, idx) => {
                let badgeColor = 'bg-brand-purple/10 text-brand-purple-light border-brand-purple/20';
                if (ev.type === 'TIER_UP') badgeColor = 'bg-violet-500/10 text-violet-400 border-violet-500/20';
                if (ev.type === 'MILESTONE') badgeColor = 'bg-yellow-400/10 text-yellow-500 border-yellow-400/20';
                if (ev.type === 'STREAK') badgeColor = 'bg-[#10b981]/15 text-brand-green border-[#10b981]/25';

                return (
                  <div 
                    key={ev.id} 
                    className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between gap-3 animate-fade-in hover:border-white/10 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-xs font-black text-white shrink-0">
                          {ev.studentName}
                        </span>
                        <span className="font-sans text-[10px] text-zinc-400">
                          {ev.detail}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-brand-green font-bold">
                        {ev.highlightText}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-[8px] text-zinc-500 block">
                        {ev.timestamp}
                      </span>
                      {ev.pointsEarned && (
                        <span className="font-mono text-[9px] text-brand-purple-light font-bold mt-1 block">
                          +{ev.pointsEarned} PTS
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prompt banner to get other students to scan and download */}
          <div className="mt-4 p-4 bg-gradient-to-r from-teal-500/10 to-transparent rounded-2xl border border-teal-500/20 flex gap-3.5 items-center select-none shrink-0 justify-between">
            <div className="space-y-0.5">
              <span className="font-mono text-[8px] text-teal-400 uppercase tracking-widest font-extrabold leading-none">Canteen QR Ordering Quick Scan</span>
              <p className="font-display font-black text-[11px] text-[#f4f4f5] pt-0.5">
                WANT TO BE ON DECK? 🚀
              </p>
              <p className="font-sans text-[9px] text-zinc-400">
                Authorized checkouts instantly trigger points and list credits.
              </p>
            </div>
            
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1 cursor-pointer hover:scale-105 duration-200 shadow-md">
              <div className="w-10 h-10 border-2 border-black flex flex-wrap p-0.5">
                <div className="w-3.5 h-3.5 bg-black m-0.5"></div>
                <div className="w-3.5 h-3.5 m-0.5"></div>
                <div className="w-3.5 h-3.5 m-0.5"></div>
                <div className="w-3.5 h-3.5 bg-black m-0.5"></div>
              </div>
            </div>
          </div>
        </section>

        {/* COLUMN 3: GLOBAL CANTEEN FOODIES LEADERBOARD (competitive bragging rights) (Span 4) */}
        <section className="col-span-12 lg:col-span-4 bg-[#0a1122]/55 border border-white/5 rounded-3xl p-5 flex flex-col justify-between min-h-[500px]">
          <div className="space-y-4 flex flex-col flex-grow">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 select-none">
                <Trophy className="w-5 h-5 text-[#fbbf24] animate-pulse" />
                <h2 className="font-display font-black text-xs tracking-wider uppercase text-[#f4f4f5]">
                  Campus food elites 🏆
                </h2>
              </div>
              <span className="font-mono text-[7px] bg-[#fbbf24]/10 border border-[#fbbf24]/20 text-[#fbbf24] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                BRAGGING RIGHTS
              </span>
            </div>

            {/* Leaderboard Competitors */}
            <div className="space-y-2.5 flex-grow overflow-y-auto pr-1 hide-scrollbar">
              {leaderboardUsers.slice(0, 5).map((user, idx) => {
                const colors = [
                  'border-yellow-400/40 bg-yellow-400/5', 
                  'border-slate-300/30 bg-slate-100/5', 
                  'border-amber-600/30 bg-amber-600/5', 
                  'border-white/5 bg-white/5', 
                  'border-white/5 bg-white/5'
                ];
                const tColor = ['text-yellow-400', 'text-slate-300', 'text-amber-600', 'text-zinc-400', 'text-zinc-400'];
                
                return (
                  <div 
                    key={user.name} 
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-transform duration-300 hover:scale-[1.01] ${colors[idx] || 'border-white/5 bg-white/5'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Rank indicator node */}
                      <div className={`w-6 h-6 rounded-lg font-mono text-[11px] font-black flex items-center justify-center shrink-0 border border-white/5 bg-black/40 ${tColor[idx] || 'text-[#cbd5e1]'}`}>
                        #{idx + 1}
                      </div>

                      <img 
                        src={user.avatar} 
                        alt="" 
                        className="w-8 h-8 rounded-full border border-white/10 shrink-0 select-none object-cover"
                        referrerPolicy="no-referrer"
                      />

                      <div>
                        <div className="flex items-center gap-1">
                          <h4 className="font-sans text-[11px] font-black text-white leading-none">
                            {user.name}
                          </h4>
                        </div>
                        <span className="font-mono text-[9px] text-teal-400 leading-none mt-1 block">
                          {user.title} • LVL {user.level}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono text-xs font-black text-brand-purple-light block">
                        {user.points.toLocaleString()} PTS
                      </span>
                      <span className="font-mono text-[8px] text-[#cbd5e1]/45 font-extrabold uppercase tracking-widest block leading-none mt-0.5">
                        {user.frequency} CHECKOUTS
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Campaign Loot Gacha Highlight */}
          <div className="mt-4 p-3.5 bg-brand-green/5 border border-brand-green/20 rounded-2xl flex items-center gap-3 shrink-0">
            <Sparkles className="w-5 h-5 text-brand-green animate-pulse shrink-0" />
            <div>
              <p className="font-display font-black text-[10px] text-zinc-200">
                CYBER-LOOT CHEST SPAWNING 🎁
              </p>
              <p className="font-sans text-[9px] text-zinc-400 mt-0.5 leading-tight">
                Unlock safe margins and crazy discounts. Load money into your CSE WALLET, check out daily, and claim rare coupon wins on this screen!
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER TICKER - Rolling ticker strip */}
      <footer className="mt-6 font-mono text-[10px] bg-brand-purple/5 border border-brand-purple/25 text-[#93c5fd] rounded-2xl p-3.5 select-none relative overflow-hidden shrink-0 flex items-center gap-3.5">
        <span className="bg-[#1d4ed8] text-white px-2 py-0.5 rounded font-black uppercase tracking-wider shrink-0 text-[8px]">
          LIVE BULLETINS
        </span>
        <p className="flex-grow tracking-wide transition-all duration-500 pr-5">
          {tickerStories[tickerIndex]}
        </p>
        <span className="text-zinc-500 text-[8px] tracking-wider font-extrabold uppercase shrink-0">
          PROMO CLUSTER • ACTIVE
        </span>
      </footer>

      {/* Subtle Control overlay at bottom right for convenient testing/admin control */}
      <div className="fixed bottom-3 right-4 z-50 flex items-center gap-1.5 opacity-25 hover:opacity-100 transition-opacity">
        <button
          onClick={() => setPortalMode('STUDENT')}
          className="px-2.5 py-1 rounded bg-black/80 hover:bg-black text-[9px] font-mono font-bold text-zinc-400 hover:text-white border border-white/10 flex items-center gap-1 cursor-pointer transition-colors shadow-lg"
        >
          <ArrowLeft className="w-2.5 h-2.5" />
          <span>EXIT MONITOR TV</span>
        </button>
        <button
          onClick={() => setSpeakAlerts(!speakAlerts)}
          className={`px-2.5 py-1 rounded bg-black/80 text-[9px] font-mono font-bold border flex items-center gap-1 cursor-pointer transition-colors shadow-lg ${
            speakAlerts ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10' : 'border-white/10 text-zinc-400'
          }`}
        >
          {speakAlerts ? <Volume2 className="w-2.5 h-2.5" /> : <VolumeX className="w-2.5 h-2.5" />}
          <span>SPEAKER: {speakAlerts ? "ON" : "OFF"}</span>
        </button>
      </div>

    </div>
  );
};
