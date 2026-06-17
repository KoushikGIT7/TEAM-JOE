/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {ArrowLeft, Shield, RotateCcw, HelpCircle, PhoneCall, Mail } from 'lucide-react';

interface ComplianceViewProps {
  onBackToMenu: () => void;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({ onBackToMenu }) => {
  const [activeSegment, setActiveSegment] = useState<'PRIVACY' | 'REFUNDS' | 'CONTACT'>('PRIVACY');

  return (
    <div className="min-h-screen bg-surface-lowest pb-24 text-on-surface">
      {/* App Bar Header */}
      <header className="sticky top-0 z-50 flex items-center gap-3 px-5 h-16 w-full bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5">
        <button
          onClick={onBackToMenu}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-brand-purple" />
        </button>
        <div className="flex flex-col">
          <span className="font-mono text-[9px] tracking-widest text-[#a3b8cc] select-none font-bold">
            LEGAL COMPLIANCE STATEMENT
          </span>
          <h1 className="font-display text-lg font-black text-white leading-none">
            Terms & Helplines
          </h1>
        </div>
      </header>

      {/* Segment tabs */}
      <main className="px-5 mt-4 space-y-5 max-w-lg mx-auto">
        <div className="flex bg-surface-high/30 border border-white/5 p-1 rounded-xl gap-1 justify-between select-none">
          <button
            onClick={() => setActiveSegment('PRIVACY')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSegment === 'PRIVACY' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            PRIVACY
          </button>
          <button
            onClick={() => setActiveSegment('REFUNDS')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSegment === 'REFUNDS' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            REFUNDS
          </button>
          <button
            onClick={() => setActiveSegment('CONTACT')}
            className={`flex-1 py-2 text-center rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSegment === 'CONTACT' ? 'bg-brand-purple text-surface-lowest shadow-md' : 'text-zinc-400 hover:text-white'
            }`}
          >
            SUPPORT
          </button>
        </div>

        {/* Display Segment Contents */}
        <div className="glass-bg glass-stroke rounded-2xl p-5 space-y-4 font-sans text-xs text-on-surface-variant leading-relaxed">
          
          {activeSegment === 'PRIVACY' && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <Shield className="w-5 h-5 text-brand-purple" />
                <h3 className="font-display font-extrabold text-sm text-white select-none">
                  Data Governance & PCI-DSS
                </h3>
              </div>

              <p>
                The CSE Smart Cafeteria application collects the minimal student registry indices (including your institutional email credentials and payment identifiers) securely proxying ledger allocations.
              </p>
              <p>
                <strong>Prepaid Wallets:</strong> In accordance with industry standards, actual digital ledger balances are cached and encrypted client-side, syncing atomically with verified cashier-recharge databases.
              </p>
              <p>
                <strong>Screenshot Data:</strong> Uploaded transaction recharges (including JPG, PNG file metadata) is exclusively used by cash counters for audit trials, completely purging from databases immediately after review.
              </p>
            </div>
          )}

          {activeSegment === 'REFUNDS' && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <RotateCcw className="w-5 h-5 text-brand-purple" />
                <h3 className="font-display font-extrabold text-sm text-white select-none">
                  Refunds & Order Cancellations
                </h3>
              </div>

              <p>
                <strong>Prepaid Wallets reversals:</strong> Funds placed into prepaid campus accounts represent secure digital credits. These are full-value credits redeemable at all active cafeteria points.
              </p>
              <p>
                <strong>Cooking timeouts:</strong> Items remaining in cooking prep queue for longer than 20 minutes automatically trigger reverse wallet reimbursements if requested by students at cashier portals.
              </p>
              <p>
                <strong>Dispensation failures:</strong> If a snack locker fails to release a package, the transaction is marked as canceled and refunded. Present receipt tokens to cashier staff for direct balance re-credits.
              </p>
            </div>
          )}

          {activeSegment === 'CONTACT' && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <HelpCircle className="w-5 h-5 text-brand-purple" />
                <h3 className="font-display font-extrabold text-sm text-white select-none">
                  Helpline Support Desks
                </h3>
              </div>

              <p>
                The secure Smart Cafeteria terminals are monitored 24/7 by the active campus team. Please use the contacts below for balance queries:
              </p>

              {/* Support contact info tabs */}
              <div className="grid grid-cols-1 gap-2 pt-2 select-none">
                <a 
                  href="tel:+919876543210"
                  className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-brand-purple/35 flex items-center gap-3 transition-colors text-white"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                    <PhoneCall className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-mono text-[9px] text-[#a3b8cc] block">HOT DESK NUMBERS</span>
                    <span className="font-mono text-xs font-bold leading-none">+91 98765 43210</span>
                  </div>
                </a>

                <a 
                  href="mailto:support.cse@campuscanteen.edu"
                  className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-brand-purple/35 flex items-center gap-3 transition-colors text-white"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple shrink-0">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="font-mono text-[9px] text-[#a3b8cc] block">SUPPORT EMAIL INTAKE</span>
                    <span className="font-mono text-xs font-bold leading-none">support.cse@canteen.edu</span>
                  </div>
                </a>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};
