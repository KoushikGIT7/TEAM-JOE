import React, { useMemo, useEffect, useState } from 'react';
import { Timer, Flame, CheckCircle, ChefHat, Clock, Play, Check, AlertTriangle } from 'lucide-react';
import { PrepBatch } from '../../types';
import { startBatchPreparation, markBatchReady } from '../../services/cook-workflow';
import { addGlobalDelay } from '../../services/firestore-db';

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

const getUrgencyText = (scheduledSlotStr: string) => {
   const targetTime = new Date();
   const hours = parseInt(scheduledSlotStr.slice(0,2), 10);
   const mins = parseInt(scheduledSlotStr.slice(2,4), 10);
   targetTime.setHours(hours, mins, 0, 0);
   
   const minDiff = (targetTime.getTime() - Date.now()) / 60000;
   
   if (minDiff < 0) return 'Delayed';
   if (minDiff <= 15) return 'Start Now';
   return 'On-Time';
};

const BatchItemCard = ({ batch }: { batch: PrepBatch }) => {
   const [isProcessing, setIsProcessing] = useState(false);

   const onStart = async () => {
       setIsProcessing(true);
       try { await startBatchPreparation(batch.id); } 
       catch(e) { console.error("Start prep failed:", e); } 
       finally { setIsProcessing(false); }
   };

   const onRelease = async (count?: number) => {
       setIsProcessing(true);
       try { await markBatchReady(batch.id, count); } 
       catch(e) { console.error("Release failed:", e); } 
       finally { setIsProcessing(false); }
   };

   const isPreparing = batch.status === 'PREPARING';

   return (
      <div className={`p-5 rounded-3xl border-2 flex flex-col justify-between transition-all group ${
         isPreparing ? 'border-orange-400 bg-orange-50/20 shadow-lg shadow-orange-900/5' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}>
          <div className="flex justify-between items-start mb-6">
              <div>
                 <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                    isPreparing ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                 }`}>
                    {isPreparing ? 'Cooking' : 'Queued'}
                 </span>
                 <h3 className="text-2xl lg:text-3xl font-black text-slate-900 mt-3 uppercase tracking-tighter leading-none">{batch.itemName}</h3>
              </div>
              <div className={`text-4xl lg:text-5xl font-black italic font-mono ${isPreparing ? 'text-orange-600' : 'text-slate-900'}`}>
                ×{batch.quantity}
              </div>
          </div>
          
          <div className="mt-auto">
              {!isPreparing ? (
                 <button 
                   disabled={isProcessing}
                   onClick={onStart}
                   className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-[11px] active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2 hover:bg-black disabled:opacity-50"
                 >
                    {isProcessing ? <Timer className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} Start Preparing
                 </button>
              ) : (
                 <div className="flex flex-col gap-2">
                    <div className="flex gap-2 w-full">
                       {[1, 2, 3, 4].filter(num => num < batch.quantity).map(num => (
                          <button 
                            key={num}
                            disabled={isProcessing}
                            onClick={() => onRelease(num)}
                            className="flex-1 border-2 border-orange-500 text-orange-600 rounded-2xl py-3.5 font-black tracking-tighter text-sm active:scale-95 transition-all hover:bg-orange-50 disabled:opacity-50 bg-white shadow-sm"
                          >
                            +{num}
                          </button>
                       ))}
                    </div>
                    <button 
                      disabled={isProcessing}
                      onClick={() => onRelease()}
                      className="w-full bg-orange-500 text-white rounded-2xl py-4 font-black uppercase tracking-widest text-[11px] active:scale-[0.98] transition-all shadow-xl shadow-orange-500/20 hover:bg-orange-600 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-5 h-5" /> Push All ({batch.quantity})
                    </button>
                 </div>
               )}
          </div>
      </div>
   );
};


