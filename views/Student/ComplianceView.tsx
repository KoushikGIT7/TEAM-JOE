import React, { useState } from 'react';
import { 
  ShieldCheck, Mail, MapPin, Phone, ArrowLeft, Lock, CreditCard, 
  Shield, RotateCcw, HelpCircle, PhoneCall 
} from 'lucide-react';

interface PolicyLayoutProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}

const PolicyLayout: React.FC<PolicyLayoutProps> = ({ title, onBack, children }) => (
  <div className="fixed inset-0 z-[100] bg-white p-4 md:p-10 font-sans animate-in slide-in-from-bottom duration-500 overflow-y-auto">
    <div className="max-w-3xl mx-auto border border-black/5 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden my-10">
      <div className="p-8 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white z-10">
        <button onClick={onBack} className="p-3 bg-gray-50 rounded-2xl text-textSecondary active:scale-90 transition-all hover:bg-gray-100 shadow-sm">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-black text-textMain tracking-tight uppercase">{title}</h1>
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="p-10">
        <div className="space-y-8">
          {children}
        </div>
      </div>
      <div className="p-8 bg-gray-50/50 border-t border-gray-100 text-center">
        <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest leading-loose">
          CSE CAFETERIA • TRUSTED CAMPUS HOSPITALITY PARTNER
        </p>
      </div>
    </div>
  </div>
);

export const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Privacy Policy" onBack={onBack}>
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">1. Introduction</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed whitespace-pre-line">
        CSE Cafeteria ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how your personal information is collected, used, and disclosed by CSE Cafeteria.
        By accessing or using our Service, you signify that you have read, understood, and agree to our collection, storage, use, and disclosure of your personal information as described in this Privacy Policy and our Terms of Service.
      </p>
    </section>
    
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">2. Information Collection</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">We collect minimal personal information strictly required for operation:</p>
      <ul className="text-sm text-textSecondary font-bold space-y-2 mt-2">
        <li>• Identity: Name, Student/Staff ID, Email address.</li>
        <li>• Usage Data: Order history, cafeteria preferences, and app interaction logs.</li>
        <li>• Device Info: IP address and device identifier for security purposes.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">3. Payment Security</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">
        Your payment data is processed by industry-leading, PCI-DSS compliant payment gateways. We do not store your credit card, debit card, or net-banking credentials on our servers. All transactions are encrypted via secure SSL layers.
      </p>
    </section>
  </PolicyLayout>
);

export const RefundPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Refunds & Cancellation" onBack={onBack}>
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">1. Cancellation Policy</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed whitespace-pre-line">
        At CSE Cafeteria, we strive for operational excellence. Since we serve freshly prepared food items, order cancellations are governed by the following rules:
        • Standard Items: Cancellations are allowed only if requested within 60 seconds of order placement.
        • Preparation Items: Once the kitchen marks an item as "Preparing," no cancellations or modifications can be accepted.
      </p>
    </section>
    
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">2. Professional Refund Standards</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed mb-4">We maintain a transparent refund process similar to global enterprise standards:</p>
      <ul className="text-sm text-textSecondary font-bold space-y-4">
          <li className="flex gap-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <span><strong>Technical Failure:</strong> In case of a double-debit or payment failure where the order was not generated but the amount was deducted, a 100% refund is initiated automatically.</span>
          </li>
          <li className="flex gap-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <span><strong>Service Rejection:</strong> If the kitchen rejects an order due to stock unavailability or facility closure, a full refund is processed immediately.</span>
          </li>
          <li className="flex gap-4">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <span><strong>Quality Dispute:</strong> Verified quality issues reported at the counter before collection may be eligible for replacement or credit.</span>
          </li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">3. Transaction Timelines</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">
        Approved refunds are credited to the original source of payment within 5 to 7 business days, depending on your banking institution's settlement cycle.
      </p>
    </section>
  </PolicyLayout>
);

export const TermsAndConditions: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Terms & Conditions" onBack={onBack}>
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">1. Agreement to Terms</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">By using the CSE Cafeteria platform, you agree to these terms and all applicable campus regulations.</p>
    </section>
    
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">2. Order Collection Duty</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">Students/Staff are responsible for collecting their orders within 30 minutes of the "Ready" notification. Failure to collect does not entitle the user to a refund as the food item is prepared specifically for the order.</p>
    </section>
  </PolicyLayout>
);

export const ContactUs: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Contact Us" onBack={onBack}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <a href="mailto:koushikabhi.dev@gmail.com" className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-primary/20 transition-all group">
        <Mail className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-2">Support Email</h3>
        <p className="text-sm text-textMain font-black">koushikabhi.dev@gmail.com</p>
      </a>
      
      <a href="tel:+919110405638" className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-primary/20 transition-all group">
        <Phone className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-2">Helpline</h3>
        <p className="text-sm text-textMain font-black">+91 91104-05638</p>
      </a>

      <div className="bg-gray-100 p-8 rounded-3xl border border-gray-200 hover:border-primary/20 transition-all md:col-span-2 group">
        <MapPin className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-2">Corporate Office</h3>
        <p className="text-sm text-textMain font-black leading-relaxed">
          CSE Automation Solutions,<br />
          Kishkinda University, Ballari, Karnataka, Siruguppa Road
        </p>
      </div>
    </div>
  </PolicyLayout>
);

export const ComplianceFooter: React.FC<{ 
    onOpen: (view: 'privacy' | 'refund' | 'terms' | 'contact') => void 
}> = ({ onOpen }) => (
    <div className="mt-12 py-10 border-t border-gray-100 w-full px-6">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-8">
            <button onClick={() => onOpen('terms')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Terms Conditions</button>
            <button onClick={() => onOpen('privacy')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Privacy Policy</button>
            <button onClick={() => onOpen('refund')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Refund Policy</button>
            <button onClick={() => onOpen('contact')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Contact Us</button>
        </div>
        
        <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-6 opacity-60">
                <div className="flex items-center gap-2">
                    <Lock className="w-3 h-3 text-textSecondary" />
                    <span className="text-[9px] font-black text-textSecondary uppercase tracking-widest">Encypted SSL</span>
                </div>
                <div className="flex items-center gap-2">
                    <CreditCard className="w-3 h-3 text-textSecondary" />
                    <span className="text-[9px] font-black text-textSecondary uppercase tracking-widest">Secure Checkout</span>
                </div>
            </div>
            <p className="text-[10px] text-center font-bold text-textSecondary max-w-[280px] leading-relaxed">
                Transactions are processed via secure 128-bit encryption. We never store payment credentials.
            </p>
        </div>
    </div>
);

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
