import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface OTPVerificationProps {
  onVerify: (otp: string) => void;
  onResend: () => void;
  isVerifying: boolean;
  isSending: boolean;
  error?: string;
}

const OTPVerificationComponent: React.FC<OTPVerificationProps> = ({
  onVerify,
  onResend,
  isVerifying,
  isSending,
  error
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;

    const newOtp = [...otp];
    // Allow pasting
    if (value.length > 1) {
      const pastedData = value.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedData[i] || '';
      }
      setOtp(newOtp);
      // Focus last filled input or end
      const lastIndex = Math.min(pastedData.length, 5);
      inputRefs.current[lastIndex]?.focus();
    } else {
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto focus next
      if (value !== '' && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter' && otp.join('').length === 6) {
      onVerify(otp.join(''));
    }
  };

  const handleVerifyClick = () => {
    const otpString = otp.join('');
    if (otpString.length === 6) {
      onVerify(otpString);
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-6 animate-in fade-in zoom-in duration-300">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-slate-800">Enter Verification Code</h3>
        <p className="text-sm text-slate-500">We've sent a 6-digit code to your phone</p>
      </div>

      <div className="flex gap-2 justify-center w-full max-w-[280px]">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className="w-10 h-12 text-center text-xl font-bold border-2 border-slate-200 rounded-xl focus:border-slate-800 focus:ring-0 transition-colors bg-white text-slate-900"
            disabled={isVerifying}
          />
        ))}
      </div>

      {error && (
        <p className="text-red-500 text-sm font-medium animate-pulse">{error}</p>
      )}

      <button
        onClick={handleVerifyClick}
        disabled={otp.join('').length !== 6 || isVerifying}
        className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 hover:bg-slate-800 shadow-lg shadow-slate-900/20"
      >
        {isVerifying ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Verifying...</span>
          </>
        ) : (
          <span>Verify OTP</span>
        )}
      </button>

      <button
        onClick={() => {
          if (cooldown === 0) {
            setCooldown(30);
            onResend();
          }
        }}
        disabled={cooldown > 0 || isSending || isVerifying}
        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
      >
        {isSending ? (
          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP...</span>
        ) : cooldown > 0 ? (
          `Resend OTP in ${cooldown}s`
        ) : (
          "Resend OTP"
        )}
      </button>
    </div>
  );
};

export default OTPVerificationComponent;
