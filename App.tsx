import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { useMarketingPulses } from './services/marketing-sync';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle, signInAsGuest, signOut } from './services/auth';
import { requestNotificationPermission } from './services/notificationService';
import { UserProfile } from './types';
import { Bell, X } from 'lucide-react';
import { joeSounds } from './utils/audio';
import { useMaintenanceWorker } from './hooks/useMaintenanceWorker';
import { initializeOneSignal, loginUser, logoutUser } from './services/onesignal';
import OneSignalPermissionModal from './components/OneSignalPermissionModal';
import { triggerOneSignalWebhook } from './services/onesignal-webhook';

// Views — Staff + Admin only; student portal removed
import WelcomeView from './views/Student/WelcomeView';
import CashierView from './views/Staff/CashierView';
import ServingCounterView from './views/Staff/ServingCounterView';
import AdminDashboard from './views/Admin/Dashboard';
import CookView from './views/Staff/CookView';
import LoginView from './views/Auth/LoginView';

import FoodLoader from './components/Common/FoodLoader';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';

// Lazy load student views to improve initial bundle size
const HomeView    = React.lazy(() => import('./views/Student/HomeView'));
const PaymentView = React.lazy(() => import('./views/Student/PaymentView'));
const OrdersView  = React.lazy(() => import('./views/Student/OrdersView'));
const QRView      = React.lazy(() => import('./views/Student/QRView'));
const WalletView  = React.lazy(() => import('./views/Student/WalletView'));
const AddMoneyView = React.lazy(() => import('./views/Student/AddMoneyView'));
import { PrivacyPolicy, RefundPolicy, TermsAndConditions, ContactUs } from './views/Student/ComplianceView';

type ViewState =
  | 'WELCOME'
  | 'CASHIER'
  | 'ADMIN'
  | 'SERVING_COUNTER'
  | 'KITCHEN'
  | 'STAFF_LOGIN'
  | 'STUDENT_HOME';

