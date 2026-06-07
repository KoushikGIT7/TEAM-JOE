import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { WalletTransaction, WalletRechargeRequest, WalletSummary } from '../../types';
import {
  listenToWalletSummary,
  listenToWalletTransactions,
  listenToMyRechargeRequests,
  WALLET_LOW_BALANCE_THRESHOLD,
} from '../../services/wallet';

interface WalletViewProps {
  profile: UserProfile;
  onBack: () => void;
  onAddMoney: () => void;
}

const formatAmount = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const formatTime = (ms: number) =>
  new Date(ms).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const StatusBadge: React.FC<{ status: WalletRechargeRequest['status'] }> = ({ status }) => {
  if (status === 'pending')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest border border-amber-100">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  if (status === 'approved')
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-100">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest border border-rose-100">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
};

const txReasonLabel: Record<string, string> = {
  wallet_recharge: 'Recharge',
  order_purchase: 'Order Payment',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

const WalletView: React.FC<WalletViewProps> = ({ profile, onBack, onAddMoney }) => {
  const [summary, setSummary] = useState<WalletSummary>({ walletBalance: 0, totalRecharged: 0, totalSpent: 0 });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<WalletRechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);

    const unsubs = [
      listenToWalletSummary(profile.uid, (s) => { setSummary(s); setLoading(false); }),
      listenToWalletTransactions(profile.uid, setTransactions),
      listenToMyRechargeRequests(profile.uid, setRechargeRequests),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [profile?.uid]);

  const isLowBalance = summary.walletBalance < WALLET_LOW_BALANCE_THRESHOLD;
  const pendingRequest = rechargeRequests.find((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative overflow-x-hidden flex flex-col font-sans border-x border-slate-100 shadow-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-30 px-5 py-4 border-b border-slate-100 flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-black text-slate-900 tracking-tighter">JOE Wallet</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Campus Prepaid Account</p>
        </div>
        <Wallet className="w-5 h-5 text-slate-300" />
      </header>

      <div className="flex-1 overflow-y-auto pb-32">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Balance Card ──────────────────────────────────────────────── */}
            <div className="px-5 pt-6">
              <div
                className="relative rounded-[2.5rem] overflow-hidden p-7 text-white shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F9D58 100%)',
                }}
              >
                {/* Decorative circles */}
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5" />
                <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-2">
                  Wallet Balance
                </p>
                <h2 className="text-5xl font-black tracking-tighter mb-6">
                  {formatAmount(summary.walletBalance)}
                </h2>

                {/* Stats row */}
                <div className="flex gap-6">
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Total Recharged</p>
                    <p className="text-sm font-black text-white/90">{formatAmount(summary.totalRecharged)}</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-0.5">Total Spent</p>
                    <p className="text-sm font-black text-white/90">{formatAmount(summary.totalSpent)}</p>
                  </div>
                </div>

                {/* Student name chip */}
                <div className="absolute top-6 right-6 bg-white/10 backdrop-blur px-3 py-1.5 rounded-2xl">
                  <p className="text-[10px] font-black text-white/80">{profile.name}</p>
                </div>
              </div>
            </div>

            {/* ── Low Balance Warning ───────────────────────────────────────── */}
            {isLowBalance && (
              <div className="px-5 pt-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-amber-800">Balance Running Low</p>
                    <p className="text-[11px] text-amber-600 font-medium mt-0.5">
                      Recharge recommended to continue ordering
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Pending Recharge Banner ───────────────────────────────────── */}
            {pendingRequest && (
              <div className="px-5 pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-blue-800">
                        {formatAmount(pendingRequest.amount)} Recharge
                      </p>
                      <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">
                        Pending Cashier Verification
                      </p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
                </div>
              </div>
            )}

            {/* ── Add Money Button ─────────────────────────────────────────── */}
            <div className="px-5 pt-5">
              <button
                onClick={onAddMoney}
                disabled={!!pendingRequest}
                className="w-full bg-slate-900 text-white font-black text-sm uppercase tracking-widest py-5 rounded-[2rem] shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Plus className="w-5 h-5" />
                {pendingRequest ? 'Recharge Pending...' : 'Add Money'}
              </button>
              {pendingRequest && (
                <p className="text-center text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">
                  A recharge is being verified — you can add more once this is resolved
                </p>
              )}
            </div>

            {/* ── Recent Transactions ──────────────────────────────────────── */}
            <div className="px-5 pt-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Recent Activity
              </h3>

              {transactions.length === 0 && rechargeRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wallet className="w-7 h-7 text-slate-300" />
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No Activity Yet</p>
                  <p className="text-xs text-slate-300 font-medium mt-1">Add money to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Recharge requests (non-pending shown as historical) */}
                  {rechargeRequests
                    .filter((r) => r.status !== 'pending') // pending shown in banner above
                    .map((r) => (
                      <div
                        key={r.id}
                        className="bg-white rounded-3xl px-5 py-4 border border-slate-100 shadow-sm flex items-center gap-4"
                      >
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            r.status === 'approved'
                              ? 'bg-emerald-50'
                              : 'bg-rose-50'
                          }`}
                        >
                          {r.status === 'approved' ? (
                            <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-rose-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-800">
                            {r.status === 'approved' ? 'Recharge Approved' : 'Recharge Rejected'}
                          </p>
                          {r.rejectionNote && (
                            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                              {r.rejectionNote}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-300 font-bold mt-0.5">
                            {formatTime(r.reviewedAt || r.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`text-base font-black ${
                              r.status === 'approved' ? 'text-emerald-600' : 'text-slate-400 line-through'
                            }`}
                          >
                            +{formatAmount(r.amount)}
                          </p>
                        </div>
                      </div>
                    ))}

                  {/* Wallet transactions */}
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-white rounded-3xl px-5 py-4 border border-slate-100 shadow-sm flex items-center gap-4"
                    >
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          tx.type === 'credit' ? 'bg-emerald-50' : 'bg-red-50'
                        }`}
                      >
                        {tx.type === 'credit' ? (
                          <TrendingUp className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-slate-800">
                          {txReasonLabel[tx.reason] || tx.reason}
                        </p>
                        {tx.orderId && (
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                            Order #{tx.orderId.slice(-6).toUpperCase()}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-300 font-bold mt-0.5">
                          {formatTime(tx.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-base font-black ${
                            tx.type === 'credit' ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {tx.type === 'credit' ? '+' : '-'}{formatAmount(tx.amount)}
                        </p>
                        <p className="text-[9px] text-slate-300 font-bold">
                          Bal: {formatAmount(tx.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Recharge History ─────────────────────────────────────────── */}
            {rechargeRequests.length > 0 && (
              <div className="px-5 pt-8 pb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Recharge History
                </h3>
                <div className="space-y-3">
                  {rechargeRequests.map((r) => (
                    <div
                      key={r.id}
                      className="bg-white rounded-3xl px-5 py-4 border border-slate-100 shadow-sm flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800">{formatAmount(r.amount)}</p>
                        <p className="text-[10px] text-slate-300 font-bold mt-0.5">
                          {formatTime(r.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WalletView;
