import React, { useMemo, useState, useEffect } from 'react';
import {
  ChefHat, Zap, CheckCircle2, Sparkles, Filter, Lock, Clock, Loader2
} from 'lucide-react';
import { PrepBatch } from '../../types';
import { startBatch, finalizeBatch } from '../../services/firestore-db';
import { safeListener } from '../../services/safeListener';
import {
  collection, query, where, orderBy, onSnapshot,
  limit, doc, setDoc, increment, serverTimestamp
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

  // 🔗 [ADMIN-HEALING] Expose a cleanup function to the browser console as requested
  useEffect(() => {
    (window as any).clearGhostBatches = async () => {
      console.log("🧹 [PURGE] Targetting all active kitchen batches...");
      const promises = batches.map(b => deleteDoc(doc(db, 'prepBatches', b.id)));
      await Promise.all(promises);
      alert(`${batches.length} batches purged from kitchen.`);
    };
    return () => { delete (window as any).clearGhostBatches; };
  }, [batches]);

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

    const displayBatches = activeBatches.map(b => {
      // ⚖️ [QUANTITY-FIX] Fallback to top-level 'quantity' for refill batches with no sub-items
      const totalUnits = (b.items && b.items.length > 0)
        ? b.items.reduce((sum, it) => sum + (it.quantity || 1), 0)
        : (b.quantity || 1);
      
      return {
        ...b,
        status: optimisticStatus[b.id] ?? b.status, 
        totalUnits,
        batchCreatedAt: (b.createdAt as any)?.toMillis?.() ?? (b.createdAt as number) ?? 0,
        id: b.id
      };
    });

    // 🛡️ [ANTI-OVERLOAD] Focus Mode
    const stationCapacity = activeStation === 'dosa' ? 4 : (isMobile ? 2 : 8); 
    
    return displayBatches.sort((a, b) => {
      // PREPARING always top
      if (a.status === 'PREPARING' && b.status !== 'PREPARING') return -1;
      if (b.status === 'PREPARING' && a.status !== 'PREPARING') return 1;

    // Primary FIFO within status
    return (a.batchCreatedAt || 0) - (b.batchCreatedAt || 0);
  });
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

  // 🍱 [REFILL-ENGINE] High-speed inventory increments
  const [stock, setStock] = useState<Record<string, number>>({});
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "inventory_meta"), (snap) => {
      const map: any = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        map[doc.id] = (d.totalStock || 0) - (d.consumed || 0);
      });
      setStock(map);
    });
    return () => unsub();
  }, []);

  const quickRefill = async (itemId: string, delta: number) => {
    try {
      if ('vibrate' in navigator) navigator.vibrate(50);
      const metaRef = doc(db, "inventory_meta", itemId);
      await setDoc(metaRef, { 
        totalStock: increment(delta), 
        updatedAt: serverTimestamp() 
      }, { merge: true });
    } catch (e) {
      console.error("Refill failed:", e);
    }
  };

  // 🧠 [RHYTHM-MODE] High-speed focus refill 
  const [focus, setFocus] = useState<any>(null);
  useEffect(() => {
    const nextFocus = sortedItems[0];
    
    if (nextFocus?.id !== focus?.id || nextFocus?.status !== focus?.status) {
       // Identity change gets a micro-transition (40ms) to ensure smooth DOM swap
       if (nextFocus?.id !== focus?.id) {
          const timer = setTimeout(() => setFocus(nextFocus), 40);
          return () => clearTimeout(timer);
       } else {
          setFocus(nextFocus);
       }
    }
  }, [sortedItems, focus?.id, focus?.status]);

  const handleStart = async (batchId: string, items: any[]) => {
    if (!navigator.onLine) return alert("Waiting for connection...");
    if (processingMap[batchId]) return;
    
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

  const handleHardPurge = async (docId: string) => {
    if (!confirm("Are you sure you want to permanently delete this stuck batch?")) return;
    setProcessingMap(p => ({ ...p, [docId]: true }));
    try {
      await deleteDoc(doc(db, 'prepBatches', docId));
      setLastAction('Batch Purged 🧹');
      setTimeout(() => setLastAction(null), 2000);
    } catch (e) {
      alert("Purge failed. Check permissions.");
    } finally {
      setProcessingMap(p => ({ ...p, [docId]: false }));
    }
  };

  const handleFinalize = async (batchId: string, items: any[], count?: number, currentStatus?: string) => {
    if (!navigator.onLine) return alert("Waiting for connection...");
    if (processingMap[batchId]) return;
    
    if (window.navigator.vibrate) window.navigator.vibrate([40, 20, 60]);
    setProcessingMap(p => ({ ...p, [batchId]: true }));
    try {
      // 🔑 [AUTO-START] If batch is still QUEUED, start it first before dispensing
      if (currentStatus === 'QUEUED') {
        await startBatch(batchId, items, auth.currentUser?.uid);
        setOptimisticStatus(p => ({ ...p, [batchId]: 'PREPARING' }));
        // Small delay to let Firestore settle before the finalize transaction reads the new status
        await new Promise(r => setTimeout(r, 400));
      }
      if (!count) setOptimisticStatus(p => ({ ...p, [batchId]: 'READY' }));
      await finalizeBatch(batchId, items, count);
      setLastAction(count ? `Released ${count} item(s) ⚡` : 'Batch Ready ✓');
      setTimeout(() => setLastAction(null), 2000);
    } catch {
      setOptimisticStatus(p => { const n = { ...p }; delete n[batchId]; return n; });
    } finally {
      setProcessingMap(p => ({ ...p, [batchId]: false }));
    }
  };

  if (sortedItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] relative">
        <StationBar stations={stations} active={activeStation} setActive={setActiveStation} fallback={false} batches={batches} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-20 select-none">
          <div className="w-32 h-32 rounded-[3rem] bg-white/5 border-4 border-white/10 flex items-center justify-center mb-8">
            <Sparkles className="w-12 h-12 text-white/20" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-3">Pipeline Clear</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">Waiting for kitchen manifests...</p>
        </div>
      </div>
    );
  }

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

      <StationBar stations={stations} active={activeStation} setActive={setActiveStation} fallback={false} batches={batches} />

      <div className={`flex flex-1 overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {!isPassive && (
          <div className={`${isMobile ? 'h-32 border-b border-white/5' : 'w-80 border-r border-white/5'} flex flex-col bg-white/[0.01]`}>
            <div className={`${isMobile ? 'hidden' : 'p-6 border-b border-white/5'}`}>
              <h2 className="text-white font-black uppercase italic tracking-tight text-lg">Focus Pipeline</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">
                {sortedItems.length} active batches
              </p>
            </div>
            <div className={`flex-1 overflow-x-auto overflow-y-hidden ${isMobile ? 'p-2 flex flex-row gap-2' : 'p-4 space-y-3'}`}>
              {sortedItems.map((b, i) => (
                <div
                  key={b.id}
                  className={`${isMobile ? 'p-2 rounded-xl min-w-[120px]' : 'p-5 rounded-[1.5rem]'} border transition-all ${i === 0 ? 'bg-emerald-500/15 border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] ring-2 ring-emerald-500/20' : 'bg-white/[0.02] border-white/5 opacity-50'} ${b.status === 'PREPARING' ? 'animate-pulse' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-emerald-500 font-black text-[9px] uppercase tracking-widest">{b.status}</span>
                    <span className="text-white/20 text-[9px] font-mono">#{b.id.slice(-4).toUpperCase()}</span>
                  </div>
                  <h3 className="text-white font-black italic truncate text-sm">
                    {b.totalUnits}x {b.itemName || 'Unnamed Item'}
                  </h3>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-10'}`}>
          {focus && (
            <div className={`max-w-3xl mx-auto ${isPassive ? 'pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-8">
                <div>
                   <span className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px] mb-1 block">{focus.stationId} STATION</span>
                   <h1 className="text-4xl lg:text-6xl font-black text-white uppercase italic tracking-tighter">
                     {focus.totalUnits}x {focus.itemName || 'Unnamed Item'}
                   </h1>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Batch Ref</p>
                   <span className="text-4xl lg:text-7xl font-black text-white tracking-widest leading-none font-mono italic">#{focus.id.slice(-4).toUpperCase()}</span>
                   {(focus.itemName === 'Unnamed Item' || !focus.itemName) && (
                       <button 
                         onClick={() => handleHardPurge(focus.id)}
                         className="mt-4 block w-full py-3 bg-red-500/10 text-red-500 border border-red-500/30 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl active:scale-95"
                       >
                         ⚠️ Purge Ghost Entry
                       </button>
                    )}
                </div>
              </div>

              <div className={`bg-white/[0.03] border border-white/10 rounded-[3rem] p-6 lg:p-10 ${focus.status === 'PREPARING' ? 'ring-4 ring-emerald-500/20 shadow-2xl' : ''}`}>
                <div className="space-y-4 mb-10 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
                  {(focus.items || []).map((it: any, i: number) => (
                    <div key={`${focus.id}-${i}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-xs italic">
                          {it.quantity || 1}
                        </div>
                        <div>
                          <h4 className="text-white font-black italic">{it.userName || 'Student'} — {it.name || 'Unnamed'}</h4>
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Order ID: #{it.orderId.slice(-4).toUpperCase()}</p>
                        </div>
                      </div>
                      <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">READY TO PREP</span>
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
                ) : (
                  // ✅ Works for BOTH QUEUED (auto-start) and PREPARING batches
                  <div className="space-y-6">
                    {/* 🍳 START button shown only while QUEUED */}
                    {focus.status === 'QUEUED' && (
                      <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                        <ChefHat className="w-5 h-5 text-amber-400 shrink-0" />
                        <p className="text-amber-300 text-[10px] font-black uppercase tracking-widest">
                          Tap any number below — tawa will start automatically
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-5 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                        const maxUnits = focus.totalUnits || focus.quantity || 0;
                        const isDisabled = !!processingMap[focus.id] || num > maxUnits;
                        return (
                          <button
                            key={num}
                            onClick={() => handleFinalize(focus.id, focus.items, num, focus.status)}
                            disabled={isDisabled}
                            className={`h-20 border rounded-2xl font-black text-2xl transition-all flex items-center justify-center active:scale-95 ${
                              isDisabled
                                ? 'bg-white/[0.02] border-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-white/[0.05] hover:bg-emerald-500 text-white hover:text-black border-white/10'
                            }`}
                          >
                            {num}x
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handleFinalize(focus.id, focus.items, undefined, focus.status)}
                      disabled={!!processingMap[focus.id] || isOffline}
                      className="h-24 w-full bg-emerald-500 text-black rounded-[2.5rem] font-black text-xl uppercase italic tracking-tighter flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-2xl shadow-emerald-500/20 disabled:opacity-50"
                    >
                      {processingMap[focus.id]
                        ? <Loader2 className="w-8 h-8 animate-spin" />
                        : <><CheckCircle2 className="w-8 h-8" /><span>RELEASE ALL ({focus.totalUnits || focus.quantity || 0})</span></>}
                    </button>

                    <p className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.4em] pt-2 italic">
                      Tap a number to dispense partial · Or release all at once
                    </p>
                  </div>
                )}
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
  stations, active, setActive, fallback, batches
}: { stations: string[]; active: string; setActive: (s: string) => void; fallback: boolean, batches: any[] }) => {
  const getCount = (sId: string) => {
    if (sId === 'ALL') return batches.length;
    return batches.filter(b => (b.stationId || 'GENERAL') === sId).length;
  };

  return (
    <div className="h-16 border-b border-white/5 flex items-center px-6 gap-3 bg-white/[0.01] shrink-0 overflow-x-auto no-scrollbar">
      <Filter className="w-4 h-4 text-slate-500 shrink-0" />
      {Array.from(new Set(stations)).map(s => {
        const count = getCount(s);
        return (
          <button
            key={s}
            onClick={() => setActive(s)}
            className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${active === s ? 'bg-white text-black' : 'bg-white/5 text-slate-500 hover:bg-white/10'}`}
          >
            {s.replace('_', ' ')}
            {count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${active === s ? 'bg-black text-white' : 'bg-white/10 text-white/40'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <span className={`w-2 h-2 rounded-full ${fallback ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{fallback ? 'Fallback Sync' : 'WebSocket Live'}</span>
      </div>
    </div>
  );
};

export default CookConsoleWorkspace;
