import React, { useMemo, useState, useEffect } from 'react';
import {
  ChefHat, Zap, CheckCircle2, Sparkles, Filter, Lock, Clock
} from 'lucide-react';
import { PrepBatch } from '../../types';
import { startBatch, finalizeBatch } from '../../services/firestore-db';
import { safeListener } from '../../services/safeListener';
import {
  collection, query, where, orderBy, onSnapshot,
  limit
} from 'firebase/firestore';
import { db, auth } from '../../firebase';

interface CookConsoleWorkspaceProps {
  initialStationId?: string;
  isMobile?: boolean;
  isPassive?: boolean;
}

/**
 * 🍳 [COOK CONSOLE] Real-time kitchen production hub.
 *
 * Data flow:
 *   prepBatches {status IN [QUEUED, PREPARING]} ──onSnapshot──► this component
 *
 * Rules:
 *  • Cook ONLY reads from prepBatches — NEVER from orders directly.
 *  • Client-side sort ensures FIFO even if cloud index is still building.
 *  • Auto-fallback to non-ordered query if index is missing (FAILED_PRECONDITION).
 */
const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ 
  initialStationId = 'ALL',
  isMobile = false,
  isPassive = false
}) => {
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeStation, setActiveStation] = useState(initialStationId);
  const [processingMap, setProcessingMap] = useState<Record<string, boolean>>({});
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({});
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
       window.removeEventListener('online', onOnline);
       window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIMARY LISTENER — status IN [QUEUED, PREPARING] + orderBy createdAt
  // Uses safeListener: auto-detects missing index, retries on transient errors,
  // falls back to simplified query (no orderBy) while index builds.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log('🔥 [COOK-CONSOLE] Activating safe listener...');

    const primaryQ = query(
      collection(db, 'prepBatches'),
      where('status', 'in', ['QUEUED', 'PREPARING']),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    const fallbackQ = query(
      collection(db, 'prepBatches'),
      where('status', 'in', ['QUEUED', 'PREPARING']),
      limit(50)
    );

    const unsub = safeListener(
      'cook-console-batches',
      primaryQ,
      (snapshot) => snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as PrepBatch[],
      () => [] as PrepBatch[],
      (live) => {
        console.log(`🔥 [COOK-CONSOLE] Live batches: ${live.length}`);
        setBatches(live);
      },
      fallbackQ
    );

    return () => { unsub(); };
  }, []); // single mount — safeListener handles all index/retry logic internally

  // ── Available stations from live data ──────────────────────────────────────
  const stations = useMemo(() => {
    const ids = new Set(batches.map(b => b.stationId).filter(Boolean) as string[]);
    return ['ALL', 'GENERAL', ...Array.from(ids)];
  }, [batches]);

  // ── FIFO sort on client (guarantees order even without cloud index) ──────────
  const sortedItems = useMemo(() => {
    const activeBatches = batches
      .map(b => ({ ...b, status: optimisticStatus[b.id] ?? b.status }))
      .filter(b =>
        (activeStation === 'ALL' || b.stationId === activeStation) &&
        (b.status === 'QUEUED' || b.status === 'PREPARING')
      );

    const flattened = activeBatches.flatMap(b => 
      (b.items || []).flatMap((it: any) => {
          const units = it.quantity || 1;
          const result = [];
          for (let i = 0; i < units; i++) {
              result.push({
                ...it,
                unitIndex: i,
                batchId: b.id,
                batchStatus: b.status,
                batchCreatedAt: (b.createdAt as any)?.toMillis?.() ?? (b.createdAt as number) ?? 0,
                stationId: b.stationId,
                fullBatchItems: b.items,
                // 🆔 [UNIT-UNIQUE-IDENTITY]: Crucial for React focus logic
                id: `${b.id}_${it.itemId}_${i}` 
              });
          }
          return result;
      })
    );

    const stationCounts: Record<string, number> = {};
    flattened.forEach(it => { stationCounts[it.stationId] = (stationCounts[it.stationId] || 0) + 1; });

    // 🛡️ [ANTI-OVERLOAD] Focus Mode: Only show 4 active and 4 upcoming units
    const stationCapacity = activeStation === 'dosa' ? 4 : (isMobile ? 2 : 8); 
    
    // Sort READY queue by readyAt ASC, paidAt ASC
    return flattened.sort((a, b) => {
      // READY state should ideally be out of this particular focus view, but if present:
      if (a.batchStatus === 'READY' && b.batchStatus !== 'READY') return 1;
      if (b.batchStatus === 'READY' && a.batchStatus !== 'READY') return -1;
      
      // PREPARING always top
      if (a.batchStatus === 'PREPARING' && b.batchStatus !== 'PREPARING') return -1;
      if (b.batchStatus === 'PREPARING' && a.batchStatus !== 'PREPARING') return 1;

      // Primary FIFO within status
      return (a.batchCreatedAt || 0) - (b.batchCreatedAt || 0);
    }).slice(0, stationCapacity * 2); 
  }, [batches, optimisticStatus, activeStation, isMobile]);

  const activeItemsSlice = useMemo(() => (sortedItems || []).slice(0, 2), [sortedItems]);

  // Reconcile optimistic overrides when Firestore confirms
  useEffect(() => {
    if (!batches) return;
    setOptimisticStatus(prev => {
      const next = { ...prev };
      let changed = false;
      batches.forEach(b => { if (next[b.id] === b.status) { delete next[b.id]; changed = true; } });
      return changed ? next : prev;
    });
  }, [batches]);

  // 🧠 [RHYTHM-MODE] FIX 5: Soft delay before refill
  const [focus, setFocus] = useState<any>(null);
  useEffect(() => {
    const nextFocus = activeItemsSlice[0];
    
    // ⚡ [LIVE-SYNC]: Update focus if ID changes OR if the status of the current item updates
    if (nextFocus?.id !== focus?.id || nextFocus?.batchStatus !== focus?.batchStatus) {
       // Identity change gets a transition; Status change is instant for speed
       if (nextFocus?.id !== focus?.id) {
          const timer = setTimeout(() => setFocus(nextFocus), 150);
          return () => clearTimeout(timer);
       } else {
          setFocus(nextFocus);
       }
    }
  }, [activeItemsSlice, focus?.id, focus?.batchStatus]);

  const handleStart = async (batchId: string, items: any[]) => {
    if (!navigator.onLine) return alert("Waiting for connection...");
    if (processingMap[batchId]) return;
    
    // 📳 [HAPTIC-PULSE]
    if (window.navigator.vibrate) window.navigator.vibrate(40);

    setOptimisticStatus(p => ({ ...p, [batchId]: 'PREPARING' }));
    setProcessingMap(p => ({ ...p, [batchId]: true }));
    try {
      await startBatch(batchId, items, auth.currentUser?.uid);
      setLastAction('Cooking Started ⚡');
      setTimeout(() => setLastAction(null), 2000);
    } catch {
      setOptimisticStatus(p => { const n = { ...p }; delete n[batchId]; return n; });
    } finally {
      setProcessingMap(p => ({ ...p, [batchId]: false }));
    }
  };

  const handleFinalize = async (batchId: string, items: any[], count?: number) => {
    if (!navigator.onLine) return alert("Waiting for connection...");
    if (processingMap[batchId]) return;
    
    // 📳 [HAPTIC-PULSE]
    if (window.navigator.vibrate) window.navigator.vibrate([40, 20, 60]);

    // Only use optimistic state for full batch finalization
    if (!count) setOptimisticStatus(p => ({ ...p, [batchId]: 'READY' }));
    
    setProcessingMap(p => ({ ...p, [batchId]: true }));
    try {
      await finalizeBatch(batchId, items, count);
      setLastAction(count ? `Released ${count} item(s) ⚡` : 'Batch Ready ✓');
      setTimeout(() => setLastAction(null), 2000);
    } catch {
      if (!count) setOptimisticStatus(p => { const n = { ...p }; delete n[batchId]; return n; });
    } finally {
      setProcessingMap(p => ({ ...p, [batchId]: false }));
    }
  };

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (sortedItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] relative">
        <StationBar stations={stations} active={activeStation} setActive={setActiveStation} fallback={false} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-20 select-none">
          <div className="w-32 h-32 rounded-[3rem] bg-white/5 border-4 border-white/10 flex items-center justify-center mb-8">
            <Sparkles className="w-12 h-12 text-white/20" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-3">
             Pipeline Clear
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
            Waiting for kitchen manifests...
          </p>
        </div>
      </div>
    );
  }

  // ── MAIN LAYOUT ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] overflow-hidden relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      {lastAction && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-emerald-500 text-white px-8 py-3 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-emerald-500/20 flex items-center gap-3">
            <Zap className="w-4 h-4 fill-current" />{lastAction}
          </div>
        </div>
      )}

      <StationBar stations={stations} active={activeStation} setActive={setActiveStation} fallback={false} />

      <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* ── SIDEBAR QUEUE ───────────────────────────────────────────── */}
        {!isPassive && (
          <div className={`${isMobile ? 'h-32 border-b border-white/5' : 'w-80 border-r border-white/5'} flex flex-col bg-white/[0.01]`}>
          <div className={`${isMobile ? 'hidden' : 'p-6 border-b border-white/5'}`}>
            <h2 className="text-white font-black uppercase italic tracking-tight text-lg">Focus Pipeline</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
              {sortedItems.length < 5 ? 'Stable Flow' : 'High Velocity'} • {sortedItems.length} units
            </p>
          </div>
          <div className={`flex-1 overflow-x-auto overflow-y-hidden ${isMobile ? 'p-2 flex flex-row gap-2' : 'p-4 space-y-3'}`}>
            {sortedItems.map((it, i) => {
              const isActive = i < (activeStation === 'dosa' ? 4 : (isMobile ? 2 : 8));
              return (
                <div
                  key={`${it.batchId}-${it?.id ?? i}-${i}`}
                  className={`${isMobile ? 'p-2 rounded-xl' : 'p-5 rounded-[1.5rem]'} border transition-all ${isActive ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] ring-2 ring-emerald-500/20' : 'bg-white/[0.02] border-white/5 opacity-30'} ${it.batchStatus === 'PREPARING' ? 'animate-[pulse_3s_infinite]' : ''}`}
                >
                  <div className={`flex items-center justify-between ${isMobile ? 'mb-1' : 'mb-3'} text-[7px] lg:text-[9px] font-black uppercase tracking-widest`}>
                    <div className="flex items-center gap-1.5">
                       <span className={it?.batchStatus === 'PREPARING' ? 'text-emerald-400 font-black' : 'text-white/40'}>
                         {isActive ? '🔥 NOW' : '⏳ NEXT'}
                       </span>
                       {it?.ownerId && !isPassive && (
                         <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-sm border border-white/10">
                           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                           <span className="text-white/60 font-black tracking-tighter">
                             {it.ownerId === auth.currentUser?.uid ? 'YOU' : 'TAKEN'}
                           </span>
                         </div>
                       )}
                    </div>
                    <span className={`text-white/20 ${isMobile ? 'hidden' : 'block'}`}>{it?.stationId ?? 'GEN'}</span>
                  </div>
                  <h3 className={`text-white font-bold ${isMobile ? 'text-[10px] leading-tight truncate' : 'text-base truncate'}`}>
                    {it?.name ?? 'Loading...'}
                  </h3>
                  <div className={`flex items-center gap-1 mt-0.5 ${isMobile ? 'flex-col items-start' : ''}`}>
                    <p className={`${isMobile ? 'text-[7px]' : 'text-[10px]'} text-slate-500 font-bold uppercase`}>#{it?.orderId?.slice(-4).toUpperCase() ?? '####'}</p>
                    {(it?.unitIndex ?? 0) > 0 && <span className={`${isMobile ? 'text-[6px]' : 'text-[9px]'} bg-white/5 text-white/40 px-1 rounded`}>P{(it?.unitIndex ?? 0) + 1}</span>}
                  </div>
                </div>
              );
            })}
            
          </div>
        </div>
        )}

        {/* ── MAIN PAN ────────────────────────────────────────────────── */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-10'}`}>
          {focus && (
            <div className={`max-w-3xl mx-auto ${isPassive ? 'pointer-events-none' : ''}`}>
              <div className={`flex items-center justify-between ${isMobile ? 'mb-4' : 'mb-10'}`}>
                <div className="flex items-center gap-4">
                  {(focus?.ownerId && focus.ownerId !== auth.currentUser?.uid) && (
                    <div className="w-10 h-10 lg:w-16 lg:h-16 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center animate-pulse">
                      <Lock className="w-5 h-5 lg:w-8 lg:h-8 text-rose-500" />
                    </div>
                  )}
                  <div>
                    <span className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[8px] lg:text-[10px] mb-0.5 lg:mb-1 block">{(focus?.stationId ?? 'GEN')} STATION</span>
                    <h1 className={`${isMobile ? 'text-2xl' : 'text-5xl'} font-black text-white uppercase italic tracking-tighter`}>
                      {isPassive ? 'Live Mirror' : 'Kitchen Batch'}
                    </h1>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] lg:text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Order ID</p>
                  <span className={`${isMobile ? 'text-4xl' : 'text-8xl'} font-black text-white tracking-widest leading-none font-mono drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]`}>
                    #{focus?.id?.slice(-4).toUpperCase() ?? '####'}
                  </span>
                </div>
              </div>
 
              <div className={`bg-white/[0.03] border border-white/10 rounded-[2rem] lg:rounded-[3rem] ${isMobile ? 'p-4' : 'p-10'} ${focus.batchStatus === 'PREPARING' ? 'ring-4 ring-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : ''}`}>
                <div className={`${isMobile ? 'space-y-2 mb-4' : 'space-y-4 mb-10'}`}>
                  {(focus?.fullBatchItems ?? []).map((it: any, i: number) => (
                    <div key={`${it?.batchId ?? 'b'}-${i}`} className={`flex items-center justify-between ${isMobile ? 'p-3 rounded-xl' : 'p-6 rounded-[2rem]'} bg-white/[0.04] border border-white/10 shadow-xl ${focus.batchStatus === 'PREPARING' ? 'border-emerald-500/30' : ''}`}>
                      <div>
                        <h4 className={`${isMobile ? 'text-base' : 'text-2xl'} font-black text-white italic truncate`}>{it?.name ?? 'Item'}</h4>
                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Item Unit</p>
                      </div>
                      <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">#{it?.orderId?.slice(-4).toUpperCase() ?? '####'}</span>
                    </div>
                  ))}
                </div>
 
                {isPassive ? (
                   <div className="py-12 text-center animate-in fade-in zoom-in slide-in-from-bottom-4 duration-700">
                     <div className="inline-block px-10 py-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-6">
                       <p className="text-emerald-500 font-black uppercase tracking-[0.5em] text-[12px] animate-pulse">LIVE PREPARATION IN PROGRESS</p>
                     </div>
                     <p className="text-white/10 font-black uppercase tracking-[0.2em] text-[9px]">Passive Mirror Terminal • ID: #{(focus?.stationId ?? 'GEN').toUpperCase()}</p>
                   </div>
                ) : focus.batchStatus === 'QUEUED' ? (
                  <button
                    onClick={() => handleStart(focus.batchId, focus.fullBatchItems)}
                    disabled={!!processingMap[focus.batchId] || isOffline}
                    className={`${isMobile ? 'h-16' : 'h-20'} w-full bg-white text-black rounded-2xl lg:rounded-[1.5rem] font-black ${isMobile ? 'text-base' : 'text-lg'} uppercase italic tracking-tight flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50`}
                  >
                    <Zap className="w-5 h-5 lg:w-7 lg:h-7 fill-current" /> {isOffline ? "RECONNECTING..." : "Start Cooking"}
                  </button>
                ) : (() => {
                  const isOwner = !focus.ownerId || focus.ownerId === auth.currentUser?.uid;
                  return (
                    <div className="flex flex-col gap-3 lg:gap-4">
                      <button
                        onClick={() => handleFinalize(focus.batchId, focus.fullBatchItems)}
                        disabled={!!processingMap[focus.batchId] || !isOwner || isOffline}
                        className={`${isMobile ? 'h-16' : 'h-20'} w-full bg-emerald-500 text-white rounded-2xl lg:rounded-[1.5rem] font-black ${isMobile ? 'text-base' : 'text-lg'} uppercase italic tracking-tight flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-2xl shadow-emerald-500/20 disabled:opacity-50`}
                      >
                        {isOffline ? <><Clock className="w-5 h-5 lg:w-7 lg:h-7 animate-spin" /> Sync...</> : 
                         isOwner ? <><CheckCircle2 className="w-5 h-5 lg:w-7 lg:h-7" /> Complete All</> : <><Lock className="w-5 h-5 lg:w-7 lg:h-7" /> Busy</>}
                      </button>
                      
                      {focus.fullBatchItems?.length > 1 && (
                        <button
                          onClick={() => handleFinalize(focus.batchId, focus.fullBatchItems, 1)}
                          disabled={!!processingMap[focus.batchId] || !isOwner || isOffline}
                          className={`${isMobile ? 'h-12' : 'h-16'} w-full bg-white/[0.05] border border-white/10 text-white rounded-2xl lg:rounded-[1.5rem] font-black ${isMobile ? 'text-[10px]' : 'text-sm'} uppercase italic tracking-widest flex items-center justify-center gap-3 hover:bg-white/[0.1] transition-all disabled:opacity-50`}
                        >
                          <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-emerald-500" /> Push Single Item
                         </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── SHARED STATION BAR ─────────────────────────────────────────────────────
const StationBar = ({
  stations, active, setActive, fallback,
}: { stations: string[]; active: string; setActive: (s: string) => void; fallback: boolean }) => (
  <div className="h-16 border-b border-white/5 flex items-center px-6 gap-3 bg-white/[0.01] shrink-0 overflow-x-auto no-scrollbar">
    <Filter className="w-4 h-4 text-slate-500 shrink-0" />
    {Array.from(new Set(stations)).map(s => (
      <button
        key={s}
        onClick={() => setActive(s)}
        className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${active === s ? 'bg-white text-black' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
      >
        {s.replace('_', ' ')}
      </button>
    ))}
    <div className="ml-auto flex items-center gap-2 shrink-0">
      <span className={`w-2 h-2 rounded-full ${fallback ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{fallback ? 'Fallback Sync' : 'WebSocket Live'}</span>
    </div>
  </div>
);

export default CookConsoleWorkspace;
