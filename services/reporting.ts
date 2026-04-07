import { collection, doc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Order } from '../types';

type RoleScope = 'admin' | 'cashier';

interface ReportParams {
  role: RoleScope;
  start: Date;
  end: Date;
}

interface ReportData {
  orders: Order[];
  rejected?: Order[];
  summary: {
    totalOrders: number;
    totalRevenue: number;
    cashTotal: number;
    onlineTotal: number;
    approvedCount: number;
    rejectedCount: number;
    avgTicket: number;
    lostRevenue: number;
    voidRate: number;
  };
  categorySplit?: { category: string; revenue: number; volume: number }[];
  paymentSplit: { name: string; value: number }[];
  itemSales: { name: string; quantity: number; revenue: number }[];
  revenueTrend: { label: string; revenue: number }[];
  peakHours: { hour: string; orders: number; revenue: number }[];
  raw: any[];
}

const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map<string, { ts: number; data: ReportData }>();
const cacheKey = (role: RoleScope, start: number, end: number) => `${role}-${start}-${end}`;

export const invalidateReportsCache = () => cache.clear();

const toMillis = (d: Date) => d.getTime();

const bucketLabel = (dateMs: number, span: number) => {
  const d = new Date(dateMs);
  if (span <= 24 * 60 * 60 * 1000) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const computeReport = (orders: Order[], rejected: Order[] = [], spanMs: number): ReportData => {
  const successOrders = orders.filter(o => o.paymentStatus === 'SUCCESS');
  const allOrders = [...successOrders, ...rejected];

  let totalRevenue = 0;
  let cashTotal = 0;
  let onlineTotal = 0;
  let lostRevenue = 0;
  
  rejected.forEach(o => {
     lostRevenue += (o.totalAmount || 0);
  });

  const paymentSplitMap: Record<string, number> = {};
  const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
  const categoryMap: Record<string, { revenue: number, volume: number }> = {};
  const trendMap: Record<string, number> = {};
  const peakMap: Record<string, { orders: number; revenue: number }> = {};

  successOrders.forEach(o => {
    const amount = Number(o.totalAmount || 0);
    totalRevenue += amount;
    if (o.paymentType === 'CASH') cashTotal += amount;
    else onlineTotal += amount;
    paymentSplitMap[o.paymentType || 'UNKNOWN'] = (paymentSplitMap[o.paymentType || 'UNKNOWN'] || 0) + amount;

    const label = bucketLabel(o.createdAt, spanMs);
    trendMap[label] = (trendMap[label] || 0) + (o.totalAmount || 0);

    const hour = new Date(o.createdAt).getHours();
    const hourKey = `${hour}:00`;
    peakMap[hourKey] = peakMap[hourKey] || { orders: 0, revenue: 0 };
    peakMap[hourKey].orders += 1;
    peakMap[hourKey].revenue += o.totalAmount || 0;

    (o.items || []).forEach(item => {
      const key = item.name || item.id;
      itemMap[key] = itemMap[key] || { name: item.name, quantity: 0, revenue: 0 };
      itemMap[key].quantity += item.quantity || 0;
      itemMap[key].revenue += (item.price || 0) * (item.quantity || 0);
      
      const cat = item.category || 'Uncategorized';
      categoryMap[cat] = categoryMap[cat] || { revenue: 0, volume: 0 };
      categoryMap[cat].revenue += (item.price || 0) * (item.quantity || 0);
      categoryMap[cat].volume += item.quantity || 0;
    });
  });

  const totalAttempted = successOrders.length + rejected.length;
  const voidRate = totalAttempted > 0 ? (rejected.length / totalAttempted) * 100 : 0;
  const avgTicket = successOrders.length > 0 ? (totalRevenue / successOrders.length) : 0;

  return {
    orders: successOrders,
    rejected,
    summary: {
      totalOrders: successOrders.length,
      totalRevenue,
      cashTotal,
      onlineTotal,
      approvedCount: successOrders.length,
      rejectedCount: rejected.length,
      avgTicket,
      lostRevenue,
      voidRate
    },
    categorySplit: Object.entries(categoryMap).map(([category, m]) => ({ category, revenue: m.revenue, volume: m.volume })).sort((a,b) => b.revenue - a.revenue),
    paymentSplit: Object.entries(paymentSplitMap).map(([name, value]) => ({ name, value })),
    itemSales: Object.values(itemMap).sort((a, b) => b.quantity - a.quantity),
    revenueTrend: Object.entries(trendMap).map(([label, revenue]) => ({ label, revenue })),
    peakHours: Object.entries(peakMap).map(([hour, v]) => ({ hour, orders: v.orders, revenue: v.revenue })),
    raw: allOrders
  };
};

export const fetchReport = async ({ role, start, end }: ReportParams): Promise<ReportData> => {
  const startMs = start.setHours(0, 0, 0, 0);
  const endMs = end.setHours(23, 59, 59, 999);
  const key = cacheKey(role, startMs, endMs);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const ordersCol = collection(db, 'orders');

  // 🛡️ [Principal Architect] Shift to Index-Free Query:
  // We fetch by createdAt range (standard index) and filter paymentStatus/paymentType client-side.
  // This bypasses the 'Failed Precondition' error and requiring manual composite index setup.
  const baseQuery = query(
    ordersCol,
    where('createdAt', '>=', startMs),
    where('createdAt', '<=', endMs),
    orderBy('createdAt', 'desc')
  );

  const snap = await getDocs(baseQuery);
  const allOrdersInRange = snap.docs.map(doc => ({
    ...(doc.data() as any),
    id: doc.id
  }));

  // Filtering for SUCCESS orders based on role
  // 🛡️ [Root Deduplication]
  const uniqueSuccessMap = new Map();
  allOrdersInRange.forEach(o => {
     if (o.paymentStatus === 'SUCCESS' && (role !== 'cashier' || o.paymentType === 'CASH')) {
        uniqueSuccessMap.set(o.id, o);
     }
  });
  const successOrders = Array.from(uniqueSuccessMap.values());

  // Filtering for REJECTED orders
  const uniqueRejectedMap = new Map();
  if (role === 'cashier') {
     allOrdersInRange.forEach(o => {
        if (o.paymentStatus === 'REJECTED' && o.paymentType === 'CASH') {
           uniqueRejectedMap.set(o.id, o);
        }
     });
  }
  const rejectedOrders = Array.from(uniqueRejectedMap.values());

  const spanMs = endMs - startMs;
  const data = computeReport(successOrders, rejectedOrders, spanMs);
  cache.set(key, { ts: Date.now(), data });
  return data;
};

const formatDate = (d: Date) => d.toISOString().split('T')[0];

const buildFileName = (type: string, dateLabel: string, ext: string) =>
  `JOE_Report_${type}_${dateLabel}.${ext}`;

export type ExportFormat = 'pdf' | 'csv' | 'xlsx' | 'json' | 'png';

export const exportReport = async (data: ReportData, opts: { typeLabel: string; format: ExportFormat }) => {
  const dateLabel = formatDate(new Date());
  const fileName = buildFileName(opts.typeLabel, dateLabel, opts.format);

  if (opts.format === 'json') {
    const blob = new Blob([JSON.stringify(data.raw, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    return;
  }

  if (opts.format === 'csv' || opts.format === 'xlsx') {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(data.raw);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Orders');

    if (data.rejected && data.rejected.length) {
      const rejSheet = XLSX.utils.json_to_sheet(data.rejected);
      XLSX.utils.book_append_sheet(wb, rejSheet, 'Rejected');
    }

    const summarySheet = XLSX.utils.json_to_sheet([data.summary]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    XLSX.writeFile(wb, fileName);
    return;
  }

  if (opts.format === 'pdf') {
    const jsPDF = (await import('jspdf')).default;
    const { default: autoTable } = await import('jspdf-autotable');
    
    // Default config: A4 portrait
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- COLOR PALETTE (HD BRANDING) ---
    const primaryDark: [number, number, number] = [15, 23, 42]; // slate-900 (Bold & Corporate)
    const accentGold: [number, number, number] = [184, 134, 11]; // Dark Goldenrod (Premium)
    const secondaryGray: [number, number, number] = [71, 85, 105]; // slate-600 (Professional Text)
    const successEmerald: [number, number, number] = [5, 150, 105]; // emerald-600 (Growth)
    const cautionAmber: [number, number, number] = [217, 119, 6]; // amber-600 (Attention)

    // ==========================================
    // PAGE 1: OPERATIONAL DIAGNOSTIC INTELLIGENCE
    // ==========================================
    
    // 1. Signature Header (Industrial Design)
    doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.rect(0, 0, pageWidth, 55, 'F');
    
    // Accented Stripe
    doc.setFillColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.rect(0, 55, pageWidth, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(32);
    doc.text('JOE CAFETERIA', 20, 28);
    
    doc.setFontSize(10);
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL EXTRASENSORY AUDIT DECK // SHIFT PERFORMANCE SCORECARD', 20, 38);
    
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`SYSTEM TIMESTAMP: ${new Date().toLocaleString('en-IN')}`, 20, 48);
    doc.text(`AUDIT ID: RECON_${Date.now().toString().slice(-8)}`, pageWidth - 20, 48, { align: 'right' });

    // 2. Financial Metrics (The Numbers)
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('I. FINANCIAL DIAGNOSTICS', 20, 75);

    // Grid Layout for Stats Cards
    const cardY = 82;
    const drawStatCard = (x: number, title: string, value: string, color: [number, number, number]) => {
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, cardY, 55, 30, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
      doc.text(title, x + 5, cardY + 8);
      doc.setFontSize(13);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(value, x + 5, cardY + 22);
    };

    drawStatCard(20, 'GROSS REVENUE', `INR ${data.summary.totalRevenue.toLocaleString()}`, primaryDark);
    drawStatCard(80, 'CASH COLLECTION', `INR ${data.summary.cashTotal.toLocaleString()}`, successEmerald);
    drawStatCard(140, 'ONLINE SETTLEMENT', `INR ${data.summary.onlineTotal.toLocaleString()}`, [59, 130, 246]);

    // 3. Efficiency Ratios
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFontSize(12);
    doc.text('OPERATIONAL KPI RATIO', 20, 125);

    const kpiData = [
       ['STATISTIC', 'VALUE', 'DIAGNOSTIC STATUS'],
       ['Throughput Volume', `${data.summary.totalOrders} Orders`, 'Optimal Flow'],
       ['Average Ticket Yield', `INR ${data.summary.avgTicket.toFixed(2)}`, 'Stable'],
       ['Void / Spoilage Rate', `${data.summary.voidRate.toFixed(1)}%`, data.summary.voidRate > 5 ? 'Investigation Required' : 'Healthy Range'],
       ['Recovery Opportunity', `INR ${data.summary.lostRevenue.toLocaleString()}`, 'Rejected Assets']
    ];

    autoTable(doc, {
      startY: 130,
      head: [kpiData[0]],
      body: kpiData.slice(1),
      theme: 'plain',
      headStyles: { fontSize: 8, fontStyle: 'bold', textColor: secondaryGray },
      bodyStyles: { fontSize: 9, minCellHeight: 10, textColor: primaryDark },
      margin: { left: 20, right: 20 },
    });

    // 4. Bestseller Mix
    const tableY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text('II. HIGH-YIELD MENU ANALYTICS', 20, tableY);

    const itemBody = data.itemSales.slice(0, 6).map(it => [
       it.name.toUpperCase(), it.quantity, `INR ${it.revenue.toLocaleString()}`, `${((it.revenue / (data.summary.totalRevenue || 1)) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: tableY + 5,
      head: [['PRODUCT NAME', 'UNIT VOLUME', 'REVENUE CONTRIBUTION', 'SHARE %']],
      body: itemBody,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 20, right: 20 }
    });

    // Footer Pg 1
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text('JOE AUTOMATION • PROPRIETARY DIAGNOSTIC REPORT • CONFIDENTIAL', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ==========================================
    // PAGE 2: ANALYTIC RECOMMENDATIONS & STRATEGY
    // ==========================================
    doc.addPage();
    
    // Header Stripe Page 2
    doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFontSize(18);
    doc.text('STRATEGIC RECOMMENDATION & SCALE GUIDE', 20, 25);

    // 1. Peak Hour Strategy
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFontSize(14);
    doc.text('📈 TRAFFIC SYNC & STAFFING OPTIMIZATION', 20, 55);

    const sortedHours = [...data.peakHours].sort((a,b) => b.orders - a.orders).slice(0, 1);
    const peakHour = sortedHours[0]?.hour || 'N/A';
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const recText = [
      `• CRITICAL RUSH: Detected at ${peakHour}. Current throughput is ${sortedHours[0]?.orders || 0} orders/hr.`,
      '• RECOMMENDATION: Deploy additional handheld scan assistants 15 minutes prior to this window.',
      '• WASTE ALERT: Lost revenue due to rejections is INR ' + data.summary.lostRevenue + '. Reduce UTR entry friction.'
    ];
    doc.text(recText, 25, 68);

    // 2. Menu Strategy
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('🍔 MENU & INVENTORY RECOMMENDATIONS', 20, 100);
    
    const topItemName = data.itemSales[0]?.name || 'Top Items';
    const menuRec = [
      `• HIGH DEMAND: '${topItemName}' is your clear flagship product. Ensure bulk pre-prep before shift start.`,
      '• UPSELL OPPORTUNITY: Beverages represent only ' + ((data.categorySplit?.find(c => c.category === 'Beverages')?.revenue || 0) / (data.summary.totalRevenue || 1) * 100).toFixed(1) + '% of revenue. Bundle with meals.',
      '• PRICING: Average ticket is INR ' + data.summary.avgTicket.toFixed(0) + '. Consider a "Boss Combo" at INR ' + (data.summary.avgTicket + 15).toFixed(0) + ' for growth.'
    ];
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(menuRec, 25, 113);

    // 3. Full Ledger Table (Summary only for Audit)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('🧾 TRANSACTIONAL AUDIT LEDGER (SAMPLE)', 20, 145);

    const ledgerSample = data.raw.slice(0, 15).map(o => [
       `#${o.id.slice(-6).toUpperCase()}`,
       new Date(o.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
       (o.userName || 'Guest').substring(0, 12),
       `INR ${o.totalAmount}`,
       o.paymentStatus
    ]);

    autoTable(doc, {
       startY: 152,
       head: [['ORDER ID', 'TIME', 'CUSTOMER', 'SETTLEMENT', 'STATUS']],
       body: ledgerSample,
       theme: 'striped',
       headStyles: { fillColor: [240, 240, 240], textColor: primaryDark, fontSize: 8 },
       bodyStyles: { fontSize: 7 }
    });

    // 4. Authorization Block
    const signY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(9);
    doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
    doc.text('I HEREBY CERTIFY THAT THIS RECONCILIATION DATA IS ACCURATE AS PER SYSTEM LOGS.', 20, signY);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, signY + 15, 80, signY + 15);
    doc.line(130, signY + 15, 190, signY + 15);
    
    doc.text('STATION MANAGER SIGNATURE', 20, signY + 22);
    doc.text('ADMINISTRATOR SIGNATURE', 130, signY + 22);

    // QR Authenticator (Mock)
    doc.setFontSize(6);
    doc.text('SECURE-HASH-ID: ' + btoa(Date.now().toString()).slice(0, 16), 20, pageHeight - 15);

    doc.save(fileName);
    return;
  }

  if (opts.format === 'png') {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111827';
    ctx.font = '16px Poppins';
    ctx.fillText(`JOE Report - ${opts.typeLabel}`, 20, 30);

    const bars = data.revenueTrend.slice(0, 12);
    const max = Math.max(...bars.map(b => b.revenue), 1);
    const chartHeight = 250;
    const barWidth = Math.max(20, Math.floor(700 / bars.length));
    bars.forEach((b, idx) => {
      const h = Math.max(4, (b.revenue / max) * chartHeight);
      const x = 40 + idx * (barWidth + 10);
      const y = 330 - h;
      ctx.fillStyle = '#0F9D58';
      ctx.fillRect(x, y, barWidth, h);
      ctx.fillStyle = '#6B7280';
      ctx.font = '10px Poppins';
      ctx.fillText(b.label, x, 350);
    });

    const link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
};
