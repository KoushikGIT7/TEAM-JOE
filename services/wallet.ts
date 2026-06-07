/**
 * JOE Wallet Service
 * ─────────────────────────────────────────────────────────────────────────────
 * All wallet balance mutations use Firestore runTransaction() so every debit/credit
 * is atomic and creates an immutable audit trail in wallet_transactions/.
 *
 * Security model:
 *  - Students can READ their own wallet fields and transactions.
 *  - Students CANNOT write wallet_transactions (enforced by Firestore rules).
 *  - Balance mutations are performed inside runTransaction() by the service.
 *  - Cashier/Admin approve recharge requests via approveRechargeRequest().
 *
 * Future payment gateway:
 *  - Replace submitRechargeRequest() with a webhook that calls approveRechargeRequest()
 *    on successful payment. No other changes needed.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  Timestamp,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  WalletRechargeRequest,
  WalletTransaction,
  WalletSummary,
  RechargeStatus,
} from '../types';
import { triggerOneSignalWebhook } from './onesignal-webhook';

// ─── COLLECTION NAMES ────────────────────────────────────────────────────────
const USERS_COL = 'users';
const RECHARGE_COL = 'wallet_recharge_requests';
const TX_COL = 'wallet_transactions';

// ─── LOW BALANCE THRESHOLD ───────────────────────────────────────────────────
export const WALLET_LOW_BALANCE_THRESHOLD = 30;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const toMillis = (ts: any): number => {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  return Date.now();
};

const docToRechargeRequest = (id: string, data: any): WalletRechargeRequest => ({
  id,
  uid: data.uid,
  studentName: data.studentName || '',
  amount: data.amount || 0,
  screenshotUrl: data.screenshotUrl || '',
  status: data.status || 'pending',
  createdAt: toMillis(data.createdAt),
  reviewedBy: data.reviewedBy,
  reviewedAt: data.reviewedAt ? toMillis(data.reviewedAt) : undefined,
  rejectionNote: data.rejectionNote,
});

const docToTransaction = (id: string, data: any): WalletTransaction => ({
  id,
  uid: data.uid,
  type: data.type,
  amount: data.amount || 0,
  balanceAfter: data.balanceAfter || 0,
  reason: data.reason,
  orderId: data.orderId,
  rechargeRequestId: data.rechargeRequestId,
  createdAt: toMillis(data.createdAt),
});

// ─── READ: WALLET SUMMARY ────────────────────────────────────────────────────

/**
 * One-time fetch of wallet summary for a user.
 */
export const getWalletSummary = async (uid: string): Promise<WalletSummary> => {
  try {
    const snap = await getDoc(doc(db, USERS_COL, uid));
    if (!snap.exists()) return { walletBalance: 0, totalRecharged: 0, totalSpent: 0 };
    const d = snap.data();
    return {
      walletBalance: d.walletBalance || 0,
      totalRecharged: d.totalRecharged || 0,
      totalSpent: d.totalSpent || 0,
    };
  } catch (err) {
    console.error('[WALLET] getWalletSummary failed:', err);
    return { walletBalance: 0, totalRecharged: 0, totalSpent: 0 };
  }
};

/**
 * Real-time listener for wallet summary (balance updates instantly when cashier approves).
 */
export const listenToWalletSummary = (
  uid: string,
  callback: (summary: WalletSummary) => void
): (() => void) => {
  return onSnapshot(
    doc(db, USERS_COL, uid),
    (snap) => {
      if (!snap.exists()) {
        callback({ walletBalance: 0, totalRecharged: 0, totalSpent: 0 });
        return;
      }
      const d = snap.data();
      callback({
        walletBalance: d.walletBalance || 0,
        totalRecharged: d.totalRecharged || 0,
        totalSpent: d.totalSpent || 0,
      });
    },
    (err) => {
      console.error('[WALLET] listenToWalletSummary error:', err);
    }
  );
};

// ─── READ: TRANSACTIONS ───────────────────────────────────────────────────────

/**
 * Real-time listener for recent wallet transactions (last 20).
 */
export const listenToWalletTransactions = (
  uid: string,
  callback: (txs: WalletTransaction[]) => void
): (() => void) => {
  const q = query(
    collection(db, TX_COL),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => docToTransaction(d.id, d.data())));
    },
    (err) => {
      console.error('[WALLET] listenToWalletTransactions error:', err);
      callback([]);
    }
  );
};

// ─── READ: RECHARGE REQUESTS ─────────────────────────────────────────────────

