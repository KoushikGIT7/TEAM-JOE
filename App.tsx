import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { useMarketingPulses } from './services/marketing-sync';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle, signInAsGuest, signOut } from './services/auth';
import { requestNotificationPermission } from './services/notificationService';
import { UserProfile } from './types';
import { Bell, X, Compass, Bolt, Trophy, ShoppingBag, Vault as VaultIcon, User } from 'lucide-react';
import { cseSounds } from './utils/audio';
import { useMaintenanceWorker } from './hooks/useMaintenanceWorker';
import { initializeOneSignal, loginUser, logoutUser } from './services/onesignal';
import { triggerOneSignalWebhook } from './services/onesignal-webhook';
import { AppProvider, useApp } from './contexts/AppContext';
import { NotificationProvider } from './contexts/NotificationContext';


// Views — Staff + Admin only; student portal removed
import WelcomeView from './views/Student/WelcomeView';
import CashierView from './views/Staff/CashierView';
import ServingCounterView from './views/Staff/ServingCounterView';
import AdminDashboard from './views/Admin/Dashboard';
import CookView from './views/Staff/CookView';
import LoginView from './views/Auth/LoginView';
import AssistantSupervisorView from './views/Staff/AssistantSupervisorView';

import FoodLoader from './components/Common/FoodLoader';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';

import HomeView from './views/Student/HomeView';
import PaymentView from './views/Student/PaymentView';
import OrdersView from './views/Student/OrdersView';
import QRView from './views/Student/QRView';
import WalletView from './views/Student/WalletView';
import AddMoneyView from './views/Student/AddMoneyView';
import { QuestsView } from './views/Student/QuestsView';
import { RankView } from './views/Student/RankView';
import { StoreView } from './views/Student/StoreView';
import { VaultView } from './views/Student/VaultView';
import { ProfileView } from './views/Student/ProfileView';

import { PrivacyPolicy, RefundPolicy, TermsAndConditions, ContactUs, ComplianceView } from './views/Student/ComplianceView';

type ViewState =
  | 'WELCOME'
  | 'CASHIER'
  | 'ADMIN'
  | 'SERVING_COUNTER'
  | 'KITCHEN'
  | 'STAFF_LOGIN'
  | 'STUDENT_HOME'
  | 'ASSISTANT_SUPERVISOR_DASHBOARD';

