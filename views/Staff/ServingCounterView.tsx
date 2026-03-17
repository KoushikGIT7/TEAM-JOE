import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertCircle, Scan, Search, LogOut, RefreshCw,
  Gamepad2, Zap, Camera, ChevronRight, X, ShoppingBag, User, XCircle
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import {
  listenToActiveOrders,
  listenToPendingItems,
  serveItem,
  serveItemBatch,
  serveFullOrder,
  validateQRForServing,
  PendingItem,
  rejectOrderFromCounter,
  getOrderById,
} from '../../services/firestore-db';
import { initializeScanner, getScanner } from '../../services/scanner';
import { offlineDetector } from '../../utils/offlineDetector';
import QRScanner from '../../components/QRScanner';
import { seedReadyOrders } from '../../services/test-utils';

interface ServingCounterViewProps {
  profile: UserProfile;
  onLogout?: () => void;
  onOpenKitchen?: () => void;
}

interface ReadyItem {
  orderId: string;
  orderNumber: string;
  itemId: string;
  itemName: string;
  imageUrl: string;
  remainingQty: number;
  orderedQty: number;
  servedQty: number;
  userName: string;
}

// ─── Scan Review Modal ───────────────────────────────────────────────────────
// Shown immediately after a successful QR scan. Displays the full order
// with SERVE and REJECT buttons. Closes only on action or explicit dismiss.
interface ScanReviewModalProps {
  order: Order;
  qrDataRaw: string;
  onServeAll: () => Promise<void>;
  onReject: () => Promise<void>;
  onDismiss: () => void;
  serving: boolean;
  rejecting: boolean;
}

