import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import SplashScreen from './components/SplashScreen';
import { signInWithGoogle } from './services/auth';
import { requestNotificationPermission } from './services/notificationService';

// Views
import WelcomeView from './views/Student/WelcomeView';
import CashierView from './views/Staff/CashierView';
import AdminDashboard from './views/Admin/Dashboard';
import ServingCounterView from './views/Staff/ServingCounterView';
import KitchenView from './views/Staff/KitchenView';
import LoginView from './views/Auth/LoginView';

type ViewState =
  | 'WELCOME'
  | 'CASHIER'
  | 'ADMIN'
  | 'SERVING_COUNTER'
  | 'KITCHEN'
  | 'STAFF_LOGIN';

const App: React.FC = () => {
  const { user, profile, loading: authLoading, role } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [view, setView] = useState<ViewState>('WELCOME');
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);

  // Initial load logic: Fast intro (800ms) once auth is resolved
  useEffect(() => {
    if (!authLoading) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 800); 
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  // CRITICAL SAFETY: Force hide splash after 5s no matter what
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setShowSplash(false);
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, []);

  // Request notification permission on login
  useEffect(() => {
    if (user) {
      requestNotificationPermission();
    }
  }, [user]);

  // Unified Routing & Auth Guards (Strict RBAC)
  useEffect(() => {
    if (authLoading || showSplash) return;

    // 1. Protection for non-logged in users
    const protectedViews: ViewState[] = ['CASHIER', 'ADMIN', 'SERVING_COUNTER', 'KITCHEN'];
    if (!user && protectedViews.includes(view)) {
      setView('WELCOME');
      return;
    }

    // 2. Role-based redirects & Auto-Login from Welcome/Login
    if (user && profile && role && ['WELCOME', 'STAFF_LOGIN'].includes(view)) {
      if (role === 'ADMIN') setView('ADMIN');
      else if (role === 'CASHIER') setView('CASHIER');
      else if (role === 'SERVER') setView('SERVING_COUNTER');
      else {
        // Should not happen due to onAuthStateChange check, but safety first
        setView('WELCOME');
      }
      return;
    }
  }, [authLoading, showSplash, user, profile, role, view]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const navigateToStaffLogin = () => setView('STAFF_LOGIN');
  const navigateToLogin = async () => {
    if (googleSignInLoading) return;
    setGoogleSignInLoading(true);
    try {
      await signInWithGoogle();
      setGoogleSignInLoading(false);
    } catch (error: any) {
      setGoogleSignInLoading(false);
      console.error('❌ Google sign-in error:', error);
    }
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

  return (
    <div className="min-h-screen bg-background text-textMain">
      {(() => {
        switch (view) {
          case 'WELCOME':
            return <WelcomeView onStart={() => {}} onStaffLogin={navigateToLogin} onAdminLogin={navigateToStaffLogin} googleLoading={googleSignInLoading} />;
          case 'STAFF_LOGIN': return (
            <LoginView 
              onBack={() => setView('WELCOME')} 
              onSuccess={(p) => {
                if (p.role === 'ADMIN') setView('ADMIN');
                else if (p.role === 'CASHIER') setView('CASHIER');
                else if (p.role === 'SERVER') setView('SERVING_COUNTER');
              }} 
            />
          );
          case 'CASHIER': return <CashierView profile={profile!} onLogout={handleLogout} />;
          case 'ADMIN': return <AdminDashboard profile={profile!} onLogout={handleLogout} onOpenKitchen={() => setView('KITCHEN')} />;
          case 'KITCHEN': return <KitchenView onBack={() => setView(role === 'ADMIN' ? 'ADMIN' : 'SERVING_COUNTER')} user={user} />;
          case 'SERVING_COUNTER': return <ServingCounterView profile={profile!} onLogout={handleLogout} onOpenKitchen={() => setView('KITCHEN')} />;
          default: return <WelcomeView onStart={() => {}} onStaffLogin={navigateToLogin} onAdminLogin={navigateToStaffLogin} />;
        }
      })()}
    </div>
  );
};

export default App;