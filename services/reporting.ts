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
    totalRevenue += o.totalAmount || 0;
    if (o.paymentType === 'CASH') cashTotal += o.totalAmount || 0;
    else onlineTotal += o.totalAmount || 0;
    paymentSplitMap[o.paymentType || 'UNKNOWN'] = (paymentSplitMap[o.paymentType || 'UNKNOWN'] || 0) + (o.totalAmount || 0);

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
  let successOrders = allOrdersInRange.filter(o => o.paymentStatus === 'SUCCESS');
  if (role === 'cashier') {
    successOrders = successOrders.filter(o => o.paymentType === 'CASH');
  }

  // Filtering for REJECTED orders (only needed for cashier reports)
  let rejectedOrders: Order[] = [];
  if (role === 'cashier') {
    rejectedOrders = allOrdersInRange.filter(o => 
      o.paymentStatus === 'REJECTED' && o.paymentType === 'CASH'
    );
  }

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

    // --- COLOR PALETTE ---
    const primaryDark: [number, number, number] = [15, 23, 42]; // slate-900
    const accentGold: [number, number, number] = [212, 175, 55]; // champagne gold
    const secondaryGray: [number, number, number] = [100, 116, 139]; // slate-500
    const lightBg: [number, number, number] = [248, 250, 252]; // slate-50

    // ==========================================
    // PAGE 1: EXECUTIVE BRIEF & ANALYTICS
    // ==========================================
    
    // 1. Grand Header
    doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('JOE CAFETERIA', 20, 25);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('EXECUTIVE SHIFT RECONCILIATION & AUDIT LOG', 20, 35);
    
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(`GENERATED: ${new Date().toLocaleString('en-IN')}`, 20, 45);
    doc.text(`OPERATOR FLAG: ${opts.typeLabel.toUpperCase()}`, 20, 50);

    // 2. Financial Summary Cards
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('1. FINANCIAL OVERVIEW', 20, 75);

    // Card 1: Total Revenue
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.roundedRect(20, 85, 80, 25, 4, 4, 'F');
    doc.setFontSize(9);
    doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
    doc.text('GROSS GENERATED REVENUE', 25, 95);
    doc.setFontSize(16);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(`INR ${data.summary.totalRevenue.toLocaleString()}`, 25, 105);

    // Card 2: Cash Target
    doc.roundedRect(110, 85, 80, 25, 4, 4, 'F');
    doc.setFontSize(9);
    doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
    doc.text('CASH IN DRAWER (ESTIMATED)', 115, 95);
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`INR ${data.summary.cashTotal.toLocaleString()}`, 115, 105);

    // 3. Operational Metrics
    doc.setFontSize(16);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text('2. KEY PERFORMANCE INDICATORS (KPI)', 20, 130);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    // Left Column
    doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
    doc.text('Total Volume:', 20, 140);
    doc.text('Avg Check (Cover):', 20, 148);
    doc.text('Online Net:', 20, 156);
    
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(`${data.summary.totalOrders} Approved Orders`, 60, 140);
    doc.text(`INR ${data.summary.avgTicket.toFixed(2)} / ticket`, 60, 148);
    doc.text(`INR ${data.summary.onlineTotal.toLocaleString()}`, 60, 156);

    // Right Column
    doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
    doc.text('Lost Revenue:', 110, 140);
    doc.text('Void / Spoilage Rate:', 110, 148);
    doc.text('Category Top:', 110, 156);

    doc.setTextColor(239, 68, 68); // Red for lost revenue
    doc.text(`INR ${data.summary.lostRevenue.toLocaleString()} (Rejected)`, 150, 140);
    doc.text(`${data.summary.voidRate.toFixed(2)}%`, 150, 148);
    
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    const topCat = (data.categorySplit && data.categorySplit.length > 0) ? data.categorySplit[0].category : 'N/A';
    doc.text(`${topCat}`, 150, 156);

    // 4. Bestselling Items
    doc.setFontSize(16);
    doc.text('3. BESTSELLING MENU ITEMS', 20, 175);
    
    const topItems = data.itemSales.slice(0, 5).map((it, i) => [
       `#${i+1}`, it.name, `${it.quantity} Units`, `INR ${it.revenue}`
    ]);

    autoTable(doc, {
      startY: 180,
      head: [['RANK', 'ITEM NAME', 'VOLUME SOLD', 'REVENUE YIELD']],
      body: topItems,
      theme: 'grid',
      headStyles: { fillColor: primaryDark, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 20, right: 20 },
    });

    // 5. Peak Trading Hours
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(16);
    doc.text('4. PEAK TRADING HOURS', 20, finalY);
    
    const sortedPeaks = [...data.peakHours].sort((a,b) => b.revenue - a.revenue).slice(0, 3);
    const peakBody = sortedPeaks.map(p => [ p.hour, `${p.orders} Orders`, `INR ${p.revenue}` ]);

    autoTable(doc, {
      startY: finalY + 5,
      head: [['HOUR BLOCK', 'TRAFFIC', 'GENERATED REVENUE']],
      body: peakBody,
      theme: 'plain',
      headStyles: { fillColor: lightBg, textColor: secondaryGray, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      margin: { left: 20, right: 20 },
    });

    // Sub-footer pg 1
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text('PAGE 1 OF 2 - CONFIDENTIAL BUSINESS REPORT', pageWidth / 2, pageHeight - 15, { align: 'center' });


    // ==========================================
    // PAGE 2: COMPREHENSIVE TRANSACTION LEDGER
    // ==========================================
    doc.addPage();
    
    // Minimal Header for Page 2
    doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(accentGold[0], accentGold[1], accentGold[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('5. TRANSACTION LEDGER - FULL DISCLOSURE', 20, 16);

    const ledgerData = (data.raw || []).map(o => {
       const itemsPreview = o.items ? o.items.map((it:any) => `${it.quantity}x ${it.name}`).join(', ') : 'N/A';
       const dateStr = new Date(o.createdAt).toLocaleString('en-IN', { hour12: true, hour: '2-digit', minute:'2-digit' });
       return [
         `#${(o.id || 'N/A').slice(-6).toUpperCase()}`,
         dateStr,
         (o.userName || 'Unknown').toUpperCase(),
         itemsPreview.length > 30 ? itemsPreview.substring(0, 27) + '...' : itemsPreview,
         o.paymentType || 'N/A',
         `INR ${o.totalAmount || 0}`,
         o.paymentStatus || 'UNKNOWN'
       ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['ID', 'TIME', 'CUSTOMER', 'ITEMS', 'METHOD', 'AMOUNT', 'STATUS']],
      body: ledgerData,
      theme: 'striped',
      headStyles: { fillColor: primaryDark, textColor: 255, fontSize: 8, fontStyle: 'bold', minCellHeight: 12 },
      bodyStyles: { fontSize: 7, textColor: 50 },
      alternateRowStyles: { fillColor: 250 },
      margin: { left: 15, right: 15 },
      columnStyles: {
         3: { cellWidth: 50 },
      },
      didParseCell: function(dataParse) {
          if (dataParse.section === 'body' && dataParse.column.index === 6) {
             const statusValue = String(dataParse.cell.raw);
             if (statusValue === 'SUCCESS') dataParse.cell.styles.textColor = [16, 185, 129] as [number, number, number];
             else if (statusValue === 'REJECTED' || statusValue === 'FAILED') dataParse.cell.styles.textColor = [239, 68, 68] as [number, number, number];
             else dataParse.cell.styles.textColor = [245, 158, 11] as [number, number, number]; // Amber for pending
          }
      }
    });

    // ✍️ AUTHORIZATION FOOTER
    let signY = (doc as any).lastAutoTable.finalY + 40;
    if (signY > pageHeight - 40) {
        doc.addPage();
        signY = 50;
    }
    
    doc.setDrawColor(200, 200, 200);
    doc.line(30, signY, 90, signY); // Cashier line
    doc.line(pageWidth - 90, signY, pageWidth - 30, signY); // Admin line
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(secondaryGray[0], secondaryGray[1], secondaryGray[2]);
    doc.text('OPERATOR / CASHIER SIGNATURE', 60, signY + 6, { align: 'center' });
    doc.text('ADMINISTRATOR SIGNATURE', pageWidth - 60, signY + 6, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 150, 150);
    doc.text('PAGE 2 OF 2 - CONFIDENTIAL BUSINESS REPORT', pageWidth / 2, pageHeight - 15, { align: 'center' });

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
