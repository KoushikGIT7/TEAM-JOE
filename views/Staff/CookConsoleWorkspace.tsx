import React, { useMemo } from 'react';
import { Clock, Timer, Flame, CheckCircle, ChefHat } from 'lucide-react';
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

const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ batches }) => {
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
    // If we are currently PREPARING a slot, don't show it in upcoming
    if (activeBatchStatus === 'PREPARING' && activeBatchSlot) {
      return queued.filter(b => b.arrivalTimeSlot > activeBatchSlot);
    }
    // Else, exclude the active queued one
    if (activeBatchSlot) {
      return queued.filter(b => b.arrivalTimeSlot > activeBatchSlot);
    }
    return queued;
  }, [batches, activeBatchSlot, activeBatchStatus]);

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
  const readyBatches = useMemo(() => {
    // We group by slot for consistency
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
    <div className="flex-1 flex flex-col bg-[#FDFDFD] h-full overflow-y-auto px-10 py-6 custom-scrollbar">
      {/* TOP: UPCOMING BATCHES */}
      <div className="mb-8 border-b border-slate-100 pb-8 shrink-0">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Upcoming Batches
        </h3>
        {upcomingSlots.length > 0 ? (
          <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
            {upcomingSlots.map(([slot, items]) => (
              <div key={slot} className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm min-w-[280px]">
                <h4 className="text-xl font-black text-slate-800 font-mono mb-4">{formatSlot(Number(slot))} Batch</h4>
                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded-xl">
                      <span className="text-sm font-bold text-slate-700">{it.itemName}</span>
                      <span className="text-lg font-black text-slate-900">×{it.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
             <div className="h-24 border-2 border-slate-50 border-dashed rounded-3xl flex items-center justify-center text-slate-300">
                <Timer className="w-6 h-6 mr-3" />
                <p className="text-xs font-black uppercase tracking-widest">No Incoming Work</p>
             </div>
        )}
      </div>

      {/* CENTER: CURRENT PREPARING */}
      <div className="flex-1 mb-8 shrink-0 flex flex-col">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-600 mb-6 flex items-center gap-2">
          <Flame className="w-5 h-5" /> Currently Preparing
        </h3>
        
        {activeBatchSlot ? (
          <div className={`flex-1 border-4 rounded-[3rem] p-10 flex flex-col transition-all duration-500 shadow-2xl ${
             activeBatchStatus === 'PREPARING' 
               ? 'bg-white border-indigo-600 shadow-indigo-100' 
               : 'bg-slate-50 border-slate-200'
          }`}>
             <div className="flex items-center gap-4 mb-8">
                {activeBatchStatus === 'PREPARING' && (
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 animate-pulse">
                     <Flame className="w-8 h-8" />
                  </div>
                )}
                <div>
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                     {activeBatchStatus === 'PREPARING' ? 'Now Preparing' : 'Next Batch to Start'}
                   </p>
                   <h2 className="text-5xl font-black text-slate-900 font-mono tracking-tighter">
                     {formatSlot(activeBatchSlot)} Batch
                   </h2>
                </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-6 flex-1 content-start mb-10">
                {activeBatchItems.map((it, idx) => (
                  <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                     <span className="text-xl font-bold text-slate-700 leading-tight mb-4">{it.itemName}</span>
                     <span className="text-4xl font-black text-slate-900">×{it.quantity}</span>
                  </div>
                ))}
             </div>

             <div className="mt-auto">
               {activeBatchStatus === 'QUEUED' ? (
                 <button 
                   onClick={() => updateSlotStatus(activeBatchSlot, 'PREPARING')}
                   className="w-full py-6 bg-slate-900 text-white font-black text-xl uppercase tracking-[0.2em] rounded-2xl shadow-xl hover:bg-black transition-all active:scale-[0.98]"
                 >
                   Start Preparing
                 </button>
               ) : (
                 <button 
                   onClick={() => updateSlotStatus(activeBatchSlot, 'READY')}
                   className="w-full py-6 bg-green-500 hover:bg-green-600 text-white font-black text-xl uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-green-200 transition-all active:scale-[0.98]"
                 >
                   Mark Ready
                 </button>
               )}
             </div>
          </div>
        ) : (
          <div className="flex-1 min-h-[300px] border-2 border-slate-50 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-slate-300">
             <ChefHat className="w-16 h-16 mb-4" />
             <p className="text-sm font-black uppercase tracking-widest italic">All batches completed</p>
          </div>
        )}
      </div>

      {/* BOTTOM: READY BATCHES */}
      <div className="shrink-0 border-t border-slate-100 pt-8 mt-4">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-green-600 mb-6 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" /> Ready for Pickup
        </h3>
        
        {readyBatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
            {readyBatches.map(([slot, items]) => (
              <div key={slot} className="bg-green-50/50 border border-green-200 rounded-[2rem] p-6 shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-green-700 uppercase tracking-widest bg-green-100 px-3 py-1 rounded-full">
                      Ready
                    </span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                      {formatSlot(Number(slot))}
                    </span>
                 </div>
                 <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center px-4 py-2 bg-white rounded-xl border border-green-50">
                        <span className="text-sm font-bold text-slate-700">{it.itemName}</span>
                        <span className="text-lg font-black text-slate-900">×{it.quantity}</span>
                      </div>
                    ))}
                 </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="h-24 border-2 border-slate-50 border-dashed rounded-[2rem] flex items-center justify-center text-slate-200">
              <p className="text-xs font-black uppercase tracking-widest">Nothing ready yet</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default CookConsoleWorkspace;
