import React, { useState, useEffect, useMemo } from 'react';
import {
   LogOut, CheckCircle, Clock, Banknote, RefreshCw, Search, LayoutDashboard,
   FileText, BarChart3, Settings, X, AlertCircle, TrendingUp, DollarSign,
   Receipt, Download, Calendar, Filter, Menu, PieChart as PieIcon, Image as ImageIcon,
   Calculator, TrendingDown, ArrowUpRight, ChevronRight, ShieldCheck, LayoutGrid, Zap, AlertTriangle
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import {
   listenToPendingCashOrders, confirmCashPayment, rejectCashPayment,
   listenToAllOrders, listenToMenu, registerBankDeposit, flushMissedPickups
} from '../../services/firestore-db';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import Logo from '../../components/Logo';
import { joeSounds } from '../../utils/audio';
import { sonicVoice } from '../../services/voice-engine';
import { offlineDetector } from '../../utils/offlineDetector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchReport, exportReport, ExportFormat } from '../../services/reporting';
import SmartImage from '../../components/Common/SmartImage';
import { preloadImage } from '../../utils/image-optimizer';
import AuditDownloadButton from '../../components/AuditDownloadButton';

interface CashierViewProps {
   profile: UserProfile;
   onLogout: () => void;
}

type CashierTab = 'PENDING' | 'ORDERS' | 'INSIGHT' | 'SUMMARY' | 'SETTINGS';

const COLORS = ['#10B981', '#F59E0B', '#6366F1', '#EC4899'];

const CashierView: React.FC<CashierViewProps> = ({ profile, onLogout }) => {
   const [activeTab, setActiveTab] = useState<CashierTab>('PENDING');
   const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
   const [allOrders, setAllOrders] = useState<Order[]>([]);
   const [confirming, setConfirming] = useState<string | null>(null);
   const [rejecting, setRejecting] = useState<string | null>(null);
   const [reportData, setReportData] = useState<any>(null);
   const [optimisticClearedIds, setOptimisticClearedIds] = useState<Set<string>>(new Set());
   const [search, setSearch] = useState('');
   const [loading, setLoading] = useState(true);

   // 🛡️ SAFETY: Force-clear loading after 3s max
   useEffect(() => {
      const safetyTimer = setTimeout(() => setLoading(false), 3000);
      return () => clearTimeout(safetyTimer);
   }, []);

   // 📊 LIVE STATS: Real-time state for Diagnostic Stratagem
   const [liveStats, setLiveStats] = useState({
      cash: 0, count: 0, avg: 0,
      hourlyData: [] as { hour: string; orders: number; revenue: number }[],
      paymentSplit: [{ name: 'Cash', value: 0 }, { name: 'Online', value: 0 }]
   });
   const [liveStatsUpdatedAt, setLiveStatsUpdatedAt] = useState<Date | null>(null);

   const [isOffline, setIsOffline] = useState(!navigator.onLine);

   useEffect(() => {
      const onOnline = () => setIsOffline(false);
      const onOffline = () => setIsOffline(true);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
         window.removeEventListener('online', onOnline);
         window.removeEventListener('offline', onOffline);
      };
   }, []);

   const audioRef = React.useRef<HTMLAudioElement | null>(null);

   const notifiedUtrs = React.useRef<Set<string>>(new Set());
   useEffect(() => {
      if ('Notification' in window && Notification.permission === 'default') {
         Notification.requestPermission();
      }

      let lastLen = 0;
      const unsubs = [
         listenToPendingCashOrders((data) => {
            // 🔔 Alert on new cash requests
            if (data.length > lastLen) {
               if (audioRef.current) audioRef.current.play().catch(() => {});
               if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`💵 ${data.length} Cash Request${data.length > 1 ? 's' : ''} Pending`, {
                     body: `Tap to review.`,
                     icon: '/JeoLogoFinal.png',
                  });
               }
            }
            lastLen = data.length;
            setPendingOrders(data);
            setLoading(false);
            offlineDetector.recordPing();
         }),
         listenToAllOrders((data) => {
            setAllOrders(data);
            setLoading(false); // Backup loading clear
            offlineDetector.recordPing();
         }),
      ];

      return () => {
         unsubs.forEach(fn => fn());
      };
   }, []);

   // 🍱 [INVENTORY-RADAR] Real-time Stock Burn visualization
   const [inventoryData, setInventoryData] = useState<any[]>([]);
   useEffect(() => {
      const unsub = onSnapshot(collection(db, 'inventory_meta'), (snap) => {
         const items = snap.docs.map(doc => {
            const data = doc.data();
            const available = Math.max(0, (data.totalStock || 0) - (data.consumed || 0));
            return {
               name: data.itemName || doc.id,
               available,
               consumed: data.consumed || 0,
               total: data.totalStock || 0
            };
         });
         setInventoryData(items);
      });
      return () => unsub();
   }, []);

   // 🔴 REAL-TIME DIAGNOSTIC STRATAGEM: Direct onSnapshot listener for today's orders
   useEffect(() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const startMs = todayStart.getTime();

      const todayQ = query(
         collection(db, 'orders'),
         where('createdAt', '>=', startMs),
         orderBy('createdAt', 'asc')
      );

      const unsub = onSnapshot(todayQ,
         (snapshot) => {
            const todayOrders = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
            const paidOrders = todayOrders.filter(o => o.paymentStatus === 'SUCCESS' || o.paymentStatus === 'VERIFIED');
            const cash = paidOrders.filter(o => o.paymentType === 'CASH').reduce((s, o) => s + (o.totalAmount || 0), 0);
            const online = paidOrders.filter(o => o.paymentType !== 'CASH').reduce((s, o) => s + (o.totalAmount || 0), 0);
            const avg = paidOrders.length > 0 ? paidOrders.reduce((s, o) => s + (o.totalAmount || 0), 0) / paidOrders.length : 0;

            const hourlyMap: Record<string, { orders: number; revenue: number }> = {};
            for (let i = 7; i <= 21; i++) hourlyMap[`${i}:00`] = { orders: 0, revenue: 0 };
            paidOrders.forEach(o => {
               const h = new Date(o.createdAt).getHours();
               const key = `${h}:00`;
               if (!hourlyMap[key]) hourlyMap[key] = { orders: 0, revenue: 0 };
               hourlyMap[key].orders++;
               hourlyMap[key].revenue += o.totalAmount || 0;
            });

            setLiveStats({
               cash,
               count: paidOrders.length,
               avg,
               hourlyData: Object.entries(hourlyMap).map(([hour, v]) => ({ hour, ...v })),
               paymentSplit: [{ name: 'Cash', value: cash }, { name: 'Online', value: online }]
            });
            setLiveStatsUpdatedAt(new Date());
         },
         (err) => {
            console.error('[LIVE-STATS] Today orders listener error:', err);
         }
      );

      return () => unsub();
   }, []);

   // Conflict Intelligence: Detect multiple orders for the same amount
   const conflictMap = useMemo(() => {
      const counts: Record<number, number> = {};
      pendingOrders.forEach(o => {
         counts[o.totalAmount] = (counts[o.totalAmount] || 0) + 1;
      });
      return counts;
   }, [pendingOrders]);

   // PERFORMANCE FIX [Laziness Strategy]: Only sync report data when the user is actually 
   // looking at the Insight or Summary tabs. This stops massive background reads during peak hours.
   useEffect(() => {
      if (activeTab !== 'INSIGHT' && activeTab !== 'SUMMARY') return;

      const loadReportData = async () => {
         try {
            const today = new Date();
            const start = new Date(today.setHours(0, 0, 0, 0));
            const end = new Date(today.setHours(23, 59, 59, 999));
            const data = await fetchReport({ role: 'cashier', start, end });
            setReportData(data);
         } catch (err) {
            console.error('Audit sync failed:', err);
         }
      };
      loadReportData();
   }, [allOrders, activeTab]);

   // --- ⚙️ HANDLERS ---
   const handleConfirm = (orderId: string) => {
      if (!offlineDetector.isOnline()) {
         alert("Waiting for connection...");
         return;
      }
      // ⚡ OPTIMISTIC STROKE: Clear from UI in <50ms
      setOptimisticClearedIds(prev => new Set(prev).add(orderId));
      joeSounds.playPaymentConfirmed();
      sonicVoice.announceOrderComplete(); // 🎙️ [SONIC-AUDIT] Handshake Confirmation
      // Background Execution (Silent)
      confirmCashPayment(orderId, profile.uid).catch((err: any) => {
         // Rollback only on hard failure
         setOptimisticClearedIds(prev => {
            const next = new Set(prev);
            next.delete(orderId);
            return next;
         });
         alert(err.message || 'Failed to approve. Reverting...');
      });

      offlineDetector.recordPing();
   };

   const handleReject = async (orderId: string) => {
      if (!offlineDetector.isOnline()) {
         alert("Waiting for connection...");
         return;
      }
      if (!confirm('Reject request?')) return;
      setRejecting(orderId);
      try {
         await rejectCashPayment(orderId, profile.uid);
         offlineDetector.recordPing();
      } catch (err: any) {
         alert(err.message || 'Failed to reject');
      } finally {
         setRejecting(null);
      }
   };

   const handleAuditExport = async () => {
      if (!reportData) {
         alert('Data still syncing, please wait...');
         return;
      }
      try {
         console.log('📄 [AUDIT] Generating Strategy Report...');
         await exportReport(reportData, { typeLabel: 'Daily Audit', format: 'pdf' });
         console.log('✅ [AUDIT] Report Delivered.');
      } catch (err) {
         console.error('❌ [AUDIT] PDF Error:', err);
         alert('Could not generate PDF. Please check data.');
      }
   };



   const formatTime = (ts?: number) => {
      if (!ts) return '--:--';
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
   };

   // --- 📊 CALCULATED STATS ---
   const filteredOrders = useMemo(() => {
      let filtered = allOrders;
      if (search) {
         const s = search.toLowerCase();
         filtered = filtered.filter(o => o.userName.toLowerCase().includes(s) || o.id.toLowerCase().includes(s));
      }
      return filtered.slice().reverse();
   }, [allOrders, search]);

   const stats = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = allOrders.filter(o => {
         const d = new Date(o.createdAt);
         d.setHours(0, 0, 0, 0);
         return d.getTime() === today.getTime() && o.paymentStatus === 'SUCCESS';
      });

      const cash = todayOrders.filter(o => o.paymentType === 'CASH').reduce((s, o) => s + o.totalAmount, 0);
      const avg = todayOrders.length > 0 ? todayOrders.reduce((s, o) => s + o.totalAmount, 0) / todayOrders.length : 0;

      const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, orders: 0, revenue: 0 }));
      todayOrders.forEach(o => {
         const hour = new Date(o.createdAt).getHours();
         hourlyData[hour].orders++;
         hourlyData[hour].revenue += o.totalAmount;
      });

      const paymentSplit = [
         { name: 'Cash', value: cash },
         { name: 'Online', value: todayOrders.filter(o => o.paymentType !== 'CASH').reduce((s, o) => s + o.totalAmount, 0) }
      ];

      return {
         cash,
         count: todayOrders.length,
         avg,
         hourlyData: hourlyData.filter(h => h.orders > 0 || (parseInt(h.hour) >= 8 && parseInt(h.hour) <= 21)),
         paymentSplit
      };
   }, [allOrders]);

   // --- 💻 AUTOMATION TERMINAL ---


   // --- 💻 DESKTOP COMPONENTS (ORIGINAL STYLE) ---
   const renderDesktopDashboard = () => (
      <div className="space-y-8 animate-in fade-in duration-500">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Live · {liveStatsUpdatedAt ? `Updated ${liveStatsUpdatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connecting...'}
               </span>
            </div>
            <AuditDownloadButton />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <DollarSign className="w-8 h-8 text-emerald-600 mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today Cash</p>
               <p className="text-4xl font-black text-slate-900 italic">₹{liveStats.cash.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <Receipt className="w-8 h-8 text-blue-600 mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales</p>
               <p className="text-4xl font-black text-slate-900 italic">{liveStats.count}</p>
            </div>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <AlertCircle className="w-8 h-8 text-amber-500 mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Sync</p>
               <p className="text-4xl font-black text-slate-900 italic">{pendingOrders.length}</p>
            </div>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
               <TrendingUp className="w-8 h-8 text-indigo-600 mb-4" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Ticket</p>
               <p className="text-4xl font-black text-slate-900 italic">₹{Math.round(liveStats.avg)}</p>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Sales Velocity (Hourly)</h3>
               <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={liveStats.hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)' }} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="orders" fill="#10B981" radius={[8, 8, 0, 0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Inventory Radar (Available / Total)</h3>
               <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={inventoryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} hide />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 800 }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="available" fill="#3B82F6" radius={[0, 8, 8, 0]} barSize={20} />
                        <Bar dataKey="consumed" fill="#f43f5e" radius={[0, 8, 8, 0]} barSize={20} opacity={0.2} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Payment Distribution</h3>
               <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie data={liveStats.paymentSplit} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" nameKey="name">
                           {liveStats.paymentSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend verticalAlign="bottom" height={36} iconType="circle" />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
            </div>
         </div>
      </div>
   );

   const renderDesktopRequests = () => (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
         <div className="bg-amber-500 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-amber-900/10 flex items-center justify-between overflow-hidden relative">
            <div className="relative z-10">
               <h2 className="text-3xl font-black uppercase italic tracking-tight">Active Verifications</h2>
               <p className="text-amber-100 font-bold opacity-80 mt-1">Pending cash approvals awaiting action</p>
            </div>
            <div className="relative z-10 bg-white/20 backdrop-blur-xl px-10 py-6 rounded-3xl border border-white/20 flex items-center gap-6">
               <Banknote className="w-10 h-10" />
               <div>
                  <p className="text-[10px] font-black opacity-50 uppercase tracking-widest">In Queue</p>
                  <p className="text-5xl font-black leading-none">{pendingOrders.length}</p>
               </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingOrders.filter(o => !optimisticClearedIds.has(o.id)).map(order => {
               const hasConflict = conflictMap[order.totalAmount] > 1;
               const isAutoVerified = order.paymentStatus === 'SUCCESS';
               const isCashRequest = order.paymentStatus === 'AWAITING_CONFIRMATION';

               return (
                  <div key={order.id} className={`bg-white rounded-[2.5rem] border-4 transition-all duration-300 ${isAutoVerified ? 'border-emerald-500 bg-emerald-50/20 shadow-emerald-500/10' :
                        hasConflict ? 'border-amber-400 bg-amber-50/30' : 'border-slate-100'
                     } p-8 shadow-xl hover:shadow-2xl group overflow-hidden relative active:scale-[0.99]`}>
                     <div className="flex justify-between items-start mb-8">
                        <div>
                           <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-[13px] font-black bg-slate-900 text-white px-4 py-1.5 rounded-xl uppercase tracking-widest italic">
                                 #{order.id.slice(-6).toUpperCase()}
                              </span>
                              {isAutoVerified && (
                                 <span className="text-[9px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> VERIFIED
                                 </span>
                              )}
                              {hasConflict && !isAutoVerified && (
                                 <span className="text-[9px] font-black bg-amber-500 text-white px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> CONFLICT
                                 </span>
                              )}
                              {isCashRequest && (
                                 <span className="text-[9px] font-black bg-amber-700 text-white px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1">
                                    <Banknote className="w-3 h-3" /> CASH
                                 </span>
                              )}
                           </div>
                           <h3 className="text-3xl font-black text-slate-900 tracking-tight">{order.userName}</h3>
                        </div>
                        <div className="text-right">
                           <p className={`text-5xl font-black leading-none ${isAutoVerified ? 'text-emerald-600' : 'text-slate-900'}`}>₹{order.totalAmount}</p>
                           <p className="text-[10px] text-slate-400 font-bold mt-3 uppercase tracking-widest italic">{formatTime(order.createdAt)}</p>
                        </div>
                     </div>

                     {/* Clean item chips */}
                     <div className="flex flex-wrap gap-2 mb-6">
                        {order.items.map((it, idx) => (
                           <div key={idx} className="bg-slate-50 border border-slate-100 flex items-center gap-2 px-3 py-2 rounded-xl">
                              <span className="text-[11px] font-black text-slate-700">{it.quantity}× {it.name}</span>
                              <span className="text-[9px] text-slate-400">₹{it.price * it.quantity}</span>
                           </div>
                        ))}
                     </div>

                     <div className="flex gap-4 relative z-10">
                        <button
                           onClick={() => handleConfirm(order.id)}
                           disabled={!!confirming || order.paymentStatus === 'VERIFIED' || order.paymentStatus === 'SUCCESS'}
                           className={`flex-[2] h-24 rounded-[2rem] font-black text-lg uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4 ${(order.paymentStatus === 'VERIFIED' || order.paymentStatus === 'SUCCESS') ? 'bg-emerald-100 text-emerald-900 opacity-50 shadow-none' :
                                 conflictMap[order.totalAmount] > 1 ? 'bg-amber-500 text-white shadow-amber-900/30' : 'bg-slate-900 text-white shadow-black/20'
                              }`}
                        >
                           {confirming === order.id ? <RefreshCw className="w-6 h-6 animate-spin" /> : (
                              <>
                                 {(order.paymentStatus === 'VERIFIED' || order.paymentStatus === 'SUCCESS') ? <CheckCircle className="w-8 h-8" /> : <Zap className="w-8 h-8" />}
                                 {(order.paymentStatus === 'VERIFIED' || order.paymentStatus === 'SUCCESS') ? "PAID" : isCashRequest ? "CONFIRM CASH" : conflictMap[order.totalAmount] > 1 ? "SOLVE CONFLICT" : "APPROVE CASH"}
                              </>
                           )}
                        </button>
                        {order.paymentStatus !== 'SUCCESS' && (
                           <button onClick={() => handleReject(order.id)} disabled={!!rejecting} className="w-20 h-20 bg-rose-50 text-rose-600 font-black rounded-[1.5rem] border-2 border-rose-100 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-rose-900/5">
                              <X className="w-8 h-8" />
                           </button>
                        )}
                     </div>
                     {hasConflict && (
                        <div className="absolute top-0 right-0 p-3"><AlertCircle className="w-6 h-6 text-amber-500 opacity-20" /></div>
                     )}
                  </div>
               );
            })}
            {pendingOrders.filter(o => !optimisticClearedIds.has(o.id)).length === 0 && (
               <div className="md:col-span-2 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center">
                  <ShieldCheck className="w-20 h-20 text-slate-100 mb-6" />
                  <p className="text-2xl font-black text-slate-900">Terminals Cleared</p>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-2">All cash requests have been processed</p>
               </div>
            )}
         </div>
      </div>
   );

   const renderDesktopHistory = () => (
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in duration-500">
         <div className="p-10 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
               <h2 className="text-2xl font-black text-slate-900 uppercase italic">Transaction Ledger</h2>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live accounting audit</p>
            </div>
            <div className="relative w-full sm:w-96">
               <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input
                  type="text" placeholder="Search by name or order code..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-14 pr-6 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
               />
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                     <th className="px-10 py-5">Order Reference</th>
                     <th className="px-10 py-5">Student</th>
                     <th className="px-10 py-5">Method</th>
                     <th className="px-10 py-5">Status</th>
                     <th className="px-10 py-5 text-right">Amount</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {filteredOrders.map(order => (
                     <tr key={order.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-10 py-6 text-sm font-black text-slate-900">#{order.id.slice(-10).toUpperCase()}</td>
                        <td className="px-10 py-6">
                           <p className="text-sm font-black text-slate-800 leading-none">{order.userName}</p>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">{formatTime(order.createdAt)}</p>
                        </td>
                        <td className="px-10 py-6">
                           <span className="text-sm font-mono font-black text-slate-900 tracking-widest">
                              {order.utr || order.id.slice(-4).toUpperCase()}
                           </span>
                        </td>
                        <td className="px-10 py-6">
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${order.paymentType === 'CASH' ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-blue-100 text-blue-600 border border-blue-200'}`}>
                              {order.paymentType}
                           </span>
                        </td>
                        <td className="px-10 py-6">
                           <span className={`text-[10px] font-black uppercase tracking-widest ${order.paymentStatus === 'SUCCESS' ? 'text-emerald-500' : 'text-slate-300'}`}>
                              {order.paymentStatus === 'SUCCESS' ? 'Verified' : 'Unconfirmed'}
                           </span>
                        </td>
                        <td className="px-10 py-6 text-right font-black text-slate-900 text-lg italic">₹{order.totalAmount}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
   );

   // --- 📱 MOBILE SPECIFIC VIEW RENDERERS ---

   const renderMobileRequests = () => (
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
         <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-base font-black uppercase italic text-slate-900">Verification Queue</h2>
            <span className="bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-amber-500/20">{pendingOrders.length} Pending</span>
         </div>

         <div className="space-y-3">
            {pendingOrders.filter(o => !optimisticClearedIds.has(o.id)).map(order => {
               const hasConflict = conflictMap[order.totalAmount] > 1;
               const isUtrSubmitted = order.paymentStatus === 'UTR_SUBMITTED';
               const isCashRequest = order.paymentStatus === 'AWAITING_CONFIRMATION';

               return (
                  <div key={order.id} className={`bg-white rounded-2xl p-4 border transition-all duration-300 ${hasConflict ? 'border-amber-200 shadow-lg shadow-amber-500/5' :
                        isUtrSubmitted ? 'border-indigo-200 shadow-lg shadow-indigo-500/5' : 'border-slate-100'
                     }`}>
                     {/* Card Header: Student Name & Time */}
                     <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 pr-2">
                           <h3 className="text-[15px] font-black text-slate-900 truncate leading-tight">{order.userName}</h3>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{formatTime(order.createdAt)} • #{order.id.slice(-4).toUpperCase()}</p>
                        </div>
                        <div className="text-right shrink-0">
                           <p className="text-xl font-black text-slate-900 leading-none">₹{order.totalAmount}</p>
                           {isUtrSubmitted && <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mt-1 block">UTR SENT</span>}
                        </div>
                     </div>

                     {/* UTR Highlights (Gen-Z Minimalist) */}
                     {(order.paymentStatus === 'UTR_SUBMITTED' || order.utrLast4 || order.utr) && (
                        <div className="bg-slate-900 rounded-xl p-3 mb-3 border border-white/5 flex items-center justify-between">
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">UTR KEY</span>
                           <p className="font-mono font-black text-white text-lg tracking-widest leading-none">
                              {order.utrLast4 || (order.utr?.length === 4 ? order.utr : order.utr?.slice(-4)) || '----'}
                           </p>
                        </div>
                     )}
                     {isCashRequest && (
                        <div className="bg-amber-500 rounded-xl p-3 mb-3 border border-white/5 flex items-center justify-between">
                           <span className="text-[8px] font-black text-amber-900 uppercase tracking-widest">STATUS</span>
                           <p className="font-black text-white text-sm uppercase tracking-widest leading-none">CASH REQUEST</p>
                        </div>
                     )}

                     {/* Items Summary (Compact but readable) */}
                     <div className="flex flex-wrap gap-1.5 mb-4">
                        {order.items.map((it, idx) => (
                           <span key={idx} className="bg-slate-50 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-100">
                              {it.quantity}x {it.name}
                           </span>
                        ))}
                     </div>

                     {/* POS-style Smart Actions */}
                     <div className="flex gap-2">
                        <button
                           onClick={() => handleConfirm(order.id)}
                           className={`flex-1 h-11 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${isUtrSubmitted ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' :
                                 hasConflict ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-900 text-white'
                              }`}
                        >
                           <Zap className="w-3.5 h-3.5" />
                           {isUtrSubmitted ? "Verify & Pay" : isCashRequest ? "Confirm Cash" : "Accept Cash"}
                        </button>
                        <button
                           onClick={() => handleReject(order.id)}
                           className="w-11 h-11 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                        >
                           <X className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               );
            })}
            {pendingOrders.length === 0 && (
               <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                  <ShieldCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-black text-slate-900">All Clear</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 leading-none">Queue fully processed</p>
               </div>
            )}
         </div>
      </div>
   );

   const renderMobileHistory = () => (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
         <div className="px-1 block space-y-3">
            <h2 className="text-base font-black uppercase italic text-slate-900">Cryptographic Ledger</h2>
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input
                  type="text" placeholder="Find order..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-xs font-black outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
               />
            </div>
         </div>

         <div className="space-y-2">
            {filteredOrders.map(order => (
               <div key={order.id} className="bg-white rounded-xl p-4 border border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="min-w-0 pr-4">
                     <p className="text-[13px] font-black text-slate-900 leading-tight truncate">{order.userName}</p>
                     <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">#{order.id.slice(-4).toUpperCase()}</span>
                        <span className="text-[9px] font-mono font-black text-emerald-600 uppercase tracking-widest italic">{order.utr?.slice(-4) || 'CASH'}</span>
                     </div>
                  </div>
                  <div className="text-right shrink-0">
                     <p className="text-[15px] font-black text-slate-900">₹{order.totalAmount}</p>
                     <span className={`text-[8px] font-black uppercase tracking-widest mt-1 block ${order.paymentStatus === 'SUCCESS' ? 'text-emerald-500' : 'text-slate-300'}`}>
                        {order.paymentStatus === 'SUCCESS' ? 'VERIFIED' : 'PENDING'}
                     </span>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );

   const renderMobileDashboard = () => (
      <div className="space-y-4 animate-in fade-in duration-500">
         <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
               <DollarSign className="w-5 h-5 text-emerald-600 mb-2" />
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cash</p>
               <p className="text-xl font-black text-slate-900 italic">₹{stats.cash.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
               <Receipt className="w-5 h-5 text-blue-600 mb-2" />
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tickets</p>
               <p className="text-xl font-black text-slate-900 italic">{stats.count}</p>
            </div>
         </div>

         <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Velocity Audit</h3>
            <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourlyData}>
                     <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>
   );

   const renderDesktopSummary = () => (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
         <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-12">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-900/20"><Calculator className="w-8 h-8 text-white" /></div>
                  <div>
                     <h2 className="text-3xl font-black text-slate-900 uppercase italic">Shift Settlement</h2>
                     <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Reconciliation & Audit Control</p>
                  </div>
               </div>
               <button onClick={handleAuditExport} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center gap-3">
                  <Download className="w-4 h-4" /> GENERATE AUDIT
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
               <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Cash in Drawer (Estimated)</p>
                  <p className="text-6xl font-black text-slate-900 italic">₹{stats.cash.toLocaleString()}</p>
                  <div className="h-px bg-slate-200 my-8" />
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Sales Count</p>
                        <p className="text-xl font-black text-slate-800">{stats.count}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Avg Yield</p>
                        <p className="text-xl font-black text-slate-800">₹{Math.round(stats.avg)}</p>
                     </div>
                  </div>
               </div>
               <div className="bg-emerald-600 p-10 rounded-[2.5rem] shadow-2xl text-white relative flex flex-col justify-center">
                  <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.3em] mb-4">Live System Status</p>
                  <h3 className="text-4xl font-black italic">OPERATIONAL</h3>
                  <p className="text-sm font-bold opacity-70 mt-4 leading-relaxed uppercase tracking-widest">All protocols running. <br />Database synced 0ms ago.</p>
                  <ShieldCheck className="absolute bottom-[-20px] right-[-20px] w-48 h-48 opacity-[0.05] -rotate-12" />
               </div>
            </div>

            <div className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center text-emerald-600 font-black text-lg shadow-sm">
                     {profile.name.charAt(0)}
                  </div>
                  <div>
                     <p className="text-xs font-black text-slate-900 uppercase">{profile.name}</p>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">{profile.uid.slice(0, 16).toUpperCase()}</p>
                  </div>
               </div>
               <button onClick={onLogout} className="px-8 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-rose-100 hover:bg-rose-500 hover:text-white transition-all">
                  End Active Session
               </button>
            </div>
         </div>
      </div>
   );

   const renderMobileControl = () => {
      switch (activeTab) {
         case 'PENDING': return renderMobileRequests();
         case 'ORDERS': return renderMobileHistory();
         case 'INSIGHT': return renderMobileDashboard();
         case 'SUMMARY': return (
            <div className="space-y-4 animate-in fade-in duration-300">
               <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                  <p className="text-[9px] font-black opacity-40 uppercase tracking-[0.4em] mb-3">Cash Position</p>
                  <div className="flex items-baseline gap-1.5 mb-6">
                     <span className="text-sm font-black opacity-20">₹</span>
                     <p className="text-4xl font-black tracking-tight leading-none italic">{stats.cash.toLocaleString()}</p>
                  </div>
                  <p className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em]">{profile.name}</p>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl -mr-8 -mt-8" />
               </div>

               <div className="space-y-2">
                  <button onClick={handleAuditExport} className="w-full h-14 bg-emerald-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-emerald-500/10">
                     <FileText className="w-4 h-4 text-emerald-100" /> DOWNLOAD PDF
                  </button>
                  <button onClick={onLogout} className="w-full h-12 bg-white text-rose-600 border border-slate-200 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95">
                     <LogOut className="w-4 h-4" /> SIGN OUT
                  </button>
               </div>

               <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                     <p className="text-[10px] font-black text-slate-900 uppercase">STATION {profile.role}</p>
                     <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{profile.uid.slice(0, 16)}</p>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-emerald-500/20" />
               </div>
            </div>
         );
         default: return null;
      }
   };

   // --- 🎨 MAIN RENDER ---
   return (
      <div className="min-h-screen bg-slate-50/50 select-none font-sans text-slate-900">
         {isOffline && (
            <div className="bg-red-600 text-white px-8 py-2 text-center font-black text-[10px] uppercase tracking-widest animate-pulse flex items-center justify-center gap-3 shrink-0 z-50">
               <AlertTriangle className="w-3 h-3" /> Connection unstable. Waiting for cashier database...
            </div>
         )}

         {/* 💻 DESKTOP DUAL-LAYOUT (hidden lg:flex) */}
         <div className="hidden lg:flex min-h-screen">
            <aside className="w-80 bg-[#111827] text-white flex flex-col p-8 pt-16 shrink-0 shadow-2xl z-30">
               <div className="flex items-center gap-5 mb-20 px-4">
                  <Logo size="lg" />
               </div>

               <nav className="flex-1 space-y-3">
                  {[
                     { id: 'INSIGHT', label: 'Monitor Deck', icon: LayoutDashboard },
                     { id: 'PENDING', label: 'Inbound Queue', icon: Banknote },
                     { id: 'ORDERS', label: 'Master Ledger', icon: FileText },
                     { id: 'SUMMARY', label: 'Settlement', icon: Calculator }
                  ].map(tab => (
                     <button
                        key={tab.id} onClick={() => setActiveTab(tab.id as CashierTab)}
                        className={`w-full flex items-center gap-6 px-8 py-5 rounded-[2rem] transition-all group ${activeTab === tab.id ? 'bg-emerald-600 shadow-2xl shadow-emerald-900/30 ring-1 ring-emerald-400/20 active:scale-95' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                     >
                        <tab.icon className={`w-6 h-6 transition-transform ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                        <span className="text-[12px] font-black uppercase tracking-[0.3em] leading-none">{tab.label}</span>
                     </button>
                  ))}
               </nav>

               <div className="mt-auto pt-10 border-t border-white/5">
                  <div className="flex items-center gap-5 px-5 mb-10">
                     <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-500 font-black text-xl shadow-inner border border-white/5">{profile.name.charAt(0)}</div>
                     <div className="min-w-0"><p className="text-sm font-black truncate text-white italic leading-none">{profile.name}</p><p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 opacity-50">Active Agent</p></div>
                  </div>
                  <button onClick={onLogout} className="w-full flex items-center gap-6 px-8 py-5 rounded-[2rem] text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all group">
                     <LogOut className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" /><span className="text-[12px] font-black uppercase tracking-widest">End Session</span>
                  </button>
               </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 backdrop-blur-sm relative overflow-hidden">
               <header className="bg-white/80 backdrop-blur-2xl border-b border-slate-200 px-16 py-10 sticky top-0 z-20 flex items-center justify-between shadow-sm">
                  <div>
                     <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
                        {activeTab === 'INSIGHT' ? 'DIAGNOSTIC STRATAGEM' :
                           activeTab === 'PENDING' ? 'QUEUE VERIFICATION' :
                              activeTab === 'ORDERS' ? 'CRYPTOGRAPHIC LEDGER' : 'SETTLEMENT PROTOCOL'}
                     </h1>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.5em] mt-1 leading-none">Authorization Level 4 • Station 202</p>
                  </div>
                  <div className="flex items-center gap-4">
                     {loading && <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-full border border-emerald-100 flex items-center gap-3 shadow-xl shadow-emerald-900/5 animate-in slide-in-from-right-4"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-[10px] font-black uppercase tracking-widest">Master-Sync Active</span></div>}
                  </div>
               </header>
               <div className="p-16 max-w-7xl mx-auto w-full flex-1">
                  {activeTab === 'INSIGHT' ? renderDesktopDashboard() :
                     activeTab === 'PENDING' ? renderDesktopRequests() :
                        activeTab === 'ORDERS' ? renderDesktopHistory() :
                           renderDesktopSummary()}
               </div>
            </main>
         </div>

         {/* 📱 MOBILE VIEW (lg:hidden) */}
         <div className="lg:hidden flex flex-col min-h-screen pb-24">
            <header className="bg-white px-6 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20 shadow-sm">
               <Logo size="md" />
               <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shadow-inner">{profile.name.charAt(0)}</div>
            </header>
            <main className="flex-1 px-5 py-10 max-w-lg mx-auto w-full">{renderMobileControl()}</main>

            <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-2xl border-t border-slate-100 px-6 py-6 flex items-center justify-between z-40 pb-safe shadow-[0_-15px_40px_rgba(0,0,0,0.08)]">
               {[
                  { id: 'PENDING', icon: AlertCircle, label: 'Queue' },
                  { id: 'ORDERS', icon: Receipt, label: 'Ledger' },
                  { id: 'INSIGHT', icon: LayoutDashboard, label: 'Insight' },
                  { id: 'SUMMARY', icon: LayoutGrid, label: 'Admin' }
               ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as CashierTab)} className={`flex flex-col items-center gap-2 transition-all ${activeTab === tab.id ? 'text-emerald-600 scale-110 font-black' : 'text-slate-400'}`}>
                     <div className={`p-2.5 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-emerald-50 shadow-inner ring-1 ring-emerald-500/10' : 'bg-transparent'}`}><tab.icon className="w-5 h-5" /></div>
                     <span className="text-[9px] font-black uppercase tracking-widest leading-none">{tab.label}</span>
                  </button>
               ))}
            </nav>
         </div>

         {/* 🔴 OVERLAY SYNC */}
         {loading && !pendingOrders.length && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center gap-10">
               <div className="relative group">
                  <div className="w-32 h-32 border-[12px] border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin transition-all group-hover:scale-110" />
                  <div className="absolute inset-0 flex items-center justify-center"><ShieldCheck className="w-12 h-12 text-emerald-500 animate-pulse" /></div>
               </div>
               <div className="text-center space-y-3 px-10">
                  <h3 className="text-white font-black uppercase tracking-[0.8em] text-xs italic leading-none">Initializing Stratagem</h3>
                  <p className="text-emerald-500/50 font-black text-[10px] uppercase tracking-widest animate-pulse leading-none">Syncing Decentralized Terminal Engine...</p>
               </div>
            </div>
         )}
      </div>
   );
};

export default CashierView;
