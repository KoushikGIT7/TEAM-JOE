import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogOut, CheckCircle, Clock, Banknote, RefreshCw, Search, LayoutDashboard, 
  FileText, BarChart3, Settings, X, AlertCircle, TrendingUp, DollarSign,
  Receipt, Download, Calendar, Filter, Menu, PieChart as PieIcon, Image as ImageIcon,
  Calculator, TrendingDown, ArrowUpRight, ChevronRight, ShieldCheck, LayoutGrid
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToPendingCashOrders, confirmCashPayment, rejectCashPayment, listenToAllOrders, listenToMenu } from '../../services/firestore-db';
import Logo from '../../components/Logo';
import { offlineDetector } from '../../utils/offlineDetector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchReport, exportReport, ExportFormat } from '../../services/reporting';
import SmartImage from '../../components/Common/SmartImage';
import { preloadImage } from '../../utils/image-optimizer';

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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // --- 📡 DATA LISTENERS ---
  useEffect(() => {
    const unsubs = [
      listenToPendingCashOrders((data) => {
        setPendingOrders(data);
        setLoading(false);
        offlineDetector.recordPing();
      }),
      listenToAllOrders((data) => {
        setAllOrders(data);
        offlineDetector.recordPing();
      }),
      // Proactive Catalog Accelerator: Warm up every item image in the cafeteria menu
      listenToMenu((items) => {
        items.forEach(it => {
          if (it.imageUrl) preloadImage(it.imageUrl);
        });
      })
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  // Real-time Queue Accelerator: Ensure incoming orders have hot image data
  useEffect(() => {
    [...pendingOrders, ...allOrders].forEach(o => {
      o.items.forEach(it => {
        if (it.imageUrl) preloadImage(it.imageUrl);
      });
    });
  }, [pendingOrders, allOrders]);

  // Background sync for Audit data (to ensure button works instantly)
  useEffect(() => {
    const loadReportData = async () => {
      try {
        const today = new Date();
        const start = new Date(today.setHours(0,0,0,0));
        const end = new Date(today.setHours(23,59,59,999));
        const data = await fetchReport({ role: 'cashier', start, end });
        setReportData(data);
      } catch (err) {
        console.error('Audit sync failed:', err);
      }
    };
    loadReportData();
  }, [allOrders]);

  // --- ⚙️ HANDLERS ---
  const handleConfirm = async (orderId: string) => {
    setConfirming(orderId);
    try {
      await confirmCashPayment(orderId, profile.uid);
      offlineDetector.recordPing();
    } catch (err: any) {
      alert(err.message || 'Failed to approve');
    } finally {
      setConfirming(null);
    }
  };

  const handleReject = async (orderId: string) => {
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
    await exportReport(reportData, { typeLabel: 'Daily Audit', format: 'pdf' });
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

  // --- 💻 DESKTOP COMPONENTS (ORIGINAL STYLE) ---
  const renderDesktopDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
          <DollarSign className="w-8 h-8 text-emerald-600 mb-4" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Today Cash</p>
          <p className="text-4xl font-black text-slate-900 italic">₹{stats.cash.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
           <Receipt className="w-8 h-8 text-blue-600 mb-4" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales</p>
           <p className="text-4xl font-black text-slate-900 italic">{stats.count}</p>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
           <AlertCircle className="w-8 h-8 text-amber-500 mb-4" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending Sync</p>
           <p className="text-4xl font-black text-slate-900 italic">{pendingOrders.length}</p>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
           <TrendingUp className="w-8 h-8 text-indigo-600 mb-4" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Avg Ticket</p>
           <p className="text-4xl font-black text-slate-900 italic">₹{Math.round(stats.avg)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Sales Velocity (Hourly)</h3>
            <div className="h-72">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourlyData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="hour" tick={{fontSize: 9, fontWeight: 800}} axisLine={false} tickLine={false} />
                     <YAxis tick={{fontSize: 9, fontWeight: 800}} axisLine={false} tickLine={false} />
                     <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)'}} cursor={{fill: '#f8fafc'}} />
                     <Bar dataKey="orders" fill="#10B981" radius={[8, 8, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Payment Distribution</h3>
            <div className="h-72">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={stats.paymentSplit} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value" nameKey="name">
                        {stats.paymentSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
          {pendingOrders.map(order => (
            <div key={order.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
               <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session #{order.id.slice(-8).toUpperCase()}</span>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">{order.userName}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-emerald-600 leading-none">₹{order.totalAmount}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest italic">{formatTime(order.createdAt)}</p>
                  </div>
               </div>
               <div className="flex flex-wrap gap-2 mb-8">
                  {order.items.map((it, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 flex items-center gap-2 pr-3 pl-1.5 py-1 rounded-xl">
                      <SmartImage src={it.imageUrl} alt={it.name} containerClassName="w-8 h-8 rounded-lg" />
                      <span className="text-xs font-black text-slate-600">
                        {it.quantity}x {it.name}
                      </span>
                    </div>
                  ))}
               </div>
               <div className="flex gap-4 relative z-10">
                  <button onClick={() => handleConfirm(order.id)} disabled={!!confirming} className="flex-1 bg-emerald-600 text-white font-black py-5 rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest shadow-xl shadow-emerald-900/20">
                    {confirming === order.id ? <RefreshCw className="w-6 h-6 animate-spin mx-auto" /> : "APPROVE PAYMENT"}
                  </button>
                  <button onClick={() => handleReject(order.id)} disabled={!!rejecting} className="bg-rose-50 text-rose-600 font-black px-6 py-5 rounded-2xl border border-rose-100 active:scale-95 transition-all">
                    <X className="w-6 h-6" />
                  </button>
               </div>
            </div>
          ))}
          {pendingOrders.length === 0 && (
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
                   <th className="px-10 py-5">Operator / User</th>
                   <th className="px-10 py-5">Method</th>
                   <th className="px-10 py-5">Status</th>
                   <th className="px-10 py-5 text-right">Settlement</th>
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
                <p className="text-sm font-bold opacity-70 mt-4 leading-relaxed uppercase tracking-widest">All protocols running. <br/>Database synced 0ms ago.</p>
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

  // --- 🧱 MOBILE COMPONENTS (SIMPLIFIED TERMINAL) ---
  const renderMobileControl = () => {
    switch(activeTab) {
      case 'PENDING': return (
        <div className="space-y-4 animate-in fade-in duration-300">
           <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 italic uppercase tracking-tight">Queue <span className="text-xs bg-rose-500 text-white px-2 rounded-full not-italic">{pendingOrders.length}</span></h2>
              <RefreshCw className={`w-4 h-4 text-emerald-500 ${loading ? 'animate-spin' : ''}`} />
           </div>
           {pendingOrders.map(order => (
             <div key={order.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-all">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <p className="text-[10px] font-bold text-slate-400">ID #{order.id.slice(-6).toUpperCase()}</p>
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">{order.userName}</h3>
                   </div>
                   <p className="text-2xl font-black text-emerald-600 italic">₹{order.totalAmount}</p>
                </div>
                <div className="flex gap-2 mb-5">
                   {order.items.slice(0, 4).map((it, idx) => (
                     <div key={idx} className="bg-slate-50 text-slate-500 pr-3 pl-1 py-1 rounded-xl text-[10px] font-black uppercase border border-slate-100 flex items-center gap-2 shrink-0">
                        <SmartImage src={it.imageUrl} alt={it.name} containerClassName="w-6 h-6 rounded-lg" />
                        <span>{it.quantity}x {it.name}</span>
                     </div>
                   ))}
                </div>
                <div className="flex gap-3">
                   <button onClick={() => handleConfirm(order.id)} disabled={!!confirming} className="flex-1 bg-emerald-600 text-white font-black py-4 rounded-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-xs tracking-widest shadow-lg shadow-emerald-50">
                      {confirming === order.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} CONFIRM CASH
                   </button>
                   <button onClick={() => handleReject(order.id)} disabled={!!rejecting} className="bg-rose-50 text-rose-500 px-5 rounded-xl border border-rose-100 active:scale-95"><X className="w-5 h-5" /></button>
                </div>
             </div>
           ))}
           {pendingOrders.length === 0 && <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px] italic">Queue Empty</div>}
        </div>
      );
      case 'ORDERS': return (
        <div className="space-y-4 animate-in fade-in duration-300">
           <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md pb-4 pt-2">
              <input type="text" placeholder="Search ledger..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl py-4 px-6 text-sm font-bold shadow-sm outline-none" />
           </div>
           {filteredOrders.slice(0, 20).map(order => (
             <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-50 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-none">{order.userName}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-widest">{formatTime(order.createdAt)} • {order.paymentType}</p>
                </div>
                <p className="text-md font-black text-slate-800 italic">₹{order.totalAmount}</p>
             </div>
           ))}
        </div>
      );
      case 'INSIGHT': return (
        <div className="space-y-6 animate-in fade-in duration-500">
           {/* Primary Visual Graph */}
           <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none">Hourly Velocity</h3>
                    <p className="text-md font-black text-slate-900 italic mt-1.5">Traffic Analysis</p>
                 </div>
                 <div className="bg-emerald-50 p-2 rounded-xl"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
              </div>
              
              <div className="h-56 w-full -ml-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.hourlyData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis 
                         dataKey="hour" 
                         tick={{fontSize: 8, fontWeight: 800, fill: '#94a3b8'}} 
                         axisLine={false} 
                         tickLine={false} 
                         dy={10}
                       />
                       <YAxis 
                         tick={{fontSize: 8, fontWeight: 800, fill: '#94a3b8'}} 
                         axisLine={false} 
                         tickLine={false}
                         width={30}
                       />
                       <Tooltip 
                         contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 900}} 
                         cursor={{fill: '#f8fafc'}} 
                       />
                       <Bar dataKey="orders" fill="#10B981" radius={[6, 6, 0, 0]} barSize={20} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* High-Impact Stats Cards */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[1.8rem] border border-slate-100 shadow-lg shadow-slate-200/30">
                 <div className="w-9 h-9 bg-blue-50 rounded-2xl flex items-center justify-center mb-4"><Receipt className="w-4 h-4 text-blue-600" /></div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Sales</p>
                 <p className="text-3xl font-black text-slate-900 italic mt-2 leading-none">{stats.count}</p>
                 <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter mt-2 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Live Feed</p>
              </div>
              
              <div className="bg-white p-5 rounded-[1.8rem] border border-slate-100 shadow-lg shadow-slate-200/30">
                 <div className="w-9 h-9 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4"><Calculator className="w-4 h-4 text-indigo-600" /></div>
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Avg Ticket</p>
                 <p className="text-3xl font-black text-emerald-600 italic mt-2 leading-none">₹{Math.round(stats.avg)}</p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-2">Per Session</p>
              </div>
           </div>

           {/* Trend Banner */}
           <div className="bg-[#111827] p-5 rounded-[1.8rem] text-white flex items-center justify-between border border-white/5 relative overflow-hidden">
              <div className="relative z-10">
                 <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-1">Session Target</p>
                 <h4 className="text-sm font-black italic uppercase">Operational Efficiency</h4>
              </div>
              <div className="relative z-10 text-right">
                 <p className="text-lg font-black italic">100%</p>
                 <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Active System</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent skew-x-12 translate-x-1/2" />
           </div>
        </div>
      );
      case 'SUMMARY': return (
        <div className="space-y-6 animate-in fade-in duration-300">
           <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
              <p className="text-[9px] font-black opacity-40 uppercase tracking-[0.4em] mb-4">Cash Position</p>
              <div className="flex items-baseline gap-2 mb-10">
                 <span className="text-xl font-black opacity-20">₹</span>
                 <p className="text-6xl font-black tracking-tighter leading-none italic">{stats.cash.toLocaleString()}</p>
              </div>
              <p className="text-[9px] font-black opacity-40 uppercase tracking-[0.2em]">Verified Terminal Ops</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
           </div>
           <div className="grid grid-cols-1 gap-3">
              <button onClick={handleAuditExport} className="w-full bg-emerald-600 text-white rounded-2xl py-6 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-4 active:scale-95 shadow-xl shadow-emerald-50">
                 <FileText className="w-5 h-5 text-emerald-200" /> DOWNLOAD DAILY PDF
              </button>
              <button onClick={onLogout} className="w-full bg-white text-rose-600 border border-slate-200 rounded-2xl py-5 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95">
                 <LogOut className="w-4 h-4" /> SIGN OUT
              </button>
           </div>
           <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest pt-4 opacity-50 italic">Agent ID: {profile.uid.slice(0, 12)}</p>
        </div>
      );
      default: return null;
    }
  };

  // --- 🎨 MAIN RENDER ---
  return (
    <div className="min-h-screen bg-slate-50/50 select-none font-sans text-slate-900">
      
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
