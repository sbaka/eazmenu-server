import { Router } from "express";
import { storage } from "../storage";
import logger, { sanitizeError } from "../logger";
import type { CustomerMenuResponse } from "@sbaka/shared";
import { languages as langTable } from "@sbaka/shared";
import { authenticate } from "../middleware";
import { db } from "@db";
import { eq, and, desc } from "drizzle-orm";

// Import services
import {
  handleMenuError,
  handleServerError,
  validateCustomerMenuParams,
  validateLanguageCode,
  redirectToCustomerMenu,
  DEFAULT_LANGUAGE
} from "../services";

const router = Router();

// =============================================================================
// API DOCUMENTATION
// =============================================================================
/**
 * Customer Menu API
 * 
 * QR Code Redirect Endpoint:
 * GET /api/customer/menu?qrCode={qrCode}&lang={languageCode}
 * - Validates the QR code and redirects to customer domain if valid
 * - Returns error JSON if invalid
 * 
 * Menu Data API:
 * GET /api/customer/menu-data?qrCode={qrCode}&lang={languageCode}
 * - Returns menu data as JSON (for API consumers)
 * 
 * Query Parameters:
 * - qrCode (required): The QR code from the table
 * - lang (optional): Language code (e.g., "en", "fr", "ar")
 * 
 * Example Usage:
 * GET /api/customer/menu?qrCode=abc123&lang=en (redirects to customer domain)
 * GET /api/customer/menu-data?qrCode=abc123&lang=en (returns JSON)
 * 
 * Response:
 * {
 *   "restaurant": {
 *     "id": 1,
 *     "name": "Restaurant Name",
 *     "address": "123 Main St",
 *     "phone": "+1234567890",
 *     "email": "contact@restaurant.com"
 *   },
 *   "table": {
 *     "id": 5,
 *     "number": 12,
 *     "seats": 4
 *   },
 *   "language": {
 *     "id": 2,
 *     "code": "en",
 *     "name": "English",
 *     "active": true,
 *     "isPrimary": false
 *   },
 *   "availableLanguages": [...],
 *   "categories": [
 *     {
 *       "id": 1,
 *       "name": "Appetizers",
 *       "sortOrder": 1,
 *       "originalName": "Appetizers",
 *       "hasTranslation": true,
 *       "menuItems": [
 *         {
 *           "id": 1,
 *           "name": "Spring Rolls",
 *           "description": "Fresh spring rolls with vegetables",
 *           "price": "8.99",
 *           "active": true,
 *           "originalName": "Spring Rolls",
 *           "originalDescription": "Fresh spring rolls with vegetables",
 *           "hasTranslation": false
 *         }
 *       ]
 *     }
 *   ],
 *   "menu": [...] // Flattened menu items with category info
 * }
 * 
 * Error Responses:
 * - 400: Missing QR code
 * - 403: Table inactive
 * - 404: Invalid QR code, table not found, restaurant not found, no languages available
 * - 500: Server error
 */

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

// QR Code redirect endpoint - checks menu exists and redirects to customer domain
router.get("/api/customer/menu", async (req, res) => {
  try {
    const qrCodeParam = req.query.qrCode as string;
    const languageCodeParam = req.query.lang as string;

    // Validate input parameters
    const validation = validateCustomerMenuParams(qrCodeParam, res);
    if (!validation.isValid) {
      return;
    }

    const qrCode = validation.qrCode!;
    // Use provided language or leave undefined so the server picks the
    // restaurant's primary language from the DB.
    const hasExplicitLang = !!languageCodeParam && languageCodeParam.trim() !== '';
    const languageCode = hasExplicitLang
      ? validateLanguageCode(languageCodeParam, DEFAULT_LANGUAGE)
      : undefined;

    // Check if menu exists by attempting to fetch it
    try {
      // Fetch menu data — this also resolves the restaurant's primary language
      const menuData = await storage.getMenuByTableQrCode(qrCode, languageCode);

      // Determine redirect language: use the language the storage layer resolved
      // (which is the primary language when no explicit lang was requested)
      const resolvedLang = menuData.language?.code ?? DEFAULT_LANGUAGE;

      // If menu exists, redirect to customer domain
      logger.info(`QR code redirect: ${qrCode} -> customer domain (lang=${resolvedLang})`);
      return redirectToCustomerMenu(req, res, qrCode, resolvedLang);

    } catch (menuError) {
      // If menu doesn't exist or there's an error, return JSON error response
      logger.error(`Error validating menu for redirect: ${sanitizeError(menuError)}`);
      return handleMenuError(menuError, res);
    }

  } catch (error) {
    logger.error(`Error in QR redirect: ${sanitizeError(error)}`);
    return handleServerError(res);
  }
});

