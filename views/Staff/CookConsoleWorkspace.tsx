import React, { useMemo, useEffect, useState } from 'react';
import { Timer, Flame, CheckCircle, ChefHat, Clock } from 'lucide-react';
import { PrepBatch } from '../../types';
import { updateSlotStatus } from '../../services/firestore-db';

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

// Returns urgency class based on scheduled slot
// Assuming 15 minutes before slot = Start Now.
const getUrgencyClass = (scheduledSlotStr: string) => {
   const targetTime = new Date();
   const hours = parseInt(scheduledSlotStr.slice(0,2), 10);
   const mins = parseInt(scheduledSlotStr.slice(2,4), 10);
   targetTime.setHours(hours, mins, 0, 0);
   
   const minDiff = (targetTime.getTime() - Date.now()) / 60000;
   
   if (minDiff < 0) return 'border-t-[6px] border-x-0 border-b-0 border-t-red-500'; // Delayed
   if (minDiff <= 15) return 'border-t-[6px] border-x-0 border-b-0 border-t-amber-500'; // Start Now
   return 'border-t-[6px] border-x-0 border-b-0 border-t-green-500'; // On-time
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

const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ batches }) => {
  // Trigger urgency recalculation every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. Current Active Batch (PREPARING or closest QUEUED)
  const activeBatchSlot = useMemo(() => {
    const preparing = batches.find(b => b.status === 'PREPARING' || b.status === 'ALMOST_READY');
    if (preparing) return preparing.arrivalTimeSlot;
    const queued = batches.filter(b => b.status === 'QUEUED').sort((a, b) => a.arrivalTimeSlot - b.arrivalTimeSlot);
    return queued[0]?.arrivalTimeSlot || null;
  }, [batches]);

  const activeBatchSlotBatches = useMemo(() => {
    if (!activeBatchSlot) return [];
    return batches.filter(b => b.arrivalTimeSlot === activeBatchSlot);
  }, [batches, activeBatchSlot]);

  const activeBatchStatus = activeBatchSlotBatches[0]?.status || 'QUEUED';

  // Aggregate by itemName for active batch
  const activeBatchItems = useMemo(() => {
    const agg: Record<string, { itemName: string; quantity: number }> = {};
    activeBatchSlotBatches.forEach(b => {
      if (!agg[b.itemId]) agg[b.itemId] = { itemName: b.itemName, quantity: 0 };
      agg[b.itemId].quantity += b.quantity;
    });
    return Object.values(agg);
  }, [activeBatchSlotBatches]);

  // Upcoming Batches (QUEUED and slot > activeBatchSlot if one is PREPARING)
  const upcomingBatches = useMemo(() => {
    const queued = batches.filter(b => b.status === 'QUEUED');
    // Exclude the active queued/preparing slot from the upcoming visual list
    if (activeBatchSlot) {
      return queued.filter(b => b.arrivalTimeSlot > activeBatchSlot);
    }
    return queued;
  }, [batches, activeBatchSlot]);

  // Aggregate upcoming batches by slot
  const upcomingSlots = useMemo(() => {
    const slots: Record<number, { itemName: string; quantity: number }[]> = {};
    upcomingBatches.forEach(b => {
      if (!slots[b.arrivalTimeSlot]) slots[b.arrivalTimeSlot] = [];
      const item = slots[b.arrivalTimeSlot].find(i => i.itemName === b.itemName);
      if (item) item.quantity += b.quantity;
      else slots[b.arrivalTimeSlot].push({ itemName: b.itemName, quantity: b.quantity });
    });
    return Object.entries(slots).sort(([a], [b]) => Number(a) - Number(b));
  }, [upcomingBatches]);

  // Ready Batches (READY)
  const readyBatchesMapping = useMemo(() => {
    const ready = batches.filter(b => b.status === 'READY');
    const slots: Record<number, { itemName: string; quantity: number }[]> = {};
    ready.forEach(b => {
      if (!slots[b.arrivalTimeSlot]) slots[b.arrivalTimeSlot] = [];
      const item = slots[b.arrivalTimeSlot].find(i => i.itemName === b.itemName);
      if (item) item.quantity += b.quantity;
      else slots[b.arrivalTimeSlot].push({ itemName: b.itemName, quantity: b.quantity });
    });
    return Object.entries(slots).sort(([a], [b]) => Number(a) - Number(b));
  }, [batches]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden h-full">
      {/* Scrollable Workflow Canvas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-10 py-10 flex flex-col">
        
        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2 px-2 shrink-0">
           <Flame className="w-5 h-5 text-indigo-500" /> ACTIVE PRODUCTION
        </h3>

        {/* HERO MATRIX (Active + Conveyor Pipeline) */}
        <div className="flex flex-col lg:flex-row gap-8 mb-12 shrink-0">
           {/* Center: CURRENT PREPARING (Massive Hero Focus) */}
           {activeBatchSlot ? (
             <div className={`flex-[2] border rounded-[2rem] p-10 flex flex-col transition-all duration-500 shadow-xl ${
                activeBatchStatus === 'PREPARING' 
                  ? 'bg-white border-indigo-100 ring-4 ring-indigo-50' 
                  : 'bg-white border-slate-200'
             }`}>
                <div className="flex justify-between items-start mb-10">
                   <div className="flex items-center gap-6">
                      {activeBatchStatus === 'PREPARING' && (
                        <div className="w-20 h-20 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-200 animate-pulse">
                           <Flame className="w-10 h-10" />
                        </div>
                      )}
                      <div>
                         <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                           {activeBatchStatus === 'PREPARING' ? 'Preparing Phase' : 'Next Batch to Start'}
                         </p>
                         <h2 className="text-6xl md:text-7xl font-black text-slate-900 font-mono tracking-tighter leading-none">
                           {formatSlot(activeBatchSlot)} <span className="text-3xl text-slate-300 italic tracking-tight">target</span>
                         </h2>
                      </div>
                   </div>
                   {/* Urgency Badge (if Queued) */}
                   {activeBatchStatus === 'QUEUED' && (
                      <div className={`px-6 py-2 rounded-full font-black text-[11px] uppercase tracking-widest ${
                         getUrgencyText(activeBatchSlot.toString()) === 'Delayed' ? 'bg-red-50 text-red-600' :
                         getUrgencyText(activeBatchSlot.toString()) === 'Start Now' ? 'bg-amber-50 text-amber-600' :
                         'bg-green-50 text-green-600'
                      }`}>
                         {getUrgencyText(activeBatchSlot.toString())}
                      </div>
                   )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 content-start mb-10">
                   {activeBatchItems.map((it, idx) => (
                     <div key={idx} className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 flex flex-col justify-between shadow-inner">
                        <span className="text-xl font-black text-slate-700 leading-tight mb-2 uppercase tracking-wide">{it.itemName}</span>
                        <span className="text-5xl font-black text-indigo-700">×{it.quantity}</span>
                     </div>
                   ))}
                </div>

                <div className="mt-auto">
                  {activeBatchStatus === 'QUEUED' ? (
                    <button 
                      onClick={() => updateSlotStatus(activeBatchSlot, 'PREPARING')}
                      className="w-full py-8 bg-slate-900 text-white font-black text-xl md:text-2xl uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl hover:bg-black transition-all active:scale-[0.98]"
                    >
                      Start Preparing Needs
                    </button>
                  ) : (
                    <button 
                      onClick={() => updateSlotStatus(activeBatchSlot, 'READY')}
                      className="w-full py-8 bg-green-500 hover:bg-green-600 text-white font-black text-xl md:text-2xl uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl shadow-green-200 transition-all active:scale-[0.98]"
                    >
                      Push to Pickup Window
                    </button>
                  )}
                </div>
             </div>
           ) : (
             <div className="flex-[2] min-h-[400px] border-4 border-slate-200 border-dashed rounded-[3rem] bg-white flex flex-col items-center justify-center text-slate-300">
                <ChefHat className="w-20 h-20 mb-6" />
                <p className="text-lg font-black uppercase tracking-[0.2em] italic">All batches completed</p>
                <p className="text-xs font-bold uppercase tracking-widest mt-2">Zero active production</p>
             </div>
           )}

           {/* Right: UPCOMING BATCHES (Conveyor) */}
           <div className="flex-1 flex flex-col gap-6 w-full lg:w-96 shrink-0">
             {upcomingSlots.length > 0 ? (
               upcomingSlots.slice(0, 4).map(([slot, items]) => {
                 const urgencyText = getUrgencyText(String(slot).padStart(4, '0'));
                 const urgencyClass = getUrgencyClass(String(slot).padStart(4, '0'));
                 
                 return (
                 <div key={slot} className={`bg-white rounded-3xl p-6 shadow-md shadow-slate-200/50 flex flex-col border border-slate-100 ${urgencyClass} relative overflow-hidden`}>
                    <div className="flex justify-between items-start mb-6">
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-2"><Clock className="w-3 h-3" /> Target Finish</p>
                          <h4 className="text-3xl font-black text-slate-800 font-mono tracking-tighter">{formatSlot(Number(slot))}</h4>
                       </div>
                       <span className={`text-[10px] font-black uppercase tracking-widest ${
                          urgencyText === 'Delayed' ? 'text-red-500' :
                          urgencyText === 'Start Now' ? 'text-amber-500' :
                          'text-green-500'
                       }`}>{urgencyText}</span>
                    </div>
                    
                    <div className="space-y-2">
                       {items.map((it, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl border border-slate-100/50">
                           <span className="text-sm font-black text-slate-700 uppercase">{it.itemName}</span>
                           <span className="text-lg font-black text-slate-900">×{it.quantity}</span>
                         </div>
                       ))}
                    </div>
                 </div>
               )})
             ) : (
                <div className="flex-1 border-2 border-slate-200 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50">
                   <Timer className="w-10 h-10 mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-center">No Incoming Work<br/>Pipelines Empty</p>
                </div>
             )}
           </div>
        </div>

        {/* BOTTOM: PRODUCTION READY (Pass-through View) */}
        <div className="shrink-0 pt-8 border-t border-slate-200 mt-auto">
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-green-700 mb-6 flex items-center gap-2 px-2">
            <CheckCircle className="w-5 h-5 bg-green-100 rounded-full" /> PASS-THROUGH AREA (WAITING FOR SERVERS)
          </h3>
          
          {readyBatchesMapping.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
              {readyBatchesMapping.map(([slot, items]) => (
                <div key={slot} className="bg-green-50 border border-green-200 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-16 h-16 bg-green-100/50 rounded-bl-[4rem]" />
                   <div className="flex items-center justify-between mb-6 relative">
                      <span className="text-2xl font-black text-green-800 font-mono tracking-tighter">
                        {formatSlot(Number(slot))}
                      </span>
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-widest px-3 py-1 bg-green-100 rounded-full">
                        Ready
                      </span>
                   </div>
                   <div className="space-y-2">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center px-4 py-2 bg-white rounded-xl border border-green-50">
                          <span className="text-xs font-black text-slate-700 uppercase">{it.itemName}</span>
                          <span className="text-lg font-black text-green-700">×{it.quantity}</span>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="h-24 rounded-[2rem] flex items-center justify-center text-slate-300 bg-white border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Pass-through is cleared</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookConsoleWorkspace;
