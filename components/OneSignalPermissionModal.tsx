import React from 'react';
import { Bell, X } from 'lucide-react';
import { requestOneSignalPermission } from '../services/onesignal';

interface OneSignalPermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const OneSignalPermissionModal: React.FC<OneSignalPermissionModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const handleAccept = async () => {
        localStorage.setItem('joe_onesignal_prompt_status', 'accepted');
        onClose();
        await requestOneSignalPermission();
    };

    const handleDecline = () => {
        localStorage.setItem('joe_onesignal_prompt_status', 'declined');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-6 relative animate-in slide-in-from-bottom-8 duration-500 text-center">
                <button 
                    onClick={handleDecline}
                    className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-all"
                >
                    <X className="w-5 h-5" />
                </button>
                
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-emerald-100">
                    <Bell className="w-10 h-10 animate-bounce" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 tracking-tight italic mb-2">
                    🍚 Never Miss Your Order
                </h3>
                
                <p className="text-sm font-bold text-slate-500 leading-relaxed mb-8">
                    Get notified when your food is ready, receive wallet rewards, and skip unnecessary waiting.
                </p>
                
                <div className="space-y-3">
                    <button 
                        onClick={handleAccept}
                        className="w-full bg-emerald-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all active:scale-95"
                    >
                        Enable Notifications
                    </button>
                    <button 
                        onClick={handleDecline}
                        className="w-full bg-slate-50 text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4 rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-all"
                    >
                        Maybe Later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OneSignalPermissionModal;
