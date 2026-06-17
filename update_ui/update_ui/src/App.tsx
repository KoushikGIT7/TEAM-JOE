/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';

// --- Student Components ---
import { WelcomeView } from './components/student/WelcomeView';
import { HomeView } from './components/student/HomeView';
import { PaymentView } from './components/student/PaymentView';
import { QRView } from './components/student/QRView';
import { OrdersView } from './components/student/OrdersView';
import { WalletView } from './components/student/WalletView';
import { AddMoneyView } from './components/student/AddMoneyView';
import { ComplianceView } from './components/student/ComplianceView';
import { QuestsView } from './components/student/QuestsView';
import { RankView } from './components/student/RankView';
import { StoreView } from './components/student/StoreView';
import { VaultView } from './components/student/VaultView';
import { ProfileView } from './components/student/ProfileView';
import { CanteenMonitorView } from './components/student/CanteenMonitorView';

// --- Staff Components ---
import { StaffLoginView } from './components/staff/StaffLoginView';
import { CashierView } from './components/staff/CashierView';
import { CookView } from './components/staff/CookView';
import { AssistantSupervisorView } from './components/staff/AssistantSupervisorView';
import { ScannerView } from './components/staff/ScannerView';
import { AdminView } from './components/admin/AdminView';

// --- Icon Packs ---
import { 
  Compass, Ticket, Wallet, ClipboardList, ShieldAlert,
  Sparkles, KeyRound, LogOut, ChevronDown, Laptop, UserCheck,
  Bolt, Trophy, ShoppingBag, Vault, User, Tv
} from 'lucide-react';

