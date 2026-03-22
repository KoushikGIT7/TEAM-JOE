import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { useMarketingPulses } from './services/marketing-sync';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle, signInAsGuest, signOut } from './services/auth';
import { requestNotificationPermission } from './services/notificationService';
import { UserProfile } from './types';
import { Bell, X } from 'lucide-react';

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
        <div className="fixed top-8 left-4 right-4 z-[100] animate-in slide-in-from-top-4">
          <div className="bg-rose-900 text-white rounded-[2rem] shadow-2xl p-6 border-b-4 border-rose-950 flex items-center gap-6 relative overflow-hidden group">
            <div className="bg-white/20 p-4 rounded-[1.5rem] shrink-0">
               <Bell className="w-8 h-8 text-rose-300 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0 pr-4">
               <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">New Promotion</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
               </div>
               <p className="font-black text-lg leading-tight tracking-tight">{latestPulse.text}</p>
            </div>
            <button onClick={clearPulse} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      {renderView()}
    </div>
  );
};

export default App;