import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, Zap, Clock, Sparkles, CheckCircle2, Loader2, Minus, Plus } from 'lucide-react';
import { listenToItemAggregates, releaseBatchByItem } from '../../../services/staff-v3';
import { INITIAL_MENU } from '../../../constants';

const ServerTab: React.FC = () => {
    const [aggregates, setAggregates] = useState<Record<string, { ready: number, queued: number }>>({});
    const [processing, setProcessing] = useState<Record<string, boolean>>({});
    const [countsToRelease, setCountsToRelease] = useState<Record<string, number>>({});

    useEffect(() => {
        const unsub = listenToItemAggregates((live) => {
            setAggregates(live);
            
            // Auto-initialize countsToRelease for new items
            setCountsToRelease(prev => {
                const next = { ...prev };
                Object.keys(live).forEach(id => {
                   if (next[id] === undefined) next[id] = 1;
                });
                return next;
            });
        });
        return () => unsub();
    }, []);

    const handleRelease = async (itemId: string) => {
        const count = countsToRelease[itemId] || 1;
        if (count <= 0) return;
        
        setProcessing(p => ({ ...p, [itemId]: true }));
        try {
            await releaseBatchByItem(itemId, count);
            if (window.navigator.vibrate) window.navigator.vibrate([40, 20, 60]);
        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(p => ({ ...p, [itemId]: false }));
        }
    };

    const updateCount = (itemId: string, delta: number) => {
        setCountsToRelease(prev => ({
            ...prev,
            [itemId]: Math.max(1, (prev[itemId] || 1) + delta)
        }));
    };

    const activeItems = useMemo(() => {
        // Only show items that have either queued or ready status
        return Object.entries(aggregates)
            .filter(([_, data]) => data.ready > 0 || data.queued > 0)
            .map(([id, data]) => ({
                id,
                ...data,
                name: INITIAL_MENU.find(m => m.id === id)?.name || id
            }))
            .sort((a, b) => b.queued - a.queued);
    }, [aggregates]);

    if (activeItems.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-900">
                <div className="w-32 h-32 bg-white rounded-[2rem] border border-slate-200 flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50">
                    <Sparkles className="w-12 h-12 text-slate-300" />
                </div>
                <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Counter Clear</h1>
                <p className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-400">Waiting for production...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-[#f8fafc] text-slate-900 overflow-hidden p-6 lg:p-12">
            <div className="flex items-center justify-between mb-12 shrink-0">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center shadow-xl">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter">Server Control</h1>
                        <p className="text-[12px] font-black uppercase tracking-[0.4em] text-emerald-500 animate-pulse mt-1">● Handover System Active</p>
                    </div>
                </div>

                <div className="flex items-center gap-12 text-right">
                    <div className="hidden lg:block">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Queued</p>
                        <span className="text-4xl font-black font-mono leading-none">
                           {activeItems.reduce((s, it) => s + it.queued, 0)}
                        </span>
                    </div>
                    <div className="hidden lg:block h-10 w-[1px] bg-slate-200" />
                    <div className="hidden lg:block">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Ready</p>
                        <span className="text-4xl font-black font-mono text-emerald-600 leading-none">
                           {activeItems.reduce((s, it) => s + it.ready, 0)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 space-y-6 custom-scrollbar">
                {activeItems.map((item) => (
                    <div 
                        key={item.id} 
                        className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8 flex flex-col lg:flex-row items-center gap-8 shadow-sm hover:shadow-xl transition-all duration-300 group"
                    >
                        <div className="w-full lg:w-48 text-center lg:text-left">
                            <h3 className="text-3xl font-black italic uppercase tracking-tighter truncate">{item.name}</h3>
                            <div className="flex items-center gap-3 justify-center lg:justify-start mt-2">
                                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">{item.id}</span>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 gap-8 w-full">
                            <div className="bg-slate-50 p-6 rounded-[1.5rem] text-center border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Queued</p>
                                <span className="text-4xl lg:text-6xl font-black italic">{item.queued}</span>
                            </div>
                            <div className="bg-emerald-50 p-6 rounded-[1.5rem] text-center border border-emerald-100">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 italic text-center">Shelf Ready</p>
                                <span className="text-4xl lg:text-6xl font-black italic text-emerald-600">{item.ready}</span>
                            </div>
                        </div>

                        <div className="w-full lg:w-auto flex flex-col lg:flex-row items-center gap-6">
                            <div className="flex items-center bg-slate-900 rounded-[1.5rem] p-2">
                                <button 
                                    onClick={() => updateCount(item.id, -1)}
                                    className="w-12 h-12 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                                >
                                    <Minus className="w-6 h-6" />
                                </button>
                                <div className="w-16 text-center text-white text-3xl font-black font-mono">
                                    {countsToRelease[item.id] || 1}
                                </div>
                                <button 
                                    onClick={() => updateCount(item.id, 1)}
                                    className="w-12 h-12 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                                >
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>

                            <button 
                                onClick={() => handleRelease(item.id)}
                                disabled={processing[item.id] || item.queued === 0}
                                className={`h-24 w-full lg:w-72 rounded-[2rem] font-black text-xl uppercase italic tracking-tighter flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl ${
                                    item.queued === 0 
                                    ? 'bg-slate-100 text-slate-300 pointer-events-none' 
                                    : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20'
                                }`}
                            >
                                {processing[item.id] ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                                    <>
                                        <Zap className="w-8 h-8 fill-black" />
                                        <span>RELEASE BATCH</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ServerTab;