/**
 * Real-time listener for this student's recharge requests (most recent first).
 */
export const listenToMyRechargeRequests = (
  uid: string,
  callback: (requests: WalletRechargeRequest[]) => void
): (() => void) => {
  const q = query(
    collection(db, RECHARGE_COL),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => docToRechargeRequest(d.id, d.data())));
    },
    (err) => {
      console.error('[WALLET] listenToMyRechargeRequests error:', err);
      callback([]);
    }
  );
};

/**
 * Real-time listener for ALL recharge requests (admin/cashier panel).
 * Ordered by createdAt DESC, limited to 100.
 */
export const listenToAllRechargeRequests = (
  callback: (requests: WalletRechargeRequest[]) => void,
  statusFilter?: RechargeStatus
): (() => void) => {
  const constraints: any[] = [orderBy('createdAt', 'desc'), limit(100)];
  if (statusFilter) {
    constraints.unshift(where('status', '==', statusFilter));
  }
  const q = query(collection(db, RECHARGE_COL), ...constraints);
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => docToRechargeRequest(d.id, d.data())));
    },
    (err) => {
      console.error('[WALLET] listenToAllRechargeRequests error:', err);
      callback([]);
    }
  );
};

// ─── WRITE: SUBMIT RECHARGE REQUEST ─────────────────────────────────────────

/**
 * Student submits a recharge request with screenshot.
 * Creates a 'pending' document in wallet_recharge_requests/.
 */
export const submitRechargeRequest = async (
  uid: string,
  studentName: string,
  amount: number,
  screenshotUrl: string
): Promise<string> => {
  if (!uid) throw new Error('User not authenticated');
  if (amount <= 0) throw new Error('Amount must be greater than 0');
  if (!screenshotUrl) throw new Error('Screenshot is required');

  const ref = await addDoc(collection(db, RECHARGE_COL), {
    uid,
    studentName,
    amount,
    screenshotUrl,
    status: 'pending' as RechargeStatus,
    createdAt: serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    rejectionNote: null,
  });

  console.log(`[WALLET] Recharge request submitted: ${ref.id} (₹${amount})`);
  return ref.id;
};

// ─── WRITE: APPROVE RECHARGE (Cashier/Admin only) ────────────────────────────

/**
 * Atomically:
 *  1. Mark recharge request as 'approved'
 *  2. Credit wallet balance on the user document
 *  3. Create wallet_transactions record
 *
 * This is the ONLY code path that increases a student's wallet balance.
 */
export const approveRechargeRequest = async (
  requestId: string,
  approvedBy: string
): Promise<void> => {
  const requestRef = doc(db, RECHARGE_COL, requestId);
  let approvedUid = '';
  let approvedAmount = 0;

  await runTransaction(db, async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists()) throw new Error('Recharge request not found');

    const requestData = requestSnap.data();
    if (requestData.status !== 'pending') {
      throw new Error(`Cannot approve: request is already '${requestData.status}'`);
    }

    const { uid, amount } = requestData;
    approvedUid = uid;
    approvedAmount = amount;
    
    const userRef = doc(db, USERS_COL, uid);
    const userSnap = await tx.get(userRef);

    const currentBalance = userSnap.exists() ? (userSnap.data().walletBalance || 0) : 0;
    const currentTotalRecharged = userSnap.exists() ? (userSnap.data().totalRecharged || 0) : 0;
    const newBalance = currentBalance + amount;

    // 1. Update recharge request status
    tx.update(requestRef, {
      status: 'approved' as RechargeStatus,
      reviewedBy: approvedBy,
      reviewedAt: serverTimestamp(),
    });

    // 2. Credit wallet on user document
    tx.set(
      userRef,
      {
        walletBalance: newBalance,
        totalRecharged: currentTotalRecharged + amount,
        lastWalletUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 3. Create transaction record (immutable audit trail)
    const txRef = doc(collection(db, TX_COL));
    tx.set(txRef, {
      uid,
      type: 'credit',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason: 'wallet_recharge',
      rechargeRequestId: requestId,
      status: 'SUCCESS',
      createdAt: serverTimestamp(),
    });
  });

  console.log(`[WALLET] Recharge approved: ${requestId} by ${approvedBy}`);
  triggerOneSignalWebhook(
    approvedUid,
    "💳 Wallet Recharged!",
    `Your recharge of ₹${approvedAmount} has been approved.`
  );
};

// ─── WRITE: REJECT RECHARGE (Cashier/Admin only) ─────────────────────────────

