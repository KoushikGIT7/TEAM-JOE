import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogOut, CheckCircle, Clock, Banknote, RefreshCw, Search, LayoutDashboard, 
  FileText, BarChart3, Settings, X, AlertCircle, TrendingUp, DollarSign,
  Receipt, Download, Calendar, Filter, Menu, PieChart as PieIcon, Image as ImageIcon,
  Calculator, TrendingDown, ArrowUpRight, ChevronRight, User, ShieldCheck, Mail
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToPendingCashOrders, confirmCashPayment, rejectCashPayment, listenToAllOrders } from '../../services/firestore-db';
import { offlineDetector } from '../../utils/offlineDetector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchReport, exportReport, ExportFormat } from '../../services/reporting';

interface CashierViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

type CashierTab = 'Dashboard' | 'CashRequests' | 'AllOrders' | 'DailySummary' | 'Reports' | 'Settings';

const COLORS = ['#D4AF37', '#1E293B', '#64748B', '#94A3B8']; // Hotel Gold and Slates

const CashierView: React.FC<CashierViewProps> = ({ profile, onLogout }) => {
  const [activeTab, setActiveTab] = useState<CashierTab>('CashRequests');
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reportStart, setReportStart] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportEnd, setReportEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'SUCCESS'>('ALL');
  const [filterPayment, setFilterPayment] = useState<'ALL' | 'CASH' | 'ONLINE'>('ALL');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  console.log('🎬 CashierView rendered | activeTab =', activeTab);

  useEffect(() => {
    const unsubs = [
      listenToPendingCashOrders((data) => {
        setPendingOrders(data);
        setLoading(false);
        // Record ping for offline detector
        offlineDetector.recordPing();
      }),
      listenToAllOrders((data) => {
        setAllOrders(data);
        offlineDetector.recordPing();
      })
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      setReportLoading(true);
      try {
        const start = new Date(reportStart);
        const end = new Date(reportEnd);
        const data = await fetchReport({ role: 'cashier', start, end });
        setReportData(data);
      } catch (err) {
        console.error('Report load error:', err);
        setReportData(null);
      } finally {
        setReportLoading(false);
      }
    };
    loadReport();
  }, [reportStart, reportEnd]);


  const handleConfirm = async (orderId: string) => {
    setConfirming(orderId);
    try {
      await confirmCashPayment(orderId, profile.uid);
      offlineDetector.recordPing();
    } catch (err: any) {
      alert(err.message || 'Failed to approve payment');
    } finally {
      setConfirming(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!confirm('Reject this cash payment request?')) return;
    setRejecting(orderId);
    try {
      await rejectCashPayment(orderId, profile.uid);
      offlineDetector.recordPing();
      alert('Order Rejected');
    } catch (err: any) {
      alert(err.message || 'Failed to reject payment');
    } finally {
      setRejecting(null);
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const hasReportData = reportData && reportData.orders && reportData.orders.length > 0;

  const handleExport = async (format: ExportFormat) => {
    if (!reportData || !hasReportData) return;
    await exportReport(reportData, { typeLabel: 'Daily', format });
  };

  // Dashboard metrics
  const dashboardStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = allOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime() && o.paymentStatus === 'SUCCESS';
    });

    const cashOrders = todayOrders.filter(o => o.paymentType === 'CASH');
    const cashCollected = cashOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const avgOrderValue = todayOrders.length > 0 
      ? todayOrders.reduce((sum, o) => sum + o.totalAmount, 0) / todayOrders.length 
      : 0;

    // Hourly breakdown
    const hourlyData = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, orders: 0, cash: 0 }));
    todayOrders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      hourlyData[hour].orders++;
      if (o.paymentType === 'CASH') {
        hourlyData[hour].cash += o.totalAmount;
      }
    });

    const paymentSplit = [
      { name: 'Cash', value: cashCollected },
      { name: 'Online', value: todayOrders.filter(o => o.paymentType !== 'CASH').reduce((sum, o) => sum + o.totalAmount, 0) }
    ];

    return {
      todayCashCollected: cashCollected,
      ordersToday: todayOrders.length,
      pendingApprovals: pendingOrders.length,
      avgOrderValue,
      hourlyData: hourlyData.filter(h => h.orders > 0 || (parseInt(h.hour) >= 7 && parseInt(h.hour) <= 22)),
      paymentSplit
    };
  }, [allOrders, pendingOrders]);

  const SidebarItem: React.FC<{ tab: CashierTab; icon: React.FC<any>; label: string }> = ({ tab, icon: Icon, label }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => { setActiveTab(tab); setIsSidebarOpen(false); }}
        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
          isActive 
            ? 'bg-[#D4AF37] text-white shadow-[0_10px_25px_rgba(212,175,55,0.3)]' 
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'} transition-transform duration-300`}>
          {label}
        </span>
      </button>
    );
  };

  // Daily Summary
  const dailySummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = allOrders.filter(o => {
      const orderDate = new Date(o.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });

    const cashOrders = todayOrders.filter(o => o.paymentType === 'CASH' && o.paymentStatus === 'SUCCESS');
    const onlineOrders = todayOrders.filter(o => o.paymentType !== 'CASH' && o.paymentStatus === 'SUCCESS');
    
    const expectedCash = cashOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const actualCash = expectedCash; // In real system, this would come from cash register
    const difference = actualCash - expectedCash;

    const totalCashOrders = cashOrders.length;
    const avgCashOrder = totalCashOrders > 0 ? expectedCash / totalCashOrders : 0;
    const highestOrder = cashOrders.length > 0 
      ? Math.max(...cashOrders.map(o => o.totalAmount))
      : 0;

    return {
      expectedCash,
      actualCash,
      difference,
      totalCashOrders,
      avgCashOrder,
      highestOrder,
      totalOrders: todayOrders.length,
      onlineRevenue: onlineOrders.reduce((sum, o) => sum + o.totalAmount, 0)
    };
  }, [allOrders]);

  // Filtered orders for All Orders tab
  const filteredOrders = useMemo(() => {
    let filtered = allOrders;

    if (search) {
      filtered = filtered.filter(o => 
        o.userName.toLowerCase().includes(search.toLowerCase()) || 
        o.id.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (filterStatus !== 'ALL') {
      if (filterStatus === 'PENDING') {
        filtered = filtered.filter(o => o.paymentStatus === 'PENDING');
      } else {
        filtered = filtered.filter(o => o.paymentStatus === 'SUCCESS');
      }
    }

    if (filterPayment !== 'ALL') {
      filtered = filtered.filter(o => o.paymentType === filterPayment);
    }

    return filtered.slice().reverse();
  }, [allOrders, search, filterStatus, filterPayment]);

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Big Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-2xl p-6 border-4 border-primary shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8 text-primary" />
            <span className="text-xs font-black text-textSecondary uppercase">Today</span>
          </div>
          <p className="text-xs font-black text-textSecondary uppercase mb-2">Today Cash Collected</p>
          <p className="text-3xl font-black text-primary">₹{dashboardStats.todayCashCollected.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border-4 border-green-500 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-8 h-8 text-green-600" />
            <span className="text-xs font-black text-textSecondary uppercase">Live</span>
          </div>
          <p className="text-xs font-black text-textSecondary uppercase mb-2">Orders Today</p>
          <p className="text-3xl font-black text-green-600">{dashboardStats.ordersToday}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border-4 border-amber-500 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-8 h-8 text-amber-600" />
            <span className="bg-amber-100 text-amber-600 px-2 py-1 rounded-full text-xs font-black">{dashboardStats.pendingApprovals}</span>
          </div>
          <p className="text-xs font-black text-textSecondary uppercase mb-2">Pending Cash Approvals</p>
          <p className="text-3xl font-black text-amber-600">{dashboardStats.pendingApprovals}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border-4 border-blue-500 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <span className="text-xs font-black text-textSecondary uppercase">Avg</span>
          </div>
          <p className="text-xs font-black text-textSecondary uppercase mb-2">Avg Order Value</p>
          <p className="text-3xl font-black text-blue-600">₹{Math.round(dashboardStats.avgOrderValue)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
          <h3 className="text-lg font-black text-textMain mb-6 uppercase">Orders Per Hour</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardStats.hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#F59E0B" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
          <h3 className="text-lg font-black text-textMain mb-6 uppercase">Cash vs Online Split</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardStats.paymentSplit}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                >
                  {dashboardStats.paymentSplit.map((entry, index) => (
                    <Cell key={`payment-split-cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCashRequests = () => (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 📊 Header Metric */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2rem] p-8 shadow-2xl shadow-amber-200 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black uppercase tracking-tight">Active Requests</h2>
            <p className="text-amber-100 font-bold text-sm opacity-90">Verify and confirm individual user cash payments</p>
          </div>
          <div className="flex items-center gap-4 bg-white/20 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/20">
            <div className="relative">
              <Banknote className="w-10 h-10 text-white" />
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full animate-ping" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Awaiting</p>
              <p className="text-4xl font-black leading-none">{pendingOrders.length}</p>
            </div>
          </div>
        </div>
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-amber-600 font-black uppercase text-xs tracking-[0.2em]">Syncing Orders...</p>
        </div>
      ) : pendingOrders.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-16 text-center border-4 border-dashed border-gray-100 flex flex-col items-center">
          <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-16 h-16 text-green-300" />
          </div>
          <p className="text-2xl font-black text-gray-900 mb-2">Queue is Clear!</p>
          <p className="text-gray-400 font-medium max-w-xs">There are no pending cash payments at this moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {pendingOrders.map((order, idx) => (
            <div 
              key={order.id} 
              className="group bg-white rounded-[2.5rem] border-2 border-gray-100 hover:border-amber-400 p-6 sm:p-8 shadow-xl hover:shadow-2xl transition-all duration-300 relative overflow-hidden animate-in slide-in-from-right-4 duration-500"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
                {/* 🏷️ Order Identity */}
                <div className="flex-shrink-0 w-full lg:w-48">
                  <div className="bg-gray-900 text-white p-5 rounded-[2rem] shadow-lg relative h-32 flex flex-col justify-center text-center overflow-hidden">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 relative z-10">ORDER NO</p>
                    <p className="text-3xl font-black relative z-10 whitespace-nowrap">
                      #{order.id.slice(-8).toUpperCase()}
                    </p>
                    {/* Visual pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_2px_2px,_rgba(255,255,255,0.2)_1px,_transparent_0)] bg-[size:12px_12px]" />
                  </div>
                </div>

                {/* 👤 User & Total */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center border-2 border-amber-200">
                      <span className="text-amber-700 font-black text-lg">
                        {order.userName?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-black text-gray-900 truncate">{order.userName}</h3>
                      <p className="text-sm font-bold text-gray-400 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        Requested {formatTime(order.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {order.items.map(item => (
                        <span key={item.id} className="bg-white px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-black text-gray-600 flex items-center gap-2">
                          <span className="text-amber-500">x{item.quantity}</span>
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 💰 Value & Actions */}
                <div className="flex flex-col items-center lg:items-end gap-6 w-full lg:w-auto">
                  <div className="text-center lg:text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Due Amount</p>
                    <p className="text-5xl font-black text-gray-900">₹{order.totalAmount}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button
                      onClick={() => handleConfirm(order.id)}
                      disabled={!!confirming || !!rejecting}
                      className="flex-1 lg:min-w-[200px] bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-black py-5 px-8 rounded-3xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-[0_10px_30px_rgba(34,197,94,0.3)] hover:shadow-[0_15px_40px_rgba(34,197,94,0.4)]"
                    >
                      {confirming === order.id ? (
                        <RefreshCw className="animate-spin w-6 h-6" />
                      ) : (
                        <><CheckCircle className="w-6 h-6" /> CONFIRM</>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(order.id)}
                      disabled={!!confirming || !!rejecting}
                      className="bg-red-50 hover:bg-red-100 text-red-600 font-black px-6 py-5 rounded-3xl transition-all active:scale-95 disabled:opacity-50 border-2 border-red-100 flex items-center justify-center gap-2"
                      title="Reject payment"
                    >
                      {rejecting === order.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Awaiting Verification</span>
                </div>
                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                  Secure Peer-to-Peer Cash
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAllOrders = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-textSecondary" />
            <input 
              type="text" 
              placeholder="Search order ID or student name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl py-3 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="SUCCESS">Paid</option>
            </select>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value as any)}
              className="bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider focus:ring-2 focus:ring-primary/20 outline-none"
            >
              <option value="ALL">All Payment</option>
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-textSecondary uppercase tracking-wider">Order #</th>
                <th className="px-6 py-4 text-xs font-black text-textSecondary uppercase tracking-wider">Payment</th>
                <th className="px-6 py-4 text-xs font-black text-textSecondary uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-black text-textSecondary uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-textSecondary uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-textSecondary">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-black text-textMain">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-textSecondary">{order.userName}</p>
                    <p className="text-[10px] text-textSecondary">Created: {formatTime(order.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        order.paymentType === 'CASH' 
                          ? 'bg-amber-100 text-amber-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {order.paymentType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-black text-textMain">₹{order.totalAmount}</p>
                      {order.paymentStatus === 'SUCCESS' && order.confirmedAt && (
                        <p className="text-[10px] text-green-600 font-black mt-1">Approved: {formatTime(order.confirmedAt)}</p>
                      )}
                      {order.paymentStatus === 'REJECTED' && order.rejectedAt && (
                        <p className="text-[10px] text-red-600 font-black mt-1">Rejected: {formatTime(order.rejectedAt)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        order.paymentStatus === 'SUCCESS'
                          ? 'bg-green-100 text-green-600'
                          : order.paymentStatus === 'PENDING'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {order.paymentStatus === 'SUCCESS' ? 'PAID' : order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-textSecondary">
                        {new Date(order.createdAt).toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDailySummary = () => (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* 🧾 MAIN RECONCILIATION CARD */}
      <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-gray-100 shadow-2xl relative overflow-hidden">
        {/* Background Decorative Gradient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-bl-[10rem] -mr-16 -mt-16 opacity-50" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-amber-500 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-200">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Shift Balance</h2>
              <p className="text-gray-400 font-bold text-sm">Automated cash reconciliation logic</p>
            </div>
          </div>
          <button 
            onClick={() => handleExport('pdf')}
            disabled={!hasReportData || reportLoading}
            className="bg-[#D4AF37] text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#B8860B] transition-all active:scale-95 shadow-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Audit
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12 relative z-10">
          <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-100 group hover:bg-white hover:shadow-xl transition-all">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Expected In Drawer</p>
            <p className="text-4xl font-black text-gray-900">₹{dailySummary.expectedCash.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-4 text-[10px] font-black text-green-600 uppercase">
              <TrendingUp className="w-3 h-3" /> From {dailySummary.totalCashOrders} Orders
            </div>
          </div>

          <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-100 group hover:bg-white hover:shadow-xl transition-all">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Actual Recorded</p>
            <p className="text-4xl font-black text-gray-900">₹{dailySummary.actualCash.toLocaleString()}</p>
            <p className="mt-4 text-[10px] font-black text-gray-400 uppercase italic">Updating Real-time</p>
          </div>

          <div className={`rounded-[2rem] p-8 shadow-inner ${dailySummary.difference === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center sm:text-left">Settlement Variance</p>
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <p className={`text-4xl font-black ${dailySummary.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dailySummary.difference >= 0 ? '+' : ''}₹{Math.abs(dailySummary.difference).toLocaleString()}
              </p>
              {dailySummary.difference !== 0 ? (
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-bounce">
                  <TrendingDown className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <CheckCircle className="w-5 h-5" />
                </div>
              )}
            </div>
            <p className={`mt-4 text-[10px] font-black uppercase text-center sm:text-left ${dailySummary.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dailySummary.difference === 0 ? 'Perfectly Balanced' : 'Action Required: Verify Loose Cash'}
            </p>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-8 bg-gray-900 rounded-[2.5rem] shadow-2xl">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Avg Value</p>
            <p className="text-2xl font-black text-white">₹{Math.round(dailySummary.avgCashOrder)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Highest Swell</p>
            <p className="text-2xl font-black text-white">₹{dailySummary.highestOrder}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cash Volume</p>
            <p className="text-2xl font-black text-white">{dailySummary.totalCashOrders}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Txns</p>
            <p className="text-2xl font-black text-white">{dailySummary.totalOrders}</p>
          </div>
        </div>
      </div>

      {/* 💡 Information Note */}
      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-amber-500 shadow-sm shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black text-amber-800 uppercase tracking-wider">Note for Management</p>
          <p className="text-xs text-amber-700 font-bold opacity-80 leading-relaxed">
            Reconciliation data is updated instantly as orders are confirmed. For manual discrepancies, 
            please record them in the Audit Log under Settings.
          </p>
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-textMain uppercase">Cashier Reports</h2>
            <p className="text-sm text-textSecondary">Daily cash collection, approvals vs rejects</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            {(['pdf','csv','xlsx','png','json'] as ExportFormat[]).map(f => (
            <button
                key={f}
                onClick={() => handleExport(f)}
                disabled={!hasReportData || reportLoading}
                className="px-4 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {f.toUpperCase()}
            </button>
          ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div>
            <p className="text-[10px] font-black text-textSecondary uppercase mb-1">From</p>
            <input type="date" value={reportStart} onChange={e => setReportStart(e.target.value)} className="w-full bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-sm font-bold" />
          </div>
          <div>
            <p className="text-[10px] font-black text-textSecondary uppercase mb-1">To</p>
            <input type="date" value={reportEnd} onChange={e => setReportEnd(e.target.value)} className="w-full bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-sm font-bold" />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-black text-textSecondary uppercase mb-1">Total Revenue</p>
            <p className="text-2xl font-black text-textMain">₹{reportData?.summary?.totalRevenue?.toLocaleString() || 0}</p>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-black text-textSecondary uppercase mb-1">Approved / Rejected</p>
            <p className="text-xl font-black text-textMain">{reportData?.summary?.approvedCount || 0} / {reportData?.summary?.rejectedCount || 0}</p>
          </div>
        </div>

        {reportLoading && (
          <div className="py-10 flex justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!reportLoading && (!reportData || !hasReportData) && (
          <div className="py-10 text-center text-textSecondary font-bold">No records found for selected period</div>
        )}

        {!reportLoading && hasReportData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-black text-textSecondary uppercase mb-3">Revenue Trend</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#0F9D58" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-black text-textSecondary uppercase mb-3">Item Sales</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.itemSales.slice(0,8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="quantity" fill="#F59E0B" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <h3 className="text-sm font-black text-textSecondary uppercase mb-3">Payment Split</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={reportData.paymentSplit} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                      {reportData.paymentSplit.map((_: any, idx: number) => (
                        <Cell key={idx} fill={['#0F9D58','#F59E0B','#6366F1'][idx % 3]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
        <h2 className="text-2xl font-black text-textMain mb-6 uppercase">Cashier Settings</h2>
        
        <div className="space-y-6">
          <div>
            <label className="text-xs font-black text-textSecondary uppercase mb-2 block">Printer Selection</label>
            <select className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none">
              <option>Default Printer</option>
              <option>Thermal Printer 01</option>
              <option>Receipt Printer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-black text-textSecondary uppercase mb-2 block">Receipt Format</label>
            <select className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none">
              <option>Standard Format</option>
              <option>Detailed Format</option>
              <option>Compact Format</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-black text-textSecondary uppercase mb-2 block">Language</label>
            <select className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none">
              <option>English</option>
              <option>Hindi</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-textSecondary uppercase mb-2 block">Shift Start</label>
              <input type="time" defaultValue="09:00" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="text-xs font-black text-textSecondary uppercase mb-2 block">Shift End</label>
              <input type="time" defaultValue="17:00" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleTabChange = (tab: CashierTab) => {
    console.log('🔄 Switching tab from', activeTab, 'to', tab);
    setActiveTab(tab);
    setIsSidebarOpen(false); // Close sidebar on mobile after tab change
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans">
      
      {/* 🏰 THE LUXURY SIDEBAR */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] transform transition-transform duration-500 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col p-8">
          {/* Logo / Brand */}
          <div className="flex items-center gap-4 mb-16">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)]">
               <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter leading-none">GRAND HOTEL</h1>
              <p className="text-[9px] font-black text-[#D4AF37] uppercase tracking-[0.3em]">Cashier Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            <SidebarItem tab="CashRequests" icon={Banknote} label="Pending Cash" />
            <SidebarItem tab="Dashboard" icon={LayoutDashboard} label="Insight Deck" />
            <SidebarItem tab="AllOrders" icon={Receipt} label="Transaction Log" />
            <SidebarItem tab="DailySummary" icon={Calculator} label="Shift Balance" />
            <SidebarItem tab="Reports" icon={BarChart3} label="Audit Reports" />
            <SidebarItem tab="Settings" icon={Settings} label="Preferences" />
          </nav>

          {/* User Profile / Logout */}
          <div className="mt-auto pt-8 border-t border-white/5">
            <div className="flex items-center gap-4 px-2 mb-6">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[#D4AF37] font-black">
                {profile.name?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">{profile.name}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{profile.uid.slice(0, 8)}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-400 hover:text-white hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
            >
              <LogOut className="w-5 h-5 text-red-500" />
              <span className="text-[11px] font-black uppercase tracking-widest">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
      {/* 🚀 MAIN STAGE */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-slate-50">
        
        {/* Header / Top Nav */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => setIsSidebarOpen(true)}
                 className="lg:hidden p-2 -ml-2 text-slate-600"
               >
                 <Menu className="w-6 h-6" />
               </button>
               <div className="flex flex-col">
                  <h2 className="text-base font-black text-slate-900 uppercase tracking-tight italic">
                    {activeTab === 'Dashboard' ? 'Strategic Insight' : 
                     activeTab === 'CashRequests' ? 'Real-time Requests' :
                     activeTab === 'AllOrders' ? 'Global Ledger' :
                     activeTab === 'DailySummary' ? 'Shift Reconciliation' :
                     activeTab === 'Reports' ? 'Analytical Audit' : 'Management'}
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operational Console</p>
               </div>
            </div>

            <div className="flex items-center gap-6">
               <div className="hidden md:flex flex-col text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Shift Status</p>
                  <p className="text-xs font-black text-green-600 flex items-center justify-end gap-1.5 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live & Protected
                  </p>
               </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-7xl mx-auto pb-12">
            {activeTab === 'Dashboard' && renderDashboard()}
            {activeTab === 'CashRequests' && renderCashRequests()}
            {activeTab === 'AllOrders' && renderAllOrders()}
            {activeTab === 'DailySummary' && renderDailySummary()}
            {activeTab === 'Reports' && renderReports()}
            {activeTab === 'Settings' && renderSettings()}
          </div>
          
          {/* Subtle noise pattern overlay */}
          <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50" />
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default CashierView;
