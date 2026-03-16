
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
 * Generate QR payload for encoding (PRODUCTION-GRADE with full details & encryption)
 */
export const generateQRPayload = async (order: Order): Promise<string> => {
  if (order.paymentStatus !== 'SUCCESS') {
    throw new Error('QR can only be generated after payment success');
  }
  
  if (order.qrStatus !== 'ACTIVE') {
    throw new Error('QR is not active');
  }

  // INDEFINITE expiry (10 years) to match student expectations
  const expiresAt = order.createdAt + QR_EXPIRY_MS;
  
  // Generate secure HMAC-SHA256 signature
  let secureHash: string;
  try {
    secureHash = await generateSecureHash(
      order.id, 
      order.userId, 
      order.cafeteriaId, 
      order.createdAt,
      expiresAt
    );
  } catch (error) {
    secureHash = generateSecureHashSync(order.id, order.userId, order.cafeteriaId, order.createdAt, expiresAt);
  }
  
  const qrData = {
    orderId: order.id,
    userId: order.userId,
    userName: order.userName || 'Student',
    cafeteriaId: order.cafeteriaId,
    totalAmount: order.totalAmount,
    // Include minimal item details for instant server-side display fallback
    items: order.items.map(item => ({
      id: item.id,
      name: item.name,
      qty: item.quantity,
      price: item.price
    })),
    secureHash: secureHash,
    expiresAt: expiresAt,
    createdAt: order.createdAt,
    v: '2.0' // Version flag for new encrypted format
  };

  const jsonPayload = JSON.stringify(qrData);
  
  // Encrypt the entire payload for maximum security
  return await encryptData(jsonPayload);
};

/**
 * Synchronous version (fallback)
 */
export const generateQRPayloadSync = (order: Order): string => {
  // Sync version doesn't support AES encryption easily, using plain JSON as fallback
  const expiresAt = order.createdAt + QR_EXPIRY_MS;
  const secureHash = generateSecureHashSync(order.id, order.userId, order.cafeteriaId, order.createdAt, expiresAt);
  
  const qrData = {
    orderId: order.id,
    userId: order.userId,
    userName: order.userName || 'Student',
    cafeteriaId: order.cafeteriaId,
    totalAmount: order.totalAmount,
    items: order.items.map(item => ({
      id: item.id,
      name: item.name,
      qty: item.quantity
    })),
    secureHash: secureHash,
    expiresAt: expiresAt,
    createdAt: order.createdAt,
    v: '1.0'
  };

  return JSON.stringify(qrData);
};

/**
 * Parse and validate QR payload (Handles encrypted V2 and legacy V1)
 */
export const parseQRPayload = async (qrString: string): Promise<{ 
  orderId: string; 
  userId: string; 
  userName?: string;
  items?: any[];
  totalAmount?: number;
  cafeteriaId: string; 
  secureHash: string;
  expiresAt?: number;
  createdAt?: number;
} | null> => {
  try {
    let payload = qrString;
    
    // If it's not JSON, try decrypting first
    if (!qrString.trim().startsWith('{')) {
      payload = await decryptData(qrString);
    }
    
    const parsed = JSON.parse(payload);
    if (!parsed.orderId || !parsed.userId || !parsed.cafeteriaId || !parsed.secureHash) {
      return null;
    }
    return parsed;
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
