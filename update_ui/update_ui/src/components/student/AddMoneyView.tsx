/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ArrowLeft, Copy, Upload, AlertTriangle, CheckCircle2, 
  Sparkles, DollarSign, Image as ImageIcon 
} from 'lucide-react';

interface AddMoneyViewProps {
  onBackToWallet: () => void;
}

export const AddMoneyView: React.FC<AddMoneyViewProps> = ({ onBackToWallet }) => {
  const {
    submitRechargeRequest,
    rechargeRequests,
    settings
  } = useApp();

  const [amount, setAmount] = useState<number>(20);
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotSelected, setScreenshotSelected] = useState(false);
  const [screenshotName, setScreenshotName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const hasPending = rechargeRequests.some(r => r.status === 'PENDING');

  const copyUpiId = () => {
    navigator.clipboard.writeText(settings.upiId);
    setCopied(true);
    setTimeout(() => {setCopied(false);}, 2000);
  };

  const amountChips = [10, 20, 50, 100];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshotSelected(true);
      setScreenshotName(e.target.files[0].name);
    }
  };

  const triggerUploadSubmit = () => {
    if (utrNumber.trim().length === 0) {
      alert('Please enter a valid Transaction Ref or UTR number.');
      return;
    }
    if (!screenshotSelected) {
      alert('Please attach your digital UPI receipt screenshot.');
      return;
    }

    submitRechargeRequest(amount, utrNumber);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-surface-lowest flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-brand-green/10 border border-brand-green flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-brand-green" />
        </div>
        <h3 className="font-display text-xl font-extrabold text-white tracking-tight">Recharge Request Sent!</h3>
        <p className="font-sans text-xs text-on-surface-variant max-w-xs mt-2 leading-relaxed">
          Your recharge receipt is successfully queued. Cashiers will verify your UTR atomically. Funds will reflect in your secure wallet shortly.
        </p>
        <button
          onClick={onBackToWallet}
          className="mt-6 px-6 h-12 rounded-full bg-brand-purple hover:bg-brand-purple-light text-surface-lowest font-mono text-xs font-bold tracking-widest cursor-pointer"
        >
          GO BACK TO WALLET
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <button
          onClick={onBackToWallet}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-brand-purple" />
        </button>
        <div className="flex flex-col">
          <span className="font-mono text-[9px] tracking-widest text-brand-purple-light select-none font-bold">
            RECHARGE GATEWAY TERMINAL
          </span>
          <h1 className="font-display text-lg font-black text-white leading-none">
            Add Prepaid Funds
          </h1>
        </div>
      </header>

      {/* Main Form container */}
      <main className="px-5 mt-4 space-y-5 max-w-lg mx-auto">
        {hasPending && (
          <div className="p-3 bg-brand-purple-dark/15 border border-brand-purple/20 text-brand-purple-light rounded-xl flex items-center gap-2 select-none">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
            <p className="font-sans text-[11.5px] leading-snug">
              ⚠️ You have an active request pending approval. Please wait for verifications before queuing any additional requests.
            </p>
          </div>
        )}

        {/* Step 1: Pay to UPI QR details */}
        <section className="glass-bg glass-stroke rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="font-mono font-black text-[10px] bg-brand-purple/20 text-brand-purple-light px-2 py-0.5 rounded-md">
              STEP 1
            </span>
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
              UPI Address / QR code
            </h3>
          </div>

          <div className="flex gap-4 items-center bg-surface-lowest/50 p-3 rounded-xl border border-white/5">
            <div className="w-24 h-24 bg-white p-1 rounded-xl shrink-0">
              <img className="w-full h-full object-contain" alt="UPI Merchant QR Code" src={settings.upiQrCode} />
            </div>
            <div className="space-y-2 flex-grow">
              <div className="space-y-0.5">
                <span className="font-mono text-[8px] text-[#94a3b8] tracking-wider uppercase">
                  OFFICIAL INTEGRATORS
                </span>
                <h4 className="font-display font-extrabold text-xs text-white">JOE Cafeteria Merchant</h4>
              </div>

              {/* Copyable UPI Id container bar */}
              <div className="flex items-center justify-between bg-surface-mid/80 px-2.5 h-9 rounded-lg border border-white/5 gap-1.5 overflow-hidden">
                <span className="font-mono text-[9px] text-[#cbd5e1] truncate select-all">
                  {settings.upiId}
                </span>
                <button
                  onClick={copyUpiId}
                  type="button"
                  className="p-1 text-brand-purple hover:text-brand-purple-light shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copied && (
                <span className="font-mono text-[8px] tracking-wider text-brand-green font-black uppercase">
                  Address Copied perfectly!
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Step 2: Choose Amount input area */}
        <section className="glass-bg glass-stroke rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="font-mono font-black text-[10px] bg-brand-purple/20 text-brand-purple-light px-2 py-0.5 rounded-md">
              STEP 2
            </span>
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
              Enter Amount
            </h3>
          </div>

          {/* Quick chip selector amount row */}
          <div className="grid grid-cols-4 gap-2">
            {amountChips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAmount(c)}
                className={`py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                  amount === c
                    ? 'border-brand-purple bg-brand-purple/15 text-brand-purple-light shadow-lg shadow-brand-purple/5'
                    : 'border-white/5 bg-white/5 hover:bg-white/10 text-on-surface-variant'
                }`}
              >
                ${c}
              </button>
            ))}
          </div>

          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-purple" />
            <input
              type="number"
              className="w-full h-11 bg-surface-lowest/80 border border-white/5 rounded-xl pl-9 pr-4 text-sm text-on-surface font-mono font-bold focus:outline-none focus:ring-1 focus:ring-brand-purple"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
            />
          </div>
        </section>

        {/* Step 3: Enter verification screenshooter */}
        <section className="glass-bg glass-stroke rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <span className="font-mono font-black text-[10px] bg-brand-purple/20 text-brand-purple-light px-2 py-0.5 rounded-md">
              STEP 3
            </span>
            <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
              Transaction Details
            </h3>
          </div>

          {/* UTR Input field */}
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              12-Digit UPI Transaction Ref / UTR No:
            </label>
            <input
              type="text"
              className="w-full h-10 bg-surface-lowest/80 border border-white/5 rounded-xl px-3 text-xs text-on-surface font-mono focus:outline-none focus:ring-1 focus:ring-brand-purple"
              placeholder="e.g. 5241 8593 1140"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={12}
            />
          </div>

          {/* Dashed drop screenshot camera trigger zone upload */}
          <div className="space-y-1.5">
            <span className="font-mono text-[9px] text-zinc-400 font-bold uppercase tracking-wider">
              Attach Screenshot of UPI Receipt:
            </span>
            <div className="border border-dashed border-white/10 hover:border-brand-purple/35 rounded-xl p-5 text-center transition-colors cursor-pointer relative bg-surface-lowest/20">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <Upload className="w-6 h-6 text-brand-purple" />
                {screenshotSelected ? (
                  <div className="flex items-center gap-1.5 bg-brand-green/10 border border-brand-green/30 text-brand-green p-1 px-2.5 rounded-full select-none text-[10px] font-mono">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[140px] font-bold">{screenshotName}</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <span className="font-sans text-xs text-on-surface font-medium block">
                      Choose screenshot image file
                    </span>
                    <span className="font-sans text-[10px] text-zinc-500 block">
                      Supports JPG, PNG formats up to 4MB
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Submit recharge request actions */}
        <button
          onClick={triggerUploadSubmit}
          disabled={hasPending}
          type="button"
          className="w-full h-14 rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs tracking-wider font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Sparkles className="w-4 h-4 text-brand-green" />
          QUEUE RECHARGE REQUEST
        </button>
      </main>
    </div>
  );
};
