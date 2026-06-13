import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
   LogOut, Clock, RefreshCw, Search, X, AlertCircle, ChevronRight, 
   ShieldCheck, AlertTriangle, ImageIcon, Calculator, CheckCircle2, 
   XCircle, Volume2, VolumeX, Hand
} from 'lucide-react';
import { UserProfile, Order, WalletRechargeRequest } from '../../types';
import {
   listenToPendingCashOrders, confirmCashPayment, rejectCashPayment,
   listenToAllOrders, listenToMenu, getDailyStatsRange
} from '../../services/firestore-db';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { joeSounds } from '../../utils/audio';
import { sonicVoice } from '../../services/voice-engine';
import { offlineDetector } from '../../utils/offlineDetector';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { fetchReport } from '../../services/reporting';
import AuditDownloadButton from '../../components/AuditDownloadButton';
import { listenToAllRechargeRequests, approveRechargeRequest, rejectRechargeRequest } from '../../services/wallet';
import { triggerOneSignalWebhook } from '../../services/onesignal-webhook';

interface CashierViewProps {
   profile: UserProfile;
   onLogout: () => void;
}

type CashierTab = 'RECHARGES' | 'CASH_ORDERS' | 'ANALYTICS' | 'LEDGER' | 'SUMMARY';

const COLORS = ['#b76dff', '#4ae176', '#3b82f6', '#f43f5e'];

// ─── modular card: recharge request ───
const RechargeRequestCard: React.FC<{
  req: WalletRechargeRequest;
  onApprove: (id: string) => void;
  rejectId: string | null;
  setRejectId: (id: string | null) => void;
  walletRejectNote: Record<string, string>;
  setWalletRejectNote: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  walletActionLoading: string | null;
  handleRejectRechargeSubmit: (id: string) => void;
  setWalletScreenshotModal: (url: string | null) => void;
  formatTime: (ts?: number) => string;
}> = ({
  req, onApprove, rejectId, setRejectId, walletRejectNote, setWalletRejectNote,
  walletActionLoading, handleRejectRechargeSubmit, setWalletScreenshotModal, formatTime
}) => {
  const [studentProfile, setStudentProfile] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, "users", req.uid)).then(snap => {
      if (snap.exists()) {
        setStudentProfile(snap.data());
      }
    });
  }, [req.uid]);

  const customTitle = studentProfile?.customTitle || '';
  const customFrameColor = studentProfile?.customFrameColor || '';
  const customAvatarDecoration = studentProfile?.customAvatarDecoration || '';
  
  return (
    <div className={`p-5 rounded-2xl border transition-all glass-bg relative overflow-hidden ${
      customFrameColor ? `border-2 ${customFrameColor} neon-shadow-purple` : 'border-white/5 bg-surface-mid/60'
    } space-y-4 hover:border-white/10`}>
       {customAvatarDecoration && (
         <div className="absolute top-2 right-2 text-lg animate-pulse select-none z-20">
           {customAvatarDecoration}
         </div>
       )}
       <div className="flex justify-between items-start">
          <div className="space-y-1">
             <span className="font-mono text-[9px] text-brand-purple bg-brand-purple/10 border border-brand-purple/20 px-2.5 py-0.5 rounded-full font-bold">
                RECHARGE REQUEST
             </span>
             <h4 className="font-display font-black text-sm text-white uppercase truncate max-w-[160px] flex items-center gap-1.5 mt-1">
                {req.studentName}
             </h4>
             {customTitle && (
               <span className="text-[9px] text-[#ddb7ff] bg-[#b76dff]/15 px-2 py-0.5 rounded border border-[#b76dff]/25 font-bold font-mono inline-block">
                 {customTitle}
               </span>
             )}
          </div>
          <span className="font-mono text-lg font-black text-brand-purple-light">
             ₹{req.amount}
          </span>
       </div>

       <div className="space-y-1.5 text-xs bg-surface-lowest border border-white/5 p-3 rounded-xl font-mono text-on-surface-variant">
          <div className="flex justify-between">
             <span>UTR String:</span>
             <span className="text-white font-bold">{req.utrNumber}</span>
          </div>
          <div className="flex justify-between">
             <span>Timestamp:</span>
             <span className="text-white">{formatTime(req.createdAt)}</span>
          </div>
       </div>

       {req.screenshotUrl && (
          <button 
             onClick={() => setWalletScreenshotModal(req.screenshotUrl)}
             className="w-full flex items-center justify-between gap-1.5 text-xs font-mono text-brand-purple-light bg-brand-purple-dark/15 p-2.5 rounded-xl border border-brand-purple/20 hover:bg-brand-purple-dark/25 transition cursor-pointer"
          >
             <span className="flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5 shrink-0" /> View Receipt Image</span>
             <ChevronRight className="w-4 h-4" />
          </button>
       )}

       {rejectId === req.id ? (
          <div className="space-y-2 pt-3 border-t border-white/5">
             <input
                type="text"
                required
                className="w-full h-10 bg-surface-lowest border border-white/10 rounded-xl px-3 text-xs font-sans text-white focus:outline-none placeholder:text-zinc-700"
                placeholder="Specify reason (e.g. UTR doesn't match)"
                value={walletRejectNote[req.id] || ''}
                onChange={(e) => setWalletRejectNote(prev => ({ ...prev, [req.id]: e.target.value }))}
             />
             <div className="flex gap-2">
                <button
                   onClick={() => handleRejectRechargeSubmit(req.id)}
                   disabled={!!walletActionLoading}
                   className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-mono text-xs font-bold transition cursor-pointer disabled:opacity-40"
                >
                   REJECT
                </button>
                <button
                   onClick={() => setRejectId(null)}
                   className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-mono text-xs cursor-pointer transition"
                >
                   CANCEL
                </button>
             </div>
          </div>
       ) : (
          <div className="flex gap-2.5 pt-3 border-t border-white/5 font-mono">
             <button
                onClick={() => onApprove(req.id)}
                disabled={!!walletActionLoading}
                className="flex-1 h-10 rounded-xl bg-brand-purple hover:bg-brand-purple/85 text-white text-[11px] font-black tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 transition active:scale-95"
             >
                <CheckCircle2 className="w-4 h-4" />
                CONFIRM APPROVE
             </button>
             <button
                onClick={() => {
                   setRejectId(req.id);
                   setWalletRejectNote(prev => ({ ...prev, [req.id]: '' }));
                }}
                className="px-4 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95"
             >
                <XCircle className="w-4 h-4" />
                REJECT
             </button>
          </div>
       )}
    </div>
  );
};

