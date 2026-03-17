import React, { useState, useCallback } from 'react';
import {
  LogOut, Scan, CheckCircle, AlertCircle, RefreshCw,
  Smartphone, User, Clock, XCircle, ShoppingBag,
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { validateQRForServing, rejectOrderFromCounter, serveItemBatch } from '../../services/firestore-db';
import Logo from '../../components/Logo';
import QRScanner from '../../components/QRScanner';

interface ScannerViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

type TerminalState = 'IDLE' | 'SCANNING' | 'REVIEW' | 'SUCCESS' | 'ERROR';

const ScannerView: React.FC<ScannerViewProps> = ({ profile, onLogout }) => {
  const [terminalState, setTerminalState] = useState<TerminalState>('IDLE');
  const [scannedOrder, setScannedOrder]   = useState<Order | null>(null);
  const [errorMsg, setErrorMsg]           = useState('');
  const [serving, setServing]             = useState(false);
  const [rejecting, setRejecting]         = useState(false);
  const [isCameraOpen, setIsCameraOpen]   = useState(false);

  const busy = serving || rejecting;

  const reset = () => {
    setTerminalState('IDLE');
    setScannedOrder(null);
    setErrorMsg('');
  };

  /**
   * Core scan → validate → show review flow.
   * validateQRForServing marks qrState = 'SCANNED' in Firestore.
   */
  const handleScan = useCallback(async (rawData: string) => {
    if (terminalState === 'SCANNING') return;
    setTerminalState('SCANNING');
    setScannedOrder(null);
    setErrorMsg('');

    try {
      const order = await validateQRForServing(rawData.trim());
      setScannedOrder(order);
      setTerminalState('REVIEW');
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation failed');
      setTerminalState('ERROR');
    }
  }, [terminalState]);

  const handleOpenCamera = () => {
    if (busy || terminalState === 'SCANNING') return;
    setIsCameraOpen(true);
  };

  /**
   * SERVE ALL — serves every remaining item in the order.
   */
  const handleServeAll = async () => {
    if (!scannedOrder || busy) return;
    setServing(true);

    try {
      for (const item of scannedOrder.items) {
        const remaining = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
        if (remaining > 0) {
          await serveItemBatch(scannedOrder.id, item.id, remaining, profile.uid);
        }
      }
      setTerminalState('SUCCESS');
      setScannedOrder(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Serve failed');
      setTerminalState('ERROR');
    } finally {
      setServing(false);
    }
  };

  /**
   * REJECT — marks the order as rejected in Firestore.
   */
  const handleReject = async () => {
    if (!scannedOrder || busy) return;
    setRejecting(true);

    try {
      await rejectOrderFromCounter(scannedOrder.id, profile.uid);
      setErrorMsg('ORDER REJECTED BY SERVER');
      setTerminalState('ERROR');
      setScannedOrder(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Reject failed');
      setTerminalState('ERROR');
    } finally {
      setRejecting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-textMain text-white flex flex-col max-w-md mx-auto font-sans">
      {/* Camera Scanner */}
      {isCameraOpen && (
        <QRScanner
          onScan={(data) => { setIsCameraOpen(false); handleScan(data); }}
          onClose={() => setIsCameraOpen(false)}
          isScanning={terminalState === 'SCANNING'}
        />
      )}

      {/* Header */}
      <div className="p-6 flex justify-between items-center border-b border-white/5 bg-white/5 backdrop-blur-xl">
        <Logo size="sm" className="!text-white" />
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-md">Server Node</p>
            <p className="text-sm font-bold mt-1">{profile?.name || 'Staff'}</p>
          </div>
          <button onClick={onLogout} className="p-3 bg-white/5 rounded-2xl hover:bg-red-500/20 transition-all active:scale-90 border border-white/10">
            <LogOut className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">

        {/* IDLE — Scan prompt */}
        {terminalState === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-64 h-64 border-2 border-primary/20 rounded-[3rem] flex items-center justify-center relative bg-primary/5 group">
              <div className="absolute inset-0 bg-primary/10 rounded-[3rem] blur-2xl group-hover:bg-primary/20 transition-all" />
              <Scan className="w-24 h-24 text-primary animate-pulse relative z-10" />
              <div className="absolute inset-4 border border-primary/30 rounded-[2.5rem] opacity-50" />
              <div className="absolute -top-4 -right-4 bg-primary text-white p-4 rounded-3xl shadow-xl shadow-primary/40 animate-bounce">
                <Smartphone className="w-7 h-7" />
              </div>
            </div>

            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">
                Terminal<br /><span className="text-primary">Ready</span>
              </h2>
              <p className="text-white/30 text-xs font-bold uppercase tracking-[0.2em] px-8">
                Tap the button below and scan the customer's meal token
              </p>
            </div>

            <button
              onClick={handleOpenCamera}
              className="w-full bg-primary hover:bg-primary/90 py-7 rounded-[2.5rem] font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-primary/25"
            >
              <Scan className="w-7 h-7" />
              Launch Intake
            </button>
          </div>
        )}

        {/* SCANNING — Loading */}
        {terminalState === 'SCANNING' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-300">
            <div className="w-32 h-32 rounded-[3rem] bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
              <RefreshCw className="w-16 h-16 text-primary animate-spin" />
            </div>
            <p className="text-xl font-black uppercase tracking-[0.3em] text-primary">Verifying Token…</p>
          </div>
        )}

        {/* REVIEW — show order + SERVE/REJECT */}
        {terminalState === 'REVIEW' && scannedOrder && (
          <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-bottom-10 duration-500">
            {/* Badge */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-1.5 rounded-full border border-green-500/30">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Token Authorized</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Order Contents</h2>
            </div>

            {/* Items */}
            <div className="flex-1 space-y-4">
              <p className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">
                <ShoppingBag className="w-3.5 h-3.5" />
                {scannedOrder.items.length} {scannedOrder.items.length === 1 ? 'item' : 'items'} to serve
              </p>
              {scannedOrder.items.map((item) => {
                const remaining = item.remainingQty !== undefined ? item.remainingQty : item.quantity;
                return (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden flex items-center p-3 gap-4">
                    <div className="w-28 h-28 rounded-3xl overflow-hidden bg-gray-900 flex-shrink-0 border border-white/10 shadow-inner">
                      <img
                        src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop'}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 pr-4 space-y-1">
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">Prepare Now</p>
                      <h3 className="text-2xl font-black tracking-tight leading-tight">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-3xl font-black text-white/90">×{remaining}</span>
                        <span className="bg-white/10 px-3 py-0.5 rounded-lg text-[10px] font-black text-white/40 uppercase tracking-widest">Quantity</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Customer info */}
            <div className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <User className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Meal Provision For</p>
                <p className="font-bold text-xl truncate tracking-tight">{scannedOrder.userName}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={handleReject}
                disabled={busy}
                className="bg-white/5 hover:bg-red-600/10 border border-white/10 hover:border-red-600/30 py-6 rounded-[2rem] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 text-white/60 hover:text-red-400 disabled:opacity-40"
              >
                {rejecting ? <RefreshCw className="animate-spin w-5 h-5" /> : <XCircle className="w-5 h-5 text-red-400" />}
                Reject
              </button>
              <button
                onClick={handleServeAll}
                disabled={busy}
                className="bg-green-600 hover:bg-green-500 py-6 rounded-[2rem] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-green-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {serving ? <RefreshCw className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                Serve
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {terminalState === 'SUCCESS' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-32 h-32 rounded-[3rem] bg-green-600 flex items-center justify-center shadow-2xl shadow-green-600/40">
              <CheckCircle className="w-16 h-16 text-white" />
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-5xl font-black tracking-tighter uppercase text-green-400">Served!</h2>
              <p className="text-white/40 font-black text-xs uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed">
                Order served successfully
              </p>
            </div>
            <button onClick={reset} className="w-full mt-8 bg-white/5 border border-white/10 hover:bg-white/10 py-6 rounded-[2.5rem] font-black uppercase tracking-widest transition-all active:scale-95">
              Reset Terminal
            </button>
          </div>
        )}

        {/* ERROR */}
        {terminalState === 'ERROR' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className="w-32 h-32 rounded-[3rem] bg-red-600 flex items-center justify-center shadow-2xl shadow-red-600/40">
              <AlertCircle className="w-16 h-16 text-white" />
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-5xl font-black tracking-tighter uppercase text-red-400">Rejected</h2>
              <p className="text-white/40 font-black text-xs uppercase tracking-[0.2em] max-w-[220px] mx-auto leading-relaxed">
                {errorMsg}
              </p>
            </div>
            <button onClick={reset} className="w-full mt-8 bg-white/5 border border-white/10 hover:bg-white/10 py-6 rounded-[2.5rem] font-black uppercase tracking-widest transition-all active:scale-95">
              Reset Terminal
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2 opacity-30">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Auth: Secure</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Sync Active</span>
        </div>
      </div>
    </div>
  );
};

export default ScannerView;
