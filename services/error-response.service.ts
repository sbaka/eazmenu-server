import { Response } from "express";

// =============================================================================
// ERROR RESPONSE SERVICE
// =============================================================================

/**
 * Centralized error response handling for consistent API responses
 */

// Error message constants
export const ERROR_MESSAGES = {
  MISSING_QR_CODE: "QR code is required",
  INVALID_QR_CODE: "Invalid QR code. Please scan a valid table QR code.",
  TABLE_NOT_FOUND: "Table not found.",
  TABLE_INACTIVE: "This table is currently inactive.",
  RESTAURANT_NOT_FOUND: "Restaurant not found.",
  NO_LANGUAGES_AVAILABLE: "No languages available for this restaurant.",
  MENU_FETCH_ERROR: "An unexpected error occurred. Please try again later.",
  SERVER_ERROR: "An unexpected error occurred. Please try again later."
} as const;

// HTTP status codes for error responses
export const ERROR_STATUS_CODES = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;

/**
 * Creates a standardized error response
 * @param error - Error code/type
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param res - Express response object
 */
export const createErrorResponse = (
  error: string, 
  message: string, 
  status: number, 
  res: Response
) => {
  return res.status(status).json({ error, message });
};

/**
 * Handles menu-related errors with appropriate status codes and messages
 * @param error - The error object to handle
 * @param res - Express response object
 */
export const handleMenuError = (error: unknown, res: Response) => {
  if (error instanceof Error) {
    switch (error.message) {
      case "INVALID_QR_CODE":
        return createErrorResponse(
          "INVALID_QR_CODE", 
          ERROR_MESSAGES.INVALID_QR_CODE, 
          ERROR_STATUS_CODES.NOT_FOUND, 
          res
        );
      case "TABLE_NOT_FOUND":
        return createErrorResponse(
          "TABLE_NOT_FOUND", 
          ERROR_MESSAGES.TABLE_NOT_FOUND, 
          ERROR_STATUS_CODES.NOT_FOUND, 
          res
        );
      case "TABLE_INACTIVE":
        return createErrorResponse(
          "TABLE_INACTIVE", 
          ERROR_MESSAGES.TABLE_INACTIVE, 
          ERROR_STATUS_CODES.FORBIDDEN, 
          res
        );
      case "RESTAURANT_NOT_FOUND":
        return createErrorResponse(
          "RESTAURANT_NOT_FOUND", 
          ERROR_MESSAGES.RESTAURANT_NOT_FOUND, 
          ERROR_STATUS_CODES.NOT_FOUND, 
          res
        );
      case "NO_LANGUAGES_AVAILABLE":
        return createErrorResponse(
          "NO_LANGUAGES_AVAILABLE", 
          ERROR_MESSAGES.NO_LANGUAGES_AVAILABLE, 
          ERROR_STATUS_CODES.NOT_FOUND, 
          res
        );
      default:
        return createErrorResponse(
          "MENU_FETCH_ERROR", 
          ERROR_MESSAGES.MENU_FETCH_ERROR, 
          ERROR_STATUS_CODES.INTERNAL_SERVER_ERROR, 
          res
        );
    }
  }
  
  return createErrorResponse(
    "SERVER_ERROR", 
    ERROR_MESSAGES.SERVER_ERROR, 
    ERROR_STATUS_CODES.INTERNAL_SERVER_ERROR, 
    res
  );
};

/**
 * Handles generic server errors
 * @param res - Express response object
 */
export const handleServerError = (res: Response) => {
  return createErrorResponse(
    "SERVER_ERROR", 
    ERROR_MESSAGES.SERVER_ERROR, 
    ERROR_STATUS_CODES.INTERNAL_SERVER_ERROR, 
    res
  );
};