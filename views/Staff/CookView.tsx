import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, CheckSquare, RefreshCw, LogOut, Volume2, VolumeX } from 'lucide-react';
import { listenToBatches, markBatchReady, startBatchPreparation } from '../../services/firestore-db';
import { PrepBatch, UserProfile } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { cseSounds } from '../../utils/audio';

interface CookViewProps {
  profile: UserProfile;
  onLogout: () => void;
  onBack?: () => void;
}

const CookView: React.FC<CookViewProps> = ({ profile, onLogout, onBack }) => {
  const { menuItems } = useApp();
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [processingItem, setProcessingItem] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [systemTime, setSystemTime] = useState('');

  const [audioStatus, setAudioStatus] = useState(cseSounds.getMutedState());

  // Clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Audio subscription
  useEffect(() => {
    return cseSounds.subscribe(() => {
       setAudioStatus(cseSounds.getMutedState());
    });
  }, []);

  // Listen to live database batches
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

    const getMs = (val: any) => {
      if (!val) return 0;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (typeof val === 'number') return val;
      if (val.seconds) return val.seconds * 1000;
      return 0;
    };

    // Get all QUEUED/PREPARING batches for this item, oldest first
    const itemBatches = batches
      .filter(b => b.itemId === itemId && (b.status === 'QUEUED' || b.status === 'PREPARING'))
      .sort((a, b) => getMs(a.createdAt) - getMs(b.createdAt));

    if (itemBatches.length === 0) return;

    // How many batches to mark ready
    const toMark = count ? itemBatches.slice(0, count) : itemBatches;

    setProcessingItem(itemId);
    try {
      await Promise.all(toMark.map(batch => markBatchReady(batch.id)));
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      setExpandedItemId(null);
    } catch (e) {
      console.error("Mark Ready failed", e);
    } finally {
      setProcessingItem(null);
    }
  };

  const handleStartPreparation = async (itemId: string) => {
    if (processingItem) return;

    // Get all QUEUED batches for this item
    const itemBatches = batches.filter(b => b.itemId === itemId && b.status === 'QUEUED');
    if (itemBatches.length === 0) return;

    setProcessingItem(itemId);
    try {
      await Promise.all(itemBatches.map(batch => startBatchPreparation(batch.id)));
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (e) {
      console.error("Start Preparation failed", e);
    } finally {
      setProcessingItem(null);
    }
  };

  const groupedItems = useMemo(() => {
    const itemMap: Record<string, { itemId: string, name: string, count: number, isPreparing: boolean }> = {};

    batches
      .filter(b => b.status === 'QUEUED' || b.status === 'PREPARING')
      .forEach(b => {
        const id = b.itemId || 'GEN';
        if (!itemMap[id]) {
          itemMap[id] = { itemId: id, name: b.itemName || 'Item', count: 0, isPreparing: false };
        }
        itemMap[id].count += 1;
        if (b.status === 'PREPARING') itemMap[id].isPreparing = true;
      });

    return Object.values(itemMap).sort((a, b) => b.count - a.count);
  }, [batches]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white select-none overflow-y-auto pb-12">
      
      {/* Top sticky app bar */}
      <header className="max-w-5xl mx-auto px-6 py-6 flex justify-between items-center border-b border-white/5 bg-zinc-950/85 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <span className="font-mono text-[9px] text-[#ef4444] bg-[#ef4444]/15 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 animate-pulse w-fit mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
              KITCHEN DISPATCH TERMINAL LIVE
            </span>
            <h2 className="font-display text-base font-black text-white">
              Cook Terminal Engine
            </h2>
          </div>
        </div>

        {/* Realtime clock ticker & logout */}
        <div className="flex items-center gap-6">
          <button 
             onClick={async () => {
                if (audioStatus === 'Silent') {
                   await cseSounds.init();
                } else {
                   cseSounds.toggleMute();
                }
             }}
             className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-[9px] font-mono font-black transition active:scale-95 cursor-pointer ${
                audioStatus === 'Connected' 
                   ? 'bg-[#b76dff]/15 border-[#b76dff]/30 text-[#ddb7ff]' 
                   : audioStatus === 'Muted'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
             }`}
          >
             {audioStatus === 'Connected' ? (
                <>
                   <Volume2 className="w-3.5 h-3.5 text-[#ddb7ff]" />
                   <span>AUDIO: CENTRAL ACTIVE</span>
                </>
             ) : audioStatus === 'Muted' ? (
                <>
                   <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                   <span>AUDIO: MUTED</span>
                </>
             ) : (
                <>
                   <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                   <span>AUDIO: SILENT (TAP TO WAKE)</span>
                </>
             )}
          </button>

          <div className="text-right">
            <span className="font-mono text-xs text-[#ddb7ff] font-extrabold block">
              {systemTime || 'CLOCK INITIATING...'}
            </span>
            <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest leading-none">
              REALTIME LOG SYNC
            </span>
          </div>
          <div className="h-10 w-[1px] bg-white/5" />
          {onBack && (
            <button onClick={onBack} className="px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl font-mono text-[10px] font-bold tracking-wider text-zinc-300 hover:text-white transition active:scale-95 cursor-pointer">
              DASHBOARD
            </button>
          )}
          <button onClick={onLogout} className="p-3 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 rounded-xl text-zinc-400 hover:text-rose-500 transition-all cursor-pointer">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main demand visual dashboard */}
      <main className="max-w-5xl mx-auto px-6 mt-8">
        {groupedItems.length === 0 ? (
          // All clear view
          <div className="text-center py-24 border border-white/5 bg-zinc-900/10 rounded-3xl space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-brand-purple/15 border border-brand-purple/20 flex items-center justify-center mx-auto text-brand-purple">
              <CheckSquare className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-extrabold text-white">"ALL CLEAR!"</h3>
              <p className="font-sans text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                Outstanding orders cleared. Take a sip of tea. Cooking queues update automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 px-4 py-3 rounded-2xl">
              <span className="font-bold">Batch Mode Enabled:</span>
              <p>Orders are bundled automatically per meal type to help you prepare food efficiently.</p>
            </div>

            {/* Cooking demand blocks grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {groupedItems.map((item) => {
                const isSelected = expandedItemId === item.itemId;
                const isProcessing = processingItem === item.itemId;
                const menuItem = menuItems.find(m => m.id === item.itemId);
                const imageUrl = menuItem?.imageUrl || '';

                return (
                  <div 
                    key={item.itemId}
                    className={`rounded-3xl overflow-hidden border transition-all duration-300 relative ${
                      isSelected 
                        ? 'border-brand-purple/50 shadow-2xl shadow-brand-purple/5 scale-[1.02]' 
                        : 'border-white/5 bg-zinc-900/20 hover:border-white/10'
                    }`}
                  >
                    {/* Background processing strobe */}
                    {isProcessing && (
                      <div className="absolute inset-0 bg-brand-purple/10 animate-pulse z-0" />
                    )}

                    {/* Cover image header */}
                    <div className="relative h-32 overflow-hidden select-none z-10">
                      {imageUrl ? (
                        <img className="w-full h-full object-cover" alt={item.name} src={imageUrl} />
                      ) : (
                        <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 font-mono text-xs">
                          NO PREVIEW IMAGE
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
                      
                      {/* Big circle volume badge count */}
                      <div className="absolute bottom-3 left-3 bg-purple-600 text-white px-3 py-1 rounded-full font-mono font-black text-xs shadow-md">
                        {item.count}x PREP DEMAND
                      </div>
                    </div>

                    <div className="p-5 space-y-4 relative z-10">
                      <div>
                        <h3 className="font-display font-extrabold leading-tight text-white text-lg truncate">
                          {item.name}
                        </h3>
                        <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
                          Active cooking tickets: {item.count}
                        </span>
                      </div>

                      {/* Expand segments triggers */}
                      {!item.isPreparing ? (
                        <div className="pt-3 border-t border-white/5 flex gap-2">
                          <button
                            disabled={isProcessing}
                            onClick={() => handleStartPreparation(item.itemId)}
                            className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono text-[10px] font-bold tracking-wider flex items-center justify-center cursor-pointer transition disabled:opacity-40"
                          >
                            START COOKING
                          </button>
                        </div>
                      ) : isSelected ? (
                        <div className="space-y-2.5 pt-3 border-t border-white/5 font-mono">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-zinc-400 block font-bold uppercase">
                              Dispatch Ready Counter Qty:
                            </span>
                            <button onClick={() => setExpandedItemId(null)} className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase transition">
                              Cancel
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {/* Increment options based on count scope */}
                            {Array.from({ length: Math.min(item.count, 5) }, (_, i) => i + 1).map(num => (
                              <button
                                key={num}
                                disabled={isProcessing}
                                onClick={() => handleMarkReady(item.itemId, num)}
                                className="px-3 py-1.5 text-[10px] rounded-lg font-bold bg-brand-purple hover:bg-brand-purple-light text-white cursor-pointer shrink-0 disabled:opacity-40 transition"
                              >
                                +{num} READY
                              </button>
                            ))}
                            <button
                              disabled={isProcessing}
                              onClick={() => handleMarkReady(item.itemId)}
                              className="px-3 py-1.5 text-[10px] rounded-lg font-bold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shrink-0 disabled:opacity-40 transition"
                            >
                              ALL ({item.count})
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-white/5 flex gap-2">
                          {item.count === 1 ? (
                            <button
                              disabled={isProcessing}
                              onClick={() => handleMarkReady(item.itemId)}
                              className="w-full h-10 rounded-xl bg-brand-purple hover:bg-brand-purple-light text-white font-mono text-[10px] font-bold tracking-wider flex items-center justify-center cursor-pointer transition disabled:opacity-40"
                            >
                              DISPATCH READY
                            </button>
                          ) : (
                            <button
                              disabled={isProcessing}
                              onClick={() => setExpandedItemId(item.itemId)}
                              className="w-full h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer border border-white/5 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                              BATCH SPLIT ACTIONS
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

    </div>
  );
};

export default CookView;
