import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, Zap, CheckCircle, PackageCheck } from 'lucide-react';
import { listenToBatches, markBatchReady } from '../../services/firestore-db';
import { PrepBatch, UserProfile } from '../../types';

interface CookViewProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
}

const CookView: React.FC<CookViewProps> = ({ profile, onLogout, onBack }) => {
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [processingItem, setProcessingItem] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenToBatches((live) => {
      // Display only QUEUED and PREPARING batches for the cook
      const active = live.filter(b => b.status === 'QUEUED' || b.status === 'PREPARING');
      setBatches(active);
    });
    return () => unsub();
  }, []);

  const handleMarkReady = async (itemId: string, count?: number) => {
    if (processingItem) return;
    const itemBatches = batches.filter(b => b.itemId === itemId).sort((a, b) => a.createdAt - b.createdAt);
    const targetBatch = itemBatches.find(b => b.status === 'PREPARING') || itemBatches[0];
    if (!targetBatch) return;

    setProcessingItem(itemId);
    try {
        await markBatchReady(targetBatch.id, count);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        setExpandedItemId(null);
    } catch (e) {
        console.error("Mark Ready failed", e);
    } finally {
        setProcessingItem(null);
    }
  };

  const groupedItems = useMemo(() => {
    const itemMap: Record<string, { itemId: string, name: string, count: number, isPreparing: boolean }> = {};
    
    batches.forEach(b => {
        const id = b.itemId || 'GEN';
        if (!itemMap[id]) {
            itemMap[id] = { itemId: id, name: b.itemName || 'Item', count: 0, isPreparing: false };
        }
        itemMap[id].count += (b.items || []).length || b.quantity || 0;
        if (b.status === 'PREPARING') itemMap[id].isPreparing = true;
    });

    return Object.values(itemMap).sort((a, b) => b.count - a.count);
  }, [batches]);

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
      {/* HEADER */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-[1.5rem] flex items-center justify-center">
            <ChefHat className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter">KITCHEN TERMINAL</h1>
            <p className="text-emerald-400/60 font-black tracking-widest uppercase text-[10px] mt-1">Live Preparation Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right mr-6 hidden md:block">
            <div className="text-3xl font-black font-mono">
              {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-gray-500 font-bold tracking-widest text-[10px] uppercase">Live Sync</div>
          </div>
          {onBack && (
            <button onClick={onBack} className="px-6 py-3 bg-white/5 rounded-xl font-bold hover:bg-white/10 active:scale-95 transition-all">
              DASHBOARD
            </button>
          )}
          <button onClick={onLogout} className="px-6 py-3 bg-red-500/10 text-red-400 rounded-xl font-bold hover:bg-red-500/20 active:scale-95 transition-all">
            LOGOUT
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {groupedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <PackageCheck className="w-32 h-32 mb-8 text-white/20" />
            <h2 className="text-4xl font-black tracking-tighter">ALL CLEAR</h2>
            <p className="mt-2 tracking-widest uppercase text-sm font-bold">Waiting for new orders...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {groupedItems.map((item) => {
              const isProcessing = processingItem === item.itemId;
              const isExpanded = expandedItemId === item.itemId;
              
              return (
                <div
                  key={item.itemId}
                  className={`relative overflow-hidden rounded-[3rem] bg-[#0a0a0c] border-4 ${
                     isExpanded ? 'border-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.3)] scale-[1.02]' : 'border-white/5 hover:border-emerald-500/30'
                  } p-8 flex flex-col justify-between aspect-square transition-all duration-300 z-10 ${isExpanded ? 'z-20' : ''}`}
                >
                  {/* Background Pulse / Ripple */}
                  {item.isPreparing && !isProcessing && !isExpanded && (
                      <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
                  )}
                  {isProcessing && (
                      <div className="absolute inset-0 bg-emerald-500/20 animate-pulse" />
                  )}

                  {/* Header Row */}
                  <div className="flex justify-between items-start z-10 w-full mb-4">
                    <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest font-bold text-white/60">
                      KITCHEN STATION
                    </div>
                    {isProcessing ? (
                       <Zap className="w-8 h-8 text-emerald-400 animate-bounce" />
                    ) : isExpanded ? (
                       <button onClick={() => setExpandedItemId(null)} className="w-12 h-12 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:border-red-400 transition-all active:scale-95">
                          <span className="font-bold text-gray-400">✕</span>
                       </button>
                    ) : (
                       <div className="w-12 h-12 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center">
                          <CheckCircle className="w-6 h-6 text-white/20" />
                       </div>
                    )}
                  </div>

                  {/* Body Content */}
                  {isExpanded ? (
                     <div className="flex-1 flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200">
                        <div className="text-center mb-4">
                           <h3 className="text-xl font-black uppercase text-white truncate px-2">{item.name}</h3>
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mt-1">Dispense Quantity</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 flex-1 pb-2">
                           {[1, 2, 3, 4, 5].map(num => (
                              <button 
                                key={num}
                                disabled={!!processingItem || num > item.count}
                                onClick={() => handleMarkReady(item.itemId, num)}
                                className={`rounded-2xl flex items-center justify-center text-2xl font-black transition-all ${
                                   num > item.count 
                                   ? 'bg-transparent border border-white/5 text-white/5 cursor-not-allowed' 
                                   : 'bg-white/5 hover:bg-emerald-500 border border-white/10 hover:border-emerald-400 text-white hover:text-black active:scale-90'
                                }`}
                              >
                                +{num}
                              </button>
                           ))}
                           <button 
                             disabled={!!processingItem}
                             onClick={() => handleMarkReady(item.itemId)}
                             className="bg-emerald-500 hover:bg-emerald-400 border border-emerald-400 rounded-2xl flex items-center justify-center text-[10px] font-black text-black active:scale-90 transition-all uppercase tracking-widest shadow-[0_0_30px_rgba(16,185,129,0.3)] flex-col gap-1"
                           >
                             <CheckCircle className="w-5 h-5 mx-auto" />
                             ALL ({item.count})
                           </button>
                        </div>
                     </div>
                  ) : (
                     <button 
                        onClick={() => {
                           if (item.count === 1) handleMarkReady(item.itemId);
                           else setExpandedItemId(item.itemId);
                        }}
                        className="flex-1 flex flex-col justify-end items-start text-left group-hover:translate-x-2 transition-transform z-10"
                     >
                        <div className="flex items-end gap-3">
                           <span className="text-7xl lg:text-8xl font-black italic tracking-tighter leading-none">{item.count}</span>
                           <span className="text-3xl font-black italic opacity-40 mb-2">x</span>
                        </div>
                        <h3 className="text-3xl lg:text-4xl font-black uppercase tracking-tight text-white/90 leading-tight mt-2">
                          {item.name}
                        </h3>
                     </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default CookView;
