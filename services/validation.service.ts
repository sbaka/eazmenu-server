import { Response } from "express";
import { createErrorResponse, ERROR_MESSAGES, ERROR_STATUS_CODES } from "./error-response.service";

// =============================================================================
// VALIDATION SERVICE
// =============================================================================

/**
 * Input validation utilities for API endpoints
 */

/**
 * Validates QR code parameter
 * @param qrCode - The QR code string to validate
 * @param res - Express response object (for sending error response if validation fails)
 * @returns true if valid, false if invalid (and error response sent)
 */
export const validateQrCode = (qrCode: string | undefined, res: Response): boolean => {
  if (!qrCode || qrCode.trim() === "") {
    createErrorResponse(
      "MISSING_QR_CODE", 
      ERROR_MESSAGES.MISSING_QR_CODE, 
      ERROR_STATUS_CODES.BAD_REQUEST, 
      res
    );
    return false;
  }
  return true;
};

/**
 * Validates and normalizes language code parameter
 * @param languageCode - The language code to validate
 * @param defaultLanguage - Default language to use if none provided
 * @returns Validated language code
 */
export const validateLanguageCode = (languageCode: string | undefined, defaultLanguage = 'en'): string => {
  // If no language code provided, use default
  if (!languageCode || languageCode.trim() === "") {
    return defaultLanguage;
  }
  
  // Basic language code validation (2-5 characters, letters and hyphens only)
  const cleanLanguageCode = languageCode.trim().toLowerCase();
  if (!/^[a-z]{2,5}(-[a-z]{2,5})?$/i.test(cleanLanguageCode)) {
    return defaultLanguage;
  }
  
  return cleanLanguageCode;
};

/**
 * Validates required query parameters for customer menu endpoints
 * @param qrCode - QR code parameter
 * @param res - Express response object
 * @returns Validation result
 */
export const validateCustomerMenuParams = (
  qrCode: string | undefined, 
  res: Response
): { isValid: boolean; qrCode?: string } => {
  if (!validateQrCode(qrCode, res)) {
    return { isValid: false };
  }
  
  return { 
    isValid: true, 
    qrCode: qrCode!.trim() 
  };
};