function NavigationWrapper() {
  const {
    portalMode, setPortalMode,
    studentTab, setStudentTab,
    isStaffLoggedIn, setIsStaffLoggedIn,
    staffRole, setStaffRole,
    isLoggedIn, handleStudentLogout,
    cart,
    orders,
    activeOrderTrackId,
    setActiveOrderTrackId,
    reseedAllData
  } = useApp();

  // Manage in-app recharge portal sub-tab triggers dynamically
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  // -------------------------------------------------------------
  // Cafeteria TV Monitor Portal
  // -------------------------------------------------------------
  if (portalMode === 'MONITOR') {
    return <CanteenMonitorView />;
  }

  // Filter if there are any active student orders queuing or cook prep
  const activeOrderCount = orders.filter(o => o.status !== 'SERVED').length;

  const handleBackToMenu = () => {
    setShowAddMoney(false);
    setStudentTab('HOME');
  };

  const handleNavigateToTracking = (orderId: string) => {
    setActiveOrderTrackId(orderId);
    setStudentTab('TRACKING');
  };

  // -------------------------------------------------------------
  // Staff Portal Main Controller
  // -------------------------------------------------------------
  if (portalMode === 'STAFF') {
    if (!isStaffLoggedIn) {
      return (
        <StaffLoginView 
          onBackToStudentPortal={() => setPortalMode('STUDENT')} 
        />
      );
    }

    return (
      <div className="min-h-screen bg-surface-lowest text-on-surface">
        {/* Customized Staff Header Controls */}
        <header className="sticky top-0 z-50 flex flex-col sm:flex-row sm:justify-between sm:items-center px-5 py-3.5 bg-surface-lowest/90 backdrop-blur-md border-b border-white/5 gap-3">
          <div className="flex items-center gap-3 select-none">
            <div className="w-9 h-9 rounded-full bg-brand-purple/20 flex items-center justify-center border border-brand-purple/35 shrink-0 animate-pulse">
              <Laptop className="w-5 h-5 text-brand-purple-light" />
            </div>
            <div>
              <span className="font-mono text-[9px] text-[#cbd5e1] tracking-widest block uppercase font-bold leading-none">
                CAMPUS INTAKE ECOSYSTEM
              </span>
              <h1 className="font-display font-extrabold text-[#f4f4f5] text-sm leading-none mt-1">
                CSE Staff Cockpit
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            {/* Quick Dev Role Switching shortcut */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="px-3 py-1.5 rounded-xl bg-[#1e293b] hover:bg-zinc-700 font-mono text-[10px] text-brand-purple-light border border-white/5 flex items-center gap-1.5 cursor-pointer uppercase font-black"
              >
                <span>ROLE: {staffRole}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50">
                  <span className="font-mono text-[8px] text-zinc-500 font-bold uppercase tracking-wider block px-3 py-1 border-b border-white/5">
                    Select Test Roles
                  </span>
                  {[
                    { label: 'CASHIER COUNTER', value: 'CASHIER' },
                    { label: 'KITCHEN COOK', value: 'COOK' },
                    { label: 'LINE SUPERVISOR', value: 'SUPERVISOR' },
                    { label: 'COUNTER SERVER', value: 'SERVER' },
                    { label: 'SYSTEM ADMIN', value: 'ADMIN' },
                  ].map(r => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setStaffRole(r.value as any);
                        setRoleMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 font-mono text-[10px] hover:bg-brand-purple/15 hover:text-brand-purple-light transition-colors block text-zinc-300 uppercase leading-none border-b border-white/5 last:border-none cursor-pointer"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reset mock database stats triggers */}
            <button
              onClick={() => {
                if (confirm('Database Overhaul: Reseed all starting wallet balances, menu items backlog, and clear active receipts order histories?')) {
                  reseedAllData();
                }
              }}
              className="px-3 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer border border-red-500/15"
            >
              Reset Data
            </button>

            {/* Launch TV Monitor Display */}
            <button
              onClick={() => setPortalMode('MONITOR')}
              className="px-3 h-8 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 font-mono text-[10px] uppercase font-bold tracking-wider cursor-pointer border border-teal-500/15 flex items-center gap-1"
              title="Launch Cafeteria Widescreen Display"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Cafeteria TV</span>
            </button>

            {/* Logout trigger links */}
            <button
              onClick={() => {
                setIsStaffLoggedIn(false);
                setPortalMode('STUDENT');
              }}
              className="p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white cursor-pointer shrink-0"
              title="Logout from Counter"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        {/* Dynamic Display of staff features templates */}
        <main className="py-2.5 pb-20">
          {staffRole === 'CASHIER' && <CashierView />}
          {staffRole === 'COOK' && <CookView />}
          {staffRole === 'SUPERVISOR' && <AssistantSupervisorView />}
          {staffRole === 'SERVER' && <ScannerView />}
          {staffRole === 'ADMIN' && <AdminView />}
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Student Portal Main Controller
  // -------------------------------------------------------------
  if (!isLoggedIn) {
    return (
      <WelcomeView 
        onEnterStaffPortal={() => setPortalMode('STAFF')} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-lowest text-on-surface relative">
      {/* Scrollable Main body layouts */}
      <section className="pb-28">
        {studentTab === 'HOME' && (
          <HomeView
            onOpenWallet={() => setStudentTab('WALLET')}
            onOpenOrders={() => setStudentTab('ORDERS')}
            onNavigateToTracking={handleNavigateToTracking}
          />
        )}

        {studentTab === 'ORDERS' && (
          <OrdersView
            onBackToMenu={handleBackToMenu}
            onNavigateToTracking={handleNavigateToTracking}
          />
        )}

        {studentTab === 'WALLET' && (
          showAddMoney ? (
            <AddMoneyView onBackToWallet={() => setShowAddMoney(false)} />
          ) : (
            <WalletView
              onBackToMenu={handleBackToMenu}
              onNavigateToAddMoney={() => setShowAddMoney(true)}
            />
          )
        )}

        {studentTab === 'COMPLIANCE' && (
          <ComplianceView onBackToMenu={handleBackToMenu} />
        )}

        {studentTab === 'TRACKING' && (
          cart.length > 0 ? (
            <PaymentView
              onPaymentSuccess={() => {}} // triggers tracking view autonomously
              onCancelCheckout={handleBackToMenu}
            />
          ) : (
            <QRView onBackToMenu={handleBackToMenu} />
          )
        )}

        {studentTab === 'QUESTS' && (
          <QuestsView />
        )}

        {studentTab === 'RANK' && (
          <RankView />
        )}

        {studentTab === 'STORE' && (
          <StoreView />
        )}

        {studentTab === 'VAULT' && (
          <VaultView />
        )}

        {studentTab === 'PROFILE' && (
          <ProfileView />
        )}
      </section>

      {/* Global Mock Smartphone sticky Bottom Bar Dock for Student users */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-surface-high/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4 max-w-lg mx-auto rounded-t-3xl shadow-3xl">
        {[
          { tab: 'HOME', label: 'Feed', icon: Compass },
          { tab: 'QUESTS', label: 'Quests', icon: Bolt },
          { tab: 'RANK', label: 'Rank', icon: Trophy },
          { tab: 'STORE', label: 'Store', icon: ShoppingBag },
          { tab: 'VAULT', label: 'Vault', icon: Vault, badge: activeOrderCount > 0 },
          { tab: 'PROFILE', label: 'Profile', icon: User },
        ].map((item) => {
          const IconComp = item.icon;
          const isSelected = studentTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => {
                setShowAddMoney(false);
                setStudentTab(item.tab as any);
              }}
              type="button"
              className={`flex flex-col items-center gap-1 px-3 py-1 cursor-pointer transition-all ${
                isSelected ? 'text-brand-purple scale-105' : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className="relative">
                <IconComp className="w-5.5 h-5.5 shrink-0" />
                {item.badge && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-brand-green animate-ping" />
                )}
              </div>
              <span className="font-mono text-[8px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NavigationWrapper />
    </AppProvider>
  );
}
