import React, { useEffect } from 'react';
import { BellRing, Sparkles, X } from 'lucide-react';
import { requestNotificationPermission, trackAnalyticsEvent } from '../services/onesignal';

interface OneSignalPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OneSignalPermissionModal: React.FC<OneSignalPermissionModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      trackAnalyticsEvent('Permission Prompt Shown');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnable = async () => {
    try {
      trackAnalyticsEvent('Permission Prompt Clicked Enable');
      const granted = await requestNotificationPermission();
      if (granted) {
        localStorage.setItem('joe_onesignal_prompt_status', 'accepted');
        trackAnalyticsEvent('Permission Prompt Accepted');
      } else {
        localStorage.setItem('joe_onesignal_prompt_status', 'denied');
        trackAnalyticsEvent('Permission Prompt Denied Native');
      }
    } catch (err) {
      console.error('Error enabling push permissions:', err);
    } finally {
      onClose();
    }
  };

  const handleDismiss = async () => {
    try {
      localStorage.setItem('joe_onesignal_prompt_status', 'deferred');
      localStorage.setItem('joe_onesignal_last_prompt_time', String(Date.now()));
      trackAnalyticsEvent('Permission Prompt Dismissed');
    } catch (err) {
      console.error('Error deferring push permissions:', err);
    } finally {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="bg-white/95 dark:bg-slate-900/95 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] max-w-md w-full shadow-2xl p-8 relative flex flex-col items-center text-center animate-in slide-in-from-bottom-12 duration-500 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={handleDismiss} 
          className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon Ring */}
        <div className="relative mb-6 mt-4">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-[2rem] flex items-center justify-center border border-emerald-100/30 shadow-inner">
            <BellRing className="w-10 h-10 text-emerald-500 animate-bounce" />
          </div>
          <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-md animate-pulse">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic mb-3 font-sans leading-none">
          🍚 Never Miss Your Order Again
        </h3>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mb-8 font-sans">
          Get notified when your food is ready, receive wallet rewards, unlock special offers, and skip unnecessary waiting.
        </p>

        {/* Action Buttons */}
        <div className="w-full space-y-3">
          <button
            onClick={handleEnable}
            className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-95 transition-opacity active:scale-[0.99] shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            Enable Notifications
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full h-12 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.99]"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default OneSignalPermissionModal;