// ─── modular card: cash order with swipe gestures ───
const CashOrderCard: React.FC<{
  order: Order;
  hasConflict: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  confirming: boolean;
  rejecting: boolean;
}> = ({ order, hasConflict, onConfirm, onReject, confirming, rejecting }) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [studentProfile, setStudentProfile] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, "users", order.userId)).then(snap => {
      if (snap.exists()) {
        setStudentProfile(snap.data());
      }
    });
  }, [order.userId]);

  const customTitle = studentProfile?.customTitle || '';
  const customFrameColor = studentProfile?.customFrameColor || '';
  const customAvatarDecoration = studentProfile?.customAvatarDecoration || '';

  const minSwipeDistance = 80;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart;
    setSwipeOffset(Math.max(-200, Math.min(200, diff)));
  };

  const onTouchEnd = () => {
    setIsSwiping(false);
    if (!touchStart || !touchEnd) {
      setSwipeOffset(0);
      return;
    }
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe) {
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      onConfirm(order.id);
    } else if (isLeftSwipe) {
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      onReject(order.id);
    }
    setSwipeOffset(0);
  };

  return (
    <div 
      onTouchStart={onTouchStart}
      onTouchMove={(e) => {
        setTouchEnd(e.targetTouches[0].clientX);
        onTouchMove(e);
      }}
      onTouchEnd={onTouchEnd}
      style={{ transform: `translateX(${swipeOffset}px)` }}
      className={`p-5 rounded-2xl border transition-all relative overflow-hidden select-none touch-none duration-150 glass-bg ${
        swipeOffset > 20 
          ? 'border-brand-purple bg-brand-purple/10' 
          : swipeOffset < -20 
            ? 'border-rose-500 bg-rose-500/10' 
            : customFrameColor 
              ? `border-2 ${customFrameColor} neon-shadow-purple` 
              : hasConflict 
                ? 'border-amber-500/30' 
                : 'border-white/5 bg-surface-mid/60'
      } space-y-4`}
    >
      {swipeOffset > 30 && (
        <div className="absolute inset-y-0 left-0 bg-brand-purple/20 w-12 flex items-center justify-center border-r border-brand-purple/30 z-20">
          <CheckCircle2 className="w-6 h-6 text-brand-purple-light animate-pulse" />
        </div>
      )}
      {swipeOffset < -30 && (
        <div className="absolute inset-y-0 right-0 bg-rose-500/20 w-12 flex items-center justify-center border-l border-rose-500/30 z-20">
          <XCircle className="w-6 h-6 text-rose-400 animate-pulse" />
        </div>
      )}

      {customAvatarDecoration && (
        <div className="absolute top-2 right-2 text-lg animate-pulse select-none z-20">
          {customAvatarDecoration}
        </div>
      )}

      <div className="flex justify-between items-start">
         <div className="space-y-1">
            <span className="font-mono text-[9px] text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20 px-2.5 py-0.5 rounded-full font-bold">
               PENDING CASH PAYMENT
            </span>
            <h4 className="font-display font-black text-sm text-white uppercase mt-1">
               TOKEN {order.tokenNumber}
            </h4>
            <p className="font-sans text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
               <span>{order.userName}</span>
               {customTitle && (
                 <span className="text-[9px] text-[#ddb7ff] bg-[#b76dff]/15 px-2 py-0.5 rounded border border-[#b76dff]/25 font-bold font-mono inline-block">
                   {customTitle}
                 </span>
               )}
            </p>
         </div>
         <span className="font-mono text-lg font-black text-brand-purple-light">
            ₹{order.totalAmount}
         </span>
      </div>

      <div className="space-y-1 text-xs text-zinc-300 bg-surface-lowest border border-white/5 p-3 rounded-xl font-mono">
         {order.items.map((it, idx) => (
            <div key={idx} className="flex justify-between">
               <span>{it.quantity}x {it.name}</span>
               <span className="text-zinc-500">₹{it.price * it.quantity}</span>
            </div>
         ))}
      </div>

      <div className="flex gap-2.5 pt-3 border-t border-white/5 font-mono">
         <button
            onClick={() => onConfirm(order.id)}
            disabled={confirming}
            className="flex-1 h-10 rounded-xl bg-brand-purple hover:bg-brand-purple/85 text-white text-[11px] font-black tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-40 active:scale-95"
         >
            <CheckCircle2 className="w-4 h-4" />
            CONFIRM RECEIVED
         </button>
         <button
            onClick={() => onReject(order.id)}
            disabled={rejecting}
            className="px-4 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-40 active:scale-95"
         >
            <XCircle className="w-4 h-4" />
            REJECT
         </button>
      </div>

      <div className="text-[9px] font-mono text-zinc-500 text-center flex items-center justify-center gap-1 select-none pointer-events-none opacity-60">
        <Hand className="w-3.5 h-3.5 rotate-90" />
        <span>Swipe Right to confirm, Swipe Left to reject</span>
      </div>
    </div>
  );
};

