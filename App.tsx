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
import { useOneSignal } from './services/onesignal-push';

// Views — Staff + Admin only; student portal removed
import WelcomeView from './views/Student/WelcomeView';
import CashierView from './views/Staff/CashierView';
import AdminDashboard from './views/Admin/Dashboard';
import UnifiedKitchenConsole from './views/Staff/UnifiedKitchenConsole';
import LoginView from './views/Auth/LoginView';

import FoodLoader from './components/Common/FoodLoader';

// Lazy load student views to improve initial bundle size
const HomeView    = React.lazy(() => import('./views/Student/HomeView'));
const PaymentView = React.lazy(() => import('./views/Student/PaymentView'));
const OrdersView  = React.lazy(() => import('./views/Student/OrdersView'));
const QRView      = React.lazy(() => import('./views/Student/QRView'));

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
  
  const [guestProfile, setGuestProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('joe_guest_profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const profile = authProfile || guestProfile;
  const { latestPulse, clearPulse } = useMarketingPulses(profile?.role || null);
  const [isInitializingGuest, setIsInitializingGuest] = useState(true);

  // 📣 [ONESIGNAL-HANDSHAKE] Automated enrollment once identity is established
  useOneSignal(profile?.uid || null);

  // 🔊 [SONIC-UNLOCK] Globally unblock audio on first user interaction
  useEffect(() => {
    const unlock = () => {
      joeSounds.playSuccess(); // Initial ping to wake up hardware
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
  const [studentSubView, setStudentSubView] = useState<'HOME' | 'PAYMENT' | 'ORDERS' | 'QR'>('HOME');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

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
      case 'SERVER': return 'KITCHEN';
      case 'GUEST': 
      case 'STUDENT': return 'STUDENT_HOME';
      default: return 'WELCOME';
    }
  };

  useEffect(() => {
    if (authLoading || showSplash || isInitializingGuest) return;

    if (!profile) {
      if (view !== 'WELCOME' && view !== 'STAFF_LOGIN') {
        setView('WELCOME');
      }
      return;
    }

    if (view === 'WELCOME' || view === 'STAFF_LOGIN') {
        setView(getViewForRole(profile.role));
    }
  }, [authLoading, showSplash, profile, view, isInitializingGuest]);

  const navigateToStaffLogin = () => setView('STAFF_LOGIN');

  const handleGoogleLogin = async () => {
    if (googleSignInLoading) return;
    setGoogleSignInLoading(true);
    
    // 🔊 [SONIC-UNLOCK] Handshake the browser audio on user gesture
    joeSounds.playSuccess();

    try {
      const { profile: newProfile } = await signInWithGoogle();
      setView(getViewForRole(newProfile.role));
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
    } finally {
      setGoogleSignInLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (guestLoading) return;
    setGuestLoading(true);

    // 🔊 [SONIC-UNLOCK] Handshake the browser audio on user gesture
    joeSounds.playSuccess();

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
            googleLoading={googleSignInLoading}
            guestLoading={guestLoading}
          />
        );
      case 'STAFF_LOGIN':
        return (
          <LoginView
            onBack={() => setView('WELCOME')}
            onSuccess={(p) => setView(getViewForRole(p.role))}
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
      case 'SERVING_COUNTER':
        return (
          <UnifiedKitchenConsole
            profile={profile!}
            onLogout={handleLogout}
            onBack={() => setView('ADMIN')}
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
                default:
                  return null;
              }
            })()}
          </div>
        );
      default:
        return <WelcomeView onGoogleLogin={handleGoogleLogin} onGuestLogin={handleGuestLogin} onStaffLogin={navigateToStaffLogin} googleLoading={googleSignInLoading} guestLoading={guestLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden relative">
      {/* 📣 [MARKETING-PULSE] Swiggy-style notification card */}
      {latestPulse && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-full shadow-xl px-4 py-2.5 flex items-center gap-3 border border-white/10 max-w-md w-full sm:w-auto">
            <div className="bg-indigo-500/20 p-1.5 rounded-full ring-1 ring-indigo-500/30">
               <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0 pr-2">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Joe Pulse</span>
                  <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
               </div>
               <p className="text-sm font-medium leading-none truncate opacity-90">{latestPulse.text}</p>
            </div>
            <button onClick={clearPulse} className="hover:bg-white/10 p-1.5 rounded-full transition-colors">
              <X className="w-4 h-4 opacity-50" />
            </button>
          </div>
        </div>
      )}
      {renderView()}
    </div>
  );
};

export default App;