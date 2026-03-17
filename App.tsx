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

  // Routing Guards
  useEffect(() => {
    if (authLoading) return;
    
    const isAdminView = ['ADMIN_DASHBOARD', 'MENU_MANAGEMENT', 'USER_MANAGEMENT', 'ANALYTICS'].includes(view);
    const isStaffView = ['CASHIER', 'KITCHEN', 'SCANNER', 'SERVING'].includes(view);
    const isStudentProtectedView = ['ORDERS'].includes(view); 
    
    if (!user && (isAdminView || isStaffView || isStudentProtectedView)) {
      setView('WELCOME');
      return;
    }
    
    if (user && profile && profile.role !== 'admin' && isAdminView) {
      setView('HOME');
      return;
    }

    if (user && profile && profile.role === 'student' && isStaffView) {
      setView('HOME');
      return;
    }
  }, [authLoading, user, profile, view]);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !profile || !role) {
      setView((prev) => {
        const staffViews: ViewState[] = ['CASHIER', 'ADMIN', 'SERVING_COUNTER'];
        if (staffViews.includes(prev)) return 'WELCOME';
        return prev;
      });
      return;
    }
    
    let targetView: ViewState;
    if (role === 'admin') targetView = 'ADMIN';
    else if (role === 'cashier') targetView = 'CASHIER';
    else if (role === 'server') targetView = 'SERVING_COUNTER';
    else targetView = 'HOME';

    setView((prev) => {
      if (prev === 'WELCOME') return targetView;
      const protectedFlows: ViewState[] = ['PAYMENT', 'QR', 'ORDERS'];
      if (protectedFlows.includes(prev)) return prev;
      if (role === 'student' && prev === 'HOME') return prev;
      const validViews: ViewState[] = ['ADMIN', 'CASHIER', 'SERVING_COUNTER', 'KITCHEN', 'HOME'];
      if (!validViews.includes(prev)) return targetView;
      return prev;
    });
  }, [authLoading, user, profile, role]);

  const handleSplashFinish = () => {
    setShowSplash(false);
    try { sessionStorage.removeItem('joe_google_signin_pending'); } catch (_) {}
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

  if (showSplash) return <SplashScreen onFinish={handleSplashFinish} minDisplayTime={100} />;
  if (authLoading) return <div className="h-screen w-full flex items-center justify-center bg-black z-40"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

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