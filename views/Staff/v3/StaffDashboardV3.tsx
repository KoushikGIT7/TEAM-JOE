import React, { useState, useEffect } from 'react';
import { ChefHat, Server, Coffee, LogOut, LayoutDashboard, Zap, Clock } from 'lucide-react';
import { UserProfile } from '../../../types';
import CookTab from './CookTab';
import ServerTab from './ServerTab';
import BeverageTab from './BeverageTab';

interface StaffDashboardV3Props {
    profile: UserProfile;
    onLogout: () => void;
    onBack?: () => void;
}

const StaffDashboardV3: React.FC<StaffDashboardV3Props> = ({ profile, onLogout, onBack }) => {
    const [activeTab, setActiveTab] = useState<'COOK' | 'SERVER' | 'BEVERAGE'>('COOK');
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const tabs = [
        { id: 'COOK', label: 'Cook', icon: ChefHat, color: 'emerald' },
        { id: 'SERVER', label: 'Server', icon: Server, color: 'blue' },
        { id: 'BEVERAGE', label: 'Beverage', icon: Coffee, color: 'amber' }
    ] as const;

    return (
        <div className="flex flex-col h-screen bg-black overflow-hidden select-none">
            {/* 🛸 GLOBAL STATUS BAR */}
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-50">
                <div className="flex items-center gap-12">
                   <div className="bg-slate-900 px-6 py-2.5 rounded-2xl transform -skew-x-12 shadow-lg">
                      <span className="text-white font-black text-xl italic tracking-tighter uppercase">JOE CAFE PRO</span>
                   </div>

                   <nav className="flex bg-slate-100 p-1.5 rounded-[2rem] border border-slate-200 gap-1 shadow-inner">
                      {tabs.map((tab) => {
                         const Icon = tab.icon;
                         const isActive = activeTab === tab.id;
                         return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-10 h-14 rounded-[1.5rem] font-black uppercase text-xs tracking-widest transition-all flex items-center gap-4 ${
                                    isActive 
                                    ? 'bg-slate-900 text-white shadow-xl scale-[1.02]' 
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                                {tab.label}
                            </button>
                         );
                      })}
                   </nav>
                </div>

                <div className="flex items-center gap-8 text-right">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Live Server Time</span>
                        <span className="text-3xl font-black text-slate-900 font-mono leading-none tracking-tighter">
                           {currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>

                    <div className="h-10 w-[1px] bg-slate-200" />

                    <div className="flex items-center gap-4">
                        {profile.role === 'ADMIN' && onBack && (
                            <button 
                                onClick={onBack}
                                className="w-12 h-12 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl hover:text-slate-900 transition-colors flex items-center justify-center shadow-sm"
                            >
                                <LayoutDashboard className="w-5 h-5" />
                            </button>
                        )}
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg">
                            {profile.name?.charAt(0) || 'S'}
                        </div>
                        <button 
                            onClick={onLogout}
                            className="w-12 h-12 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* 📺 VIEWPORT */}
            <main className="flex-1 overflow-hidden relative">
                {activeTab === 'COOK' && <CookTab />}
                {activeTab === 'SERVER' && <ServerTab />}
                {activeTab === 'BEVERAGE' && <BeverageTab />}

                {/* 🌈 AMBIENT LIGHTS */}
                <div className={`absolute top-0 right-0 w-[800px] h-[800px] blur-[200px] rounded-full pointer-events-none transition-all duration-1000 opacity-20 ${
                    activeTab === 'COOK' ? 'bg-emerald-500' : 
                    activeTab === 'SERVER' ? 'bg-blue-500' : 'bg-amber-500'
                }`} />
            </main>
        </div>
    );
};

export default StaffDashboardV3;