const App: React.FC = () => {
  const { user: authUser, profile: authProfile, loading: authLoading } = useAuth();
  const [showOneSignalPrompt, setShowOneSignalPrompt] = useState(false);
  
  const [guestProfile, setGuestProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('joe_guest_profile');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const profile = authProfile || guestProfile;
  const { latestPulse, clearPulse } = useMarketingPulses(profile?.role || null);
  const [isInitializingGuest, setIsInitializingGuest] = useState(true);

  // 🛠️ [SYSTEM-STABILITY] Background Maintenance (Leaders only)
  useMaintenanceWorker(profile?.uid || null, profile?.role || null);

  // 🔊 [SONIC-UNLOCK] Silently wake AudioContext on first interaction (no audible sound)
  useEffect(() => {
    const unlock = () => {
      joeSounds.init(); // Wake the engine without playing anything
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

  // Wallet Recharge Approved trigger for Push consent modal
  useEffect(() => {
    const handleRecharge = () => {
      const promptStatus = localStorage.getItem('joe_onesignal_prompt_status');
      if (!promptStatus) {
        setTimeout(() => setShowOneSignalPrompt(true), 1500);
      }
    };
    window.addEventListener('joe_wallet_recharged', handleRecharge);
    return () => window.removeEventListener('joe_wallet_recharged', handleRecharge);
  }, []);

  // Low Balance Push Notification Trigger
  useEffect(() => {
    if (profile && (profile.role === 'STUDENT' || profile.role === 'GUEST') && profile.walletBalance !== undefined && profile.walletBalance < 30) {
      const lastSentStr = localStorage.getItem(`joe_low_balance_push_${profile.uid}`);
      const lastSent = lastSentStr ? parseInt(lastSentStr, 10) : 0;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (now - lastSent > twentyFourHours) {
        triggerOneSignalWebhook(
          profile.uid,
          "⚠️ Low Balance Warning",
          `Your wallet balance is ₹${profile.walletBalance}. Recharge soon!`
        );
        localStorage.setItem(`joe_low_balance_push_${profile.uid}`, now.toString());
      }
    }
  }, [profile?.walletBalance, profile?.uid]);

  // Restore Guest identity from Long-term Storage
  useEffect(() => {
    const savedGuest = localStorage.getItem('joe_guest_profile');
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
  const [studentSubView, setStudentSubView] = useState<'HOME' | 'PAYMENT' | 'ORDERS' | 'QR' | 'WALLET' | 'ADD_MONEY'>('HOME');
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
    if (authUser) requestNotificationPermission();
  }, [authUser]);

  const getViewForRole = (r: UserProfile['role']): ViewState => {
    switch (r) {
      case 'ADMIN': return 'ADMIN';
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
    localStorage.removeItem('joe_guest_profile');
    setView(getViewForRole(p.role));
    // Let App stabilize
    setTimeout(() => setIsAuthenticating(false), 500);
  };

  const handleGoogleLogin = async () => {
    if (googleSignInLoading) return;
    setGoogleSignInLoading(true);
    joeSounds.init(); // Silent wake — no sound on sign-in
    try {
      const { profile: newProfile } = await signInWithGoogle();
      setView(getViewForRole(newProfile.role));
      
      // Trigger OneSignal push consent modal after successful login
      const promptStatus = localStorage.getItem('joe_onesignal_prompt_status');
      if (!promptStatus) {
        setTimeout(() => setShowOneSignalPrompt(true), 2000);
      }
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
    } finally {
      setGoogleSignInLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (guestLoading) return;
    setGuestLoading(true);
    joeSounds.init(); // Silent wake — no sound on sign-in
    try {
      const { profile: gProfile } = await signInAsGuest();
      setGuestProfile(gProfile);
      localStorage.setItem('joe_guest_profile', JSON.stringify(gProfile));
      setStudentSubView('HOME');
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
    localStorage.removeItem('joe_guest_profile');
    setView('WELCOME');
    setStudentSubView('HOME');
    setActiveOrderId(null);
  };

  if (authLoading || isInitializingGuest || showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

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
      case 'KITCHEN':
        return (
          <CookView
            profile={profile!}
            onLogout={handleLogout}
            onBack={() => setView('ADMIN')}
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
          <div className="h-full w-full">
            {(() => {
              switch (studentSubView) {
                case 'HOME':
                  return (
                    <React.Suspense fallback={<FoodLoader />}>
                    <HomeView
                      profile={profile!}
                      onLogout={handleLogout}
                      onProceed={() => setStudentSubView('PAYMENT')}
                      onViewOrders={() => setStudentSubView('ORDERS')}
                      onViewWallet={() => setStudentSubView('WALLET')}
                      onOpenCompliance={setShowCompliance}
                      onViewQR={(id) => {
                        setActiveOrderId(id);
                        setStudentSubView('QR');
                      }}
                    />
                  </React.Suspense>
                  );
                case 'PAYMENT':
                  return (
                    <React.Suspense fallback={<FoodLoader />}>
                      <PaymentView
                        profile={profile!}
                        onBack={() => setStudentSubView('HOME')}
                        onSuccess={(id) => {
                          setActiveOrderId(id);
                          setStudentSubView('QR');
                          // Trigger OneSignal push consent modal after successful order
                          const promptStatus = localStorage.getItem('joe_onesignal_prompt_status');
                          if (!promptStatus) {
                            setTimeout(() => setShowOneSignalPrompt(true), 2000);
                          }
                        }}
                      />
                    </React.Suspense>
                  );
                case 'ORDERS':
                  return (
                    <React.Suspense fallback={<FoodLoader />}>
                      <OrdersView
                        profile={profile!}
                        onBack={() => setStudentSubView('HOME')}
                        onQROpen={(id) => {
                          setActiveOrderId(id);
                          setStudentSubView('QR');
                        }}
                      />
                    </React.Suspense>
                  );
                case 'QR':
                  return (
                    <React.Suspense fallback={<FoodLoader />}>
                      <QRView
                        orderId={activeOrderId!}
                        onBack={() => setStudentSubView('HOME')}
                        onViewOrders={() => setStudentSubView('ORDERS')}
                      />
                    </React.Suspense>
                  );
                case 'WALLET':
                  return (
                    <React.Suspense fallback={<FoodLoader />}>
                      <WalletView
                        profile={profile!}
                        onBack={() => setStudentSubView('HOME')}
                        onAddMoney={() => setStudentSubView('ADD_MONEY')}
                      />
                    </React.Suspense>
                  );
                case 'ADD_MONEY':
                  return (
                    <React.Suspense fallback={<FoodLoader />}>
                      <AddMoneyView
                        profile={profile!}
                        onBack={() => setStudentSubView('WALLET')}
                      />
                    </React.Suspense>
                  );
                default:
                  return null;
              }
            })()}
          </div>
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
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-300 block leading-none mb-0.5">JOE Pulse</span>
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

        {/* OneSignal Consent Prompt Modal */}
        <OneSignalPermissionModal isOpen={showOneSignalPrompt} onClose={() => setShowOneSignalPrompt(false)} />
      </GlobalErrorBoundary>
    </div>
  );
};

export default App;