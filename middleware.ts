import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "@db";
import { restaurants, categories, menuItems, tables, languages, orders, menuItemTranslations, categoryTranslations } from "@sbaka/shared";
import logger, { sanitizeError } from "./logger";
import { authenticateSupabase } from "./auth";

// Authentication middleware for API routes - uses Supabase authentication
export const authenticate = authenticateSupabase;

// Customer route protection middleware - ensures customers can't access staff endpoints
export const customerOnlyRoutes = (req: any, res: any, next: any) => {
  const clientType = req.headers['x-client-type'];
  
  // Define all customer-accessible routes based on customer.ts
  // Note: req.path does NOT include the /api prefix, so patterns match the actual route paths
  const isCustomerRoute = 
    // Menu route: /menu/:restaurantId/:languageCode/:tableId
    req.path.match(/^\/menu\/\d+\/[a-z]{2}\/\d+$/) ||
    // Customer menu via QR code: /customer/menu and /customer/menu-data
    req.path === '/customer/menu' ||
    req.path === '/customer/menu-data' ||
    // Restaurant languages: /restaurants/:restaurantId/languages
    req.path.match(/^\/restaurants\/\d+\/languages$/) ||
    // Restaurant translations: /restaurants/:restaurantId/translations
    req.path.match(/^\/restaurants\/\d+\/translations$/) ||
    // Table info: /restaurants/:restaurantId/tables/:tableId
    req.path.match(/^\/restaurants\/\d+\/tables\/\d+$/) ||
    // Menu items: /restaurants/:restaurantId/menu-items
    req.path.match(/^\/restaurants\/\d+\/menu-items$/) ||
    // Categories: /restaurants/:restaurantId/categories
    req.path.match(/^\/restaurants\/\d+\/categories$/) ||
    // Orders (for future customer order placement)
    req.path.startsWith('/orders');
  
  if (clientType === 'customer' && !isCustomerRoute) {
    logger.warn(`Customer client attempted to access staff route: ${req.path}`);
    return res.status(403).json({ message: 'Access forbidden - customer routes only' });
  }
  
  next();
};

// Helper middleware to check restaurant ownership
export async function checkRestaurantOwnership(req: Request, res: Response, next: NextFunction) {
  try {
    // restaurantId can come from params, body, or query
    let restaurantId: number | undefined;
    if (req.params.restaurantId) {
      restaurantId = parseInt(req.params.restaurantId as string);
    } else if (req.body.restaurantId) {
      restaurantId = parseInt(req.body.restaurantId as string);
    } else if (typeof req.query.restaurantId === 'string') {
      restaurantId = parseInt(req.query.restaurantId);
    } else if (Array.isArray(req.query.restaurantId) && typeof req.query.restaurantId[0] === 'string') {
      restaurantId = parseInt(req.query.restaurantId[0]);
    }
    
    // Enhanced validation
    if (!restaurantId || isNaN(restaurantId) || restaurantId <= 0 || restaurantId > Number.MAX_SAFE_INTEGER) {
      logger.warn(`Invalid restaurantId attempt: ${req.params.restaurantId} from user ${req.user?.id}`);
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    
    // Find the restaurant and check ownership
    const restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, restaurantId),
    });
    
    if (!restaurant) {
      logger.warn(`Restaurant not found: ${restaurantId} requested by user ${req.user?.id}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }
    
    if (restaurant.merchantId !== req.user!.id) {
      logger.warn(`Unauthorized restaurant access: User ${req.user?.id} tried to access restaurant ${restaurantId} owned by ${restaurant.merchantId}`);
      return res.status(403).json({ message: "Forbidden" });
    }
    
    // Attach restaurant to req for downstream handlers (cast to any to avoid type error)
    (req as any).restaurant = restaurant;
    next();
  } catch (error) {
    logger.error(`Error checking restaurant ownership: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Helper: Check category ownership via restaurant
export async function checkCategoryOwnership(categoryId: number, merchantId: number) {
  const category = await db.query.categories.findFirst({
    where: eq(categories.id, categoryId),
    with: {
      restaurant: true,
    },
  });
  if (!category || category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return category;
}

// Helper: Check menu item ownership via restaurant
export async function checkMenuItemOwnership(menuItemId: number, merchantId: number) {
  const menuItem = await db.query.menuItems.findFirst({
    where: eq(menuItems.id, menuItemId),
    with: {
      category: {
        with: {
          restaurant: true,
        },
      },
    },
  });
  if (!menuItem || menuItem.category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return menuItem;
}

// Helper: Check table ownership via restaurant
export async function checkTableOwnership(tableId: number, merchantId: number) {
  const table = await db.query.tables.findFirst({
    where: eq(tables.id, tableId),
    with: {
      restaurant: true,
    },
  });
  if (!table || table.restaurant.merchantId !== merchantId) {
    return null;
  }
  return table;
}

// Helper: Check language ownership via restaurant
export async function checkLanguageOwnership(languageId: number, merchantId: number) {
  const language = await db.query.languages.findFirst({
    where: eq(languages.id, languageId),
    with: {
      restaurant: true,
    },
  });
  if (!language || language.restaurant.merchantId !== merchantId) {
    return null;
  }
  return language;
}

// Helper: Check order ownership via restaurant
export async function checkOrderOwnership(orderId: number, merchantId: number) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      restaurant: true,
    },
  });
  if (!order || order.restaurant.merchantId !== merchantId) {
    return null;
  }
  return order;
}

// Helper: Check menu item translation ownership via menu item -> category -> restaurant
export async function checkMenuItemTranslationOwnership(translationId: number, merchantId: number) {
  const translation = await db.query.menuItemTranslations.findFirst({
    where: eq(menuItemTranslations.id, translationId),
    with: {
      menuItem: {
        with: {
          category: {
            with: {
              restaurant: true,
            },
          },
        },
      },
    },
  });
  if (!translation || translation.menuItem.category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return translation;
}

// Helper: Check category translation ownership via category -> restaurant
export async function checkCategoryTranslationOwnership(translationId: number, merchantId: number) {
  const translation = await db.query.categoryTranslations.findFirst({
    where: eq(categoryTranslations.id, translationId),
    with: {
      category: {
        with: {
          restaurant: true,
        },
      },
    },
  });
  if (!translation || translation.category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return translation;
} 