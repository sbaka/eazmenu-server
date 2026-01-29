import { Request, Response } from "express";

// =============================================================================
// REDIRECT SERVICE
// =============================================================================

/**
 * URL building and redirect utilities for customer-facing endpoints
 */

// Constants
export const DEFAULT_LANGUAGE = 'en';
export const REDIRECT_STATUS = 302;

// Security headers for redirects
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
} as const;

/**
 * Builds a redirect URL for the customer domain
 * @param req - Express request object
 * @param qrCode - QR code parameter
 * @param languageCode - Language code parameter
 * @returns Complete redirect URL
 */
export const buildCustomerMenuUrl = (
  req: Request, 
  qrCode: string, 
  languageCode: string
): string => {
  // Determine customer domain
  const customerDomain = process.env.CUSTOMER_DOMAIN || 
    req.get('host')?.replace('api.', '') || 
    req.get('host');
  
  // Determine protocol based on environment
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.protocol || 'http');
  
  // Build complete URL with encoded parameters
  return `${protocol}://${customerDomain}/menu?qrCode=${encodeURIComponent(qrCode)}&lang=${encodeURIComponent(languageCode)}`;
};

/**
 * Adds security headers to response
 * @param res - Express response object
 */
export const addSecurityHeaders = (res: Response): void => {
  res.set(SECURITY_HEADERS);
};

/**
 * Performs a secure redirect to the customer menu
 * @param req - Express request object
 * @param res - Express response object
 * @param qrCode - QR code parameter
 * @param languageCode - Language code parameter
 * @returns Express response
 */
export const redirectToCustomerMenu = (
  req: Request,
  res: Response,
  qrCode: string,
  languageCode: string
) => {
  const redirectUrl = buildCustomerMenuUrl(req, qrCode, languageCode);
  
  // Add security headers
  addSecurityHeaders(res);
  
  // Perform redirect
  return res.redirect(REDIRECT_STATUS, redirectUrl);
};

/**
 * Validates and normalizes redirect parameters
 * @param qrCode - QR code from request
 * @param languageCode - Language code from request
 * @returns Normalized parameters
 */
export const normalizeRedirectParams = (
  qrCode: string,
  languageCode: string | undefined
) => {
  return {
    qrCode: qrCode.trim(),
    languageCode: languageCode || DEFAULT_LANGUAGE
  };
};