import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

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
 */
class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 [REACT-CRASH]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-rose-500/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-rose-500/30">
               <AlertTriangle className="w-12 h-12 text-rose-500" />
            </div>
            
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">
              System Interrupted
            </h1>
            
            <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
              A critical UI error occurred. Restoring the kitchen console now to prevent data loss.
            </p>

            <div className="space-y-4">
               <button 
                 onClick={this.handleReset}
                 className="w-full h-16 bg-white text-slate-950 rounded-2xl font-black uppercase text-sm tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-white/5"
               >
                 <RefreshCw className="w-5 h-5" />
                 Restore System
               </button>
               
               <button 
                 onClick={() => window.location.href = '/'}
                 className="w-full h-16 bg-white/5 text-white/40 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
               >
                 <Home className="w-4 h-4" />
                 Return Home
               </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 pt-8 border-t border-white/5 text-left overflow-auto max-h-40">
                <code className="text-[10px] text-rose-400 font-mono block whitespace-pre-wrap">
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
