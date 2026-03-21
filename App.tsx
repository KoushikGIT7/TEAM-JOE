import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle } from './services/auth';
import { requestNotificationPermission } from './services/notificationService';
import { UserProfile, ROLES } from './types';

// Views — Staff + Admin only; student portal removed
import WelcomeView from './views/Student/WelcomeView';
import CashierView from './views/Staff/CashierView';
import AdminDashboard from './views/Admin/Dashboard';
import ServingCounterView from './views/Staff/ServingCounterView';
import KitchenView from './views/Staff/KitchenView';
import UnifiedKitchenConsole from './views/Staff/UnifiedKitchenConsole';
import LoginView from './views/Auth/LoginView';

type ViewState =
  | 'WELCOME'
  | 'CASHIER'
  | 'ADMIN'
  | 'SERVING_COUNTER'
  | 'KITCHEN'
  | 'STAFF_LOGIN'
  | 'STUDENT_HOME';

// Lazy load student views to improve initial bundle size
const HomeView    = React.lazy(() => import('./views/Student/HomeView'));
const PaymentView = React.lazy(() => import('./views/Student/PaymentView'));
const OrdersView  = React.lazy(() => import('./views/Student/OrdersView'));
const QRView      = React.lazy(() => import('./views/Student/QRView'));

// ─── Food emoji loader ───────────────────────────────────────────────────────
// Used as Suspense fallback during lazy-view transitions.
// Must be a top-level named component so React hooks rules are satisfied.
const FOOD_EMOJIS = ['🍛', '🥗', '🍜', '🥘', '🍱', '☕'];
const FoodLoader: React.FC = () => {
  const [fi, setFi] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setFi(f => (f + 1) % FOOD_EMOJIS.length), 420);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="h-screen w-full flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div
          className="text-5xl select-none"
          style={{ animation: 'foodSpin 0.42s ease-in-out' }}
          key={fi}
        >
          {FOOD_EMOJIS[fi]}
        </div>
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Loading...</p>
      </div>
      <style>{`
        @keyframes foodSpin {
          0%   { opacity: 0; transform: scale(0.6) rotate(-15deg); }
          50%  { opacity: 1; transform: scale(1.15) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const [guestProfile, setGuestProfile] = useState<UserProfile | null>(null);
  
  const profile = authProfile || guestProfile;
  const role = profile?.role || null;

  // Initialize order notifications for students/guests
  useOrderNotifications(profile?.uid || null);

  // Splash is shown while auth is resolving. Once authLoading is false we
  // apply a cosmetic delay (1800ms) so the logo animation fully breathes.
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<ViewState>('WELCOME');
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [studentSubView, setStudentSubView] = useState<'HOME' | 'PAYMENT' | 'ORDERS' | 'QR'>('HOME');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Dismiss splash only after auth has fully resolved
  useEffect(() => {
    if (!authLoading) {
      // Cosmetic delay — long enough for logo animation to fully breathe
      const timer = setTimeout(() => setShowSplash(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  // Absolute safety net — never hang beyond 6s
  useEffect(() => {
    const safety = setTimeout(() => setShowSplash(false), 6000);
    return () => clearTimeout(safety);
  }, []);

  // Request push notification permission once logged in
  useEffect(() => {
    if (user) requestNotificationPermission();
  }, [user]);

  // ─── ROLE-BASED ROUTING ──────────────────────────────────────────────────
  const getViewForRole = (r: UserProfile['role']): ViewState => {
    switch (r) {
      case ROLES.ADMIN:   return 'ADMIN';
      case ROLES.CASHIER: return 'CASHIER';
      case ROLES.SERVER:  return 'KITCHEN';
      default:            return 'STUDENT_HOME';
    }
  };

  // Only runs after splash is gone AND auth is fully resolved (including profile).
  useEffect(() => {
    if (authLoading || showSplash) return;

    if (!profile) {
      if (view !== 'WELCOME' && view !== 'STAFF_LOGIN') {
        setView('WELCOME');
      }
      return;
    }

    if (role && (view === 'WELCOME' || view === 'STAFF_LOGIN')) {
      setView(getViewForRole(role));
    }
  }, [authLoading, showSplash, profile, role, view]);

  // ─── HANDLERS ────────────────────────────────────────────────────────────
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
    // ⚡ OPTIMISTIC UI: Immediately switch to STUDENT_HOME so FoodLoader shows
    // instead of a white screen while the async import resolves.
    setGuestLoading(true);
    setStudentSubView('HOME');
    setView('STUDENT_HOME');
    try {
      const { signInAsGuest } = await import('./services/auth');
      const { profile: gProfile } = await signInAsGuest();
      setGuestProfile(gProfile);
    } catch (error) {
      console.error('❌ Guest login error:', error);
      setView('WELCOME');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import('./services/auth');
      await signOut();
    } catch (_) { /* ignore */ }
    setGuestProfile(null);
    setView('WELCOME');
    setStudentSubView('HOME');
    setActiveOrderId(null);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  if (showSplash || authLoading) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-background text-textMain overflow-x-hidden">
      {(() => {
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
                            profile={profile}
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
                            profile={profile}
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
                            profile={profile}
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
                      setStudentSubView('HOME');
                      return null;
                  }
                })()}
              </div>
            );

          // STRICT: No student/default fallback that could mis-route
          default:
            return (
              <WelcomeView
                onGoogleLogin={handleGoogleLogin}
                onGuestLogin={handleGuestLogin}
                onStaffLogin={navigateToStaffLogin}
                googleLoading={googleSignInLoading}
                guestLoading={guestLoading}
              />
            );
        }
      })()}
    </div>
  );
};

export default App;