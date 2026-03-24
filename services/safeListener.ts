/**
 * 🛡️ SAFE LISTENER — Production Reliability Layer
 *
 * Wraps Firestore's onSnapshot with:
 *  1. Auto-index error detection + URL extraction
 *  2. Retry on transient failures (unavailable / resource-exhausted)
 *  3. Clean fallback (empty state, no blank screen)
 *  4. Deduplication guard (prevent duplicate listeners per key)
 *  5. Memory-leak-safe unsubscribe tracking
 *
 * USAGE:
 *   const unsub = safeListener('cook-batches', query, (snap) => { ... }, () => []);
 *   // Returns unsubscribe fn exactly like onSnapshot
 *
 * DO NOT change this file. Only use it as a wrapper.
 */

import { onSnapshot, Query, DocumentData } from 'firebase/firestore';

type Callback<T> = (data: T) => void;
type Transformer<T> = (snapshot: any) => T;
type Fallback<T> = () => T;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ── Deduplication Registry ────────────────────────────────────────────────────
// Maps listenerKey → active unsubscribe fn. Calling safeListener with the
// same key will first teardown the previous listener before creating a new one.
const activeListeners = new Map<string, () => void>();

/**
 * Extract index creation URL from Firebase failed-precondition error.
 */
function extractIndexUrl(err: any): string | null {
  const msg: string = err?.message || '';
  const match = msg.match(/https:\/\/console\.firebase\.google\.com[^\s"]+/);
  return match ? match[0] : null;
}

/**
 * Core safe listener function.
 *
 * @param key        Unique string key for deduplication
 * @param q          Firestore Query
 * @param transform  fn(snapshot) → T — extracts your data from snapshot docs
 * @param fallback   fn() → T — returns empty/default state on error
 * @param onData     callback with transformed data
 * @param fallbackQuery  Optional simpler query to use if index is missing
 */
export function safeListener<T>(
  key: string,
  q: Query<DocumentData>,
  transform: Transformer<T>,
  fallback: Fallback<T>,
  onData: Callback<T>,
  fallbackQuery?: Query<DocumentData>
): () => void {
  // 1. Deduplication: tear down existing listener for this key
  if (activeListeners.has(key)) {
    activeListeners.get(key)!();
    activeListeners.delete(key);
  }

  let retryCount = 0;
  let internalUnsub: (() => void) | null = null;
  let cancelled = false;

  function attach(query: Query<DocumentData>, isFallback: boolean): void {
    if (cancelled) return;

    internalUnsub = onSnapshot(
      query,
      (snapshot) => {
        retryCount = 0; // reset on success
        try {
          onData(transform(snapshot));
        } catch (transformErr) {
          console.error(`[SAFE-LISTENER:${key}] Transform error:`, transformErr);
          onData(fallback());
        }
      },
      (err: any) => {
        if (cancelled) return;

        // ── Index Missing ────────────────────────────────────────────────────
        if (err?.code === 'failed-precondition') {
          const url = extractIndexUrl(err);
          console.error(
            `🔥 [INDEX REQUIRED] (${key})\n` +
            `   Error: ${err.message}\n` +
            (url ? `   ✅ CREATE THIS INDEX: ${url}` : '   ⚠️  Open Firebase Console → Indexes to create the missing index.')
          );

          // Try the simpler fallback query if provided
          if (fallbackQuery && !isFallback) {
            console.warn(`[SAFE-LISTENER:${key}] Falling back to simplified query...`);
            attach(fallbackQuery, true);
            return;
          }

          // No fallback query — return empty state without crashing
          onData(fallback());
          return;
        }

        // ── Permission Denied ────────────────────────────────────────────────
        if (err?.code === 'permission-denied') {
          console.error(`🔒 [SAFE-LISTENER:${key}] Permission denied. Check Firestore Security Rules.`);
          onData(fallback());
          return;
        }

        // ── Transient Errors (Retry) ─────────────────────────────────────────
        const isTransient = ['unavailable', 'resource-exhausted', 'deadline-exceeded'].includes(err?.code);
        if (isTransient && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = RETRY_DELAY_MS * retryCount;
          console.warn(`[SAFE-LISTENER:${key}] Transient error (${err.code}). Retry ${retryCount}/${MAX_RETRIES} in ${delay}ms...`);
          setTimeout(() => attach(query, isFallback), delay);
          return;
        }

        // ── Unknown / Exhausted ──────────────────────────────────────────────
        console.error(`❌ [SAFE-LISTENER:${key}] Unrecoverable error:`, err);
        onData(fallback());
      }
    );
  }

  attach(q, false);

  // 2. Register composite unsubscribe
  const masterUnsub = () => {
    cancelled = true;
    internalUnsub?.();
    activeListeners.delete(key);
  };

  activeListeners.set(key, masterUnsub);
  return masterUnsub;
}

/**
 * Utility: check whether an error is a missing-index error
 */
export function isMissingIndexError(err: any): boolean {
  return err?.code === 'failed-precondition' && (err?.message || '').includes('index');
}

/**
 * Utility: log a clean Firestore error with context
 */
export function logFirestoreError(context: string, err: any): void {
  const url = extractIndexUrl(err);
  if (url) {
    console.error(`🔥 [${context}] Index Missing → CREATE: ${url}`);
  } else {
    console.error(`❌ [${context}] Firestore Error [${err?.code}]: ${err?.message}`);
  }
}
