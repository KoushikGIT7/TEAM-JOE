"use client";

import React, { useState } from 'react';
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  FileText
} from 'lucide-react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  pdf, 
  Svg, 
  Rect,
  Circle,
  Path
} from '@react-pdf/renderer';

// ==========================================
// 🛡️ PREMIUM DATA INTERFACES
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
  recentOrders: Array<{ id: string; time: string; customer: string; amount: number; status: string }>;
}

const COLORS = {
  NAVY: '#0A192F',
  GOLD: '#D4AF37',
  BG: '#F4F7FB',
  CARD: '#FFFFFF',
  TEXT_MAIN: '#1E293B',
  TEXT_SUB: '#64748B',
  SUCCESS: '#10B981',
  ERROR: '#EF4444',
  WARNING: '#F59E0B',
  SOFT_BLUE: '#3B82F6',
  SOFT_SLATE: '#F1F5F9'
};

const styles = StyleSheet.create({
  page: { display: 'flex', flexDirection: 'column', backgroundColor: COLORS.BG, padding: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 3, borderBottomColor: COLORS.NAVY, paddingBottom: 15 },
  brandBlock: { flexDirection: 'column' },
  brandName: { fontSize: 24, color: COLORS.NAVY, fontWeight: 'bold' },
  reportSubtitle: { fontSize: 10, color: COLORS.GOLD, fontWeight: 'bold', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },
  periodBadge: { fontSize: 9, color: COLORS.TEXT_SUB, textAlign: 'right' },
  sectionLabel: { fontSize: 10, color: COLORS.GOLD, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.GOLD, paddingLeft: 8 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  kpiCard: { flex: 1, backgroundColor: COLORS.CARD, padding: 15, borderRadius: 4, marginHorizontal: 4, borderBottomWidth: 2, borderBottomColor: COLORS.SOFT_SLATE },
  kpiLabel: { fontSize: 7, color: COLORS.TEXT_SUB, textTransform: 'uppercase', marginBottom: 5, fontWeight: 'bold' },
  kpiValue: { fontSize: 16, color: COLORS.NAVY, fontWeight: 'bold' },
  insightBlock: { backgroundColor: COLORS.NAVY, padding: 20, borderRadius: 8, marginBottom: 25 },
  insightTitle: { fontSize: 11, color: COLORS.GOLD, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  insightItem: { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  insightDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.GOLD, marginRight: 8 },
  insightText: { fontSize: 9, color: '#FFFFFF', flex: 1 },
  table: { width: '100%', marginBottom: 30 },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.NAVY, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
  th: { flex: 1, color: '#FFFFFF', fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.SOFT_SLATE, backgroundColor: '#FFFFFF' },
  td: { flex: 1, color: COLORS.TEXT_MAIN, fontSize: 8 },
  tdBold: { flex: 1, color: COLORS.NAVY, fontSize: 8, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.SOFT_SLATE, paddingTop: 10 },
  footerText: { fontSize: 7, color: COLORS.TEXT_SUB }
});

const SvgLineChart = ({ data }: { data: any[] }) => {
  const width = 500;
  const height = 100;
  // Safety check for empty traffic data
  if (!data || data.length < 2) return <View><Text style={{fontSize: 8}}>No traffic data available</Text></View>;
  
  const points = data.map((d, i) => `${(i * (width / (data.length - 1)))},${height - (d.orders || 0) * 10}`).join(' ');
  
  return (
    <View style={{ height: 120, backgroundColor: COLORS.CARD, padding: 10, borderRadius: 8, marginBottom: 20 }}>
      <Text style={{ fontSize: 8, fontWeight: 'bold', color: COLORS.NAVY, marginBottom: 10 }}>SHIFT VELOCITY (ORDERS/HR)</Text>
      <Svg width={width} height={height}>
         <Path d={`M 0 ${height} L ${points} L ${width} ${height} Z`} fill={COLORS.SOFT_BLUE} opacity={0.2} />
         <Path d={`M 0 ${height} L ${points}`} stroke={COLORS.SOFT_BLUE} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
};

const SvgPieChart = ({ bevShare }: { bevShare: number }) => {
    return (
        <View style={{ width: 120, alignItems: 'center' }}>
            <Text style={{ fontSize: 7, fontWeight: 'bold', marginBottom: 10 }}>UPSELL SHARE</Text>
            <Svg width={60} height={60}>
                <Circle cx="30" cy="30" r="25" stroke={COLORS.SOFT_SLATE} strokeWidth="6" fill="none" />
                {/* 🚀 Safety Guard: Ensure dash length is > 0 to avoid @react-pdf/renderer dash error */}
                <Circle 
                    cx={30} cy={30} r={25} 
                    stroke={COLORS.GOLD} strokeWidth={6} fill="none" 
                    strokeDasharray={`${Math.max(0.1, (bevShare/100) * 157)} 157`} 
                />
            </Svg>
            <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 5 }}>{bevShare.toFixed(1)}%</Text>
        </View>
    );
};

const AuditReportDocument = ({ data }: { data: AuditData }) => {
  const uniqueOrders = Array.from(new Map((data.recentOrders || []).map(o => [o.id, o])).values()).slice(0, 25);

  return (
    <Document title={`JOE Auditure - ${data.period}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>JOE CAFETERIA & LOUNGE</Text>
            <Text style={styles.reportSubtitle}>Executive Performance Audit</Text>
          </View>
          <View>
            <Text style={styles.periodBadge}>Report ID: AUD-{Math.random().toString(36).substr(2, 4).toUpperCase()}</Text>
            <Text style={styles.periodBadge}>Period: {data.period}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Shift Intelligence KPIs</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Revenue</Text>
            <Text style={styles.kpiValue}>₹{(data.summary?.totalRevenue || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Settlements</Text>
            <Text style={styles.kpiValue}>{data.summary?.totalOrders || 0}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Avg Ticket</Text>
            <Text style={styles.kpiValue}>₹{Math.round(data.summary?.avgTicket || 0)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Void Rate</Text>
            <Text style={{ ...styles.kpiValue, color: (data.summary?.voidRate || 0) > 5 ? COLORS.ERROR : COLORS.SUCCESS }}>
              {(data.summary?.voidRate || 0).toFixed(1)}%
            </Text>
          </View>
        </View>

        <View style={styles.insightBlock}>
          <Text style={styles.insightTitle}>TRAFFIC SYNC & STAFFING OPTIMIZATION</Text>
          <View style={styles.insightItem}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>CRITICAL RUSH: Detected at {data.insights?.peakHour || 'Rush'}. Throughput: {data.insights?.peakThroughput || 0}/hr.</Text>
          </View>
          <View style={styles.insightItem}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>RECOMMENDATION: Deploy additional handheld scan assistants 15 minutes prior to this window.</Text>
          </View>
          <View style={styles.insightItem}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>WASTE ALERT: Detected ₹{data.insights?.wasteAlert || 0} in rejected/voided revenue.</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={{ flex: 1, backgroundColor: COLORS.CARD, padding: 15, borderRadius: 8 }}>
                <Text style={styles.insightTitle}>MENU & INVENTORY RECOMMENDATIONS</Text>
                <Text style={{ fontSize: 9, color: COLORS.NAVY }}>• Leverage beverages ({data.insights?.beverageShare.toFixed(1)}% of mix).</Text>
                <Text style={{ fontSize: 9, color: COLORS.NAVY, marginTop: 4 }}>• Target average ticket growth to ₹75 via meal combos.</Text>
            </View>
            <SvgPieChart bevShare={data.insights?.beverageShare || 0} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SYSTEM CERTIFIED RECONCILIATION LOG</Text>
          <Text style={styles.footerText}>PAGE 1 of 2</Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
            <Text style={styles.brandName}>TRANSACTIONAL LEDGER</Text>
        </View>
        <View style={styles.table}>
            <View style={styles.tableHeader}>
                <Text style={styles.th}>ID</Text>
                <Text style={styles.th}>Time</Text>
                <Text style={styles.th}>Customer</Text>
                <Text style={styles.th}>Amount</Text>
                <Text style={styles.th}>Status</Text>
            </View>
            {uniqueOrders.map((order, i) => (
                <View key={order.id} style={{ ...styles.tableRow, backgroundColor: i % 2 === 0 ? '#FFFFFF' : COLORS.SOFT_SLATE }}>
                    <Text style={styles.tdBold}>#{order.id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.td}>{order.time}</Text>
                    <Text style={styles.td}>{order.customer}</Text>
                    <Text style={styles.tdBold}>₹{order.amount}</Text>
                    <Text style={{ ...styles.td, color: order.status === 'SUCCESS' ? COLORS.SUCCESS : COLORS.ERROR, fontWeight: 'bold' }}>{order.status}</Text>
                </View>
            ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>JOE AUTOMATION • CONFIDENTIAL</Text>
          <Text style={styles.footerText}>PAGE 2 of 2</Text>
        </View>
      </Page>
    </Document>
  );
};

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

  const generateAudit = async () => {
    if (!realReport || status === 'loading') return;
    setStatus('loading');
    try {
      // 🔮 PRINCIPAL INTELLIGENCE: Aggregate & Deduplicate Transactions
      const stats = realReport.summary || {};
      const rawOrders = realReport.orders || [];
      const itemSales = realReport.itemSales || [];
      const rushData = realReport.dailyTrend || [];

      // Deduplicate by ID and Sort by Time (Descending)
      const uniqueOrderMap = new Map();
      rawOrders.forEach((o: any) => {
         if (o.id && !uniqueOrderMap.has(o.id)) {
            uniqueOrderMap.set(o.id, o);
         }
      });
      
      const sortedUniqueOrders = Array.from(uniqueOrderMap.values())
         .sort((a: any, b: any) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime()));

      // 🚦 RE-ALIGN ANALYTICS PULSE
      const maxRush = rushData.length > 0 
        ? rushData.reduce((prev: any, cur: any) => (prev.orders > cur.orders) ? prev : cur, { label: '--', orders: 0 }) 
        : { label: '--', orders: 0 };
      
      const orders = sortedUniqueOrders;
      
      const flagship = itemSales.length > 0 
        ? [...itemSales].sort((a: any, b: any) => b.quantity - a.quantity)[0] 
        : { name: 'N/A' };
      
      const bevSales = itemSales.filter((i: any) => 
        ['coffee', 'tea', 'milk', 'water', 'juice', 'beverage'].some(tag => i.name.toLowerCase().includes(tag))
      ).reduce((acc: number, cur: any) => acc + cur.revenue, 0);
      const bevShare = stats.totalRevenue > 0 ? (bevSales / stats.totalRevenue) * 100 : 0;

      const auditData: AuditData = {
        hotelName: "JOE Cafeteria",
        period: period,
        summary: {
            totalRevenue: stats.totalRevenue || 0,
            totalOrders: stats.totalOrders || 0,
            avgTicket: stats.avgTicket || 0,
            voidRate: stats.voidRate || 0
        },
        insights: {
            peakHour: maxRush.label || '13:00',
            peakThroughput: maxRush.orders || 0,
            flagshipProduct: flagship.name,
            beverageShare: bevShare,
            wasteAlert: Math.round((stats.voidRate || 0) * (stats.totalRevenue || 0) / 100)
        },
        itemSales: itemSales,
        recentOrders: orders.slice(0, 50).map((o: any) => ({
            id: o.id,
            time: new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            customer: o.userName || 'Guest User',
            amount: o.totalAmount,
            status: o.paymentStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILED'
        }))
      };

      const blob = await pdf(<AuditReportDocument data={auditData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `JOE_AUDIT_${period.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error('Audit Failure:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const baseStyles = "flex items-center justify-center gap-3 px-8 py-3.5 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all duration-500 active:scale-95 group relative overflow-hidden";

  if (status === 'loading') return (
    <button disabled className={`${baseStyles} bg-slate-900 text-slate-400 cursor-wait ${className}`}>
      <Loader2 className="w-4 h-4 animate-spin" />
      Syncing Intelligence...
    </button>
  );

  return (
    <button onClick={generateAudit} className={`${baseStyles} bg-[#0A192F] text-white hover:bg-slate-800 ${className}`}>
      {status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <FileText className="w-4 h-4 text-[#D4AF37]" />}
      {status === 'success' ? 'Audit Delivered' : 'Enterprise Audit'}
    </button>
  );
};

export default AuditDownloadButton;
