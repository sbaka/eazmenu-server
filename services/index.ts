// =============================================================================
// SERVICES INDEX
// =============================================================================

/**
 * Centralized exports for all services
 * Provides easy access to service modules throughout the application
 */

// Error Response Service
export {
  createErrorResponse,
  handleMenuError,
  handleServerError,
  ERROR_MESSAGES,
  ERROR_STATUS_CODES
} from './error-response.service';

// Validation Service
export {
  validateQrCode,
  validateLanguageCode,
  validateCustomerMenuParams
} from './validation.service';

// Redirect Service
export {
  buildCustomerMenuUrl,
  addSecurityHeaders,
  redirectToCustomerMenu,
  normalizeRedirectParams,
  DEFAULT_LANGUAGE,
  REDIRECT_STATUS,
  SECURITY_HEADERS
} from './redirect.service';

// QR Code Service (existing)
export * from './qr-code-service';