const AppContent: React.FC = () => {
  const { user: authUser, profile: authProfile, loading: authLoading } = useAuth();
  const { studentTab, setStudentTab, cart, orders } = useApp();
  
  const [guestProfile, setGuestProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('cse_guest_profile');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const profile = authProfile || guestProfile;
  const { latestPulse, clearPulse } = useMarketingPulses(profile?.role || null);
  const [isInitializingGuest, setIsInitializingGuest] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);

  // 🛠️ [SYSTEM-STABILITY] Background Maintenance (Leaders only)
  useMaintenanceWorker(profile?.uid || null, profile?.role || null);

  // 🔊 [SONIC-UNLOCK] Silently wake AudioContext on first interaction (no audible sound)
  useEffect(() => {
    const unlock = () => {
      cseSounds.init(); // Wake the engine without playing anything
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // 🔔 OneSignal Web Push SDK Setup
  useEffect(() => {
    initializeOneSignal();
  }, []);

  // Sync user identification & tags to OneSignal dynamically
  useEffect(() => {
    if (profile) {
      loginUser(profile.uid, profile);
    } else {
      logoutUser();
    }
  }, [profile]);

  // Low Balance Push Notification Trigger
  useEffect(() => {
    if (profile && (profile.role === 'STUDENT' || profile.role === 'GUEST') && profile.walletBalance !== undefined && profile.walletBalance < 30) {
      const lastSentStr = localStorage.getItem(`cse_low_balance_push_${profile.uid}`);
      const lastSent = lastSentStr ? parseInt(lastSentStr, 10) : 0;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - lastSent > twentyFourHours) {
        triggerOneSignalWebhook(
          profile.uid,
          "⚠️ Low Balance Warning",
          `Your wallet balance is ₹${profile.walletBalance}. Recharge soon!`
        );
        localStorage.setItem(`cse_low_balance_push_${profile.uid}`, now.toString());
      }
    }
  }, [profile?.walletBalance, profile?.uid]);

  // Restore Guest identity from Long-term Storage
  useEffect(() => {
    const savedGuest = localStorage.getItem('cse_guest_profile');
    if (savedGuest && !authProfile) {
        try {
            setGuestProfile(JSON.parse(savedGuest));
        } catch (_) { /* invalid json */ }
    }
    setIsInitializingGuest(false);
  }, [authProfile]);

  // Initialize order notifications for students/guests
  useOrderNotifications(profile?.uid || null);

  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<ViewState>('WELCOME');
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showCompliance, setShowCompliance] = useState<'privacy' | 'refund' | 'terms' | 'contact' | null>(null);

  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => setShowSplash(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  useEffect(() => {
    const safety = setTimeout(() => setShowSplash(false), 6000);
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    if (authUser) {
      const promptStatus = localStorage.getItem('cse_onesignal_prompt_status');
      if (!promptStatus) {
        // First time this device/browser has seen the permission prompt
        setTimeout(() => {
          requestNotificationPermission();
          localStorage.setItem('cse_onesignal_prompt_status', 'shown');
        }, 3000); // 3s delay — let the student settle into the app first
      } else {
        // Already prompted before — just register the token silently (no UI popup)
        requestNotificationPermission();
      }
    }
  }, [authUser]);

  const getViewForRole = (r: UserProfile['role']): ViewState => {
    switch (r) {
      case 'ADMIN': return 'ADMIN';
      case 'ASSISTANT_SUPERVISOR': return 'ASSISTANT_SUPERVISOR_DASHBOARD';
      case 'CASHIER': return 'CASHIER';
      case 'SERVER': return 'SERVING_COUNTER';
      case 'COOK': return 'KITCHEN';
      case 'GUEST': 
      case 'STUDENT': return 'STUDENT_HOME';
      default: return 'WELCOME';
    }
  };

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (authLoading || showSplash || isInitializingGuest || isAuthenticating) return;

    if (!profile) {
      if (view !== 'WELCOME' && view !== 'STAFF_LOGIN') {
        setView('WELCOME');
      }
      return;
    }

    if (view === 'WELCOME' || view === 'STAFF_LOGIN') {
        setView(getViewForRole(profile.role));
    }
  }, [authLoading, showSplash, profile, view, isInitializingGuest, isAuthenticating]);

  const navigateToStaffLogin = () => setView('STAFF_LOGIN');

  const onStaffLoginSuccess = (p: UserProfile) => {
    setGuestProfile(null);
    localStorage.removeItem('cse_guest_profile');
    setView(getViewForRole(p.role));
    // Let App stabilize
    setTimeout(() => setIsAuthenticating(false), 500);
  };

  const handleGoogleLogin = async () => {
    if (googleSignInLoading) return;
    
    cseSounds.init(); // Silent wake — no sound on sign-in
    
    try {
      // Execute sign-in Promise synchronously before any React state updates.
      // This prevents the browser from blocking the popup in PWA/Safari environments.
      const signInPromise = signInWithGoogle();
      
      setGoogleSignInLoading(true);
      
      const { profile: newProfile } = await signInPromise;
      setView(getViewForRole(newProfile.role));
      
      // Trigger push consent after successful login (only once per device)
      const promptStatus = localStorage.getItem('cse_onesignal_prompt_status');
      if (!promptStatus) {
        setTimeout(() => {
          requestNotificationPermission();
          localStorage.setItem('cse_onesignal_prompt_status', 'shown');
        }, 2000);
      }
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
      // If popup is still blocked, we can alert the user
      if (error.code === 'auth/popup-blocked') {
        alert("Sign-in popup was blocked by your browser. Please allow popups for this app or try again.");
      }
    } finally {
      setGoogleSignInLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (guestLoading) return;
    setGuestLoading(true);
    cseSounds.init(); // Silent wake — no sound on sign-in
    try {
      const { profile: gProfile } = await signInAsGuest();
      setGuestProfile(gProfile);
      localStorage.setItem('cse_guest_profile', JSON.stringify(gProfile));
      setStudentTab('HOME');
      setView('STUDENT_HOME');
    } catch (error) {
      console.error('❌ Guest login error:', error);
      setView('WELCOME');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (_) { /* ignore */ }
    setGuestProfile(null);
    localStorage.removeItem('cse_guest_profile');
    setView('WELCOME');
    setStudentTab('HOME');
    setActiveOrderId(null);
  };

  if (authLoading || isInitializingGuest || showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Active student order check for bottom tab badges
  const activeOrderCount = orders.filter(o => o.orderStatus !== 'SERVED' && o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED' && o.orderStatus !== 'REJECTED' && o.orderStatus !== 'ABANDONED').length;

  const renderView = () => {
    switch (view) {
      case 'WELCOME':
        return (
          <WelcomeView
            onGoogleLogin={handleGoogleLogin}
            onGuestLogin={handleGuestLogin}
            onStaffLogin={navigateToStaffLogin}
            onOpenCompliance={setShowCompliance}
            googleLoading={googleSignInLoading}
            guestLoading={guestLoading}
          />
        );
      case 'STAFF_LOGIN':
        return (
          <LoginView
            onBack={() => setView('WELCOME')}
            onSuccess={(p) => {
              setIsAuthenticating(true);
              onStaffLoginSuccess(p);
            }}
          />
        );
      case 'CASHIER':
        return <CashierView profile={profile!} onLogout={handleLogout} />;
      case 'ADMIN':
        return (
          <AdminDashboard
            profile={profile!}
            onLogout={handleLogout}
            onOpenKitchen={() => setView('KITCHEN')}
          />
        );
      case 'ASSISTANT_SUPERVISOR_DASHBOARD':
        return <AssistantSupervisorView profile={profile!} onLogout={handleLogout} />;
      case 'KITCHEN':
        return (
          <CookView
            profile={profile!}
            onLogout={handleLogout}
          />
        );
      case 'SERVING_COUNTER':
        return (
          <ServingCounterView
            profile={profile!}
            onLogout={handleLogout}
            onOpenKitchen={() => setView('KITCHEN')}
          />
        );
      case 'STUDENT_HOME':
        return (
          <NotificationProvider onViewOrder={(id) => { setActiveOrderId(id); setStudentTab('TRACKING'); }}>
          <div className="min-h-screen bg-surface-lowest text-on-surface relative">
            {/* Main scrollable body layouts */}
            <section className="pb-28">
              {studentTab === 'HOME' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <HomeView
                    profile={profile!}
                    onLogout={handleLogout}
                    onProceed={() => setStudentTab('TRACKING')}
                    onViewOrders={() => setStudentTab('VAULT')}
                    onViewWallet={() => setStudentTab('WALLET')}
                    onOpenCompliance={setShowCompliance}
                    onViewQR={(id) => {
                      setActiveOrderId(id);
                      setStudentTab('TRACKING');
                    }}
                  />
                </React.Suspense>
              )}

              {studentTab === 'ORDERS' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <OrdersView
                    profile={profile!}
                    onBackToMenu={() => setStudentTab('HOME')}
                    onNavigateToTracking={(id) => {
                      setActiveOrderId(id);
                      setStudentTab('TRACKING');
                    }}
                  />
                </React.Suspense>
              )}

              {studentTab === 'WALLET' && (
                showAddMoney ? (
                  <React.Suspense fallback={<FoodLoader />}>
                    <AddMoneyView
                      profile={profile!}
                      onBack={() => setShowAddMoney(false)}
                    />
                  </React.Suspense>
                ) : (
                  <React.Suspense fallback={<FoodLoader />}>
                    <WalletView
                      profile={profile!}
                      onBack={() => setStudentTab('HOME')}
                      onAddMoney={() => setShowAddMoney(true)}
                    />
                  </React.Suspense>
                )
              )}

              {studentTab === 'COMPLIANCE' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <ComplianceView onBackToMenu={() => setStudentTab('HOME')} />
                </React.Suspense>
              )}

              {studentTab === 'TRACKING' && (
                cart.length > 0 ? (
                  <React.Suspense fallback={<FoodLoader />}>
                    <PaymentView
                      profile={profile!}
                      onBack={() => setStudentTab('HOME')}
                      onSuccess={(id) => {
                        setActiveOrderId(id);
                        setStudentTab('TRACKING');
                        // Trigger push consent after first order (only once per device)
                        const promptStatus = localStorage.getItem('cse_onesignal_prompt_status');
                        if (!promptStatus) {
                          setTimeout(() => {
                            requestNotificationPermission();
                            localStorage.setItem('cse_onesignal_prompt_status', 'shown');
                          }, 2000);
                        }
                      }}
                    />
                  </React.Suspense>
                ) : (
                  <React.Suspense fallback={<FoodLoader />}>
                    <QRView
                      orderId={activeOrderId!}
                      onBack={() => setStudentTab('HOME')}
                      onViewOrders={() => setStudentTab('VAULT')}
                    />
                  </React.Suspense>
                )
              )}

              {studentTab === 'QUESTS' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <QuestsView />
                </React.Suspense>
              )}

              {studentTab === 'RANK' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <RankView />
                </React.Suspense>
              )}

              {studentTab === 'STORE' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <StoreView />
                </React.Suspense>
              )}

              {studentTab === 'VAULT' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <VaultView />
                </React.Suspense>
              )}

              {studentTab === 'PROFILE' && (
                <React.Suspense fallback={<FoodLoader />}>
                  <ProfileView onLogout={handleLogout} />
                </React.Suspense>
              )}
            </section>

            {/* Sticky bottom bar smartphone dock */}
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-[#121824]/90 backdrop-blur-xl border-t border-white/5 flex justify-around items-center px-2 py-3 pb-[env(safe-area-inset-bottom,16px)] shadow-3xl rounded-t-3xl">
              {[
                { tab: 'HOME', label: 'Feed', icon: Compass },
                { tab: 'VAULT', label: 'Vault', icon: VaultIcon, badge: activeOrderCount > 0 },
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
                    className={`flex-1 flex flex-col items-center gap-1 py-1 cursor-pointer transition-all ${
                      isSelected ? 'text-brand-purple scale-105 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="relative">
                      <IconComp className="w-5.5 h-5.5 shrink-0" />
                      {item.badge && (
                        <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-brand-purple animate-ping" />
                      )}
                    </div>
                    <span className="font-mono text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
          </NotificationProvider>
        );
      default:
        return <WelcomeView onGoogleLogin={handleGoogleLogin} onGuestLogin={handleGuestLogin} onStaffLogin={navigateToStaffLogin} onOpenCompliance={setShowCompliance} googleLoading={googleSignInLoading} guestLoading={guestLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden relative">
      {/* 📣 [MARKETING-PULSE] Clean professional notification bar */}
      {latestPulse && (
        <div className="fixed top-3 left-0 right-0 z-[100] flex justify-center px-4 animate-in slide-in-from-top-2 duration-300 ease-out">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-md shadow-black/5 px-3.5 py-2.5 flex items-center gap-3 max-w-[340px] w-full">

            {/* Accent dot */}
            <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />

            {/* Text */}
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 block leading-none mb-0.5">CSE Pulse</span>
              <p className="text-[11px] font-semibold text-gray-700 leading-tight truncate">{latestPulse.text}</p>
            </div>

            {/* Dismiss */}
            <button
              onClick={clearPulse}
              className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-all"
            >
              <X className="w-3 h-3" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
      <GlobalErrorBoundary>
        {renderView()}
        
        {/* Compliance Overlays */}
        {showCompliance === 'privacy' && <PrivacyPolicy onBack={() => setShowCompliance(null)} />}
        {showCompliance === 'refund' && <RefundPolicy onBack={() => setShowCompliance(null)} />}
        {showCompliance === 'terms' && <TermsAndConditions onBack={() => setShowCompliance(null)} />}
        {showCompliance === 'contact' && <ContactUs onBack={() => setShowCompliance(null)} />}
      </GlobalErrorBoundary>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}