/**
 * Mark a recharge request as rejected with an optional note.
 * No balance change — purely a status update.
 */
export const rejectRechargeRequest = async (
  requestId: string,
  rejectedBy: string,
  note: string = ''
): Promise<void> => {
  const requestRef = doc(db, RECHARGE_COL, requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) throw new Error('Recharge request not found');
  if (snap.data().status !== 'pending') {
    throw new Error(`Cannot reject: request is already '${snap.data().status}'`);
  }

  await updateDoc(requestRef, {
    status: 'rejected' as RechargeStatus,
    reviewedBy: rejectedBy,
    reviewedAt: serverTimestamp(),
    rejectionNote: note || null,
  });

  console.log(`[WALLET] Recharge rejected: ${requestId} by ${rejectedBy}`);
};

// ─── WRITE: DEDUCT WALLET FOR ORDER ─────────────────────────────────────────

/**
 * Atomically:
 *  1. Check balance is sufficient (inside transaction to prevent race conditions)
 *  2. Deduct from wallet balance on user document
 *  3. Create wallet_transactions debit record
 *
 * Returns the new balance after deduction.
 * Throws if balance is insufficient.
 */
export const deductWalletForOrder = async (
  uid: string,
  amount: number,
  orderId: string
): Promise<{ newBalance: number; transactionId: string }> => {
  if (!uid) throw new Error('User not authenticated');
  if (amount <= 0) throw new Error('Deduction amount must be > 0');

  const userRef = doc(db, USERS_COL, uid);
  let newBalance = 0;
  let transactionId = '';

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    const currentBalance = userSnap.exists() ? (userSnap.data().walletBalance || 0) : 0;
    const currentTotalSpent = userSnap.exists() ? (userSnap.data().totalSpent || 0) : 0;

    if (currentBalance < amount) {
      throw new Error(`Insufficient wallet balance. Available: ₹${currentBalance}, Required: ₹${amount}`);
    }

    newBalance = currentBalance - amount;

    // 1. Debit wallet on user document
    tx.set(
      userRef,
      {
        walletBalance: newBalance,
        totalSpent: currentTotalSpent + amount,
        lastWalletUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2. Create debit transaction record
    const txRef = doc(collection(db, TX_COL));
    transactionId = txRef.id;
    tx.set(txRef, {
      uid,
      type: 'debit',
      amount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason: 'order_purchase',
      orderId,
      status: 'SUCCESS',
      createdAt: serverTimestamp(),
    });
  });

  console.log(`[WALLET] Deducted ₹${amount} for order ${orderId}. New balance: ₹${newBalance}`);
  return { newBalance, transactionId };
};

// ─── UTILITY: CHECK BALANCE ───────────────────────────────────────────────────

/**
 * Quick balance check without modifying anything.
 * Used in PaymentView to pre-validate before showing the wallet option.
 */
export const checkWalletBalance = async (uid: string): Promise<number> => {
  try {
    const snap = await getDoc(doc(db, USERS_COL, uid));
    if (!snap.exists()) return 0;
    return snap.data().walletBalance || 0;
  } catch {
    return 0;
  }
};

// ─── ANALYTICS: ADMIN ────────────────────────────────────────────────────────

/**
 * One-time fetch of wallet analytics for the admin dashboard.
 */
export const getWalletAnalytics = async (): Promise<{
  totalSystemBalance: number;
  totalRechargedToday: number;
  totalRevenueAllTime: number;
  pendingRequestsCount: number;
}> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTs = Timestamp.fromDate(todayStart);

    const [pendingSnap, todayApprovedSnap, allApprovedSnap] = await Promise.all([
      getDocs(query(collection(db, RECHARGE_COL), where('status', '==', 'pending'))),
      getDocs(query(collection(db, RECHARGE_COL), where('status', '==', 'approved'), where('reviewedAt', '>=', todayStartTs))),
      getDocs(query(collection(db, RECHARGE_COL), where('status', '==', 'approved'))),
    ]);

    const pendingRequestsCount = pendingSnap.size;
    const totalRechargedToday = todayApprovedSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
    const totalRevenueAllTime = allApprovedSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

    return {
      totalSystemBalance: 0,
      totalRechargedToday,
      totalRevenueAllTime,
      pendingRequestsCount,
    };
  } catch (err) {
    console.error('[WALLET] getWalletAnalytics error:', err);
    return { totalSystemBalance: 0, totalRechargedToday: 0, totalRevenueAllTime: 0, pendingRequestsCount: 0 };
  }
};

