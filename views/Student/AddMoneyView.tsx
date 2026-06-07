import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  Camera,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ImageIcon,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  submitRechargeRequest,
  listenToMyRechargeRequests,
  WALLET_LOW_BALANCE_THRESHOLD,
} from '../../services/wallet';

interface AddMoneyViewProps {
  profile: UserProfile;
  onBack: () => void;
}

// ─── CAFE UPI DETAILS ─────────────────────────────────────────────────────────
const CAFETERIA_UPI_ID = 'fcgtub@okicici';
const CAFETERIA_UPI_NAME = 'Koushik Cse';
const CAFETERIA_UPI_QR_URL = '/upi-qr.jpg';

const QUICK_AMOUNTS = [50, 100, 200, 500];

// ─── Base64 screenshot util (Firebase Storage fallback) ───────────────────────
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const AddMoneyView: React.FC<AddMoneyViewProps> = ({ profile, onBack }) => {
  const [amount, setAmount] = useState<number | ''>('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upiCopied, setUpiCopied] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for existing pending request
  useEffect(() => {
    if (!profile?.uid) return;
    const unsub = listenToMyRechargeRequests(profile.uid, (requests) => {
      setHasPendingRequest(requests.some((r) => r.status === 'pending'));
    });
    return unsub;
  }, [profile?.uid]);

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
    setScreenshot(file);
    const preview = await fileToBase64(file);
    setScreenshotPreview(preview);
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(CAFETERIA_UPI_ID).then(() => {
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 2000);
    });
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!screenshot || !screenshotPreview) {
      setError('Please upload your payment screenshot');
      return;
    }
    if (hasPendingRequest) {
      setError('You already have a pending recharge request');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      // Use base64 as screenshot URL (inline storage for pilot)
      // For production, replace with Firebase Storage upload returning a download URL
      const screenshotUrl = screenshotPreview;

      await submitRechargeRequest(
        profile.uid,
        profile.name,
        Number(amount),
        screenshotUrl
      );
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── SUCCESS STATE ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto flex flex-col font-sans border-x border-slate-100 shadow-2xl">
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="relative">
            <div className="w-32 h-32 bg-emerald-50 border-4 border-emerald-100 rounded-[3rem] flex items-center justify-center shadow-2xl">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            </div>
            <div className="absolute inset-0 border-4 border-emerald-300 rounded-[3rem] animate-ping opacity-20" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Request Submitted!</h2>
            <p className="text-slate-400 font-medium text-sm leading-relaxed max-w-[280px] mx-auto">
              Your recharge of{' '}
              <span className="text-slate-700 font-black">₹{amount}</span> is pending cashier
              verification. Your balance will be credited once approved.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 w-full text-center">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">
              What happens next?
            </p>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              The cashier will review your screenshot and approve your recharge. This usually takes a few minutes during working hours.
            </p>
          </div>

          <button
            onClick={onBack}
            className="w-full bg-slate-900 text-white font-black text-xs uppercase tracking-widest py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all"
          >
            Back to Wallet
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN FORM ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto flex flex-col font-sans border-x border-slate-100 shadow-2xl">

      {/* Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-30 px-5 py-4 border-b border-slate-100 flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-lg font-black text-slate-900 tracking-tighter">Add Money</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Recharge JOE Wallet
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-32">

        {/* Already-pending notice */}
        {hasPendingRequest && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-amber-800">Recharge In Progress</p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                You have a pending recharge request. Wait for cashier approval before submitting a new one.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 1: UPI QR ── */}
        <div className="bg-white rounded-[2rem] p-6 border border-black/5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">1</div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Pay to Cafeteria UPI
            </h3>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white border-4 border-slate-100 rounded-3xl p-4 shadow-sm">
              <img
                src={CAFETERIA_UPI_QR_URL}
                alt="Cafeteria UPI QR Code"
                className="w-48 h-48 object-contain"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = 'none';
                }}
              />
            </div>

            {/* UPI ID row */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 w-full">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">
                  UPI ID
                </p>
                <p className="text-sm font-black text-slate-800 truncate">{CAFETERIA_UPI_ID}</p>
                <p className="text-[10px] font-bold text-slate-400">{CAFETERIA_UPI_NAME}</p>
              </div>
              <button
                onClick={handleCopyUPI}
                className="p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm active:scale-90 transition-all text-slate-500"
              >
                {upiCopied ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Step 2: Amount ── */}
        <div className="bg-white rounded-[2rem] p-6 border border-black/5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Enter Amount Paid
            </h3>
          </div>

          {/* Quick amounts */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                  amount === a
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'bg-slate-50 text-slate-600 border border-slate-100'
                }`}
              >
                ₹{a}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={1}
              max={10000}
              placeholder="Custom amount"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
              }
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-10 pr-4 text-xl font-black outline-none focus:ring-4 focus:ring-slate-900/10 transition-all"
            />
          </div>
        </div>

        {/* ── Step 3: Screenshot ── */}
        <div className="bg-white rounded-[2rem] p-6 border border-black/5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">3</div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Upload Payment Screenshot
            </h3>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {screenshotPreview ? (
            <div className="relative">
              <img
                src={screenshotPreview}
                alt="Payment screenshot"
                className="w-full rounded-2xl object-contain max-h-64 border border-slate-100"
              />
              <button
                onClick={() => {
                  setScreenshot(null);
                  setScreenshotPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-3 right-3 bg-white/90 backdrop-blur border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-600 active:scale-95 transition-all shadow-sm"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-10 flex flex-col items-center gap-3 active:scale-95 transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Camera className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-slate-600">Tap to upload screenshot</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  JPG, PNG up to 5 MB
                </p>
              </div>
              <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black">
                <Upload className="w-3.5 h-3.5" />
                Choose Photo
              </div>
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md p-5 bg-white/95 backdrop-blur-xl border-t border-black/5 z-20">
        {amount && Number(amount) > 0 && (
          <div className="flex justify-between items-center mb-4 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Recharge Amount
            </span>
            <span className="text-2xl font-black text-slate-900">₹{amount}</span>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !amount ||
            Number(amount) <= 0 ||
            !screenshot ||
            hasPendingRequest
          }
          className="w-full h-16 bg-slate-900 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <ImageIcon className="w-5 h-5" />
              Submit Recharge Request
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AddMoneyView;
