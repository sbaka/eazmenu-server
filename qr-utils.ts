import { createHash } from 'crypto';

/**
 * QR Code utilities for generating short, unique table identifiers
 * Pure utility functions with no database dependencies
 */

// Use a consistent salt derived from environment or a fallback
const getHashSalt = (): string => {
  return process.env.SESSION_SECRET || 'fallback-salt-for-qr-codes';
};

/**
 * Generate a short, unique hash ID for a table
 * Format: 8-character base36 string (letters + numbers)
 */
export function generateTableHashId(restaurantId: number, tableNumber: number): string {
  try {
    const salt = getHashSalt();
    
    // Create a unique string combining restaurant ID, table number, and salt
    const dataToHash = `${restaurantId}-${tableNumber}-${salt}`;
    
    // Generate SHA-256 hash
    const hash = createHash('sha256').update(dataToHash).digest('hex');
    
    // Take first 8 characters and convert to base36 for shorter, URL-friendly ID
    const shortHash = parseInt(hash.substring(0, 8), 16).toString(36);
    
    // Ensure it's always 8 characters by padding with zeros if needed
    return shortHash.padStart(8, '0');
    
  } catch (error) {
    throw new Error(`Failed to generate table hash ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify if a hash ID could potentially be valid (basic format check)
 */
export function isValidHashIdFormat(hashId: string): boolean {
  // Check if it's 8 characters and contains only valid base36 characters
  return /^[0-9a-z]{8}$/.test(hashId.toLowerCase());
}

/**
 * Check if a QR code is in legacy format: "restaurantId-tableNumber"
 */
export function isLegacyQrCodeFormat(qrCode: string): boolean {
  const parts = qrCode.split('-');
  if (parts.length === 2) {
    const restaurantId = parseInt(parts[0]);
    const tableNumber = parseInt(parts[1]);
    return !isNaN(restaurantId) && !isNaN(tableNumber);
  }
  return false;
}

/**
 * Parse legacy QR code format: "restaurantId-tableNumber"
 * Returns null if not a valid legacy format
 */
export function parseLegacyQrCode(qrCode: string): { restaurantId: number; tableNumber: number } | null {
  if (!isLegacyQrCodeFormat(qrCode)) {
    return null;
  }
  
  const parts = qrCode.split('-');
  return {
    restaurantId: parseInt(parts[0]),
    tableNumber: parseInt(parts[1])
  };
}

/**
 * Determine the type of QR code
 */
export type QrCodeType = 'hash' | 'legacy' | 'invalid';

export function getQrCodeType(qrCode: string): QrCodeType {
  if (isValidHashIdFormat(qrCode)) {
    return 'hash';
  }
  if (isLegacyQrCodeFormat(qrCode)) {
    return 'legacy';
  }
  return 'invalid';
}

// Alias for backward compatibility
export const encodeTableQrCode = generateTableHashId;