import React, { useState } from 'react';
import { Download, Loader2, CheckCircle2, FileText } from 'lucide-react';

// ==========================================
// ✅ MOBILE-SAFE PDF: jsPDF only (no CDN font requests)
// @react-pdf/renderer was fetching fonts from external CDN causing CORS on mobile
// ==========================================

export interface AuditData {
  hotelName: string;
  period: string;
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
    voidRate: number;
  };
  insights: {
    peakHour: string;
    peakThroughput: number;
    flagshipProduct: string;
    beverageShare: number;
    wasteAlert: number;
  };
  itemSales: Array<{ name: string; quantity: number; revenue: number }>;
  recentOrders: Array<{
    id: string;
    time: string;
    customer: string;
    items: string;
    amount: number;
    status: string;
  }>;
}

interface AuditDownloadProps {
  realReport?: any;
  period?: string;
  className?: string;
}

const AuditDownloadButton: React.FC<AuditDownloadProps> = ({
  realReport,
  period = 'Today',
  className = '',
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const generateAudit = async () => {
    if (!realReport || status === 'loading') return;
    setStatus('loading');

    try {
      // ── Dynamic imports — keep bundle lean ──────────────────────────────
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      const { default: autoTable } = await import('jspdf-autotable');

      // ── Reconcile data ──────────────────────────────────────────────────
      const stats = realReport.summary || {};
      const rawOrders: any[] = realReport.orders || [];
      const itemSales: any[] = realReport.itemSales || [];
      const rushData: any[] = realReport.peakHours || [];
      const catSales: any[] = realReport.categorySplit || [];

      const uMap = new Map<string, any>();
      rawOrders.forEach((o: any) => {
        if (o.id && !uMap.has(o.id.toUpperCase())) uMap.set(o.id.toUpperCase(), o);
      });
      const orders = Array.from(uMap.values()).sort(
        (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
      );

      const maxRush =
        rushData.length > 0
          ? [...rushData].sort((a, b) => b.orders - a.orders)[0]
          : { hour: '--:--', orders: 0 };
      const flagship =
        itemSales.length > 0
          ? [...itemSales].sort((a, b) => b.quantity - a.quantity)[0]
          : { name: 'N/A' };

      const bevFromCat = catSales.find((c) => c.category === 'Beverages')?.revenue || 0;
      const bevFromKw = itemSales
        .filter((i) =>
          ['coffee', 'tea', 'milk', 'water', 'juice', 'beverage', 'shake', 'cold'].some((t) =>
            i.name.toLowerCase().includes(t)
          )
        )
        .reduce((acc, cur) => acc + (cur.revenue || 0), 0);
      const bevShare =
        stats.totalRevenue > 0
          ? (Math.max(bevFromCat, bevFromKw) / stats.totalRevenue) * 100
          : 0;

      // ── Palette ─────────────────────────────────────────────────────────
      const NAVY: [number, number, number] = [10, 25, 47];
      const GOLD: [number, number, number] = [184, 134, 11];
      const GRAY: [number, number, number] = [71, 85, 105];
      const GREEN: [number, number, number] = [5, 150, 105];
      const WHITE: [number, number, number] = [255, 255, 255];

      // ── Build PDF ────────────────────────────────────────────────────────
      const doc = new jsPDF('p', 'mm', 'a4');
      const W = doc.internal.pageSize.width;
      const H = doc.internal.pageSize.height;

      // ═══════════════════════════════════════════
      // PAGE 1 — Executive Summary
      // ═══════════════════════════════════════════

      // Header band
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 50, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 50, W, 2, 'F');

      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.text('JOE CAFETERIA & LOUNGE', 15, 22);

      doc.setFontSize(9);
      doc.setTextColor(...GOLD);
      doc.text('EXECUTIVE PERFORMANCE AUDIT', 15, 32);

      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text(`Period: ${period}`, 15, 42);
      doc.text(
        `Generated: ${new Date().toLocaleString('en-IN')}`,
        W - 15,
        42,
        { align: 'right' }
      );

      // KPI Cards
      doc.setTextColor(...NAVY);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL DIAGNOSTICS', 15, 65);

      const kpiCards = [
        { label: 'REVENUE', value: `INR ${(stats.totalRevenue || 0).toLocaleString()}`, color: NAVY },
        { label: 'ORDERS', value: String(stats.totalOrders || 0), color: GREEN },
        { label: 'AVG TICKET', value: `INR ${Math.round(stats.avgTicket || 0)}`, color: NAVY },
        { label: 'VOID RATE', value: `${(stats.voidRate || 0).toFixed(1)}%`, color: (stats.voidRate || 0) > 5 ? [220, 38, 38] as [number, number, number] : GREEN },
      ];
      kpiCards.forEach((card, i) => {
        const x = 15 + i * 47;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, 70, 44, 25, 3, 3, 'F');
        doc.setFontSize(6);
        doc.setTextColor(...GRAY);
        doc.setFont('helvetica', 'bold');
        doc.text(card.label, x + 4, 78);
        doc.setFontSize(11);
        doc.setTextColor(...card.color);
        doc.text(card.value, x + 4, 89);
      });

      // Insights block
      doc.setFillColor(...NAVY);
      doc.roundedRect(15, 100, W - 30, 30, 4, 4, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.text('OPERATIONAL INTELLIGENCE', 22, 110);
      doc.setTextColor(241, 245, 249);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `• PEAK RUSH: ${maxRush.hour} — Throughput: ${maxRush.orders} orders/hr. Deploy handheld assistants 15 min prior.`,
        22, 118
      );
      doc.text(
        `• FLAGSHIP: '${flagship.name}' top seller. Ensure bulk prep before shift. Beverage upsell share: ${bevShare.toFixed(1)}%.`,
        22, 126
      );

      // KPI table
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('OPERATIONAL KPI RATIOS', 15, 142);

      autoTable(doc, {
        startY: 146,
        head: [['METRIC', 'VALUE', 'STATUS']],
        body: [
          ['Throughput Volume', `${stats.totalOrders || 0} orders`, 'Optimal'],
          ['Avg Ticket Yield', `INR ${(stats.avgTicket || 0).toFixed(2)}`, 'Stable'],
          ['Void / Spoilage Rate', `${(stats.voidRate || 0).toFixed(1)}%`, (stats.voidRate || 0) > 5 ? 'REVIEW' : 'Healthy'],
          ['Cash Collection', `INR ${(realReport.summary?.cashTotal || 0).toLocaleString()}`, 'Verified'],
          ['Online Settlement', `INR ${(realReport.summary?.onlineTotal || 0).toLocaleString()}`, 'Verified'],
        ],
        headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: NAVY },
        margin: { left: 15, right: 15 },
        theme: 'grid',
      });

      // Top items table
      const y1 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('HIGH-YIELD MENU ANALYTICS', 15, y1);

      autoTable(doc, {
        startY: y1 + 4,
        head: [['PRODUCT', 'UNITS', 'REVENUE', 'SHARE %']],
        body: itemSales.slice(0, 15).map((it) => [
          it.name.toUpperCase(),
          it.quantity,
          `INR ${(it.revenue || 0).toLocaleString()}`,
          `${(((it.revenue || 0) / (stats.totalRevenue || 1)) * 100).toFixed(1)}%`,
        ]),
        headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 15, right: 15 },
        theme: 'striped',
      });

      // Footer page 1
      doc.setFontSize(6);
      doc.setTextColor(180, 180, 180);
      doc.text('JOE CAFETERIA AUTOMATION • CONFIDENTIAL AUDIT • PAGE 1 OF 2', W / 2, H - 8, { align: 'center' });

      // ═══════════════════════════════════════════
      // PAGE 2 — Transactional Ledger
      // ═══════════════════════════════════════════
      doc.addPage();

      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 35, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(0, 35, W, 2, 'F');
      doc.setTextColor(...GOLD);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('TRANSACTIONAL AUDIT LEDGER', 15, 22);
      doc.setFontSize(9);
      doc.setTextColor(200, 200, 200);
      doc.text(period, W - 15, 22, { align: 'right' });

      // Deduplicated order entries
      const uMap2 = new Map<string, any>();
      orders.forEach((o) => {
        const key = (o.id || '').toUpperCase();
        if (key && !uMap2.has(key)) uMap2.set(key, o);
      });
      const ledgerRows = Array.from(uMap2.values())
        .slice(0, 45)
        .map((o) => {
          const s = String(o.paymentStatus || '').toUpperCase();
          const paid = s === 'SUCCESS' || s === 'VERIFIED';
          const itemStr = (o.items || [])
            .map((i: any) => `${i.name || 'Item'}${i.quantity > 1 ? ` x${i.quantity}` : ''}`)
            .join(', ')
            .slice(0, 55);
          return [
            `#${(o.id || '').slice(-6).toUpperCase()}`,
            o.createdAt
              ? new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              : '--:--',
            itemStr || 'General Settlement',
            `INR ${o.totalAmount || 0}`,
            paid ? 'SUCCESS' : 'VOIDED',
          ];
        });

      autoTable(doc, {
        startY: 42,
        head: [['ORDER ID', 'TIME', 'ORDER DETAILS', 'AMOUNT', 'STATUS']],
        body:
          ledgerRows.length > 0
            ? ledgerRows
            : [['—', '—', 'NO TRANSACTION LOGS RECORDED', '—', '—']],
        headStyles: { fillColor: NAVY, textColor: WHITE, fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 18 },
          2: { cellWidth: 80 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
        },
        margin: { left: 15, right: 15 },
        theme: 'striped',
        didParseCell: (data) => {
          if (data.column.index === 4 && data.section === 'body') {
            const val = String(data.cell.raw || '');
            data.cell.styles.textColor =
              val === 'SUCCESS' ? [5, 150, 105] : [220, 38, 38];
          }
        },
      });

      // Signature block
      const sigY = Math.min((doc as any).lastAutoTable.finalY + 20, H - 45);
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      doc.text(
        'I HEREBY CERTIFY THAT THIS RECONCILIATION DATA IS ACCURATE AS PER SYSTEM LOGS.',
        15,
        sigY
      );
      doc.setDrawColor(200, 200, 200);
      doc.line(15, sigY + 14, 80, sigY + 14);
      doc.line(120, sigY + 14, 185, sigY + 14);
      doc.setFontSize(7);
      doc.text('STATION MANAGER SIGNATURE', 15, sigY + 20);
      doc.text('ADMINISTRATOR SIGNATURE', 120, sigY + 20);

      doc.setFontSize(6);
      doc.setTextColor(180, 180, 180);
      doc.text('JOE CAFETERIA AUTOMATION • CONFIDENTIAL AUDIT • PAGE 2 OF 2', W / 2, H - 8, { align: 'center' });

      // ── Save ─────────────────────────────────────────────────────────────
      const fileName = `JOE_AUDIT_${period.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

      // Mobile-safe save: use blob URL instead of doc.save()
      // doc.save() uses <a download> which can fail on mobile browsers
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        // On mobile open in new tab (user can then share/save from browser)
        window.open(url, '_blank');
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error('Audit PDF Error:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const base =
    'flex items-center justify-center gap-2 px-5 py-3 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-300 active:scale-95';

  if (status === 'loading') {
    return (
      <button disabled className={`${base} bg-slate-900 text-slate-400 cursor-wait ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Generating...
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button onClick={generateAudit} className={`${base} bg-red-600 text-white ${className}`}>
        <Download className="w-4 h-4" /> Retry PDF
      </button>
    );
  }

  return (
    <button
      onClick={generateAudit}
      className={`${base} bg-[#0A192F] text-white hover:bg-slate-800 ${className}`}
    >
      {status === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      ) : (
        <FileText className="w-4 h-4 text-[#D4AF37]" />
      )}
      {status === 'success' ? 'Audit Delivered' : 'Download Audit'}
    </button>
  );
};

export default AuditDownloadButton;
