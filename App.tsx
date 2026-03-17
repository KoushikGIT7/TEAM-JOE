import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle } from './services/auth';
import { requestNotificationPermission } from './services/notificationService';
import { UserProfile } from './types';

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

const App: React.FC = () => {
  const { user, profile: authProfile, loading: authLoading } = useAuth();
  const [guestProfile, setGuestProfile] = useState<UserProfile | null>(null);
  
  const profile = authProfile || guestProfile;
  const role = profile?.role || null;

  // Initialize order notifications for students/guests
  useOrderNotifications(profile?.uid || null);

  // Splash is shown while auth is resolving. Once authLoading is false we
  // apply a short (600ms) cosmetic delay so the splash animation completes
  // gracefully. We do NOT start routing until both are false.
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<ViewState>('WELCOME');
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);
  const [studentSubView, setStudentSubView] = useState<'HOME' | 'PAYMENT' | 'ORDERS' | 'QR'>('HOME');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Dismiss splash only after auth has fully resolved
  useEffect(() => {
    if (!authLoading) {
      // Short cosmetic delay so logo animation can finish
      const timer = setTimeout(() => setShowSplash(false), 600);
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
  // Only runs after splash is gone AND auth is fully resolved (including profile).
  // This eliminates the 1st-login wrong-redirect bug.
  useEffect(() => {
    // Wait until both guards are clear
    if (authLoading || showSplash) return;

    if (!profile) {
      // Not logged in → land on Welcome/Login gate
      if (view !== 'WELCOME' && view !== 'STAFF_LOGIN') {
        setView('WELCOME');
      }
      return;
    }

    // User is logged in and profile is confirmed
    // Only auto-redirect when on a neutral / login view
    if (role && (view === 'WELCOME' || view === 'STAFF_LOGIN')) {
      if      (role === 'ADMIN')   setView('ADMIN');
      else if (role === 'CASHIER') setView('CASHIER');
      else if (role === 'SERVER')  setView('KITCHEN');
      else if (role === 'STUDENT' || role === 'GUEST') setView('STUDENT_HOME');
    }
  }, [authLoading, showSplash, profile, role, view]);

  // ─── HANDLERS ────────────────────────────────────────────────────────────
  const navigateToStaffLogin = () => setView('STAFF_LOGIN');

  const handleGoogleLogin = async () => {
    if (googleSignInLoading) return;
    setGoogleSignInLoading(true);
    try {
      const { profile: newProfile } = await signInWithGoogle();
      if (newProfile.role === 'STUDENT') {
        setView('STUDENT_HOME');
      }
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
    } finally {
      setGoogleSignInLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      const { signInAsGuest } = await import('./services/auth');
      const { profile: gProfile } = await signInAsGuest();
      setGuestProfile(gProfile);
      setStudentSubView('HOME');
      setView('STUDENT_HOME');
    } catch (error) {
      console.error('❌ Guest login error:', error);
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
              />
            );

          case 'STAFF_LOGIN':
            return (
              <LoginView
                onBack={() => setView('WELCOME')}
                onSuccess={(p) => {
                  // Direct nav from LoginView — profile comes from the signIn()
                  // call which already validated the role. We set the view
                  // immediately; the useEffect will also fire but view won't
                  // be 'WELCOME' / 'STAFF_LOGIN' so it becomes a no-op.
                  if      (p.role === 'ADMIN')   setView('ADMIN');
                  else if (p.role === 'CASHIER') setView('CASHIER');
                  else if (p.role === 'SERVER')  setView('KITCHEN');
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
          case 'SERVING_COUNTER':
            return (
              <UnifiedKitchenConsole 
                profile={profile!} 
                onLogout={handleLogout} 
              />
            );

          case 'STUDENT_HOME':
            return (
              <div className="h-full w-full">
                {(() => {
                  switch (studentSubView) {
                    case 'HOME':
                      const HomeView = React.lazy(() => import('./views/Student/HomeView'));
                      return (
                        <React.Suspense fallback={<SplashScreen onFinish={() => {}} />}>
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
                      const PaymentView = React.lazy(() => import('./views/Student/PaymentView'));
                      return (
                        <React.Suspense fallback={<SplashScreen onFinish={() => {}} />}>
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
                      const OrdersView = React.lazy(() => import('./views/Student/OrdersView'));
                      return (
                        <React.Suspense fallback={<SplashScreen onFinish={() => {}} />}>
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
                      const QRView = React.lazy(() => import('./views/Student/QRView'));
                      return (
                        <React.Suspense fallback={<SplashScreen onFinish={() => {}} />}>
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
              />
            );
        }
      })()}
    </div>
  );
};

export default App;