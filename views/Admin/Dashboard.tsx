import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users as UsersIcon, DollarSign, Menu as MenuIcon, Settings as SettingsIcon, LogOut, TrendingUp, ChefHat,
  Package, FileText, LayoutDashboard, Search, AlertCircle, 
  CheckCircle2, Activity, Trash2, Edit2, ShieldAlert,
  Loader2,
  Bell, Globe, Gauge, ShieldCheck, Plus, X as CloseIcon, 
  Percent, Wallet, Megaphone, CalendarDays, Zap, Save, ChevronRight,
  ArrowUpCircle, AlertTriangle, History, ArrowDownCircle, Banknote, Upload, Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { UserProfile, Order, MenuItem, SystemSettings, InventoryItem, InventoryMetaItem } from '../../types';
import { 
  listenToAllOrders, listenToMenu, listenToAllUsers,
  updateUserRole, toggleUserStatus, addMenuItem, updateMenuItem, deleteMenuItem,
  listenToSettings, updateSettings, listenToInventory, listenToInventoryMeta, updateInventoryItem,
  getDailyConsumptionByItem, getPopularMenuItems, initializeMenu
} from '../../services/firestore-db';
import { CATEGORIES } from '../../constants';
import Logo from '../../components/Logo';
import { fetchReport, exportReport, ExportFormat } from '../../services/reporting';
import { offlineDetector } from '../../utils/offlineDetector';
import AuditDownloadButton from '../../components/AuditDownloadButton';

const COLORS = ['#0F9D58', '#34D399', '#FBBF24', '#6B7280', '#EF4444'];

interface AdminDashboardProps {
  profile: UserProfile;
  onLogout: () => void;
  onOpenKitchen?: () => void;
}

