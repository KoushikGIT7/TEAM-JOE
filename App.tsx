import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { initializeMenu, listenToLatestActiveQR } from './services/firestore-db';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle } from './services/auth';
import { NotificationProvider } from './contexts/NotificationContext';

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

  // Initialize menu (non-blocking)
  useEffect(() => {
    initializeMenu().catch((error) => {
      console.warn("Menu initialization failed (non-critical):", error);
    });
  }, []);

  // Note: Splash screen controls its own display duration via onFinish callback
  // It shows for minimum 2500ms and then calls handleSplashFinish()

  // Cross-session QR recovery for logged-in students
  useEffect(() => {
    if (authLoading) return;
    if (!profile?.uid || role !== 'student') return;
    const unsub = listenToLatestActiveQR(profile.uid, (order) => {
      if (!order) return;
      // Don't interrupt payment flow; otherwise always show active QR
      if (view === 'PAYMENT') return;
      setSelectedOrderId(order.id);
      setView('QR');
    });
    return unsub;
  }, [authLoading, profile?.uid, role, view]);

  // 🔑 GUEST ORDERS GUARD: If guest tries to access ORDERS (view all orders), redirect to LOGIN
  // QR view is allowed for guests (can view their own QR after payment)
  // PAYMENT is allowed for guests (can checkout without login)
  useEffect(() => {
    if (authLoading) return;
    
    const guestAccessingOrdersView = !user && view === 'ORDERS';
    
    if (guestAccessingOrdersView) {
      console.log('🔑 [ORDERS-GUARD] Guest tried to access ORDERS, redirecting to STAFF_LOGIN for login');
      // Store the intended destination so we can redirect back after login
      try {
        sessionStorage.setItem('joe_checkout_redirect', view);
      } catch (e) {
        console.warn('Session storage unavailable', e);
      }
      setView('STAFF_LOGIN');
    }
  }, [authLoading, user, view]);

  /**
   * Auth bootstrap & role routing (CRITICAL FIX)
   * - Depends ONLY on Firebase auth state (via useAuth)
   * - No redirects while authLoading === true
   * - Welcome view is shown ONLY when user === null
   * - NEVER interrupt PAYMENT/QR/ORDERS flows for authenticated users
   * - On refresh, Firebase restores session and we route based on role
   */
  useEffect(() => {
    if (authLoading) {
      return; // 🚫 DO NOT redirect while loading
    }

    // UNAUTHENTICATED / GUEST:
    // user === null → only show WELCOME or guest flows (HOME / PAYMENT / QR)
    if (!user || !profile || !role) {
      // Ensure we never show staff/admin portals when there is no authenticated user
      setView((prev) => {
        const staffViews: ViewState[] = ['CASHIER', 'ADMIN', 'SERVING_COUNTER'];
        if (staffViews.includes(prev)) {
          return 'WELCOME';
        }
        return prev;
      });
      return;
    }

    // AUTHENTICATED USER:
    // Once Firebase restores the session and we have a profile + role,
    // apply routing ONLY if needed (WELCOME → portal, invalid views → portal).
    // NEVER interrupt PAYMENT / QR / ORDERS flows.
    
    let targetView: ViewState;
    if (role === 'admin') {
      targetView = 'ADMIN';
    } else if (role === 'cashier') {
      targetView = 'CASHIER';
    } else if (role === 'server') {
      targetView = 'SERVING_COUNTER';
    } else {
      // Default for authenticated users is HOME
      targetView = 'HOME';
    }

    setView((prev) => {
      // 🔴 CRITICAL SAFETY: If we're on WELCOME and user is authenticated, ALWAYS route away
      // This fixes the Google redirect issue where user gets stuck on Welcome
      if (prev === 'WELCOME') {
        console.log('🔄 [AUTH] Routing authenticated user away from WELCOME to:', targetView);
        return targetView;
      }

      // 🟢 CRITICAL RULE: For authenticated users in payment/order flow,
      // NEVER redirect them away from PAYMENT / QR / ORDERS
      // These views manage their own lifecycle and navigation
      const protectedFlows: ViewState[] = ['PAYMENT', 'QR', 'ORDERS'];
      if (protectedFlows.includes(prev)) {
        console.log('🟢 [AUTH] Preserving in-flow view:', prev, '(protected from redirect)');
        return prev;
      }

      // For students, don't override HOME view
      if (role === 'student' && prev === 'HOME') {
        return prev;
      }

      // For staff/admin, or genuinely invalid views, route to exact portal
      const validViews: ViewState[] = ['ADMIN', 'CASHIER', 'SERVING_COUNTER', 'KITCHEN', 'HOME'];
      if (!validViews.includes(prev)) {
        console.log('🔄 [AUTH] Routing from invalid view:', prev, 'to valid portal:', targetView);
        return targetView;
      }

      return prev;
    });
  }, [authLoading, user, profile, role]);

  // Handle splash screen completion — immediately apply auth routing if already resolved
  const handleSplashFinish = () => {
    setShowSplash(false);
    // Clear any pending sign-in marker (set before Google redirect)
    try { sessionStorage.removeItem('joe_google_signin_pending'); } catch (_) {}
  };

  const handleStartOrdering = async () => {
    // Block navigation if auth is still loading
    if (authLoading) {
      console.log('⏸️ handleStartOrdering: Auth still loading, blocking navigation');
      return;
    }

    // Guest mode: only browse menu; no persisted guest profile
    console.log('🚀 Guest browsing mode');
      setView('HOME');
  };

  const navigateToHome = () => setView('HOME');
  const navigateToStaffLogin = () => setView('STAFF_LOGIN');
  const navigateToLogin = async () => {
    if (googleSignInLoading) return; // Prevent double-click
    setGoogleSignInLoading(true);
    try {
      // Mark pending sign-in before redirect (survives page reload on mobile)
      try { sessionStorage.setItem('joe_google_signin_pending', '1'); } catch (_) {}
      
      await signInWithGoogle();
      // Popup path: auth state change will handle routing; clear loading
      setGoogleSignInLoading(false);
      console.log('✅ Google sign-in popup completed, auth state propagating...');
    } catch (error: any) {
      setGoogleSignInLoading(false);
      try { sessionStorage.removeItem('joe_google_signin_pending'); } catch (_) {}
      console.error('❌ Google sign-in error:', error);
      
      if (error?.code === 'auth/popup-blocked') {
        alert('Popups are blocked. Please allow popups for this site and try again.');
      } else if (error?.code === 'auth/popup-closed-by-user') {
        // User closed popup — silently ignore, no alert needed
        console.log('ℹ️ Google sign-in cancelled by user.');
      } else if (error?.code === 'auth/operation-not-supported-in-this-environment') {
        alert('Google Sign-In is not available here. Please try using a modern browser.');
      } else if (error?.message && !error.message.includes('redirect')) {
        alert('Google sign-in failed. Please check your connection and try again.');
      }
    }
  };
  const navigateToPayment = () => setView('PAYMENT');
  const navigateToQR = (orderId: string) => {
    console.log('🎯 Navigating to QR view for order:', orderId);
    setSelectedOrderId(orderId);
    setView('QR');
  };

  const handleLogout = async () => {
    console.log('🚪 handleLogout: Starting logout process...');
    
    try {
      if (user) {
          const { signOut } = await import('./services/auth');
          await signOut();
          console.log('✅ handleLogout: Signed out from Firebase');
      }

      // Once Firebase clears the session, useAuth → onAuthStateChanged will
      // set user=null and the auth bootstrap effect will keep us on guest screens.
      setView('WELCOME');
    } catch (error) {
      console.error('❌ handleLogout: Logout error:', error);
      setView('WELCOME');
    }
  };

  // Show splash screen during initial load or until minimum display time
  // Use a shorter splash time if we detect a returning Google redirect (pending sign-in)
  const hasPendingGoogleSignIn = (() => {
    try { return sessionStorage.getItem('joe_google_signin_pending') === '1'; } catch (_) { return false; }
  })();

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} minDisplayTime={hasPendingGoogleSignIn ? 800 : 2000} />;
  }

  // Show loading screen if auth state is still resolving (blocks routing until role is available)
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-black z-40">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render views with role-based protection; NotificationProvider shows in-app toast for ORDER_READY
  const navigateToOrderFromNotification = (orderId: string) => {
    setSelectedOrderId(orderId);
    setView('QR');
  };

  return (
    <NotificationProvider onViewOrder={navigateToOrderFromNotification}>
      {(() => {
        switch (view) {
          case 'WELCOME': {
            if (user && profile && role) {
              if (role === 'admin') return <AdminDashboard profile={profile} onLogout={handleLogout} />;
              if (role === 'cashier') return <CashierView profile={profile} onLogout={handleLogout} />;
              if (role === 'server') return <ServingCounterView profile={profile} onLogout={handleLogout} />;
              return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
            }
            // If auth is still loading (edge case: splash finished but auth pending)
            if (authLoading) {
              return (
                <div className="h-screen w-full flex items-center justify-center bg-black">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              );
            }
            return (
              <WelcomeView
                onStart={handleStartOrdering}
                onStaffLogin={navigateToLogin}
                onAdminLogin={navigateToStaffLogin}
                disabled={authLoading || googleSignInLoading}
                googleLoading={googleSignInLoading}
              />
            );
          }
          case 'HOME':
      // 🟢 HOME can be shown to both authenticated AND unauthenticated users (guest browsing)
      // For authenticated users, show full home view
      // For unauthenticated, guest can still browse (cart won't persist)
      return <HomeView profile={profile} onProceed={navigateToPayment} onViewOrders={() => setView('ORDERS')} onLogout={handleLogout} />;
    case 'ORDERS':
      // 🟢 For authenticated users, show orders view with real-time updates
      // 🔑 If guest, they'll be redirected by CHECKOUT_GUARD effect above
      if (profile) {
        return <OrdersView profile={profile} onBack={navigateToHome} onQROpen={navigateToQR} />;
      }
      // Guest will be redirected by the effect, show nothing
      return null;
    case 'PAYMENT':
      // 🟢 PaymentView allows BOTH authenticated AND guest checkout
      // Guests can proceed to payment without login
      // After payment, if guest needs to view orders/QR, they'll be prompted to login
      return <PaymentView profile={profile} onBack={navigateToHome} onSuccess={navigateToQR} />;
    case 'QR':
      // 🟢 QRView allows BOTH authenticated AND guest checkout
      // Guests can view their QR after payment without login
      return <QRView orderId={selectedOrderId!} onBack={navigateToHome} />;
    case 'STAFF_LOGIN':
      return (
        <LoginView
          onBack={() => setView('WELCOME')}
          onSuccess={() => {
            // 🔑 After login, check if guest was trying to checkout
            const checkoutRedirect = sessionStorage.getItem('joe_checkout_redirect');
            if (checkoutRedirect) {
              sessionStorage.removeItem('joe_checkout_redirect');
              console.log('🔑 [LOGIN-SUCCESS] Redirecting guest to:', checkoutRedirect);
              setView(checkoutRedirect as ViewState);
            }
            // Otherwise, auth bootstrap effect will route by role
          }}
        />
      );
    case 'CASHIER':
      // Cashier portal - ONLY accessible to cashiers
      if (profile && role === 'cashier') {
        return <CashierView profile={profile} onLogout={handleLogout} />;
      }
      console.warn('⚠️ Unauthorized access attempt to CASHIER portal. Role:', role);
      // Authenticated but wrong role → fall back to student home
      if (user && profile) {
        return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
      }
      return (
        <WelcomeView
          onStart={handleStartOrdering}
          onStaffLogin={navigateToLogin}
          onAdminLogin={navigateToStaffLogin}
        />
      );
    case 'ADMIN':
      // Admin portal - ONLY accessible to admins
      if (profile && role === 'admin') {
        return <AdminDashboard profile={profile} onLogout={handleLogout} onOpenKitchen={() => setView('KITCHEN')} />;
      }
      console.warn('⚠️ Unauthorized access attempt to ADMIN portal. Role:', role);
      if (user && profile) {
        return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
      }
      return (
        <WelcomeView
          onStart={handleStartOrdering}
          onStaffLogin={navigateToLogin}
          onAdminLogin={navigateToStaffLogin}
        />
      );
    case 'KITCHEN':
      if (profile && (role === 'server' || role === 'admin')) {
        return <KitchenView onBack={() => setView(role === 'admin' ? 'ADMIN' : 'SERVING_COUNTER')} />;
      }
      if (user && profile) return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
      return (
        <WelcomeView onStart={handleStartOrdering} onStaffLogin={navigateToLogin} onAdminLogin={navigateToStaffLogin} />
      );
    case 'SERVING_COUNTER':
      // Server portal - ONLY accessible to servers
      if (profile && role === 'server') {
        return <ServingCounterView profile={profile} onLogout={handleLogout} onOpenKitchen={() => setView('KITCHEN')} />;
      }
      console.warn('⚠️ Unauthorized access attempt to SERVING_COUNTER portal. Role:', role);
      if (user && profile) {
        return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
      }
      return (
        <WelcomeView
          onStart={handleStartOrdering}
          onStaffLogin={navigateToLogin}
          onAdminLogin={navigateToStaffLogin}
        />
      );
          default:
            if (user && profile) {
              return <HomeView profile={profile} onProceed={navigateToPayment} onLogout={handleLogout} />;
            }
            return (
              <WelcomeView
                onStart={handleStartOrdering}
                onStaffLogin={navigateToLogin}
                onAdminLogin={navigateToStaffLogin}
              />
            );
        }
      })()}
    </NotificationProvider>
  );
};

export default App;