const ScanReviewModal: React.FC<ScanReviewModalProps> = ({
  order,
  onServeAll,
  onReject,
  onDismiss,
  serving,
  rejecting,
}) => {
  const busy = serving || rejecting;
  const orderRef = order.id.slice(-8).toUpperCase();

  return (
    <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-primary/10">
          <div>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-1">Token Verified ✓</p>
            <h2 className="text-2xl font-black tracking-tight">#{orderRef}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
              <User className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm truncate max-w-[120px]">{order.userName}</p>
            </div>
            <button
              onClick={onDismiss}
              disabled={busy}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors disabled:opacity-40"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
            <ShoppingBag className="w-3.5 h-3.5" />
            Order Contents ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
          </p>
          {order.items.map((item) => {
            const remaining = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
            return (
              <div key={item.id} className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                  <img
                    src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop'}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-lg tracking-tight truncate">{item.name}</h4>
                  <p className="text-xs font-bold text-gray-500 mt-0.5">{item.category}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-black text-primary">×{remaining}</p>
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider">to serve</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onReject}
            disabled={busy}
            className="flex-1 h-16 rounded-2xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 font-black uppercase tracking-widest text-xs text-red-500 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
          >
            {rejecting
              ? <RefreshCw className="w-5 h-5 animate-spin" />
              : <XCircle className="w-5 h-5" />}
            {rejecting ? 'Rejecting…' : 'Reject Order'}
          </button>
          <button
            onClick={onServeAll}
            disabled={busy}
            className="flex-[2] h-16 rounded-2xl bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-sm text-white flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(249,115,22,0.25)] transition-all active:scale-95 disabled:opacity-50"
          >
            {serving
              ? <RefreshCw className="w-6 h-6 animate-spin" />
              : <CheckCircle className="w-6 h-6" />}
            {serving ? 'Serving…' : 'Serve Meal'}
          </button>
        </div>
      </div>
    </div>
  );
};


// ─── Main Component ──────────────────────────────────────────────────────────
const ServingCounterView: React.FC<ServingCounterViewProps> = ({ profile, onLogout, onOpenKitchen }) => {
  const [readyItems, setReadyItems]       = useState<ReadyItem[]>([]);
  const [pendingItems, setPendingItems]   = useState<PendingItem[]>([]);
  const [error, setError]                 = useState<{ type: string; message: string } | null>(null);

  // Scan review state — replaces the old 2s toast + no-items flow
  const [scannedOrder, setScannedOrder]   = useState<Order | null>(null);
  const [scanRawData, setScanRawData]     = useState('');
  const [modalServing, setModalServing]   = useState(false);
  const [modalRejecting, setModalRejecting] = useState(false);

  const [servingKey, setServingKey]       = useState<string | null>(null);
  const [currentTime, setCurrentTime]     = useState(new Date());
  const [orderSearch, setOrderSearch]     = useState('');
  const [searchResults, setSearchResults] = useState<PendingItem[]>([]);
  const [isScanning, setIsScanning]       = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualQRInput, setManualQRInput] = useState('');
  const [isCameraOpen, setIsCameraOpen]   = useState(false);

  // ── Hardware Scanner Init ────────────────────────────────────────────────
  useEffect(() => {
    const scanner = initializeScanner({ suffixKey: 'Enter', autoFocus: true, disableBeep: false });
    scanner.onScan((data) => handleQRScanFromScanner(data));

    // Ensure focus
    const t = setTimeout(() => {
      const s = getScanner();
      if (s) s.focus();
    }, 500);

    return () => {
      clearTimeout(t);
      scanner.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Offline detection ────────────────────────────────────────────────────
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const unsub = offlineDetector.onStatusChange((status) => {
      const online = navigator.onLine || status === 'online';
      setIsOnline(online);
      if (online) offlineDetector.recordPing();
    });

    const onOnline  = () => { setIsOnline(true);  offlineDetector.recordPing(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const [isOnline, setIsOnline] = useState(true);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Firestore Listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = listenToActiveOrders((orders) => {
      const ready: ReadyItem[] = [];
      orders
        .filter((o) => o.qrState === 'SCANNED')
        .forEach((order) => {
          order.items.forEach((item) => {
            const remaining = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
            if (remaining > 0) {
              ready.push({
                orderId: order.id,
                orderNumber: order.id.slice(-8).toUpperCase(),
                itemId: item.id,
                itemName: item.name,
                imageUrl: item.imageUrl,
                remainingQty: remaining,
                orderedQty: item.quantity,
                servedQty: item.servedQty || 0,
                userName: order.userName || 'Guest',
              });
            }
          });
        });
      setReadyItems(ready);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = listenToPendingItems((items) => setPendingItems(items));
    return unsubscribe;
  }, []);

  // Search
  useEffect(() => {
    if (orderSearch.trim()) {
      const q = orderSearch.trim().toUpperCase();
      setSearchResults(pendingItems.filter((i) => i.orderNumber.includes(q)));
    } else {
      setSearchResults([]);
    }
  }, [orderSearch, pendingItems]);

  // ── Scan Handlers ────────────────────────────────────────────────────────
  const refocusScanner = () => {
    const s = getScanner();
    if (s) s.focus();
  };

  const showError = (msg: string) => {
    setError({ type: 'ERROR', message: msg });
  };

  const dismissError = () => {
    setError(null);
    refocusScanner();
  };

  /**
   * FIXED QR SCAN FLOW
   * Before: validateQRForServing → set username toast → auto-clear after 2s (BUG)
   * Now:    validateQRForServing → mark as SCANNED in Firestore → show full order
   *         review modal → operator clicks SERVE ALL or REJECT → clear modal
   */
  const processQRScan = useCallback(async (qrData: string) => {
    if (!qrData?.trim() || isScanning) return;
    const trimmed = qrData.trim();

    setIsScanning(true);
    setError(null);
    setScannedOrder(null);

    try {
      // Validates signature, checks payment, marks qrState = 'SCANNED' in Firestore
      const order = await validateQRForServing(trimmed);

      // Store raw data for serve/reject actions
      setScanRawData(trimmed);
      // Show the review modal — operator must act
      setScannedOrder(order);
    } catch (err: any) {
      showError(err.message || 'Scan Failed');
      refocusScanner();
    } finally {
      setIsScanning(false);
    }
  }, [isScanning]);

  const handleQRScanFromScanner = useCallback((data: string) => {
    processQRScan(data);
  }, [processQRScan]);

  // ── Modal Actions ────────────────────────────────────────────────────────

  /**
   * SERVE ALL: marks every item in the order as served individually
   * (uses serveItemBatch per item so quantity tracking is accurate)
   */
  const handleModalServeAll = async () => {
    if (!scannedOrder) return;
    setModalServing(true);

    try {
      await serveFullOrder(scannedOrder.id, profile.uid);
      // Modal clears; the listenToActiveOrders listener will remove from queue
      setScannedOrder(null);
      setScanRawData('');
    } catch (err: any) {
      showError(err.message || 'Failed to serve order');
    } finally {
      setModalServing(false);
      refocusScanner();
    }
  };

  /**
   * REJECT: marks order status = REJECTED, qrState = REJECTED
   * Student's listener sees the status change and is notified.
   */
  const handleModalReject = async () => {
    if (!scannedOrder) return;
    setModalRejecting(true);

    try {
      await rejectOrderFromCounter(scannedOrder.id, profile.uid);
      setScannedOrder(null);
      setScanRawData('');
    } catch (err: any) {
      showError(err.message || 'Failed to reject order');
    } finally {
      setModalRejecting(false);
      refocusScanner();
    }
  };

  const handleModalDismiss = () => {
    setScannedOrder(null);
    setScanRawData('');
    refocusScanner();
  };

  // ── Ready-Item Actions (from left panel, post-scan queue) ────────────────
  const handleServeReadyItem = async (item: ReadyItem, isBatch = false) => {
    if (servingKey) return;
    const key = `${item.orderId}_${item.itemId}${isBatch ? '_batch' : ''}`;
    setServingKey(key);
    try {
      if (isBatch && item.remainingQty > 1) {
        await serveItemBatch(item.orderId, item.itemId, item.remainingQty, profile.uid);
      } else {
        await serveItem(item.orderId, item.itemId, profile.uid);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to serve item');
    } finally {
      setServingKey(null);
      refocusScanner();
    }
  };

  const handleRejectOrderAction = useCallback(async (orderId: string) => {
    if (!confirm('Reject this order?')) return;
    setServingKey(`REJECT_${orderId}`);
    try {
      await rejectOrderFromCounter(orderId, profile.uid);
    } catch (err: any) {
      showError(err.message || 'Failed to reject');
    } finally {
      setServingKey(null);
    }
  }, [profile.uid]);

  const handleServePending = async (pendingItem: PendingItem) => {
    if (servingKey) return;
    const key = `${pendingItem.orderId}_${pendingItem.itemId}`;
    setServingKey(key);
    try {
      await serveItem(pendingItem.orderId, pendingItem.itemId, profile.uid);
      if (searchResults.some((r) => r.orderId === pendingItem.orderId && r.itemId === pendingItem.itemId)) {
        setOrderSearch('');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to serve item');
    } finally {
      setServingKey(null);
      refocusScanner();
    }
  };

  const handleSimulateEfficiency = async () => {
    if (isScanning || isCameraOpen) return;
    const payloads = await seedReadyOrders(5);
    for (let i = 0; i < payloads.length; i++) {
      await processQRScan(payloads[i]);
      await new Promise((r) => setTimeout(r, 1200));
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#050505] text-white flex flex-col overflow-hidden font-sans selection:bg-primary/30">
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(.95); opacity: 0.5; }
          50%  { transform: scale(1);   opacity: 0.3; }
          100% { transform: scale(.95); opacity: 0.5; }
        }
        .animate-pulse-ring { animation: pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite; }
        .glass-panel {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.05);
        }
        @keyframes slide-in-bottom {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-in { animation: slide-in-bottom 0.4s cubic-bezier(0.2,0.8,0.2,1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
      `}</style>

      {/* ── Camera Scanner Overlay ── */}
      {isCameraOpen && (
        <QRScanner
          onScan={(data) => { setIsCameraOpen(false); processQRScan(data); }}
          onClose={() => setIsCameraOpen(false)}
          isScanning={isScanning}
        />
      )}

      {/* ── Scan Review Modal (FIXED) ── */}
      {scannedOrder && (
        <ScanReviewModal
          order={scannedOrder}
          qrDataRaw={scanRawData}
          onServeAll={handleModalServeAll}
          onReject={handleModalReject}
          onDismiss={handleModalDismiss}
          serving={modalServing}
          rejecting={modalRejecting}
        />
      )}

      {/* ── Error Toast ── */}
      {error && (
        <div
          className="fixed top-8 left-4 right-4 sm:left-auto sm:right-8 sm:max-w-md z-[200] bg-red-600/90 backdrop-blur-xl text-white rounded-[2rem] shadow-2xl border-2 border-red-500/50 p-6 flex items-start gap-4 animate-in slide-in-from-right duration-300"
          role="alert"
        >
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-red-200">System Alert</p>
            <p className="text-xl font-black mt-1">{error.message}</p>
          </div>
          <button
            onClick={dismissError}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md flex-shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <h1 className="text-4xl font-black tracking-tighter italic">JOE</h1>
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] px-3 py-1 border border-primary/30 rounded-full bg-primary/10">Counter</span>
          </div>
          <div className="h-10 w-px bg-white/10 hidden lg:block" />
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Status</p>
              <p className="font-bold text-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`} />
                {isOnline ? 'Online' : 'Offline'}: {profile.name}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-6 hidden sm:block">
            <p className="text-3xl font-black font-mono tracking-wider">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{currentTime.toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onOpenKitchen} className="h-14 px-8 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all font-black uppercase tracking-widest text-xs flex items-center gap-3">
              <Gamepad2 className="w-5 h-5 text-primary" /> Management
            </button>
            <button onClick={onLogout} className="h-14 w-14 rounded-2xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 transition-all flex items-center justify-center active:scale-95">
              <LogOut className="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 lg:p-8 gap-8">

        {/* LEFT — Serving Queue (65%) */}
        <section className="flex-1 flex flex-col gap-6 overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col glass-panel rounded-[3.5rem] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">

            {/* Zone Header */}
            <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_15px_#22c55e]" />
                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-gray-400">Serving Active</h2>
              </div>
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">{readyItems.length} active tokens</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-16 custom-scrollbar scroll-smooth">
              {readyItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="relative mb-12">
                    <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full animate-pulse-ring" />
                    <div className="relative w-40 h-40 lg:w-56 lg:h-56 rounded-[3rem] border-2 border-white/10 flex items-center justify-center bg-black/40 backdrop-blur-xl">
                      <Scan className="w-16 h-16 lg:w-24 lg:h-24 text-primary opacity-30" />
                    </div>
                  </div>
                  <h3 className="text-4xl lg:text-6xl font-black text-white/10 tracking-tighter mb-6">STANDBY MODE</h3>
                  <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.5em] max-w-sm mx-auto leading-relaxed">
                    Scan a customer QR token to begin. Use the camera or hardware scanner.
                  </p>
                </div>
              ) : (
                (() => {
                  const orderIds      = Array.from(new Set(readyItems.map((i) => i.orderId)));
                  const sortedOrders  = orderIds.map((oid) => {
                    const items = readyItems.filter((i) => i.orderId === oid);
                    return { orderId: oid, orderNumber: items[0].orderNumber, userName: items[0].userName, items };
                  });

                  const nowServing = sortedOrders[0];
                  const queue      = sortedOrders.slice(1);

                  return (
                    <div className="space-y-16 animate-slide-in">
                      {/* FOCUS ORDER */}
                      <div className="relative">
                        <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 to-amber-500/30 blur-3xl opacity-20" />
                        <div className="relative bg-white/[0.04] border-2 border-primary/40 rounded-[4rem] p-10 lg:p-16 shadow-2xl overflow-hidden">
                          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full -mr-[250px] -mt-[250px] pointer-events-none" />

                          <div className="flex flex-col md:flex-row items-baseline justify-between gap-8 mb-16 relative z-10">
                            <div>
                              <div className="flex items-center gap-4 mb-3">
                                <span className="text-xs font-black text-primary uppercase tracking-[0.5em]">Now Serving</span>
                                <div className="h-px w-32 bg-primary/20" />
                              </div>
                              <h3 className="text-8xl lg:text-[10rem] font-black tracking-tighter leading-none mb-4 italic">#{nowServing.orderNumber}</h3>
                              <p className="text-3xl font-bold text-gray-300">{nowServing.userName}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center border-2 border-primary/40 mb-4 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
                                <Zap className="w-12 h-12 text-primary" />
                              </div>
                              <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] text-right">Instant Processing</p>
                            </div>
                          </div>

                          <div className="space-y-8 relative z-10">
                            {nowServing.items.map((item) => {
                              const key    = `${item.orderId}_${item.itemId}`;
                              const isBusy = servingKey?.startsWith(key);
                              return (
                                <div key={key} className="flex flex-col md:flex-row items-center gap-10 bg-black/60 border border-white/10 rounded-[3rem] p-8 lg:p-10 transition-all hover:scale-[1.02] hover:bg-black/80 shadow-xl">
                                  <div className="w-48 h-48 lg:w-64 lg:h-64 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white/5 flex-shrink-0 relative">
                                    <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.itemName} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-6 left-6 flex items-baseline gap-2">
                                      <p className="text-xs font-black text-white/50 uppercase tracking-widest">Qty</p>
                                      <p className="text-5xl font-black text-primary drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]">{item.remainingQty}</p>
                                    </div>
                                  </div>

                                  <div className="flex-1 min-w-0 py-4">
                                    <h4 className="text-4xl lg:text-6xl font-black tracking-tight leading-tight mb-8 truncate">{item.itemName}</h4>
                                    <div className="flex flex-wrap gap-4">
                                      {item.remainingQty > 1 && (
                                        <button
                                          disabled={!!servingKey}
                                          onClick={() => handleServeReadyItem(item, true)}
                                          className="h-20 px-10 rounded-3xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-[0.2em] text-sm flex items-center gap-4 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_40px_rgba(245,158,11,0.2)]"
                                        >
                                          {servingKey === `${key}_batch`
                                            ? <RefreshCw className="w-6 h-6 animate-spin" />
                                            : <><Zap className="w-6 h-6" /> Batch Serve</>}
                                        </button>
                                      )}
                                      <button
                                        disabled={!!servingKey}
                                        onClick={() => handleServeReadyItem(item, false)}
                                        className="h-20 flex-1 px-10 rounded-3xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-4 shadow-[0_0_50px_rgba(249,115,22,0.3)] transition-all active:scale-95 disabled:opacity-50"
                                      >
                                        {servingKey === key
                                          ? <RefreshCw className="w-8 h-8 animate-spin" />
                                          : <><CheckCircle className="w-8 h-8" /> {item.remainingQty > 1 ? 'Single Serve' : 'Complete Task'}</>}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center relative z-10">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">ID: {nowServing.orderId.toUpperCase()}</p>
                            <button
                              onClick={() => handleRejectOrderAction(nowServing.orderId)}
                              className="flex items-center gap-3 py-3 px-6 rounded-2xl text-[10px] font-black text-red-500/60 hover:text-red-500 hover:bg-red-500/10 uppercase tracking-[0.4em] transition-all"
                            >
                              <AlertCircle className="w-4 h-4" /> Terminate Order
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* QUEUE */}
                      {queue.length > 0 && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4 px-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.5em]">Queue Pipeline ({queue.length})</h3>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {queue.map((order, idx) => (
                              <div key={order.orderId} className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-8 hover:border-white/20 hover:bg-white/[0.05] transition-all group">
                                <div className="flex justify-between items-start mb-6">
                                  <span className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black text-white/40 group-hover:bg-primary/20 group-hover:text-primary transition-colors italic">#{idx + 2}</span>
                                  <h4 className="text-4xl font-black tracking-tighter">#{order.orderNumber}</h4>
                                </div>
                                <p className="text-xs font-black text-gray-400 capitalize mb-1">{order.userName}</p>
                                <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{order.items.length} units pending</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </section>

        {/* RIGHT — Tools & Pending Feed (35%) */}
        <aside className="w-full lg:w-[480px] flex flex-col gap-8 flex-shrink-0">

          {/* Scan Controls */}
          <div className="glass-panel rounded-[3rem] p-8 border border-white/10 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500 mb-8 flex items-center gap-4">
              <Search className="w-4 h-4" /> Global Registry
            </h3>

            <div className="flex items-center gap-6 bg-black/60 border border-white/10 rounded-[2rem] p-6 mb-8 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10 transition-all group">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-focus-within:bg-primary/20 transition-colors">
                <Search className="w-6 h-6 text-gray-500 group-focus-within:text-primary" />
              </div>
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none font-black text-2xl lg:text-3xl placeholder:text-white/5 tracking-tight uppercase"
                placeholder="SCAN TOKEN"
              />
              {orderSearch && (
                <button onClick={() => setOrderSearch('')} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsCameraOpen(true)}
                className="h-20 rounded-[1.5rem] bg-white/5 hover:bg-white/10 border border-white/10 font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                <Camera className="w-5 h-5 text-primary" /> Camera Scan
              </button>
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="h-20 rounded-[1.5rem] bg-white/5 hover:bg-white/10 border border-white/10 font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                <Zap className="w-5 h-5 text-amber-500" /> Manual Override
              </button>
            </div>
          </div>

          {/* Pending Feed */}
          <div className="flex-1 flex flex-col glass-panel rounded-[3rem] overflow-hidden border border-white/10">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500">Inventory Feed</h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest">{pendingItems.length} PENDING</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {pendingItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center px-12 text-center opacity-10">
                  <CheckCircle className="w-20 h-20 mb-6" />
                  <p className="text-sm font-black uppercase tracking-[0.4em]">Clear Pipeline</p>
                </div>
              ) : (
                (searchResults.length > 0 ? searchResults : pendingItems).map((item) => {
                  const key    = `${item.orderId}_${item.itemId}`;
                  const isBusy = servingKey?.startsWith(key);
                  return (
                    <div key={key} className="bg-white/[0.04] border border-white/5 rounded-[2rem] p-5 flex items-center gap-6 group hover:bg-white/[0.08] transition-all hover:translate-x-1">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 relative">
                        <img src={item.imageUrl} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all" alt={item.itemName} />
                        <div className="absolute top-1 right-1 bg-black/80 px-2 py-0.5 rounded-lg border border-white/10">
                          <p className="text-[10px] font-black text-amber-500">×{item.remainingQty}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-[10px] font-black text-gray-500 uppercase">#{item.orderNumber}</p>
                          <span className="w-1 h-1 rounded-full bg-white/10" />
                          <p className="text-[10px] font-black text-primary/60 tracking-wider">PREP ITEM</p>
                        </div>
                        <h4 className="font-black text-lg truncate tracking-tight">{item.itemName}</h4>
                        <p className="text-[10px] font-bold text-gray-600 truncate">{item.userName}</p>
                      </div>
                      <button
                        onClick={() => handleServePending(item)}
                        disabled={!!servingKey}
                        className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center lg:opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white active:scale-95"
                      >
                        {isBusy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-6 h-6" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Stress Test */}
            <div className="p-4 border-t border-white/5 bg-black/20">
              <button
                onClick={handleSimulateEfficiency}
                disabled={isScanning}
                className="w-full py-4 rounded-xl border border-white/5 hover:border-white/10 text-[8px] font-black text-white/10 hover:text-white/30 uppercase tracking-[0.8em] transition-all flex items-center justify-center gap-4"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                Run Stress Test (5 Token Scan)
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Hidden hardware scanner input */}
      <div className="fixed bottom-0 right-0 opacity-0 pointer-events-none">
        <input id="scanner-input" type="text" autoFocus />
      </div>

      {/* Scanning HUD */}
      {isScanning && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-black/90 backdrop-blur-2xl border-2 border-primary/50 text-white px-10 py-5 rounded-full flex items-center gap-6 shadow-[0_0_50px_rgba(249,115,22,0.5)] animate-in fade-in zoom-in duration-300">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/40 blur-lg rounded-full animate-pulse" />
            <div className="relative w-4 h-4 rounded-full bg-primary" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] leading-none mb-1">Processing Engine</p>
            <p className="text-xs font-bold text-gray-400">Verifying security signature…</p>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-gray-900 rounded-[3rem] border-2 border-white/10 p-10 shadow-[0_50px_100px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-4xl font-black tracking-tighter mb-2">Token Override</h2>
                <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Manual Hash Deployment</p>
              </div>
              <button
                onClick={() => { setIsManualModalOpen(false); setManualQRInput(''); }}
                className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <textarea
              value={manualQRInput}
              onChange={(e) => setManualQRInput(e.target.value)}
              rows={6}
              className="w-full bg-black/40 border-2 border-white/5 rounded-[2rem] p-8 text-xl font-mono text-primary placeholder:text-white/5 outline-none focus:border-primary/50 transition-all mb-10"
              placeholder="v1.order_xxxx.xxxx.xxxx"
              autoFocus
            />

            <div className="flex gap-4">
              <button
                onClick={() => { setIsManualModalOpen(false); setManualQRInput(''); }}
                className="h-20 flex-1 rounded-3xl bg-white/5 hover:bg-white/10 font-black uppercase tracking-widest text-xs transition-all"
              >
                Abort
              </button>
              <button
                disabled={!manualQRInput.trim() || isScanning}
                onClick={async () => {
                  const data = manualQRInput.trim();
                  setIsManualModalOpen(false);
                  setManualQRInput('');
                  await processQRScan(data);
                }}
                className="h-20 flex-[2] rounded-3xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50"
              >
                Deploy Hash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServingCounterView;
