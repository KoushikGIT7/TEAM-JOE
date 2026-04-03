import React, { useState, useEffect } from 'react';
import { 
  MonitorOff, LogOut
} from 'lucide-react';
import { onSnapshot, query, collectionGroup, where, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile } from '../../types';
import { 
  runBatchGenerator,
  startSystemBrain,
  stopSystemBrain
} from '../../services/firestore-db';
import StaffDashboardV3 from './v3/StaffDashboardV3';
import ServerConsoleWorkspace from './ServerConsoleWorkspace';

interface UnifiedKitchenConsoleProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
}

const UnifiedKitchenConsole: React.FC<UnifiedKitchenConsoleProps> = ({ profile, onLogout, onBack }) => {
  const [isClassicMode, setIsClassicMode] = useState(false);

  useEffect(() => {
    // 🧠 [SYSTEM-BRAIN] Initialize the executive brain on this staff device
    if (profile && (profile.role === 'SERVER' || profile.role === 'ADMIN' || profile.role === 'COOK')) {
       startSystemBrain(profile.uid);
    }

    return () => {
      stopSystemBrain();
    };
  }, [profile.uid, profile.role]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="text-white/20 font-black uppercase tracking-widest text-sm animate-pulse">
          Reconnecting to kitchen...
        </div>
      </div>
    );
  }

  // 🚀 [MODERN-EXPERIENCE] V3 Dashboard
  if (!isClassicMode) {
      return (
          <div className="relative h-screen bg-black overflow-hidden">
              <StaffDashboardV3 
                  profile={profile} 
                  onLogout={onLogout} 
                  onBack={onBack} 
              />
              {/* Internal toggle for rollout safety */}
              <button 
                  onClick={() => setIsClassicMode(true)}
                  className="fixed bottom-4 left-4 z-[100] px-4 py-2 bg-white/5 hover:bg-white/10 text-white/20 hover:text-white/40 text-[10px] font-black uppercase tracking-widest rounded-lg border border-white/5 transition-all flex items-center gap-2"
              >
                  <MonitorOff className="w-3 h-3" /> Classic Console
              </button>
          </div>
      );
  }

  // 🏛️ [LEGACY-MODE] Original Workspace (for rollout safety)
  return (
    <div className="h-screen flex flex-col bg-slate-950">
        <header className="h-14 bg-slate-900 flex items-center justify-between px-6 border-b border-white/5">
            <span className="text-white/40 font-black text-[10px] uppercase tracking-widest italic">Legacy Console Mode</span>
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsClassicMode(false)} 
                    className="text-emerald-400 font-black text-[10px] uppercase tracking-widest border border-emerald-500/30 px-3 py-1 rounded-full hover:bg-emerald-500/10 transition-all"
                >
                    Return to V3 Modern
                </button>
                <button onClick={onLogout} className="text-white/40 hover:text-white transition-colors">
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
            {/* Minimal legacy fallback */}
            <ServerConsoleWorkspace 
                scanQueue={[]} 
                setIsCameraOpen={() => {}} 
            />
        </div>
    </div>
  );
};

export default UnifiedKitchenConsole;
