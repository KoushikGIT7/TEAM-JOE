
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
    // Check expiry first (fail fast)
    if (Date.now() > expiresAt) {
      console.warn('QR Token expired:', { now: Date.now(), expiresAt });
      return false;
    }
    
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
  // Check expiry
  if (Date.now() > expiresAt) {
    return false;
  }
  
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
  try {
    // Convert base64url back to Uint8Array
    const base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
    const combined = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
    
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
    console.warn('Decryption failed, might be legacy plaintext:', error);
    return encryptedBase64; // Return as-is if decryption fails
  }
};

/**
 * Generate QR payload for encoding (REDESIGNED: COMPACT & SECURE)
 * Format: v1.<orderId>.<signature>.<expiry>
 */
export const generateQRPayload = async (order: Order): Promise<string> => {
  if (order.paymentStatus !== 'SUCCESS') {
    throw new Error('QR can only be generated after payment success');
  }
  
  if (order.qrStatus !== 'ACTIVE') {
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
 * Parse and validate QR payload (REDESIGNED for speed)
 */
export const parseQRPayload = async (qrString: string): Promise<{ 
  orderId: string; 
  secureHash: string;
  expiresAt: number;
  version: string;
} | null> => {
  try {
    // Check if it matches new dot-separated format
    if (qrString.startsWith('v1.')) {
      const parts = qrString.split('.');
      if (parts.length === 4) {
        return {
          version: parts[0],
          orderId: parts[1],
          secureHash: parts[2],
          expiresAt: parseInt(parts[3], 10)
        };
      }
    }
    
    // Fallback to legacy JSON/Encrypted formats (for transition)
    let payload = qrString;
    if (!qrString.trim().startsWith('{')) {
      try {
        payload = await decryptData(qrString);
      } catch (e) {
        return null;
      }
    }
    
    const parsed = JSON.parse(payload);
    if (!parsed.orderId || !parsed.secureHash) return null;
    
    return {
      orderId: parsed.orderId,
      secureHash: parsed.secureHash,
      expiresAt: parsed.expiresAt || 0,
      version: parsed.v || 'legacy'
    };
  } catch (err) {
    console.error('QR Parse Error:', err);
    return null;
  }
};

/**
 * Check if QR code is expired
 */
export const isQRExpired = (expiresAt?: number): boolean => {
  if (!expiresAt) return false;
  return Date.now() > expiresAt;
};
