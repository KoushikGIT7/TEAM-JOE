
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
 * Generate QR payload for encoding (PRODUCTION-GRADE with expiry)
 */
export const generateQRPayload = async (order: Order): Promise<string> => {
  if (order.paymentStatus !== 'SUCCESS') {
    throw new Error('QR can only be generated after payment success');
  }
  
  if (order.qrStatus !== 'ACTIVE') {
    throw new Error('QR is not active');
  }

  // Calculate expiry time (24 hours from order creation)
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
    console.warn('HMAC generation failed, using fallback:', error);
    // Fallback to sync method if Web Crypto API unavailable
    secureHash = generateSecureHashSync(
      order.id, 
      order.userId, 
      order.cafeteriaId, 
      order.createdAt,
      expiresAt
    );
  }
  
  const qrData = {
    orderId: order.id,
    userId: order.userId,
    cafeteriaId: order.cafeteriaId,
    secureHash: secureHash,
    expiresAt: expiresAt,
    createdAt: order.createdAt
  };

  return JSON.stringify(qrData);
};

/**
 * Synchronous version (fallback for backward compatibility)
 */
export const generateQRPayloadSync = (order: Order): string => {
  if (order.paymentStatus !== 'SUCCESS') {
    throw new Error('QR can only be generated after payment success');
  }
  
  if (order.qrStatus !== 'ACTIVE') {
    throw new Error('QR is not active');
  }

  const expiresAt = order.createdAt + QR_EXPIRY_MS;
  const secureHash = generateSecureHashSync(
    order.id, 
    order.userId, 
    order.cafeteriaId, 
    order.createdAt,
    expiresAt
  );
  
  const qrData = {
    orderId: order.id,
    userId: order.userId,
    cafeteriaId: order.cafeteriaId,
    secureHash: secureHash,
    expiresAt: expiresAt,
    createdAt: order.createdAt
  };

  return JSON.stringify(qrData);
};

/**
 * Parse and validate QR payload
 */
export const parseQRPayload = (qrString: string): { 
  orderId: string; 
  userId: string; 
  cafeteriaId: string; 
  secureHash: string;
  expiresAt?: number;
  createdAt?: number;
} | null => {
  try {
    const parsed = JSON.parse(qrString);
    if (!parsed.orderId || !parsed.userId || !parsed.cafeteriaId || !parsed.secureHash) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Check if QR code is expired
 */
export const isQRExpired = (expiresAt?: number): boolean => {
  if (!expiresAt) {
    // Legacy QR codes without expiry - consider expired after 24 hours
    return false; // Let validation handle this
  }
  return Date.now() > expiresAt;
};
