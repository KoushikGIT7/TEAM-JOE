
import { Order } from '../types';

// Production-grade secret key (should be moved to environment variable in production)
const QR_SECRET_KEY = import.meta.env.VITE_QR_SECRET_KEY || 'JOE_QR_SECRET_2024_SECURE_TOKEN_KEY_PRODUCTION';

// QR code expiry: effectively indefinite (10 years) until scanned
export const QR_EXPIRY_MS = 10 * 365 * 24 * 60 * 60 * 1000;

/**
 * Generate HMAC-SHA256 signature for QR code (PRODUCTION-GRADE)
 * Uses Web Crypto API for secure hashing
 */
export const generateSecureHash = async (
  orderId: string, 
  userId: string, 
  cafeteriaId: string, 
  createdAt: number,
  expiresAt: number
): Promise<string> => {
  const payload = `${orderId}|${userId}|${cafeteriaId}|${createdAt}|${expiresAt}`;
  
  // Use Web Crypto API for HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(QR_SECRET_KEY);
  const messageData = encoder.encode(payload);
  
  // Import key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Generate signature
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  // Convert to base64url (URL-safe)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return base64;
};

/**
 * Synchronous fallback for backward compatibility (uses simple hash)
 * Only use if Web Crypto API is unavailable
 */
export const generateSecureHashSync = (
  orderId: string, 
  userId: string, 
  cafeteriaId: string, 
  createdAt: number,
  expiresAt: number
): string => {
  const payload = `${orderId}|${userId}|${cafeteriaId}|${createdAt}|${expiresAt}|${QR_SECRET_KEY}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hashStr = Math.abs(hash).toString(36).toUpperCase();
  const timestamp = expiresAt.toString(36).toUpperCase();
  return `${hashStr}_${timestamp}`;
};

/**
 * Verify QR code signature (async - uses HMAC-SHA256)
 */
export const verifySecureHash = async (
  orderId: string, 
  userId: string, 
  cafeteriaId: string, 
  createdAt: number,
  expiresAt: number,
  providedHash: string
): Promise<boolean> => {
  try {
    // Expiry check disabled (QR is valid until SERVED or REJECTED)
    
    // 1. Try modern HMAC verification first
    try {
      const expectedHash = await generateSecureHash(orderId, userId, cafeteriaId, createdAt, expiresAt);
      if (providedHash === expectedHash) return true;
    } catch (e) {
      console.warn('HMAC verification unavailable, falling back to sync');
    }

    // 2. Try legacy sync verification as fallback
    const expectedSyncHash = generateSecureHashSync(orderId, userId, cafeteriaId, createdAt, expiresAt);
    return providedHash === expectedSyncHash;
  } catch (error) {
    console.error('Critical hash verification error:', error);
    return false;
  }
};

/**
 * Synchronous verification (fallback)
 */
export const verifySecureHashSync = (
  orderId: string, 
  userId: string, 
  cafeteriaId: string, 
  createdAt: number,
  expiresAt: number,
  providedHash: string
): boolean => {
  // Expiry check disabled
  
  const expectedHash = generateSecureHashSync(orderId, userId, cafeteriaId, createdAt, expiresAt);
  return providedHash === expectedHash;
};

/**
 * AES-256-CBC Encryption for QR Payload (PRODUCTION-GRADE)
 */
const getEncryptionKey = async (): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(QR_SECRET_KEY.padEnd(32, '0').substring(0, 32));
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptData = async (text: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      key,
      data
    );
    
    // Combine IV + Ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64url
    return btoa(String.fromCharCode(...combined))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    console.error('Encryption failed:', error);
    return text; // Fallback to plaintext if encryption fails
  }
};

export const decryptData = async (encryptedBase64: string): Promise<string> => {
  if (!encryptedBase64 || encryptedBase64.startsWith('order_') || encryptedBase64.startsWith('{')) {
    return encryptedBase64;
  }

  try {
    // 🛡️ RECONCILE PADDING: atob requires valid base64 length (multiples of 4)
    let base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    
    const decoded = atob(base64);
    const combined = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
    
    // We expect at least IV(16) + some data
    if (combined.length < 17) return encryptedBase64;

    const iv = combined.slice(0, 16);
    const data = combined.slice(16);
    const key = await getEncryptionKey();
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    // Silently return for obvious non-base64 strings to prevent console noise
    return encryptedBase64; 
  }
};

/**
 * Generate QR payload for encoding (REDESIGNED: COMPACT & SECURE)
 * Format: v1.<orderId>.<signature>.<expiry>
 */
export const generateQRPayload = async (order: Order): Promise<string> => {
  // 🛡️ RE-LOCK: UPI orders must be SUCCESS. Cash orders can show QR while PENDING.
  const isCashWait = order.paymentType === 'CASH' && order.paymentStatus === 'PENDING';
  
  if (order.paymentStatus !== 'SUCCESS' && !isCashWait) {
    throw new Error('QR can only be generated after payment success');
  }
  
  const isRedeemable = order.qrStatus === 'ACTIVE' || order.qrStatus === 'PENDING_PAYMENT';
  if (!isRedeemable) {
    throw new Error('QR is not active');
  }

  // QR expiry in milliseconds
  const expiresAt = order.createdAt + QR_EXPIRY_MS;
  
  // Generate secure HMAC-SHA256 signature
  let signature: string;
  try {
    signature = await generateSecureHash(
      order.id, 
      order.userId, 
      order.cafeteriaId, 
      order.createdAt,
      expiresAt
    );
  } catch (error) {
    signature = generateSecureHashSync(order.id, order.userId, order.cafeteriaId, order.createdAt, expiresAt);
  }
  
  // Compact Format: v1.orderId.signature.expiry
  // We use dot as separator because it's not base64url or orderId character
  return `v1.${order.id}.${signature}.${expiresAt}`;
};

/**
 * Synchronous version
 */
export const generateQRPayloadSync = (order: Order): string => {
  const expiresAt = order.createdAt + QR_EXPIRY_MS;
  const signature = generateSecureHashSync(order.id, order.userId, order.cafeteriaId, order.createdAt, expiresAt);
  return `v1.${order.id}.${signature}.${expiresAt}`;
};

/**
 * 🏷️ structured result for QR resolution
 */
export interface ParsedIntakeQR {
  raw: string;
  orderId: string;
  paymentMode: 'CASH' | 'UPI' | 'UNKNOWN';
  timestamp?: number;
  qrKind: 'SECURE_V1' | 'LEGACY_CASH' | 'PLAINTEXT' | 'MALFORMED';
}

/**
 * 🧩 [SONIC-PARSER] Central Authority for ID Resolution (Principal Architect)
 * Extracts a valid Firestore orderId from ANY raw scan payload.
 * Strictly decoupled from Firestore to ensure multi-platform speed.
 * 
 * DESIGN LOGIC:
 * 1. Online/Modern: v1.ORDER_ID.SIGNATURE.EXPIRY (Dot-separated)
 * 2. Cash/Legacy: QR_CASH_ORDER_ID_TIMESTAMP (Underscore-prefixed)
 * 3. Fallback: order_XXXX (Plaintext)
 */
export const parseServingQR = (rawData: string): ParsedIntakeQR => {
  if (!rawData) return { raw: '', orderId: '', paymentMode: 'UNKNOWN', qrKind: 'MALFORMED' };
  let data = rawData.trim();
  
  // 🔬 Diagnostic Capture
  const result: ParsedIntakeQR = {
    raw: data,
    orderId: '',
    paymentMode: 'UNKNOWN',
    qrKind: 'MALFORMED'
  };

  // Helper to ensure 'order_' prefix exists
  const normalizeId = (id: string) => {
     if (!id) return '';
     return id.startsWith('order_') ? id : `order_${id}`;
  };

  // --- PATH 0: URL Recovery ---
  if (data.includes('/order/')) {
     const orderMatch = data.match(/order_[a-zA-Z0-9]+/);
     if (orderMatch) {
        data = orderMatch[0];
     } else {
        const parts = data.split('/');
        const id = parts[parts.length - 1].split(/[?#]/)[0];
        if (id.length >= 4) data = normalizeId(id);
     }
  }

  // --- PATH 1: Modern Secure Payload (v1.order_xxxx.hash.exp) ---
  if (data.includes('v1.')) {
     const parts = data.split('.');
     const vIdx = parts.findIndex(p => p.startsWith('v1'));
     if (vIdx !== -1 && parts.length >= vIdx + 3) {
        result.orderId = normalizeId(parts[vIdx+1]);
        result.qrKind = 'SECURE_V1';
        result.paymentMode = 'UPI'; 
        result.timestamp = parseInt(parts[vIdx+3] || '0', 10);
        return result;
     }
  }

  // --- PATH 2: Legacy Cash Confirmation ---
  if (data.includes('QR_CASH_')) {
     const parts = data.split('_');
     result.paymentMode = 'CASH';
     result.qrKind = 'LEGACY_CASH';
     
     const orderIdx = parts.findIndex(p => p.startsWith('order_'));
     if (orderIdx !== -1) {
        result.orderId = parts[orderIdx];
     } else if (parts.length >= 3) {
        result.orderId = normalizeId(parts[2]);
     }
     
     if (result.orderId) return result;
  }

  // --- PATH 3: Plaintext / Naked ID Recovery ---
  const orderMarker = data.indexOf('order_');
  if (orderMarker !== -1) {
     result.orderId = data.substring(orderMarker).split(/[ .?/#]/)[0];
     result.qrKind = 'PLAINTEXT';
  } else if (data.length >= 4 && !data.includes('.')) {
     result.orderId = normalizeId(data);
     result.qrKind = 'PLAINTEXT';
  }

  return result;
};

/**
 * Parse and validate QR payload (REDESIGNED for speed)
 */
export const parseQRPayload = async (qrString: string): Promise<{ 
  orderId: string; 
  secureHash: string;
  expiresAt: number;
  version: string;
} | null> => {
  if (!qrString) return null;
  const trimmedData = qrString.trim();

  try {
    // 🛡️ RE-ROUTE: If it's a CASH token, handle it as a manual-override intake
    if (trimmedData.startsWith('QR_CASH_')) {
       return { 
          version: 'cash', 
          orderId: parseServingQR(trimmedData).orderId, 
          secureHash: 'MANUAL_OVERRIDE',
          expiresAt: 0 
       };
    }

    // 1. Check if it matches new dot-separated format (Compact)
    if (trimmedData.startsWith('v1.')) {
      const parts = trimmedData.split('.');
      if (parts.length >= 4) {
        return {
          version: parts[0],
          orderId: parts[1],
          secureHash: parts[2],
          expiresAt: parseInt(parts[3], 10)
        };
      }
    }
    
    // 2. Identify and handle JSON formats (Legacy/Manual)
    let payload = trimmedData;
    const isJson = trimmedData.startsWith('{') && trimmedData.endsWith('}');
    
    if (!isJson) {
      // Try decrypting - decryptData returns original string if it fails
      try {
        payload = await decryptData(trimmedData);
      } catch (e) {
        return null;
      }
    }
    
    // Final check for JSON after decryption
    if (payload.trim().startsWith('{')) {
      const parsed = JSON.parse(payload);
      // Support multiple naming conventions for orderId/secureHash
      const orderId = parsed.orderId || parsed.id;
      const secureHash = parsed.secureHash || parsed.hash || parsed.token;
      
      if (!orderId || !secureHash) return null;
      
      return {
        orderId,
        secureHash,
        expiresAt: parsed.expiresAt || parsed.expiry || 0,
        version: parsed.v || 'legacy'
      };
    }
    
    return null;
  } catch (err) {
    console.error('QR Parse Error:', err);
    return null;
  }
};


/**
 * Check if QR code is expired
 */
export const isQRExpired = (expiresAt?: number): boolean => {
  return false; // QR codes no longer expire based on time
};
