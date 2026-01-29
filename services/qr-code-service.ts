import { db } from "@db";
import { tables } from "@eazmenu/shared";
import { eq, and } from "drizzle-orm";
import { generateTableHashId, getQrCodeType, parseLegacyQrCode, type QrCodeType } from "../qr-utils";
import logger, { sanitizeError } from "../logger";

/**
 * QR Code Service - Business logic for QR code operations
 * Handles the coordination between QR code utilities and database operations
 */

export interface TableInfo {
  restaurantId: number;
  tableNumber: number;
}

export interface QrCodeLookupResult {
  table: any; // Table from database
  qrCodeType: QrCodeType;
  isValid: boolean;
}

/**
 * Generate a QR code for a table
 */
export function generateQrCodeForTable(restaurantId: number, tableNumber: number): string {
  try {
    return generateTableHashId(restaurantId, tableNumber);
  } catch (error) {
    logger.error(`Failed to generate QR code for restaurant ${restaurantId}, table ${tableNumber}: ${sanitizeError(error)}`);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Find table by QR code with comprehensive lookup strategy
 */
export async function findTableByQrCode(qrCode: string): Promise<QrCodeLookupResult> {
  try {
    const qrCodeType = getQrCodeType(qrCode);
    let table = null;

    switch (qrCodeType) {
      case 'legacy': {
        // Legacy QR code - parse and find by restaurant ID and table number
        const decodedInfo = parseLegacyQrCode(qrCode);
        if (decodedInfo) {
          table = await db.query.tables.findFirst({
            where: and(
              eq(tables.restaurantId, decodedInfo.restaurantId),
              eq(tables.number, decodedInfo.tableNumber)
            ),
          });
        }
        break;
      }
      case 'hash': {
        // Hash-based QR code - direct database lookup
        table = await db.query.tables.findFirst({
          where: eq(tables.qrCode, qrCode),
        });
        break;
      }
      case 'invalid': {
        return {
          table: null,
          qrCodeType,
          isValid: false
        };
      }
    }

    // Fallback: try direct lookup if not found by type-specific method
    if (!table) {
      table = await db.query.tables.findFirst({
        where: eq(tables.qrCode, qrCode),
      });
    }

    return {
      table,
      qrCodeType,
      isValid: table !== null
    };

  } catch (error) {
    logger.error(`Error finding table by QR code: ${sanitizeError(error)}`);
    return {
      table: null,
      qrCodeType: 'invalid',
      isValid: false
    };
  }
}

/**
 * Validate if a QR code exists and points to an active table
 */
export async function validateQrCode(qrCode: string): Promise<boolean> {
  try {
    const result = await findTableByQrCode(qrCode);
    return result.isValid && result.table?.active === true;
  } catch (error) {
    logger.error(`Error validating QR code: ${sanitizeError(error)}`);
    return false;
  }
}

/**
 * Get table information from QR code (for legacy codes only)
 */
export function getTableInfoFromLegacyQrCode(qrCode: string): TableInfo | null {
  const qrCodeType = getQrCodeType(qrCode);
  
  if (qrCodeType === 'legacy') {
    return parseLegacyQrCode(qrCode);
  }
  
  return null;
} 