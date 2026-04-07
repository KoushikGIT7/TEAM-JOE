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
  BG: '#F8FAFC',
  CARD: '#FFFFFF',
  TEXT_MAIN: '#0F172A',
  TEXT_SUB: '#64748B',
  SUCCESS: '#10B981',
  ERROR: '#EF4444',
  WARNING: '#F59E0B',
  SOFT_BLUE: '#3B82F6',
  SOFT_SLATE: '#F1F5F9'
};

const styles = StyleSheet.create({
  page: { display: 'flex', flexDirection: 'column', backgroundColor: COLORS.BG, padding: 35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottomWidth: 3, borderBottomColor: COLORS.NAVY, paddingBottom: 15 },
  brandBlock: { flexDirection: 'column' },
  brandName: { fontSize: 24, color: COLORS.NAVY, fontWeight: 'bold' },
  reportSubtitle: { fontSize: 10, color: COLORS.GOLD, fontWeight: 'bold', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase' },
  periodBadge: { fontSize: 9, color: COLORS.TEXT_SUB, textAlign: 'right' },
  sectionLabel: { fontSize: 10, color: COLORS.GOLD, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.GOLD, paddingLeft: 8 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  kpiCard: { flex: 1, backgroundColor: COLORS.CARD, padding: 15, borderRadius: 8, marginHorizontal: 4, borderBottomWidth: 2, borderBottomColor: '#E2E8F0' },
  kpiLabel: { fontSize: 7, color: COLORS.TEXT_SUB, textTransform: 'uppercase', marginBottom: 5, fontWeight: 'bold' },
  kpiValue: { fontSize: 16, color: COLORS.NAVY, fontWeight: 'bold' },
  insightBlock: { backgroundColor: COLORS.NAVY, padding: 20, borderRadius: 12, marginBottom: 30 },
  insightTitle: { fontSize: 11, color: COLORS.GOLD, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  insightItem: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
  insightDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.GOLD, marginRight: 8 },
  insightText: { fontSize: 9, color: '#F1F5F9', flex: 1, lineHeight: 1.4 },
  
  // High-Performance Ledger Style
  table: { width: '100%', marginBottom: 30, borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.NAVY, paddingVertical: 12, paddingHorizontal: 15 },
  th: { flex: 1, color: '#FFFFFF', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  thRight: { flex: 1, color: '#FFFFFF', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  td: { flex: 1, color: COLORS.TEXT_MAIN, fontSize: 9, fontWeight: 'medium' },
  tdBold: { flex: 1, color: COLORS.NAVY, fontSize: 9, fontWeight: 'bold' },
  tdRight: { flex: 1, color: COLORS.NAVY, fontSize: 9, fontWeight: 'bold', textAlign: 'right' },
  statusBadge: { fontSize: 8, fontWeight: 'bold', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, textTransform: 'uppercase' },

  footer: { position: 'absolute', bottom: 25, left: 35, right: 35, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
  footerText: { fontSize: 7, color: COLORS.TEXT_SUB }
});

const SvgPieChart = ({ bevShare }: { bevShare: number }) => (
    <View style={{ width: 120, alignItems: 'center' }}>
        <Text style={{ fontSize: 7, fontWeight: 'bold', marginBottom: 10, color: COLORS.TEXT_SUB }}>UPSELL SHARE</Text>
        <Svg width={60} height={60}>
            <Circle cx={30} cy={30} r={25} stroke="#E2E8F0" strokeWidth={6} fill="none" />
            <Circle 
                cx={30} cy={30} r={25} 
                stroke={COLORS.GOLD} strokeWidth={6} fill="none" 
                strokeDasharray={`${Math.max(0.1, (bevShare/100) * 157)} 157`} 
            />
        </Svg>
        <Text style={{ fontSize: 10, fontWeight: 'bold', marginTop: 5, color: COLORS.NAVY }}>{bevShare.toFixed(1)}%</Text>
    </View>
);

const AuditReportDocument = ({ data }: { data: AuditData }) => {
  // 🛡️ INDUSTRIAL DEDUPLICATION ENGINE
  const uniqueMap = new Map();
  (data.recentOrders || []).forEach(o => {
     const cleanId = (o.id || 'N/A').toUpperCase();
     if (!uniqueMap.has(cleanId) && cleanId !== 'UNDEFINED' && cleanId !== 'NULL') {
        uniqueMap.set(cleanId, o);
     }
  });
  const auditEntries = Array.from(uniqueMap.values()).slice(0, 50);

  return (
    <Document title={`JOE Auditure Certification - ${data.period}`}>
      {/* PAGE 1: STRATEGIC INTEL */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>JOE CAFETERIA & LOUNGE</Text>
            <Text style={styles.reportSubtitle}>Executive Performance Audit</Text>
          </View>
          <View>
            <Text style={styles.periodBadge}>Audit ID: {Math.random().toString(36).substr(2, 6).toUpperCase()}</Text>
            <Text style={styles.periodBadge}>Period: {data.period}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Shift intelligence Summary</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}><Text style={styles.kpiLabel}>Revenue</Text><Text style={styles.kpiValue}>INR {(data.summary?.totalRevenue || 0).toLocaleString()}</Text></View>
          <View style={styles.kpiCard}><Text style={styles.kpiLabel}>Total Orders</Text><Text style={styles.kpiValue}>{data.summary?.totalOrders || 0}</Text></View>
          <View style={styles.kpiCard}><Text style={styles.kpiLabel}>Avg Ticket</Text><Text style={styles.kpiValue}>INR {Math.round(data.summary?.avgTicket || 0)}</Text></View>
          <View style={styles.kpiCard}><Text style={styles.kpiLabel}>Void Rate</Text><Text style={{ ...styles.kpiValue, color: (data.summary?.voidRate || 0) > 5 ? COLORS.ERROR : COLORS.SUCCESS }}>{(data.summary?.voidRate || 0).toFixed(1)}%</Text></View>
        </View>

        <View style={styles.insightBlock}>
          <Text style={styles.insightTitle}>OPERATIONAL CONTROL & STAFFING</Text>
          <View style={styles.insightItem}><View style={styles.insightDot} /><Text style={styles.insightText}>CRITICAL RUSH ALERT: Detected at {data.insights?.peakHour || 'Rush'}. Peak Throughput: {data.insights?.peakThroughput || 0} settlements/hr.</Text></View>
          <View style={styles.insightItem}><View style={styles.insightDot} /><Text style={styles.insightText}>ACTIONABLE: Deploy additional handheld scan assistants 15 minutes prior to this surge interval.</Text></View>
          <View style={styles.insightItem}><View style={styles.insightDot} /><Text style={styles.insightText}>WASTE MONITOR: Revenue lost to rejections/voids is INR {data.insights?.wasteAlert || 0}. Tighten UTR entry flow.</Text></View>
        </View>

        <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={{ flex: 1, backgroundColor: COLORS.CARD, padding: 20, borderRadius: 12, borderBottomWidth: 2, borderBottomColor: COLORS.GOLD }}>
                <Text style={styles.insightTitle}>MENU & REVENUE INSIGHTS</Text>
                <Text style={{ fontSize: 9, color: COLORS.NAVY, fontWeight: 'bold' }}>• High Demand: &apos;{data.insights?.flagshipProduct || 'N/A'}&apos; dominates Flagship volume.</Text>
                <Text style={{ fontSize: 9, color: COLORS.NAVY, marginTop: 6 }}>• Bundle Up: Beverages represent {data.insights?.beverageShare.toFixed(1)}% of revenue mix. Strategy: Bundle with meals.</Text>
                <Text style={{ fontSize: 9, color: COLORS.NAVY, marginTop: 6 }}>• Avg Ticket: INR {Math.round(data.summary?.avgTicket || 0)}. Opportunity for INR 75 &quot;Boss Combos&quot;.</Text>
            </View>
            <SvgPieChart bevShare={data.insights?.beverageShare || 0} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>I HEREBY CERTIFY THAT THIS RECONCILIATION DATA IS ACCURATE AS PER SYSTEM LOGS</Text>
          <Text style={styles.footerText}>PAGE 1 of 2</Text>
        </View>
      </Page>

      {/* PAGE 2: CLEAN AUDIT LEDGER */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}><Text style={styles.brandName}>TRANSACTIONAL AUDIT LEDGER</Text><Text style={styles.periodBadge}>{data.period}</Text></View>
        
        <View style={styles.table}>
            <View style={styles.tableHeader}>
                <Text style={styles.th}>Order ID</Text>
                <Text style={styles.th}>Time</Text>
                <Text style={{ ...styles.th, flex: 1.5 }}>Customer Name</Text>
                <Text style={styles.thRight}>Amount</Text>
                <Text style={styles.thRight}>Status</Text>
            </View>
            {auditEntries.map((order, i) => (
                <View key={order.id} style={{ ...styles.tableRow, backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                    <Text style={styles.tdBold}>#{order.id.slice(-6).toUpperCase()}</Text>
                    <Text style={styles.td}>{order.time || '--'}</Text>
                    <Text style={{ ...styles.td, flex: 1.5, color: COLORS.TEXT_SUB }}>{order.customer || 'Guest User'}</Text>
                    <Text style={styles.tdRight}>INR {(order.amount || 0).toLocaleString()}</Text>
                    <Text style={{ ...styles.tdRight, color: order.status === 'SUCCESS' ? COLORS.SUCCESS : COLORS.ERROR }}>{order.status || 'VOIDED'}</Text>
                </View>
            ))}
            {auditEntries.length === 0 && (
                <View style={styles.tableRow}><Text style={{...styles.td, textAlign: 'center', flex: 1, paddingVertical: 40}}>NO TRANSACTION LOGS DETECTED FOR THIS INTERVAL.</Text></View>
            )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>JOE AUTOMATIONS EXECUTIVE LEDGER • CONFIDENTIAL</Text>
          <Text style={styles.footerText}>PAGE 2 of 2</Text>
        </View>
      </Page>
    </Document>
  );
};

interface AuditDownloadProps { realReport?: any; period?: string; className?: string; }

const AuditDownloadButton: React.FC<AuditDownloadProps> = ({ realReport, period = 'Today', className = '' }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const generateAudit = async () => {
    if (!realReport || status === 'loading') return;
    setStatus('loading');
    try {
      const stats = realReport.summary || {};
      const rawOrders = realReport.orders || [];
      const itemSales = realReport.itemSales || [];
      const rushData = realReport.dailyTrend || [];

      // 🛡️ ROOT DEDUPLICATION
      const uMap = new Map();
      rawOrders.forEach((o: any) => { if (o.id && !uMap.has(o.id)) uMap.set(o.id, o); });
      const orders = Array.from(uMap.values()).sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

      const maxRush = rushData.length > 0 ? rushData.reduce((prev: any, cur: any) => (prev.orders > cur.orders) ? prev : cur, { label: '--', orders: 0 }) : { label: '--', orders: 0 };
      const flagship = itemSales.length > 0 ? [...itemSales].sort((a: any, b: any) => b.quantity - a.quantity)[0] : { name: 'N/A' };
      const bevSales = itemSales.filter((i: any) => ['coffee', 'tea', 'milk', 'water', 'juice', 'beverage'].some(tag => i.name.toLowerCase().includes(tag))).reduce((acc: number, cur: any) => acc + (cur.revenue || 0), 0);
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
        recentOrders: orders.slice(0, 100).map((o: any) => ({
            id: o.id,
            time: new Date(o.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase(),
            customer: o.userName || 'Guest User',
            amount: Number(o.totalAmount || 0),
            status: o.paymentStatus === 'SUCCESS' ? 'SUCCESS' : 'VOIDED'
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
      <Loader2 className="w-4 h-4 animate-spin" /> Syncing Audit...
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
