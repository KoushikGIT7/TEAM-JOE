import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, Zap, Clock, Sparkles } from 'lucide-react';
import { PrepBatch } from '../../../types';
import { listenToBatches } from '../../../services/firestore-db';

/** ⏳ [TIME-ENGINE] Determine Current Menu Phase */
const getMenuPhase = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11.5) return 'BREAKFAST';
    if (hour >= 11.5 && hour < 16) return 'LUNCH';
    if (hour >= 16 && hour < 22) return 'SNACKS';
    return 'CLOSED';
};

const CookTab: React.FC = () => {
    const [batches, setBatches] = useState<PrepBatch[]>([]);
    const [phase, setPhase] = useState(getMenuPhase());

    useEffect(() => {
        const unsub = listenToBatches((live) => {
            // Display only QUEUED and PREPARING batches for the cook
            const active = live.filter(b => b.status === 'QUEUED' || b.status === 'PREPARING');
            setBatches(active);
        });
        
        const phaseInterval = setInterval(() => setPhase(getMenuPhase()), 60000);
        return () => { unsub(); clearInterval(phaseInterval); };
    }, []);

    const groupedItems = useMemo(() => {
        const itemMap: Record<string, { itemId: string, name: string, count: number, isPreparing: boolean, stationId: string }> = {};
        
        batches.forEach(b => {
            const id = b.itemId || 'GEN';
            if (!itemMap[id]) {
                itemMap[id] = { 
                    itemId: id, 
                    name: b.itemName || 'Item', 
                    count: 0, 
                    isPreparing: false,
                    stationId: b.stationId || 'GENERAL'
                };
            }
            itemMap[id].count += (b.items || []).length || b.quantity || 0;
            if (b.status === 'PREPARING') itemMap[id].isPreparing = true;
        });

        // 🧪 [SMART-SORT] PREPARING first, then highest volume
        return Object.values(itemMap).sort((a, b) => {
            if (a.isPreparing && !b.isPreparing) return -1;
            if (b.isPreparing && !a.isPreparing) return 1;
            return b.count - a.count;
        });
    }, [batches]);

    if (groupedItems.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0c] text-white">
                <div className="w-48 h-48 bg-white/5 rounded-[4rem] border-4 border-white/10 flex items-center justify-center mb-12 animate-pulse">
                    <Sparkles className="w-16 h-16 text-white/20" />
                </div>
                <h1 className="text-5xl font-black italic uppercase tracking-tighter mb-4 opacity-40">Pipeline Clear</h1>
                <p className="text-[14px] font-black uppercase tracking-[0.5em] text-white/20 animate-pulse">Waiting for orders...</p>
                <div className="mt-12 px-8 py-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{phase} WINDOW ACTIVE</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#0a0a0c] text-white overflow-hidden p-12">
            <div className="flex items-center justify-between mb-16 shrink-0">
                <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-emerald-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                        <ChefHat className="w-10 h-10 text-black" />
                    </div>
                    <div>
                        <h1 className="text-6xl font-black italic uppercase tracking-tighter">Kitchen Dashboard</h1>
                        <p className="text-[14px] font-black uppercase tracking-[0.4em] text-white/40 mt-1">Live Preparation Queue</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="px-6 py-2 bg-amber-500 text-black rounded-xl font-black uppercase text-xs tracking-widest">
                       {phase} PHASE
                    </div>
                    <div className="text-4xl font-black font-mono mt-2 flex items-center gap-4 justify-end">
                       <Clock className="w-6 h-6 text-white/20" />
                       {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto pr-4 custom-scrollbar">
                {groupedItems.map((item, idx) => (
                    <div 
                        key={item.itemId} 
                        className={`p-10 rounded-[4rem] border transition-all duration-500 flex flex-col justify-between ${
                            idx === 0 ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_80px_rgba(16,185,129,0.15)] ring-4 ring-emerald-500/20' : 'bg-white/[0.03] border-white/10'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-8">
                             <div className={`px-6 py-2 rounded-2xl font-black uppercase text-[10px] tracking-widest ${
                                 item.isPreparing ? 'bg-emerald-500 text-black animate-pulse' : 'bg-white/10 text-white/40'
                             }`}>
                                 {item.isPreparing ? 'PREPARING NOW' : 'WAITING'}
                             </div>
                             <span className="text-[12px] font-black text-white/20 uppercase tracking-[0.3em] font-mono italic">#{item.stationId.toUpperCase()}</span>
                        </div>

                        <div className="space-y-2">
                             <h2 className="text-7xl lg:text-9xl font-black italic leading-none truncate tracking-tighter">
                                {item.count}<span className="text-4xl lg:text-5xl opacity-40 ml-2 italic">x</span>
                             </h2>
                             <h3 className="text-3xl lg:text-5xl font-black italic uppercase tracking-tight text-white/80 truncate">
                                {item.name}
                             </h3>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-4 opacity-40">
                             <Zap className="w-5 h-5 fill-current" />
                             <span className="text-[10px] font-black uppercase tracking-widest">DEDUPLICATED BATCH • PRODUCTION_AUTO_GROUP</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CookTab;
