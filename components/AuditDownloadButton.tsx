"use client";

import React, { useState } from 'react';
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf, 
  Svg, 
  Rect 
} from '@react-pdf/renderer';

// ==========================================
// 🛡️ DATA INTERFACES
// ==========================================

export interface AuditData {
  hotelName: string;
  period: string;
  kpis: {
    occupancy: { value: string | number; change: number };
    revpar: { value: string | number; change: number };
    adr: { value: string | number; change: number };
    gop: { value: string | number; change: number };
    totalRevenue: { value: string | number; change: number };
    roomsSold: { value: string | number; change: number };
  };
  monthlyRevenue: Array<{
    month: string;
    rooms: number;
    fb: number;
    ancillary: number;
  }>;
  revenueMix: Array<{
    label: string;
    percentage: number;
  }>;
  guestScores: {
    nps: number;
    cleanliness: number;
    service: number;
    fb: number;
    value: number;
  };
  channels: Array<{
    name: string;
    share: string | number;
    roomNights: string | number;
    revenue: string | number;
    trend: 'up' | 'down' | 'flat';
  }>;
  costEfficiency: Array<{
    department: string;
    costPerRoom: string | number;
    status: 'On Target' | 'Over Budget' | 'Monitor';
  }>;
  forecast: {
    occupancy30day: string | number;
    actionFlags: string[];
  };
}

const COLORS = {
  NAVY: '#0A192F',
  GOLD: '#D4AF37',
  BG: '#F8F9FA',
  CARD: '#FFFFFF',
  TEXT_MAIN: '#1E293B',
  TEXT_SUB: '#64748B',
  SUCCESS: '#10B981',
  ERROR: '#EF4444',
  WARNING: '#F59E0B'
};

const styles = StyleSheet.create({
  page: { display: 'flex', flexDirection: 'column', backgroundColor: COLORS.BG, padding: 35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: COLORS.GOLD, paddingBottom: 20 },
  brandName: { fontSize: 22, color: COLORS.NAVY, fontWeight: 'bold', textTransform: 'uppercase' },
  reportSubtitle: { fontSize: 10, color: COLORS.GOLD, marginTop: 4, fontWeight: 'bold', letterSpacing: 1.5 },
  periodBadge: { fontSize: 10, color: COLORS.TEXT_SUB, textAlign: 'right' },
  sectionTitle: { fontSize: 12, color: COLORS.NAVY, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  card: { backgroundColor: COLORS.CARD, padding: 15, borderRadius: 2, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 },
  kpiCard: { width: '15.5%', backgroundColor: COLORS.CARD, padding: 10, borderRadius: 2, borderTopWidth: 3, borderTopColor: COLORS.NAVY },
  kpiLabel: { fontSize: 7, color: COLORS.TEXT_SUB, textTransform: 'uppercase', marginBottom: 5 },
  kpiValue: { fontSize: 13, color: COLORS.NAVY, fontWeight: 'bold' },
  chartContainer: { width: '48.5%', height: 160, padding: 15, backgroundColor: COLORS.CARD, borderRadius: 2 },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 7, color: COLORS.TEXT_SUB },
  scoreList: { marginTop: 5 },
  scoreItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  scoreLabel: { fontSize: 9, color: COLORS.TEXT_MAIN, textTransform: 'capitalize' },
  scoreVal: { fontSize: 9, color: COLORS.NAVY, fontWeight: 'bold' },
  table: { width: '100%', marginTop: 5, borderRadius: 2, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.NAVY, padding: 8 },
  th: { flex: 1, color: COLORS.CARD, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', padding: 8, backgroundColor: COLORS.CARD },
  td: { flex: 1, color: COLORS.TEXT_MAIN, fontSize: 8 },
  outlookCard: { width: '35%', backgroundColor: COLORS.NAVY, padding: 20, borderRadius: 4 },
  outlookTitle: { fontSize: 11, color: COLORS.GOLD, fontWeight: 'bold', marginBottom: 15 },
  forecastVal: { fontSize: 24, color: COLORS.CARD, fontWeight: 'bold', marginBottom: 4 },
  forecastSub: { fontSize: 8, color: '#94A3B8', marginBottom: 20 },
  flagItem: { flexDirection: 'row', marginBottom: 8, gap: 5 },
  flagDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.GOLD, marginTop: 3 },
  flagText: { fontSize: 8, color: '#E2E8F0', flex: 1, lineHeight: 1.4 },
  footer: { position: 'absolute', bottom: 25, left: 35, right: 35, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 },
  footerText: { fontSize: 7, color: '#94A3B8', fontStyle: 'italic' }
});

