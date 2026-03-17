
import React, { useState } from 'react';
import { LogOut, Scan, CheckCircle, AlertCircle, RefreshCw, Smartphone, Package, User, Clock, Trash2 } from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { validateQRForServing, scanAndServeOrder } from '../../services/firestore-db';
import Logo from '../../components/Logo';

interface ScannerViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

const ScannerView: React.FC<ScannerViewProps> = ({ profile, onLogout }) => {
  const [scanning, setScanning] = useState(false);
  const [serving, setServing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [result, setResult] = useState<{ type: 'SUCCESS' | 'ERROR', message: string } | null>(null);
  const [lastScannedRaw, setLastScannedRaw] = useState<string>('');

  const handleScan = async () => {
    if (!profile?.uid) {
      alert("System Auth Error: Invalid staff node session.");
      return;
    }

    setScanning(true);
    setResult(null);
    setScannedOrder(null);

    const rawData = prompt("JOE V2.0 Scanner Interface\nPaste QR Token Data:");

    if (!rawData) {
      setScanning(false);
      return;
    }

    setLastScannedRaw(rawData);

    try {
      const order = await validateQRForServing(rawData);
      setScannedOrder(order);
    } catch (err: any) {
      setResult({
        type: 'ERROR',
        message: err.message || 'VALIDATION FAILED'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleServeOrder = async () => {
    if (!scannedOrder || !lastScannedRaw) return;

    setServing(true);
    try {
      await scanAndServeOrder(lastScannedRaw, profile.uid);
      setResult({
        type: 'SUCCESS',
        message: 'ORDER SERVED SUCCESSFULLY'
      });
      setScannedOrder(null);
    } catch (err: any) {
      setResult({
        type: 'ERROR',
        message: err.message || 'SERVE FAILED'
      });
    } finally {
      setServing(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!scannedOrder || !lastScannedRaw) return;

    setRejecting(true);
    try {
      // For now, we just reset the terminal if they reject as per user flow
      // But we can add a specific firestore-db function for logging later
      setScannedOrder(null);
      setResult({
        type: 'ERROR',
        message: 'TOKEN REJECTED BY SERVER'
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-textMain text-white flex flex-col max-w-md mx-auto font-sans">
      {/* Header */}
      <div className="p-6 flex justify-between items-center border-b border-white/5 bg-white/5 backdrop-blur-xl">
        <Logo size="sm" className="!text-white" />
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2 py-0.5 bg-white/5 rounded-md">Server Node</p>
            <p className="text-sm font-bold mt-1">{profile?.name || 'Staff'}</p>
          </div>
          <button onClick={onLogout} className="p-3 bg-white/5 rounded-2xl hover:bg-error/20 transition-all active:scale-90 border border-white/10">
            <LogOut className="w-5 h-5 text-error" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 overflow-y-auto">
        {!scannedOrder && !result && (
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
              <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">Terminal<br /><span className="text-primary">Ready</span></h2>
              <p className="text-white/30 text-xs font-bold uppercase tracking-[0.2em] px-8">Align meal token in center of capture lens</p>
            </div>

            <button
              onClick={handleScan}
              disabled={scanning}
              className="w-full bg-primary hover:bg-primary/90 py-7 rounded-[2.5rem] font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-primary/25 disabled:opacity-50"
            >
              {scanning ? <RefreshCw className="animate-spin w-7 h-7" /> : <Scan className="w-7 h-7" />}
              Launch Intake
            </button>
          </div>
        )}

        {scannedOrder && (
          <div className="flex-1 flex flex-col space-y-6 animate-in slide-in-from-bottom-10 duration-500">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-success/20 text-success px-4 py-1.5 rounded-full border border-success/30">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Token Authorized</span>
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Order Contents</h2>
            </div>

            {/* LARGE ITEM VIEW */}
            <div className="flex-1 space-y-4">
              {scannedOrder.items.map((item) => (
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
                      <span className="text-3xl font-black text-white/90">x{item.quantity}</span>
                      <span className="bg-white/10 px-3 py-0.5 rounded-lg text-[10px] font-black text-white/40 uppercase tracking-widest">Quantity</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-4 bg-white/5 p-5 rounded-3xl border border-white/10">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Meal Provision For</p>
                  <p className="font-bold text-xl truncate tracking-tight">{scannedOrder.userName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleRejectOrder}
                  disabled={rejecting || serving}
                  className="bg-white/5 hover:bg-white/10 py-6 rounded-[2rem] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 border border-white/10 text-white/60"
                >
                  {rejecting ? <RefreshCw className="animate-spin w-5 h-5" /> : <Trash2 className="w-5 h-5 text-error" />}
                  Reject
                </button>
                <button
                  onClick={handleServeOrder}
                  disabled={serving || rejecting}
                  className="bg-success hover:bg-success/90 py-6 rounded-[2rem] font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-success/30 flex items-center justify-center gap-2"
                >
                  {serving ? <RefreshCw className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  Serve
                </button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in zoom-in-95 duration-300">
            <div className={`w-32 h-32 rounded-[3rem] flex items-center justify-center shadow-2xl ${result.type === 'SUCCESS' ? 'bg-success shadow-success/40' : 'bg-error shadow-error/40'
              }`}>
              {result.type === 'SUCCESS' ? (
                <CheckCircle className="w-16 h-16 text-white" />
              ) : (
                <AlertCircle className="w-16 h-16 text-white" />
              )}
            </div>

            <div className="text-center space-y-3">
              <h2 className={`text-5xl font-black tracking-tighter uppercase ${result.type === 'SUCCESS' ? 'text-success' : 'text-error'}`}>
                {result.type === 'SUCCESS' ? 'Ready' : 'Rejected'}
              </h2>
              <p className="text-white/40 font-black text-xs uppercase tracking-[0.2em] max-w-[200px] mx-auto leading-relaxed">
                {result.message}
              </p>
            </div>

            <button
              onClick={() => setResult(null)}
              className="w-full mt-8 bg-white/5 border border-white/10 hover:bg-white/10 py-6 rounded-[2.5rem] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Reset Terminal
            </button>
          </div>
        )}
      </div>

      {/* Persistence Info */}
      <div className="p-6 border-t border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2 opacity-30">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Auth: Secure</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
          <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Sync Active</span>
        </div>
      </div>
    </div>
  );
};

export default ScannerView;
