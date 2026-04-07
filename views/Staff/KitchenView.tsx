import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Clock, ChefHat, CheckCircle2, Loader2, UtensilsCrossed, Users, Timer, Bell, Zap, Flame, Sparkles } from 'lucide-react';
import { listenToBatches } from '../../services/firestore-db';
import { startBatchPreparation, markBatchReady, updateSlotStatus } from '../../services/cook-workflow';
import { requestNotificationPermission } from '../../services/notificationService';
import { SERVER_LABELS } from '../../constants';
import type { PrepBatch, PrepBatchStatus } from '../../types';

interface KitchenViewProps {
  onBack: () => void;
  lang?: 'en' | 'kn';
  user?: any;
}

const formatSlotLabel = (slot: number) => {
    const s = slot.toString().padStart(4, '0');
    return `${s.slice(0, 2)}:${s.slice(2)}`;
};

/**
 * SLOT-BASED DASHBOARD (Senior Spec)
 * Logic: Cook focuses on current/upcoming time slots, not individual batches.
 */
const KitchenView: React.FC<KitchenViewProps> = ({ onBack, lang: initialLang = 'en', user }) => {
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [updatingSlot, setUpdatingSlot] = useState<number | null>(null);

  useEffect(() => {
    const unsub = listenToBatches((list) => setBatches(list));
    return unsub;
  }, []);

  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  // Grouping logic: Master Slot Map
  const slotGroups = useMemo(() => {
    const groups: Record<number, { 
      slot: number; 
      items: PrepBatch[]; 
      status: PrepBatchStatus;
    }> = {};

    batches.forEach(b => {
      if (!groups[b.arrivalTimeSlot]) {
        groups[b.arrivalTimeSlot] = { 
          slot: b.arrivalTimeSlot, 
          items: [],
          status: 'QUEUED'
        };
      }
      groups[b.arrivalTimeSlot].items.push(b);
    });

    // Determine representative status for the slot
    Object.values(groups).forEach(g => {
        const statuses = g.items.map(i => i.status);
        if (statuses.includes('READY')) g.status = 'READY';
        else if (statuses.includes('ALMOST_READY')) g.status = 'ALMOST_READY';
        else if (statuses.includes('PREPARING')) g.status = 'PREPARING';
        else g.status = 'QUEUED';
    });

    return Object.values(groups).sort((a, b) => a.slot - b.slot);
  }, [batches]);

  const handleUpdateSlot = async (slot: number, status: PrepBatchStatus) => {
      setUpdatingSlot(slot);
      try {
          await updateSlotStatus(slot, status);
      } catch (e) {
          console.error(e);
      } finally {
          setUpdatingSlot(null);
      }
  };

  const sections = {
    PREPARING: slotGroups.filter(g => g.status === 'PREPARING' || g.status === 'ALMOST_READY'),
    READY: slotGroups.filter(g => g.status === 'READY'),
    UPCOMING: slotGroups.filter(g => g.status === 'QUEUED')
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-primary/30 pb-32">
      {/* Header (Minimal & Fast) */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter">KITCHEN OPS</h1>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">Live Production Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right mr-2 hidden sm:block">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Station Status</p>
                <p className="text-sm font-black text-green-500">OPTIMIZED</p>
            </div>
            <div className="w-12 h-12 rounded-[1.2rem] bg-primary/20 flex items-center justify-center border border-primary/30">
                <Flame className="w-6 h-6 text-primary animate-pulse" />
            </div>
        </div>
      </header>

      <div className="p-6 space-y-12">
        {/* CURRENTLY PREPARING */}
        <section>
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" /> Currently Preparing
            </h2>
            <span className="text-[10px] font-black text-amber-500/50 uppercase tracking-widest">{sections.PREPARING.length} ACTIVE BATCHES</span>
          </div>
          
          <div className="space-y-6">
            {sections.PREPARING.length === 0 ? (
                <div className="p-12 text-center rounded-[3rem] border-2 border-dashed border-white/5 opacity-20">
                    <Sparkles className="w-10 h-10 mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">Clear Pipeline</p>
                </div>
            ) : sections.PREPARING.map(group => (
                <div key={group.slot} className={`rounded-[3rem] border p-8 transition-all duration-500 ${group.status === 'ALMOST_READY' ? 'bg-orange-950/20 border-orange-500/50' : 'bg-amber-950/20 border-amber-500/30'}`}>
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${group.status === 'ALMOST_READY' ? 'bg-orange-500 text-black' : 'bg-amber-500 text-black'}`}>
                                    {group.status === 'ALMOST_READY' ? 'ALMOST READY' : 'PREPARING'}
                                </span>
                                <span className="text-2xl font-black italic">Batch {formatSlotLabel(group.slot)}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Estimated serving: as soon as ready</p>
                        </div>
                        <div className="text-right">
                            <UtensilsCrossed className="w-8 h-8 text-white/5 ml-auto" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        {group.items.map(item => (
                            <div key={item.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                <span className="font-black text-lg tracking-tight">{item.itemName || 'Unnamed Item'}</span>
                                <span className="text-3xl font-black text-primary">×{item.quantity}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button 
                            disabled={!!updatingSlot}
                            onClick={() => handleUpdateSlot(group.slot, 'ALMOST_READY')}
                            className={`flex-[1] h-18 rounded-3xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${group.status === 'ALMOST_READY' ? 'bg-white/10 text-white/40 border border-white/5 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'}`}
                        >
                            {updatingSlot === group.slot ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Mark Almost Ready'}
                        </button>
                        <button 
                            disabled={!!updatingSlot}
                            onClick={() => handleUpdateSlot(group.slot, 'READY')}
                            className="flex-[1.5] h-18 rounded-3xl bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-green-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            {updatingSlot === group.slot ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Bell className="w-5 h-5" /> Mark Ready</>}
                        </button>
                    </div>
                </div>
            ))}
          </div>
        </section>

        {/* UPCOMING BATCHES */}
        <section>
          <div className="flex items-center justify-between mb-6 px-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-500" /> Upcoming Production
            </h2>
          </div>
          
          <div className="space-y-4">
            {sections.UPCOMING.map(group => (
                <div key={group.slot} className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-6 hover:bg-slate-900/60 transition-all">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-slate-500" />
                            <span className="text-xl font-black tracking-tight">{formatSlotLabel(group.slot)} Batch</span>
                            <span className="text-[10px] font-black text-slate-600 tracking-widest">START IN ~15M</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                            <Users className="w-4 h-4" />
                            <span className="text-xs font-black">{group.items.reduce((acc, i) => acc + (i.orderIds?.length || 0), 0)}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-6">
                        {group.items.map(item => (
                            <div key={item.id} className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300">{item.itemName}</span>
                                <span className="text-sm font-black text-primary">×{item.quantity}</span>
                            </div>
                        ))}
                    </div>

                    <button 
                        disabled={!!updatingSlot}
                        onClick={() => handleUpdateSlot(group.slot, 'PREPARING')}
                        className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-primary/10"
                    >
                        {updatingSlot === group.slot ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ChefHat className="w-5 h-5" /> Start Preparing</>}
                    </button>
                </div>
            ))}
          </div>
        </section>

        {/* READY TO SERVE */}
        {sections.READY.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> Ready to Serve
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sections.READY.map(group => (
                  <div key={group.slot} className="bg-green-950/20 border border-green-500/20 rounded-[2rem] p-6 opacity-60">
                      <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-black text-green-500">{formatSlotLabel(group.slot)} Slot</span>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="space-y-2">
                          {group.items.map(item => (
                            <div key={item.id} className="flex justify-between text-xs font-bold text-slate-400">
                                <span>{item.itemName}</span>
                                <span>×{item.quantity}</span>
                            </div>
                          ))}
                      </div>
                  </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* FOOTER STATS */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-6 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex items-center justify-around pointer-events-auto max-w-lg mx-auto">
              <div className="text-center group">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Queue</p>
                  <p className="text-2xl font-black italic">{sections.UPCOMING.length}</p>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="text-center">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Live</p>
                  <p className="text-2xl font-black italic">{sections.PREPARING.length}</p>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="text-center">
                  <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Served</p>
                  <p className="text-2xl font-black italic">{sections.READY.length}</p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default KitchenView;
