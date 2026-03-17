import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Clock, ChefHat, CheckCircle2, Loader2, UtensilsCrossed, Users, Timer, Bell, Zap } from 'lucide-react';
import { listenToBatches, startBatchPreparation, markBatchReady } from '../../services/firestore-db';
import { requestNotificationPermission } from '../../services/notificationService';
import { SERVER_LABELS } from '../../constants';
import type { PrepBatch, PrepBatchStatus } from '../../types';

interface KitchenViewProps {
  onBack: () => void;
  lang?: 'en' | 'kn';
  user?: any;
}

const LABEL = (key: keyof typeof SERVER_LABELS, lang: 'en' | 'kn') => SERVER_LABELS[key][lang];

interface BatchCardProps {
  batch: PrepBatch;
  updating: string | null;
  onStartPrep: (id: string) => void;
  onMarkReady: (id: string) => void;
}

const formatSlotLabel = (slot: number) => {
    const s = slot.toString().padStart(4, '0');
    return `${s.slice(0, 2)}:${s.slice(2)}`;
};

const BatchCard: React.FC<BatchCardProps> = ({ batch, updating, onStartPrep, onMarkReady }) => {
    const isUpdating = updating === batch.id;
    const isUpcoming = batch.status === 'QUEUED';
    const isPreparing = batch.status === 'PREPARING';
    const isReady = batch.status === 'READY';

    return (
      <div className={`rounded-3xl p-5 border-2 transition-all shadow-sm ${
        isPreparing ? 'bg-amber-50 border-amber-300 ring-4 ring-amber-100' : 
        isReady ? 'bg-green-50 border-green-300' : 'bg-white border-gray-100'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 bg-black text-white text-[10px] font-black rounded-full uppercase tracking-widest">
                Slot {formatSlotLabel(batch.arrivalTimeSlot)}
              </span>
              {isPreparing && (
                <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase animate-pulse">
                  <Zap className="w-3 h-3 fill-current" /> Cooking
                </span>
              )}
            </div>
            <h3 className="text-xl font-black text-textMain leading-tight">{batch.itemName}</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-textSecondary uppercase tracking-tighter">Quantity</p>
            <p className="text-2xl font-black text-textMain leading-none">{batch.quantity}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-5 pt-4 border-t border-black/5">
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-textSecondary" />
            <span className="text-xs font-bold text-textSecondary">{batch.orderIds?.length || 0} Users</span>
          </div>
          {isReady && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Timer className="w-4 h-4 text-green-600" />
              <span className="text-xs font-black text-green-600">10m Window</span>
            </div>
          )}
        </div>

        {isUpcoming && (
          <button
            disabled={isUpdating}
            onClick={() => onStartPrep(batch.id)}
            className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black uppercase tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChefHat className="w-5 h-5" />}
            Start Preparation
          </button>
        )}

        {isPreparing && (
          <button
            disabled={isUpdating}
            onClick={() => onMarkReady(batch.id)}
            className="w-full py-4 rounded-2xl bg-green-600 text-white font-black uppercase tracking-widest shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
            Notify Users (Ready)
          </button>
        )}

        {isReady && (
          <div className="text-center p-3 bg-white/50 rounded-xl border border-green-200">
            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Awaiting Pickup Scan</p>
          </div>
        )}
      </div>
    );
};

const KitchenView: React.FC<KitchenViewProps> = ({ onBack, lang: initialLang = 'en', user }) => {
  const [lang, setLang] = useState<'en' | 'kn'>(initialLang);
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenToBatches((list) => setBatches(list));
    return unsub;
  }, []);

  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  const byStatus = useMemo(() => {
    const map: Record<PrepBatchStatus, PrepBatch[]> = { QUEUED: [], PREPARING: [], READY: [], COMPLETED: [] };
    batches.forEach(b => {
      if (b.status in map) map[b.status].push(b);
    });
    Object.values(map).forEach(list => list.sort((a, b) => a.arrivalTimeSlot - b.arrivalTimeSlot));
    return map;
  }, [batches]);

  const handleStartPrep = async (batchId: string) => {
    setUpdating(batchId);
    try {
      await startBatchPreparation(batchId);
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkReady = async (batchId: string) => {
      setUpdating(batchId);
      try {
        await markBatchReady(batchId);
        // Firebase-only: Student listeners will detect the 'READY' status change automatically
      } catch (e) {
        console.error(e);
      } finally {
        setUpdating(null);
      }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] max-w-md mx-auto pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-black/5 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2.5 rounded-2xl bg-gray-50 border border-black/5" aria-label="Back">
                <ChevronLeft className="w-5 h-5 text-textSecondary" />
            </button>
            <div>
                <h1 className="text-lg font-black text-textMain leading-none">Kitchen Pro</h1>
                <p className="text-[10px] font-bold text-textSecondary uppercase tracking-widest mt-1">Batch Preparation</p>
            </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl border border-black/5">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${lang === 'en' ? 'bg-white text-textMain shadow-sm' : 'text-textSecondary'}`}
          >EN</button>
          <button
            onClick={() => setLang('kn')}
            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${lang === 'kn' ? 'bg-white text-textMain shadow-sm' : 'text-textSecondary'}`}
          >ಕನ್</button>
        </div>
      </header>

      <div className="p-4 space-y-8">
        {(byStatus.PREPARING.length > 0 || byStatus.READY.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-xs font-black text-textSecondary uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3 text-amber-500 fill-current" /> 
                    Live Production ({byStatus.PREPARING.length + byStatus.READY.length})
                </h2>
            </div>
            <div className="space-y-4">
              {byStatus.PREPARING.map(batch => (
                <BatchCard 
                  key={batch.id} 
                  batch={batch} 
                  updating={updating} 
                  onStartPrep={handleStartPrep} 
                  onMarkReady={handleMarkReady} 
                />
              ))}
              {byStatus.READY.map(batch => (
                <BatchCard 
                  key={batch.id} 
                  batch={batch} 
                  updating={updating} 
                  onStartPrep={handleStartPrep} 
                  onMarkReady={handleMarkReady} 
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-black text-textSecondary uppercase tracking-widest flex items-center gap-2">
                  <Clock className="w-3 h-3" /> 
                  Upcoming Batches ({byStatus.QUEUED.length})
              </h2>
          </div>
          {byStatus.QUEUED.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <UtensilsCrossed className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-textSecondary">No upcoming batches</p>
            </div>
          ) : (
            <div className="space-y-4">
              {byStatus.QUEUED.map(batch => (
                <BatchCard 
                  key={batch.id} 
                  batch={batch} 
                  updating={updating} 
                  onStartPrep={handleStartPrep} 
                  onMarkReady={handleMarkReady} 
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-textMain text-white p-4 flex justify-around items-center rounded-t-[2.5rem] shadow-2xl z-40">
        <div className="text-center">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">In Queue</p>
            <p className="text-lg font-black">{byStatus.QUEUED.length}</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Cooking</p>
            <p className="text-lg font-black">{byStatus.PREPARING.length}</p>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div className="text-center">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Ready</p>
            <p className="text-lg font-black">{byStatus.READY.length}</p>
        </div>
      </div>
    </div>
  );
};

export default KitchenView;
