
import React, { useState, useEffect, useMemo } from 'react';
import { 
  LogOut, CheckCircle, Clock, Banknote, RefreshCw, Search, LayoutDashboard, 
  FileText, BarChart3, Settings, X, AlertCircle, TrendingUp, DollarSign,
  Receipt, Download, Calendar, Filter, Menu, PieChart as PieIcon, Image as ImageIcon
} from 'lucide-react';
import { UserProfile, Order } from '../../types';
import { listenToPendingCashOrders, confirmCashPayment, rejectCashPayment, listenToAllOrders } from '../../services/firestore-db';
import Logo from '../../components/Logo';
import { offlineDetector } from '../../utils/offlineDetector';
import SyncStatus from '../../components/SyncStatus';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchReport, exportReport, ExportFormat } from '../../services/reporting';

interface CashierViewProps {
  profile: UserProfile;
  onLogout: () => void;
}

type CashierTab = 'Dashboard' | 'CashRequests' | 'AllOrders' | 'DailySummary' | 'Reports' | 'Settings';

const COLORS = ['#F59E0B', '#10B981', '#6366F1', '#EC4899'];

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
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-6 border-4 border-amber-500 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-black text-textMain uppercase">Cash Requests</h2>
          <span className="bg-amber-100 text-amber-600 px-4 py-2 rounded-full text-sm font-black">
            {pendingOrders.length} Pending
          </span>
        </div>
        <p className="text-sm text-textSecondary">Real-time cash payment approvals</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : pendingOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
          <Banknote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-black text-textSecondary">No Pending Cash Payments</p>
          <p className="text-sm text-textSecondary mt-2">All payments are confirmed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingOrders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-6 border-4 border-amber-400 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="bg-black text-white px-4 py-2 rounded-xl inline-block mb-2">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-300 mb-1">ORDER NO</p>
                    <p className="text-xl font-black">#{order.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <p className="text-sm font-bold text-textSecondary mt-2">Student: {order.userName}</p>
                  <p className="text-sm font-bold text-textSecondary">Payment: <span className="text-cash font-black">CASH</span></p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-primary">₹{order.totalAmount}</p>
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-black justify-end mt-2">
                    <Clock className="w-4 h-4" />
                    AWAITING
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                <p className="text-xs font-black text-textSecondary uppercase mb-2">Items:</p>
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-textMain font-medium">• {item.name}</span>
                    <span className="font-black text-textMain">x{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirm(order.id)}
                  disabled={!!confirming || !!rejecting}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                >
                  {confirming === order.id ? <RefreshCw className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                  APPROVE CASH
                </button>
                <button
                  onClick={() => handleReject(order.id)}
                  disabled={!!confirming || !!rejecting}
                  className="px-6 bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-lg"
                >
                  {rejecting === order.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <X className="w-5 h-5" />}
                  REJECT
                </button>
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-8 border-4 border-primary shadow-lg">
        <h2 className="text-2xl font-black text-textMain mb-6 uppercase">Cash Reconciliation</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6">
          <div className="bg-gray-50 rounded-xl p-6">
            <p className="text-xs font-black text-textSecondary uppercase mb-2">Expected Cash</p>
            <p className="text-3xl font-black text-textMain">₹{dailySummary.expectedCash.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-6">
            <p className="text-xs font-black text-textSecondary uppercase mb-2">Actual Cash</p>
            <p className="text-3xl font-black text-textMain">₹{dailySummary.actualCash.toLocaleString()}</p>
          </div>
          <div className={`rounded-xl p-6 ${dailySummary.difference === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs font-black text-textSecondary uppercase mb-2">Difference</p>
            <p className={`text-3xl font-black ${dailySummary.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dailySummary.difference >= 0 ? '+' : ''}₹{Math.abs(dailySummary.difference).toLocaleString()}
            </p>
            {dailySummary.difference !== 0 && (
              <AlertCircle className="w-6 h-6 text-red-600 mt-2" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
          <div>
            <p className="text-xs font-black text-textSecondary uppercase mb-1">Total Cash Orders</p>
            <p className="text-xl font-black text-textMain">{dailySummary.totalCashOrders}</p>
          </div>
          <div>
            <p className="text-xs font-black text-textSecondary uppercase mb-1">Avg Cash Order</p>
            <p className="text-xl font-black text-textMain">₹{Math.round(dailySummary.avgCashOrder)}</p>
          </div>
          <div>
            <p className="text-xs font-black text-textSecondary uppercase mb-1">Highest Order</p>
            <p className="text-xl font-black text-textMain">₹{dailySummary.highestOrder}</p>
          </div>
          <div>
            <p className="text-xs font-black text-textSecondary uppercase mb-1">Total Orders</p>
            <p className="text-xl font-black text-textMain">{dailySummary.totalOrders}</p>
          </div>
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

  const navItems = [
    { id: 'Dashboard', icon: LayoutDashboard },
    { id: 'CashRequests', icon: Banknote },
    { id: 'AllOrders', icon: FileText },
    { id: 'DailySummary', icon: BarChart3 },
    { id: 'Reports', icon: Download },
    { id: 'Settings', icon: Settings },
  ] as const;

  const handleTabChange = (tab: CashierTab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false); // Close sidebar on mobile after tab change
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row relative">
      {/* Mobile Menu Modal */}
      {isSidebarOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Mobile Sidebar */}
          <div className="fixed inset-y-0 left-0 w-64 bg-white z-50 lg:hidden flex flex-col shadow-xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <Logo size="md" />
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-textSecondary" />
              </button>
            </div>
            
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id as CashierTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-black text-sm uppercase tracking-wider ${
                    activeTab === item.id
                      ? 'bg-primary text-white shadow-lg'
                      : 'text-textSecondary hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{item.id === 'CashRequests' ? 'Cash Requests' : item.id}</span>
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all font-black text-sm uppercase tracking-wider"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="truncate">Logout</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar - Always visible on lg and above */}
      <aside className={`
        w-64 bg-white border-r border-gray-200 flex flex-col shrink-0
        hidden lg:flex
      `}>
        <div className="p-6 border-b border-gray-200">
          <Logo size="md" />
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id as CashierTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-black text-sm uppercase tracking-wider ${
                activeTab === item.id
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-textSecondary hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="truncate">{item.id === 'CashRequests' ? 'Cash Requests' : item.id}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all font-black text-sm uppercase tracking-wider"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="bg-white border-b border-gray-200 p-4 lg:p-6 sticky top-0 z-10">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Hamburger Menu Button - Mobile Only */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-textMain" />
              </button>
              
              <div className="min-w-0 flex-1">
                <h1 className="text-xl lg:text-2xl font-black text-textMain uppercase truncate">
                  {activeTab === 'CashRequests' ? 'Cash Requests' : activeTab}
                </h1>
                <p className="text-xs lg:text-sm text-textSecondary font-bold mt-1 truncate">
                  {activeTab === 'Dashboard' && 'Quick health check of cafeteria'}
                  {activeTab === 'CashRequests' && 'Real-time cash payment approvals'}
                  {activeTab === 'AllOrders' && 'Search & audit all orders'}
                  {activeTab === 'DailySummary' && 'Daily cash reconciliation'}
                  {activeTab === 'Reports' && 'Export reports and analytics'}
                  {activeTab === 'Settings' && 'Configure cashier preferences'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 lg:gap-4 shrink-0">
              <div className="hidden sm:block">
                <SyncStatus showLabel={true} />
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-xs font-black text-textSecondary uppercase">Cashier</p>
                <p className="text-sm font-black text-textMain truncate">{profile.name}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6">
          {activeTab === 'Dashboard' && renderDashboard()}
          {activeTab === 'CashRequests' && renderCashRequests()}
          {activeTab === 'AllOrders' && renderAllOrders()}
          {activeTab === 'DailySummary' && renderDailySummary()}
          {activeTab === 'Reports' && renderReports()}
          {activeTab === 'Settings' && renderSettings()}
        </div>
      </main>
    </div>
  );
};

export default CashierView;
