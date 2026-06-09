import React, { useState, useEffect } from 'react';
import { Smartphone, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { sendPhoneOTP, verifyPhoneOTP, updatePhoneUserName } from '../../services/phoneAuth';
import { validatePhoneNumber, formatPhoneNumber, validateName } from '../../utils/phoneValidation';
import OTPVerificationComponent from '../../components/Auth/OTPVerificationComponent';
import { UserProfile } from '../../types';

interface PhoneLoginViewProps {
  onBack: () => void;
  onSuccess: (profile: UserProfile) => void;
}

const PhoneLoginView: React.FC<PhoneLoginViewProps> = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState<'DETAILS' | 'OTP' | 'SUCCESS'>('DETAILS');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Clear error on input change
  useEffect(() => {
    setError(null);
  }, [name, phone]);

  const handleSendOTP = async () => {
    if (!validateName(name)) {
      setError("Please enter a valid full name (2-50 characters)");
      return;
    }
    if (!validatePhoneNumber(phone)) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    const formattedPhone = formatPhoneNumber(phone);
    setIsSending(true);
    setError(null);

    try {
      const result = await sendPhoneOTP(formattedPhone, 'recaptcha-container');
      setConfirmationResult(result);
      setStep('OTP');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/too-many-requests') {
        setError("Too many attempts. Please try again later.");
      } else if (err.code === 'auth/invalid-phone-number') {
        setError("Invalid phone number format.");
      } else {
        setError("Failed to send OTP. Please try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    if (!confirmationResult) return;

    setIsVerifying(true);
    setError(null);

    try {
      const { user, profile } = await verifyPhoneOTP(confirmationResult, otp);
      
      // If it's a newly created user (identified by having our default stub "Student" name or matching the auth flow)
      // we ensure the name is updated in Firestore to what they typed.
      // Even for existing, it doesn't hurt to update to their preferred name, 
      // but let's stick to updating unconditionally to ensure data consistency or only if needed.
      // We'll update the user name in firestore to ensure their inputted name is saved.
      await updatePhoneUserName(user.uid, name.trim(), formatPhoneNumber(phone));
      
      // Update local profile object to pass to App state immediately
      const updatedProfile = { ...profile, name: name.trim() };
      
      setStep('SUCCESS');
      
      // Add a slight delay so user can see the success state
      setTimeout(() => {
        onSuccess(updatedProfile);
      }, 1500);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-verification-code') {
        setError("Incorrect OTP. Please try again.");
      } else if (err.code === 'auth/code-expired') {
        setError("OTP has expired. Please resend.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = () => {
    handleSendOTP();
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-white max-w-md mx-auto relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-32 -right-32 w-72 h-72 bg-blue-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-indigo-50 rounded-full blur-3xl opacity-50" />

      {/* Header */}
      <div className="w-full flex items-center mb-8 z-10">
        <button 
          onClick={onBack}
          disabled={step === 'SUCCESS' || isSending || isVerifying}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-6 h-6 text-slate-800" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center w-full z-10 max-w-sm">
        
        {step !== 'SUCCESS' && (
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-slate-900/20">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
        )}

        {step === 'DETAILS' && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8 space-y-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Phone Login</h1>
              <p className="text-slate-500 font-medium text-sm">
                Login securely using your mobile number and OTP verification.
              </p>
            </div>

            <div className="w-full space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
                  disabled={isSending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</label>
                <div className="flex relative">
                  <div className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center border-r-2 border-slate-200 bg-slate-100 rounded-l-2xl font-bold text-slate-600">
                    +91
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full pl-20 pr-5 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-900 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-900 placeholder:text-slate-400 tracking-wide"
                    disabled={isSending}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl text-center animate-in fade-in">
                  {error}
                </div>
              )}

              <button
                onClick={handleSendOTP}
                disabled={isSending || !name.trim() || phone.length < 10}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 hover:bg-slate-800 shadow-xl shadow-slate-900/20 mt-4"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <span>Send OTP</span>
                )}
              </button>

              {/* Invisible reCAPTCHA container */}
              <div id="recaptcha-container"></div>
            </div>
          </div>
        )}

        {step === 'OTP' && (
          <div className="w-full">
            <OTPVerificationComponent 
              onVerify={handleVerifyOTP}
              onResend={handleResendOTP}
              isVerifying={isVerifying}
              isSending={isSending}
              error={error || undefined}
            />
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="w-full flex flex-col items-center justify-center py-12 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Login Successful!</h2>
            <p className="text-slate-500 font-medium">Redirecting to dashboard...</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default PhoneLoginView;