// Customer-facing menu API via QR code - PUBLIC ACCESS (no authentication required)
router.get("/api/customer/menu-data", async (req, res) => {
  try {
    const qrCodeParam = req.query.qrCode as string;
    const languageCodeParam = req.query.lang as string;

    // Validate input parameters
    const validation = validateCustomerMenuParams(qrCodeParam, res);
    if (!validation.isValid) {
      return;
    }

    const qrCode = validation.qrCode!;
    const languageCode = validateLanguageCode(languageCodeParam, DEFAULT_LANGUAGE);

    // Get menu by QR code with validated language
    const menuData: CustomerMenuResponse = await storage.getMenuByTableQrCode(qrCode, languageCode);

    return res.json(menuData);

  } catch (error) {
    logger.error(`Error fetching customer menu: ${sanitizeError(error)}`);
    return handleMenuError(error, res);
  }
});

// =============================================================================
// PREVIEW ENDPOINT — Authenticated, for admin visual editor iframe
// =============================================================================
// GET /api/customer/preview-data?restaurantId={id}&lang={languageCode}
// Requires merchant authentication + restaurant ownership.
// Returns same CustomerMenuResponse shape with a dummy table.
router.get(
  "/api/customer/preview-data",
  authenticate,
  async (req, res) => {
    try {
      const restaurantIdParam = req.query.restaurantId as string;
      const languageCodeParam = req.query.lang as string;

      if (!restaurantIdParam || isNaN(Number(restaurantIdParam))) {
        return res.status(400).json({ error: "MISSING_RESTAURANT_ID", message: "restaurantId query parameter is required" });
      }

      const restaurantId = Number(restaurantIdParam);

      // Verify ownership
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "RESTAURANT_NOT_FOUND", message: "Restaurant not found" });
      }
      if (restaurant.merchantId !== (req.user as any)?.id) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Not your restaurant" });
      }

      // Find any table for this restaurant to get a valid QR code,
      // or build the response manually if none exists
      const tables = await storage.getTablesByRestaurantId(restaurantId);
      if (tables.length > 0 && tables[0].qrCode) {
        const languageCode = languageCodeParam
          ? validateLanguageCode(languageCodeParam, DEFAULT_LANGUAGE)
          : undefined;

        const menuData: CustomerMenuResponse = await storage.getMenuByTableQrCode(
          tables[0].qrCode,
          languageCode
        );
        return res.json(menuData);
      }

      // No tables — build a minimal response so the preview still renders
      const availableLanguages = await db.query.languages.findMany({
        where: and(
          eq(langTable.restaurantId, restaurantId),
          eq(langTable.active, true)
        ),
        orderBy: [desc(langTable.isPrimary), langTable.name],
      });

      const primaryLang = availableLanguages.find(l => l.isPrimary) ?? availableLanguages[0] ?? {
        id: 0, code: "en", name: "English", active: true, isPrimary: true,
        restaurantId, createdAt: new Date(), updatedAt: new Date(),
      };

      const getCurrencySymbol = (code: string) => {
        const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$', JPY: '¥', MAD: 'د.م.' };
        return map[code] ?? code;
      };

      return res.json({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address ?? '',
          phone: restaurant.phone ?? null,
          email: restaurant.email ?? null,
          chefMessage: restaurant.chefMessage ?? null,
          themeConfig: restaurant.themeConfig ?? null,
          currency: restaurant.currency ?? 'USD',
          currencySymbol: getCurrencySymbol(restaurant.currency ?? 'USD'),
          bannerUrl: restaurant.bannerUrl ?? null,
          logoUrl: restaurant.logoUrl ?? null,
          googleMapsUrl: restaurant.googleMapsUrl ?? null,
          websiteUrl: restaurant.websiteUrl ?? null,
          instagramUrl: restaurant.instagramUrl ?? null,
          facebookUrl: restaurant.facebookUrl ?? null,
          tiktokUrl: restaurant.tiktokUrl ?? null,
        },
        table: { id: 0, number: 0, seats: 0 },
        language: primaryLang,
        availableLanguages: availableLanguages.length > 0 ? availableLanguages : [primaryLang],
        categories: [],
        menu: [],
      } satisfies CustomerMenuResponse);

    } catch (error) {
      logger.error(`Error fetching preview data: ${sanitizeError(error)}`);
      return handleServerError(res);
    }
  }
);

export default router; 