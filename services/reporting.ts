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
  };
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
  const paymentSplitMap: Record<string, number> = {};
  const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
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
    });
  });

  return {
    orders: successOrders,
    rejected,
    summary: {
      totalOrders: successOrders.length,
      totalRevenue,
      cashTotal,
      onlineTotal,
      approvedCount: successOrders.length,
      rejectedCount: rejected.length
    },
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
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // 🏨 [Grand Hotel Aesthetic] - Official Header
    doc.setFillColor(20, 25, 35); // Deep Charcoal
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(212, 175, 55); // Champagne Gold
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('JOE CAFETERIA', 15, 20);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL SHIFT RECONCILIATION & AUDIT LOG', 15, 28);
    doc.text(`DATE: ${new Date().toLocaleDateString('en-IN')}`, 15, 33);
    doc.text(`GENERATE BY: ${opts.typeLabel} ARCHIVE`, 15, 38);

    // 📊 RECONCILIATION SUMMARY BOX
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(14, 55, pageWidth - 28, 40, 5, 5, 'F');
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIFT SUMMARY', 20, 65);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Transactions: ${data.summary.totalOrders}`, 20, 75);
    doc.text(`Total Net Revenue: INR ${data.summary.totalRevenue.toLocaleString()}`, 20, 82);
    
    doc.text(`Cash Collected: INR ${data.summary.cashTotal.toLocaleString()}`, 110, 75);
    doc.text(`Online Transfers: INR ${data.summary.onlineTotal.toLocaleString()}`, 110, 82);

    // 🧪 AUDIT LOG TABLE
    doc.setTextColor(20, 25, 35);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSACTION LOG', 14, 110);

    autoTable(doc, {
      head: [['ID', 'NAME', 'METHOD', 'AMOUNT', 'STATUS', 'TIMESTAMP']],
      body: data.orders.map(o => [
        `#${o.id.slice(-6).toUpperCase()}`,
        o.userName.toUpperCase(),
        o.paymentType,
        `INR ${o.totalAmount}`,
        o.paymentStatus === 'SUCCESS' ? 'PAID' : o.paymentStatus,
        new Date(o.createdAt).toLocaleTimeString('en-US', { hour12: false })
      ]),
      startY: 115,
      styles: { fontSize: 8, font: 'helvetica', cellPadding: 3 },
      headStyles: { fillColor: [40, 45, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 120 }
    });

    // ✍️ AUTHORIZATION FOOTER
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.text('__________________________', 15, finalY);
    doc.text('CASHIER SIGNATURE', 15, finalY + 5);
    
    doc.text('__________________________', pageWidth - 70, finalY);
    doc.text('ADMIN APPROVAL', pageWidth - 70, finalY + 5);

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
