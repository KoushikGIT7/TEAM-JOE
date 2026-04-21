import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 🛡️ [GLOBAL-SECURITY-LAYER] Error Boundary
 * Prevents "White Screen of Death" by catching React rendering crashes.
 * Auto-recovers after 4s in production to unblock users.
 */
class GlobalErrorBoundary extends Component<Props, State> {
  private autoRecoverTimer: ReturnType<typeof setTimeout> | null = null;

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 [REACT-CRASH]:', error, errorInfo);

    // [STABILITY-GUARD] Detect and prevent reload loops
    const lastReload = parseInt(localStorage.getItem('joe_last_reload') || '0');
    const now = Date.now();
    const reloadCount = parseInt(localStorage.getItem('joe_reload_count') || '0');
    
    if (now - lastReload < 10000) {
      if (reloadCount > 2) {
        console.error('🛑 [CRITICAL]: Infinite reload loop detected. Stopping auto-recovery.');
        return;
      }
      localStorage.setItem('joe_reload_count', (reloadCount + 1).toString());
    } else {
      localStorage.setItem('joe_reload_count', '1');
    }
    localStorage.setItem('joe_last_reload', now.toString());

    // Auto-recover after 4s in production so users aren't permanently blocked
    const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost';
    if (!isDev) {
      this.autoRecoverTimer = setTimeout(() => {
        window.location.reload();
      }, 4000);
    }
  }

  public componentWillUnmount() {
    if (this.autoRecoverTimer) clearTimeout(this.autoRecoverTimer);
  }

  private handleReset = () => {
    if (this.autoRecoverTimer) clearTimeout(this.autoRecoverTimer);
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isDev = import.meta.env?.DEV || window.location.hostname === 'localhost';
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
            <div className="w-20 h-20 bg-amber-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
              <RefreshCw className="w-10 h-10 text-amber-400 animate-spin" />
            </div>

            <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-3">
              Refreshing...
            </h1>

            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
              Something went wrong. {isDev ? 'Check the console for details.' : 'Auto-recovering in a moment.'}
            </p>

            <div className="space-y-3">
               <button
                 onClick={this.handleReset}
                 className="w-full h-14 bg-white text-slate-950 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all"
               >
                 <RefreshCw className="w-4 h-4" />
                 Reload Now
               </button>

               <button
                 onClick={() => window.location.href = '/'}
                 className="w-full h-12 bg-white/5 text-white/40 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
               >
                 <Home className="w-3.5 h-3.5" />
                 Return Home
               </button>
            </div>

            {isDev && (
              <div className="mt-8 pt-8 border-t border-white/5 text-left overflow-auto max-h-40">
                <code className="text-[10px] text-rose-400 font-mono block whitespace-pre-wrap">
                  {this.state.error?.name}: {this.state.error?.message}
                  {"\n\n"}
                  {this.state.error?.stack}
                </code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
