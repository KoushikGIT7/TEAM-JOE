import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { initializeMenu, listenToLatestActiveQR } from './services/firestore-db';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle } from './services/auth';
import { NotificationProvider } from './contexts/NotificationContext';
import { requestNotificationPermission } from './services/notificationService';
import { useOrderNotifications } from './hooks/useOrderNotifications';

// Views
import WelcomeView from './views/Student/WelcomeView';
import HomeView from './views/Student/HomeView';
import StaffScannerView from './views/Staff/ScannerView';
import CashierView from './views/Staff/CashierView';
import AdminDashboard from './views/Admin/Dashboard';
import PaymentView from './views/Student/PaymentView';
import QRView from './views/Student/QRView';
import ServingCounterView from './views/Staff/ServingCounterView';
import KitchenView from './views/Staff/KitchenView';
import OrdersView from './views/Student/OrdersView';
import LoginView from './views/Auth/LoginView';

type ViewState =
  | 'WELCOME'
  | 'HOME'
  | 'PAYMENT'
  | 'QR'
  | 'ORDERS'
  | 'CASHIER'
  | 'ADMIN'
  | 'SERVING_COUNTER'
  | 'KITCHEN'
  | 'STAFF_LOGIN';

const App: React.FC = () => {
  const { user, profile, loading: authLoading, role } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<ViewState>('WELCOME');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);

  // Hook for real-time order status notifications (Student App)
  useOrderNotifications(user?.uid || null);

  // Initial load logic: Keep splash visible for at least 1500ms for "WOW" factor
  // but only if it's the very first load of the session.
  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 1500); 
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  // Initialize menu (non-blocking)
  useEffect(() => {
    initializeMenu().catch((error) => {
      console.warn("Menu initialization failed (non-critical):", error);
    });
  }, []);

  // Request notification permission on login
  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  // Cross-session QR recovery for logged-in students
  useEffect(() => {
    if (authLoading) return;
    if (!profile?.uid || role !== 'student') return;
    const unsub = listenToLatestActiveQR(profile.uid, (order) => {
      if (!order) return;
      if (view === 'PAYMENT') return;
      setSelectedOrderId(order.id);
      setView('QR');
    });
    return unsub;
  }, [authLoading, profile?.uid, role, view]);

  // Unified Routing & Auth Guards
  useEffect(() => {
    if (authLoading || showSplash) return;

    // 1. Protection for non-logged in users
    const protectedViews: ViewState[] = ['HOME', 'PAYMENT', 'QR', 'ORDERS', 'CASHIER', 'ADMIN', 'SERVING_COUNTER', 'KITCHEN'];
    if (!user && protectedViews.includes(view)) {
      setView('WELCOME');
      return;
    }

    // 2. Role-based redirects (Prevent students in staff views)
    const staffViews: ViewState[] = ['CASHIER', 'ADMIN', 'SERVING_COUNTER', 'KITCHEN'];
    if (user && role === 'student' && staffViews.includes(view)) {
      setView('HOME');
      return;
    }

    // 3. Auto-redirect from Welcome if logged in
    if (user && profile && role && view === 'WELCOME') {
      if (role === 'admin') setView('ADMIN');
      else if (role === 'cashier') setView('CASHIER');
      else if (role === 'server') setView('SERVING_COUNTER');
      else setView('HOME');
    }
  }, [authLoading, showSplash, user, profile, role, view]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleStartOrdering = async () => {
    if (authLoading) return;
    setView('HOME');
  };

  const navigateToHome = () => setView('HOME');
  const navigateToStaffLogin = () => setView('STAFF_LOGIN');
  const navigateToLogin = async () => {
    if (googleSignInLoading) return;
    setGoogleSignInLoading(true);
    try {
      try { sessionStorage.setItem('joe_google_signin_pending', '1'); } catch (_) {}
      await signInWithGoogle();
      setGoogleSignInLoading(false);
    } catch (error: any) {
      setGoogleSignInLoading(false);
      try { sessionStorage.removeItem('joe_google_signin_pending'); } catch (_) {}
      console.error('❌ Google sign-in error:', error);
    }
  };
  const navigateToPayment = () => setView('PAYMENT');
  const navigateToQR = (orderId: string) => {
    setSelectedOrderId(orderId);
    setView('QR');
  };

  const handleLogout = async () => {
    try {
      if (user) {
          const { signOut } = await import('./services/auth');
          await signOut();
      }
      setView('WELCOME');
    } catch (error) {
      setView('WELCOME');
    }
  };

  if (showSplash || authLoading) return <SplashScreen onFinish={handleSplashFinish} />;

  const navigateToOrderFromNotification = (orderId: string) => {
    setSelectedOrderId(orderId);
    setView('QR');
  };

  return (
    <NotificationProvider onViewOrder={navigateToOrderFromNotification}>
      {(() => {
        switch (view) {
          case 'WELCOME':
            if (user && profile && role) {
              if (role === 'admin') return <AdminDashboard profile={profile} onLogout={handleLogout} />;
              if (role === 'cashier') return <CashierView profile={profile} onLogout={handleLogout} />;
              if (role === 'server') return <ServingCounterView profile={profile} onLogout={handleLogout} />;
              return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
            }
            return <WelcomeView onStart={handleStartOrdering} onStaffLogin={navigateToLogin} onAdminLogin={navigateToStaffLogin} googleLoading={googleSignInLoading} />;
          case 'HOME': return <HomeView profile={profile} onProceed={navigateToPayment} onViewOrders={() => setView('ORDERS')} onLogout={handleLogout} />;
          case 'ORDERS': return <OrdersView profile={profile!} onBack={navigateToHome} onQROpen={navigateToQR} />;
          case 'PAYMENT': return <PaymentView profile={profile} onBack={navigateToHome} onSuccess={navigateToQR} />;
          case 'QR': return <QRView orderId={selectedOrderId!} onBack={navigateToHome} />;
          case 'STAFF_LOGIN': return <LoginView onBack={() => setView('WELCOME')} onSuccess={() => { setView('HOME'); }} />;
          case 'CASHIER': return <CashierView profile={profile!} onLogout={handleLogout} />;
          case 'ADMIN': return <AdminDashboard profile={profile!} onLogout={handleLogout} onOpenKitchen={() => setView('KITCHEN')} />;
          case 'KITCHEN': return <KitchenView onBack={() => setView(role === 'admin' ? 'ADMIN' : 'SERVING_COUNTER')} user={user} />;
          case 'SERVING_COUNTER': return <ServingCounterView profile={profile!} onLogout={handleLogout} onOpenKitchen={() => setView('KITCHEN')} />;
          default: return <WelcomeView onStart={handleStartOrdering} onStaffLogin={navigateToLogin} onAdminLogin={navigateToStaffLogin} />;
        }
      })()}
    </NotificationProvider>
  );
};

export default App;