/**
 * Setup Page - One-time Firebase initialization
 * Access at /setup (or call directly from console)
 */

import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

// This will be available when script is imported
declare global {
  interface Window {
    initializeFirebase?: () => Promise<any>;
  }
}

const SetupPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Import and run initialization
      const { initializeFirebase } = await import('../scripts/initializeFirebase');
      const result = await initializeFirebase();
      setResult(result);
    } catch (err: any) {
      setError(err.message || 'Initialization failed');
      console.error('Setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h1 className="text-3xl font-black text-textMain mb-2">Firebase Setup</h1>
          <p className="text-textSecondary mb-8">
            Initialize default users, menu items, and settings in Firestore
          </p>

          <div className="space-y-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-bold text-textMain mb-2">What will be created:</h3>
              <ul className="space-y-1 text-sm text-textSecondary">
                <li>• Admin user: admin@cse.com / admin123</li>
                <li>• Cashier user: cashier@cse.com / cashier123</li>
                <li>• Server user: server@cse.com / server123</li>
                <li>• {INITIAL_MENU.length} menu items from constants</li>
                <li>• Inventory entries for all menu items</li>
                <li>• Default system settings</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleInitialize}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Initialize Firebase
              </>
            )}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-error mb-1">Error</h4>
                <p className="text-sm text-textSecondary">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <div className={`p-4 rounded-xl ${result.success ? 'bg-success/10 border border-success/20' : 'bg-error/10 border border-error/20'}`}>
                <div className="flex items-start gap-3">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className={`font-bold mb-1 ${result.success ? 'text-success' : 'text-error'}`}>
                      {result.success ? 'Success!' : 'Failed'}
                    </h4>
                    <pre className="text-xs text-textSecondary mt-2 overflow-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {result.success && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-primary mb-2" />
                  <p className="text-sm text-textMain">
                    <strong>Next steps:</strong> You can now login using the credentials above.
                    Access the login page from the welcome screen.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Import INITIAL_MENU for display
import { INITIAL_MENU } from '../constants';

export default SetupPage;