type AdminTab = 'Overview' | 'Team' | 'Menu' | 'Inventory' | 'Settings' | 'Reports';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ profile, onLogout, onOpenKitchen }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('Overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryMeta, setInventoryMeta] = useState<InventoryMetaItem[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');
  const [dailyConsumption, setDailyConsumption] = useState<Record<string, number>>({});
  const [popularItems, setPopularItems] = useState<{ itemId: string; itemName?: string; quantity: number }[]>([]);
  const [reportStart, setReportStart] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportEnd, setReportEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  
  // Menu Modal State
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState<Omit<MenuItem, 'id'>>({
    name: '', price: 0, costPrice: 0, category: 'Breakfast', imageUrl: '', active: true
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Inventory Modal State
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(50);

  useEffect(() => {
    const unsubs = [
      listenToAllOrders((data) => {
        setOrders(data);
        offlineDetector.recordPing();
      }),
      listenToMenu((data) => {
        setMenuItems(data);
        offlineDetector.recordPing();
      }),
      listenToAllUsers((data) => {
        setUsers(data);
        offlineDetector.recordPing();
      }),
      listenToSettings((data) => {
        setSettings(data);
        offlineDetector.recordPing();
      }),
      listenToInventory((data) => {
        setInventory(data);
        offlineDetector.recordPing();
      }),
      listenToInventoryMeta((data) => {
        setInventoryMeta(data);
        offlineDetector.recordPing();
      })
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  useEffect(() => {
    getDailyConsumptionByItem().then(setDailyConsumption).catch(() => setDailyConsumption({}));
    getPopularMenuItems().then(setPopularItems).catch(() => setPopularItems([]));
    const t = setInterval(() => {
      getDailyConsumptionByItem().then(setDailyConsumption).catch(() => {});
      getPopularMenuItems().then(setPopularItems).catch(() => {});
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      setReportLoading(true);
      try {
        const start = new Date(reportStart);
        const end = new Date(reportEnd);
        const data = await fetchReport({ role: 'admin', start, end });
        setReportData(data);
      } catch (e) {
        console.error('Admin report load error', e);
        setReportData(null);
      } finally {
        setReportLoading(false);
      }
    };
    loadReport();
  }, [reportStart, reportEnd]);


  const stats = useMemo(() => {
    const s = new Date(reportStart); s.setHours(0,0,0,0);
    const e = new Date(reportEnd); e.setHours(23,59,59,999);
    
    const rangeOrders = orders.filter(o => {
      const ms = o.createdAt;
      return ms >= s.getTime() && ms <= e.getTime();
    });

    const isPaid = (p: string) => p === 'SUCCESS' || p === 'VERIFIED';
    const successOrders = orders.filter(o => isPaid(o.paymentStatus));
    const rangePaidOrders = rangeOrders.filter(o => isPaid(o.paymentStatus));
    
    const totalRevenue = successOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const periodRevenue = rangePaidOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    
    const totalCost = successOrders.reduce((acc, o) => {
      const itemsCost = o.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      return acc + itemsCost;
    }, 0);
    
    const peakHours = new Array(24).fill(0).map((_, i) => ({ hour: `${i}:00`, orders: 0, revenue: 0 }));
    rangeOrders.forEach(o => {
      const hour = new Date(o.createdAt).getHours();
      peakHours[hour].orders++;
      if (isPaid(o.paymentStatus)) {
        peakHours[hour].revenue += o.totalAmount;
      }
    });

    const categoryData: Record<string, number> = {};
    const itemPopularity: Record<string, number> = {};
    rangePaidOrders.forEach(o => {
      o.items.forEach(item => {
        categoryData[item.category || 'Uncategorized'] = (categoryData[item.category || 'Uncategorized'] || 0) + (item.price * item.quantity);
        itemPopularity[item.name || 'Unknown'] = (itemPopularity[item.name || 'Unknown'] || 0) + item.quantity;
      });
    });

    // Top selling items
    const topItems = Object.entries(itemPopularity)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Period Payment split (for the range)
    const rangeCashRevenue = rangePaidOrders.filter(o => o.paymentType === 'CASH').reduce((acc, o) => acc + o.totalAmount, 0);
    const rangeOnlineRevenue = rangePaidOrders.filter(o => o.paymentType !== 'CASH').reduce((acc, o) => acc + o.totalAmount, 0);

    // Avg order value for the range
    const avgOrderValue = rangePaidOrders.length > 0 ? periodRevenue / rangePaidOrders.length : 0;

    // Weekly comparison (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === date.getTime() && isPaid(o.paymentStatus);
      });
      weeklyData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue: dayOrders.reduce((sum, o) => sum + o.totalAmount, 0),
        orders: dayOrders.length
      });
    }

    return {
      totalRevenue,
      periodRevenue,
      totalPnL: totalRevenue - totalCost,
      totalOrders: orders.length,
      periodOrders: rangePaidOrders.length,
      peakHours: peakHours.filter(h => h.orders > 0 || (parseInt(h.hour) >= 7 && parseInt(h.hour) <= 22)),
      chartData: Object.entries(categoryData).map(([name, value]) => ({ name, value })),
      topItems,
      paymentSplit: [
        { name: 'Cash', value: rangeCashRevenue },
        { name: 'Online', value: rangeOnlineRevenue }
      ],
      avgOrderValue,
      weeklyData,
      cashPercentage: periodRevenue > 0 ? (rangeCashRevenue / periodRevenue) * 100 : 0
    };
  }, [orders, reportStart, reportEnd]);

  const handleSaveMenuItem = async () => {
    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, menuForm);
      } else {
        await addMenuItem(menuForm);
      }
      offlineDetector.recordPing();
      setShowMenuModal(false);
      setEditingItem(null);
      setMenuForm({ name: '', price: 0, costPrice: 0, category: 'Breakfast', imageUrl: '', active: true });
      setImagePreview(null);
    } catch (err) {
      alert("Failed to save menu item");
    }
  };

  const handleRestock = async () => {
    if (!selectedInventoryItem) return;
    try {
      await updateInventoryItem(selectedInventoryItem.itemId, {
        openingStock: selectedInventoryItem.openingStock + restockAmount
      });
      offlineDetector.recordPing();
      setShowRestockModal(false);
      setSelectedInventoryItem(null);
      setRestockAmount(50);
    } catch (err) {
      alert("Failed to update inventory");
    }
  };

  // Merge inventory + inventory_meta: prefer meta for totalStock/consumed (real-time from shards)
  const mergedInventory = useMemo((): InventoryItem[] => {
    const metaByItem: Record<string, InventoryMetaItem> = {};
    inventoryMeta.forEach((m) => { metaByItem[m.itemId] = m; });
    return inventory.map((inv) => {
      const meta = metaByItem[inv.itemId];
      return {
        ...inv,
        openingStock: meta ? meta.totalStock : inv.openingStock,
        consumed: meta ? meta.consumed : inv.consumed,
      };
    });
  }, [inventory, inventoryMeta]);

  const filteredInventory = useMemo(() => {
    return mergedInventory.filter(i => 
      i.itemName.toLowerCase().includes(inventorySearch.toLowerCase()) || 
      i.category.toLowerCase().includes(inventorySearch.toLowerCase())
    );
  }, [mergedInventory, inventorySearch]);

  const navItems = [
    { id: 'Overview', icon: LayoutDashboard },
    { id: 'Team', icon: UsersIcon },
    { id: 'Menu', icon: MenuIcon },
    { id: 'Inventory', icon: Package },
    { id: 'Reports', icon: FileText },
    { id: 'Settings', icon: SettingsIcon },
  ] as const;

  const hasReportData = reportData && reportData.orders && reportData.orders.length > 0;
  const handleExport = async (format: ExportFormat) => {
    if (!hasReportData || !reportData) return;
    await exportReport(reportData, { typeLabel: 'Admin', format });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 flex justify-between items-center">
        <Logo size="md" />
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-textSecondary hover:bg-gray-100 rounded-xl transition-all">
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 px-6 space-y-1 overflow-y-auto hide-scrollbar">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] transition-all font-black text-xs uppercase tracking-widest ${
              activeTab === item.id ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' : 'text-textSecondary hover:bg-gray-50'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.id}
          </button>
        ))}
        {onOpenKitchen && (
          <button
            onClick={() => { onOpenKitchen(); setIsSidebarOpen(false); }}
            className="w-full flex items-center gap-4 px-6 py-4 rounded-[1.25rem] transition-all font-black text-xs uppercase tracking-widest text-amber-600 hover:bg-amber-50"
          >
            <ChefHat className="w-5 h-5" />
            Kitchen
          </button>
        )}
      </nav>
      <div className="p-8 border-t bg-gray-50/50">
        <div className="flex items-center gap-3 mb-6 p-4 bg-white rounded-2xl border border-black/5 shadow-sm">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
            {profile.name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-textMain truncate">{profile.name}</p>
            <p className="text-[10px] text-textSecondary font-bold truncate">Root Administrator</p>
          </div>
        </div>
        <button 
          onClick={onLogout} 
          className="w-full py-4 rounded-xl text-error bg-error/5 font-black text-xs uppercase tracking-widest hover:bg-error hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Date filter + export row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-6 rounded-[1.5rem] border border-black/5 shadow-sm">
         <div className="flex bg-gray-50 p-1 rounded-xl border border-black/5 self-start">
            {[
               { label: 'Today', days: 0 },
               { label: '7D', days: 7 },
               { label: '30D', days: 30 }
            ].map(q => (
               <button
                  key={q.label}
                  onClick={() => {
                     const end = new Date();
                     const start = new Date();
                     start.setDate(end.getDate() - q.days);
                     setReportStart(start.toISOString().split('T')[0]);
                     setReportEnd(end.toISOString().split('T')[0]);
                  }}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                     (new Date(reportStart).getDate() === new Date(new Date().setDate(new Date().getDate() - q.days)).getDate())
                     ? 'bg-white text-primary shadow-sm shadow-black/5' : 'text-textSecondary hover:text-primary'
                  }`}
               >
                  {q.label}
               </button>
            ))}
         </div>
         <AuditDownloadButton 
           realReport={reportData} 
           period={reportStart === reportEnd ? 'Today' : `${reportStart} to ${reportEnd}`}
         />
      </div>

      {/* Financial Metrics — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {[
          { label: 'Period Revenue', value: `₹${stats.periodRevenue.toLocaleString()}`, icon: DollarSign, color: 'bg-primary/10 text-primary', trend: `+${stats.periodOrders} orders` },
          { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-50 text-green-600', trend: 'All Time' },
          { label: 'Profit', value: `₹${stats.totalPnL.toLocaleString()}`, icon: TrendingUp, color: 'bg-accent/10 text-accent', trend: `${Math.round((stats.totalPnL / (stats.totalRevenue||1)) * 100)}% margin` },
          { label: 'Avg Order', value: `₹${Math.round(stats.avgOrderValue)}`, icon: Zap, color: 'bg-cash/10 text-cash', trend: `${stats.totalOrders} total` },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-[1.5rem] border border-black/5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 sm:p-3 rounded-xl ${s.color}`}><s.icon className="w-4 h-4" /></div>
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-50 text-textSecondary hidden sm:inline">{s.trend}</span>
            </div>
            <p className="text-[9px] font-black text-textSecondary uppercase tracking-widest leading-tight">{s.label}</p>
            <h3 className="text-lg sm:text-2xl font-black text-textMain mt-1 tracking-tight">{s.value}</h3>
            <span className="text-[9px] font-bold text-textSecondary sm:hidden">{s.trend}</span>
          </div>
        ))}
      </div>

      {/* Food Metrics — 1 col mobile, 3 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
        {[
          { label: 'Top Item', value: stats.topItems[0]?.name || 'N/A', icon: Package, color: 'bg-yellow-50 text-yellow-600', trend: `${stats.topItems[0]?.quantity || 0} sold` },
          { label: 'Cash %', value: `${Math.round(stats.cashPercentage)}%`, icon: Banknote, color: 'bg-amber-50 text-amber-600', trend: `${stats.paymentSplit[0]?.value ? '₹'+Math.round(stats.paymentSplit[0].value).toLocaleString() : '0'}` },
          { label: 'Peak Hour', value: stats.peakHours.length > 0 ? stats.peakHours.sort((a,b)=>b.orders-a.orders)[0]?.hour||'N/A' : 'N/A', icon: Activity, color: 'bg-purple-50 text-purple-600', trend: `${stats.peakHours.sort((a,b)=>b.orders-a.orders)[0]?.orders||0} orders` },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 sm:p-6 rounded-[1.5rem] border border-black/5 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.color} shrink-0`}><s.icon className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-textSecondary uppercase tracking-widest">{s.label}</p>
              <h3 className="text-lg font-black text-textMain tracking-tight truncate">{s.value}</h3>
              <p className="text-[9px] text-textSecondary font-bold">{s.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts grid — single col on mobile, 2 col on xl */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Revenue Trend */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base sm:text-xl font-black text-textMain flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Revenue Trend
            </h3>
            <p className="text-xs text-textSecondary font-bold mt-1">Last 7 days</p>
          </div>
          <div className="h-52 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.weeklyData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F9D58" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0F9D58" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} width={40} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="revenue" stroke="#0F9D58" strokeWidth={3} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Split */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <h3 className="text-base sm:text-xl font-black text-textMain mb-6 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" /> Payment Split
          </h3>
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.paymentSplit} innerRadius={50} outerRadius={75} paddingAngle={8} dataKey="value" stroke="none" cornerRadius={4}>
                  {stats.paymentSplit.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${Math.round(value).toLocaleString()}`} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Per Hour */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base sm:text-xl font-black text-textMain flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Orders Per Hour
            </h3>
            <p className="text-xs text-textSecondary font-bold mt-1">Today's breakdown</p>
          </div>
          <div className="h-52 sm:h-72 overflow-x-auto">
            <div className="min-w-[320px] h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} width={30} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="orders" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <h3 className="text-base sm:text-xl font-black text-textMain mb-6 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Top Selling Items
          </h3>
          <div className="h-52 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topItems.slice(0,6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} width={80} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} itemStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar dataKey="quantity" fill="#6366F1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Revenue — full width */}
        <div className="xl:col-span-2 bg-white p-5 sm:p-8 rounded-[2rem] border border-black/5 shadow-sm">
          <h3 className="text-base sm:text-xl font-black text-textMain mb-6">Category Revenue Mix</h3>
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.chartData} innerRadius={50} outerRadius={75} paddingAngle={8} dataKey="value" stroke="none" cornerRadius={4}>
                  {stats.chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${Math.round(value).toLocaleString()}`} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm overflow-hidden animate-in fade-in duration-500">
      <div className="p-5 sm:p-8 border-b flex flex-col gap-4">
        <div>
          <h3 className="text-xl font-black text-textMain tracking-tighter uppercase">Team Management</h3>
          <p className="text-xs text-textSecondary font-bold mt-1">Configure staff roles and access</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
          <input placeholder="Search staff..." className="w-full bg-gray-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" />
        </div>
      </div>

      {users.length === 0 ? (
        <div className="p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto border border-black/5 mb-4">
            <UsersIcon className="w-7 h-7 text-textSecondary/20" />
          </div>
          <p className="font-black text-textMain uppercase text-xs tracking-widest">No Team Members</p>
        </div>
      ) : (
        <div>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black text-textSecondary uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-5">Staff Profile</th>
                  <th className="px-8 py-5">Role</th>
                  <th className="px-8 py-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => {
                  const userName = u.name || 'Unknown';
                  const userEmail = u.email || 'No email';
                  const userRole = u.role || 'STUDENT';
                  const userActive = u.active ?? true;
                  return (
                    <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black">{userName[0]?.toUpperCase()}</div>
                          <div>
                            <p className="font-bold text-textMain text-sm">{userName}</p>
                            <p className="text-[10px] text-textSecondary lowercase">{userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <select value={userRole} onChange={e => { try { updateUserRole(u.uid, e.target.value as any); offlineDetector.recordPing(); } catch { alert('Failed to update role.'); }}}
                          className={`text-xs font-black uppercase px-3 py-2 rounded-xl bg-white border border-black/5 focus:ring-primary outline-none ${userRole==='STUDENT'?'text-blue-500':userRole==='ADMIN'?'text-primary':userRole==='GUEST'?'text-slate-400':'text-textMain'}`}>
                          <option value="STUDENT">Student</option>
                          <option value="GUEST">Guest</option>
                          <option value="CASHIER">Cashier</option>
                          <option value="SERVER">Server</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td className="px-8 py-5">
                        <button onClick={() => { try { toggleUserStatus(u.uid, !(u.active??true)); offlineDetector.recordPing(); } catch { alert('Failed to update status.'); }}}
                          className={`flex items-center gap-2 text-[10px] font-black uppercase px-3 py-1.5 rounded-full border transition-all ${(u.active??true)?'bg-success/5 border-success/20 text-success':'bg-error/5 border-error/20 text-error'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${(u.active??true)?'bg-success animate-pulse':'bg-error'}`}/>
                          {(u.active??true)?'Active':'Revoked'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list — shown only on mobile */}
          <div className="sm:hidden divide-y divide-gray-100">
            {users.map(u => {
              const userName = u.name || 'Unknown';
              const userEmail = u.email || 'No email';
              const userRole = u.role || 'STUDENT';
              const userActive = u.active ?? true;
              return (
                <div key={u.uid} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center font-black text-lg shrink-0">
                      {userName[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-textMain text-sm truncate">{userName}</p>
                      <p className="text-[10px] text-textSecondary truncate">{userEmail}</p>
                    </div>
                    <button
                      onClick={() => { try { toggleUserStatus(u.uid, !userActive); offlineDetector.recordPing(); } catch { alert('Failed.'); }}}
                      className={`ml-auto shrink-0 flex items-center gap-1.5 text-[9px] font-black uppercase px-3 py-1.5 rounded-full border ${
                        userActive ? 'bg-success/5 border-success/20 text-success' : 'bg-error/5 border-error/20 text-error'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${userActive ? 'bg-success animate-pulse' : 'bg-error'}`} />
                      {userActive ? 'Active' : 'Revoked'}
                    </button>
                  </div>
                  <select
                    value={userRole}
                    onChange={e => { try { updateUserRole(u.uid, e.target.value as any); offlineDetector.recordPing(); } catch { alert('Failed.'); }}}
                    className="w-full text-xs font-black uppercase px-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary/20 outline-none"
                  >
                    <option value="STUDENT">Student</option>
                    <option value="GUEST">Guest</option>
                    <option value="CASHIER">Cashier</option>
                    <option value="SERVER">Server</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderMenu = () => (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-8 rounded-[1.5rem] border border-black/5 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-textMain uppercase tracking-tighter">Kitchen Catalog</h3>
          <p className="text-xs text-textSecondary font-bold">Manage meal parameters and pricing</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={async () => {
              if (confirm("Sync all items with constants.tsx? Continue?")) {
                try { await initializeMenu(); alert("Menu synchronized!"); } catch (err) { alert("Sync failed: " + (err as any).message); }
              }
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gray-100 text-textMain px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/10 transition-all border border-black/5"
          >
            <RefreshCw className="w-4 h-4" /> Re-seed
          </button>
          <button 
            onClick={() => { setEditingItem(null); setMenuForm({ name: '', price: 0, costPrice: 0, category: 'Breakfast', imageUrl: '', active: true }); setImagePreview(null); setShowMenuModal(true); }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map(item => (
          <div key={item.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-black/5 shadow-sm group">
            <div className="h-40 bg-gray-100 relative">
              <img 
                src={item.imageUrl || 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400'} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                alt={item.name}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&q=80&w=400';
                }}
              />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl text-xs font-black shadow-lg">
                ₹{item.price}
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-textMain">{item.name}</h4>
                  <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest">{item.category}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingItem(item);
                      setMenuForm(item);
                      setImagePreview(item.imageUrl || null);
                      setShowMenuModal(true);
                    }}
                    className="p-2 bg-gray-50 text-textSecondary rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("Delete this item?")) {
                        try {
                          deleteMenuItem(item.id);
                          offlineDetector.recordPing();
                        } catch (error) {
                          alert('Failed to delete item. Please try again.');
                        }
                      }
                    }}
                    className="p-2 bg-gray-50 text-textSecondary rounded-lg hover:bg-error/10 hover:text-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed">
                <div>
                  <p className="text-[9px] font-black text-textSecondary uppercase tracking-widest">Cost</p>
                  <p className="text-sm font-bold text-textMain">₹{item.costPrice}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-textSecondary uppercase tracking-widest">Margin</p>
                  <p className="text-sm font-bold text-success">₹{item.price - item.costPrice}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderInventory = () => (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 bg-white p-5 sm:p-8 rounded-[1.5rem] border border-black/5 shadow-sm">
        <div>
          <h3 className="text-xl font-black text-textMain uppercase tracking-tighter">Inventory Ledger</h3>
          <p className="text-xs text-textSecondary font-bold">Monitor real-time stock levels</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
          <input 
            placeholder="Search assets..." 
            value={inventorySearch}
            onChange={e => setInventorySearch(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none" 
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {[
          { label: 'Out of Stock', value: mergedInventory.filter(i => (i.openingStock - i.consumed) <= 0).length, icon: AlertCircle, color: 'text-error bg-error/10' },
          { label: 'Low Stock', value: mergedInventory.filter(i => { const r = i.openingStock - i.consumed; return r > 0 && r < 20; }).length, icon: AlertTriangle, color: 'text-cash bg-cash/10' },
          { label: 'High Demand', value: [...mergedInventory].sort((a,b) => b.consumed - a.consumed)[0]?.itemName || popularItems[0]?.itemName || 'N/A', icon: TrendingUp, color: 'text-primary bg-primary/10' },
          { label: 'Total Stocked', value: mergedInventory.length, icon: Package, color: 'text-blue-500 bg-blue-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-2xl ${s.color}`}><s.icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest">{s.label}</p>
              <h4 className="text-lg font-black text-textMain truncate max-w-[120px]">{s.value}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm">
          <h4 className="text-[10px] font-black text-textSecondary uppercase tracking-widest mb-4">Today&apos;s consumption (served)</h4>
          <ul className="space-y-2">
            {(Object.entries(dailyConsumption) as [string, number][])
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .slice(0, 8)
              .map(([itemId, qty]) => (
                <li key={itemId} className="flex justify-between text-sm">
                  <span className="font-bold text-textMain truncate max-w-[180px]">
                    {mergedInventory.find(i => i.itemId === itemId)?.itemName || itemId}
                  </span>
                  <span className="font-black text-primary">{qty}</span>
                </li>
              ))}
            {Object.keys(dailyConsumption).length === 0 && (
              <li className="text-textSecondary text-sm">No serves today yet</li>
            )}
          </ul>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm">
          <h4 className="text-[10px] font-black text-textSecondary uppercase tracking-widest mb-4">Popular items (recent orders)</h4>
          <ul className="space-y-2">
            {popularItems.slice(0, 8).map((p) => (
              <li key={p.itemId} className="flex justify-between text-sm">
                <span className="font-bold text-textMain truncate max-w-[180px]">{p.itemName || p.itemId}</span>
                <span className="font-black text-primary">{p.quantity} ordered</span>
              </li>
            ))}
            {popularItems.length === 0 && (
              <li className="text-textSecondary text-sm">No order data</li>
            )}
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-black/5 shadow-sm overflow-hidden">
        {/* Desktop table — hidden on mobile */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black text-textSecondary uppercase tracking-widest">
              <tr>
                <th className="px-10 py-6">Asset Name</th>
                <th className="px-10 py-6">Usage Progress</th>
                <th className="px-10 py-6 text-center">Remaining</th>
                <th className="px-10 py-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map(item => {
                const remaining = item.openingStock - item.consumed;
                const percent = Math.min(100, Math.max(0, (remaining / item.openingStock) * 100));
                
                return (
                  <tr key={item.itemId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${remaining < 20 ? 'bg-error/10 text-error' : 'bg-gray-100 text-textSecondary'}`}>
                          {item.itemName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-textMain text-sm">{item.itemName}</p>
                          <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest">{item.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6 min-w-[200px]">
                       <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                             <div 
                               className={`h-full transition-all duration-500 ${remaining < 20 ? 'bg-error' : remaining < 50 ? 'bg-cash' : 'bg-primary'}`}
                               style={{ width: `${percent}%` }}
                             />
                          </div>
                          <span className="text-[10px] font-black text-textSecondary w-10">{Math.round(percent)}%</span>
                       </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                       <span className={`text-sm font-black px-4 py-2 rounded-xl inline-block min-w-[60px] ${remaining < 20 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                         {remaining}
                       </span>
                    </td>
                    <td className="px-10 py-6">
                      <button 
                        onClick={() => {
                          setSelectedInventoryItem(item);
                          setShowRestockModal(true);
                        }}
                        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-6 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95"
                      >
                        <ArrowUpCircle className="w-4 h-4" /> Restock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list — shown only on mobile */}
        <div className="sm:hidden divide-y divide-gray-100">
          {filteredInventory.map(item => {
            const remaining = item.openingStock - item.consumed;
            const percent = Math.min(100, Math.max(0, (remaining / item.openingStock) * 100));
            return (
              <div key={item.itemId} className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${remaining < 20 ? 'bg-error/10 text-error' : 'bg-gray-100 text-textSecondary'}`}>
                    {item.itemName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-textMain text-sm truncate">{item.itemName}</p>
                    <p className="text-[10px] text-textSecondary font-black uppercase tracking-widest leading-none mt-1">{item.category}</p>
                  </div>
                  <div className="ml-auto text-right">
                     <span className={`text-xs font-black px-3 py-1.5 rounded-xl inline-block ${remaining < 20 ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                       {remaining} Left
                     </span>
                  </div>
                </div>
                
                <div className="space-y-1.5 px-1">
                   <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-textSecondary">
                      <span>Stock Health</span>
                      <span>{Math.round(percent)}%</span>
                   </div>
                   <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${remaining < 20 ? 'bg-error' : remaining < 50 ? 'bg-cash' : 'bg-primary'}`}
                        style={{ width: `${percent}%` }}
                      />
                   </div>
                </div>

                <button 
                  onClick={() => {
                    setSelectedInventoryItem(item);
                    setShowRestockModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest px-6 py-3.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/10 transition-all active:scale-95"
                >
                  <ArrowUpCircle className="w-4 h-4" /> Restock Ledger
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2rem] border border-black/5 shadow-sm p-4 sm:p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 p-5 sm:p-10 bg-white rounded-[2.5rem] border border-black/5 shadow-sm">
            <div>
              <h3 className="text-2xl font-black text-textMain uppercase tracking-tighter">Business Intelligence</h3>
              <p className="text-xs text-textSecondary font-bold mt-1">Audit executive performance across custom intervals</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
               {/* 🚀 QUICK FILTERS (PRINCIPAL OVERHAUL) */}
               <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-black/5 mr-2">
                  {[
                     { label: 'Today', days: 0 },
                     { label: '7 Days', days: 7 },
                     { label: '30 Days', days: 30 }
                  ].map(q => (
                     <button
                        key={q.label}
                        onClick={() => {
                           const end = new Date();
                           const start = new Date();
                           start.setDate(end.getDate() - q.days);
                           setReportStart(start.toISOString().split('T')[0]);
                           setReportEnd(end.toISOString().split('T')[0]);
                        }}
                        className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:shadow-sm transition-all text-textSecondary hover:text-primary"
                     >
                        {q.label}
                     </button>
                  ))}
               </div>

              <div className="flex items-center gap-3 bg-gray-50 px-6 py-3 rounded-2xl border border-black/5">
                <CalendarDays className="w-4 h-4 text-textSecondary" />
                <input 
                  type="date" 
                  value={reportStart}
                  onChange={e => setReportStart(e.target.value)}
                  className="bg-transparent border-none text-xs font-black uppercase outline-none focus:ring-0" 
                />
                <span className="text-textSecondary opacity-30">/</span>
                <input 
                  type="date" 
                  value={reportEnd}
                  onChange={e => setReportEnd(e.target.value)}
                  className="bg-transparent border-none text-xs font-black uppercase outline-none focus:ring-0" 
                />
              </div>
              <button 
                onClick={() => {
                   // Refresh manual trigger
                   const s = new Date(reportStart);
                   const e = new Date(reportEnd);
                   fetchReport({ role: 'admin', start: s, end: e }).then(setReportData);
                }}
                className="bg-primary text-white p-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95"
              >
                <RefreshCw className={`w-5 h-5 ${reportLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-textMain uppercase tracking-tighter">Reports</h3>
            <p className="text-sm text-textSecondary">Revenue, splits, item rankings</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 sm:gap-3">
            {(['pdf','csv','xlsx','png','json'] as ExportFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={!hasReportData || reportLoading}
                className="px-4 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {fmt.toUpperCase()}
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
            <p className="text-[10px] font-black text-textSecondary uppercase mb-1">Orders</p>
            <p className="text-xl font-black text-textMain">{reportData?.summary?.totalOrders || 0}</p>
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

        {!reportLoading && hasReportData && !reportData && (
             <div className="flex flex-col items-center justify-center p-20 bg-gray-50 rounded-[3rem] border border-dashed text-textSecondary animate-pulse w-full">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-black text-xs uppercase tracking-widest">Hydrating Executive Data...</p>
             </div>
        )}

        {!reportLoading && hasReportData && reportData && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <h4 className="text-sm font-black text-textSecondary uppercase mb-3">Revenue Trend</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.revenueTrend || []}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0F9D58" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#0F9D58" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#0F9D58" strokeWidth={3} fill="url(#revGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <h4 className="text-sm font-black text-textSecondary uppercase mb-3">Item Sales Ranking</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(reportData.itemSales || []).slice(0,8)}>
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
                <h4 className="text-sm font-black text-textSecondary uppercase mb-3">Payment Mix</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reportData.paymentSplit || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                        {(reportData.paymentSplit || []).map((_: any, idx: number) => (
                          <Cell key={idx} fill={['#0F9D58','#6366F1','#F59E0B'][idx % 3]} />
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
    <div className="max-w-3xl mx-auto space-y-6 animate-in zoom-in-95 duration-500">
      <div className="bg-white p-5 sm:p-10 rounded-[2rem] border border-black/5 shadow-sm space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl sm:text-3xl font-black text-textMain tracking-tighter uppercase">System Parameters</h3>
            <p className="text-xs text-textSecondary font-bold mt-1">Orchestrate the global state of the JOE ecosystem</p>
          </div>
          <div className="p-3 sm:p-5 bg-primary/10 rounded-[1.5rem] border border-primary/10">
            <Globe className="w-6 h-6 sm:w-10 sm:h-10 text-primary" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { id: 'isMaintenanceMode', label: 'Lockdown', desc: 'Read-only access', icon: ShieldAlert, color: 'text-error' },
            { id: 'acceptingOrders', label: 'Order Flow', desc: 'Accepting carts', icon: Zap, color: 'text-primary' },
            { id: 'orderingEnabled', label: 'Ordering', desc: 'Allow new orders (fail-safe)', icon: Zap, color: 'text-amber-600' },
            { id: 'autoSettlementEnabled', label: 'Settlement', desc: 'Auto daily reset', icon: CalendarDays, color: 'text-accent' }
          ].map(item => (
            <div key={item.id} className={`p-8 bg-gray-50 rounded-[2.5rem] flex flex-col justify-between min-h-[160px] border transition-all ${
              settings?.[item.id as keyof SystemSettings] 
                ? 'border-primary/20 bg-primary/5' 
                : 'border-transparent hover:border-black/5'
            }`}>
              <div className="flex justify-between items-start">
                <div className={`p-4 bg-white rounded-2xl shadow-sm ${item.color}`}><item.icon className="w-6 h-6" /></div>
                <button 
                  onClick={async () => {
                    if (!settings) return;
                    const currentValue = settings[item.id as keyof SystemSettings] as boolean;
                    try {
                      await updateSettings({ [item.id]: !currentValue });
                      offlineDetector.recordPing();
                    } catch (err) {
                      console.error('Failed to update setting:', err);
                      alert('Failed to update setting. Please try again.');
                    }
                  }}
                  className={`w-14 h-8 rounded-full transition-all duration-300 ease-in-out relative active:scale-95 ${
                    settings?.[item.id as keyof SystemSettings] 
                      ? 'bg-primary shadow-lg shadow-primary/20' 
                      : 'bg-gray-300'
                  }`}
                  disabled={!settings}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-300 ease-in-out ${
                    settings?.[item.id as keyof SystemSettings] ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="mt-4">
                <h4 className="font-black text-textMain uppercase tracking-widest text-[10px]">{item.label}</h4>
                <p className="text-[9px] text-textSecondary font-bold mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8 border-t border-dashed">
          <div className="space-y-6">
            <h4 className="text-sm font-black text-textMain uppercase tracking-widest flex items-center gap-2">
               <DollarSign className="w-4 h-4 text-primary" /> Financial Controls
            </h4>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest ml-1">Tax Rate (%)</label>
                  <div className="relative group">
                    <Percent className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary group-focus-within:text-primary transition-colors" />
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings?.taxRate ?? 0}
                      onChange={e => {
                        const value = parseFloat(e.target.value) || 0;
                        updateSettings({ taxRate: Math.max(0, Math.min(100, value)) });
                        offlineDetector.recordPing();
                      }}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest ml-1">Min Order (₹)</label>
                  <div className="relative group">
                    <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary group-focus-within:text-primary transition-colors" />
                    <input 
                      type="number" 
                      min="0"
                      step="1"
                      value={settings?.minOrderValue ?? 0}
                      onChange={e => {
                        const value = parseFloat(e.target.value) || 0;
                        updateSettings({ minOrderValue: Math.max(0, value) });
                        offlineDetector.recordPing();
                      }}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-sm font-black text-textMain uppercase tracking-widest flex items-center gap-2">
               <Activity className="w-4 h-4 text-primary" /> Performance Load
            </h4>
            <div className="space-y-2 p-6 bg-gray-50 rounded-3xl border border-black/5">
               <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest">Peak Hour Threshold</label>
                  <span className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-primary/10">
                    {settings?.peakHourThreshold ?? 50} Orders/hr
                  </span>
               </div>
               <div className="relative h-10 flex items-center">
                 <input 
                   type="range" 
                   min="10" 
                   max="200" 
                   step="5"
                   value={settings?.peakHourThreshold ?? 50}
                   onChange={e => {
                     updateSettings({ peakHourThreshold: parseInt(e.target.value) });
                     offlineDetector.recordPing();
                   }}
                   className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary transition-all"
                 />
               </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-dashed space-y-4">
          <label className="text-sm font-black text-textMain uppercase tracking-widest flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Live Announcement Engine
          </label>
          <div className="relative group">
            <textarea 
              value={settings?.announcement || ''} 
              onChange={e => {
                updateSettings({ announcement: e.target.value });
                offlineDetector.recordPing();
              }}
              className="w-full bg-gray-50 border-none rounded-[2.5rem] p-8 font-bold text-sm h-36 outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all shadow-inner" 
              placeholder="Type message for all active node headers..." 
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans text-textMain overflow-hidden">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] lg:hidden animate-in fade-in duration-300" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Desktop Sidebar — hidden on mobile */}
      <aside className={`
        fixed inset-y-0 left-0 w-72 bg-white border-r z-[110] transition-transform duration-500 lg:sticky lg:h-screen lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        <SidebarContent />
      </aside>

      <main className="flex-1 overflow-x-hidden min-h-screen flex flex-col">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-2xl border-b sticky top-0 z-40 px-4 sm:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex p-2.5 bg-gray-100 rounded-xl text-textMain hover:bg-primary/10 transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black text-textMain tracking-tighter uppercase truncate">{activeTab}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-success/5 text-success rounded-full text-[10px] font-black uppercase tracking-widest border border-success/10">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </div>
            <button className="p-2.5 bg-gray-50 text-textSecondary rounded-xl hover:bg-primary/10 hover:text-primary transition-all relative">
              <Bell className="w-5 h-5" />
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-error rounded-full ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full pb-28 lg:pb-12">
          {activeTab === 'Overview'   && renderOverview()}
          {activeTab === 'Settings'   && renderSettings()}
          {activeTab === 'Team'       && renderTeam()}
          {activeTab === 'Menu'       && renderMenu()}
          {activeTab === 'Inventory'  && renderInventory()}
          {activeTab === 'Reports'    && renderReports()}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar — only visible on mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[120] bg-white/95 backdrop-blur-xl border-t border-black/5 flex items-center justify-around px-2 py-2 safe-area-pb">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${
              activeTab === item.id
                ? 'text-primary bg-primary/8'
                : 'text-slate-400'
            }`}
          >
            <item.icon className={`w-5 h-5 transition-all ${activeTab === item.id ? 'scale-110' : ''}`} />
            <span className={`text-[8px] font-black uppercase tracking-widest transition-all ${
              activeTab === item.id ? 'text-primary' : 'text-slate-400'
            }`}>{item.id}</span>
          </button>
        ))}
        {onOpenKitchen && (
          <button
            onClick={onOpenKitchen}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl text-amber-500"
          >
            <ChefHat className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Kitchen</span>
          </button>
        )}
      </nav>

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 sm:p-10">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMenuModal(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-lg relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-8 border-b flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-tighter">{editingItem ? 'Edit Asset' : 'New Asset'}</h3>
              <button onClick={() => setShowMenuModal(false)} className="p-2 bg-gray-50 rounded-xl"><CloseIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Asset Name</label>
                <input 
                  value={menuForm.name} 
                  onChange={e => setMenuForm({...menuForm, name: e.target.value})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">Price (₹)</label>
                  <input 
                    type="number"
                    value={menuForm.price} 
                    onChange={e => setMenuForm({...menuForm, price: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest ml-1">Cost (₹)</label>
                  <input 
                    type="number"
                    value={menuForm.costPrice} 
                    onChange={e => setMenuForm({...menuForm, costPrice: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Category</label>
                <select 
                  value={menuForm.category} 
                  onChange={e => setMenuForm({...menuForm, category: e.target.value as any})}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest ml-1">Item Image</label>
                
                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative w-full h-48 bg-gray-100 rounded-2xl overflow-hidden mb-3 border-2 border-dashed border-gray-300">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setMenuForm({...menuForm, imageUrl: ''});
                      }}
                      className="absolute top-2 right-2 p-2 bg-error text-white rounded-lg hover:bg-error/80 transition-colors"
                    >
                      <CloseIcon className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* File Input */}
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-primary/50 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {imagePreview ? (
                      <>
                        <Upload className="w-8 h-8 text-primary mb-2" />
                        <p className="text-sm font-bold text-textMain">Change Image</p>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-textSecondary group-hover:text-primary mb-2 transition-colors" />
                        <p className="text-sm font-bold text-textMain mb-1">Click to upload image</p>
                        <p className="text-xs text-textSecondary">PNG, JPG, WEBP (Max 5MB)</p>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Check file size (5MB max)
                        if (file.size > 5 * 1024 * 1024) {
                          alert('Image size must be less than 5MB');
                          return;
                        }
                        
                        // Convert to base64 data URL
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setMenuForm({...menuForm, imageUrl: base64String});
                          setImagePreview(base64String);
                        };
                        reader.onerror = () => {
                          alert('Failed to read image file');
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                
                {/* Fallback: Allow URL input if needed */}
                <details className="mt-2">
                  <summary className="text-xs text-textSecondary font-bold cursor-pointer hover:text-primary">
                    Or enter image URL instead
                  </summary>
                  <input 
                    type="url"
                    value={menuForm.imageUrl && !menuForm.imageUrl.startsWith('data:') ? menuForm.imageUrl : ''} 
                    onChange={e => {
                      setMenuForm({...menuForm, imageUrl: e.target.value});
                      setImagePreview(e.target.value || null);
                    }}
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 font-bold outline-none focus:ring-2 focus:ring-primary/20 mt-2"
                    placeholder="https://..."
                  />
                </details>
              </div>
            </div>
            <div className="p-8 pt-0">
              <button 
                onClick={handleSaveMenuItem}
                className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <Save className="w-5 h-5" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedInventoryItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRestockModal(false)} />
          <div className="bg-white rounded-[3rem] w-full max-w-sm relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
             <div className="p-8 border-b flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">Restock Asset</h3>
                <button onClick={() => setShowRestockModal(false)} className="p-2 bg-gray-50 rounded-xl"><CloseIcon className="w-6 h-6" /></button>
             </div>
             <div className="p-8 space-y-8">
                <div className="text-center">
                   <p className="text-[10px] font-black text-textSecondary uppercase tracking-widest">Asset Target</p>
                   <h4 className="text-2xl font-black text-textMain mt-1">{selectedInventoryItem.itemName}</h4>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center px-2">
                      <label className="text-[10px] font-black text-textSecondary uppercase tracking-widest">Restock Quantity</label>
                      <span className="text-xl font-black text-primary">+{restockAmount}</span>
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                      {[10, 50, 100].map(amt => (
                        <button 
                          key={amt} 
                          onClick={() => setRestockAmount(amt)}
                          className={`py-3 rounded-2xl font-black text-xs transition-all ${restockAmount === amt ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 text-textSecondary'}`}
                        >
                          +{amt}
                        </button>
                      ))}
                   </div>
                </div>
                <button 
                  onClick={handleRestock}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                  <ArrowUpCircle className="w-5 h-5" /> Update Ledger
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;