const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ batches }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. Identify active slot
  const activeBatchSlot = useMemo(() => {
    const preparing = batches.find(b => b.status === 'PREPARING');
    if (preparing) return preparing.arrivalTimeSlot;
    
    const queuedItems = batches.filter(b => b.status === 'QUEUED' && b.quantity > 0)
                               .sort((a, b) => a.arrivalTimeSlot - b.arrivalTimeSlot);
    return queuedItems[0]?.arrivalTimeSlot || null;
  }, [batches]);

  // 2. Identify specific items inside the active slot
  const activeBatchItems = useMemo(() => {
    if (!activeBatchSlot) return [];
    return batches.filter(b => 
       b.arrivalTimeSlot === activeBatchSlot && 
       b.quantity > 0 && 
       ['QUEUED', 'PREPARING'].includes(b.status)
    ).sort((a, b) => a.status === 'PREPARING' ? -1 : 1);
  }, [batches, activeBatchSlot]);

  // 3. Upcoming Slots (ignoring active slot)
  const productionFeed = useMemo(() => {
    const validBatches = batches.filter(b => 
      ['QUEUED', 'PREPARING'].includes(b.status) &&
      (b.quantity > 0) &&
      b.arrivalTimeSlot !== activeBatchSlot
    );
    const groups: Record<number, PrepBatch[]> = {};
    validBatches.forEach(b => {
      const slot = b.arrivalTimeSlot;
      if (!groups[slot]) groups[slot] = [];
      groups[slot].push(b);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  }, [batches, activeBatchSlot]);

  return (
    <div className="flex-1 flex bg-slate-50 relative overflow-hidden h-full">
       
      {/* LEFT: MAIN ACTIVE BOARD */}
      <div className="flex-[3] overflow-y-auto custom-scrollbar p-8 border-r border-slate-200">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" /> Current Target Slot
           </h3>
           <button 
             onClick={async () => {
               if (window.confirm('Add +5 Mins delay to all incoming orders? This alerts all waiting students.')) {
                 try { await addGlobalDelay(5); alert("Global Kitchen Delay Activated (+5 Mins)"); } 
                 catch(e) { console.error(e); alert("Failed to add delay"); }
               }
             }}
             className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all hover:bg-red-100 shadow-sm"
           >
             <AlertTriangle className="w-4 h-4" /> Panic: +5 Mins
           </button>
         </div>

         {activeBatchSlot ? (
            <div>
               <div className="flex items-center gap-5 mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-900 text-white shadow-xl">
                     <ChefHat className="w-8 h-8" />
                  </div>
                  <div className="flex-1">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                       Target Window
                     </p>
                     <h2 className="text-4xl font-black text-slate-900 font-mono tracking-tighter leading-none flex items-center gap-4">
                       {formatSlot(activeBatchSlot)}
                       <span className={`px-4 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-widest ${
                          getUrgencyText(activeBatchSlot.toString()) === 'Delayed' ? 'bg-red-100 text-red-700 font-sans italic' :
                          getUrgencyText(activeBatchSlot.toString()) === 'Start Now' ? 'bg-orange-100 text-orange-700 font-sans italic' :
                          'bg-green-100 text-green-700 font-sans'
                       }`}>
                          {getUrgencyText(activeBatchSlot.toString())}
                       </span>
                     </h2>
                  </div>
               </div>

               {/* COMPACT PER-ITEM CARDS */}
               <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                   {activeBatchItems.map(batch => (
                      <BatchItemCard key={batch.id} batch={batch} />
                   ))}
               </div>
            </div>
         ) : (
            <div className="min-h-[400px] border-2 border-slate-200 border-dashed rounded-[3rem] bg-white flex flex-col items-center justify-center text-slate-300">
               <ChefHat className="w-16 h-16 mb-5 opacity-20" />
               <p className="text-sm font-black uppercase tracking-[0.3em] opacity-50">Kitchen is Clear</p>
            </div>
         )}
      </div>

      {/* RIGHT: UPCOMING QUEUE (No scroll pollution) */}
      <div className="flex-1 max-w-sm flex flex-col bg-white shrink-0">
         <div className="p-6 border-b border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
               <Timer className="w-4 h-4" /> Pipeline Feed
            </h4>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {productionFeed.length > 0 ? (
               productionFeed.map(([slot, batchesInSlot]) => {
                  return (
                     <div key={slot} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-base font-bold text-slate-800 font-mono tracking-tighter">
                            {formatSlot(Number(slot))}
                          </h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest ${
                            getUrgencyText(String(slot).padStart(4, '0')) === 'Delayed' ? 'text-red-500' : 'text-slate-400'
                          }`}>{getUrgencyText(String(slot).padStart(4, '0'))}</span>
                        </div>
                        <div className="space-y-1.5">
                           {batchesInSlot.map((b, idx) => (
                             <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl shadow-sm border border-slate-100/50">
                               <span className="text-[10px] font-bold text-slate-500 uppercase">{b.itemName}</span>
                               <span className="text-sm font-black text-slate-900 font-mono">×{b.quantity}</span>
                             </div>
                           ))}
                        </div>
                     </div>
                  );
               })
            ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-4">
                  <Clock className="w-10 h-10 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">No remaining<br/>upcoming slots</p>
               </div>
            )}
         </div>
      </div>

    </div>
  );
};

export default CookConsoleWorkspace;
