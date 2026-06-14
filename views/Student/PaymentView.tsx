/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { 
  ArrowLeft, CreditCard, ShieldCheck, ShoppingBag, 
  Wallet, AlertTriangle, CheckCircle2, RotateCw, 
  Trophy, Sparkles, Star, Percent, Award
} from 'lucide-react';
import { UserProfile } from '../../types';

interface PaymentViewProps {
  profile: UserProfile | null;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export const PaymentView: React.FC<PaymentViewProps> = ({ profile, onBack, onSuccess }) => {
  const {
    cart,
    menuItems,
    getCartTotal,
    walletBalance,
    placeOrder,
    isGuest,
    orders
  } = useApp();

  const [selectedMethod] = useState<'WALLET'>('WALLET');
  const [processingState, setProcessingState] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [processingSubText, setProcessingSubText] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState('');

  // -------------------------------------------------------------
  // JOE POINTS & TIER-BASED DISCOUNT SYSTEM LOGIC
  // Calculates order frequency, active membership tier, and 50% Deca-Drive reward.
  // -------------------------------------------------------------
  const currentFrequency = orders.length;

  let tierName = 'Bronze Foodie';
  let tierDiscountPercent = 0;
  let pointsMultiplier = 1.0;
  let tierColor = 'text-amber-500 border-amber-500/20 bg-amber-500/5';

  if (currentFrequency >= 10) {
    tierName = 'Gold Gastronomer';
    tierDiscountPercent = 10;
    pointsMultiplier = 1.5;
    tierColor = 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5';
  } else if (currentFrequency >= 4) {
    tierName = 'Silver Gourmand';
    tierDiscountPercent = 5;
    pointsMultiplier = 1.2;
    tierColor = 'text-slate-300 border-slate-300/20 bg-slate-300/5';
  }

  // 50% Deca-Drive Milestone check: e.g. every 10th order is 50% off (limit-capped)
  const nextOrderNumber = currentFrequency + 1;
  const isMilestoneOrder = nextOrderNumber % 10 === 0;
  const ordersToNextMilestone = 10 - (currentFrequency % 10);

  let activeDiscountPercent = tierDiscountPercent;
  let isMilestoneApplied = false;
  let discountDetail = `${tierName} tier discount`;

  if (isMilestoneOrder) {
    activeDiscountPercent = 50;
    isMilestoneApplied = true;
    discountDetail = 'Deca-Drive Milestone 50% Off';
  }

  const subtotal = getCartTotal();
  
  // Calculate discount and cap Deca-Drive milestones to preserve profitability for the owner
  let discountAmount = parseFloat(((subtotal * activeDiscountPercent) / 100).toFixed(2));
  if (isMilestoneApplied && discountAmount > 10) {
    discountAmount = 10.00; // Cap saving at ₹10.00 max to keep the kitchen highly profitable
    discountDetail = 'Deca-Drive Milestone 50% Off (Profitability Capped at ₹10)';
  } else if (discountAmount > 0) {
    discountDetail = `${tierName} Flat ${tierDiscountPercent}% Off`;
  }

  const finalTotal = parseFloat(Math.max(0, subtotal - discountAmount).toFixed(2));
  const estimatedPoints = Math.round(finalTotal * 10 * pointsMultiplier);
  const isInsufficient = walletBalance < finalTotal;

  // Compile cart details
  const cartSummary = cart.map(c => {
    const item = menuItems.find(m => m.id === c.id)!;
    return {
      ...item,
      quantity: c.quantity,
      itemTotal: (item?.price || 0) * c.quantity
    };
  });

  const handleCheckoutSubmit = async () => {
    if (selectedMethod === 'WALLET' && isInsufficient) {
      setErrorMessage('Your wallet contains insufficient funds. Please top up your Prepaid account via the Cashier Desk.');
      return;
    }

    setProcessingState('PROCESSING');
    setProcessingSubText('Connecting secure cryptographic channel...');

    // Simulate standard transaction stages
    await new Promise(r => setTimeout(r, 800));
    setProcessingSubText('Authenticating Joe Points & Loyalty engine...');

    await new Promise(r => setTimeout(r, 800));
    setProcessingSubText(`Confirming ${selectedMethod || 'WALLET'} authorization (₹${finalTotal.toFixed(2)})...`);

    await new Promise(r => setTimeout(r, 1000));

    try {
      const res = await placeOrder(selectedMethod, discountAmount, discountDetail);
      if (res.success && res.orderId) {
        setCreatedOrderId(res.orderId);
        setProcessingState('SUCCESS');
        
        // Show success state briefly, then trigger onSuccess route
        setTimeout(() => {
          onSuccess(res.orderId!);
        }, 1500);
      } else {
        setProcessingState('ERROR');
        setErrorMessage(res.error || 'Connection dropped. Please try again.');
      }
    } catch (err: any) {
      setProcessingState('ERROR');
      setErrorMessage(err.message || 'Payment processing failed.');
    }
  };

  if (processingState === 'PROCESSING') {
    return (
      <div className="min-h-screen bg-surface-lowest flex flex-col items-center justify-center p-6 text-center select-none max-w-md mx-auto border-x border-white/5 shadow-2xl">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-brand-purple flex items-center justify-center animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-brand-purple animate-pulse" />
          </div>
        </div>
        <h2 className="font-display text-xl font-bold text-white tracking-tight animate-pulse">
          Processing Gateway
        </h2>
        <p className="font-mono text-xs text-brand-purple-light mt-3">
          {processingSubText}
        </p>
      </div>
    );
  }

  if (processingState === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-surface-lowest flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in max-w-md mx-auto border-x border-white/5 shadow-2xl">
        <div className="w-20 h-20 rounded-full bg-brand-green/10 border border-brand-green/30 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-12 h-12 text-brand-green" />
        </div>
        <h2 className="font-display text-2xl font-black text-white tracking-tight mb-2">
          Payment Processed!
        </h2>
        <p className="font-sans text-xs text-on-surface-variant max-w-xs leading-relaxed mb-6">
          Your wallet transaction is approved. Your receipt holds token cryptographics for live counter tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface max-w-md mx-auto border-x border-white/5 shadow-2xl">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-brand-purple" />
        </button>
        <h1 className="font-display text-lg font-black text-white leading-none">
          Review & Pay
        </h1>
      </header>

      <div className="px-5 mt-4 space-y-6">
        {/* Selected Items summary panel with Loyalty tracker */}
        <section className="glass-bg glass-stroke rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-brand-purple" />
              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                Basket Summary
              </h3>
            </div>
            {/* Active Tier Chip */}
            <div className={`px-2 py-0.5 rounded-md border text-[9px] font-mono font-bold tracking-wider uppercase ${tierColor}`}>
              {tierName}
            </div>
          </div>

          <div className="space-y-3 divide-y divide-white/5 max-h-48 overflow-y-auto pr-1">
            {cartSummary.map((item, idx) => (
              <div key={idx} className="flex gap-3 justify-between items-center pt-2 first:pt-0">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/5">
                    <img className="w-full h-full object-cover" alt={item.name} src={item.imageUrl} />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-xs text-white">{item.name}</h4>
                    <p className="font-mono text-[10px] text-on-surface-variant">
                      ₹{item.price} x {item.quantity}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-brand-purple-light">
                  ₹{item.itemTotal?.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* JOE POINTS & LOYALTY PROGRESS WIDGET */}
          <div className="bg-[#171f33]/60 rounded-xl p-3 border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-400 font-bold tracking-wide flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                LOYALTY TRACKER
              </span>
              <span className="text-[9px] font-mono text-brand-green font-bold">
                FREQUENCY: {currentFrequency} ORDER{currentFrequency !== 1 ? 'S' : ''}
              </span>
            </div>

            {/* Current Multiplier Indicator */}
            <div className="flex items-center justify-between text-[11px] font-sans">
              <span className="text-zinc-300">Point multiplier rate:</span>
              <span className="font-mono font-bold text-[#b76dff]">
                {pointsMultiplier.toFixed(1)}x ({10 * pointsMultiplier} Pts/₹)
              </span>
            </div>

            {/* Deca-Drive Milestone 50% Progress or unlocked banner */}
            {isMilestoneOrder ? (
              <div className="bg-brand-green/10 border border-brand-green/20 p-2 rounded-lg text-center animate-pulse">
                <p className="text-[10px] font-mono text-brand-green font-black tracking-widest uppercase">
                  🎉 DECA-DRIVE UNLOCKED 🎉
                </p>
                <p className="text-[9px] text-zinc-300 font-sans mt-0.5">
                  Your 10th order milestone entitles you to a huge <strong className="text-white">50% discount</strong> (Capped at ₹10 max)!
                </p>
              </div>
            ) : (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 font-bold uppercase">
                  <span>Progress to 50% Off Milestone</span>
                  <span>{10 - ordersToNextMilestone}/10 orders</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-brand-purple to-brand-green transition-all duration-500"
                    style={{ width: `${((10 - ordersToNextMilestone) / 10) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 font-sans text-right">
                  Only <strong className="text-brand-purple-light font-bold">{ordersToNextMilestone} more order{ordersToNextMilestone > 1 ? 's' : ''}</strong> left to unlock 50% discount!
                </p>
              </div>
            )}
          </div>

          {/* Checkout pricing math rows */}
          <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[#94a3b8]">
              <span>Cart Subtotal:</span>
              <span className="font-mono text-white">₹{subtotal.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-brand-green bg-brand-green/5 p-1.5 rounded-lg border border-brand-green/10 font-mono text-[11px]">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  Discount ({discountDetail}):
                </span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-brand-purple-light bg-brand-purple/5 p-1.5 rounded-lg border border-brand-purple/10 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Points projection ({pointsMultiplier.toFixed(1)}x):
              </span>
              <span>+{estimatedPoints} Joe Points</span>
            </div>

            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="font-sans text-xs font-bold text-[#e2e8f0]">Grand Total:</span>
              <span className="font-mono text-md font-black text-white">
                ₹{finalTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* Method payment choices */}
        <section className="space-y-3">
          <h3 className="font-display font-extrabold text-sm text-white">Choose Payment Method</h3>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Wallet Selector Card */}
            <div
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                isInsufficient
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'border-brand-purple bg-brand-purple/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isInsufficient ? 'bg-red-500/10 text-red-400' : 'bg-brand-purple/10 text-brand-purple'
                }`}>
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-xs text-white">JOE Digital Wallet</h4>
                  <p className="font-mono text-[10px] text-zinc-400">
                    Current Balance: <strong className={isInsufficient ? 'text-red-400 font-black' : 'text-brand-green font-black'}>
                      ₹{walletBalance.toFixed(2)}
                    </strong>
                  </p>
                </div>
              </div>
 
              {isInsufficient ? (
                <span className="bg-red-500/20 text-red-400 text-[8px] font-mono font-black px-2 py-0.5 rounded-full uppercase">
                  INSUFFICIENT
                </span>
              ) : (
                <span className="bg-brand-green/20 text-brand-green text-[8px] font-mono font-black px-2 py-0.5 rounded-full uppercase">
                  ACTIVE
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Error indicators */}
        {errorMessage && (
          <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl flex gap-2 items-start shrink-0 select-none">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-sans text-xs text-red-200 leading-normal">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Main Processing Actions */}
        <button
          onClick={handleCheckoutSubmit}
          disabled={(isInsufficient && selectedMethod === 'WALLET') || ((processingState as string) === 'PROCESSING')}
          type="button"
          className="w-full h-14 rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs tracking-wider font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
        >
          <ShieldCheck className="w-4.5 h-4.5" />
          AUTHORIZE PAYMENT (₹{finalTotal.toFixed(2)})
        </button>
      </div>
    </div>
  );
};

export default PaymentView;
