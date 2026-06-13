/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, CheckCircle2, ArrowLeft, RefreshCw, Sparkles, HelpCircle } from 'lucide-react';

interface QRViewProps {
  onBackToMenu: () => void;
}

export const QRView: React.FC<QRViewProps> = ({ onBackToMenu }) => {
  const {
    orders,
    activeOrderTrackId,
    menuItems,
    setStudentTab,
    updateOrderStatus
  } = useApp();

  // Find the active tracking order
  const order = orders.find(o => o.id === activeOrderTrackId) || orders[0];

  const [tickerTime, setTickerTime] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  // Anti-screenshot moving milliseconds timer
  useEffect(() => {
    let active = true;
    const updateTime = () => {
      if (!active) return;
      const now = new Date();
      const secs = now.getSeconds().toString().padStart(2, '0');
      const ms = Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0');
      setTickerTime(`SECURE TICKET SECS: ${secs}:${ms}`);
      requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => { active = false; };
  }, []);

  // Back to menu redirect when served completes
  useEffect(() => {
    if (order && order.status === 'SERVED') {
      const timer = setTimeout(() => {
        onBackToMenu();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [order, onBackToMenu]);

  if (!order) {
    return (
      <div className="min-h-screen bg-surface-lowest flex flex-col items-center justify-center p-6 text-center text-on-surface">
        <Sparkles className="w-12 h-12 text-brand-purple mb-4 animate-spin" />
        <h3 className="font-display text-lg font-bold">No active tokens</h3>
        <p className="font-sans text-xs text-on-surface-variant max-w-xs mt-1">
          You do not have any pending or ready orders to track.
        </p>
        <button
          onClick={onBackToMenu}
          className="mt-6 px-5 py-2.5 bg-brand-purple text-surface-lowest font-mono text-xs font-bold rounded-full cursor-pointer"
        >
          BROWSE MENU
        </button>
      </div>
    );
  }

  // Get selected item details
  const currentItem = order.items[selectedItemIndex] || order.items[0];
  const currentItemDetail = menuItems.find(m => m.id === currentItem?.menuItemId);

  // Determine indicator color theme for glows
  const getColorCategory = (cat: string) => {
    if (cat === 'BREAKFAST') return { bg: 'border-brand-purple', glow: 'neon-shadow-purple text-brand-purple-light' };
    if (cat === 'LUNCH') return { bg: 'border-brand-green', glow: 'neon-shadow-green text-brand-green' };
    if (cat === 'DRINKS') return { bg: 'border-blue-400', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.3)] text-blue-300' };
    return { bg: 'border-purple-400', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.3)] text-purple-300' };
  };

  const styleSettings = currentItemDetail ? getColorCategory(currentItemDetail.category) : { bg: 'border-brand-purple', glow: 'neon-shadow-purple border-brand-purple' };

  const isCurrentItemServed = order.collectedItems[currentItem?.menuItemId] || order.status === 'SERVED';
  const isOrderPreparing = order.status === 'QUEUED' || order.status === 'COOKING';

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* App Bar Bar Header */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-brand-purple" />
          </button>
          <div className="flex flex-col">
            <span className="font-mono text-[9px] tracking-widest text-brand-purple-light">ACTIVE SERVINGS</span>
            <h1 className="font-display font-black text-white text-md">Token QR</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-surface-high border border-white/5 px-4 py-1.5 rounded-full select-none">
          <span className="font-mono text-xs font-black text-brand-green-sub tracking-widest text-brand-green">
            {order.tokenNumber}
          </span>
        </div>
      </header>

      {/* Main token display */}
      <main className="px-5 mt-6 space-y-6 max-w-lg mx-auto">
        {/* Carousel indicator row of items dots */}
        {order.items.length > 1 && (
          <section className="space-y-2">
            <p className="font-mono text-[9px] text-on-surface-variant text-center tracking-widest uppercase">
              Tapping indexes switch token codes
            </p>
            <div className="flex justify-center gap-2.5 py-1 bg-surface-high/30 rounded-2xl border border-white/5 p-2">
              {order.items.map((it, idx) => {
                const details = menuItems.find(m => m.id === it.menuItemId);
                const isServed = order.collectedItems[it.menuItemId] || order.status === 'SERVED';
                return (
                  <button
                    key={it.menuItemId}
                    onClick={() => setSelectedItemIndex(idx)}
                    className={`px-3 py-1.5 rounded-full border text-xs font-mono font-medium flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer ${
                      selectedItemIndex === idx
                        ? 'border-brand-purple bg-brand-purple/10 text-brand-purple-light'
                        : 'border-white/5 bg-white/5 hover:bg-white/10 text-on-surface-variant'
                    }`}
                  >
                    <span>{details?.name.split(' ')[0]}</span>
                    {isServed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-green font-black" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Token Card Base */}
        <section className="flex flex-col items-center">
          <div className={`p-4 rounded-3xl bg-surface-mid w-full max-w-[320px] aspect-[0.88/1] flex flex-col justify-between border-2 transition-all relative overflow-hidden ${styleSettings.bg} ${styleSettings.glow}`}>
            
            {/* Countdown seconds milliseconds ticker */}
            <div className="flex justify-between items-center bg-surface-lowest/50 backdrop-blur-md border border-white/5 px-3 py-1 rounded-full z-10 w-full">
              <span className="font-mono text-[8px] font-black tracking-widest text-brand-purple-light">
                {tickerTime}
              </span>
              <RefreshCw className="w-2.5 h-2.5 text-brand-purple animate-spin" />
            </div>

            {/* Simulated QR block code or locker block states */}
            <div className="relative w-full aspect-square flex items-center justify-center p-3 z-10 select-none bg-white rounded-2xl shadow-inner shadow-black">
              {isCurrentItemServed ? (
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <div className="w-16 h-16 rounded-full bg-brand-green/10 border border-brand-green flex items-center justify-center mb-2 animate-bounce">
                    <CheckCircle2 className="w-10 h-10 text-brand-green" />
                  </div>
                  <span className="font-display font-black text-surface-lowest uppercase text-sm">
                    Handover Complete!
                  </span>
                  <span className="font-sans text-[10px] text-zinc-500 mt-0.5">
                    Hope to see you soon
                  </span>
                </div>
              ) : isOrderPreparing ? (
                // Locked Kitchen block interface view
                <div className="absolute inset-0 bg-surface-lowest/90 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center p-4 rounded-2xl">
                  <div className="w-11 h-11 rounded-full bg-brand-purple-dark/30 border border-brand-purple/40 flex items-center justify-center mb-2">
                    <Lock className="w-5 h-5 text-brand-purple" />
                  </div>
                  <h4 className="font-display font-bold text-xs text-brand-purple-light uppercase text-center tracking-wider leading-relaxed">
                    Preparing Your Food
                  </h4>
                  <p className="font-sans text-[9px] text-on-surface-variant max-w-[80%] text-center leading-normal mt-1">
                    Your QR pickup token blurs until the chef marks items <strong className="text-brand-green uppercase">READY</strong>.
                  </p>
                </div>
              ) : (
                // Full functional glowing QR code display
                <div className="relative w-full h-full p-2 bg-white flex items-center justify-center rounded-xl overflow-hidden shadow-inner">
                  <img
                    className="w-full h-full object-contain"
                    alt="Pickup Code QR"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCe0LcsCDMcen5LM_o_LTfSI2U9r9eF-UDAi9HGxY_I9m6Lhc6K6MzrSAKJsNdE3LBwXgtfdXG4DDGKBjUhnC8hxxXEiAm59nxKDnVsouc6WiPbt9Cx7mRit-SU3DYd8lLa0cyM9PXN74fCqcZEn_17yyc1q3eSVBq8y1p3--ioBDAf2U6PdsMYUeRUohvg_yja6vltAHouw9SEzmu188USRDCP76V-LTN4o1BAJ_Q6oCAo_iFnkQpBhGbw9Yl0rNAFs_DWrqN42oU"
                  />
                  {/* Sliding green laser scanning line beam */}
                  <div className="absolute left-0 right-0 h-0.5 bg-brand-green shadow-[0_0_8px_#4ae176] animate-[scan_3.5s_infinite_ease-in-out]" />
                </div>
              )}
            </div>

            {/* Bottom branding footer inside card */}
            <div className="text-center z-10 w-full pt-1.5 border-t border-white/5 font-mono text-[8.5px] text-on-surface-variant select-none">
              VERIFIED TICKET COMS • DIGITAL PILOT NO# 8842
            </div>

          </div>
        </section>

        {/* Selected item spec info details details */}
        <section className="glass-bg glass-stroke p-4 rounded-2xl flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-mid shrink-0">
            <img className="w-full h-full object-cover" alt={currentItem?.name} src={currentItemDetail?.image} />
          </div>
          <div className="flex-grow">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[9px] text-brand-purple tracking-widest uppercase">
                {currentItemDetail?.category}
              </span>
              <span className="font-mono text-xs text-brand-green font-bold">
                Status: {order.status}
              </span>
            </div>
            <h3 className="font-display font-extrabold text-xs text-white">
              {currentItem?.quantity}x {currentItem?.name}
            </h3>
            <p className="font-sans text-[10px] text-on-surface-variant">
              Total price: ${(currentItem?.price * currentItem?.quantity).toFixed(2)}
            </p>
          </div>
        </section>

        {/* Informative Help support widgets */}
        <div className="text-center">
          {order.status === 'SERVED' ? (
            <p className="font-sans text-xs text-brand-green-sub text-brand-green animate-pulse">
              🎉 <strong>Handover complete!</strong> Toggling back to menu in 3 seconds...
            </p>
          ) : (
            <p className="font-sans text-[11px] text-on-surface-variant max-w-[85%] mx-auto">
              Present this code at the serving counter scanner to authorise and release your food.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};
