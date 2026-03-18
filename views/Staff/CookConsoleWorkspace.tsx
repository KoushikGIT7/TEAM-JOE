import React, { useMemo, useEffect, useState } from 'react';
import { Timer, Flame, CheckCircle, ChefHat, Clock } from 'lucide-react';
import { PrepBatch } from '../../types';
import { updateSlotStatus } from '../../services/cook-workflow';

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

const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ batches }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

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

  const activeBatchItems = useMemo(() => {
    const agg: Record<string, { itemName: string; quantity: number }> = {};
    activeBatchSlotBatches.forEach(b => {
      if (!agg[b.itemId]) agg[b.itemId] = { itemName: b.itemName, quantity: 0 };
      agg[b.itemId].quantity += b.quantity;
    });
    return Object.values(agg);
  }, [activeBatchSlotBatches]);

  const upcomingSlots = useMemo(() => {
    const queued = batches.filter(b => b.status === 'QUEUED');
    const upcoming = activeBatchSlot ? queued.filter(b => b.arrivalTimeSlot > activeBatchSlot) : queued;
    
    const slots: Record<number, { itemName: string; quantity: number }[]> = {};
    upcoming.forEach(b => {
      if (!slots[b.arrivalTimeSlot]) slots[b.arrivalTimeSlot] = [];
      const item = slots[b.arrivalTimeSlot].find(i => i.itemName === b.itemName);
      if (item) item.quantity += b.quantity;
      else slots[b.arrivalTimeSlot].push({ itemName: b.itemName, quantity: b.quantity });
    });
    return Object.entries(slots).sort(([a], [b]) => Number(a) - Number(b));
  }, [batches, activeBatchSlot]);

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
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8 flex flex-col gap-10">
        
        {/* ACTIVE SECTION */}
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2 px-1">
             <Flame className="w-4 h-4 text-orange-500" /> Current Production Manifest
          </h3>

          <div className="flex flex-col lg:flex-row gap-6">
             {activeBatchSlot ? (
               <div className={`flex-[2] bg-white border border-slate-200 rounded-2xl p-8 flex flex-col shadow-sm transition-all duration-300 ${
                  activeBatchStatus === 'PREPARING' ? 'border-orange-200 ring-2 ring-orange-50' : 'border-slate-200'
               }`}>
                  <div className="flex justify-between items-start mb-8">
                     <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                          activeBatchStatus === 'PREPARING' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-50 text-slate-400 border-slate-200'
                        }`}>
                           <ChefHat className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                             {activeBatchStatus === 'PREPARING' ? 'Preparing Phase 🟠' : 'Staged for Intake ⚪'}
                           </p>
                           <h2 className="text-5xl font-bold text-slate-900 font-mono tracking-tighter leading-none">
                             {formatSlot(activeBatchSlot)}
                           </h2>
                        </div>
                     </div>
                     <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        getUrgencyText(activeBatchSlot.toString()) === 'Delayed' ? 'bg-red-50 text-red-600' :
                        getUrgencyText(activeBatchSlot.toString()) === 'Start Now' ? 'bg-amber-50 text-amber-600' :
                        'bg-green-50 text-green-600'
                     }`}>
                        {getUrgencyText(activeBatchSlot.toString())}
                     </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 content-start mb-8">
                     {activeBatchItems.map((it, idx) => (
                       <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col justify-between">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide leading-tight mb-1">{it.itemName}</span>
                          <span className="text-3xl font-bold text-slate-900 font-mono">×{it.quantity}</span>
                       </div>
                     ))}
                  </div>

                  <div className="mt-auto pt-4">
                    {activeBatchStatus === 'QUEUED' ? (
                      <button 
                        onClick={() => updateSlotStatus(activeBatchSlot, 'PREPARING')}
                        className="w-full h-16 bg-slate-900 hover:bg-black text-white font-bold text-sm uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-[0.98]"
                      >
                        Start Batch Preparation
                      </button>
                    ) : (
                      <button 
                        onClick={() => updateSlotStatus(activeBatchSlot, 'READY')}
                        className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-bold text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-green-900/10 transition-all active:scale-[0.98]"
                      >
                        Mark as Ready for Pickup
                      </button>
                    )}
                  </div>
               </div>
             ) : (
               <div className="flex-[2] min-h-[300px] border-2 border-slate-200 border-dashed rounded-2xl bg-white flex flex-col items-center justify-center text-slate-300">
                  <ChefHat className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest italic">Operations Idle</p>
               </div>
             )}

             {/* UPCOMING COLUMN */}
             <div className="flex-1 flex flex-col gap-4 w-full lg:w-80 shrink-0">
               {upcomingSlots.length > 0 ? (
                 upcomingSlots.slice(0, 3).map(([slot, items]) => (
                   <div key={slot} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-50">
                        <div className="flex items-center gap-2">
                           <Clock className="w-3 h-3 text-slate-400" />
                           <h4 className="text-lg font-bold text-slate-800 font-mono">{formatSlot(Number(slot))}</h4>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${
                          getUrgencyText(String(slot).padStart(4, '0')) === 'Delayed' ? 'text-red-500' : 'text-slate-400'
                        }`}>{getUrgencyText(String(slot).padStart(4, '0'))}</span>
                      </div>
                      <div className="space-y-1.5">
                         {items.map((it, idx) => (
                           <div key={idx} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">{it.itemName}</span>
                             <span className="text-sm font-bold text-slate-900">×{it.quantity}</span>
                           </div>
                         ))}
                      </div>
                   </div>
                 ))
               ) : (
                  <div className="flex-1 border border-slate-200 border-dashed rounded-2xl flex flex-col items-center justify-center text-slate-300 bg-white/50">
                     <Timer className="w-8 h-8 mb-2 opacity-20" />
                     <p className="text-[9px] font-bold uppercase tracking-wider text-center">Pipeline Empty</p>
                  </div>
               )}
             </div>
          </div>
        </section>

        {/* READY PASS-THROUGH */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600 mb-6 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Transit Station (Waiting for Servers)
          </h3>
          
          {readyBatchesMapping.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {readyBatchesMapping.map(([slot, items]) => (
                <div key={slot} className="bg-green-50 border border-green-100 rounded-xl p-4">
                   <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-green-800 font-mono italic">
                        {formatSlot(Number(slot))}
                      </span>
                      <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest px-2 py-0.5 bg-white rounded border border-green-100">
                        Ready
                      </span>
                   </div>
                   <div className="space-y-1">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-center px-3 py-1.5 bg-white/80 rounded border border-green-50">
                          <span className="text-[9px] font-bold text-slate-600 uppercase">{it.itemName}</span>
                          <span className="text-xs font-bold text-green-700">×{it.quantity}</span>
                        </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="h-20 rounded-xl flex items-center justify-center text-slate-300 bg-slate-50 border border-slate-100 border-dashed">
                <p className="text-[10px] font-bold uppercase tracking-widest">Pass-through is cleared</p>
             </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CookConsoleWorkspace;
