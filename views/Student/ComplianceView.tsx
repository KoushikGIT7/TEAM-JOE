import React from 'react';
import { ShieldCheck, Mail, MapPin, Phone, ArrowLeft, Lock, CreditCard } from 'lucide-react';

interface PolicyLayoutProps {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}

const PolicyLayout: React.FC<PolicyLayoutProps> = ({ title, onBack, children }) => (
  <div className="min-h-screen bg-white p-4 md:p-10 font-sans animate-in fade-in duration-500">
    <div className="max-w-3xl mx-auto border border-black/5 bg-white rounded-[2.5rem] shadow-sm overflow-hidden">
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
          JOE CAFETERIA • TRUSTED CAMPUS HOSPITALITY PARTNER
        </p>
      </div>
    </div>
  </div>
);

export const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Privacy Policy" onBack={onBack}>
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">1. Data Collection</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">We collect minimal personal information (Name, Email, Institution ID) strictly for identity verification and order processing within the campus premise.</p>
    </section>
    
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">2. Security</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">Your data is stored securely using Google Firebase (Cloud Firestore). We do not store your credit card or net-banking credentials on our servers; all payments are processed via PCI-DSS compliant gateways like Razorpay/Cashfree.</p>
    </section>

    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">3. Third-Party Sharing</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">We NEVER sell or share student data with advertisers. Data is only shared with payment processors to facilitate transactions.</p>
    </section>
  </PolicyLayout>
);

export const RefundPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Refunds & Cancellation" onBack={onBack}>
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">1. Order Cancellations</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">Orders once placed can only be cancelled within 60 seconds if the kitchen has not started preparation. Contact the cashier counter immediately for urgent cancellations.</p>
    </section>
    
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">2. Refund Eligibility</h2>
      <ul className="text-sm text-textSecondary font-bold space-y-3">
          <li className="flex gap-2"><span>•</span> <span>100% Refund if the order is REJECTED by the kitchen.</span></li>
          <li className="flex gap-2"><span>•</span> <span>100% Refund if items are out of stock.</span></li>
          <li className="flex gap-2"><span>•</span> <span>No partial refunds for collected orders unless there is a quality issue verified by the Server Counter.</span></li>
      </ul>
    </section>

    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">3. Refund Timeline</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">Refunds are processed to the original payment method within 5-7 working days as per bank norms.</p>
    </section>
  </PolicyLayout>
);

export const TermsAndConditions: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Terms & Conditions" onBack={onBack}>
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">1. Acceptance</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">By using the JOE Cafeteria app, you agree to abide by the campus cafeteria rules and conduct standards.</p>
    </section>
    
    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">2. Order Collection</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">You must collect your order within 30 minutes of it being marked "Ready". Uncollected orders after this duration are considered "Missed" and are not eligible for refunds.</p>
    </section>

    <section>
      <h2 className="text-lg font-black text-textMain mb-4 uppercase tracking-tighter italic">3. Usage Restrictions</h2>
      <p className="text-sm text-textSecondary font-bold leading-relaxed">Sharing QR codes for order collection is at your own risk. The app is intended for personal student/staff use only.</p>
    </section>
  </PolicyLayout>
);

export const ContactUs: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PolicyLayout title="Contact Us" onBack={onBack}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-primary/20 transition-all group">
        <Mail className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-2">Support Email</h3>
        <p className="text-sm text-textMain font-black">support@joecafe.com</p>
      </div>
      
      <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-primary/20 transition-all group">
        <Phone className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-2">Helpline</h3>
        <p className="text-sm text-textMain font-black">+91 98765-43210</p>
      </div>

      <div className="bg-gray-100 p-8 rounded-3xl border border-gray-200 hover:border-primary/20 transition-all md:col-span-2 group">
        <MapPin className="w-8 h-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
        <h3 className="text-xs font-black text-textSecondary uppercase tracking-widest mb-2">Cafeteria Address</h3>
        <p className="text-sm text-textMain font-black leading-relaxed">
          JOE Cafeteria & Lounge,<br />
          Main Food Court, Central Campus,<br />
          Hyderabad, Telangana - 500032
        </p>
      </div>
    </div>
  </PolicyLayout>
);

export const ComplianceFooter: React.FC<{ 
    onOpen: (view: 'privacy' | 'refund' | 'terms' | 'contact') => void 
}> = ({ onOpen }) => (
    <div className="mt-12 py-10 border-t border-gray-100">
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mb-8">
            <button onClick={() => onOpen('terms')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Terms of Service</button>
            <button onClick={() => onOpen('privacy')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Privacy Policy</button>
            <button onClick={() => onOpen('refund')} className="text-[10px] font-black uppercase tracking-[0.2em] text-textSecondary hover:text-primary transition-colors">Return Policy</button>
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
                    <span className="text-[9px] font-black text-textSecondary uppercase tracking-widest">Powered by Razorpay</span>
                </div>
            </div>
            <p className="text-[10px] text-center font-bold text-textSecondary max-w-[280px] leading-relaxed">
                Transactions are processed via secure 128-bit encryption. We never store payment credentials.
            </p>
        </div>
    </div>
);