// ─── main views panel component ───
const CashierView: React.FC<CashierViewProps> = ({ profile, onLogout }) => {
   const [activeTab, setActiveTab] = useState<CashierTab>('RECHARGES');
   const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
   const [allOrders, setAllOrders] = useState<Order[]>([]);
   const [confirming, setConfirming] = useState<string | null>(null);
   const [rejecting, setRejecting] = useState<string | null>(null);
   const [reportData, setReportData] = useState<any>(null);
   const [optimisticClearedIds, setOptimisticClearedIds] = useState<Set<string>>(new Set());
   const [search, setSearch] = useState('');
   const [loading, setLoading] = useState(true);

   // ─── Wallet Recharges State ───
   const [walletRequests, setWalletRequests] = useState<WalletRechargeRequest[]>([]);
   const [walletActionLoading, setWalletActionLoading] = useState<string | null>(null);
   const [walletRejectNote, setWalletRejectNote] = useState<Record<string, string>>({});
   const [walletScreenshotModal, setWalletScreenshotModal] = useState<string | null>(null);
   const [rejectId, setRejectId] = useState<string | null>(null);

   const [reportStart, setReportStart] = useState<string>(() => new Date().toISOString().split('T')[0]);
   const [reportEnd, setReportEnd] = useState<string>(() => new Date().toISOString().split('T')[0]);
   const [reportLoading, setReportLoading] = useState(false);

   const [audioStatus, setAudioStatus] = useState(joeSounds.getMutedState());
   const [isOffline, setIsOffline] = useState(!navigator.onLine);

   const [earningsToday, setEarningsToday] = useState<number>(0);
   const [earnings7D, setEarnings7D] = useState<number>(0);
   const [earnings30D, setEarnings30D] = useState<number>(0);

   const fetchEarningsSummary = async () => {
      try {
         const todayStr = new Date().toISOString().split('T')[0];
         
         const end7 = new Date();
         const start7 = new Date();
         start7.setDate(end7.getDate() - 6);
         const start7Str = start7.toISOString().split('T')[0];
         
         const end30 = new Date();
         const start30 = new Date();
         start30.setDate(end30.getDate() - 29);
         const start30Str = start30.toISOString().split('T')[0];

         const [todayStats, stats7D, stats30D] = await Promise.all([
            getDailyStatsRange(todayStr, todayStr),
            getDailyStatsRange(start7Str, todayStr),
            getDailyStatsRange(start30Str, todayStr)
         ]);

         setEarningsToday(todayStats.onlineRevenue || 0);
         setEarnings7D(stats7D.onlineRevenue || 0);
         setEarnings30D(stats30D.onlineRevenue || 0);
      } catch (err) {
         console.error("Failed to fetch earnings summary:", err);
      }
   };

   useEffect(() => {
      fetchEarningsSummary();
   }, [allOrders]);

   // 📊 LIVE STATS: Real-time state for Diagnostic Stratagem
   const [liveStats, setLiveStats] = useState({
      cash: 0, count: 0, avg: 0,
      hourlyData: [] as { hour: string; orders: number; revenue: number }[],
      paymentSplit: [{ name: 'Cash', value: 0 }, { name: 'Online', value: 0 }]
   });
   const [liveStatsUpdatedAt, setLiveStatsUpdatedAt] = useState<Date | null>(null);

   // 🛡️ SAFETY: Force-clear loading after 3s max
   useEffect(() => {
      const safetyTimer = setTimeout(() => setLoading(false), 3000);
      return () => clearTimeout(safetyTimer);
   }, []);

   useEffect(() => {
      const onOnline = () => setIsOffline(false);
      const onOffline = () => setIsOffline(true);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      return () => {
         window.removeEventListener('online', onOnline);
         window.removeEventListener('offline', onOffline);
      };
   }, []);

   useEffect(() => {
      const unsubAudio = joeSounds.subscribe(() => {
         setAudioStatus(joeSounds.getMutedState());
      });

      if ('Notification' in window && Notification.permission === 'default') {
         Notification.requestPermission();
      }

      let lastLen = 0;
      const unsubs = [
         listenToPendingCashOrders((data) => {
            if (data.length > lastLen) {
               joeSounds.playAlert();
               if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`💵 ${data.length} Cash Request${data.length > 1 ? 's' : ''} Pending`, {
                     body: `Tap to review.`,
                     icon: '/JeoLogoFinal.png',
                   });
               }
            }
            lastLen = data.length;
            setPendingOrders(data);
            setLoading(false);
            offlineDetector.recordPing();
         }),
         listenToAllOrders((data) => {
            setAllOrders(data);
            setLoading(false);
            offlineDetector.recordPing();
         }),
         listenToAllRechargeRequests((data) => {
            setWalletRequests(data.filter(r => r.status === 'pending'));
            offlineDetector.recordPing();
         }),
      ];

      return () => {
         unsubAudio();
         unsubs.forEach(fn => fn());
      };
   }, []);

   // [INVENTORY-RADAR]
   const [inventoryData, setInventoryData] = useState<any[]>([]);
   useEffect(() => {
      const unsub = onSnapshot(
         collection(db, 'inventory_meta'),
         (snap) => {
            const items = snap.docs.map(doc => {
               const data = doc.data();
               const available = Math.max(0, (data.totalStock || 0) - (data.consumed || 0));
               return {
                  name: data.itemName || doc.id,
                  available,
                  consumed: data.consumed || 0,
                  total: data.totalStock || 0
               };
            });
            setInventoryData(items);
         },
         (error) => {
            console.warn(`[CashierView:inventory_meta] Listener error: ${error.message}`);
         }
      );
      return () => unsub();
   }, []);

   useEffect(() => {
      const s = new Date(reportStart); 
      s.setHours(0,0,0,0);
      const e = new Date(reportEnd); 
      e.setHours(23,59,59,999);

      const rangeQ = query(
         collection(db, 'orders'),
         where('createdAt', '>=', s.getTime()),
         where('createdAt', '<=', e.getTime()),
         orderBy('createdAt', 'asc')
      );

      const unsub = onSnapshot(
         rangeQ,
         (snapshot) => {
            const rangeOrders = snapshot.docs.map(d => ({ ...d.data(), id: d.id })) as any[];
            const paidOrders = rangeOrders.filter(o => o.paymentStatus === 'SUCCESS' || o.paymentStatus === 'VERIFIED');
            const cash = paidOrders.filter(o => o.paymentType === 'CASH').reduce((s, o) => s + (o.totalAmount || 0), 0);
            const online = paidOrders.filter(o => o.paymentType !== 'CASH').reduce((s, o) => s + (o.totalAmount || 0), 0);
            const avg = paidOrders.length > 0 ? paidOrders.reduce((s, o) => s + (o.totalAmount || 0), 0) / paidOrders.length : 0;

            const hourlyMap: Record<string, { orders: number; revenue: number }> = {};
            for (let i = 7; i <= 21; i++) hourlyMap[`${i}:00`] = { orders: 0, revenue: 0 };
            
            paidOrders.forEach(o => {
               const hour = new Date(o.createdAt).getHours();
               const key = `${hour}:00`;
               if (hourlyMap[key]) {
                  hourlyMap[key].orders++;
                  hourlyMap[key].revenue += o.totalAmount || 0;
               }
            });

            setLiveStats({
               cash,
               count: paidOrders.length,
               avg,
               hourlyData: Object.entries(hourlyMap).map(([hour, v]) => ({ hour, ...v })),
               paymentSplit: [{ name: 'Cash', value: cash }, { name: 'Online', value: online }]
            });
            setLiveStatsUpdatedAt(new Date());
         },
         (error) => {
            console.warn(`[CashierView:rangeQ] Listener error: ${error.message}`);
         }
      );

      return () => unsub();
   }, [reportStart, reportEnd]);

   const conflictMap = useMemo(() => {
      const counts: Record<number, number> = {};
      pendingOrders.forEach(o => {
         counts[o.totalAmount] = (counts[o.totalAmount] || 0) + 1;
      });
      return counts;
   }, [pendingOrders]);

   useEffect(() => {
      if (activeTab !== 'ANALYTICS' && activeTab !== 'SUMMARY') return;

      const loadReportData = async () => {
         setReportLoading(true);
         try {
            const s = new Date(reportStart);
            const e = new Date(reportEnd);
            const data = await fetchReport({ role: 'cashier', start: s, end: e });
            setReportData(data);
         } catch (err) {
            console.error('Audit sync failed:', err);
         } finally {
            setReportLoading(false);
         }
      };
      loadReportData();
   }, [allOrders, activeTab, reportStart, reportEnd]);

   const handleConfirm = async (orderId: string) => {
       if (!offlineDetector.isOnline()) {
          alert("Waiting for connection...");
          return;
       }
       setConfirming(orderId);
       setOptimisticClearedIds(prev => new Set(prev).add(orderId));
       joeSounds.playPaymentConfirmed();
       sonicVoice.announceOrderComplete();
       
       const targetOrder = pendingOrders.find(o => o.id === orderId);
       
       try {
          await confirmCashPayment(orderId, profile.uid);
          if (targetOrder) {
             const shortToken = targetOrder.tokenNumber || orderId.slice(-4).toUpperCase();
             triggerOneSignalWebhook(
                targetOrder.userId,
                '✅ Payment Confirmed — QR Unlocked!',
                `Your cash order #${shortToken} is confirmed. Show your QR code at the counter.`,
                `/student/orders`
             ).catch(e => console.warn("OneSignal failed:", e));
          }
       } catch (err: any) {
          setOptimisticClearedIds(prev => {
             const next = new Set(prev);
             next.delete(orderId);
             return next;
          });
          alert(err.message || 'Failed to approve. Reverting...');
       } finally {
          setConfirming(null);
       }
       offlineDetector.recordPing();
    };

    const handleReject = async (orderId: string) => {
       if (!offlineDetector.isOnline()) {
          alert("Waiting for connection...");
          return;
       }
       if (!confirm('Reject request?')) return;
       setRejecting(orderId);
       const targetOrder = pendingOrders.find(o => o.id === orderId);
       try {
          await rejectCashPayment(orderId, profile.uid);
          joeSounds.playRejected();
          if (targetOrder) {
             const shortToken = targetOrder.tokenNumber || orderId.slice(-4).toUpperCase();
             triggerOneSignalWebhook(
                targetOrder.userId,
                '❌ Payment Rejected',
                `Your order #${shortToken} has been rejected. Please contact the cashier.`,
                `/student/orders`
             ).catch(e => console.warn("OneSignal failed:", e));
          }
          offlineDetector.recordPing();
       } catch (err: any) {
          alert(err.message || 'Failed to reject');
       } finally {
          setRejecting(null);
       }
    };

   const formatTime = (ts?: number) => {
      if (!ts) return '--:--';
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
   };

   const filteredOrders = useMemo(() => {
      let filtered = allOrders;
      if (search) {
         const s = search.toLowerCase();
         filtered = filtered.filter(o => o.userName.toLowerCase().includes(s) || o.id.toLowerCase().includes(s));
      }
      return filtered.slice().reverse();
   }, [allOrders, search]);

   const stats = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = allOrders.filter(o => {
         const d = new Date(o.createdAt);
         d.setHours(0, 0, 0, 0);
         return d.getTime() === today.getTime() && (o.paymentStatus === 'SUCCESS' || o.paymentStatus === 'VERIFIED');
      });

      const cash = todayOrders.filter(o => o.paymentType === 'CASH').reduce((s, o) => s + o.totalAmount, 0);
      const avg = todayOrders.length > 0 ? todayOrders.reduce((s, o) => s + o.totalAmount, 0) / todayOrders.length : 0;

      return {
         cash,
         count: todayOrders.length,
         avg
      };
   }, [allOrders]);

   const detectAmountConflicts = () => {
      const counts: { [amount: number]: number } = {};
      walletRequests.forEach(r => {
         counts[r.amount] = (counts[r.amount] || 0) + 1;
      });
      return Object.keys(counts).filter(amt => counts[parseFloat(amt)] > 1).map(Number);
   };
   const conflicts = detectAmountConflicts();

   const handleApproveRecharge = async (id: string) => {
      setWalletActionLoading(id + '_approve');
      try {
         await approveRechargeRequest(id, profile.name);
         if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
         joeSounds.playPaymentConfirmed();
      } catch (err: any) {
         alert(err.message);
      } finally {
         setWalletActionLoading(null);
      }
   };

   const handleRejectRechargeSubmit = async (id: string) => {
      const reason = walletRejectNote[id] || '';
      if (!reason) {
         alert('Please specify a rejection reason.');
         return;
      }
      setWalletActionLoading(id + '_reject');
      try {
         await rejectRechargeRequest(id, profile.name, reason);
         if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
         joeSounds.playRejected();
         setRejectId(null);
      } catch (err: any) {
         alert(err.message);
      } finally {
         setWalletActionLoading(null);
      }
   };

   const handleAudioToggle = async () => {
     if (audioStatus === 'Silent') {
       await joeSounds.init();
     } else {
       joeSounds.toggleMute();
     }
   };

   const verificationsCount = walletRequests.length;

   const onlineVal = liveStats.paymentSplit[1]?.value || 0;
   const totalVal = onlineVal;
   const onlinePct = totalVal > 0 ? 100 : 0;
   const cashPct = 0;

   return (
      <div className="min-h-screen bg-surface-lowest text-on-surface font-sans select-none overflow-y-auto pb-24">
         {isOffline && (
            <div className="bg-rose-950 border border-rose-500/20 text-rose-400 px-8 py-2 text-center font-mono text-[10px] uppercase tracking-widest animate-pulse flex items-center justify-center gap-3 shrink-0 z-50">
               <AlertTriangle className="w-3 h-3" /> Connection unstable. Waiting for cashier database...
            </div>
         )}

         {/* Stickyblurred premium Header */}
         <header className="sticky top-0 z-50 bg-surface-lowest/80 backdrop-blur-xl border-b border-white/5 flex flex-wrap justify-between items-center px-6 py-4 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full border-2 border-brand-purple flex items-center justify-center bg-surface-low text-brand-purple-light font-black font-display text-sm">
                  {profile.name.charAt(0).toUpperCase()}
               </div>
               <div>
                  <span className="font-mono text-[9px] text-brand-purple bg-brand-purple/10 border border-brand-purple/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 animate-pulse w-fit">
                     <span className="w-1.5 h-1.5 rounded-full bg-brand-purple" />
                     Cashier Desk Terminal Active
                  </span>
                  <h1 className="font-display text-base font-black text-white mt-0.5">
                     Register Approvals HUD
                  </h1>
               </div>
            </div>

            <div className="flex items-center gap-4 mt-2 sm:mt-0">
               {/* Soundscape Context health indicator badge */}
               <button 
                  onClick={handleAudioToggle}
                  className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 text-[9px] font-mono font-black transition active:scale-95 cursor-pointer ${
                     audioStatus === 'Connected' 
                        ? 'bg-brand-purple/10 border-brand-purple/20 text-brand-purple-light' 
                        : audioStatus === 'Muted'
                           ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                           : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}
               >
                  {audioStatus === 'Connected' ? (
                     <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>AUDIO: CENTRAL ACTIVE</span>
                     </>
                  ) : audioStatus === 'Muted' ? (
                     <>
                        <VolumeX className="w-3.5 h-3.5" />
                        <span>AUDIO: MUTED</span>
                     </>
                  ) : (
                     <>
                        <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                        <span>AUDIO: SILENT (TAP TO WAKE)</span>
                     </>
                  )}
               </button>

               <button 
                  onClick={onLogout} 
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-white rounded-xl font-mono text-[10px] font-bold tracking-wider uppercase transition active:scale-95 cursor-pointer"
               >
                  Logout
               </button>
            </div>
         </header>

         {/* Centered Main Container */}
         <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
            
            {/* Top Stat chips summary */}
            <section className="flex justify-between items-center gap-4 bg-surface-low/30 border border-white/5 p-4 rounded-2xl">
               <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-on-surface-variant font-bold">Verifications Queue:</span>
                  <span className={`font-mono font-black rounded-full px-2 py-0.5 text-[10px] ${
                     verificationsCount > 0 ? 'bg-brand-purple text-surface-lowest animate-pulse' : 'bg-surface-high text-on-surface-variant'
                  }`}>
                     {verificationsCount}
                  </span>
               </div>

               <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-on-surface-variant font-bold">Online Volume (Today):</span>
                  <span className="font-mono text-brand-purple-light font-extrabold text-sm">
                     ₹{earningsToday.toLocaleString()}
                  </span>
               </div>
            </section>

            {/* Conflict intelligence overlay warnings */}
            {conflicts.length > 0 && activeTab === 'RECHARGES' && (
               <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-2xl flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                     <h4 className="font-display font-black text-amber-400 uppercase tracking-wider">
                        Conflict Intelligence Alert: Matching amount receipts
                     </h4>
                     <p className="font-sans text-on-surface-variant leading-normal">
                        Multiple pending wallet recharges match sums of: {conflicts.map(c => `₹${c}`).join(', ')}. Ensure you cross-reference the 12-digit UTR strings to avoid duplicate approval fraud.
                     </p>
                  </div>
               </div>
            )}

            {/* Tabs navigation */}
            <div className="flex flex-wrap bg-surface-high/30 border border-white/5 rounded-xl p-1 gap-1">
               {[
                  { id: 'RECHARGES', label: `RECHARGES (${walletRequests.length})` },
                  { id: 'ANALYTICS', label: 'SALES METRICS' },
                  { id: 'LEDGER', label: 'HISTORY LEDGER' },
                  { id: 'SUMMARY', label: 'SETTLEMENT' }
               ].map(tab => (
                  <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id as CashierTab)}
                     className={`flex-1 py-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                        activeTab === tab.id ? 'bg-brand-purple text-surface-lowest shadow-lg shadow-brand-purple/20' : 'text-on-surface-variant hover:text-white'
                     }`}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>

            {/* Main tab sections views */}
            <main className="space-y-4">

               {/* 1. Wallet Topup Recharges Terminal */}
               {activeTab === 'RECHARGES' && (
                  <section className="space-y-4">
                     {walletRequests.length === 0 ? (
                        <div className="text-center py-16 border border-white/5 bg-surface-low/10 rounded-3xl">
                           <p className="font-sans text-xs text-on-surface-variant">Recharge terminal queue is clean. Ready to verify!</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {walletRequests.map(req => (
                              <RechargeRequestCard 
                                key={req.id} 
                                req={req}
                                onApprove={handleApproveRecharge}
                                rejectId={rejectId}
                                setRejectId={setRejectId}
                                walletRejectNote={walletRejectNote}
                                setWalletRejectNote={setWalletRejectNote}
                                walletActionLoading={walletActionLoading}
                                handleRejectRechargeSubmit={handleRejectRechargeSubmit}
                                setWalletScreenshotModal={setWalletScreenshotModal}
                                formatTime={formatTime}
                              />
                           ))}
                        </div>
                     )}
                  </section>
               )}



               {/* 3. Sales performance matrices charts and graphs */}
               {activeTab === 'ANALYTICS' && (
                  <section className="space-y-6">
                     
                     <div className="flex flex-wrap items-center justify-between gap-6 bg-surface-low/30 p-6 rounded-2xl border border-white/5 shadow-xl">
                        <div className="flex bg-surface-lowest p-1.5 rounded-xl border border-white/5">
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
                                 className={`px-3 py-2 rounded-lg text-[9px] font-mono font-black uppercase tracking-widest transition-all cursor-pointer ${
                                    new Date(reportStart).getDate() === (new Date(new Date().setDate(new Date().getDate() - q.days))).getDate() 
                                    ? 'bg-brand-purple text-surface-lowest shadow-sm' : 'text-on-surface-variant hover:text-white'
                                 }`}
                              >
                                 {q.label}
                              </button>
                           ))}
                        </div>
                        <AuditDownloadButton realReport={reportData} period={reportStart === reportEnd ? 'Today' : `${reportStart} to ${reportEnd}`} />
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Sales velocity hourly chart */}
                        <div className="bg-surface-low/30 p-6 rounded-2xl border border-white/5 shadow-2xl">
                           <h3 className="font-mono text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-6">
                              Sales Velocity (Hourly)
                           </h3>
                           <div className="h-56">
                              <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={liveStats.hourlyData}>
                                    <defs>
                                      <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#b76dff" stopOpacity={0.8}/>
                                        <stop offset="100%" stopColor="#490080" stopOpacity={0.1}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#131b2e', color: '#f4f4f5' }} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                    <Bar dataKey="orders" fill="url(#purpleGrad)" radius={[6, 6, 0, 0]} />
                                 </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                        {/* Payment Split Dynamic CSS Progress slider */}
                        <div className="glass-bg glass-stroke rounded-2xl p-6 space-y-4 shadow-2xl flex flex-col justify-between">
                           <div>
                              <h3 className="font-display font-bold text-xs text-white uppercase tracking-wider">
                                 Digital Wallet checkout Revenue
                              </h3>
                              
                              <div className="space-y-3 pt-4">
                                 <div className="h-6 rounded-full overflow-hidden flex text-[10px] font-mono font-black text-center text-surface-lowest">
                                    <div className="bg-brand-purple-dark h-full flex items-center justify-center transition-all duration-500 text-[#ddb7ff] w-full">
                                       ONLINE WALLET REVENUE (100%)
                                    </div>
                                 </div>
                                 
                                 <div className="flex justify-between items-center text-[10.5px] font-mono text-on-surface-variant mt-2">
                                    <div className="flex items-center gap-1.5">
                                       <span className="w-2.5 h-2.5 rounded-full bg-brand-purple-dark" />
                                       <span>Online Wallet (₹{onlineVal.toLocaleString()})</span>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="p-3.5 bg-white/5 border border-white/5 rounded-xl text-[11px] font-sans text-on-surface-variant leading-relaxed">
                              👨‍✈️ <strong>Prepaid preference:</strong> Student wallet transactions represent the primary volume, validating frictionless piloting.
                           </div>
                        </div>

                        {/* Catalog Stock Levels list chart */}
                        <div className="bg-surface-low/30 p-6 rounded-2xl border border-white/5 shadow-2xl md:col-span-2">
                           <h3 className="font-mono text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">
                              Menu Catalog Available Stock
                           </h3>
                           <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={inventoryData} layout="vertical">
                                    <defs>
                                      <linearGradient id="greenGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#b76dff" stopOpacity={0.8}/>
                                        <stop offset="100%" stopColor="#490080" stopOpacity={0.2}/>
                                      </linearGradient>
                                      <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                                    <XAxis type="number" tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} hide />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#cbd5e1', fontWeight: 'bold' }} axisLine={false} tickLine={false} width={80} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#131b2e', color: '#f4f4f5' }} />
                                    <Bar dataKey="available" fill="url(#greenGrad)" radius={[0, 6, 6, 0]} barSize={12} />
                                    <Bar dataKey="consumed" fill="url(#redGrad)" radius={[0, 6, 6, 0]} barSize={12} />
                                 </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </div>

                     </div>
                  </section>
               )}

               {/* 4. Database records ledger tables review */}
               {activeTab === 'LEDGER' && (
                  <section className="space-y-4">
                     <div className="p-6 bg-surface-low/30 border border-white/5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                           <h2 className="text-lg font-black text-white uppercase italic">Transaction Ledger</h2>
                           <p className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-widest mt-1">Live accounting audit</p>
                        </div>
                        <div className="relative w-full sm:w-80">
                           <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                           <input
                              type="text" placeholder="Search by name or order code..." value={search} onChange={e => setSearch(e.target.value)}
                              className="w-full bg-surface-lowest border border-white/5 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-brand-purple/30 transition placeholder:text-zinc-700"
                           />
                        </div>
                     </div>

                     <div className="border border-white/5 bg-surface-low/10 rounded-2xl overflow-hidden overflow-x-auto shadow-2xl">
                        <table className="w-full text-left">
                           <thead className="bg-surface-lowest border-b border-white/5">
                              <tr className="text-[9px] font-mono font-bold text-on-surface-variant uppercase tracking-[0.2em]">
                                 <th className="px-6 py-4">Order Reference</th>
                                 <th className="px-6 py-4">Student</th>
                                 <th className="px-6 py-4">Method</th>
                                 <th className="px-6 py-4">Status</th>
                                 <th className="px-6 py-4 text-right">Amount</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5 bg-surface-low/5 font-mono text-[10.5px]">
                              {filteredOrders.map(order => (
                                 <tr key={order.id} className="hover:bg-white/5 transition">
                                    <td className="px-6 py-4 text-zinc-300">#{order.id.slice(-10).toUpperCase()}</td>
                                    <td className="px-6 py-4 font-sans">
                                       <p className="text-xs font-bold text-white leading-none">{order.userName}</p>
                                       <p className="text-[9px] font-mono text-zinc-500 uppercase mt-1.5">{formatTime(order.createdAt)}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className="text-zinc-400">
                                          {order.utr || order.id.slice(-4).toUpperCase()}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4">
                                       <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                         order.paymentType === 'CASH' 
                                           ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' 
                                           : 'bg-brand-purple-dark/20 text-[#ddb7ff] border-brand-purple/20'
                                       }`}>
                                          {order.paymentType}
                                       </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-brand-purple-light text-base italic">₹{order.totalAmount}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </section>
               )}

               {/* 5. Summary Settlement Reconciliation tab */}
               {activeTab === 'SUMMARY' && (
                  <section className="space-y-6">
                     <div className="glass-bg glass-stroke rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                        <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 border-b border-white/5 pb-8 mb-8">
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-brand-purple-dark/15 border border-brand-purple/20 rounded-2xl flex items-center justify-center shadow-xl">
                                 <Calculator className="w-6 h-6 text-brand-purple-light" />
                              </div>
                              <div>
                                 <h2 className="text-xl font-black text-white uppercase italic font-display">Shift Settlement</h2>
                                 <p className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-widest mt-0.5">Reconciliation & Audit Control</p>
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                           <div className="space-y-4">
                              {/* Today Card */}
                              <div className="bg-surface-lowest/40 p-5 rounded-2xl border border-brand-purple/20 relative overflow-hidden flex justify-between items-center shadow-lg">
                                 <div className="absolute top-0 right-0 w-16 h-16 bg-brand-purple/5 blur-xl rounded-full pointer-events-none" />
                                 <div>
                                    <p className="text-[9px] font-mono font-black text-brand-purple-light uppercase tracking-[0.2em] mb-1">Today's Online Earnings</p>
                                    <p className="text-3xl font-black text-white italic font-display">₹{earningsToday.toLocaleString()}</p>
                                 </div>
                               </div>

                              {/* 7 Days Card */}
                              <div className="bg-surface-lowest/40 p-5 rounded-2xl border border-white/5 relative overflow-hidden flex justify-between items-center shadow-lg">
                                 <div>
                                    <p className="text-[9px] font-mono font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Last 7 Days Online Earnings</p>
                                    <p className="text-2xl font-black text-white italic font-display">₹{earnings7D.toLocaleString()}</p>
                                 </div>
                              </div>

                              {/* 30 Days Card */}
                              <div className="bg-surface-lowest/40 p-5 rounded-2xl border border-white/5 relative overflow-hidden flex justify-between items-center shadow-lg">
                                 <div>
                                    <p className="text-[9px] font-mono font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Last 30 Days Online Earnings</p>
                                    <p className="text-2xl font-black text-white italic font-display">₹{earnings30D.toLocaleString()}</p>
                                 </div>
                              </div>
                           </div>

                           <div className="bg-brand-purple-dark/15 border border-brand-purple/20 p-8 rounded-2xl shadow-2xl text-brand-purple-light relative flex flex-col justify-center">
                              <p className="text-[9px] font-mono font-bold opacity-50 uppercase tracking-[0.3em] mb-3">Live System Status</p>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-brand-purple animate-pulse" />
                                <h3 className="text-2xl font-black italic font-display text-white">OPERATIONAL</h3>
                              </div>
                              <p className="text-[10px] font-mono font-bold text-on-surface-variant mt-3 leading-relaxed uppercase tracking-wider">All protocols running. <br />Database synced 0ms ago.</p>
                           </div>
                        </div>

                        <div className="p-6 bg-surface-lowest/40 rounded-2xl border border-white/5 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-surface-low border border-white/10 flex items-center justify-center text-brand-purple font-bold text-base shadow-sm">
                                 {profile.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-white uppercase">{profile.name}</p>
                                 <p className="text-[8px] font-mono font-bold text-on-surface-variant uppercase tracking-widest italic">{profile.uid.slice(0, 16).toUpperCase()}</p>
                              </div>
                           </div>
                           <button onClick={onLogout} className="px-6 py-3 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-400 rounded-xl font-mono font-black text-[9px] uppercase tracking-widest transition cursor-pointer active:scale-95">
                              End Active Session
                           </button>
                        </div>
                     </div>
                  </section>
               )}

            </main>
         </div>

         {/* WALLET SCREENSHOT PREVIEW MODAL */}
         {walletScreenshotModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-sm animate-fade-in" onClick={() => setWalletScreenshotModal(null)}>
               <div className="bg-surface-mid border border-white/10 rounded-3xl overflow-hidden max-w-md w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setWalletScreenshotModal(null)} className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md text-white rounded-full cursor-pointer hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
                  <img src={walletScreenshotModal} alt="Payment screenshot" className="w-full object-contain max-h-[85vh]" />
               </div>
            </div>
         )}
      </div>
   );
};

export default CashierView;