const SvgRevenueBarChart = ({ data }: { data: AuditData['monthlyRevenue'] }) => {
  const maxVal = Math.max(...data.flatMap(d => [d.rooms]), 1) * 1.5;
  const chartHeight = 80;
  const chartWidth = 240;
  const barWidth = 15;
  const spacing = 40;

  return (
    <Svg width={chartWidth} height={chartHeight + 20}>
      <Rect x="0" y={chartHeight} width={chartWidth} height={1} fill="#94A3B8" />
      {data.map((d, i) => {
        const roomsH = (d.rooms / maxVal) * chartHeight;
        const x = 30 + (i * (barWidth * 3 + spacing));
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={chartHeight - roomsH} width={barWidth} height={roomsH} fill={COLORS.NAVY} />
            <Text x={x} y={chartHeight + 10} style={{ fontSize: 6, fill: COLORS.TEXT_SUB }}>{d.month}</Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
};

const AuditReportDocument = ({ data }: { data: AuditData }) => (
  <Document title={`JOE Cafeteria Audit - ${data.hotelName}`}>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brandName}>JOE CAFETERIA & LOUNGE</Text>
          <Text style={styles.reportSubtitle}>Executive Performance Audit</Text>
        </View>
        <View>
          <Text style={styles.periodBadge}>Report Period: {data.period}</Text>
          <Text style={[styles.periodBadge, { marginTop: 4}]}>Audit Grade: PREMIUM</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Void Rate</Text>
          <Text style={styles.kpiValue}>{data.kpis.occupancy.value}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Avg Ticket</Text>
          <Text style={styles.kpiValue}>{data.kpis.revpar.value}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Order Count</Text>
          <Text style={styles.kpiValue}>{data.kpis.roomsSold.value}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Revenue</Text>
          <Text style={styles.kpiValue}>{data.kpis.totalRevenue.value}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Revenue Trend (6-H Period)</Text>
          <SvgRevenueBarChart data={data.monthlyRevenue} />
        </View>
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Top Product Mix</Text>
          <View style={styles.scoreList}>
            {data.channels.map((ch, i) => (
              <View key={i} style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>{ch.name}</Text>
                <Text style={styles.scoreVal}>{ch.revenue}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>JOE AUTOMATION • PROPRIETARY DIAGNOSTIC REPORT • CONFIDENTIAL</Text>
        <Text style={styles.footerText}>Page 1 of 1</Text>
      </View>
    </Page>
  </Document>
);

interface AuditDownloadProps {
  realReport?: any;
  period?: string;
  className?: string; 
}

const AuditDownloadButton: React.FC<AuditDownloadProps> = ({ 
  realReport,
  period = 'Today',
  className = ''
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const startAuditFlow = async () => {
    if (status === 'loading') return;
    setStatus('loading');
    try {
      await new Promise(res => setTimeout(res, 800)); 
      
      const auditData: AuditData = {
        hotelName: "JOE Cafeteria",
        period: period,
        kpis: { 
          occupancy: { value: `${realReport?.summary?.voidRate?.toFixed(1) || 0}%`, change: 0 }, 
          revpar: { value: `₹${Math.round(realReport?.summary?.avgTicket || 0)}`, change: 0 }, 
          adr: { value: `₹${Math.round(realReport?.summary?.avgTicket || 0)}`, change: 0 }, 
          gop: { value: "---", change: 0 }, 
          totalRevenue: { value: `₹${realReport?.summary?.totalRevenue?.toLocaleString() || '0'}`, change: 0 }, 
          roomsSold: { value: `${realReport?.summary?.totalOrders || 0}`, change: 0 }
        },
        monthlyRevenue: (realReport?.revenueTrend || []).slice(0, 6).map((r: any) => ({
          month: r.label,
          rooms: r.revenue,
          fb: 0,
          ancillary: 0
        })),
        revenueMix: (realReport?.paymentSplit || []).map((p: any) => ({
          label: p.name,
          percentage: Math.round((p.value / (realReport?.summary?.totalRevenue || 1)) * 100)
        })),
        guestScores: { nps: 92, cleanliness: 9.8, service: 9.6, fb: 9.4, value: 9.5 },
        channels: (realReport?.itemSales || []).slice(0, 4).map((it: any) => ({
          name: it.name,
          share: 0,
          roomNights: it.quantity,
          revenue: `₹${it.revenue.toLocaleString()}`,
          trend: "up"
        })),
        costEfficiency: [
            { department: "Kitchen Operations", costPerRoom: "Optimized", status: "On Target" },
        ],
        forecast: { occupancy30day: 100, actionFlags: ["No leakage detected."] }
      };

      const blob = await pdf(<AuditReportDocument data={auditData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `JOE_Executive_Audit_${period.replace(/\s+/g, '')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const baseStyles = "flex items-center justify-center gap-3 px-8 py-3.5 font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 active:scale-95 group relative overflow-hidden";

  if (status === 'loading') return (
    <button disabled className={`${baseStyles} bg-slate-900 text-slate-400 cursor-wait ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin" />
      Analyzing Data...
    </button>
  );

  if (status === 'success') return (
    <button disabled className={`${baseStyles} bg-emerald-600 text-white ${className}`}>
      <CheckCircle2 className="w-4 h-4" />
      Audit Ready
    </button>
  );

  return (
    <button onClick={startAuditFlow} className={`${baseStyles} bg-[#0A192F] text-white hover:bg-slate-800 ${className}`}>
      <Download className="w-4 h-4" />
      Executive Audit
    </button>
  );
};

export default AuditDownloadButton;
