/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  CheckCircle2, XCircle, FileSpreadsheet, AreaChart, 
  AlertTriangle, DollarSign, Image as ImageIcon, Search, RefreshCw 
} from 'lucide-react';

export const CashierView: React.FC = () => {
  const {
    rechargeRequests,
    approveRecharge,
    rejectRecharge,
    orders,
    updateOrderStatus,
    menuItems,
    settings
  } = useApp();

  const [activeTab, setActiveTab] = useState<'RECHARGES' | 'CASH_ORDERS' | 'ANALYTICS' | 'LEDGER'>('RECHARGES');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Active Cash orders pending counter verification
  const pendingCashOrders = orders.filter(o => o.paymentMethod === 'CASH' && o.status === 'QUEUED' && o.paymentStatus === 'PENDING');

  // Pending recharge requests
  const pendingRecharges = rechargeRequests.filter(r => r.status === 'PENDING');

  // Conflict Intelligence helper: Check if multiple recharges share matching amount
  const detectAmountConflicts = () => {
    const counts: { [amount: number]: number } = {};
    pendingRecharges.forEach(r => {
      counts[r.amount] = (counts[r.amount] || 0) + 1;
    });
    return Object.keys(counts).filter(amt => counts[parseFloat(amt)] > 1).map(Number);
  };

  const conflicts = detectAmountConflicts();

  // Unified verifications count
  const verificationsCount = pendingRecharges.length + pendingCashOrders.length;

  const handleApproveRecharge = (id: string) => {
    approveRecharge(id);
  };

  const handleRejectRecharge = (id: string) => {
    if (!rejectReason) {
      alert('Please specify a rejection reason.');
      return;
    }
    rejectRecharge(id, rejectReason);
    setRejectId(null);
    setRejectReason('');
  };

  const handleApproveCashOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'COOKING'); // starts food prep queue, marks paid
  };

  const handleRejectCashOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'SERVED'); // cancelled
  };

  // Sales aggregates
  const totalReceivedRecharges = rechargeRequests
    .filter(r => r.status === 'APPROVED')
    .reduce((acc, r) => acc + r.amount, 0);

  const totalSalesVolume = orders
    .filter(o => o.status === 'SERVED' || o.paymentStatus === 'PAID')
    .reduce((acc, o) => acc + o.total, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 select-none">
      
      {/* Top Banner section */}
      <section className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
        <div className="space-y-1">
          <span className="font-mono text-[9px] text-brand-green tracking-widest uppercase font-extrabold flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-brand-green" />
            Cashier Desk Terminal Active
          </span>
          <h2 className="font-display text-lg font-black text-white">
            Register Approvals HUD
          </h2>
        </div>

        {/* Counter Indicators */}
        <div className="flex gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-surface-high border border-white/5 flex items-center gap-2 text-xs">
            <span className="font-mono text-zinc-400">Verifications Queue:</span>
            <span className={`font-mono font-black rounded-full px-2 py-0.5 text-[10px] ${
              verificationsCount > 0 ? 'bg-amber-400 text-black' : 'bg-zinc-700 text-white'
            }`}>
              {verificationsCount}
            </span>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-surface-high border border-white/5 flex items-center gap-2 text-xs">
            <span className="font-mono text-zinc-400 font-bold">Sales Volume:</span>
            <span className="font-mono text-brand-green font-extrabold">
              ${totalSalesVolume.toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Conflict intelligence overlay warnings */}
      {conflicts.length > 0 && (
        <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl flex gap-2.5 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-display font-black text-amber-300 uppercase tracking-wider">
              Conflict Intelligence Alert: Matching amount receipts
            </h4>
            <p className="font-sans text-on-surface-variant max-w-2xl leading-normal">
              Multiple pending wallet recharges match sums of: {conflicts.map(c => `$${c}`).join(', ')}. Ensure you cross-reference the 12-digit UTR strings to avoid duplicate approval fraud.
            </p>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex bg-surface-high/30 border border-white/5 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('RECHARGES')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'RECHARGES' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          RECHARGES ({pendingRecharges.length})
        </button>
        <button
          onClick={() => setActiveTab('CASH_ORDERS')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'CASH_ORDERS' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          CASH ORDERS ({pendingCashOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('ANALYTICS')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'ANALYTICS' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          SALES METRICS
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex-1 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
            activeTab === 'LEDGER' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          HISTORY LEDGER
        </button>
      </div>

      {/* Main tab sections views */}
      <main className="space-y-4">
        
        {/* Wallet topup recharges terminal */}
        {activeTab === 'RECHARGES' && (
          <section className="space-y-3">
            {pendingRecharges.length === 0 ? (
              <div className="text-center py-12 glass-stroke glass-bg rounded-2xl">
                <p className="font-sans text-xs text-on-surface-variant">Recharge terminal queue is clean. Ready to verify!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRecharges.map(req => (
                  <div key={req.id} className="p-4 rounded-xl border border-white/5 bg-surface-mid/60 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[9px] text-[#22c55e] bg-[#22c55e]/15 px-2 py-0.5 rounded-full font-bold">
                          RECHARGE REQUEST
                        </span>
                        <h4 className="font-display font-black text-xs text-white uppercase truncate max-w-[140px]">
                          {req.studentName}
                        </h4>
                      </div>
                      <span className="font-mono text-sm font-extrabold text-brand-purple-light">
                        ${req.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] bg-surface-lowest/50 p-2.5 rounded-lg border border-white/5 font-mono">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">UTR String:</span>
                        <span className="text-white font-extrabold">{req.utrNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Timestamp:</span>
                        <span className="text-white">{req.timestamp}</span>
                      </div>
                    </div>

                    {/* Attachment preview simulator */}
                    <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-brand-purple-light bg-brand-purple-dark/5 p-2 rounded-lg border border-brand-purple/10">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Attachment: receipt_scrnshot.jpg</span>
                    </div>

                    {rejectId === req.id ? (
                      // Custom Rejection Note form block
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <input
                          type="text"
                          required
                          className="w-full h-9 bg-surface-lowest border border-white/10 rounded-lg px-2.5 text-[11px] font-sans text-on-surface focus:outline-none"
                          placeholder="Specify reason (e.g. UTR doesn't match)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRejectRecharge(req.id)}
                            className="flex-1 py-1 px-3 bg-red-500 hover:bg-red-600 text-white rounded-md font-mono text-[10px] font-bold"
                          >
                            REJECT
                          </button>
                          <button
                            onClick={() => setRejectId(null)}
                            className="py-1 px-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md font-mono text-[10px]"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Smart triggers confirmations
                      <div className="flex gap-2.5 pt-2 border-t border-white/5 font-mono">
                        <button
                          onClick={() => handleApproveRecharge(req.id)}
                          className="flex-1 h-9 rounded-lg bg-brand-green hover:bg-brand-green/85 text-brand-green-dark text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          CONFIRM APPROVE
                        </button>
                        <button
                          onClick={() => setRejectId(req.id)}
                          className="px-3.5 h-9 rounded-lg bg-red-500/10 border border-red-500/30 hover:border-red-500/50 text-red-400 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          REJECT
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Cash payment order queues verifications */}
        {activeTab === 'CASH_ORDERS' && (
          <section className="space-y-3">
            {pendingCashOrders.length === 0 ? (
              <div className="text-center py-12 glass-stroke glass-bg rounded-2xl">
                <p className="font-sans text-xs text-on-surface-variant">No pending cash orders queue at the counter. Perfect!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingCashOrders.map(order => (
                  <div key={order.id} className="p-4 rounded-xl border border-white/5 bg-surface-mid/60 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[9px] text-[#f59e0b] bg-[#f59e0b]/15 px-2 py-0.5 rounded-full font-bold">
                          PENDING CASH PAYMENT
                        </span>
                        <h4 className="font-display font-black text-xs text-white uppercase">
                          TOKEN {order.tokenNumber}
                        </h4>
                      </div>
                      <span className="font-mono text-sm font-extrabold text-brand-purple-light">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-on-surface-variant">
                          <span>{it.quantity}x {it.name}</span>
                          <span>${(it.price * it.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2.5 pt-2 border-t border-white/5 font-mono">
                      <button
                        onClick={() => handleApproveCashOrder(order.id)}
                        className="flex-1 h-9 rounded-lg bg-brand-green hover:bg-brand-green/85 text-brand-green-dark text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        CONFIRM CASH RECEIVED
                      </button>
                      <button
                        onClick={() => handleRejectCashOrder(order.id)}
                        className="px-3.5 h-9 rounded-lg bg-red-500/10 border border-red-500/30 hover:border-red-500/50 text-red-400 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        REJECT INVOICE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Sales performance matrices charts and graphs */}
        {activeTab === 'ANALYTICS' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Sales velocities columns bar graphs */}
              <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-4">
                <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                  Hour-by-Hour Sales velocities (Simulated)
                </h3>
                <div className="h-44 flex items-end justify-between gap-2.5 pt-6 border-b border-white/5">
                  {[
                    { hr: '9a', vol: 40 },
                    { hr: '11a', vol: 80 },
                    { hr: '1p', vol: 15 },
                    { hr: '3p', vol: 30 },
                    { hr: '5p', vol: 90 },
                    { hr: '7p', vol: 60 }
                  ].map((sl, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <div className="font-mono text-[9px] text-[#cbd5e1]">{sl.vol}s</div>
                      {/* CSS volume indicator bar */}
                      <div 
                        className="w-full bg-linear-to-t from-brand-purple-dark to-brand-purple rounded-t-md shadow-md shadow-brand-purple/10"
                        style={{ height: `${sl.vol}%` }}
                      />
                      <span className="font-mono text-[9px] text-zinc-500 select-all uppercase">
                        {sl.hr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Splits Visual slider bar */}
              <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-4">
                <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                  Prepaid Wallet vs Cash checkout Splits
                </h3>
                
                <div className="space-y-2 pt-4">
                  <div className="h-6 rounded-full overflow-hidden flex text-[10px] font-mono font-black text-center text-surface-lowest">
                    <div className="bg-brand-green h-full flex items-center justify-center" style={{ width: '75%' }}>
                      WALLET (75%)
                    </div>
                    <div className="bg-brand-purple h-full flex items-center justify-center" style={{ width: '25%' }}>
                      CASH (25%)
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-[10.5px] font-mono text-zinc-400">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-green" />
                      <span>Wallet checkout</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-purple" />
                      <span>Cash counter checks</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] font-sans text-on-surface-variant leading-relaxed">
                  👨‍✈️ <strong>Prepaid preference:</strong> Student wallet transactions represent the primary volume, validating frictionless piloting.
                </div>
              </div>

              {/* Catalog stock levels */}
              <div className="glass-bg glass-stroke rounded-2xl p-4 space-y-3.5 md:col-span-2">
                <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                  Menu Catalog remaining stock inventory quantities
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {menuItems.map(m => {
                    const pct = Math.round((m.stock / m.initialStock) * 100);
                    return (
                      <div key={m.id} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-sans">
                          <span className="text-white font-medium">{m.name}</span>
                          <span className="font-mono text-zinc-500">{m.stock} / {m.initialStock} left</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 border border-white/5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              pct < 25 ? 'bg-red-400' : pct < 50 ? 'bg-amber-400' : 'bg-brand-green'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Database records ledger tables review */}
        {activeTab === 'LEDGER' && (
          <section className="space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                className="w-full h-10 bg-surface-mid border border-white/5 rounded-xl pl-9 pr-4 text-xs text-on-surface placeholder:text-zinc-500 focus:outline-none"
                placeholder="Search ledger indices by customer email or order reference..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
            </div>

            <div className="glass-bg glass-stroke rounded-xl overflow-hidden overflow-x-auto select-all">
              <table className="w-full text-left font-mono text-[10.5px]">
                <thead>
                  <tr className="bg-surface-high border-b border-white/5 text-zinc-500">
                    <th className="p-3">REF ID</th>
                    <th className="p-3">CUSTOMER</th>
                    <th className="p-3">PAY TYPE</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {orders
                    .filter(o => o.studentName.toLowerCase().includes(ledgerSearch.toLowerCase()) || o.tokenNumber.includes(ledgerSearch))
                    .map(o => (
                      <tr key={o.id} className="hover:bg-white/5">
                        <td className="p-3 text-white font-bold">{o.tokenNumber}</td>
                        <td className="p-3 uppercase">{o.studentName}</td>
                        <td className="p-3">{o.paymentMethod}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide border ${
                            o.status === 'SERVED' ? 'border-[#3f3f46] text-[#a1a1aa]' : 'border-brand-purple text-brand-purple'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-brand-purple-light font-black">${o.total.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </main>

    </div>
  );
};
