import React, { useMemo, useEffect, useState } from 'react';
import { Timer, Flame, ChefHat, Clock, Play, Check } from 'lucide-react';
import { PrepBatch } from '../../types';
import { startBatchPreparation, markBatchReady } from '../../services/firestore-db';

interface CookConsoleWorkspaceProps {
  batches: PrepBatch[];
}

const formatSlot = (slot: number) => {
  const s = slot.toString().padStart(4, '0');
  let hours = parseInt(s.slice(0, 2), 10);
  const minutes = s.slice(2);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

const BatchItemCard = ({ 
  batch, 
  isOptimisticPreparing, 
  optimisticPushedQty,
  setOptimisticPrep,
  registerPush
}: { 
  batch: PrepBatch; 
  isOptimisticPreparing: boolean;
  optimisticPushedQty: number;
  setOptimisticPrep: (id: string) => void;
  registerPush: (id: string, count: number) => void;
}) => {
   const [isProcessing, setIsProcessing] = useState(false);

   const onStart = async () => {
       setIsProcessing(true);
       setOptimisticPrep(batch.id); // ⚡ OPTIMISTIC PREP
       try { 
          await startBatchPreparation(batch.id); 
       } catch(e) { 
          console.error("Start prep failed:", e); 
       } finally { 
          setIsProcessing(false); 
       }
   };

   const onRelease = (count?: number) => {
       const qtyToPush = count ?? (batch.quantity - optimisticPushedQty);
       if (qtyToPush <= 0) return;

       setIsProcessing(true);
       
       // ⚡ OPTIMISTIC RELEASE (Root Level Speed)
       registerPush(batch.id, qtyToPush);
       
       // Silent non-blocking update
       markBatchReady(batch.id, count).catch(e => {
          console.error("Background release failed:", e);
       }).finally(() => {
          setIsProcessing(false);
       });
   };

   // Derived State
   const currentQty = Math.max(0, batch.quantity - optimisticPushedQty);
   const isPreparing = batch.status === 'PREPARING' || isOptimisticPreparing;
   const isCompleted = currentQty <= 0 && batch.status !== 'QUEUED';

   if (isCompleted) return null; // Clean UI removal

   return (
      <div className={`p-5 rounded-[2.5rem] border-2 flex flex-col justify-between transition-all group ${
         isPreparing ? 'border-amber-400 bg-amber-50/10 shadow-lg shadow-amber-900/5' : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
      }`}>
          <div className="flex justify-between items-start mb-6">
              <div>
                 <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                    isPreparing ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                 }`}>
                    {isPreparing ? 'In Production' : 'Queued'}
                 </span>
                 <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-3 uppercase tracking-tighter leading-none">{batch.itemName}</h3>
              </div>
              <div className={`text-4xl lg:text-5xl font-black italic font-mono ${isPreparing ? 'text-amber-600' : 'text-slate-900'}`}>
                ×{currentQty}
              </div>
          </div>
          
          <div className="mt-auto">
              {!isPreparing ? (
                 <button 
                    disabled={isProcessing}
                    onClick={onStart}
                    className="w-full bg-slate-900 text-white rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2 hover:bg-black disabled:opacity-50"
                 >
                    {isProcessing ? <Timer className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} Start Preparing
                 </button>
              ) : (
                 <div className="flex flex-col gap-2">
                    <div className="flex gap-2 w-full">
                       {[1, 2, 3, 4].filter(num => num < currentQty).map(num => (
                          <button 
                            key={num}
                            onClick={() => onRelease(num)}
                            className="flex-1 border-2 border-amber-500 text-amber-600 rounded-2xl py-3.5 font-black tracking-tighter text-sm active:scale-95 transition-all hover:bg-amber-50 bg-white shadow-sm"
                          >
                            +{num}
                          </button>
                       ))}
                    </div>
                    <button 
                      onClick={() => onRelease()}
                      className="w-full bg-amber-500 text-white rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] active:scale-[0.98] transition-all shadow-xl shadow-amber-500/20 hover:bg-amber-600 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" /> Push All ({currentQty})
                    </button>
                 </div>
              )}
          </div>
      </div>
   );
};

const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ batches }) => {
  const [optimisticPreparingIds, setOptimisticPreparingIds] = useState<Set<string>>(new Set());
  const [optimisticPushes, setOptimisticPushes] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync cleanup: when real batch data updates, reconcile optimistic states
  useEffect(() => {
     setOptimisticPushes(prev => {
        const next = { ...prev };
        batches.forEach(b => {
           // If real quantity decreased, we can reduce the optimistic push offset
           // or just wipe it if the batch state is now consistent
           if (b.status === 'READY') delete next[b.id];
        });
        return next;
     });
     setOptimisticPreparingIds(prev => {
        const next = new Set(prev);
        batches.forEach(b => {
           if (b.status === 'PREPARING') next.delete(b.id);
        });
        return next;
     });
  }, [batches]);

  const activeBatchSlot = useMemo(() => {
    const preparing = batches.find(b => b.status === 'PREPARING' || optimisticPreparingIds.has(b.id));
    if (preparing) return preparing.arrivalTimeSlot;
    
    // Sort queued items by arrival to find the current active focus
    const queuedItems = batches
      .filter(b => b.status === 'QUEUED' && (b.quantity - (optimisticPushes[b.id] || 0)) > 0)
      .sort((a, b) => a.arrivalTimeSlot - b.arrivalTimeSlot);
    
    return queuedItems?.[0]?.arrivalTimeSlot || null;
  }, [batches, optimisticPreparingIds, optimisticPushes]);

  const activeBatchItems = useMemo(() => {
    if (!activeBatchSlot) return [];
    return batches.filter(b => {
       const curQty = b.quantity - (optimisticPushes[b.id] || 0);
       return (
          b.arrivalTimeSlot === activeBatchSlot && 
          curQty > 0 && 
          (['QUEUED', 'PREPARING', 'ALMOST_READY'].includes(b.status) || optimisticPreparingIds.has(b.id))
       );
    }).sort((a, b) => (a.status === 'PREPARING' || optimisticPreparingIds.has(a.id)) ? -1 : 1);
  }, [batches, activeBatchSlot, optimisticPreparingIds, optimisticPushes]);

  const registerPush = (id: string, count: number) => {
     setOptimisticPushes(prev => ({
        ...prev,
        [id]: (prev[id] || 0) + count
     }));
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6 lg:p-10 font-sans">
      
      {/* 🟢 TOP BAR / STATUS */}
      <div className="flex items-center justify-between mb-12">
         <div className="flex items-center gap-6">
            <div className="bg-slate-900 p-4 rounded-[1.5rem] shadow-2xl">
               <Flame className="w-8 h-8 text-amber-500" />
            </div>
            <div>
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Pro-Production</h2>
               <div className="flex items-center gap-2 mt-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Real-time Sync Active</span>
               </div>
            </div>
         </div>
         
         {activeBatchSlot && (
            <div className="bg-white px-8 py-5 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col items-end">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Active Slot</span>
               <span className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{formatSlot(activeBatchSlot)}</span>
            </div>
         )}
      </div>

      <div className="mb-16">
        {activeBatchItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {activeBatchItems.map((batch) => (
              <BatchItemCard 
                key={batch.id} 
                batch={batch} 
                isOptimisticPreparing={optimisticPreparingIds.has(batch.id)}
                optimisticPushedQty={optimisticPushes[batch.id] || 0}
                setOptimisticPrep={(id) => setOptimisticPreparingIds(prev => new Set(prev).add(id))}
                registerPush={registerPush}
              />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center">
             <ChefHat className="w-24 h-24 text-slate-100 mb-6" />
             <p className="text-3xl font-black text-slate-900">Queue Satisfied</p>
             <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px] mt-2">All slots up to date</p>
          </div>
        )}
      </div>

      {/* ── Production Pipeline (Upcoming) ── */}
      <div>
         <div className="flex items-center gap-4 mb-8">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
               <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Upcoming Pipeline</h2>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 opacity-40">
            {batches
              .filter(b => b.arrivalTimeSlot !== activeBatchSlot && ['QUEUED', 'PREPARING'].includes(b.status))
              .sort((a,b) => a.arrivalTimeSlot - b.arrivalTimeSlot)
              .slice(0, 10) // Limit display
              .map(batch => (
                <BatchItemCard 
                   key={batch.id} 
                   batch={batch}
                   isOptimisticPreparing={optimisticPreparingIds.has(batch.id)}
                   optimisticPushedQty={optimisticPushes[batch.id] || 0}
                   setOptimisticPrep={(id) => setOptimisticPreparingIds(prev => new Set(prev).add(id))}
                   registerPush={registerPush}
                />
              ))
            }
         </div>
      </div>
    </div>
  );
};

export default CookConsoleWorkspace;
