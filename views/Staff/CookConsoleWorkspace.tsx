import React, { useMemo, useState, useEffect } from 'react';
import {
  ChefHat, Zap, CheckCircle2, Sparkles, Filter, Lock
} from 'lucide-react';
import { PrepBatch } from '../../types';
import { startBatch, finalizeBatch } from '../../services/firestore-db';
import { safeListener } from '../../services/safeListener';
import {
  collection, query, where, orderBy, onSnapshot,
  collectionGroup, limit
} from 'firebase/firestore';
import { db } from '../../firebase';

interface CookConsoleWorkspaceProps {
  initialStationId?: string;
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
const CookConsoleWorkspace: React.FC<CookConsoleWorkspaceProps> = ({ initialStationId = 'ALL' }) => {
  const [batches, setBatches] = useState<PrepBatch[]>([]);
  const [activeStation, setActiveStation] = useState(initialStationId);
  const [processingMap, setProcessingMap] = useState<Record<string, boolean>>({});
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, string>>({});
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [indexReady, setIndexReady] = useState(true); // assume ready; flip on error

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
        if (!indexReady) setIndexReady(true); // recover once index is ready
      },
      fallbackQ
    );

    // ── STATUS DOCTOR ─────────────────────────────────────────────────────────
    const unsubDoctor = onSnapshot(
      query(collectionGroup(db, 'items'), where('status', 'in', ['PENDING', 'RESERVED', 'QUEUED']), limit(100)),
      (snap) => {
        const counts = snap.docs.reduce((acc, d) => {
          const s = (d.data() as any).status as string;
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        if (Object.keys(counts).length > 0)
          console.log('🔬 [STATUS-DOCTOR] Item census:', counts);
      },
      (err) => { console.warn('[STATUS-DOCTOR] Non-critical error:', err.code); }
    );

    return () => { unsub(); unsubDoctor(); };
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
                fullBatchItems: b.items 
              });
          }
          return result;
      })
    );

    const stationCounts: Record<string, number> = {};
    flattened.forEach(it => { stationCounts[it.stationId] = (stationCounts[it.stationId] || 0) + 1; });

    return flattened.sort((a, b) => {
      if (a.batchStatus === 'PREPARING' && b.batchStatus !== 'PREPARING') return -1;
      if (b.batchStatus === 'PREPARING' && a.batchStatus !== 'PREPARING') return 1;

      const aRarity = 1 / (stationCounts[a.stationId] || 1);
      const bRarity = 1 / (stationCounts[b.stationId] || 1);
      const aScore = a.batchCreatedAt - (aRarity * 60000); 
      const bScore = b.batchCreatedAt - (bRarity * 60000);

      return aScore - bScore;
    });
  }, [batches, optimisticStatus, activeStation]);

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

  const focus = activeItemsSlice[0];

  const handleStart = async (batchId: string, items: any[]) => {
    if (processingMap[batchId]) return;
    setOptimisticStatus(p => ({ ...p, [batchId]: 'PREPARING' }));
    setProcessingMap(p => ({ ...p, [batchId]: true }));
    try {
      await startBatch(batchId, items);
      setLastAction('Cooking Started ⚡');
      setTimeout(() => setLastAction(null), 2000);
    } catch {
      setOptimisticStatus(p => { const n = { ...p }; delete n[batchId]; return n; });
    } finally {
      setProcessingMap(p => ({ ...p, [batchId]: false }));
    }
  };

  const handleFinalize = async (batchId: string, items: any[]) => {
    if (processingMap[batchId]) return;
    setOptimisticStatus(p => ({ ...p, [batchId]: 'READY' }));
    setProcessingMap(p => ({ ...p, [batchId]: true }));
    try {
      await finalizeBatch(batchId, items);
      setLastAction('Ready for Service ✓');
      setTimeout(() => setLastAction(null), 2000);
    } catch {
      setOptimisticStatus(p => { const n = { ...p }; delete n[batchId]; return n; });
    } finally {
      setProcessingMap(p => ({ ...p, [batchId]: false }));
    }
  };

  // ── EMPTY STATE ────────────────────────────────────────────────────────────
  if (sortedItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0c] relative">
        <StationBar stations={stations} active={activeStation} setActive={setActiveStation} fallback={!indexReady} />
        <div className="flex-1 flex flex-col items-center justify-center text-center p-20 select-none">
          <div className="w-32 h-32 rounded-[3rem] bg-white/5 border-4 border-white/10 flex items-center justify-center mb-8">
            <Sparkles className="w-12 h-12 text-white/20" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-3">Pipeline Clear</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
            {!indexReady ? '⚠️ Fallback sync active — waiting for orders...' : 'Waiting for kitchen manifests...'}
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

      <StationBar stations={stations} active={activeStation} setActive={setActiveStation} fallback={!indexReady} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── SIDEBAR QUEUE ───────────────────────────────────────────── */}
        <div className="w-80 border-r border-white/5 flex flex-col bg-white/[0.01]">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-white font-black uppercase italic tracking-tight text-lg">Active Queue</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">{sortedItems.length} units</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sortedItems.map((it, i) => (
              <div
                key={`${it.batchId}-${it.id}-${i}`}
                className={`p-5 rounded-[1.5rem] border transition-all ${i < 2 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 opacity-40'}`}
              >
                <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase tracking-widest">
                  <span className={it.batchStatus === 'PREPARING' ? 'text-emerald-400' : 'text-white/40'}>{it.batchStatus}</span>
                  <span className="text-white/20">{it.stationId}</span>
                </div>
                <h3 className="text-white font-bold text-base truncate">
                  {it.name}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">#{it.orderId?.slice(-4).toUpperCase() || '####'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN PAN ────────────────────────────────────────────────── */}
        <div className="flex-1 p-10 overflow-y-auto">
          {focus && (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <span className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px] mb-1 block">{focus.stationId} STATION</span>
                  <h1 className="text-5xl font-black text-white uppercase italic tracking-tighter">Kitchen Batch</h1>
                </div>
                <span className="text-3xl font-black text-white/10 font-mono">#{focus?.id?.slice(-4).toUpperCase() || '####'}</span>
              </div>

              <div className="bg-white/[0.03] border border-white/5 rounded-[3rem] p-10">
                <div className="space-y-4 mb-10">
                  {activeItemsSlice.map((it: any, i: number) => (
                    <div key={`${it.batchId}-${i}`} className="flex items-center justify-between p-6 bg-white/[0.04] border border-white/10 rounded-[2rem] shadow-xl">
                      <div>
                        <h4 className="text-2xl font-black text-white italic">{it.name}</h4>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Item Unit</p>
                      </div>
                      <span className="text-slate-500 text-xs font-black uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/5">#{it.orderId?.slice(-4).toUpperCase() || '####'}</span>
                    </div>
                  ))}
                </div>

                {focus.batchStatus === 'QUEUED' ? (
                  <button
                    onClick={() => handleStart(focus.batchId, focus.fullBatchItems)}
                    disabled={!!processingMap[focus.batchId]}
                    className="w-full h-20 bg-white text-black rounded-[1.5rem] font-black text-lg uppercase italic tracking-tight flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Zap className="w-7 h-7 fill-current" /> Start Cooking
                  </button>
                ) : (
                  <button
                    onClick={() => handleFinalize(focus.batchId, focus.fullBatchItems)}
                    disabled={!!processingMap[focus.batchId]}
                    className="w-full h-20 bg-emerald-500 text-white rounded-[1.5rem] font-black text-lg uppercase italic tracking-tight flex items-center justify-center gap-4 hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-2xl shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-7 h-7" /> Finalize Batch
                  </button>
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
