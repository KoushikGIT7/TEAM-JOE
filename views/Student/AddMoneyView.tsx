/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { 
  ArrowLeft, Copy, Upload, AlertTriangle, CheckCircle2, 
  Sparkles, DollarSign, Image as ImageIcon, Check, Loader2 
} from 'lucide-react';
import { UserProfile } from '../../types';
import { submitRechargeRequest } from '../../services/wallet';

interface AddMoneyViewProps {
  profile: UserProfile;
  onBack: () => void;
  onBackToWallet?: () => void;
}

// Helper to convert file to base64 for pilot storage
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const AddMoneyView: React.FC<AddMoneyViewProps> = ({ profile, onBack, onBackToWallet }) => {
  const {
    rechargeRequests,
    settings
  } = useApp();

  const [amount, setAmount] = useState<number>(50);
  const [copied, setCopied] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotSelected, setScreenshotSelected] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPending = rechargeRequests.some(r => r.status === 'pending');

  const handleBack = () => {
    if (onBack) onBack();
    else if (onBackToWallet) onBackToWallet();
  };

  const copyUpiId = () => {
    if (!settings.upiId) return;
    navigator.clipboard.writeText(settings.upiId);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const amountChips = [50, 100, 200, 500];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB');
      return;
    }
    setError(null);
    setScreenshotFile(file);
    setScreenshotName(file.name);
    setScreenshotSelected(true);
    try {
      const preview = await fileToBase64(file);
      setScreenshotPreview(preview);
    } catch (err) {
      setError('Failed to process screenshot file');
    }
  };

  const triggerUploadSubmit = async () => {
    if (utrNumber.trim().length !== 12) {
      setError('Please enter a valid 12-digit UPI Transaction Ref or UTR number.');
      return;
    }
    if (!screenshotSelected || !screenshotPreview) {
      setError('Please attach your digital UPI receipt screenshot.');
      return;
    }
    if (hasPending) {
      setError('You already have a pending recharge request.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      // Send real base64 receipt to database
      await submitRechargeRequest(
        profile.uid,
        profile.name,
        amount,
        screenshotPreview,
        utrNumber
      );
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-surface-lowest flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in max-w-md mx-auto border-x border-white/5 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-brand-green/10 border border-brand-green flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-brand-green" />
        </div>
        <h3 className="font-display text-xl font-extrabold text-white tracking-tight">Recharge Request Sent!</h3>
        <p className="font-sans text-xs text-on-surface-variant max-w-xs mt-2 leading-relaxed">
          Your recharge receipt is successfully queued. Cashiers will verify your UTR atomically. Funds will reflect in your secure wallet shortly.
        </p>
        <button
          onClick={handleBack}
          className="mt-6 px-6 h-12 rounded-full bg-brand-purple hover:bg-brand-purple-light text-surface-lowest font-mono text-xs font-bold tracking-widest cursor-pointer"
        >
          GO BACK TO WALLET
        </button>
      </div>
    );
  }

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
            RECHARGE GATEWAY TERMINAL
          </span>
          <h1 className="font-display text-md font-black text-white leading-none mt-1">
            Add Prepaid Funds
          </h1>
        </div>
      </header>

      {/* Main Form container */}
      <main className="px-5 mt-4 space-y-5">
        {hasPending && (
          <div className="p-3 bg-brand-purple-dark/15 border border-brand-purple/20 text-brand-purple-light rounded-xl flex items-center gap-2 select-none">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
            <p className="font-sans text-[11.5px] leading-snug">
              ⚠️ You have an active request pending approval. Please wait for verification before queuing any additional requests.
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
              <img 
                className="w-full h-full object-contain" 
                alt="UPI Merchant QR Code" 
                src={settings?.upiQrCode || '/upi-qr.jpg'} 
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = 'none';
                }}
              />
            </div>
            <div className="space-y-2 flex-grow min-w-0">
              <div className="space-y-0.5">
                <span className="font-mono text-[8px] text-[#94a3b8] tracking-wider uppercase">
                  OFFICIAL INTEGRATORS
                </span>
                <h4 className="font-display font-extrabold text-xs text-white">JOE Cafeteria Merchant</h4>
              </div>

              {/* Copyable UPI Id container bar */}
              <div className="flex items-center justify-between bg-surface-mid/80 px-2.5 h-9 rounded-lg border border-white/5 gap-1.5 overflow-hidden">
                <span className="font-mono text-[9px] text-[#cbd5e1] truncate select-all">
                  {settings?.upiId || 'fcgtub@okicici'}
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
                ₹{c}
              </button>
            ))}
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono font-bold text-brand-purple">
              ₹
            </span>
            <input
              type="number"
              className="w-full h-11 bg-surface-lowest/80 border border-white/5 rounded-xl pl-9 pr-4 text-sm text-on-surface font-mono font-bold focus:outline-none focus:ring-1 focus:ring-brand-purple"
              value={amount === 0 ? '' : amount}
              onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
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
              placeholder="e.g. 524185931140"
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-white/10 hover:border-brand-purple/35 rounded-xl p-5 text-center transition-colors cursor-pointer relative bg-surface-lowest/20"
            >
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
                      Supports JPG, PNG formats up to 5MB
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl flex items-center gap-2 select-none">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0" />
            <p className="font-sans text-xs">{error}</p>
          </div>
        )}

        {/* Submit recharge request actions */}
        <button
          onClick={triggerUploadSubmit}
          disabled={hasPending || submitting || amount <= 0 || utrNumber.trim().length !== 12 || !screenshotSelected}
          type="button"
          className="w-full h-14 rounded-full bg-gradient-to-r from-brand-purple to-brand-purple-dark text-white font-mono text-xs tracking-wider font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-brand-purple-light" />
              SUBMITTING RECHARGE...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-brand-green" />
              QUEUE RECHARGE REQUEST
            </>
          )}
        </button>
      </main>
    </div>
  );
};

export default AddMoneyView;
