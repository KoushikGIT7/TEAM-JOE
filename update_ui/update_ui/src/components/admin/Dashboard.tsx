/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { MenuItem, Order, RechargeRequest, StaffUser, StaffRole } from '../../types';
import { CONSTANT_MENU_ITEMS } from '../../constants';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, PieChart, Pie, Cell 
} from 'recharts';
import { 
  LayoutDashboard, Users, ShoppingBag, BarChart3, Database, 
  Settings as SettingsIcon, Wallet, Search, RefreshCw, X, 
  Check, Eye, Download, ShieldAlert, Sparkles, Filter, 
  Plus, Edit, Trash2, ArrowUpRight, ArrowDownRight, Tag,
  Clock, DollarSign, Heart, HelpCircle, Store, Coins, CheckCircle, AlertTriangle
} from 'lucide-react';

// Color Scheme for charts
const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#3b82f6'];

export const Dashboard: React.FC = () => {
  const {
    orders,
    menuItems,
    rechargeRequests,
    approveRecharge,
    rejectRecharge,
    settings,
    updateSettings,
    updateMenuItemStock,
    updateMenuItemPrice,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem
  } = useApp();

  // Selected Tab state
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TEAM' | 'MENU' | 'INVENTORY' | 'REPORTS' | 'SETTINGS' | 'WALLET'>('OVERVIEW');

  // Interactive Explainer state
  const [selectedKpi, setSelectedKpi] = useState<string | null>('revenue');

  // Staff users list (Retained locally)
  const [teamUsers, setTeamUsers] = useState<StaffUser[]>(() => {
    const saved = localStorage.getItem('cse_staff_users');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [
      { email: 'cashier@cse.com', name: 'Kabir Dev (Cashier)', role: 'CASHIER', active: true },
      { email: 'cook@cse.com', name: 'Chef Suresh Kumar', role: 'COOK', active: true },
      { email: 'supervisor@cse.com', name: 'Ananya Sharma (Supervisor)', role: 'SUPERVISOR', active: true },
      { email: 'server@cse.com', name: 'Pranav Roy (Server)', role: 'SERVER', active: true },
      { email: 'admin@cse.com', name: 'Administrator Main', role: 'ADMIN', active: true }
    ];
  });
  const [teamLoading, setTeamLoading] = useState(false);

  // Save changes to staff
  useEffect(() => {
    localStorage.setItem('cse_staff_users', JSON.stringify(teamUsers));
  }, [teamUsers]);

  // Menu editing states
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: 'BREAKFAST',
    price: 30,
    costPrice: 15,
    description: '',
    image: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
    isFast: false,
    stock: 20,
    initialStock: 25
  });

  // Restock states
  const [restockItem, setRestockItem] = useState<MenuItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(10);

  // Reports filters
  const [reportRange, setReportRange] = useState<'TODAY' | '7DAYS' | '30DAYS'>('7DAYS');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Global app configurations
  const [settingsForm, setSettingsForm] = useState({
    maintenanceMode: settings.maintenanceMode ?? false,
    orderFlowAccepting: settings.orderFlowAccepting ?? true,
    orderingFailSafe: settings.orderingFailSafe ?? false,
    autoDailySettlement: settings.autoDailySettlement ?? true,
    taxRate: settings.taxRate ?? 5.0,
    minOrderValue: settings.minOrderValue ?? 0,
    peakHourThreshold: settings.peakHourThreshold ?? 15,
    lowBalanceThreshold: settings.lowBalanceThreshold ?? 100,
    upiId: settings.upiId ?? '',
    pilotNotification: settings.pilotNotification ?? ''
  });

  // Recharge verification filters
  const [walletFilter, setWalletFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);

  // Save settings trigger
  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      ...settings,
      ...settingsForm
    });
    alert('Settings Saved Successfully! / మార్పులు భద్రపరచబడ్డాయి!');
  };

  // Reseed master foods from constants
  const triggerReseedSync = () => {
    if (confirm('Do you want to reset and reload default dishes? / డిఫాల్ట్ వంటలను లోడ్ చేయాలా?')) {
      CONSTANT_MENU_ITEMS.forEach(item => {
        const exists = menuItems.find(m => m.id === item.id);
        if (exists) {
          updateMenuItem(item);
        } else {
          addMenuItem(item);
        }
      });
      alert('Dishes Restored! / వంటల జాబితా రీసెట్ చేయబడింది!');
    }
  };

  // Add stock quantity action
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockItem) {
      updateMenuItemStock(restockItem.id, restockItem.stock + restockAmount);
      setRestockItem(null);
      alert(`Stock updated! / సరుకు చేర్చబడింది: +${restockAmount} to ${restockItem.name}`);
    }
  };

  // Save new/edited dish details
  const handleMenuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemData: MenuItem = {
      id: editingMenuItem ? editingMenuItem.id : Math.floor(Math.random() * 900000 + 100000).toString(),
      name: menuForm.name,
      category: menuForm.category,
      price: Number(menuForm.price),
      costPrice: Number(menuForm.costPrice),
      description: menuForm.description,
      image: menuForm.image,
      isFast: menuForm.isFast,
      stock: Number(menuForm.stock),
      initialStock: Number(menuForm.initialStock)
    };

    if (editingMenuItem) {
      updateMenuItem(itemData);
      alert('Dish updated! / వంటకం మార్చబడింది!');
    } else {
      addMenuItem(itemData);
      alert('New Dish Added! / కొత్త వంటకం చేర్చబడింది!');
    }
    setIsMenuModalOpen(false);
    setEditingMenuItem(null);
  };

  const handleEditClick = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name,
      category: item.category,
      price: item.price,
      costPrice: item.costPrice ?? Math.round(item.price * 0.6),
      description: item.description,
      image: item.image,
      isFast: item.isFast,
      stock: item.stock,
      initialStock: item.initialStock
    });
    setIsMenuModalOpen(true);
  };

  // Staff roles update handlers
  const refetchTeam = () => {
    setTeamLoading(true);
    setTimeout(() => setTeamLoading(false), 500);
  };

  const updateTeamRole = (email: string, role: StaffRole | 'STUDENT' | 'GUEST') => {
    setTeamUsers(prev => prev.map(u => u.email === email ? { ...u, role: role as StaffRole } : u));
  };

  const toggleTeamActive = (email: string) => {
    setTeamUsers(prev => prev.map(u => u.email === email ? { ...u, active: !u.active } : u));
  };

  // Metrics calculators
  const parseOrderTime = (timestampStr: string): number => {
    const t = Date.parse(timestampStr);
    return isNaN(t) ? Date.now() : t;
  };

  const getFilteredOrdersForAuditing = () => {
    const now = Date.now();
    let minTime = now - 7 * 24 * 60 * 60 * 1000;
    
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate).getTime();
      const end = new Date(customEndDate).getTime() + (24 * 60 * 60 * 1000);
      return orders.filter(o => {
        const t = parseOrderTime(o.timestamp);
        return t >= start && t <= end;
      });
    }

    if (reportRange === 'TODAY') {
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      minTime = startOfToday;
    } else if (reportRange === '30DAYS') {
      minTime = now - 30 * 24 * 60 * 60 * 1000;
    }

    return orders.filter(o => parseOrderTime(o.timestamp) >= minTime);
  };

  const dashboardOrders = getFilteredOrdersForAuditing();
  const successfulOrders = dashboardOrders.filter(o => o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS');

  const lifetimeRevenue = orders
    .filter(o => o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS')
    .reduce((acc, o) => acc + o.total, 0);

  const periodRevenue = successfulOrders.reduce((acc, o) => acc + o.total, 0);

  const profitPnL = successfulOrders.reduce((totalProfit, o) => {
    let orderProfit = 0;
    o.items.forEach(it => {
      const match = menuItems.find(m => m.id === it.menuItemId || m.name === it.name);
      const cost = match?.costPrice ?? ((match?.price ?? it.price) * 0.6);
      orderProfit += (it.price - cost) * it.quantity;
    });
    return totalProfit + orderProfit;
  }, 0);

  const averageTicketSize = successfulOrders.length > 0 ? (periodRevenue / successfulOrders.length) : 0;

  const popularityTracker: { [name: string]: number } = {};
  successfulOrders.forEach(o => {
    o.items.forEach(it => {
      popularityTracker[it.name] = (popularityTracker[it.name] || 0) + it.quantity;
    });
  });

  const sortedPopularItems = Object.entries(popularityTracker)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty);

  const topSellingItem = sortedPopularItems[0]?.name ?? 'No items sold yet';

  const cashRevenue = successfulOrders
    .filter(o => o.paymentMethod === 'CASH')
    .reduce((acc, o) => acc + o.total, 0);
  const cashPercentage = periodRevenue > 0 ? (cashRevenue / periodRevenue) * 100 : 0;

  const hourlyTicketCounts = Array.from({ length: 24 }).map(() => 0);
  successfulOrders.forEach(o => {
    const h = new Date(parseOrderTime(o.timestamp)).getHours();
    hourlyTicketCounts[h]++;
  });
  const peakHourIndex = hourlyTicketCounts.indexOf(Math.max(...hourlyTicketCounts));
  const peakHourCount = hourlyTicketCounts[peakHourIndex];
  const peakHourString = peakHourCount > 0 
    ? `${peakHourIndex === 0 ? 12 : peakHourIndex > 12 ? peakHourIndex - 12 : peakHourIndex}:00 ${peakHourIndex >= 12 ? 'PM' : 'AM'}` 
    : 'No peak hour logged';

  // Chart parsers
  const getRevenueTrendData = () => {
    const days = 7;
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString([], { month: 'short', day: '2-digit' });
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      
      const rev = orders
        .filter(o => o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS')
        .filter(o => {
          const t = parseOrderTime(o.timestamp);
          return t >= start && t <= end;
        })
        .reduce((sum, o) => sum + o.total, 0);

      return { name: label, Revenue: rev };
    });
  };

  const getPaymentSplitData = () => {
    const walletRev = successfulOrders
      .filter(o => o.paymentMethod === 'WALLET' || o.paymentMethod === 'UPI')
      .reduce((sum, o) => sum + o.total, 0);
    return [
      { name: 'Online Wallet (ఆన్‌లైన్)', value: walletRev || 1 },
      { name: 'Galla Cash (గల్లా క్యాష్)', value: cashRevenue }
    ];
  };

  const getHourlyDistributionData = () => {
    return Array.from({ length: 24 }).map((_, hour) => {
      const volume = successfulOrders.filter(o => {
        const h = new Date(parseOrderTime(o.timestamp)).getHours();
        return h === hour;
      }).length;
      return { hour: `${hour}:00`, count: volume };
    }).filter(item => item.count > 0 || (parseInt(item.hour) >= 8 && parseInt(item.hour) <= 19));
  };

  const getTopSellingChartData = () => {
    return sortedPopularItems.slice(0, 5).map(it => ({
      name: it.name,
      Quantity: it.qty
    }));
  };

  const getCategoryMixData = () => {
    const mix: { [cat: string]: number } = {};
    successfulOrders.forEach(o => {
      o.items.forEach(it => {
        const match = menuItems.find(m => m.id === it.menuItemId || m.name === it.name);
        const cat = match?.category ?? 'BREAKFAST';
        mix[cat] = (mix[cat] || 0) + (it.price * it.quantity);
      });
    });
    return Object.entries(mix).map(([name, value]) => ({ name, value }));
  };

  // Download Excel, JSON, XML, TXT, and PDF/Print reports
  const triggerExport = (format: 'CSV' | 'JSON' | 'XML' | 'TXT' | 'PDF_HTML' | 'PRINT') => {
    const timestamp = Date.now();
    const dateRangeLabel = customStartDate && customEndDate 
      ? `${customStartDate}_to_${customEndDate}` 
      : reportRange;

    if (format === 'CSV') {
      const headers = ['Order ID', 'Student Name', 'Email', 'Ordered Dishes', 'Total Spend (₹)', 'Payment Method', 'Payment Status', 'Date & Time'];
      const rows = dashboardOrders.map(o => [
        `"${o.id}"`,
        `"${o.studentName}"`,
        `"${o.studentEmail}"`,
        `"${o.items.map(it => `${it.name} (x${it.quantity})`).join(' | ')}"`,
        o.total,
        o.paymentMethod,
        o.paymentStatus,
        `"${o.timestamp}"`
      ]);
      const csvStr = [headers, ...rows].map(e => e.join(",")).join("\n");
      // Add UTF-8 BOM so Excel opens Telugu/Special characters nicely
      const blob = new Blob(["\ufeff" + csvStr], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `CseCafe_Hisab_${dateRangeLabel}_${timestamp}.csv`;
      link.click();
      alert('Excel/CSV Sheet Downloaded successfully! / ఎక్సెల్ ఫైల్ డౌన్‌లోడ్ చేయబడింది!');
    } 
    else if (format === 'JSON') {
      const jsonStr = JSON.stringify(dashboardOrders, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `CseCafe_Hisab_${dateRangeLabel}_${timestamp}.json`;
      link.click();
      alert('Raw JSON backup file downloaded! / JSON ఫైల్ డౌన్‌లోడ్ చేయబడింది!');
    }
    else if (format === 'XML') {
      let xmlStr = `<?xml version="1.0" encoding="UTF-8"?>\n<cafe_ledger>\n`;
      xmlStr += `  <metadata>\n    <generated_at>${new Date().toISOString()}</generated_at>\n    <range>${dateRangeLabel}</range>\n    <total_bills>${dashboardOrders.length}</total_bills>\n  </metadata>\n  <orders>\n`;
      
      dashboardOrders.forEach(o => {
        xmlStr += `    <order id="${o.id}">\n`;
        xmlStr += `      <student_name>${o.studentName}</student_name>\n`;
        xmlStr += `      <student_email>${o.studentEmail}</student_email>\n`;
        xmlStr += `      <total_amount>${o.total}</total_amount>\n`;
        xmlStr += `      <method>${o.paymentMethod}</method>\n`;
        xmlStr += `      <status>${o.paymentStatus}</status>\n`;
        xmlStr += `      <time>${o.timestamp}</time>\n`;
        xmlStr += `      <dishes>\n`;
        o.items.forEach(it => {
          xmlStr += `        <dish>\n          <name>${it.name}</name>\n          <qty>${it.quantity}</qty>\n          <price>${it.price}</price>\n        </dish>\n`;
        });
        xmlStr += `      </dishes>\n`;
        xmlStr += `    </order>\n`;
      });
      xmlStr += `  </orders>\n</cafe_ledger>`;

      const blob = new Blob([xmlStr], { type: 'application/xml' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `CseCafe_Ledger_${dateRangeLabel}_${timestamp}.xml`;
      link.click();
      alert('XML accounting standard format downloaded! / XML ఫైల్ డౌన్‌లోడ్ చేయబడింది!');
    }
    else if (format === 'TXT') {
      let txtStr = `========================================================================\n`;
      txtStr += `                      CSE CAFETERIA LEDGER INVOICE                      \n`;
      txtStr += `------------------------------------------------------------------------\n`;
      txtStr += `Generated On  : ${new Date().toLocaleString()}\n`;
      txtStr += `Audit Range   : ${dateRangeLabel}\n`;
      txtStr += `Total Bills   : ${dashboardOrders.length}\n`;
      txtStr += `Total Revenue : ₹${periodRevenue.toLocaleString()}\n`;
      txtStr += `========================================================================\n\n`;

      dashboardOrders.forEach((o, index) => {
        txtStr += `${index + 1}. BILL ID: #${o.id} | Student: ${o.studentName} (${o.studentEmail})\n`;
        txtStr += `   Time: ${o.timestamp} | Payment: ${o.paymentMethod} (${o.paymentStatus})\n`;
        txtStr += `   Dishes Grid:\n`;
        o.items.forEach(it => {
          txtStr += `     - ${it.name} x${it.quantity} (₹${it.price} each)\n`;
        });
        txtStr += `   GRAND TOTAL: ₹${o.total}\n`;
        txtStr += `------------------------------------------------------------------------\n`;
      });

      const blob = new Blob([txtStr], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `CseCafe_Hisab_${dateRangeLabel}_${timestamp}.txt`;
      link.click();
      alert('Easy Text Bill summary downloaded! / టెక్స్ట్ ఫైల్ డౌన్‌లోడ్ చేయబడింది!');
    }
    else if (format === 'PDF_HTML' || format === 'PRINT') {
      // Build a fully stylized document template
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Blocked by popup preventer! Please allow popups to open printed receipt accounts.');
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cse Cafe - Accounting Audit Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #fff; color: #333; margin: 30px; }
            h1 { color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 5px; font-size: 26px; }
            .meta { font-size: 13px; color: #666; margin-bottom: 25px; line-height: 1.5; }
            .kpis { display: flex; gap: 15px; margin-bottom: 25px; }
            .kpi-box { flex: 1; padding: 12px; background: #fafafa; border: 1px solid #eee; border-radius: 8px; text-align: center; }
            .kpi-box strong { display: block; font-size: 20px; color: #10b981; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f3f4f6; color: #374151; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .footer { margin-top: 35px; border-top: 1px solid #eee; padding-top: 10px; font-size: 11px; text-align: center; color: #999; }
          </style>
        </head>
        <body>
          <h1>👑 CSE CAFETERIA - ACCOUNTING AUDIT STATEMENT</h1>
          <div class="meta">
            <strong>Generatd On:</strong> ${new Date().toLocaleString()}<br/>
            <strong>Statement Date Range:</strong> ${dateRangeLabel.replace('_to_', ' to ')}<br/>
            <strong>Total Bills Audited:</strong> ${dashboardOrders.length} Completed
          </div>

          <div class="kpis">
            <div class="kpi-box">Total Range Income: <strong>₹${periodRevenue.toLocaleString()}</strong></div>
            <div class="kpi-box">Calculated Profit: <strong>₹${profitPnL.toLocaleString()}</strong></div>
            <div class="kpi-box">Avg Bill Size: <strong>₹${averageTicketSize.toFixed(0)}</strong></div>
          </div>

          <h3>DETAILED TRANSACTIONS LIST / పూర్తి లెక్కల పట్టిక:</h3>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Student / Customer Name</th>
                <th>Ordered Items & Plates</th>
                <th>Payment Mode</th>
                <th>Status</th>
                <th>Date / Time</th>
                <th>Grand Total</th>
              </tr>
            </thead>
            <tbody>
              ${dashboardOrders.map(o => `
                <tr>
                  <td><strong>#${o.id}</strong></td>
                  <td>${o.studentName}<br/><small style="color:#666">${o.studentEmail}</small></td>
                  <td>${o.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}</td>
                  <td>${o.paymentMethod}</td>
                  <td><span style="color:${o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS' ? '#10b981' : '#f59e0b'}">${o.paymentStatus}</span></td>
                  <td>${o.timestamp}</td>
                  <td><strong>₹${o.total}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Cse Cafeteria Cloud system ledger statement. End of document.
          </div>

          <script>
            ${format === 'PRINT' ? 'window.print();' : ''}
          </script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const totalStock = menuItems.reduce((acc, m) => acc + m.stock, 0);
  const outOfStockItems = menuItems.filter(m => m.stock === 0);
  const lowStockThresholdItems = menuItems.filter(m => m.stock > 0 && m.stock <= 5);
  const pendingRequestsCount = rechargeRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-white font-sans overflow-x-hidden pb-20 md:pb-0">
      
      {/* SIDEBAR FOR DESKTOP */}
      <aside className="hidden md:flex flex-col w-80 bg-zinc-900 border-r border-white/5 shrink-0 min-h-screen p-6 space-y-6 select-none shadow-xl">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center border border-brand-purple/20">
            <Store className="w-5 h-5 text-brand-purple" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm tracking-tight text-white leading-none">CSE CAFETERIA</h3>
            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 font-extrabold mt-1 block">
              యజమాని డ్యాష్‌బోర్డ్ 👑
            </span>
          </div>
        </div>

        {/* Sidebar Nav buttons with Telugu and English titles */}
        <nav className="flex flex-col gap-2 flex-1">
          {[
            { id: 'OVERVIEW', label: '📊 Aaj Ka Karobar / ఈరోజు వ్యాపారం', icon: LayoutDashboard },
            { id: 'WALLET', label: '💳 Student Recharges / డబ్బులు జమ', icon: Wallet, badge: pendingRequestsCount > 0 },
            { id: 'MENU', label: '🍔 Food Menu / వంటల పట్టిక', icon: ShoppingBag },
            { id: 'INVENTORY', label: '📦 Rashan Stock / సరుకులు', icon: Database },
            { id: 'TEAM', label: '👥 Workers / పనివాళ్ళు', icon: Users },
            { id: 'REPORTS', label: '📈 Hisab Accounts / నివేదికలు', icon: BarChart3 },
            { id: 'SETTINGS', label: '⚙️ Settings / సెట్టింగ్స్', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setSelectedKpi(tab.id === 'OVERVIEW' ? 'revenue' : null);
                }}
                className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-brand-purple text-zinc-950 font-extrabold shadow-lg shadow-brand-purple/20' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950 font-bold' : 'text-zinc-400'}`} />
                  <span className="text-xs font-bold leading-tight text-left">{tab.label}</span>
                </div>
                {tab.badge && (
                  <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-black text-brand-purple' : 'bg-red-500 text-white animate-pulse'}`}>
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* FIXED BOTTOM NAVIGATION FOR MOBILE WITH ALL TABS IN ONE EASY ROW */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900/95 border-t border-white/10 flex overflow-x-auto select-none px-2 backdrop-blur-lg shadow-[0_-5px_15px_rgba(0,0,0,0.5)] md:hidden z-50 items-center justify-start gap-1.5 scroll-smooth">
        {[
          { id: 'OVERVIEW', label: 'Karobar 📊', icon: LayoutDashboard },
          { id: 'WALLET', label: 'Recharges 💳', icon: Wallet, badge: pendingRequestsCount > 0 },
          { id: 'MENU', label: 'Menu 🍔', icon: ShoppingBag },
          { id: 'INVENTORY', label: 'Rashan 📦', icon: Database },
          { id: 'TEAM', label: 'Helpers 👥', icon: Users },
          { id: 'REPORTS', label: 'Hisab 📈', icon: BarChart3 },
          { id: 'SETTINGS', label: 'Controls ⚙️', icon: SettingsIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setSelectedKpi(tab.id === 'OVERVIEW' ? 'revenue' : null);
              }}
              className="min-w-[76px] flex-1 flex flex-col items-center justify-center h-full relative cursor-pointer"
            >
              <div className={`p-2 rounded-xl transition-all ${
                isActive ? 'bg-brand-purple text-zinc-950 scale-105 shadow shadow-brand-purple/20' : 'text-zinc-500 hover:text-white'
              }`}>
                <Icon className="w-4.5 h-4.5 shrink-0" />
              </div>
              <span className={`text-[9.5px] font-bold mt-1 tracking-tight ${isActive ? 'text-brand-purple font-extrabold' : 'text-zinc-500'}`}>
                {tab.label}
              </span>
              {tab.badge && (
                <span className="absolute top-1 right-2.5 bg-red-500 text-white font-mono text-[8.5px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full animate-bounce">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* MAIN LAYOUT CANVAS */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
        
        {/* HEADER GREETINGS */}
        <header className="px-5 py-5 border-b border-white/5 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-zinc-950/70 select-none">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${settingsForm.orderFlowAccepting ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <span className="font-mono text-[9px] tracking-wider uppercase text-zinc-400 font-extrabold">
                {settingsForm.orderFlowAccepting ? '🟢 Live Counter Open' : '🔴 Closed / No Orders'}
              </span>
            </div>
            <h1 className="font-display font-extrabold text-lg md:text-xl text-white tracking-tight flex items-center gap-1.5">
              <span>Namaste, Owner Garu!</span>
              <span className="text-lg">🙏</span>
              <span className="text-[11px] text-zinc-500 font-mono">(నమస్తే యజమాని గారు)</span>
            </h1>
          </div>

          {/* Quick open/close kitchen toggle button (Super large reach target) */}
          <div className="flex flex-row items-center gap-2">
            <button
              onClick={() => {
                const newState = !settingsForm.orderFlowAccepting;
                setSettingsForm(prev => ({ ...prev, orderFlowAccepting: newState }));
                updateSettings({ ...settings, orderFlowAccepting: newState });
                alert(newState ? 'Kitchen is OPEN! / కౌంటర్ తెరిచాము!' : 'Kitchen is CLOSED! / కౌంటర్ మూసివేసాము!');
              }}
              className={`px-3.5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                settingsForm.orderFlowAccepting 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>{settingsForm.orderFlowAccepting ? '🟢 Kitchen: OPEN (ఆన్)' : '🔴 Kitchen: CLOSED (ఆఫ్)'}</span>
            </button>

            <span className="font-mono text-[11px] text-zinc-300 bg-white/5 border border-white/10 px-3 py-2 rounded-xl select-none">
              {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' })}
            </span>
          </div>
        </header>

        {/* CONTAINER FOR ACTIVE TABS */}
        <main className="p-4 md:p-6 space-y-6">

          {/* ========================================================== */}
          {/* TAB 1: OVERVIEW (BUSINESS KAROBAR PAGE)                      */}
          {/* ========================================================== */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              
              {/* TOP SHINY SUMMARY METRICS */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">
                {[
                  { id: 'revenue', label: '💵 Sales Today / ఈరోజు క్యాష్', value: `₹${periodRevenue.toLocaleString()}`, tag: 'Today\'s Cash In', activeColor: 'border-emerald-500/30' },
                  { id: 'profit', label: '🟢 Profits / ఈరోజు లాభం', value: `₹${profitPnL.toLocaleString()}`, tag: 'Bachat (Profit)', activeColor: 'border-emerald-400/40' },
                  { id: 'lifetime', label: '🏦 Total All-Time / మొత్తం గల్లా', value: `₹${lifetimeRevenue.toLocaleString()}`, tag: 'All Life Sales', activeColor: 'border-indigo-500/30' },
                  { id: 'recharge', label: '⏳ Pending Deposits / జమ కోరికలు', value: `${pendingRequestsCount} Pending`, tag: 'Check Slips Now', activeColor: 'border-brand-purple/30', highlight: pendingRequestsCount > 0 },
                  { id: 'topselling', label: '🏆 No. 1 Dish / సూపర్ వంటకం', value: topSellingItem, tag: 'Highest Ordered Dish', activeColor: 'border-brand-purple/30' },
                  { id: 'ticket', label: '🎟️ Avg Bill / సగటు బిల్లు', value: `₹${averageTicketSize.toFixed(0)}`, tag: 'Order Ticket Average', activeColor: 'border-blue-500/30' },
                  { id: 'cash', label: '🤝 Cash Collection / చేతి డబ్బులు', value: `${cashPercentage.toFixed(0)}%`, tag: `₹${cashRevenue.toLocaleString()} Counter Cash`, activeColor: 'border-brand-purple/30' },
                  { id: 'peakhour', label: '⚡ Rush Hour / రద్దీ సమయం', value: peakHourString, tag: `${peakHourCount || 0} Bills Handled`, activeColor: 'border-red-500/35' }
                ].map((kpi) => {
                  const isSelected = selectedKpi === kpi.id;
                  return (
                    <div
                      key={kpi.id}
                      onClick={() => setSelectedKpi(kpi.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-zinc-900 border-brand-purple ring-1 ring-brand-purple/20' 
                          : 'bg-zinc-900/60 border-white/5 hover:border-zinc-800'
                      } ${kpi.highlight ? 'bg-red-950/20 border-red-500/30' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="block font-bold text-[10px] uppercase tracking-wide text-zinc-400 whitespace-normal break-words leading-tight">
                          {kpi.label}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? '#b76dff' : '#3f3f46' }} />
                      </div>
                      
                      <span className="block font-black text-lg md:text-xl text-white mt-2 mb-1 whitespace-normal break-words leading-tight">
                        {kpi.value}
                      </span>
                      
                      <span className={`block text-[10px] font-medium leading-tight ${isSelected ? 'text-brand-purple' : 'text-zinc-500'}`}>
                        {kpi.tag}
                      </span>
                    </div>
                  );
                })}
              </section>

              {/* HIGH CONTRAST EASY CHARTS */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* 1. Daily Revenue Chart */}
                <div className="lg:col-span-8 bg-zinc-900 border border-white/5 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-zinc-400 border-b border-white/5 pb-2 mb-4 select-none flex justify-between items-center">
                    <span>📈 Daily Earnings Trend (గడిచిన 7 రోజుల కలెక్షన్)</span>
                    <span className="text-[10px] text-emerald-400">Growing Live</span>
                  </h4>
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getRevenueTrendData()}>
                        <defs>
                          <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11, color: 'white' }} />
                        <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#gradientGreen)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Cash vs Digital UPI wallet Pie Chart */}
                <div className="lg:col-span-4 bg-zinc-900 border border-white/5 rounded-xl p-5">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-zinc-400 border-b border-white/5 pb-2 mb-4 select-none">
                    💳 Money Mode Split (డబ్బులు వచ్చిన విధం)
                  </h4>
                  <div className="w-full h-72 flex flex-col justify-between">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getPaymentSplitData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {getPaymentSplitData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#10b981'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 text-[11px] font-bold select-none p-1.5 bg-zinc-950/40 rounded-lg">
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Wallet App</div>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Counter Cash</div>
                    </div>
                  </div>
                </div>

                {/* 3. Hourly rush hour Bar Chart */}
                <div className="lg:col-span-6 bg-zinc-900 border border-white/5 rounded-xl p-5">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-zinc-400 border-b border-white/5 pb-2 mb-4 select-none">
                    ⏰ Heavy Demand Hours (ఏ గంటలో ఎక్కువ రద్దీ ఉందో)
                  </h4>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getHourlyDistributionData()}>
                        <XAxis dataKey="hour" stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Top sells ranked */}
                <div className="lg:col-span-6 bg-zinc-900 border border-white/5 rounded-xl p-5">
                  <h4 className="font-bold text-xs uppercase tracking-wide text-zinc-400 border-b border-white/5 pb-2 mb-4 select-none">
                    🏆 Top Popular Dishes (బాగా అమ్ముడవుతున్న వంటలు)
                  </h4>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={getTopSellingChartData()}>
                        <XAxis type="number" stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} width={100} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="Quantity" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </section>

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: WALLET RECHARGES (డబ్బులు జమ - Verification Screen) */}
          {/* ========================================================== */}
          {activeTab === 'WALLET' && (
            <div className="space-y-5">
              
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-zinc-300">
                    💳 Student Slip Verification (విద్యార్థుల అకౌంట్ జమ)
                  </h3>
                </div>
                <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-lg ${
                  pendingRequestsCount > 0 
                    ? 'bg-brand-purple text-zinc-950 font-extrabold' 
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {pendingRequestsCount > 0 ? `${pendingRequestsCount} Pending / పెండింగ్ ⏳` : 'No Pending / పెండింగ్స్ లేవు ✅'}
                </span>
              </div>

              {/* Status Tab buttons in clean layout */}
              <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl max-w-sm select-none">
                {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((mode) => {
                  const count = rechargeRequests.filter(r => r.status === mode).length;
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        setWalletFilter(mode);
                        setRejectingRequestId(null);
                      }}
                      className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        walletFilter === mode 
                          ? 'bg-brand-purple text-zinc-950 font-extrabold' 
                          : 'text-zinc-400 hover:text-white font-bold'
                      }`}
                    >
                      {mode === 'PENDING' ? '⏳ Waiting' : mode === 'APPROVED' ? '✅ Complete' : '❌ Rejections'}
                      {count > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 bg-zinc-950 text-white rounded-full text-[9px] font-mono">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Verified vouchers grid layout */}
              <div className="space-y-4 font-sans">
                {rechargeRequests.filter(r => r.status === walletFilter).length === 0 ? (
                  <div className="bg-zinc-900 border border-dashed border-white/5 rounded-2xl p-12 text-center text-zinc-500 text-xs">
                    No requests found here under "{walletFilter}" list. / ఏమీ లేవు.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rechargeRequests
                      .filter(r => r.status === walletFilter)
                      .map((req) => (
                        <div 
                          key={req.id} 
                          className="bg-zinc-900 border border-white/5 p-4 rounded-xl flex flex-col justify-between hover:border-zinc-700 transition"
                        >
                          <div className="space-y-3">
                            <div className="flex justify-between items-start pb-2 border-b border-white/5">
                              <div>
                                <h4 className="font-bold text-xs text-white uppercase">{req.studentName}</h4>
                                <span className="font-mono text-[10px] text-zinc-500">{req.studentEmail}</span>
                              </div>
                              <span className="text-sm font-black text-brand-purple-light whitespace-nowrap bg-brand-purple/10 px-2.5 py-1 rounded-lg">
                                +₹{req.amount.toLocaleString()}
                              </span>
                            </div>

                            {/* Slip specific identifiers */}
                            <div className="space-y-1.5 text-[10.5px] font-mono text-zinc-400">
                              <p className="flex justify-between">
                                <span>UPI UTR Reference No:</span>
                                <strong className="text-white select-all">{req.utrNumber || 'N/A'}</strong>
                              </p>
                              <p className="flex justify-between">
                                <span>Uploaded At:</span>
                                <span>{req.timestamp}</span>
                              </p>
                              {req.rejectionReason && (
                                <p className="text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/10 mt-2">
                                  ⚠️ REJECTION NOTES: {req.rejectionReason}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* ACTION BUTTONS (Mega large and easy target taps) */}
                          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-3 border-t border-white/5 mt-3">
                            
                            {/* Tap screenshot slip modal */}
                            <button
                              onClick={() => setSelectedScreenshot(req.screenshotUrl)}
                              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-white font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1 shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Slip / రశీదు చూడు</span>
                            </button>

                            {/* Pending actions */}
                            {req.status === 'PENDING' && (
                              <div className="flex gap-2 flex-1 justify-end">
                                <button
                                  onClick={() => {
                                    setRejectingRequestId(req.id);
                                    setRejectionNotes('');
                                  }}
                                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs rounded-lg cursor-pointer flex-1"
                                >
                                  Reject / వద్దు
                                </button>
                                <button
                                  onClick={() => {
                                    approveRecharge(req.id);
                                    alert(`Card Credited ₹${req.amount} for ${req.studentName}! / డబ్బులు జమ చేయబడ్డాయి!`);
                                  }}
                                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-lg cursor-pointer flex-1 flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Deposit ₹{req.amount} / ఓకే</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* SMART INSTANT REJECTION CHIPS (No keyboard typing required!) */}
                          {rejectingRequestId === req.id && (
                            <div className="bg-black/30 border border-red-500/10 p-3 rounded-lg mt-2.5 space-y-2.5 text-xs">
                              <span className="font-bold text-[10px] text-red-400 block uppercase">
                                Quick rejection reason / సులభమైన తిరస్కరణ కారణాలు:
                              </span>
                              
                              {/* One-tap chip reason picks */}
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  'Wrong screenshot / తప్పు ఫోటో',
                                  'Already used receipt / పాత రశీదు',
                                  'UTR mismatch / యు.టి.ఆర్ నెంబర్ తప్పు',
                                  'Money not in bank / కమాండ్ జరగలేదు'
                                ].map((reason) => (
                                  <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setRejectionNotes(reason)}
                                    className={`px-2 py-1.5 rounded-lg border text-[10px] text-left transition-all font-medium ${
                                      rejectionNotes === reason 
                                        ? 'bg-red-500/20 border-red-500 text-red-300' 
                                        : 'bg-zinc-950 border-white/5 text-zinc-400 hover:text-white'
                                    }`}
                                  >
                                    {reason}
                                  </button>
                                ))}
                              </div>

                              <input
                                type="text"
                                value={rejectionNotes}
                                onChange={(e) => setRejectionNotes(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/5 p-2 text-white outline-none rounded-lg text-xs"
                                placeholder="Or type customized reason here..."
                              />

                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  onClick={() => setRejectingRequestId(null)}
                                  className="px-2.5 py-1 text-xs font-bold bg-zinc-800 text-white rounded-lg"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={() => {
                                    if (!rejectionNotes.trim()) {
                                      alert('Select or type a reason first! / కారణాన్ని తెలపండి!');
                                      return;
                                    }
                                    rejectRecharge(req.id, rejectionNotes);
                                    setRejectingRequestId(null);
                                    alert('Rejection Saved! / తిరస్కరించబడింది!');
                                  }}
                                  className="px-3.5 py-1 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-lg text-xs"
                                >
                                  Reject Now
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: MENU ITEMS (వంటల పట్టిక - Pricing & margins catalog)  */}
          {/* ========================================================== */}
          {activeTab === 'MENU' && (
            <div className="space-y-5 animate-fade-in">
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-zinc-900 border border-white/5 rounded-xl p-4">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-zinc-300">
                    🍔 Food Dishes & Profit Margins (కేఫ్ వంటల మేనేజర్)
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={triggerReseedSync}
                    className="px-3 py-2 bg-zinc-950 border border-white/10 hover:bg-zinc-800 text-brand-purple rounded-lg text-xs font-bold uppercase transition"
                  >
                    ♻️ Reload Defaults (వంటలు రీసెట్)
                  </button>

                  <button
                    onClick={() => {
                      setEditingMenuItem(null);
                      setMenuForm({
                        name: '',
                        category: 'BREAKFAST',
                        price: 30,
                        costPrice: 15,
                        description: '',
                        image: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
                        isFast: false,
                        stock: 50,
                        initialStock: 50
                      });
                      setIsMenuModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-brand-purple hover:bg-brand-purple-light text-zinc-950 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1 shadow-md shadow-brand-purple/10 justify-center shrink-0"
                  >
                    <Plus className="w-4 h-4 text-zinc-950 font-bold" />
                    <span>Add New Food Item / కొత్త వంటకం</span>
                  </button>
                </div>
              </div>

              {/* GRID OF DISHES */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {menuItems.map((item) => {
                  const cost = item.costPrice ?? Math.round(item.price * 0.6);
                  const margin = item.price - cost;
                  const marginPct = item.price > 0 ? (margin / item.price) * 100 : 0;

                  return (
                    <div 
                      key={item.id} 
                      className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden flex flex-col justify-between h-full group"
                    >
                      {/* Thumbnail frame */}
                      <div className="h-44 relative bg-zinc-950 overflow-hidden shrink-0">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 select-none">
                          <span className="font-mono text-[9px] font-black text-white bg-zinc-950/80 backdrop-blur-md px-2 py-0.5 rounded uppercase">
                            {item.category}
                          </span>
                          <span className={`font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase text-black ${
                            item.isFast ? 'bg-indigo-400' : 'bg-amber-400'
                          }`}>
                            {item.isFast ? '⚡ Fast Item' : '🍳 Prepared'}
                          </span>
                        </div>
                      </div>

                      {/* Content panel */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <h4 className="font-extrabold text-sm text-white uppercase truncate">
                            {item.name}
                          </h4>
                          <p className="text-[10.5px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        {/* PROFIT SPLIT METER */}
                        <div className="p-2.5 bg-zinc-950/50 border border-white/5 rounded-lg text-[10.5px] space-y-1 select-none font-mono">
                          <div className="flex justify-between text-zinc-400">
                            <span>💸 Price (అమ్మే ధర):</span>
                            <span className="font-bold text-white text-xs">₹{item.price}</span>
                          </div>
                          <div className="flex justify-between text-zinc-400 border-b border-white/5 pb-1 mb-1">
                            <span>🌾 Cost Price (ఖర్చు):</span>
                            <span className="font-bold text-zinc-300">₹{cost}</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 font-extrabold text-xs">
                            <span>🟢 Net Profit (నికర లాభం):</span>
                            <span>₹{margin} ({marginPct.toFixed(0)}%)</span>
                          </div>
                        </div>

                        {/* Quick edit & delete */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                          <button
                            onClick={() => handleEditClick(item)}
                            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Edit Details</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              if (confirm(`Do you wish to delete ${item.name} from the menus? / వంటకాన్ని తొలగించాలా?`)) {
                                deleteMenuItem(item.id);
                              }
                            }}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: INVENTORY (సరుకులు - Stock Level Bars)               */}
          {/* ========================================================== */}
          {activeTab === 'INVENTORY' && (
            <div className="space-y-5">
              
              {/* Stocks health state gauges */}
              <section className="grid grid-cols-3 gap-3 select-none">
                <div className="bg-zinc-900 border border-white/5 p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold uppercase text-zinc-400 block tracking-tight">Total Stock Balance</span>
                  <span className="text-base font-black text-white block mt-1">{totalStock} plates</span>
                </div>
                
                <div className="bg-zinc-900 border border-white/5 p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold uppercase text-red-400 block tracking-tight">Out of Stock (Khali)</span>
                  <span className="text-base font-black text-red-500 block mt-1">{outOfStockItems.length} dishes</span>
                </div>

                <div className="bg-zinc-900 border border-white/5 p-3 rounded-xl text-center">
                  <span className="text-[9px] font-bold uppercase text-brand-purple block tracking-tight">Low Stock Alerts</span>
                  <span className="text-base font-black text-brand-purple block mt-1">{lowStockThresholdItems.length} dishes</span>
                </div>
              </section>

              {/* SLIDERS LIST */}
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 md:p-5 space-y-4">
                <div className="border-b border-white/5 pb-2.5 flex justify-between items-center">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-zinc-300">
                    🌾 Current Grocery Stock Levels (సరుకుల నిల్వలు)
                  </h3>
                  <span className="text-[10px] text-zinc-500 italic">Scroll list / కిందికి స్క్రోల్ చేయండి</span>
                </div>

                <div className="space-y-3">
                  {menuItems.map(item => {
                    const capacityRatio = item.initialStock > 0 ? (item.stock / item.initialStock) : 0;
                    const capPercent = Math.min(100, Math.round(capacityRatio * 100));
                    
                    // State coloring
                    let barColor = 'bg-emerald-500 shadow-glow';
                    let statusLabel = '🟢 Safe (స్టాక్ ఉంది)';
                    let statusColorText = 'text-emerald-400';
                    
                    if (item.stock === 0) {
                      barColor = 'bg-red-500 animate-pulse';
                      statusLabel = '🔴 Empty / ఖాళీ అయిపోయింది!';
                      statusColorText = 'text-red-400 font-extrabold';
                    } else if (item.stock <= 5) {
                      barColor = 'bg-brand-purple';
                      statusLabel = '🟡 Low (పోతోంది!)';
                      statusColorText = 'text-brand-purple-light';
                    }

                    return (
                      <div 
                        key={item.id} 
                        className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* Name and gauge bar */}
                        <div className="space-y-1.5 flex-1 select-none">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-white uppercase">{item.name}</span>
                            <span className={`text-[10.5px] font-mono ${statusColorText}`}>{statusLabel}</span>
                          </div>
                          
                          {/* Visual progress track */}
                          <div className="w-full bg-zinc-900 rounded-full h-3.5 overflow-hidden border border-white/5 flex">
                            <div 
                              className={`h-full transition-all duration-300 ${barColor}`} 
                              style={{ width: `${capPercent}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                            <span>Balance: <strong className="text-white">{item.stock} plates</strong></span>
                            <span>Total Limit: {item.initialStock}</span>
                          </div>
                        </div>

                        {/* Quick Add Restock button directly next to item */}
                        <div className="shrink-0 pt-1 sm:pt-0">
                          <button
                            onClick={() => {
                              setRestockItem(item);
                              setRestockAmount(10);
                            }}
                            className="w-full sm:w-auto px-4 py-2 bg-brand-purple hover:bg-brand-purple-light text-zinc-950 font-extrabold text-[11px] uppercase rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all shadow"
                          >
                            <Plus className="w-3.5 h-3.5 text-zinc-950 stroke-[3]" />
                            <span>Add Stock / సరుకు నింపు</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 5: STAFF WORKERS (పనివాళ్ళు - Roles management)           */}
          {/* ========================================================== */}
          {activeTab === 'TEAM' && (
            <div className="space-y-5">
              
              <div className="flex items-center justify-between bg-zinc-900 border border-white/5 rounded-xl p-4">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-zinc-300">
                    👥 Cafeteria Helpers & Logins (పనివాళ్ళ అకౌంట్స్)
                  </h3>
                </div>
                
                <button
                  onClick={refetchTeam}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${teamLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Staff List</span>
                </button>
              </div>

              {/* CARD BASED STAFF LIST */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamUsers.map((user) => (
                  <div 
                    key={user.email} 
                    className={`bg-zinc-900 border rounded-xl p-4 flex flex-col justify-between space-y-4 ${
                      user.active ? 'border-white/5' : 'border-red-500/20 ring-1 ring-red-500/10'
                    }`}
                  >
                    
                    {/* Head line summary */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-purple/10 text-brand-purple-light text-sm flex items-center justify-center font-extrabold shrink-0 border border-brand-purple/15">
                        {user.name.charAt(0)}
                      </div>
                      <div className="space-y-0.5 select-none">
                        <h4 className="font-bold text-xs text-white uppercase">{user.name}</h4>
                        <p className="font-mono text-[10.5px] text-zinc-500 break-all">{user.email}</p>
                        <div className="pt-1">
                          <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            user.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                          }`}>
                            {user.active ? '🟢 ACTIVE (ఆన్ వచ్చింది)' : '🔴 BLOCKED (ఆపబడింది)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Choose Roles in drop-down config */}
                    <div className="p-2.5 bg-zinc-950/50 border border-white/5 rounded-lg select-none">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] text-zinc-500 block uppercase">Duty Assign (పని):</span>
                        
                        <select
                          value={user.role}
                          onChange={(e) => updateTeamRole(user.email, e.target.value as any)}
                          className="bg-zinc-900 border border-white/10 rounded-md py-1 px-2 text-[10px] text-zinc-200 outline-none focus:border-brand-purple font-bold cursor-pointer"
                        >
                          <option value="CASHIER">💰 CASHIER (కౌంటర్ డ్యూటీ)</option>
                          <option value="COOK">🍳 COOK (కిచెన్ మాస్టర్)</option>
                          <option value="SUPERVISOR">📝 SUPERVISOR (సహాయకుడు)</option>
                          <option value="SERVER">🤵 WAITING SERVER (బిల్లులు సర్వ్)</option>
                          <option value="ADMIN">👑 MASTER ADMIN (యజమాని)</option>
                        </select>
                      </div>
                    </div>

                    {/* Enable / revoke active helper access */}
                    <button
                      onClick={() => toggleTeamActive(user.email)}
                      className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase transition ${
                        user.active 
                          ? 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/25 text-red-400' 
                          : 'bg-brand-purple hover:bg-brand-purple-light text-zinc-950 font-extrabold'
                      }`}
                    >
                      {user.active ? '🚫 Stop Access (పని ఆపు)' : '🟢 Allow Logins (యాక్సెస్ ఇవ్వు)'}
                    </button>

                  </div>
                ))}
              </div>

            </div>
          )}
          {/* ========================================================== */}
          {activeTab === 'REPORTS' && (
            <div className="space-y-6 animate-fade-in font-sans pb-10">
              
              {/* HEADER CAPTION */}
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
                <div>
                  <h3 className="font-extrabold text-sm uppercase tracking-wide text-white">
                    📈 Accounting Audits & Analytical Hisab (లెక్కల పుస్తకం)
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Live analytics, date range performance tracking, and direct multi-format invoice statement exports.
                  </p>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 rounded-lg shrink-0 self-start md:self-auto">
                  💡 Found {dashboardOrders.length} records matching range
                </div>
              </div>

              {/* DATE RANGE FILTERS PANEL */}
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block">
                  📆 SELECT DATE AUDITING INTERVAL / తనిఖీ సమయాలు:
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  <div className="space-y-1">
                    <span className="text-[9.5px] text-zinc-500 uppercase block font-bold">Quick Preset Blocks:</span>
                    <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-white/5">
                      {[
                        { id: 'TODAY', label: 'Today (ఈరోజు)' },
                        { id: '7DAYS', label: '7 Days (వారం)' },
                        { id: '30DAYS', label: '30 Days (నెల)' }
                      ].map(btn => (
                        <button
                          key={btn.id}
                          onClick={() => {
                            setReportRange(btn.id as any);
                            setCustomStartDate('');
                            setCustomEndDate('');
                          }}
                          className={`flex-1 py-1.5 text-[10.5px] font-bold rounded-md transition ${
                            reportRange === btn.id && !customStartDate
                              ? 'bg-brand-purple text-zinc-950 font-black' 
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9.5px] text-zinc-500 uppercase block font-bold">Or Start Date / ప్రారంభం:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-zinc-950 text-white p-2 text-xs rounded-lg border border-white/10 outline-none focus:border-brand-purple font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9.5px] text-zinc-500 uppercase block font-bold">End Date / అంతం:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-zinc-950 text-white p-2 text-xs rounded-lg border border-white/10 outline-none focus:border-brand-purple font-bold"
                    />
                  </div>

                </div>
              </div>

              {/* INTERVAL KPI STATISTICS PANEL */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 select-none">
                
                <div className="bg-zinc-900 border border-white/5 rounded-xl p-4">
                  <span className="block text-[9.5px] uppercase tracking-wide text-zinc-400 font-bold">Range Total Revenue 📊</span>
                  <span className="block font-black text-lg md:text-xl text-emerald-400 mt-1">
                    ₹{periodRevenue.toLocaleString()}
                  </span>
                  <span className="block text-[9px] text-zinc-500 mt-1">Total billing cash collection</span>
                </div>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-4">
                  <span className="block text-[9.5px] uppercase tracking-wide text-zinc-400 font-bold">Calculated Profit 🟢</span>
                  <span className="block font-black text-lg md:text-xl text-indigo-400 mt-1">
                    ₹{profitPnL.toLocaleString()}
                  </span>
                  <span className="block text-[9px] text-zinc-500 mt-1">Gross profit after ingredient costs</span>
                </div>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-4">
                  <span className="block text-[9.5px] uppercase tracking-wide text-zinc-400 font-bold">Average Ticket Bill 🎟️</span>
                  <span className="block font-black text-lg md:text-xl text-white mt-1">
                    ₹{Math.round(averageTicketSize)}
                  </span>
                  <span className="block text-[9px] text-zinc-500 mt-1">Average student checkout spend</span>
                </div>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-4">
                  <span className="block text-[9.5px] uppercase tracking-wide text-zinc-400 font-bold">Top Selected Favorite 🏆</span>
                  <span className="block font-black text-sm md:text-base text-brand-purple mt-1.5 truncate">
                    {topSellingItem}
                  </span>
                  <span className="block text-[9px] text-zinc-500 mt-1">Most preferred dish in interval</span>
                </div>

              </div>

              {/* ============================================== */}
              {/* DIRECT MULTI-FORMAT DOWNLOAD HUB              */}
              {/* ============================================== */}
              <div className="bg-zinc-900 border border-brand-purple/10 rounded-xl p-5 space-y-4">
                <div>
                  <h4 className="font-extrabold text-xs text-brand-purple uppercase tracking-wide">
                    📥 DIRECT COMPREHENSIVE FILE DOWNLOAD HUB / నివేదిక డౌన్‌లోడ్‌లు
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    One-click dynamic generators populated instantly with active auditing period transactions. No mock loadings.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  
                  {/* CSV / Microsoft Excel Download */}
                  <button
                    onClick={() => triggerExport('CSV')}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-between shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white shrink-0 font-mono text-[9px] font-black">XLS</div>
                      <div className="text-left">
                        <span className="block font-bold">EXCEL WORKBOOK</span>
                        <span className="block text-[9.5px] text-zinc-200 font-normal">Spreadsheet CSV format</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-white group-hover:translate-y-0.5 transition-transform" />
                  </button>

                  {/* JSON Backup Download */}
                  <button
                    onClick={() => triggerExport('JSON')}
                    className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-between shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white shrink-0 font-mono text-[9px] font-black">JS</div>
                      <div className="text-left">
                        <span className="block font-bold">DATABASE BACKUP</span>
                        <span className="block text-[9.5px] text-zinc-200 font-normal">Raw nested JSON dataset</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-white group-hover:translate-y-0.5 transition-transform" />
                  </button>

                  {/* XML Ledger Download */}
                  <button
                    onClick={() => triggerExport('XML')}
                    className="py-3 px-4 bg-cyan-700 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-between shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-white shrink-0 font-mono text-[9px] font-black">XML</div>
                      <div className="text-left">
                        <span className="block font-bold">XML DATA FEED</span>
                        <span className="block text-[9.5px] text-zinc-200 font-normal">Nested markup tags standard</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-white group-hover:translate-y-0.5 transition-transform" />
                  </button>

                  {/* Plain Text Statement Download */}
                  <button
                    onClick={() => triggerExport('TXT')}
                    className="py-3 px-4 bg-zinc-800 hover:bg-zinc-750 text-white font-extrabold text-xs rounded-xl transition-all flex items-center justify-between shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-white/10 rounded flex items-center justify-center text-zinc-300 shrink-0 font-mono text-[9px] font-black">TXT</div>
                      <div className="text-left">
                        <span className="block font-bold">PLAINTEXT RECEIPT</span>
                        <span className="block text-[9.5px] text-zinc-400 font-normal">Unformatted ledger log</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-white group-hover:translate-y-0.5 transition-transform" />
                  </button>

                  {/* PDF/HTML styled statement download */}
                  <button
                    onClick={() => triggerExport('PDF_HTML')}
                    className="py-3 px-4 bg-brand-purple hover:bg-brand-purple-light text-zinc-950 font-extrabold text-xs rounded-xl transition-all flex items-center justify-between shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-zinc-950/20 rounded flex items-center justify-center text-zinc-950 shrink-0 font-mono text-[9px] font-black">PDF</div>
                      <div className="text-left">
                        <span className="block font-bold">PDF STATEMENT</span>
                        <span className="block text-[9.5px] text-zinc-900 font-bold">Styled web document layout</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-zinc-950 group-hover:translate-y-0.5 transition-transform" />
                  </button>

                  {/* Browser direct print command */}
                  <button
                    onClick={() => triggerExport('PRINT')}
                    className="py-3 px-4 bg-gradient-to-r from-brand-purple-dark to-brand-purple hover:brightness-110 text-white font-black text-xs rounded-xl transition-all flex items-center justify-between shadow cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-white/15 rounded flex items-center justify-center text-white shrink-0 font-mono text-[9px] font-black">PRN</div>
                      <div className="text-left text-white">
                        <span className="block font-black uppercase">DIRECT PRINT BILLS</span>
                        <span className="block text-[9.5px] text-zinc-305 font-medium">Auto-triggers browser Print</span>
                      </div>
                    </div>
                    <RefreshCw className="w-4 h-4 text-white font-black group-hover:rotate-45 transition-transform" />
                  </button>

                </div>
              </div>

              {/* ========================================================== */}
              {/* GRAPHICAL REPRESENTATION SECTIONS                         */}
              {/* ========================================================== */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none">
                
                {/* 1. REVENUE AND PROFIT OVER TIME AREA CHART */}
                <div className="lg:col-span-8 bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div>
                      <h4 className="font-bold text-xs text-white uppercase tracking-wide">
                        📈 Income vs net profit margins / రోజువారీ రాబడి & లాభాలు
                      </h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Chronological development graph for selected period</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full font-mono">
                      Daily Ledger Series
                    </span>
                  </div>

                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(() => {
                          const entries: { [date: string]: { income: number; profit: number } } = {};
                          successfulOrders.forEach(o => {
                            const dStr = o.timestamp.split(', ')[0] || o.timestamp.split('T')[0];
                            if (!entries[dStr]) {
                              entries[dStr] = { income: 0, profit: 0 };
                            }
                            entries[dStr].income += o.total;
                            let orderProfit = 0;
                            o.items.forEach(it => {
                              const match = menuItems.find(m => m.id === it.menuItemId || m.name === it.name);
                              const cost = match?.costPrice ?? ((match?.price ?? it.price) * 0.6);
                              orderProfit += (it.price - cost) * it.quantity;
                            });
                            entries[dStr].profit += orderProfit;
                          });
                          return Object.entries(entries).map(([date, val]) => ({
                            Date: date,
                            Revenue: val.income,
                            Profit: Math.round(val.profit)
                          })).slice(-12);
                        })()}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="Date" stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11 }} />
                        <Area type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                        <Area type="monotone" dataKey="Profit" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. PAYMENT CHANNEL PIE SHARE */}
                <div className="lg:col-span-4 bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div>
                      <h4 className="font-bold text-xs text-white uppercase tracking-wide">
                        🥧 Cash vs UPI share / పేమెంట్ రకం విభజన
                      </h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Split by hard cash collection vs wallet</p>
                    </div>
                  </div>

                  <div className="w-full h-44 flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={(() => {
                            const modes: { [mode: string]: number } = { 'HARD CASH': 0, 'UPI WALLET': 0 };
                            successfulOrders.forEach(o => {
                              const m = o.paymentMethod || 'HARD CASH';
                              modes[m] = (modes[m] || 0) + o.total;
                            });
                            return Object.entries(modes).map(([name, value]) => ({ name, value }));
                          })()}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          <Cell key="cell-0" fill="#10b981" />
                          <Cell key="cell-1" fill="#b76dff" />
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">Total Checked</span>
                      <span className="text-sm font-black text-white">₹{periodRevenue.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Chart Legends */}
                  <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono p-2 bg-zinc-950/40 border border-white/5 rounded-lg select-normal">
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                      <div>
                        <span className="text-zinc-400 block text-[9.5px]">HARD CASH:</span>
                        <strong className="text-white">
                          ₹{(() => {
                            let sum = 0;
                            successfulOrders.forEach(o => { if ((o.paymentMethod || 'HARD CASH') === 'HARD CASH') sum += o.total; });
                            return sum.toLocaleString();
                          })()}
                        </strong>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 justify-center">
                      <span className="w-2.5 h-2.5 bg-brand-purple rounded-sm" />
                      <div>
                        <span className="text-zinc-400 block text-[9.5px]">UPI WALLET:</span>
                        <strong className="text-white">
                          ₹{(() => {
                            let sum = 0;
                            successfulOrders.forEach(o => { if ((o.paymentMethod || 'HARD CASH') === 'UPI WALLET') sum += o.total; });
                            return sum.toLocaleString();
                          })()}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* 3. DISH DISTRIBUTION BAR CHART */}
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3 select-none text-xs">
                <div className="pb-2 border-b border-white/5">
                  <h4 className="font-bold text-xs text-white uppercase tracking-wide">
                    📊 Top Preferred Dishes in selected range / అత్యధికంగా విక్రయించబడిన వంటకాలు
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Quantity of plates ordered by campus students in current range</p>
                </div>

                {sortedPopularItems.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 italic">No meals sold in selected dates.</div>
                ) : (
                  <div className="w-full h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sortedPopularItems.slice(0, 8)}>
                        <XAxis dataKey="name" stroke="#52525b" fontSize={9.5} fontWeight="bold" tickLine={false} />
                        <YAxis stroke="#52525b" fontSize={9.5} fontWeight="bold" tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: 8, fontSize: 11 }} />
                        <Bar dataKey="qty" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* DETAILED TRANSACTIONS REPORT TABLE REGISTER */}
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3.5">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div>
                    <h4 className="font-bold text-xs text-white uppercase tracking-wide">
                      🧾 Interactive accounting log book / లెడ్జర్ ఖాతా చిట్టా
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Complete chronologically indexed transactions</p>
                  </div>
                  <span className="font-mono text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-zinc-400 font-bold">
                    Showing {dashboardOrders.length} bills
                  </span>
                </div>

                {dashboardOrders.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 border border-dashed border-white/5 rounded-xl bg-zinc-950/20">
                    No transactions completed during this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-zinc-400 font-mono text-[10px] uppercase">
                          <th className="py-2.5 px-2">Order ID</th>
                          <th className="py-2.5 px-2">Student Name</th>
                          <th className="py-2.5 px-2">Dish details</th>
                          <th className="py-2.5 px-2">Method</th>
                          <th className="py-2.5 px-2">Amount</th>
                          <th className="py-2.5 px-2 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-sans">
                        {dashboardOrders.map((o) => (
                          <tr key={o.id} className="hover:bg-white/2 transition-colors">
                            <td className="py-3 px-2 font-mono text-[11px] text-zinc-400 font-bold select-all">#{o.id}</td>
                            <td className="py-3 px-2">
                              <span className="font-black text-white block truncate max-w-[130px]">{o.studentName}</span>
                              <span className="font-mono text-[9px] text-zinc-500 block truncate max-w-[130px]">{o.studentEmail}</span>
                            </td>
                            <td className="py-3 px-2 text-[11px] text-zinc-300">
                              {o.items.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                            </td>
                            <td className="py-3 px-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase font-mono ${
                                o.paymentMethod === 'HARD CASH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-purple/10 text-brand-purple-light'
                              }`}>
                                {o.paymentMethod || 'HARD CASH'}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-mono font-black text-white">₹{o.total}</td>
                            <td className="py-3 px-2 text-right font-mono text-[10px] text-zinc-400">{o.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}


          {/* ========================================================== */}
          {/* TAB 7: CAFE SETTINGS (సెట్టింగ్స్ - Controls togglers)         */}
          {/* ========================================================== */}
          {activeTab === 'SETTINGS' && (
            <div className="max-w-2xl mx-auto">
              
              <form onSubmit={saveSettings} className="bg-zinc-900 border border-white/5 rounded-xl p-5 space-y-5">
                <div className="border-b border-white/5 pb-2.5 flex items-center gap-2">
                  <SettingsIcon className="w-4.5 h-4.5 text-amber-400 animate-spin-slow" />
                  <h3 className="font-bold text-xs uppercase tracking-wide text-white">
                    Cafe Controls & Global system caps (హాస్టల్ కాంటీన్ సెట్టింగ్స్)
                  </h3>
                </div>

                {/* MASTER SLIDERS & FORM INPUTS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 select-none">
                  
                  <div className="space-y-1 text-xs">
                    <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">GST Tax Rate (%):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={settingsForm.taxRate}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, taxRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                      className="w-full bg-zinc-950 border border-white/10 text-white p-3 rounded-lg font-mono text-center font-bold text-sm"
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">Min Order Spend (₹):</span>
                    <input
                      type="number"
                      value={settingsForm.minOrderValue}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, minOrderValue: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full bg-zinc-950 border border-white/10 text-white p-3 rounded-lg font-mono text-center font-bold text-sm"
                    />
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">UPI Low Limit Warning (₹):</span>
                    <input
                      type="number"
                      value={settingsForm.lowBalanceThreshold}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, lowBalanceThreshold: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-full bg-zinc-950 border border-white/10 text-white p-3 rounded-lg font-mono text-center font-bold text-sm"
                    />
                  </div>

                </div>

                {/* PEAK LIMIT RANGE SLIDER */}
                <div className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 select-none text-xs">
                  <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                    <span>⚡ Crowd Rush Peak Hour Load Warning:</span>
                    <span className="text-amber-400 font-extrabold text-xs">{settingsForm.peakHourThreshold} Bills / Hr</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    step="5"
                    value={settingsForm.peakHourThreshold}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, peakHourThreshold: parseInt(e.target.value) }))}
                    className="w-full accent-amber-500 h-1.5 bg-zinc-900 rounded cursor-pointer"
                  />
                </div>

                {/* BILLBOARD PROMO WRITER */}
                <div className="space-y-1.5 text-xs">
                  <span className="text-[9.5px] text-zinc-400 font-bold uppercase block">
                    📢 BOARD SCROLL ANNOUNCEMENT (వార్తలు / ఆఫర్లు స్టూడెంట్స్ కి చూపించు):
                  </span>
                  <textarea
                    rows={2}
                    value={settingsForm.pilotNotification}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, pilotNotification: e.target.value }))}
                    className="w-full bg-zinc-900/40 border border-white/10 text-white p-3 rounded-xl font-sans text-xs focus:outline-none"
                    placeholder="Type daily banner info like: 20% Discount on Chai today!..."
                  />
                </div>

                {/* System lockdown switch pill */}
                <div className="border-t border-white/5 pt-3 space-y-2 select-none">
                  
                  <div 
                    onClick={() => setSettingsForm(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
                    className={`p-3.5 rounded-xl border flex justify-between items-center cursor-pointer transition ${
                      settingsForm.maintenanceMode 
                        ? 'bg-red-950/20 border-red-500/30' 
                        : 'bg-zinc-950/40 border-white/5 hover:border-zinc-800'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-white uppercase block">🚧 SHUTDOWN APP (లాక్‌డౌన్ చేయండి)</span>
                    </div>
                    <span className={`px-3 py-1 rounded text-[10px] font-black ${settingsForm.maintenanceMode ? 'bg-red-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                      {settingsForm.maintenanceMode ? '🟢 LOCKED NOW' : '⚫ APP IS RUNNING'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow shadow-amber-500/10 cursor-pointer"
                  >
                    💾 Save All Settings / సేవ్ చేసుకోండి
                  </button>
                </div>

              </form>

            </div>
          )}

        </main>
      </div>

      {/* SCREENSHOT FULL SCREEN MODAL */}
      {selectedScreenshot && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-sm overflow-hidden flex flex-col relative font-sans">
            <header className="p-3.5 border-b border-white/10 flex justify-between items-center bg-zinc-950/50">
              <span className="font-bold text-[10.5px] text-zinc-300 uppercase">UPI PAYMENT SLIP RECEIPT</span>
              <button 
                onClick={() => setSelectedScreenshot(null)}
                className="p-1 rounded-md hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer transition bg-white/5 text-xs font-bold px-2 py-1"
              >
                Close
              </button>
            </header>
            <div className="p-4 bg-zinc-950 flex items-center justify-center h-[350px]">
              <img 
                src={selectedScreenshot} 
                className="max-w-full max-h-full object-contain rounded-lg border border-white/5 shadow" 
                alt="Payment Slip Proof" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-3 bg-zinc-900 border-t border-white/5 text-center text-[10px] text-zinc-500">
              Verify UTR reference code on bank teller app before clicking confirm.
            </div>
          </div>
        </div>
      )}

      {/* REFILL STOCK AMOUNT INPUT MODAL */}
      {restockItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form 
            onSubmit={handleRestockSubmit} 
            className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-xs p-4 space-y-4 shadow-xl text-xs"
          >
            <div className="border-b border-white/5 pb-2 flex justify-between items-center">
              <h4 className="font-extrabold text-xs text-white uppercase truncate">
                Refill Stock: {restockItem.name}
              </h4>
              <button 
                type="button"
                onClick={() => setRestockItem(null)}
                className="text-zinc-500 hover:text-white bg-white/5 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-center font-bold">
              <label className="text-[10px] text-zinc-400 block tracking-wider uppercase">STOCK TO ADD (ప్లేట్స్ సంఖ్య):</label>
              
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRestockAmount(Math.max(1, restockAmount - 10))}
                  className="w-11 h-10 bg-zinc-805 text-zinc-300 rounded-lg hover:bg-zinc-700 font-black text-sm select-none"
                >
                  -10
                </button>
                
                <input
                  type="number"
                  min="1"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  className="flex-1 h-10 text-center bg-zinc-950 text-white rounded-lg font-black text-sm outline-none"
                />
                
                <button
                  type="button"
                  onClick={() => setRestockAmount(restockAmount + 10)}
                  className="w-11 h-10 bg-zinc-805 text-zinc-300 rounded-lg hover:bg-zinc-700 font-black text-sm select-none"
                >
                  +10
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs rounded-lg transition"
            >
              Confirm stock refill / సరుకు జమ చేయి
            </button>
          </form>
        </div>
      )}

      {/* DISH CREATE / MODIFY MODAL */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form 
            onSubmit={handleMenuSubmit} 
            className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-md p-5 space-y-4 text-xs max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="border-b border-white/10 pb-2.5 flex justify-between items-center">
              <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                {editingMenuItem ? 'Modify Dish Configuration' : 'Create New Menu Dish'}
              </h4>
              <button 
                type="button"
                onClick={() => {
                  setIsMenuModalOpen(false);
                  setEditingMenuItem(null);
                }}
                className="text-zinc-500 hover:text-white bg-white/5 rounded p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              
              <div className="col-span-2 space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Dish Name / వంటకం పేరు:</span>
                <input
                  type="text"
                  required
                  value={menuForm.name}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg outline-none font-bold"
                  placeholder="e.g. Masala Dosa"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Category Class / వర్గం:</span>
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2.5 bg-zinc-950 text-zinc-200 border border-white/5 rounded-lg outline-none font-bold"
                >
                  <option value="BREAKFAST">BREAKFAST</option>
                  <option value="LUNCH">LUNCH</option>
                  <option value="DRINKS">DRINKS</option>
                  <option value="SWEETS">SWEETS</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Type / వంట విధానం:</span>
                <select
                  value={menuForm.isFast ? 'FAST' : 'COOKED'}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, isFast: e.target.value === 'FAST' }))}
                  className="w-full p-2.5 bg-zinc-950 text-zinc-200 border border-white/5 rounded-lg outline-none font-bold"
                >
                  <option value="FAST">⚡ FAST (Instant Checkout)</option>
                  <option value="COOKED">🍳 ON-DEMAND (Raw Kitchen)</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Price / అమ్మే ధర (₹):</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={menuForm.price}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, price: Math.max(1, parseInt(e.target.value) || 0) }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Groceries Cost / ఖర్చు (₹):</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={menuForm.costPrice}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, costPrice: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Daily stock plates:</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={menuForm.stock}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, stock: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Initial Stock capacity:</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={menuForm.initialStock}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, initialStock: Math.max(1, parseInt(e.target.value) || 0) }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Image URL link / ఫోటో లింక్:</span>
                <input
                  type="url"
                  required
                  value={menuForm.image}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg font-sans text-xs"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block uppercase">Short Desc / వివరణ:</span>
                <textarea
                  required
                  rows={2}
                  value={menuForm.description}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2.5 bg-zinc-950 text-white border border-white/5 rounded-lg focus:outline-none font-sans text-xs"
                  placeholder="Crispy indian dish served with chutney..."
                />
              </div>

            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs rounded-lg cursor-pointer transition mt-2 shadow"
            >
              {editingMenuItem ? '💾 Save Dish / మార్పులు భద్రపరుచు' : '➕ Add dish / వంటకం చేర్చు'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
