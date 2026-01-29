var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// db/index.ts
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@sbaka/shared";
import { config } from "dotenv";
var isProduction, isStaging, pool, db;
var init_db = __esm({
  "db/index.ts"() {
    "use strict";
    config({ override: false });
    if (!process.env.DATABASE_URL) {
      console.error("Environment variables check:");
      console.error("NODE_ENV:", process.env.NODE_ENV);
      console.error("DATABASE_URL defined:", !!process.env.DATABASE_URL);
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?"
      );
    }
    isProduction = process.env.NODE_ENV === "production";
    isStaging = process.env.NODE_ENV === "staging";
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction || isStaging ? {
        rejectUnauthorized: false
        // Required for most cloud PostgreSQL providers
      } : false,
      // Connection pool optimization
      max: 10,
      // Maximum connections
      idleTimeoutMillis: 3e4,
      // Close idle connections after 30s
      connectionTimeoutMillis: 5e3
      // Fail fast on connection issues
    });
    pool.connect().then((client) => {
      client.release();
      console.log("Database connection pool warmed up");
    }).catch((err) => {
      console.error("Failed to warm up connection pool:", err.message);
    });
    db = drizzle(pool, { schema });
  }
});

// logger.ts
import winston from "winston";
var levels, level, colors, format, transports, logger, sanitizeError, logger_default;
var init_logger = __esm({
  "logger.ts"() {
    "use strict";
    levels = {
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      debug: 4
    };
    level = () => {
      const env = process.env.NODE_ENV || "development";
      const isDevelopment2 = env === "development";
      return isDevelopment2 ? "debug" : "info";
    };
    colors = {
      error: "red",
      warn: "yellow",
      info: "green",
      http: "magenta",
      debug: "blue"
    };
    winston.addColors(colors);
    format = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
      winston.format.colorize({ all: true }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    );
    transports = [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: "logs/error.log",
        level: "error"
      }),
      new winston.transports.File({ filename: "logs/all.log" })
    ];
    logger = winston.createLogger({
      level: level(),
      levels,
      format,
      transports
    });
    sanitizeError = (error) => {
      const isProductionLike = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
      if (isProductionLike) {
        return "An unexpected error occurred";
      }
      if (error instanceof Error) {
        return error.message;
      }
      return String(error);
    };
    logger_default = logger;
  }
});

// qr-utils.ts
import { createHash } from "crypto";
function generateTableHashId(restaurantId, tableNumber) {
  try {
    const salt = getHashSalt();
    const dataToHash = `${restaurantId}-${tableNumber}-${salt}`;
    const hash = createHash("sha256").update(dataToHash).digest("hex");
    const shortHash = parseInt(hash.substring(0, 8), 16).toString(36);
    return shortHash.padStart(8, "0");
  } catch (error) {
    throw new Error(`Failed to generate table hash ID: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
function isValidHashIdFormat(hashId) {
  return /^[0-9a-z]{8}$/.test(hashId.toLowerCase());
}
function isLegacyQrCodeFormat(qrCode) {
  const parts = qrCode.split("-");
  if (parts.length === 2) {
    const restaurantId = parseInt(parts[0]);
    const tableNumber = parseInt(parts[1]);
    return !isNaN(restaurantId) && !isNaN(tableNumber);
  }
  return false;
}
function parseLegacyQrCode(qrCode) {
  if (!isLegacyQrCodeFormat(qrCode)) {
    return null;
  }
  const parts = qrCode.split("-");
  return {
    restaurantId: parseInt(parts[0]),
    tableNumber: parseInt(parts[1])
  };
}
function getQrCodeType(qrCode) {
  if (isValidHashIdFormat(qrCode)) {
    return "hash";
  }
  if (isLegacyQrCodeFormat(qrCode)) {
    return "legacy";
  }
  return "invalid";
}
var getHashSalt;
var init_qr_utils = __esm({
  "qr-utils.ts"() {
    "use strict";
    getHashSalt = () => {
      return process.env.SESSION_SECRET || "fallback-salt-for-qr-codes";
    };
  }
});

// services/qr-code-service.ts
import { tables } from "@sbaka/shared";
import { eq, and } from "drizzle-orm";
function generateQrCodeForTable(restaurantId, tableNumber) {
  try {
    return generateTableHashId(restaurantId, tableNumber);
  } catch (error) {
    logger_default.error(`Failed to generate QR code for restaurant ${restaurantId}, table ${tableNumber}: ${sanitizeError(error)}`);
    throw new Error("Failed to generate QR code");
  }
}
async function findTableByQrCode(qrCode) {
  try {
    const qrCodeType = getQrCodeType(qrCode);
    let table = null;
    switch (qrCodeType) {
      case "legacy": {
        const decodedInfo = parseLegacyQrCode(qrCode);
        if (decodedInfo) {
          table = await db.query.tables.findFirst({
            where: and(
              eq(tables.restaurantId, decodedInfo.restaurantId),
              eq(tables.number, decodedInfo.tableNumber)
            )
          });
        }
        break;
      }
      case "hash": {
        table = await db.query.tables.findFirst({
          where: eq(tables.qrCode, qrCode)
        });
        break;
      }
      case "invalid": {
        return {
          table: null,
          qrCodeType,
          isValid: false
        };
      }
    }
    if (!table) {
      table = await db.query.tables.findFirst({
        where: eq(tables.qrCode, qrCode)
      });
    }
    return {
      table,
      qrCodeType,
      isValid: table !== null
    };
  } catch (error) {
    logger_default.error(`Error finding table by QR code: ${sanitizeError(error)}`);
    return {
      table: null,
      qrCodeType: "invalid",
      isValid: false
    };
  }
}
var init_qr_code_service = __esm({
  "services/qr-code-service.ts"() {
    "use strict";
    init_db();
    init_qr_utils();
    init_logger();
  }
});

// middleware.ts
var middleware_exports = {};
__export(middleware_exports, {
  authenticate: () => authenticate,
  checkCategoryOwnership: () => checkCategoryOwnership,
  checkCategoryTranslationOwnership: () => checkCategoryTranslationOwnership,
  checkLanguageOwnership: () => checkLanguageOwnership,
  checkMenuItemOwnership: () => checkMenuItemOwnership,
  checkMenuItemTranslationOwnership: () => checkMenuItemTranslationOwnership,
  checkOrderOwnership: () => checkOrderOwnership,
  checkRestaurantOwnership: () => checkRestaurantOwnership,
  checkTableOwnership: () => checkTableOwnership,
  customerOnlyRoutes: () => customerOnlyRoutes
});
import { eq as eq2 } from "drizzle-orm";
import { restaurants, categories, menuItems, tables as tables2, languages, orders, menuItemTranslations, categoryTranslations } from "@sbaka/shared";
async function checkRestaurantOwnership(req, res, next) {
  try {
    let restaurantId;
    if (req.params.restaurantId) {
      restaurantId = parseInt(req.params.restaurantId);
    } else if (req.body.restaurantId) {
      restaurantId = parseInt(req.body.restaurantId);
    } else if (typeof req.query.restaurantId === "string") {
      restaurantId = parseInt(req.query.restaurantId);
    } else if (Array.isArray(req.query.restaurantId) && typeof req.query.restaurantId[0] === "string") {
      restaurantId = parseInt(req.query.restaurantId[0]);
    }
    if (!restaurantId || isNaN(restaurantId) || restaurantId <= 0 || restaurantId > Number.MAX_SAFE_INTEGER) {
      logger_default.warn(`Invalid restaurantId attempt: ${req.params.restaurantId} from user ${req.user?.id}`);
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: eq2(restaurants.id, restaurantId)
    });
    if (!restaurant) {
      logger_default.warn(`Restaurant not found: ${restaurantId} requested by user ${req.user?.id}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.merchantId !== req.user.id) {
      logger_default.warn(`Unauthorized restaurant access: User ${req.user?.id} tried to access restaurant ${restaurantId} owned by ${restaurant.merchantId}`);
      return res.status(403).json({ message: "Forbidden" });
    }
    req.restaurant = restaurant;
    next();
  } catch (error) {
    logger_default.error(`Error checking restaurant ownership: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function checkCategoryOwnership(categoryId, merchantId) {
  const category = await db.query.categories.findFirst({
    where: eq2(categories.id, categoryId),
    with: {
      restaurant: true
    }
  });
  if (!category || category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return category;
}
async function checkMenuItemOwnership(menuItemId, merchantId) {
  const menuItem = await db.query.menuItems.findFirst({
    where: eq2(menuItems.id, menuItemId),
    with: {
      category: {
        with: {
          restaurant: true
        }
      }
    }
  });
  if (!menuItem || menuItem.category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return menuItem;
}
async function checkTableOwnership(tableId, merchantId) {
  const table = await db.query.tables.findFirst({
    where: eq2(tables2.id, tableId),
    with: {
      restaurant: true
    }
  });
  if (!table || table.restaurant.merchantId !== merchantId) {
    return null;
  }
  return table;
}
async function checkLanguageOwnership(languageId, merchantId) {
  const language = await db.query.languages.findFirst({
    where: eq2(languages.id, languageId),
    with: {
      restaurant: true
    }
  });
  if (!language || language.restaurant.merchantId !== merchantId) {
    return null;
  }
  return language;
}
async function checkOrderOwnership(orderId, merchantId) {
  const order = await db.query.orders.findFirst({
    where: eq2(orders.id, orderId),
    with: {
      restaurant: true
    }
  });
  if (!order || order.restaurant.merchantId !== merchantId) {
    return null;
  }
  return order;
}
async function checkMenuItemTranslationOwnership(translationId, merchantId) {
  const translation = await db.query.menuItemTranslations.findFirst({
    where: eq2(menuItemTranslations.id, translationId),
    with: {
      menuItem: {
        with: {
          category: {
            with: {
              restaurant: true
            }
          }
        }
      }
    }
  });
  if (!translation || translation.menuItem.category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return translation;
}
async function checkCategoryTranslationOwnership(translationId, merchantId) {
  const translation = await db.query.categoryTranslations.findFirst({
    where: eq2(categoryTranslations.id, translationId),
    with: {
      category: {
        with: {
          restaurant: true
        }
      }
    }
  });
  if (!translation || translation.category.restaurant.merchantId !== merchantId) {
    return null;
  }
  return translation;
}
var authenticate, customerOnlyRoutes;
var init_middleware = __esm({
  "middleware.ts"() {
    "use strict";
    init_db();
    init_logger();
    init_auth();
    authenticate = authenticateSupabase;
    customerOnlyRoutes = (req, res, next) => {
      const clientType = req.headers["x-client-type"];
      const isCustomerRoute = (
        // Menu route: /menu/:restaurantId/:languageCode/:tableId
        req.path.match(/^\/menu\/\d+\/[a-z]{2}\/\d+$/) || // Customer menu via QR code: /customer/menu and /customer/menu-data
        req.path === "/customer/menu" || req.path === "/customer/menu-data" || // Restaurant languages: /restaurants/:restaurantId/languages
        req.path.match(/^\/restaurants\/\d+\/languages$/) || // Restaurant translations: /restaurants/:restaurantId/translations
        req.path.match(/^\/restaurants\/\d+\/translations$/) || // Table info: /restaurants/:restaurantId/tables/:tableId
        req.path.match(/^\/restaurants\/\d+\/tables\/\d+$/) || // Menu items: /restaurants/:restaurantId/menu-items
        req.path.match(/^\/restaurants\/\d+\/menu-items$/) || // Categories: /restaurants/:restaurantId/categories
        req.path.match(/^\/restaurants\/\d+\/categories$/) || // Orders (for future customer order placement)
        req.path.startsWith("/orders")
      );
      if (clientType === "customer" && !isCustomerRoute) {
        logger_default.warn(`Customer client attempted to access staff route: ${req.path}`);
        return res.status(403).json({ message: "Access forbidden - customer routes only" });
      }
      next();
    };
  }
});

// storage.ts
import { eq as eq3, and as and2, desc, sql, count, inArray, ne } from "drizzle-orm";
import {
  merchants,
  categories as categories2,
  menuItems as menuItems2,
  menuItemEvents,
  languages as languages2,
  menuItemTranslations as menuItemTranslations2,
  categoryTranslations as categoryTranslations2,
  ingredients,
  ingredientTranslations,
  menuItemIngredients,
  tables as tables3,
  orders as orders2,
  orderItems,
  restaurants as restaurants2
} from "@sbaka/shared";
var DatabaseStorage, storage;
var init_storage = __esm({
  "storage.ts"() {
    "use strict";
    init_db();
    init_logger();
    init_qr_code_service();
    DatabaseStorage = class {
      constructor() {
      }
      async getRestaurantById(id) {
        return await db.query.restaurants.findFirst({
          where: eq3(restaurants2.id, id)
        });
      }
      getRestaurantByName(name) {
        return db.query.restaurants.findFirst({
          where: eq3(restaurants2.name, name)
        });
      }
      async createRestaurant(restaurantData) {
        const [restaurant] = await db.insert(restaurants2).values({
          name: restaurantData.name,
          address: restaurantData.address,
          phone: restaurantData.phone,
          email: restaurantData.email,
          merchantId: restaurantData.merchantId
        }).returning();
        return restaurant;
      }
      async getRestaurantsByMerchantId(merchantId) {
        return await db.query.restaurants.findMany({
          where: eq3(restaurants2.merchantId, merchantId),
          orderBy: restaurants2.name
        });
      }
      async updateRestaurant(id, restaurantData, merchantId) {
        if (merchantId !== void 0) {
          const restaurant = await db.query.restaurants.findFirst({
            where: eq3(restaurants2.id, id)
          });
          if (!restaurant || restaurant.merchantId !== merchantId) {
            throw new Error("RESTAURANT_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        const [updated] = await db.update(restaurants2).set(restaurantData).where(eq3(restaurants2.id, id)).returning();
        return updated;
      }
      deleteRestaurant(id) {
        return db.delete(restaurants2).where(eq3(restaurants2.id, id)).then(() => true).catch(() => false);
      }
      async getMenuItemsByCategoryId(categoryId) {
        return db.query.menuItems.findMany({
          where: eq3(menuItems2.categoryId, categoryId),
          orderBy: menuItems2.name
        });
      }
      async getLanguagesByRestaurantId(restaurantId) {
        return db.query.languages.findMany({
          where: eq3(languages2.restaurantId, restaurantId),
          orderBy: [desc(languages2.isPrimary), languages2.name]
        });
      }
      // User methods
      async getMerchantById(id, requestingMerchantId) {
        if (requestingMerchantId !== void 0 && id !== requestingMerchantId) {
          throw new Error("MERCHANT_ACCESS_DENIED");
        }
        const result = await db.query.merchants.findFirst({
          where: eq3(merchants.id, id)
        });
        return result;
      }
      async getMerchantByUsername(username) {
        const result = await db.query.merchants.findFirst({
          where: eq3(merchants.username, username)
        });
        return result;
      }
      async getMerchantBySupabaseUserId(supabaseUserId) {
        const result = await db.query.merchants.findFirst({
          where: eq3(merchants.supabaseUserId, supabaseUserId)
        });
        return result;
      }
      async createMerchant(userData) {
        const [user] = await db.insert(merchants).values({
          username: userData.username,
          supabaseUserId: userData.supabaseUserId,
          email: userData.email,
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
          provider: userData.provider ?? "email"
        }).returning();
        return user;
      }
      async updateMerchant(id, data) {
        const [updated] = await db.update(merchants).set(data).where(eq3(merchants.id, id)).returning();
        return updated;
      }
      async updateMerchantProfile(id, profileData) {
        const [updated] = await db.update(merchants).set({
          email: profileData.email,
          displayName: profileData.displayName,
          avatarUrl: profileData.avatarUrl,
          provider: profileData.provider
        }).where(eq3(merchants.id, id)).returning();
        return updated;
      }
      // Category methods
      async createCategory(categoryData) {
        const [category] = await db.insert(categories2).values({
          name: categoryData.name,
          restaurantId: categoryData.restaurantId,
          sortOrder: categoryData.sortOrder
        }).returning();
        return category;
      }
      async getCategoriesByRestaurantId(restaurantId) {
        return await db.query.categories.findMany({
          where: eq3(categories2.restaurantId, restaurantId),
          orderBy: categories2.sortOrder
        });
      }
      async updateCategory(id, categoryData, merchantId) {
        if (merchantId !== void 0) {
          const { checkCategoryOwnership: checkCategoryOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
          const category = await checkCategoryOwnership2(id, merchantId);
          if (!category) {
            throw new Error("CATEGORY_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        const [updated] = await db.update(categories2).set(categoryData).where(eq3(categories2.id, id)).returning();
        return updated;
      }
      async deleteCategory(id, merchantId) {
        try {
          if (merchantId !== void 0) {
            const { checkCategoryOwnership: checkCategoryOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
            const category = await checkCategoryOwnership2(id, merchantId);
            if (!category) {
              throw new Error("CATEGORY_NOT_FOUND_OR_ACCESS_DENIED");
            }
          }
          await db.delete(categories2).where(eq3(categories2.id, id));
          return true;
        } catch (error) {
          logger_default.error(`Error deleting category: ${sanitizeError(error)}`);
          return false;
        }
      }
      // MenuItem methods
      async createMenuItem(menuItemData) {
        const [menuItem] = await db.insert(menuItems2).values({
          name: menuItemData.name,
          description: menuItemData.description,
          price: menuItemData.price,
          categoryId: menuItemData.categoryId,
          active: menuItemData.active
        }).returning();
        return menuItem;
      }
      async getMenuItemsByRestaurantId(restaurantId) {
        const categoryIds = (await db.query.categories.findMany({
          where: eq3(categories2.restaurantId, restaurantId),
          columns: { id: true }
        })).map((cat) => cat.id);
        if (categoryIds.length === 0) return [];
        return await db.query.menuItems.findMany({
          where: and2(
            inArray(menuItems2.categoryId, categoryIds),
            eq3(menuItems2.active, true)
          ),
          orderBy: menuItems2.name
        });
      }
      async getMenuItemsByCategory(categoryId) {
        return await db.query.menuItems.findMany({
          where: and2(
            eq3(menuItems2.categoryId, categoryId),
            eq3(menuItems2.active, true)
          ),
          orderBy: menuItems2.name
        });
      }
      async updateMenuItem(id, menuItemData, merchantId) {
        if (merchantId !== void 0) {
          const { checkMenuItemOwnership: checkMenuItemOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
          const menuItem = await checkMenuItemOwnership2(id, merchantId);
          if (!menuItem) {
            throw new Error("MENU_ITEM_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        const [updated] = await db.update(menuItems2).set(menuItemData).where(eq3(menuItems2.id, id)).returning();
        return updated;
      }
      async deleteMenuItem(id, merchantId) {
        try {
          if (merchantId !== void 0) {
            const { checkMenuItemOwnership: checkMenuItemOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
            const menuItem = await checkMenuItemOwnership2(id, merchantId);
            if (!menuItem) {
              throw new Error("MENU_ITEM_NOT_FOUND_OR_ACCESS_DENIED");
            }
          }
          await db.update(menuItems2).set({
            active: false,
            deletedAt: /* @__PURE__ */ new Date(),
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq3(menuItems2.id, id));
          return true;
        } catch (error) {
          logger_default.error(`Error deleting menu item: ${sanitizeError(error)}`);
          return false;
        }
      }
      // Language methods
      async createLanguage(languageData) {
        const existingLanguage = await db.query.languages.findFirst({
          where: and2(
            eq3(languages2.code, languageData.code),
            eq3(languages2.restaurantId, languageData.restaurantId)
          )
        });
        if (existingLanguage) {
          throw new Error(`Language with code '${languageData.code}' already exists for this restaurant`);
        }
        if (languageData.isPrimary) {
          await db.update(languages2).set({ isPrimary: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(languages2.restaurantId, languageData.restaurantId));
        }
        const existingCount = await db.select({ count: count() }).from(languages2).where(eq3(languages2.restaurantId, languageData.restaurantId));
        if (existingCount[0].count === 0) {
          languageData.isPrimary = true;
        }
        const [language] = await db.insert(languages2).values({
          code: languageData.code,
          name: languageData.name,
          active: languageData.active,
          isPrimary: languageData.isPrimary,
          restaurantId: languageData.restaurantId
        }).returning();
        return language;
      }
      async updateLanguage(id, languageData) {
        const currentLanguage = await db.query.languages.findFirst({
          where: eq3(languages2.id, id)
        });
        if (!currentLanguage) {
          return void 0;
        }
        if (languageData.isPrimary) {
          await db.update(languages2).set({ isPrimary: false, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
            eq3(languages2.restaurantId, currentLanguage.restaurantId),
            ne(languages2.id, id)
            // Exclude current language
          ));
        }
        const [updated] = await db.update(languages2).set({ ...languageData, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(languages2.id, id)).returning();
        return updated;
      }
      async deleteLanguage(id) {
        try {
          const language = await db.query.languages.findFirst({
            where: eq3(languages2.id, id)
          });
          if (!language) {
            return false;
          }
          const languageCount = await db.select({ count: count() }).from(languages2).where(eq3(languages2.restaurantId, language.restaurantId));
          if (languageCount[0].count <= 1) {
            throw new Error("Cannot delete the last language for a restaurant");
          }
          await db.delete(languages2).where(eq3(languages2.id, id));
          if (language.isPrimary) {
            const nextLanguage = await db.query.languages.findFirst({
              where: eq3(languages2.restaurantId, language.restaurantId),
              orderBy: languages2.createdAt
            });
            if (nextLanguage) {
              await db.update(languages2).set({ isPrimary: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(languages2.id, nextLanguage.id));
            }
          }
          return true;
        } catch (error) {
          logger_default.error(`Error deleting language: ${sanitizeError(error)}`);
          return false;
        }
      }
      // Translation methods
      async createMenuItemTranslation(translationData) {
        const [translation] = await db.insert(menuItemTranslations2).values({
          name: translationData.name,
          description: translationData.description,
          menuItemId: translationData.menuItemId,
          languageId: translationData.languageId
        }).returning();
        return translation;
      }
      async getMenuItemTranslations(menuItemId, languageId) {
        if (languageId) {
          return await db.query.menuItemTranslations.findMany({
            where: and2(
              eq3(menuItemTranslations2.menuItemId, menuItemId),
              eq3(menuItemTranslations2.languageId, languageId)
            )
          });
        }
        return await db.query.menuItemTranslations.findMany({
          where: eq3(menuItemTranslations2.menuItemId, menuItemId),
          with: { language: true }
        });
      }
      async updateMenuItemTranslation(id, translationData) {
        const [updated] = await db.update(menuItemTranslations2).set(translationData).where(eq3(menuItemTranslations2.id, id)).returning();
        return updated;
      }
      async createCategoryTranslation(translationData) {
        const [translation] = await db.insert(categoryTranslations2).values({
          name: translationData.name,
          categoryId: translationData.categoryId,
          languageId: translationData.languageId
        }).returning();
        return translation;
      }
      async getCategoryTranslations(categoryId, languageId) {
        if (languageId) {
          return await db.query.categoryTranslations.findMany({
            where: and2(
              eq3(categoryTranslations2.categoryId, categoryId),
              eq3(categoryTranslations2.languageId, languageId)
            )
          });
        }
        return await db.query.categoryTranslations.findMany({
          where: eq3(categoryTranslations2.categoryId, categoryId),
          with: { language: true }
        });
      }
      async updateCategoryTranslation(id, translationData) {
        const [updated] = await db.update(categoryTranslations2).set(translationData).where(eq3(categoryTranslations2.id, id)).returning();
        return updated;
      }
      // Ingredient Translation methods
      async createIngredientTranslation(translationData) {
        const [translation] = await db.insert(ingredientTranslations).values({
          name: translationData.name,
          ingredientId: translationData.ingredientId,
          languageId: translationData.languageId
        }).returning();
        return translation;
      }
      async getIngredientTranslations(ingredientId, languageId) {
        if (languageId) {
          return await db.query.ingredientTranslations.findMany({
            where: and2(
              eq3(ingredientTranslations.ingredientId, ingredientId),
              eq3(ingredientTranslations.languageId, languageId)
            )
          });
        }
        return await db.query.ingredientTranslations.findMany({
          where: eq3(ingredientTranslations.ingredientId, ingredientId),
          with: { language: true }
        });
      }
      async updateIngredientTranslation(id, translationData) {
        const [updated] = await db.update(ingredientTranslations).set(translationData).where(eq3(ingredientTranslations.id, id)).returning();
        return updated;
      }
      // Table methods
      async createTable(tableData) {
        const qrCode = await this.generateTableQrCode(tableData.restaurantId, tableData.number);
        const [table] = await db.insert(tables3).values({
          number: tableData.number,
          seats: tableData.seats,
          restaurantId: tableData.restaurantId,
          active: tableData.active,
          qrCode
          // Add the generated QR code
        }).returning();
        return table;
      }
      // Helper method to generate QR code
      async generateTableQrCode(restaurantId, tableNumber) {
        return generateQrCodeForTable(restaurantId, tableNumber);
      }
      async getTablesByRestaurantId(restaurantId) {
        return await db.query.tables.findMany({
          where: eq3(tables3.restaurantId, restaurantId),
          orderBy: tables3.number
        });
      }
      async getTable(id) {
        return await db.query.tables.findFirst({
          where: eq3(tables3.id, id)
        });
      }
      async updateTable(id, tableData, merchantId) {
        if (merchantId !== void 0) {
          const { checkTableOwnership: checkTableOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
          const table = await checkTableOwnership2(id, merchantId);
          if (!table) {
            throw new Error("TABLE_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        const [updated] = await db.update(tables3).set(tableData).where(eq3(tables3.id, id)).returning();
        return updated;
      }
      async deleteTable(id, merchantId) {
        try {
          if (merchantId !== void 0) {
            const { checkTableOwnership: checkTableOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
            const table = await checkTableOwnership2(id, merchantId);
            if (!table) {
              throw new Error("TABLE_NOT_FOUND_OR_ACCESS_DENIED");
            }
          }
          await db.delete(tables3).where(eq3(tables3.id, id));
          return true;
        } catch (error) {
          logger_default.error(`Error deleting table: ${sanitizeError(error)}`);
          return false;
        }
      }
      // Order methods
      async createOrder(orderData) {
        const [order] = await db.insert(orders2).values({
          orderNumber: orderData.orderNumber,
          tableId: orderData.tableId,
          status: orderData.status,
          restaurantId: orderData.restaurantId,
          total: orderData.total
        }).returning();
        return order;
      }
      // Transaction-safe order creation with items
      async createOrderWithItems({ orderData, orderItems: orderItemsList }) {
        return await db.transaction(async (tx) => {
          const [order] = await tx.insert(orders2).values({
            orderNumber: orderData.orderNumber,
            tableId: orderData.tableId,
            status: orderData.status,
            restaurantId: orderData.restaurantId,
            total: orderData.total
          }).returning();
          if (!order) {
            throw new Error("Failed to create order");
          }
          if (orderItemsList.length > 0) {
            const values = orderItemsList.map((item) => ({
              orderId: order.id,
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              price: item.price,
              notes: item.notes
            }));
            await Promise.all(values.map((v) => tx.insert(orderItems).values(v)));
          }
          return order;
        });
      }
      async getOrdersByTableId(tableId, merchantId) {
        if (merchantId !== void 0) {
          const { checkTableOwnership: checkTableOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
          const table = await checkTableOwnership2(tableId, merchantId);
          if (!table) {
            throw new Error("TABLE_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        return await db.query.orders.findMany({
          where: eq3(orders2.tableId, tableId),
          orderBy: desc(orders2.createdAt),
          limit: 50,
          with: {
            table: true,
            orderItems: {
              with: {
                menuItem: true
              }
            }
          }
        });
      }
      async getOrdersByRestaurantId(restaurantId, merchantId) {
        if (merchantId !== void 0) {
          const restaurant = await db.query.restaurants.findFirst({
            where: eq3(restaurants2.id, restaurantId),
            columns: { id: true, merchantId: true }
          });
          if (!restaurant || restaurant.merchantId !== merchantId) {
            throw new Error("RESTAURANT_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        return await db.query.orders.findMany({
          where: and2(
            eq3(orders2.restaurantId, restaurantId),
            eq3(orders2.hidden, false)
          ),
          orderBy: desc(orders2.createdAt),
          with: {
            table: true,
            orderItems: {
              with: {
                menuItem: true
              }
            }
          },
          limit: 100
        });
      }
      async getOrdersByTable(tableId) {
        return await db.query.orders.findMany({
          where: eq3(orders2.tableId, tableId),
          orderBy: desc(orders2.createdAt)
        });
      }
      async getOrderWithItems(orderId, merchantId) {
        if (merchantId !== void 0) {
          const { checkOrderOwnership: checkOrderOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
          const order = await checkOrderOwnership2(orderId, merchantId);
          if (!order) {
            throw new Error("ORDER_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        return await db.query.orders.findFirst({
          where: eq3(orders2.id, orderId),
          with: {
            table: true,
            orderItems: {
              with: {
                menuItem: true
              }
            }
          }
        });
      }
      async updateOrderStatus(id, status, merchantId) {
        if (merchantId !== void 0) {
          const { checkOrderOwnership: checkOrderOwnership2 } = await Promise.resolve().then(() => (init_middleware(), middleware_exports));
          const order = await checkOrderOwnership2(id, merchantId);
          if (!order) {
            throw new Error("ORDER_NOT_FOUND_OR_ACCESS_DENIED");
          }
        }
        const updatePayload = {
          status,
          updatedAt: /* @__PURE__ */ new Date()
        };
        if (status === "Served") {
          updatePayload.servedAt = /* @__PURE__ */ new Date();
        }
        const [updated] = await db.update(orders2).set(updatePayload).where(eq3(orders2.id, id)).returning();
        return updated;
      }
      // Order item methods
      async createOrderItem(orderItemData) {
        const [orderItem] = await db.insert(orderItems).values(orderItemData).returning();
        return orderItem;
      }
      async getOrderItemsByOrder(orderId) {
        return await db.query.orderItems.findMany({
          where: eq3(orderItems.orderId, orderId),
          with: {
            menuItem: true
          }
        });
      }
      // Dashboard stats
      async getDashboardStats(restaurantId) {
        const categoryIds = (await db.query.categories.findMany({
          where: eq3(categories2.restaurantId, restaurantId),
          columns: { id: true }
        })).map((cat) => cat.id);
        let menuItemsCount = 0;
        if (categoryIds.length > 0) {
          const menuItemsResult = await db.select({ count: count() }).from(menuItems2).where(inArray(menuItems2.categoryId, categoryIds));
          menuItemsCount = menuItemsResult[0]?.count || 0;
        }
        const tablesResult = await db.select({ count: count() }).from(tables3).where(eq3(tables3.restaurantId, restaurantId));
        const tablesCount = tablesResult[0]?.count || 0;
        const tableIds = (await db.query.tables.findMany({
          where: eq3(tables3.restaurantId, restaurantId),
          columns: { id: true }
        })).map((table) => table.id);
        const today = /* @__PURE__ */ new Date();
        today.setHours(0, 0, 0, 0);
        let todayOrders = [];
        if (tableIds.length > 0) {
          todayOrders = await db.query.orders.findMany({
            where: and2(
              inArray(orders2.tableId, tableIds),
              sql`${orders2.createdAt} >= ${today}`
            )
          });
        }
        const totalOrders = todayOrders.length;
        const pendingOrders = todayOrders.filter((order) => order.status === "Received").length;
        const preparingOrders = todayOrders.filter((order) => order.status === "Preparing").length;
        const completedOrders = todayOrders.filter(
          (order) => order.status === "Ready" || order.status === "Served"
        ).length;
        let recentOrders = [];
        if (tableIds.length > 0) {
          recentOrders = await db.query.orders.findMany({
            where: inArray(orders2.tableId, tableIds),
            orderBy: desc(orders2.createdAt),
            limit: 3,
            with: {
              table: true,
              orderItems: true
            }
          });
        }
        return {
          menuItemsCount,
          tablesCount,
          todayStats: {
            totalOrders,
            pendingOrders,
            preparingOrders,
            completedOrders
          },
          recentOrders
        };
      }
      // Create menu item event (for analytics tracking)
      async createMenuItemEvent(eventData) {
        const [event] = await db.insert(menuItemEvents).values(eventData).returning();
        return event;
      }
      // Get popular menu items based on events (clicks, views, orders)
      async getPopularMenuItems(restaurantId, limit = 5) {
        const categoryIds = (await db.query.categories.findMany({
          where: eq3(categories2.restaurantId, restaurantId),
          columns: { id: true }
        })).map((cat) => cat.id);
        if (categoryIds.length === 0) {
          return [];
        }
        const eventCounts = await db.select({
          menuItemId: menuItemEvents.menuItemId,
          views: sql`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'view' THEN 1 END)`,
          clicks: sql`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'click' THEN 1 END)`,
          addToCarts: sql`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'addToCart' THEN 1 END)`,
          ordered: sql`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'ordered' THEN 1 END)`,
          totalEvents: count()
        }).from(menuItemEvents).where(eq3(menuItemEvents.restaurantId, restaurantId)).groupBy(menuItemEvents.menuItemId).orderBy(sql`COUNT(*) DESC`).limit(limit);
        const menuItemIds = eventCounts.map((e) => e.menuItemId);
        if (menuItemIds.length === 0) {
          return [];
        }
        const items = await db.query.menuItems.findMany({
          where: inArray(menuItems2.id, menuItemIds)
        });
        return eventCounts.map((eventData) => {
          const item = items.find((i) => i.id === eventData.menuItemId);
          return {
            menuItem: item,
            stats: {
              views: Number(eventData.views),
              clicks: Number(eventData.clicks),
              addToCarts: Number(eventData.addToCarts),
              ordered: Number(eventData.ordered),
              totalEvents: Number(eventData.totalEvents)
            }
          };
        });
      }
      // Get menu by table QR code with comprehensive language support
      async getMenuByTableQrCode(qrCode, languageCode) {
        try {
          const lookupResult = await findTableByQrCode(qrCode);
          if (!lookupResult.isValid || !lookupResult.table) {
            throw new Error("INVALID_QR_CODE");
          }
          const finalTable = lookupResult.table;
          if (!finalTable) {
            throw new Error("TABLE_NOT_FOUND");
          }
          if (!finalTable.active) {
            throw new Error("TABLE_INACTIVE");
          }
          const restaurant = await db.query.restaurants.findFirst({
            where: eq3(restaurants2.id, finalTable.restaurantId)
          });
          if (!restaurant) {
            throw new Error("RESTAURANT_NOT_FOUND");
          }
          const availableLanguages = await db.query.languages.findMany({
            where: and2(
              eq3(languages2.restaurantId, finalTable.restaurantId),
              eq3(languages2.active, true)
            ),
            orderBy: [desc(languages2.isPrimary), languages2.name]
          });
          if (availableLanguages.length === 0) {
            throw new Error("NO_LANGUAGES_AVAILABLE");
          }
          let targetLanguage = availableLanguages[0];
          if (languageCode) {
            const requestedLanguage = availableLanguages.find(
              (lang) => lang.code.toLowerCase() === languageCode.toLowerCase()
            );
            if (requestedLanguage) {
              targetLanguage = requestedLanguage;
            }
          }
          const restaurantCategories = await db.query.categories.findMany({
            where: eq3(categories2.restaurantId, finalTable.restaurantId),
            orderBy: categories2.sortOrder
          });
          const categoryIds = restaurantCategories.map((cat) => cat.id);
          if (categoryIds.length === 0) {
            return {
              restaurant: {
                id: restaurant.id,
                name: restaurant.name,
                address: restaurant.address ?? "",
                phone: restaurant.phone ?? null,
                email: restaurant.email ?? null,
                chefMessage: restaurant.chefMessage ?? null,
                themeConfig: restaurant.themeConfig ?? null
              },
              table: {
                id: finalTable.id,
                number: finalTable.number,
                seats: finalTable.seats
              },
              language: targetLanguage,
              availableLanguages,
              categories: [],
              menu: []
            };
          }
          const restaurantMenuItems = await db.query.menuItems.findMany({
            where: and2(
              inArray(menuItems2.categoryId, categoryIds),
              eq3(menuItems2.active, true)
            ),
            orderBy: menuItems2.name
          });
          const categoryTranslationsMap = /* @__PURE__ */ new Map();
          if (targetLanguage.id) {
            const categoryTranslationsData = await db.query.categoryTranslations.findMany({
              where: and2(
                eq3(categoryTranslations2.languageId, targetLanguage.id),
                inArray(categoryTranslations2.categoryId, categoryIds)
              )
            });
            categoryTranslationsData.forEach((translation) => {
              categoryTranslationsMap.set(translation.categoryId, translation);
            });
          }
          const menuItemTranslationsMap = /* @__PURE__ */ new Map();
          if (targetLanguage.id && restaurantMenuItems.length > 0) {
            const menuItemIds = restaurantMenuItems.map((item) => item.id);
            const menuItemTranslationsData = await db.query.menuItemTranslations.findMany({
              where: and2(
                eq3(menuItemTranslations2.languageId, targetLanguage.id),
                inArray(menuItemTranslations2.menuItemId, menuItemIds)
              )
            });
            menuItemTranslationsData.forEach((translation) => {
              menuItemTranslationsMap.set(translation.menuItemId, translation);
            });
          }
          const menuItemIngredientsMap = /* @__PURE__ */ new Map();
          if (restaurantMenuItems.length > 0) {
            const menuItemIds = restaurantMenuItems.map((item) => item.id);
            const menuItemIngredientRelations = await db.query.menuItemIngredients.findMany({
              where: inArray(menuItemIngredients.menuItemId, menuItemIds)
            });
            if (menuItemIngredientRelations.length > 0) {
              const ingredientIds = [...new Set(menuItemIngredientRelations.map((rel) => rel.ingredientId))];
              const ingredientsData = await db.query.ingredients.findMany({
                where: inArray(ingredients.id, ingredientIds)
              });
              const ingredientTranslationsData = targetLanguage.id ? await db.query.ingredientTranslations.findMany({
                where: and2(
                  eq3(ingredientTranslations.languageId, targetLanguage.id),
                  inArray(ingredientTranslations.ingredientId, ingredientIds)
                )
              }) : [];
              const ingredientNameMap = /* @__PURE__ */ new Map();
              ingredientsData.forEach((ing) => {
                const translation = ingredientTranslationsData.find((t) => t.ingredientId === ing.id);
                ingredientNameMap.set(ing.id, translation?.name || ing.name);
              });
              menuItemIngredientRelations.forEach((rel) => {
                const ingredientName = ingredientNameMap.get(rel.ingredientId);
                if (ingredientName) {
                  if (!menuItemIngredientsMap.has(rel.menuItemId)) {
                    menuItemIngredientsMap.set(rel.menuItemId, []);
                  }
                  menuItemIngredientsMap.get(rel.menuItemId).push(ingredientName);
                }
              });
            }
          }
          const localizedCategories = restaurantCategories.map((category) => {
            const categoryTranslation = categoryTranslationsMap.get(category.id);
            const categoryMenuItems = restaurantMenuItems.filter((item) => item.categoryId === category.id).map((item) => {
              const itemTranslation = menuItemTranslationsMap.get(item.id);
              const itemIngredients = menuItemIngredientsMap.get(item.id) ?? null;
              return {
                id: item.id,
                name: itemTranslation?.name || item.name,
                description: itemTranslation?.description || item.description,
                // price as string for display per shared model (two decimals)
                price: (item.price / 100).toFixed(2),
                imageUrl: item.imageUrl ?? null,
                active: item.active,
                originalName: item.name,
                originalDescription: item.description,
                hasTranslation: !!itemTranslation,
                // Nutritional information
                calories: item.calories ?? null,
                proteins: item.proteins ?? null,
                fats: item.fats ?? null,
                carbs: item.carbs ?? null,
                weight: item.weight ?? null,
                // Additional fields
                allergens: item.allergens ?? null,
                isBio: item.isBio ?? null,
                isFeatured: item.isFeatured ?? null,
                // Ingredients (translated)
                ingredients: itemIngredients
              };
            });
            return {
              id: category.id,
              name: categoryTranslation?.name || category.name,
              sortOrder: category.sortOrder,
              originalName: category.name,
              hasTranslation: !!categoryTranslation,
              menuItems: categoryMenuItems
            };
          }).filter((category) => category.menuItems.length > 0);
          return {
            restaurant: {
              id: restaurant.id,
              name: restaurant.name,
              address: restaurant.address ?? "",
              phone: restaurant.phone ?? null,
              email: restaurant.email ?? null,
              chefMessage: restaurant.chefMessage ?? null,
              themeConfig: restaurant.themeConfig ?? null
            },
            table: {
              id: finalTable.id,
              number: finalTable.number,
              seats: finalTable.seats
            },
            language: targetLanguage,
            availableLanguages,
            categories: localizedCategories,
            // Flattened menu for easier consumption
            menu: localizedCategories.flatMap(
              (cat) => cat.menuItems.map((item) => ({
                ...item,
                categoryId: cat.id,
                categoryName: cat.name,
                categoryOriginalName: cat.originalName
              }))
            )
          };
        } catch (error) {
          logger_default.error(`Error in getMenuByTableQrCode: ${sanitizeError(error)}`);
          if (error instanceof Error && [
            "TABLE_NOT_FOUND",
            "TABLE_INACTIVE",
            "RESTAURANT_NOT_FOUND",
            "NO_LANGUAGES_AVAILABLE"
          ].includes(error.message)) {
            throw error;
          }
          throw new Error("MENU_FETCH_ERROR");
        }
      }
    };
    storage = new DatabaseStorage();
  }
});

// auth.ts
import { createClient } from "@supabase/supabase-js";
function getSupabaseClient() {
  return supabase;
}
function getPrimaryProvider(supabaseUser) {
  const appProvider = supabaseUser.app_metadata?.provider;
  if (appProvider && appProvider !== "email") {
    return appProvider;
  }
  const oauthProviders = ["google", "azure", "apple", "github", "facebook"];
  const oauthIdentity = supabaseUser.identities?.find(
    (identity) => oauthProviders.includes(identity.provider)
  );
  return oauthIdentity?.provider ?? appProvider ?? "email";
}
function getIdentityData(supabaseUser) {
  if (!supabaseUser.identities || supabaseUser.identities.length === 0) {
    return {};
  }
  const oauthProviders = ["google", "azure", "apple", "github", "facebook"];
  const oauthIdentity = supabaseUser.identities.find(
    (identity) => oauthProviders.includes(identity.provider)
  );
  const primaryIdentity = oauthIdentity ?? supabaseUser.identities[0];
  return primaryIdentity?.identity_data ?? {};
}
function normalizeSupabaseProfile(supabaseUser) {
  const metadata = supabaseUser.user_metadata ?? {};
  const identityData = getIdentityData(supabaseUser);
  const provider = getPrimaryProvider(supabaseUser);
  const email = supabaseUser.email ?? null;
  const displayName = metadata.full_name ?? metadata.name ?? identityData.full_name ?? identityData.name ?? null;
  const avatarUrl = metadata.avatar_url ?? metadata.picture ?? identityData.avatar_url ?? identityData.picture ?? null;
  const explicitUsername = metadata.username ?? metadata.user_name ?? identityData.username ?? identityData.user_name;
  const username = explicitUsername ?? email?.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") ?? "user";
  return {
    email,
    displayName,
    avatarUrl,
    provider,
    username
  };
}
function hasProfileChanged(merchant, profile) {
  return merchant.email !== profile.email || merchant.displayName !== profile.displayName || merchant.avatarUrl !== profile.avatarUrl || merchant.provider !== profile.provider;
}
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}
async function createMerchantFromSupabaseUser(supabaseUser, profile) {
  const email = supabaseUser.email;
  if (!email) {
    logger_default.warn("Supabase user has no email", { supabaseUserId: supabaseUser.id });
    return void 0;
  }
  const baseUsername = profile.username;
  let username = baseUsername;
  let counter = 1;
  while (await storage.getMerchantByUsername(username)) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  logger_default.info(`Creating new merchant for Supabase user ${supabaseUser.id}`, {
    username,
    displayName: profile.displayName,
    provider: profile.provider
  });
  const merchant = await storage.createMerchant({
    username,
    supabaseUserId: supabaseUser.id,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    provider: profile.provider
  });
  const restaurantName = profile.displayName ?? username;
  const defaultRestaurant = await storage.createRestaurant({
    name: `${restaurantName}'s Restaurant`,
    address: "Default Address - Please Update",
    phone: null,
    email: profile.email,
    merchantId: merchant.id
  });
  await storage.createLanguage({
    code: "en",
    name: "English",
    active: true,
    isPrimary: true,
    restaurantId: defaultRestaurant.id
  });
  logger_default.info(`Created new merchant ${merchant.id} with restaurant ${defaultRestaurant.id}`);
  return merchant;
}
async function verifySupabaseToken(token) {
  if (!supabase) {
    return null;
  }
  try {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    if (error || !supabaseUser) {
      return null;
    }
    const merchant = await storage.getMerchantBySupabaseUserId(supabaseUser.id);
    return merchant ?? null;
  } catch {
    return null;
  }
}
function setupAuth(app2) {
  app2.set("trust proxy", 1);
  app2.get("/api/user", authenticateSupabase, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
  app2.post("/api/logout", (_req, res) => {
    res.status(200).json({ message: "Logged out successfully" });
  });
  logger_default.info("Supabase authentication configured");
}
var supabaseUrl, supabaseServiceKey, supabase, authenticateSupabase, optionalAuthenticateSupabase;
var init_auth = __esm({
  "auth.ts"() {
    "use strict";
    init_storage();
    init_logger();
    supabaseUrl = process.env.SUPABASE_URL;
    supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    supabase = null;
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
      logger_default.info("Supabase client initialized for authentication");
    } else {
      logger_default.warn("Supabase environment variables not configured. Authentication will be disabled.");
    }
    authenticateSupabase = async (req, res, next) => {
      try {
        if (!supabase) {
          logger_default.error("Supabase is not configured");
          return res.status(500).json({ message: "Authentication service not configured" });
        }
        const token = extractBearerToken(req);
        if (!token) {
          return res.status(401).json({ message: "No authorization token provided" });
        }
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
        if (error || !supabaseUser) {
          logger_default.warn("Invalid or expired token", { error: error?.message });
          return res.status(401).json({ message: "Invalid or expired token" });
        }
        req.supabaseUser = supabaseUser;
        const profile = normalizeSupabaseProfile(supabaseUser);
        let merchant = await storage.getMerchantBySupabaseUserId(supabaseUser.id);
        if (!merchant) {
          merchant = await createMerchantFromSupabaseUser(supabaseUser, profile);
        } else if (hasProfileChanged(merchant, profile)) {
          logger_default.info(`Syncing profile for merchant ${merchant.id}`, {
            oldEmail: merchant.email,
            newEmail: profile.email,
            oldDisplayName: merchant.displayName,
            newDisplayName: profile.displayName
          });
          merchant = await storage.updateMerchantProfile(merchant.id, {
            email: profile.email,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            provider: profile.provider
          });
        }
        if (!merchant) {
          logger_default.warn("Could not find or create merchant for Supabase user", { supabaseUserId: supabaseUser.id });
          return res.status(401).json({ message: "User account not found" });
        }
        req.user = merchant;
        next();
      } catch (error) {
        logger_default.error(`Authentication error: ${sanitizeError(error)}`);
        return res.status(500).json({ message: "Authentication error" });
      }
    };
    optionalAuthenticateSupabase = async (req, _res, next) => {
      try {
        const token = extractBearerToken(req);
        if (!token || !supabase) {
          return next();
        }
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
        if (!error && supabaseUser) {
          req.supabaseUser = supabaseUser;
          let merchant = await storage.getMerchantBySupabaseUserId(supabaseUser.id);
          if (merchant) {
            const profile = normalizeSupabaseProfile(supabaseUser);
            if (hasProfileChanged(merchant, profile)) {
              merchant = await storage.updateMerchantProfile(merchant.id, {
                email: profile.email,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl,
                provider: profile.provider
              });
            }
            req.user = merchant ?? void 0;
          }
        }
        next();
      } catch (error) {
        next();
      }
    };
  }
});

// db/drizzle-migrate.ts
var drizzle_migrate_exports = {};
__export(drizzle_migrate_exports, {
  runDrizzleMigrations: () => runDrizzleMigrations,
  testDatabaseConnection: () => testDatabaseConnection
});
import { drizzle as drizzle2 } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import pg2 from "pg";
import { config as config2 } from "dotenv";
async function runDrizzleMigrations() {
  try {
    logger_default.info("Starting database schema setup...");
    await ensureDatabaseExists();
    const { execSync } = await import("child_process");
    logger_default.info("Synchronizing database schema...");
    try {
      const result = execSync("npm run db:push --workspace=apps/server", {
        stdio: "pipe",
        encoding: "utf8",
        cwd: process.cwd()
      });
      logger_default.info("Database schema synchronized successfully");
      if (result.includes("No changes detected")) {
        logger_default.info("Database schema is already up to date");
      }
    } catch (pushError) {
      logger_default.warn("Schema push failed, trying migration files...");
      const migrationClient = postgres(process.env.DATABASE_URL, {
        max: 1,
        ssl: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging" ? {
          rejectUnauthorized: false
        } : false
      });
      try {
        const db2 = drizzle2(migrationClient);
        await migrate(db2, { migrationsFolder: "./db/migrations" });
        logger_default.info("Migration files applied successfully");
      } catch (migrationError) {
        logger_default.warn("Migration also failed, verifying database connection...");
        await testDatabaseConnection();
        logger_default.info("Database connection verified - schema may already exist");
      } finally {
        await migrationClient.end();
      }
    }
  } catch (error) {
    logger_default.error(`Database setup failed: ${error.message}`);
    throw error;
  }
}
async function testDatabaseConnection() {
  try {
    const testClient = postgres(process.env.DATABASE_URL, {
      max: 1,
      ssl: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging" ? {
        rejectUnauthorized: false
      } : false
    });
    await testClient`SELECT 1`;
    await testClient.end();
    return true;
  } catch (error) {
    logger_default.error("Database connection test failed:", error);
    return false;
  }
}
async function ensureDatabaseExists() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const url = new URL(process.env.DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!dbName) {
    throw new Error("Database name not found in DATABASE_URL");
  }
  const postgresUrl = new URL(process.env.DATABASE_URL);
  postgresUrl.pathname = "/postgres";
  const postgresPool = new pg2.Pool({
    connectionString: postgresUrl.toString(),
    ssl: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging" ? {
      rejectUnauthorized: false
    } : false
  });
  try {
    const result = await postgresPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (result.rows.length === 0) {
      logger_default.info(`Database "${dbName}" does not exist. Creating it...`);
      await postgresPool.query(`CREATE DATABASE "${dbName}"`);
      logger_default.info(`Database "${dbName}" created successfully`);
    } else {
      logger_default.info(`Database "${dbName}" already exists`);
    }
  } catch (error) {
    logger_default.error(`Error ensuring database exists: ${error.message}`);
    throw error;
  } finally {
    await postgresPool.end();
  }
}
var init_drizzle_migrate = __esm({
  "db/drizzle-migrate.ts"() {
    "use strict";
    init_logger();
    config2();
  }
});

// index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// routes.ts
init_auth();
import { createServer } from "http";

// websocket.ts
init_db();
init_logger();
import { WebSocketServer, WebSocket } from "ws";
import { tables as tables4, restaurants as restaurants3 } from "@sbaka/shared";
import { eq as eq5, and as and4 } from "drizzle-orm";

// workers/order-cleanup.ts
init_db();
init_logger();
import { orders as orders3 } from "@sbaka/shared";
import { eq as eq4, and as and3, lt, ne as ne2, sql as sql2 } from "drizzle-orm";
var CLEANUP_INTERVAL_MS = 60 * 1e3;
var SERVED_EXPIRY_MS = 10 * 60 * 1e3;
var broadcastToTableFn = null;
function setOrderCleanupBroadcast(broadcastFn) {
  broadcastToTableFn = broadcastFn;
}
async function cleanupServedOrders() {
  try {
    const cutoffTime = new Date(Date.now() - SERVED_EXPIRY_MS);
    const ordersToHide = await db.query.orders.findMany({
      where: and3(
        eq4(orders3.status, "Served"),
        eq4(orders3.hidden, false),
        lt(orders3.servedAt, cutoffTime)
      ),
      columns: {
        id: true,
        tableId: true,
        orderNumber: true
      }
    });
    if (ordersToHide.length === 0) {
      return;
    }
    logger_default.info(`Order cleanup: hiding ${ordersToHide.length} served orders`);
    const ordersByTable = /* @__PURE__ */ new Map();
    for (const order of ordersToHide) {
      const tableOrders = ordersByTable.get(order.tableId) ?? [];
      tableOrders.push({ id: order.id, orderNumber: order.orderNumber });
      ordersByTable.set(order.tableId, tableOrders);
    }
    const orderIds = ordersToHide.map((o) => o.id);
    await db.update(orders3).set({ hidden: true, updatedAt: /* @__PURE__ */ new Date() }).where(sql2`${orders3.id} IN (${sql2.join(orderIds.map((id) => sql2`${id}`), sql2`, `)})`);
    for (const [tableId, tableOrders] of ordersByTable) {
      for (const order of tableOrders) {
        if (broadcastToTableFn) {
          broadcastToTableFn(tableId, {
            type: "order_hidden",
            orderId: order.id,
            orderNumber: order.orderNumber,
            reason: "expired"
          });
        }
      }
      const activeOrders = await db.query.orders.findMany({
        where: and3(
          eq4(orders3.tableId, tableId),
          eq4(orders3.hidden, false),
          ne2(orders3.status, "Cancelled")
        ),
        columns: { id: true }
      });
      if (activeOrders.length === 0 && broadcastToTableFn) {
        logger_default.info(`Order cleanup: all orders at table ${tableId} are complete, broadcasting table_reset`);
        broadcastToTableFn(tableId, {
          type: "table_reset",
          tableId,
          message: "All orders have been served and completed"
        });
      }
    }
  } catch (error) {
    logger_default.error(`Order cleanup error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
var cleanupIntervalId = null;
function startOrderCleanupWorker() {
  if (cleanupIntervalId) {
    logger_default.warn("Order cleanup worker already running");
    return;
  }
  logger_default.info("Starting order cleanup worker (interval: 60s, expiry: 10min)");
  cleanupServedOrders();
  cleanupIntervalId = setInterval(cleanupServedOrders, CLEANUP_INTERVAL_MS);
}
function stopOrderCleanupWorker() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger_default.info("Order cleanup worker stopped");
  }
}

// websocket.ts
init_auth();
function setupWebSocket(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    // Allow all connections initially - auth happens after connection
    verifyClient: () => {
      return true;
    }
  });
  const restaurantConnections = {};
  const tableConnections = {};
  async function handleAuthMessage(ws, data, _req) {
    try {
      const token = data.token;
      if (!token) {
        ws.send(JSON.stringify({
          type: "auth",
          success: false,
          error: "No authorization token provided. Please log in first."
        }));
        return;
      }
      const merchant = await verifySupabaseToken(token);
      if (!merchant) {
        ws.send(JSON.stringify({
          type: "auth",
          success: false,
          error: "Invalid or expired token. Please log in again."
        }));
        return;
      }
      ws.userId = merchant.id;
      ws.isAuthenticated = true;
      ws.isStaff = true;
      ws.lastPing = Date.now();
      if (!restaurantConnections[merchant.id]) {
        restaurantConnections[merchant.id] = [];
      }
      restaurantConnections[merchant.id].push(ws);
      logger_default.info(`Staff WebSocket authenticated for merchant ${merchant.id} via JWT`);
      ws.send(JSON.stringify({ type: "auth", success: true, merchantId: merchant.id }));
    } catch (error) {
      logger_default.error(`JWT authentication error: ${sanitizeError(error)}`);
      ws.send(JSON.stringify({ type: "auth", success: false, error: "Authentication failed" }));
    }
  }
  async function handleTableAuthMessage(ws, data) {
    if (typeof data.tableId === "number" && typeof data.restaurantId === "number") {
      try {
        const table = await db.query.tables.findFirst({
          where: and4(
            eq5(tables4.id, data.tableId),
            eq5(tables4.restaurantId, data.restaurantId)
          )
        });
        if (table) {
          ws.tableId = data.tableId;
          ws.restaurantId = data.restaurantId;
          ws.isAuthenticated = true;
          ws.isStaff = false;
          ws.lastPing = Date.now();
          if (!tableConnections[data.tableId]) {
            tableConnections[data.tableId] = [];
          }
          tableConnections[data.tableId].push(ws);
          logger_default.info(`Customer WebSocket authenticated for table ${data.tableId}`);
          ws.send(JSON.stringify({
            type: "table_auth",
            success: true,
            tableId: data.tableId,
            restaurantId: data.restaurantId
          }));
        } else {
          ws.send(JSON.stringify({ type: "table_auth", success: false, error: "Table not found or invalid restaurant" }));
        }
      } catch (error) {
        logger_default.error(`Table validation error: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ type: "table_auth", success: false, error: "Authentication failed" }));
      }
    } else {
      ws.send(JSON.stringify({ type: "table_auth", success: false, error: "Invalid table authentication - tableId and restaurantId required" }));
    }
  }
  async function handleNewOrderMessage(ws, data) {
    if (data.order?.id) {
      try {
        const restaurant = await db.query.restaurants.findFirst({
          where: eq5(restaurants3.id, ws.restaurantId),
          columns: { merchantId: true }
        });
        if (restaurant) {
          broadcastToRestaurant(restaurant.merchantId, {
            type: "new_order",
            order: data.order,
            tableId: ws.tableId
          });
        }
        ws.send(JSON.stringify({
          type: "order_received",
          orderId: data.order.id,
          status: "Received"
        }));
      } catch (error) {
        logger_default.error(`Error broadcasting new order: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ type: "error", message: "Failed to notify restaurant staff" }));
      }
    } else {
      ws.send(JSON.stringify({ type: "error", message: "Invalid order data" }));
    }
  }
  async function handleUpdateOrderStatusMessage(ws, data) {
    if (data.order?.id && data.order.tableId && data.order.restaurantId) {
      try {
        const restaurant = await db.query.restaurants.findFirst({
          where: and4(
            eq5(restaurants3.id, data.order.restaurantId),
            eq5(restaurants3.merchantId, ws.userId)
          ),
          columns: { id: true, merchantId: true }
        });
        if (!restaurant) {
          ws.send(JSON.stringify({ type: "error", message: "Access denied - restaurant not found or not owned by merchant" }));
          return;
        }
        const validStatuses = ["Received", "Preparing", "Ready", "Served", "Cancelled"];
        if (!validStatuses.includes(data.order.status)) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid order status" }));
          return;
        }
        broadcastToTable(data.order.tableId, {
          type: "order_status_updated",
          orderId: data.order.id,
          status: data.order.status,
          message: `Order ${data.order.orderNumber} is now ${data.order.status}`
        });
        broadcastToRestaurant(ws.userId, {
          type: "order_status_updated",
          order: data.order
        }, ws);
      } catch (error) {
        logger_default.error(`Error updating order status: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({ type: "error", message: "Failed to update order status" }));
      }
    } else {
      ws.send(JSON.stringify({ type: "error", message: "Invalid order data for status update - missing required fields" }));
    }
  }
  function handlePingMessage(ws) {
    ws.lastPing = Date.now();
    ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
  }
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    wss.clients.forEach((ws) => {
      if (ws.isAuthenticated && ws.lastPing) {
        if (now - ws.lastPing > 45e3) {
          logger_default.info("Terminating stale WebSocket connection");
          ws.terminate();
        }
      }
    });
  }, 3e4);
  function broadcastToRestaurant(merchantId, data, excludeWs) {
    if (restaurantConnections[merchantId]) {
      const message = JSON.stringify(data);
      restaurantConnections[merchantId].forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client !== excludeWs && client.isAuthenticated) {
          client.send(message);
        }
      });
    }
  }
  function broadcastToTable(tableId, data) {
    if (tableConnections[tableId]) {
      const message = JSON.stringify(data);
      tableConnections[tableId].forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.isAuthenticated) {
          client.send(message);
        }
      });
    }
  }
  wss.on("connection", (ws, req) => {
    logger_default.info("WebSocket connection established");
    ws.lastPing = Date.now();
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "ping") {
          handlePingMessage(ws);
        } else if (data.type === "auth") {
          await handleAuthMessage(ws, data, req);
        } else if (data.type === "table_auth") {
          await handleTableAuthMessage(ws, data);
        } else if (data.type === "new_order" && ws.tableId && ws.restaurantId && ws.isAuthenticated) {
          await handleNewOrderMessage(ws, data);
        } else if (data.type === "update_order_status" && ws.userId && ws.isAuthenticated && ws.isStaff) {
          await handleUpdateOrderStatusMessage(ws, data);
        } else if (!ws.isAuthenticated) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Authentication required. Please send auth or table_auth message first."
          }));
          ws.close(1008, "Authentication required");
        } else {
          ws.send(JSON.stringify({
            type: "error",
            message: `Unknown message type: ${data.type}`
          }));
        }
      } catch (error) {
        logger_default.error(`Error handling WebSocket message: ${sanitizeError(error)}`);
        ws.send(JSON.stringify({
          type: "error",
          message: sanitizeError(error)
        }));
      }
    });
    ws.on("close", () => {
      logger_default.info("WebSocket connection closed");
      cleanupConnection(ws);
    });
    ws.on("error", (error) => {
      logger_default.error(`WebSocket error: ${sanitizeError(error)}`);
      cleanupConnection(ws);
    });
  });
  function cleanupConnection(ws) {
    if (ws.userId && restaurantConnections[ws.userId]) {
      restaurantConnections[ws.userId] = restaurantConnections[ws.userId].filter(
        (connection) => connection !== ws
      );
      if (restaurantConnections[ws.userId].length === 0) {
        delete restaurantConnections[ws.userId];
      }
    }
    if (ws.tableId && tableConnections[ws.tableId]) {
      tableConnections[ws.tableId] = tableConnections[ws.tableId].filter(
        (connection) => connection !== ws
      );
      if (tableConnections[ws.tableId].length === 0) {
        delete tableConnections[ws.tableId];
      }
    }
  }
  const connectionHealthInterval = setInterval(() => {
    const now = Date.now();
    const timeout = 45e3;
    Object.keys(restaurantConnections).forEach((merchantId) => {
      restaurantConnections[Number(merchantId)] = restaurantConnections[Number(merchantId)].filter((ws) => {
        if (ws.readyState !== WebSocket.OPEN) {
          return false;
        }
        if (ws.lastPing && now - ws.lastPing > timeout) {
          logger_default.info(`Terminating stale restaurant connection for merchant ${merchantId}`);
          ws.terminate();
          return false;
        }
        return true;
      });
      if (restaurantConnections[Number(merchantId)].length === 0) {
        delete restaurantConnections[Number(merchantId)];
      }
    });
    Object.keys(tableConnections).forEach((tableId) => {
      tableConnections[Number(tableId)] = tableConnections[Number(tableId)].filter((ws) => {
        if (ws.readyState !== WebSocket.OPEN) {
          return false;
        }
        if (ws.lastPing && now - ws.lastPing > timeout) {
          logger_default.info(`Terminating stale table connection for table ${tableId}`);
          ws.terminate();
          return false;
        }
        return true;
      });
      if (tableConnections[Number(tableId)].length === 0) {
        delete tableConnections[Number(tableId)];
      }
    });
  }, 3e4);
  setOrderCleanupBroadcast(broadcastToTable);
  startOrderCleanupWorker();
  server.on("close", () => {
    logger_default.info("Cleaning up WebSocket resources");
    clearInterval(cleanupInterval);
    clearInterval(connectionHealthInterval);
    stopOrderCleanupWorker();
    wss.close();
  });
  return {
    broadcastToRestaurant,
    broadcastToTable
  };
}

// routes.ts
init_logger();

// security.ts
import rateLimit from "express-rate-limit";
init_logger();
var MAX_RATE_LIMIT_ENTRIES = 1e4;
var sessionRateStore = /* @__PURE__ */ new Map();
var ipRateStore = /* @__PURE__ */ new Map();
function evictOldestEntries(store, maxEntries) {
  if (store.size <= maxEntries) return;
  const entries = Array.from(store.entries()).sort((a, b) => a[1].lastReset - b[1].lastReset);
  const toRemove = store.size - maxEntries;
  for (let i = 0; i < toRemove; i++) {
    store.delete(entries[i][0]);
  }
  logger_default.warn(`Rate limit store evicted ${toRemove} old entries (cap: ${maxEntries})`);
}
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1e3;
  sessionRateStore.forEach((tracker, key) => {
    if (now - tracker.lastReset > oneHour) {
      sessionRateStore.delete(key);
    }
  });
  ipRateStore.forEach((tracker, key) => {
    if (now - tracker.lastReset > oneHour) {
      ipRateStore.delete(key);
    }
  });
}, 10 * 60 * 1e3);
function createSessionRateLimit(options) {
  if (isDevelopment) {
    return noOpMiddleware;
  }
  const { windowMs, maxRequests, skipSuccessfulRequests = false, blockDuration = windowMs } = options;
  return (req, res, next) => {
    const sessionId = req.sessionID;
    const userId = req.user?.id?.toString();
    const clientIP = req.ip || req.connection.remoteAddress || "unknown";
    const identifier = sessionId || userId || clientIP;
    if (!identifier) {
      return next();
    }
    const now = Date.now();
    let tracker = sessionRateStore.get(identifier);
    if (!tracker) {
      evictOldestEntries(sessionRateStore, MAX_RATE_LIMIT_ENTRIES);
      tracker = {
        requests: 0,
        lastReset: now,
        blocked: false
      };
      sessionRateStore.set(identifier, tracker);
    }
    if (now - tracker.lastReset > windowMs) {
      tracker.requests = 0;
      tracker.lastReset = now;
      tracker.blocked = false;
      delete tracker.blockUntil;
    }
    if (tracker.blocked && tracker.blockUntil && now < tracker.blockUntil) {
      const remainingMs = tracker.blockUntil - now;
      logger_default.warn(`Rate limit exceeded for session ${identifier.substring(0, 8)}...`);
      return res.status(429).json({
        message: "Rate limit exceeded",
        retryAfter: Math.ceil(remainingMs / 1e3)
      });
    }
    if (tracker.blocked && tracker.blockUntil && now >= tracker.blockUntil) {
      tracker.blocked = false;
      delete tracker.blockUntil;
      tracker.requests = 0;
      tracker.lastReset = now;
    }
    tracker.requests++;
    if (tracker.requests > maxRequests) {
      tracker.blocked = true;
      tracker.blockUntil = now + blockDuration;
      logger_default.warn(`Session ${identifier.substring(0, 8)}... blocked for ${blockDuration}ms after ${tracker.requests} requests`);
      return res.status(429).json({
        message: "Rate limit exceeded",
        retryAfter: Math.ceil(blockDuration / 1e3)
      });
    }
    res.set({
      "X-RateLimit-Limit": maxRequests.toString(),
      "X-RateLimit-Remaining": Math.max(0, maxRequests - tracker.requests).toString(),
      "X-RateLimit-Reset": new Date(tracker.lastReset + windowMs).toISOString()
    });
    if (skipSuccessfulRequests) {
      const originalSend = res.send;
      res.send = function(body) {
        if (res.statusCode >= 400) {
          tracker.requests++;
        } else {
          tracker.requests = Math.max(0, tracker.requests - 1);
        }
        return originalSend.call(this, body);
      };
    }
    next();
  };
}
function createProgressiveIPRateLimit() {
  if (isDevelopment) {
    return noOpMiddleware;
  }
  return rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: (req) => {
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";
      let tracker = ipRateStore.get(clientIP);
      if (!tracker) {
        evictOldestEntries(ipRateStore, MAX_RATE_LIMIT_ENTRIES);
        tracker = { requests: 0, lastReset: Date.now(), blocked: false };
        ipRateStore.set(clientIP, tracker);
        return 1e3;
      }
      const hoursSinceFirst = (Date.now() - tracker.lastReset) / (1e3 * 60 * 60);
      if (hoursSinceFirst > 24) {
        return 1e3;
      }
      if (tracker.requests > 5e3) return 100;
      if (tracker.requests > 2e3) return 300;
      if (tracker.requests > 1e3) return 500;
      return 1e3;
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests from this IP, please try again later" }
  });
}
var isDevelopment = process.env.NODE_ENV === "development";
if (isDevelopment) {
  logger_default.warn("\u26A0\uFE0F  Rate limiting is DISABLED in development environment");
} else {
  logger_default.info("\u2705 Rate limiting is ENABLED for production/staging environment");
}
var noOpMiddleware = (_req, _res, next) => next();
var rateLimits = {
  // Authentication endpoints - strict limits
  auth: isDevelopment ? noOpMiddleware : rateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    max: 5,
    // Very strict for auth
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many authentication attempts, please try again later" },
    skipSuccessfulRequests: true
    // Only count failed attempts
  }),
  // API calls - moderate limits per session
  api: isDevelopment ? noOpMiddleware : createSessionRateLimit({
    windowMs: 15 * 60 * 1e3,
    // 15 minutes
    maxRequests: 200,
    // Per session
    skipSuccessfulRequests: false
  }),
  // File uploads/heavy operations - stricter limits
  heavy: isDevelopment ? noOpMiddleware : createSessionRateLimit({
    windowMs: 5 * 60 * 1e3,
    // 5 minutes
    maxRequests: 10,
    // Very limited for heavy ops
    blockDuration: 15 * 60 * 1e3
    // 15 minute block
  }),
  // Customer-facing endpoints - more lenient
  customer: isDevelopment ? noOpMiddleware : rateLimit({
    windowMs: 5 * 60 * 1e3,
    // 5 minutes
    max: 100,
    // Per IP for customer endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later" }
  }),
  // Order creation - balanced security and usability
  orders: isDevelopment ? noOpMiddleware : createSessionRateLimit({
    windowMs: 5 * 60 * 1e3,
    // 5 minutes
    maxRequests: 20,
    // Reasonable limit for placing orders
    skipSuccessfulRequests: true
    // Only count failed order attempts
  })
};
function suspiciousActivityDetector(req, res, next) {
  const clientIP = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.get("User-Agent") || "";
  const path2 = req.path;
  const isStaticFile = path2.match(/\.(js|css|tsx|ts|jsx|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i) || path2.startsWith("/src/") || path2.startsWith("/node_modules/") || path2.startsWith("/assets/");
  if (!isStaticFile) {
    const suspiciousPatterns = [
      /\b(union|select|insert|delete|drop|exec|script)\b/i,
      // SQL injection attempts
      /\.\.\//g,
      // Path traversal
      /<script/i,
      // XSS attempts
      /eval\(/i
      // Code injection
    ];
    const requestString = `${path2} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        logger_default.error(`Suspicious activity detected from IP ${clientIP}: ${pattern} in ${path2}`);
        return res.status(400).json({ message: "Invalid request" });
      }
    }
  }
  if (!userAgent || userAgent.length < 10) {
    logger_default.warn(`Suspicious user agent from IP ${clientIP}: ${userAgent}`);
  }
  next();
}

// routes/health.ts
import { Router } from "express";
var router = Router();
router.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});
var health_default = router;

// routes/dashboard.ts
init_middleware();
init_storage();
import { Router as Router2 } from "express";
init_logger();
var router2 = Router2();
router2.get("/api/dashboard/:restaurantId", authenticate, rateLimits.api, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = req.restaurant.id;
    const [stats, popularItems] = await Promise.all([
      storage.getDashboardStats(restaurantId),
      storage.getPopularMenuItems(restaurantId, 5)
    ]);
    res.json({
      ...stats,
      popularItems
    });
  } catch (error) {
    logger_default.error(`Error fetching dashboard stats: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var dashboard_default = router2;

// routes/restaurants.ts
init_middleware();
init_storage();
import { Router as Router3 } from "express";
init_logger();
import { insertRestaurantSchema, themeConfigSchema } from "@sbaka/shared";
import { z } from "zod";
var router3 = Router3();
var optionalUrl = z.string().refine(
  (val) => val === "" || val === null || val === void 0 || z.string().url().safeParse(val).success,
  { message: "Invalid URL" }
).optional().nullable();
var optionalEmail = z.string().refine(
  (val) => val === "" || val === null || val === void 0 || z.string().email().safeParse(val).success,
  { message: "Invalid email" }
).optional().nullable();
var optionalPhone = z.string().refine(
  (val) => val === "" || val === null || val === void 0 || val.length >= 10,
  { message: "Phone number must be at least 10 digits" }
).optional().nullable();
var updateRestaurantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(200).optional(),
  phone: optionalPhone,
  email: optionalEmail,
  description: z.string().max(500).optional().nullable(),
  bannerUrl: optionalUrl,
  logoUrl: optionalUrl,
  googleMapsUrl: optionalUrl,
  websiteUrl: optionalUrl,
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  currency: z.string().optional(),
  timezone: z.string().optional(),
  themeConfig: themeConfigSchema,
  chefMessage: z.string().max(500).optional().nullable()
});
router3.get("/api/restaurants", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurants7 = await storage.getRestaurantsByMerchantId(req.user.id);
    res.json(restaurants7);
  } catch (error) {
    logger_default.error(`Error fetching restaurants: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router3.get("/api/restaurants/:id", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }
    const restaurant = await storage.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.merchantId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(restaurant);
  } catch (error) {
    logger_default.error(`Error fetching restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router3.post("/api/restaurants", authenticate, rateLimits.api, async (req, res) => {
  try {
    const validationResult = insertRestaurantSchema.safeParse({
      ...req.body,
      merchantId: req.user.id
    });
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors
      });
    }
    const restaurant = await storage.createRestaurant({
      ...validationResult.data,
      merchantId: req.user.id
    });
    logger_default.info(`Restaurant created: ${restaurant.name} by merchant ${req.user.id}`);
    res.status(201).json(restaurant);
  } catch (error) {
    logger_default.error(`Error creating restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router3.put("/api/restaurants/:id", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }
    const existing = await storage.getRestaurantById(restaurantId);
    if (!existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (existing.merchantId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const validationResult = updateRestaurantSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors
      });
    }
    const restaurant = await storage.updateRestaurant(
      restaurantId,
      validationResult.data,
      req.user.id
    );
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    logger_default.info(`Restaurant updated: ${restaurant.name} by merchant ${req.user.id}`);
    res.json(restaurant);
  } catch (error) {
    logger_default.error(`Error updating restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router3.delete("/api/restaurants/:id", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }
    const existing = await storage.getRestaurantById(restaurantId);
    if (!existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (existing.merchantId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const deleted = await storage.deleteRestaurant(restaurantId);
    if (!deleted) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    logger_default.info(`Restaurant deleted: ${restaurantId} by merchant ${req.user.id}`);
    res.json({ message: "Restaurant deleted successfully" });
  } catch (error) {
    logger_default.error(`Error deleting restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var restaurants_default = router3;

// routes/categories.ts
init_middleware();
init_storage();
import { Router as Router4 } from "express";
import { z as z2 } from "zod";
init_logger();
import { insertCategorySchema } from "@sbaka/shared";
var router4 = Router4();
router4.post("/api/categories/:restaurantId", authenticate, rateLimits.api, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = req.restaurant.id;
    const validatedData = insertCategorySchema.parse({
      ...req.body,
      restaurantId
    });
    const category = await storage.createCategory(validatedData);
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z2.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router4.put("/api/categories/:categoryId", authenticate, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user.id);
    if (!category) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateCategory(categoryId, { ...req.body, updatedAt: /* @__PURE__ */ new Date() }, req.user.id);
    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(updated);
  } catch (error) {
    logger_default.error(`Error updating category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router4.delete("/api/categories/:categoryId", authenticate, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user.id);
    if (!category) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const success = await storage.deleteCategory(categoryId, req.user.id);
    if (!success) {
      return res.status(404).json({ message: "Category not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger_default.error(`Error deleting category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router4.get("/api/categories/:restaurantId", authenticate, checkRestaurantOwnership, async (req, res) => {
  try {
    const categories4 = await storage.getCategoriesByRestaurantId(req.restaurant.id);
    res.json(categories4);
  } catch (error) {
    logger_default.error(`Error fetching categories: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var categories_default = router4;

// routes/menu-items.ts
init_middleware();
import { Router as Router5 } from "express";
import { z as z3 } from "zod";

// middleware/upload.ts
init_logger();
import multer from "multer";
import { nanoid } from "nanoid";
import { createClient as createClient2 } from "@supabase/supabase-js";
async function getFileType(buffer) {
  const fileType = await import("file-type");
  return fileType.fileTypeFromBuffer(buffer);
}
var supabaseUrl2 = process.env.SUPABASE_URL;
var supabaseServiceKey2 = process.env.SUPABASE_SERVICE_ROLE_KEY;
var BUCKET_NAME = "menu-items";
var ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
];
var supabase2 = null;
function getSupabaseClient2() {
  if (!supabase2) {
    if (!supabaseUrl2 || !supabaseServiceKey2) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for file uploads");
    }
    supabase2 = createClient2(supabaseUrl2, supabaseServiceKey2);
  }
  return supabase2;
}
var memoryStorage = multer.memoryStorage();
var fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  }
};
var uploadMenuItemImage = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    // 5MB limit
    files: 1
    // Only allow 1 file
  }
});
async function validateAndUploadToSupabase(req, res, next) {
  try {
    const file = req.file;
    if (!file) {
      return next();
    }
    const fileType = await getFileType(file.buffer);
    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      res.status(400).json({
        message: "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
      });
      return;
    }
    const uniqueSuffix = nanoid(10);
    const ext = fileType.ext;
    const filename = `menu-item-${uniqueSuffix}.${ext}`;
    const supabaseClient = getSupabaseClient2();
    const { error } = await supabaseClient.storage.from(BUCKET_NAME).upload(filename, file.buffer, {
      contentType: fileType.mime,
      cacheControl: "3600",
      upsert: false
    });
    if (error) {
      logger_default.error(`Supabase upload error: ${sanitizeError(error)}`);
      res.status(500).json({ message: "Failed to upload image" });
      return;
    }
    const { data: urlData } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(filename);
    req.uploadedImageUrl = urlData.publicUrl;
    req.uploadedFileName = filename;
    next();
  } catch (error) {
    logger_default.error(`Upload validation error: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Failed to process upload" });
  }
}
var deleteUploadedFile = async (filename) => {
  try {
    if (!supabaseUrl2 || !supabaseServiceKey2) {
      if (process.env.NODE_ENV === "development") {
        logger_default.warn("Supabase not configured, skipping file deletion");
      }
      return;
    }
    const supabaseClient = getSupabaseClient2();
    const { error } = await supabaseClient.storage.from(BUCKET_NAME).remove([filename]);
    if (error) {
      logger_default.error(`Error deleting file from Supabase: ${sanitizeError(error)}`);
    }
  } catch (error) {
    logger_default.error(`Error deleting uploaded file: ${sanitizeError(error)}`);
  }
};
var getFilenameFromUrl = (imageUrl) => {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname;
    const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
    return filename.startsWith("menu-item-") ? filename : null;
  } catch (error) {
    return null;
  }
};

// routes/menu-items.ts
init_storage();
init_db();
init_logger();
import { insertMenuItemSchema, menuItemIngredients as menuItemIngredients2 } from "@sbaka/shared";
import { eq as eq6 } from "drizzle-orm";
var router5 = Router5();
router5.get("/api/menu-items/:restaurantId", authenticate, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = req.restaurant.id;
    const menuItems5 = await storage.getMenuItemsByRestaurantId(restaurantId);
    res.json(menuItems5);
  } catch (error) {
    logger_default.error(`Error fetching menu items: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.get("/api/menu-items/category/:categoryId", authenticate, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user.id);
    if (!category) {
      return res.status(403).json({ message: "Category not found or access denied" });
    }
    const menuItems5 = await storage.getMenuItemsByCategory(categoryId);
    res.json(menuItems5);
  } catch (error) {
    logger_default.error(`Error fetching menu items by category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.get("/api/menu-items/:menuItemId/ingredients", authenticate, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.menuItemId);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user.id);
    if (!menuItem) {
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    const ingredients4 = await db.query.menuItemIngredients.findMany({
      where: eq6(menuItemIngredients2.menuItemId, menuItemId),
      with: {
        ingredient: {
          with: {
            translations: true
          }
        }
      }
    });
    res.json(ingredients4.map((mi) => mi.ingredient));
  } catch (error) {
    logger_default.error(`Error fetching menu item ingredients: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.post("/api/menu-items", authenticate, uploadMenuItemImage.single("image"), validateAndUploadToSupabase, async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    if (!categoryId || isNaN(Number(categoryId))) {
      if (req.uploadedFileName) {
        await deleteUploadedFile(req.uploadedFileName);
      }
      return res.status(400).json({ message: "Valid categoryId is required" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user.id);
    if (!category) {
      if (req.uploadedFileName) {
        await deleteUploadedFile(req.uploadedFileName);
      }
      return res.status(403).json({ message: "Category not found or access denied" });
    }
    const requestData = {
      ...req.body,
      categoryId: parseInt(req.body.categoryId),
      price: parseInt(req.body.price),
      active: req.body.active === "true",
      isBio: req.body.isBio === "true",
      isFeatured: req.body.isFeatured === "true",
      // Parse allergens from form data (comma-separated or JSON array)
      allergens: req.body.allergens ? typeof req.body.allergens === "string" ? req.body.allergens.startsWith("[") ? JSON.parse(req.body.allergens) : req.body.allergens.split(",").filter(Boolean) : req.body.allergens : null,
      // Use Supabase URL from middleware, or fallback to provided imageUrl
      imageUrl: req.uploadedImageUrl || req.body.imageUrl || null
    };
    const validatedData = insertMenuItemSchema.parse(requestData);
    const menuItem = await storage.createMenuItem(validatedData);
    const ingredientIds = req.body.ingredientIds;
    if (ingredientIds) {
      const parsedIngredientIds = typeof ingredientIds === "string" ? ingredientIds.startsWith("[") ? JSON.parse(ingredientIds) : ingredientIds.split(",").map(Number).filter(Boolean) : ingredientIds;
      if (Array.isArray(parsedIngredientIds) && parsedIngredientIds.length > 0) {
        await db.insert(menuItemIngredients2).values(
          parsedIngredientIds.map((ingredientId) => ({
            menuItemId: menuItem.id,
            ingredientId
          }))
        );
      }
    }
    res.status(201).json(menuItem);
  } catch (error) {
    if (req.uploadedFileName) {
      await deleteUploadedFile(req.uploadedFileName);
    }
    if (error instanceof z3.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.put("/api/menu-items/:id", authenticate, uploadMenuItemImage.single("image"), validateAndUploadToSupabase, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.id);
    if (isNaN(menuItemId)) {
      if (req.uploadedFileName) {
        await deleteUploadedFile(req.uploadedFileName);
      }
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user.id);
    if (!menuItem) {
      if (req.uploadedFileName) {
        await deleteUploadedFile(req.uploadedFileName);
      }
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    const updateData = {
      ...req.body,
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (req.uploadedImageUrl) {
      if (menuItem.imageUrl) {
        const oldFilename = getFilenameFromUrl(menuItem.imageUrl);
        if (oldFilename) {
          await deleteUploadedFile(oldFilename);
        }
      }
      updateData.imageUrl = req.uploadedImageUrl;
    } else if (req.body.categoryId) {
      updateData.categoryId = parseInt(req.body.categoryId);
      updateData.price = parseInt(req.body.price);
      updateData.active = req.body.active === "true";
      updateData.isBio = req.body.isBio === "true";
      updateData.isFeatured = req.body.isFeatured === "true";
      if (req.body.allergens !== void 0) {
        updateData.allergens = req.body.allergens ? typeof req.body.allergens === "string" ? req.body.allergens.startsWith("[") ? JSON.parse(req.body.allergens) : req.body.allergens.split(",").filter(Boolean) : req.body.allergens : null;
      }
    }
    const ingredientIds = req.body.ingredientIds;
    if (ingredientIds !== void 0) {
      await db.delete(menuItemIngredients2).where(eq6(menuItemIngredients2.menuItemId, menuItemId));
      const parsedIngredientIds = typeof ingredientIds === "string" ? ingredientIds.startsWith("[") ? JSON.parse(ingredientIds) : ingredientIds.split(",").map(Number).filter(Boolean) : ingredientIds;
      if (Array.isArray(parsedIngredientIds) && parsedIngredientIds.length > 0) {
        await db.insert(menuItemIngredients2).values(
          parsedIngredientIds.map((ingredientId) => ({
            menuItemId,
            ingredientId
          }))
        );
      }
    }
    const updated = await storage.updateMenuItem(menuItemId, updateData, req.user.id);
    if (!updated) {
      if (req.uploadedFileName) {
        await deleteUploadedFile(req.uploadedFileName);
      }
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(updated);
  } catch (error) {
    if (req.uploadedFileName) {
      await deleteUploadedFile(req.uploadedFileName);
    }
    logger_default.error(`Error updating menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.delete("/api/menu-items/:id", authenticate, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.id);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user.id);
    if (!menuItem) {
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    if (menuItem.imageUrl) {
      const filename = getFilenameFromUrl(menuItem.imageUrl);
      if (filename) {
        await deleteUploadedFile(filename);
      }
    }
    const success = await storage.deleteMenuItem(menuItemId, req.user.id);
    if (!success) {
      return res.status(404).json({ message: "Menu item not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger_default.error(`Error deleting menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var menu_items_default = router5;

// routes/ingredients.ts
init_middleware();
init_db();
init_logger();
import { Router as Router6 } from "express";
import { z as z4 } from "zod";
import { eq as eq7, asc } from "drizzle-orm";
import {
  ingredients as ingredients2,
  ingredientTranslations as ingredientTranslations2,
  insertIngredientSchema,
  INGREDIENT_CATEGORY_VALUES
} from "@sbaka/shared";
var router6 = Router6();
router6.get("/api/ingredients", authenticate, async (_req, res) => {
  try {
    const allIngredients = await db.query.ingredients.findMany({
      orderBy: [asc(ingredients2.category), asc(ingredients2.name)],
      with: {
        translations: true
      }
    });
    res.json(allIngredients);
  } catch (error) {
    logger_default.error(`Error fetching ingredients: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.get("/api/ingredients/grouped", authenticate, async (_req, res) => {
  try {
    const allIngredients = await db.query.ingredients.findMany({
      orderBy: [asc(ingredients2.category), asc(ingredients2.name)],
      with: {
        translations: true
      }
    });
    const grouped = INGREDIENT_CATEGORY_VALUES.reduce((acc, category) => {
      acc[category] = allIngredients.filter((ing) => ing.category === category);
      return acc;
    }, {});
    res.json(grouped);
  } catch (error) {
    logger_default.error(`Error fetching grouped ingredients: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.post("/api/ingredients", authenticate, async (req, res) => {
  try {
    const validatedData = insertIngredientSchema.parse(req.body);
    const existing = await db.query.ingredients.findFirst({
      where: eq7(ingredients2.name, validatedData.name)
    });
    if (existing) {
      return res.status(409).json({
        message: "Ingredient already exists",
        ingredient: existing
      });
    }
    const [ingredient] = await db.insert(ingredients2).values({
      name: validatedData.name,
      category: validatedData.category,
      isAllergen: validatedData.isAllergen ?? false
    }).returning();
    res.status(201).json(ingredient);
  } catch (error) {
    if (error instanceof z4.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating ingredient: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.get("/api/ingredients/:ingredientId/translations", authenticate, async (req, res) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ message: "Invalid ingredient ID" });
    }
    const translations = await db.query.ingredientTranslations.findMany({
      where: eq7(ingredientTranslations2.ingredientId, ingredientId)
    });
    res.json(translations);
  } catch (error) {
    logger_default.error(`Error fetching ingredient translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.post("/api/ingredients/:ingredientId/translations", authenticate, async (req, res) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ message: "Invalid ingredient ID" });
    }
    const { languageId, name } = req.body;
    if (!languageId || !name) {
      return res.status(400).json({ message: "languageId and name are required" });
    }
    const existing = await db.query.ingredientTranslations.findFirst({
      where: eq7(ingredientTranslations2.ingredientId, ingredientId)
    });
    if (existing && existing.languageId === languageId) {
      const [updated] = await db.update(ingredientTranslations2).set({ name, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(ingredientTranslations2.id, existing.id)).returning();
      return res.json(updated);
    }
    const [translation] = await db.insert(ingredientTranslations2).values({
      ingredientId,
      languageId,
      name
    }).returning();
    res.status(201).json(translation);
  } catch (error) {
    logger_default.error(`Error creating ingredient translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var ingredients_default = router6;

// routes/tables.ts
init_middleware();
init_storage();
import { Router as Router7 } from "express";
import { z as z5 } from "zod";
import { eq as eq8, and as and5 } from "drizzle-orm";
import QRCode from "qrcode";
init_db();
init_logger();
init_qr_utils();
import { insertTableSchema, restaurants as restaurants4, tables as tables5 } from "@sbaka/shared";
var router7 = Router7();
router7.get("/api/tables", authenticate, async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and5(eq8(restaurants4.id, restaurantId), eq8(restaurants4.merchantId, req.user.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    const tables7 = await storage.getTablesByRestaurantId(restaurantId);
    res.json(tables7);
  } catch (error) {
    logger_default.error(`Error fetching tables: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.post("/api/tables", authenticate, async (req, res) => {
  try {
    const restaurantId = req.body.restaurantId;
    if (!restaurantId || isNaN(Number(restaurantId))) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and5(eq8(restaurants4.id, Number(restaurantId)), eq8(restaurants4.merchantId, req.user.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    const tableData = {
      number: parseInt(req.body.number.toString()),
      seats: Number(req.body.seats),
      restaurantId: Number(restaurantId),
      active: req.body.active !== void 0 ? Boolean(req.body.active) : true,
      qrCode: generateTableHashId(Number(restaurantId), parseInt(req.body.number.toString()))
    };
    const validatedData = insertTableSchema.parse(tableData);
    const table = await storage.createTable(validatedData);
    res.status(201).json(table);
  } catch (error) {
    if (error instanceof z5.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
      });
    }
    logger_default.error(`Error creating table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.put("/api/tables/:id", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const table = await db.query.tables.findFirst({
      where: eq8(tables5.id, tableId),
      with: { restaurant: true }
    });
    if (!table || table.restaurant.merchantId !== req.user.id) {
      return res.status(403).json({ message: "Table not found or access denied" });
    }
    const updated = await storage.updateTable(tableId, { ...req.body, updatedAt: /* @__PURE__ */ new Date() }, req.user.id);
    if (!updated) {
      return res.status(404).json({ message: "Table not found" });
    }
    res.json(updated);
  } catch (error) {
    logger_default.error(`Error updating table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.delete("/api/tables/:id", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const table = await db.query.tables.findFirst({
      where: eq8(tables5.id, tableId),
      with: { restaurant: true }
    });
    if (!table || table.restaurant.merchantId !== req.user.id) {
      return res.status(403).json({ message: "Table not found or access denied" });
    }
    const success = await storage.deleteTable(tableId, req.user.id);
    if (!success) {
      return res.status(404).json({ message: "Table not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger_default.error(`Error deleting table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.get("/api/tables/qrcodes/all", authenticate, rateLimits.heavy, async (req, res) => {
  try {
    const restaurants7 = await storage.getRestaurantsByMerchantId(req.user.id);
    if (restaurants7.length === 0) {
      return res.status(404).json({ message: "No restaurants found" });
    }
    const restaurant = restaurants7[0];
    const tables7 = await storage.getTablesByRestaurantId(restaurant.id);
    const CHUNK_SIZE = 10;
    const qrCodes = [];
    const processChunk = async (startIdx) => {
      const endIdx = Math.min(startIdx + CHUNK_SIZE, tables7.length);
      const chunk = tables7.slice(startIdx, endIdx);
      const chunkResults = await Promise.all(
        chunk.map(async (table) => {
          const apiHost = process.env.API_DOMAIN || req.headers.host || "localhost:3002";
          const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol || "http";
          const menuUrl = `${protocol}://${apiHost}/api/customer/menu?qrCode=${table.qrCode}&lang=en`;
          const qrCodeDataUrl = await QRCode.toDataURL(menuUrl);
          return {
            table,
            imageUrl: menuUrl,
            qrCodeBase64: qrCodeDataUrl
          };
        })
      );
      return chunkResults;
    };
    for (let i = 0; i < tables7.length; i += CHUNK_SIZE) {
      const chunkResults = await processChunk(i);
      qrCodes.push(...chunkResults);
    }
    res.json(qrCodes);
  } catch (error) {
    logger_default.error(`Error generating QR codes: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.get("/api/tables/:id/qrcode", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    const merchantId = req.query.merchantId ? parseInt(req.query.merchantId) : req.user.id;
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const table = await db.query.tables.findFirst({
      where: eq8(tables5.id, tableId),
      with: { restaurant: true }
    });
    if (!table || table.restaurant.merchantId !== merchantId) {
      return res.status(403).json({ message: "Table not found or access denied" });
    }
    const apiHost = process.env.API_DOMAIN || req.headers.host || "localhost:3002";
    const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol || "http";
    const menuUrl = `${protocol}://${apiHost}/api/customer/menu?qrCode=${table.qrCode}&lang=en`;
    const qrCodeDataUrl = await QRCode.toDataURL(menuUrl);
    const response = {
      tableId: table.id,
      imageUrl: menuUrl,
      qrCodeBase64: qrCodeDataUrl
    };
    return res.json(response);
  } catch (error) {
    logger_default.error(`Error generating QR code: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var tables_default = router7;

// routes/orders.ts
init_middleware();
import { Router as Router8 } from "express";
import { eq as eq9, and as and6, ne as ne3, or, inArray as inArray2 } from "drizzle-orm";

// middleware/session.ts
import { v4 as uuidv4 } from "uuid";
var SESSION_COOKIE_NAME = "tableSessionId";
var SESSION_COOKIE_MAX_AGE = 24 * 60 * 60 * 1e3;
function tableSessionMiddleware(req, res, next) {
  let sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) {
    sessionId = uuidv4();
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: SESSION_COOKIE_MAX_AGE,
      path: "/"
    });
  }
  req.tableSessionId = sessionId;
  next();
}
function getTableSessionId(req) {
  return req.tableSessionId ?? req.cookies?.[SESSION_COOKIE_NAME];
}

// routes/orders.ts
init_storage();
init_db();
init_logger();
import { tables as tables6, orders as orders4, restaurants as restaurants5, menuItems as menuItems3 } from "@sbaka/shared";
var router8 = Router8();
router8.get("/api/tables/:tableId/orders", rateLimits.orders, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const sessionId = getTableSessionId(req);
    const table = await db.query.tables.findFirst({
      where: eq9(tables6.id, tableId)
    });
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }
    let tableOrders;
    if (sessionId) {
      tableOrders = await db.query.orders.findMany({
        where: and6(
          eq9(orders4.tableId, tableId),
          eq9(orders4.hidden, false),
          or(
            eq9(orders4.sessionId, sessionId),
            // Customer's own orders
            and6(
              ne3(orders4.status, "Served"),
              // Active orders from anyone
              ne3(orders4.status, "Cancelled")
            )
          )
        ),
        with: {
          orderItems: {
            with: {
              menuItem: true
            }
          }
        },
        orderBy: (orders5, { desc: desc2 }) => [desc2(orders5.createdAt)]
      });
    } else {
      tableOrders = await db.query.orders.findMany({
        where: and6(
          eq9(orders4.tableId, tableId),
          eq9(orders4.hidden, false),
          ne3(orders4.status, "Served"),
          ne3(orders4.status, "Cancelled")
        ),
        with: {
          orderItems: {
            with: {
              menuItem: true
            }
          }
        },
        orderBy: (orders5, { desc: desc2 }) => [desc2(orders5.createdAt)]
      });
    }
    const ordersWithOwnership = tableOrders.map((order) => ({
      ...order,
      isOwnOrder: order.sessionId === sessionId
    }));
    res.json(ordersWithOwnership);
  } catch (error) {
    logger_default.error(`Error fetching table orders: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router8.post("/api/orders", rateLimits.orders, async (req, res) => {
  try {
    const { restaurantId, tableId, items } = req.body;
    if (!restaurantId || !tableId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }
    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ message: "Each item must have menuItemId and quantity >= 1" });
      }
    }
    const sessionId = getTableSessionId(req);
    const table = await db.query.tables.findFirst({
      where: and6(eq9(tables6.id, tableId), eq9(tables6.restaurantId, restaurantId))
    });
    if (!table) {
      return res.status(404).json({ message: "Table not found or does not belong to restaurant" });
    }
    if (!table.active) {
      return res.status(403).json({ message: "Table is currently unavailable for orders" });
    }
    const menuItemIds = items.map((item) => item.menuItemId);
    const dbMenuItems = await db.query.menuItems.findMany({
      where: inArray2(menuItems3.id, menuItemIds),
      with: {
        category: {
          columns: { restaurantId: true }
        }
      }
    });
    const menuItemMap = new Map(dbMenuItems.map((item) => [item.id, item]));
    const validatedItems = [];
    let serverCalculatedTotal = 0;
    for (const item of items) {
      const dbMenuItem = menuItemMap.get(item.menuItemId);
      if (!dbMenuItem) {
        return res.status(400).json({
          message: `Menu item ${item.menuItemId} not found`
        });
      }
      if (dbMenuItem.category?.restaurantId !== restaurantId) {
        return res.status(400).json({
          message: `Menu item ${item.menuItemId} does not belong to this restaurant`
        });
      }
      if (!dbMenuItem.active) {
        return res.status(400).json({
          message: `Menu item "${dbMenuItem.name}" is currently unavailable`
        });
      }
      const serverPrice = parseFloat(String(dbMenuItem.price));
      const quantity = parseInt(item.quantity);
      validatedItems.push({
        menuItemId: item.menuItemId,
        quantity,
        price: serverPrice,
        notes: item.notes
      });
      serverCalculatedTotal += serverPrice * quantity;
    }
    const orderNumber = `ORD${Date.now().toString().slice(-6)}`;
    const order = await storage.createOrderWithItems({
      orderData: {
        orderNumber,
        tableId,
        restaurantId,
        status: "Received",
        total: serverCalculatedTotal,
        sessionId: sessionId ?? null
      },
      orderItems: validatedItems
    });
    const completeOrder = await storage.getOrderWithItems(order.id);
    const { broadcastToRestaurant, broadcastToTable } = global;
    if (broadcastToRestaurant) {
      const restaurant = await db.query.restaurants.findFirst({
        where: eq9(restaurants5.id, restaurantId),
        columns: { merchantId: true }
      });
      if (restaurant) {
        broadcastToRestaurant(restaurant.merchantId, {
          type: "new_order",
          order: completeOrder,
          tableId
        });
      }
    }
    if (broadcastToTable) {
      broadcastToTable(tableId, {
        type: "new_order",
        order: completeOrder
      });
    }
    res.status(201).json(completeOrder);
  } catch (error) {
    logger_default.error(`Error creating order: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router8.get("/api/orders", authenticate, async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and6(eq9(restaurants5.id, restaurantId), eq9(restaurants5.merchantId, req.user.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    const orders5 = await storage.getOrdersByRestaurantId(restaurantId, req.user.id);
    res.json(orders5);
  } catch (error) {
    logger_default.error(`Error fetching orders: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router8.put("/api/orders/:id/status", authenticate, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const order = await db.query.orders.findFirst({
      where: eq9(orders4.id, orderId),
      with: { restaurant: true }
    });
    if (!order || order.restaurant.merchantId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }
    const updated = await storage.updateOrderStatus(orderId, status, req.user.id);
    if (!updated) {
      return res.status(404).json({ message: "Order not found" });
    }
    const completeOrder = await storage.getOrderWithItems(orderId, req.user.id);
    const { broadcastToRestaurant, broadcastToTable } = global;
    if (broadcastToRestaurant) {
      broadcastToRestaurant(req.user.id, {
        type: "order_status_updated",
        order: completeOrder
      });
    }
    if (broadcastToTable && order.tableId && completeOrder) {
      broadcastToTable(order.tableId, {
        type: "order_status_updated",
        orderId: completeOrder.id,
        orderNumber: completeOrder.orderNumber,
        status: completeOrder.status,
        message: `Order ${completeOrder.orderNumber} is now ${completeOrder.status}`
      });
    }
    res.json(completeOrder);
  } catch (error) {
    logger_default.error(`Error updating order status: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var orders_default = router8;

// routes/customer.ts
init_storage();
init_logger();
import { Router as Router9 } from "express";

// services/error-response.service.ts
var ERROR_MESSAGES = {
  MISSING_QR_CODE: "QR code is required",
  INVALID_QR_CODE: "Invalid QR code. Please scan a valid table QR code.",
  TABLE_NOT_FOUND: "Table not found.",
  TABLE_INACTIVE: "This table is currently inactive.",
  RESTAURANT_NOT_FOUND: "Restaurant not found.",
  NO_LANGUAGES_AVAILABLE: "No languages available for this restaurant.",
  MENU_FETCH_ERROR: "An unexpected error occurred. Please try again later.",
  SERVER_ERROR: "An unexpected error occurred. Please try again later."
};
var ERROR_STATUS_CODES = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};
var createErrorResponse = (error, message, status, res) => {
  return res.status(status).json({ error, message });
};
var handleMenuError = (error, res) => {
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
var handleServerError = (res) => {
  return createErrorResponse(
    "SERVER_ERROR",
    ERROR_MESSAGES.SERVER_ERROR,
    ERROR_STATUS_CODES.INTERNAL_SERVER_ERROR,
    res
  );
};

// services/validation.service.ts
var validateQrCode = (qrCode, res) => {
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
var validateLanguageCode = (languageCode, defaultLanguage = "en") => {
  if (!languageCode || languageCode.trim() === "") {
    return defaultLanguage;
  }
  const cleanLanguageCode = languageCode.trim().toLowerCase();
  if (!/^[a-z]{2,5}(-[a-z]{2,5})?$/i.test(cleanLanguageCode)) {
    return defaultLanguage;
  }
  return cleanLanguageCode;
};
var validateCustomerMenuParams = (qrCode, res) => {
  if (!validateQrCode(qrCode, res)) {
    return { isValid: false };
  }
  return {
    isValid: true,
    qrCode: qrCode.trim()
  };
};

// services/redirect.service.ts
var DEFAULT_LANGUAGE = "en";
var REDIRECT_STATUS = 302;
var SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block"
};
var buildCustomerMenuUrl = (req, qrCode, languageCode) => {
  const customerDomain = process.env.CUSTOMER_DOMAIN || req.get("host")?.replace("api.", "") || req.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : req.protocol || "http";
  return `${protocol}://${customerDomain}/menu?qrCode=${encodeURIComponent(qrCode)}&lang=${encodeURIComponent(languageCode)}`;
};
var addSecurityHeaders = (res) => {
  res.set(SECURITY_HEADERS);
};
var redirectToCustomerMenu = (req, res, qrCode, languageCode) => {
  const redirectUrl = buildCustomerMenuUrl(req, qrCode, languageCode);
  addSecurityHeaders(res);
  return res.redirect(REDIRECT_STATUS, redirectUrl);
};

// services/index.ts
init_qr_code_service();

// routes/customer.ts
var router9 = Router9();
router9.get("/api/customer/menu", async (req, res) => {
  try {
    const qrCodeParam = req.query.qrCode;
    const languageCodeParam = req.query.lang;
    const validation = validateCustomerMenuParams(qrCodeParam, res);
    if (!validation.isValid) {
      return;
    }
    const qrCode = validation.qrCode;
    const languageCode = validateLanguageCode(languageCodeParam, DEFAULT_LANGUAGE);
    try {
      await storage.getMenuByTableQrCode(qrCode, languageCode);
      logger_default.info(`QR code redirect: ${qrCode} -> customer domain`);
      return redirectToCustomerMenu(req, res, qrCode, languageCode);
    } catch (menuError) {
      logger_default.error(`Error validating menu for redirect: ${sanitizeError(menuError)}`);
      return handleMenuError(menuError, res);
    }
  } catch (error) {
    logger_default.error(`Error in QR redirect: ${sanitizeError(error)}`);
    return handleServerError(res);
  }
});
router9.get("/api/customer/menu-data", async (req, res) => {
  try {
    const qrCodeParam = req.query.qrCode;
    const languageCodeParam = req.query.lang;
    const validation = validateCustomerMenuParams(qrCodeParam, res);
    if (!validation.isValid) {
      return;
    }
    const qrCode = validation.qrCode;
    const languageCode = validateLanguageCode(languageCodeParam, DEFAULT_LANGUAGE);
    const menuData = await storage.getMenuByTableQrCode(qrCode, languageCode);
    return res.json(menuData);
  } catch (error) {
    logger_default.error(`Error fetching customer menu: ${sanitizeError(error)}`);
    return handleMenuError(error, res);
  }
});
var customer_default = router9;

// routes/translations.ts
init_middleware();
import { Router as Router10 } from "express";

// translation.ts
init_storage();
init_logger();
init_db();
import { z as z6 } from "zod";
import {
  insertLanguageSchema,
  insertMenuItemTranslationSchema,
  insertCategoryTranslationSchema,
  menuItems as menuItems4,
  categories as categories3,
  languages as languages3,
  menuItemTranslations as menuItemTranslations3,
  categoryTranslations as categoryTranslations3,
  ingredients as ingredients3,
  restaurants as restaurants6
} from "@sbaka/shared";
import { eq as eq10, and as and7, inArray as inArray3 } from "drizzle-orm";

// services/translation/translation-adapter.interface.ts
var TranslationError = class extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "TranslationError";
  }
};

// services/translation/deepl-adapter.ts
init_logger();
import fetch from "node-fetch";
import * as https from "https";
var DeepLAdapter = class {
  constructor(config4) {
    this.config = config4;
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      timeout: config4.timeout || 3e4
    });
  }
  httpsAgent;
  cache = /* @__PURE__ */ new Map();
  getAdapterName() {
    return "DeepL";
  }
  async isAvailable() {
    try {
      if (!this.config.apiKey) {
        return false;
      }
      const response = await fetch(this.getApiUrl(), {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          text: ["test"],
          target_lang: "EN"
        }),
        agent: this.httpsAgent
      });
      return response.ok || response.status === 400;
    } catch (error) {
      logger_default.error(`DeepL availability check failed: ${sanitizeError(error)}`);
      return false;
    }
  }
  async getSupportedLanguages() {
    return [
      "BG",
      "CS",
      "DA",
      "DE",
      "EL",
      "EN",
      "ES",
      "ET",
      "FI",
      "FR",
      "HU",
      "ID",
      "IT",
      "JA",
      "KO",
      "LT",
      "LV",
      "NB",
      "NL",
      "PL",
      "PT",
      "RO",
      "RU",
      "SK",
      "SL",
      "SV",
      "TR",
      "UK",
      "ZH"
    ];
  }
  async translate(request) {
    const results = await this.translateBatch([request]);
    return results[0];
  }
  async translateBatch(requests) {
    if (!this.config.apiKey) {
      throw new TranslationError(
        "DeepL API key is not configured",
        "MISSING_API_KEY"
      );
    }
    const results = [];
    for (const request of requests) {
      try {
        if (this.config.cacheEnabled) {
          const cacheKey = this.getCacheKey(request);
          const cached = this.cache.get(cacheKey);
          if (cached) {
            results.push(cached);
            continue;
          }
        }
        if (!request.text || request.text.trim() === "") {
          results.push({ translatedText: "" });
          continue;
        }
        const response = await this.makeApiRequest(request);
        const result = this.parseApiResponse(response);
        if (this.config.cacheEnabled) {
          const cacheKey = this.getCacheKey(request);
          this.cache.set(cacheKey, result);
        }
        results.push(result);
      } catch (error) {
        if (error instanceof TranslationError) {
          throw error;
        }
        logger_default.error(`DeepL translation error: ${sanitizeError(error)}`);
        results.push({
          translatedText: request.text,
          detectedSourceLanguage: request.sourceLanguage
        });
      }
    }
    return results;
  }
  async makeApiRequest(request) {
    const deeplSourceLang = this.mapLanguageCode(request.sourceLanguage);
    const deeplTargetLang = this.mapLanguageCode(request.targetLanguage);
    const body = {
      text: [request.text],
      source_lang: deeplSourceLang === "AUTO" ? null : deeplSourceLang,
      target_lang: deeplTargetLang
    };
    const response = await fetch(this.getApiUrl(), {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      agent: this.httpsAgent
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new TranslationError(
        `DeepL API error: ${response.status} ${errorText}`,
        "API_ERROR",
        { status: response.status, body: errorText }
      );
    }
    return await response.json();
  }
  parseApiResponse(data) {
    if (!data.translations || !Array.isArray(data.translations) || data.translations.length === 0) {
      throw new TranslationError(
        "Invalid response format from DeepL API",
        "INVALID_RESPONSE",
        data
      );
    }
    const translation = data.translations[0];
    return {
      translatedText: translation.text,
      detectedSourceLanguage: translation.detected_source_language
    };
  }
  getApiUrl() {
    return this.config.endpoint || "https://api-free.deepl.com/v2/translate";
  }
  getHeaders() {
    return {
      "Authorization": `DeepL-Auth-Key ${this.config.apiKey}`,
      "Content-Type": "application/json"
    };
  }
  mapLanguageCode(language) {
    if (language === "auto") {
      return "AUTO";
    }
    return language.toUpperCase();
  }
  getCacheKey(request) {
    return `${request.sourceLanguage}:${request.targetLanguage}:${request.text}`;
  }
};

// services/translation/translation-service.ts
init_logger();
var TranslationService = class {
  adapters = /* @__PURE__ */ new Map();
  defaultAdapter = null;
  constructor() {
    this.initializeAdapters();
  }
  /**
   * Initialize available translation adapters
   */
  initializeAdapters() {
    const deeplApiKey = process.env.DEEPL_API_KEY;
    if (deeplApiKey) {
      const deeplAdapter = new DeepLAdapter({
        apiKey: deeplApiKey,
        timeout: 3e4,
        retryAttempts: 3,
        cacheEnabled: true
      });
      this.adapters.set("deepl", deeplAdapter);
      if (!this.defaultAdapter) {
        this.defaultAdapter = "deepl";
      }
    }
  }
  /**
   * Register a new translation adapter
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter);
    if (!this.defaultAdapter) {
      this.defaultAdapter = name;
    }
    logger_default.info(`Translation adapter '${name}' registered`);
  }
  /**
   * Set the default translation adapter
   */
  setDefaultAdapter(name) {
    if (!this.adapters.has(name)) {
      throw new TranslationError(`Adapter '${name}' is not registered`, "ADAPTER_NOT_FOUND");
    }
    this.defaultAdapter = name;
    logger_default.info(`Default translation adapter set to '${name}'`);
  }
  /**
   * Get available adapter names
   */
  getAvailableAdapters() {
    return Array.from(this.adapters.keys());
  }
  /**
   * Check if a specific adapter is available
   */
  async isAdapterAvailable(name) {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      return false;
    }
    return await adapter.isAvailable();
  }
  /**
   * Translate text using the default adapter
   */
  async translate(request) {
    return this.translateWithAdapter(request, this.defaultAdapter);
  }
  /**
   * Translate text using a specific adapter
   */
  async translateWithAdapter(request, adapterName = null) {
    const name = adapterName || this.defaultAdapter;
    if (!name) {
      throw new TranslationError("No translation adapter available", "NO_ADAPTER");
    }
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new TranslationError(`Adapter '${name}' not found`, "ADAPTER_NOT_FOUND");
    }
    try {
      logger_default.debug(`Translating with adapter '${name}': ${request.sourceLanguage} -> ${request.targetLanguage}`);
      return await adapter.translate(request);
    } catch (error) {
      logger_default.error(`Translation failed with adapter '${name}': ${error}`);
      if (this.adapters.size > 1) {
        const otherAdapters = Array.from(this.adapters.keys()).filter((key) => key !== name);
        for (const fallbackName of otherAdapters) {
          try {
            logger_default.info(`Trying fallback adapter '${fallbackName}'`);
            const fallbackAdapter = this.adapters.get(fallbackName);
            return await fallbackAdapter.translate(request);
          } catch (fallbackError) {
            logger_default.warn(`Fallback adapter '${fallbackName}' also failed: ${fallbackError}`);
          }
        }
      }
      logger_default.warn("All translation adapters failed, returning original text");
      return {
        translatedText: request.text,
        detectedSourceLanguage: request.sourceLanguage
      };
    }
  }
  /**
   * Translate multiple texts in batch
   */
  async translateBatch(requests, adapterName = null) {
    const name = adapterName || this.defaultAdapter;
    if (!name) {
      throw new TranslationError("No translation adapter available", "NO_ADAPTER");
    }
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new TranslationError(`Adapter '${name}' not found`, "ADAPTER_NOT_FOUND");
    }
    try {
      return await adapter.translateBatch(requests);
    } catch (error) {
      logger_default.error(`Batch translation failed with adapter '${name}': ${error}`);
      const results = [];
      for (const request of requests) {
        try {
          const result = await this.translateWithAdapter(request, name);
          results.push(result);
        } catch (individualError) {
          logger_default.warn(`Individual translation failed: ${individualError}`);
          results.push({
            translatedText: request.text,
            detectedSourceLanguage: request.sourceLanguage
          });
        }
      }
      return results;
    }
  }
  /**
   * Get supported languages for a specific adapter
   */
  async getSupportedLanguages(adapterName = null) {
    const name = adapterName || this.defaultAdapter;
    if (!name) {
      throw new TranslationError("No translation adapter available", "NO_ADAPTER");
    }
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new TranslationError(`Adapter '${name}' not found`, "ADAPTER_NOT_FOUND");
    }
    return await adapter.getSupportedLanguages();
  }
  /**
   * Get the current default adapter name
   */
  getDefaultAdapter() {
    return this.defaultAdapter;
  }
};
var translationService = new TranslationService();

// translation.ts
async function translateText(text, sourceLanguage, targetLanguage) {
  try {
    const result = await translationService.translate({
      text,
      sourceLanguage,
      targetLanguage
    });
    return result.translatedText;
  } catch (error) {
    logger_default.error(`Translation error: ${sanitizeError(error)}`);
    return text;
  }
}
async function translateMenuItems(menuItemIds, sourceLanguageId, targetLanguageId, sourceLanguage, targetLanguage) {
  const results = [];
  for (const menuItemId of menuItemIds) {
    const menuItem = await db.query.menuItems.findFirst({
      where: eq10(menuItems4.id, menuItemId)
    });
    if (!menuItem) continue;
    const sourceTranslations = await storage.getMenuItemTranslations(menuItemId, sourceLanguageId);
    const sourceTranslation = sourceTranslations[0];
    const sourceName = sourceTranslation?.name || menuItem.name;
    const sourceDescription = sourceTranslation?.description || menuItem.description || "";
    const translatedName = await translateText(sourceName, sourceLanguage.code, targetLanguage.code);
    const translatedDescription = sourceDescription ? await translateText(sourceDescription, sourceLanguage.code, targetLanguage.code) : "";
    const existingTranslations = await storage.getMenuItemTranslations(menuItemId, targetLanguageId);
    if (existingTranslations.length > 0) {
      const updatedTranslation = await storage.updateMenuItemTranslation(existingTranslations[0].id, {
        name: translatedName,
        description: translatedDescription
      });
      results.push(updatedTranslation);
    } else {
      const newTranslation = await storage.createMenuItemTranslation({
        menuItemId,
        languageId: targetLanguageId,
        name: translatedName,
        description: translatedDescription
      });
      results.push(newTranslation);
    }
  }
  return results;
}
async function translateCategories(categoryIds, sourceLanguageId, targetLanguageId, sourceLanguage, targetLanguage) {
  const results = [];
  for (const categoryId of categoryIds) {
    const category = await db.query.categories.findFirst({
      where: eq10(categories3.id, categoryId)
    });
    if (!category) continue;
    const sourceTranslations = await storage.getCategoryTranslations(categoryId, sourceLanguageId);
    const sourceTranslation = sourceTranslations[0];
    const sourceName = sourceTranslation?.name || category.name;
    const translatedName = await translateText(sourceName, sourceLanguage.code, targetLanguage.code);
    const existingTranslations = await storage.getCategoryTranslations(categoryId, targetLanguageId);
    if (existingTranslations.length > 0) {
      const updatedTranslation = await storage.updateCategoryTranslation(existingTranslations[0].id, {
        name: translatedName
      });
      results.push(updatedTranslation);
    } else {
      const newTranslation = await storage.createCategoryTranslation({
        categoryId,
        languageId: targetLanguageId,
        name: translatedName
      });
      results.push(newTranslation);
    }
  }
  return results;
}
async function translateIngredients(ingredientIds, sourceLanguageId, targetLanguageId, sourceLanguage, targetLanguage) {
  const results = [];
  for (const ingredientId of ingredientIds) {
    const ingredient = await db.query.ingredients.findFirst({
      where: eq10(ingredients3.id, ingredientId)
    });
    if (!ingredient) continue;
    const sourceTranslations = await storage.getIngredientTranslations(ingredientId, sourceLanguageId);
    const sourceTranslation = sourceTranslations[0];
    const sourceName = sourceTranslation?.name || ingredient.name;
    const translatedName = await translateText(sourceName, sourceLanguage.code, targetLanguage.code);
    const existingTranslations = await storage.getIngredientTranslations(ingredientId, targetLanguageId);
    if (existingTranslations.length > 0) {
      const updatedTranslation = await storage.updateIngredientTranslation(existingTranslations[0].id, {
        name: translatedName
      });
      results.push(updatedTranslation);
    } else {
      const newTranslation = await storage.createIngredientTranslation({
        ingredientId,
        languageId: targetLanguageId,
        name: translatedName
      });
      results.push(newTranslation);
    }
  }
  return results;
}
async function createLanguage(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const restaurantId = parseInt(req.params.restaurantId);
    const validatedData = insertLanguageSchema.parse({
      ...req.body,
      restaurantId
    });
    const language = await storage.createLanguage(validatedData);
    res.status(201).json(language);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating language: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function getLanguages(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const restaurantId = parseInt(req.params.restaurantId);
    const languages4 = await storage.getLanguagesByRestaurantId(restaurantId);
    res.status(200).json(languages4);
  } catch (error) {
    logger_default.error(`Error fetching languages: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function updateLanguage(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const restaurantId = parseInt(req.params.restaurantId);
    const languageId = parseInt(req.params.id);
    if (isNaN(languageId)) {
      return res.status(400).json({ message: "Invalid language ID" });
    }
    const existingLanguage = await db.query.languages.findFirst({
      where: and7(eq10(languages3.id, languageId), eq10(languages3.restaurantId, restaurantId))
    });
    if (!existingLanguage) {
      return res.status(404).json({ message: "Language not found or access denied" });
    }
    const language = await storage.updateLanguage(languageId, req.body);
    if (!language) {
      return res.status(404).json({ message: "Language not found" });
    }
    res.status(200).json(language);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error updating language: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function deleteLanguage(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const restaurantId = parseInt(req.params.restaurantId);
    const languageId = parseInt(req.params.id);
    if (isNaN(languageId)) {
      return res.status(400).json({ message: "Invalid language ID" });
    }
    const existingLanguage = await db.query.languages.findFirst({
      where: and7(eq10(languages3.id, languageId), eq10(languages3.restaurantId, restaurantId))
    });
    if (!existingLanguage) {
      return res.status(404).json({ message: "Language not found or access denied" });
    }
    const success = await storage.deleteLanguage(languageId);
    if (!success) {
      return res.status(404).json({ message: "Language not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger_default.error(`Error deleting language: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function createMenuItemTranslation(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const validatedData = insertMenuItemTranslationSchema.parse(req.body);
    const translation = await storage.createMenuItemTranslation(validatedData);
    res.status(201).json(translation);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating menu item translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function getMenuItemTranslations(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const menuItemId = parseInt(req.params.menuItemId);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    let languageId = void 0;
    if (req.query.languageId && typeof req.query.languageId === "string") {
      languageId = parseInt(req.query.languageId);
      if (isNaN(languageId)) {
        return res.status(400).json({ message: "Invalid language ID" });
      }
    }
    const translations = await storage.getMenuItemTranslations(menuItemId, languageId);
    res.status(200).json(translations);
  } catch (error) {
    logger_default.error(`Error fetching menu item translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function createCategoryTranslation(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const validatedData = insertCategoryTranslationSchema.parse(req.body);
    const translation = await storage.createCategoryTranslation(validatedData);
    res.status(201).json(translation);
  } catch (error) {
    if (error instanceof z6.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating category translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function getCategoryTranslations(req, res) {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    let languageId = void 0;
    if (req.query.languageId && typeof req.query.languageId === "string") {
      languageId = parseInt(req.query.languageId);
      if (isNaN(languageId)) {
        return res.status(400).json({ message: "Invalid language ID" });
      }
    }
    const translations = await storage.getCategoryTranslations(categoryId, languageId);
    res.status(200).json(translations);
  } catch (error) {
    logger_default.error(`Error fetching category translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function autoTranslate(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { restaurantId, sourceLanguageId, targetLanguageId, menuItemIds, categoryIds, ingredientIds } = req.body;
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }
    if (!sourceLanguageId || !targetLanguageId) {
      return res.status(400).json({ message: "Source and target language IDs are required" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and7(eq10(restaurants6.id, restaurantId), eq10(restaurants6.merchantId, userId))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    const restaurantLanguages = await storage.getLanguagesByRestaurantId(restaurantId);
    const sourceLanguage = restaurantLanguages.find((lang) => lang.id === sourceLanguageId);
    const targetLanguage = restaurantLanguages.find((lang) => lang.id === targetLanguageId);
    if (!sourceLanguage || !targetLanguage) {
      return res.status(400).json({ message: "Invalid source or target language for this restaurant" });
    }
    const results = {
      menuItems: [],
      categories: [],
      ingredients: []
    };
    if (menuItemIds && Array.isArray(menuItemIds) && menuItemIds.length > 0) {
      results.menuItems = await translateMenuItems(
        menuItemIds,
        sourceLanguageId,
        targetLanguageId,
        sourceLanguage,
        targetLanguage
      );
    }
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      results.categories = await translateCategories(
        categoryIds,
        sourceLanguageId,
        targetLanguageId,
        sourceLanguage,
        targetLanguage
      );
    }
    if (ingredientIds && Array.isArray(ingredientIds) && ingredientIds.length > 0) {
      results.ingredients = await translateIngredients(
        ingredientIds,
        sourceLanguageId,
        targetLanguageId,
        sourceLanguage,
        targetLanguage
      );
    }
    res.status(200).json(results);
  } catch (error) {
    logger_default.error(`Error auto-translating content: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function getAllRestaurantTranslations(req, res) {
  try {
    const restaurantId = parseInt(req.params.restaurantId);
    const langCode = req.query.lang;
    if (!langCode) {
      return res.status(400).json({ message: "Language code is required" });
    }
    const language = await db.query.languages.findFirst({
      where: and7(
        eq10(languages3.restaurantId, restaurantId),
        eq10(languages3.code, langCode.toLowerCase())
      )
    });
    if (!language) {
      return res.status(404).json({ message: "Language not found" });
    }
    const restaurantMenuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
    const menuItemIds = restaurantMenuItems.map((item) => item.id);
    const restaurantCategories = await storage.getCategoriesByRestaurantId(restaurantId);
    const categoryIds = restaurantCategories.map((category) => category.id);
    const menuItemTranslationsResult = await db.query.menuItemTranslations.findMany({
      where: and7(
        eq10(menuItemTranslations3.languageId, language.id),
        // Use inArray operator for menu item IDs
        inArray3(menuItemTranslations3.menuItemId, menuItemIds)
      )
    });
    const categoryTranslationsResult = await db.query.categoryTranslations.findMany({
      where: and7(
        eq10(categoryTranslations3.languageId, language.id),
        // Use inArray operator for category IDs
        inArray3(categoryTranslations3.categoryId, categoryIds)
      )
    });
    res.status(200).json({
      language,
      menuItemTranslations: menuItemTranslationsResult,
      categoryTranslations: categoryTranslationsResult
    });
  } catch (error) {
    logger_default.error(`Error fetching all translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// routes/translations.ts
var router10 = Router10();
async function checkCategoryOwnershipForTranslation(req, res, next) {
  try {
    const categoryId = req.body.categoryId || parseInt(req.params.categoryId);
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({ message: "Valid categoryId is required" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user.id);
    if (!category) {
      return res.status(403).json({ message: "Category not found or access denied" });
    }
    req.category = category;
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}
router10.get("/api/restaurants/:restaurantId/languages", authenticate, checkRestaurantOwnership, getLanguages);
router10.post("/api/restaurants/:restaurantId/languages", authenticate, checkRestaurantOwnership, createLanguage);
router10.put("/api/restaurants/:restaurantId/languages/:id", authenticate, checkRestaurantOwnership, updateLanguage);
router10.delete("/api/restaurants/:restaurantId/languages/:id", authenticate, checkRestaurantOwnership, deleteLanguage);
router10.post("/api/restaurants/:restaurantId/translations/menu-items", authenticate, checkRestaurantOwnership, createMenuItemTranslation);
router10.get("/api/restaurants/:restaurantId/translations/menu-items/:menuItemId", authenticate, checkRestaurantOwnership, getMenuItemTranslations);
router10.post("/api/translations/categories", authenticate, checkCategoryOwnershipForTranslation, createCategoryTranslation);
router10.get("/api/translations/categories/:categoryId", getCategoryTranslations);
router10.post("/api/translations/auto", authenticate, autoTranslate);
router10.get("/api/restaurants/:restaurantId/translations", getAllRestaurantTranslations);
var translations_default = router10;

// routes/translation-adapters.ts
init_middleware();
import { Router as Router11 } from "express";
init_logger();
var router11 = Router11();
router11.get("/api/translation/adapters", authenticate, async (_req, res) => {
  try {
    const adapters = translationService.getAvailableAdapters();
    const defaultAdapter = translationService.getDefaultAdapter();
    const adaptersWithStatus = await Promise.all(
      adapters.map(async (name) => {
        const isAvailable = await translationService.isAdapterAvailable(name);
        return {
          name,
          isAvailable,
          isDefault: name === defaultAdapter
        };
      })
    );
    res.json({
      adapters: adaptersWithStatus,
      defaultAdapter
    });
  } catch (error) {
    logger_default.error(`Error fetching translation adapters: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router11.get("/api/translation/adapters/:adapterName/languages", authenticate, async (req, res) => {
  try {
    const { adapterName } = req.params;
    const availableAdapters = translationService.getAvailableAdapters();
    if (!availableAdapters.includes(adapterName)) {
      return res.status(404).json({ message: "Translation adapter not found" });
    }
    const languages4 = await translationService.getSupportedLanguages(adapterName);
    res.json({ languages: languages4 });
  } catch (error) {
    logger_default.error(`Error fetching supported languages: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router11.put("/api/translation/adapters/default", authenticate, async (req, res) => {
  try {
    const { adapterName } = req.body;
    if (!adapterName) {
      return res.status(400).json({ message: "Adapter name is required" });
    }
    const availableAdapters = translationService.getAvailableAdapters();
    if (!availableAdapters.includes(adapterName)) {
      return res.status(404).json({ message: "Translation adapter not found" });
    }
    translationService.setDefaultAdapter(adapterName);
    res.json({
      message: "Default adapter updated successfully",
      defaultAdapter: adapterName
    });
  } catch (error) {
    logger_default.error(`Error setting default adapter: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router11.post("/api/translation/adapters/:adapterName/test", authenticate, async (req, res) => {
  try {
    const { adapterName } = req.params;
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: "Text and target language are required" });
    }
    const availableAdapters = translationService.getAvailableAdapters();
    if (!availableAdapters.includes(adapterName)) {
      return res.status(404).json({ message: "Translation adapter not found" });
    }
    const result = await translationService.translateWithAdapter({
      text,
      sourceLanguage: sourceLanguage || "auto",
      targetLanguage
    }, adapterName);
    res.json({
      result,
      adapter: adapterName
    });
  } catch (error) {
    logger_default.error(`Error testing translation adapter: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var translation_adapters_default = router11;

// routes/oauth.ts
init_auth();
init_logger();
init_auth();
import { Router as Router12 } from "express";
var router12 = Router12();
router12.get("/api/auth/oauth/status", optionalAuthenticateSupabase, async (req, res) => {
  const supabase3 = getSupabaseClient();
  const isConfigured = supabase3 !== null;
  logger_default.debug("OAuth status request", {
    hasUser: !!req.user,
    hasSupabaseUser: !!req.supabaseUser,
    userId: req.user?.id
  });
  if (req.user) {
    const merchant = req.user;
    const supabaseUser = req.supabaseUser;
    const linkedProviders = [];
    if (supabaseUser) {
      logger_default.debug("Supabase user identities", {
        identities: supabaseUser.identities,
        appMetadata: supabaseUser.app_metadata,
        userMetadata: supabaseUser.user_metadata,
        email: supabaseUser.email,
        emailConfirmed: supabaseUser.email_confirmed_at
      });
      if (supabaseUser.identities && supabaseUser.identities.length > 0) {
        for (const identity of supabaseUser.identities) {
          logger_default.debug("Processing identity", { provider: identity.provider, id: identity.id });
          if (identity.provider === "google") {
            linkedProviders.push("google");
          } else if (identity.provider === "azure") {
            linkedProviders.push("azure");
          } else if (identity.provider === "email") {
            linkedProviders.push("email");
          }
        }
      }
      if (linkedProviders.length === 0) {
        const provider = supabaseUser.app_metadata?.provider;
        logger_default.debug("Falling back to app_metadata provider", { provider });
        if (provider === "email") {
          linkedProviders.push("email");
        } else if (provider === "google") {
          linkedProviders.push("google");
        } else if (provider === "azure") {
          linkedProviders.push("azure");
        }
      }
      if (!linkedProviders.includes("email") && !linkedProviders.includes("google") && !linkedProviders.includes("azure") && supabaseUser.email && supabaseUser.email_confirmed_at) {
        logger_default.debug("Fallback: assuming email auth based on confirmed email");
        linkedProviders.push("email");
      }
    }
    logger_default.debug("OAuth status for user", {
      userId: merchant.id,
      supabaseUserId: merchant.supabaseUserId,
      linkedProviders,
      identitiesCount: linkedProviders.length,
      appMetadataProvider: supabaseUser?.app_metadata?.provider
    });
    return res.json({
      configured: isConfigured,
      linked: !!merchant.supabaseUserId,
      linkedProviders,
      // Array of actually linked providers
      hasPassword: linkedProviders.includes("email"),
      providers: isConfigured ? ["google", "azure"] : []
    });
  }
  return res.json({
    configured: isConfigured,
    linked: false,
    linkedProviders: [],
    hasPassword: false,
    providers: isConfigured ? ["google", "azure"] : []
  });
});
var oauth_default = router12;

// routes/analytics.ts
init_storage();
init_logger();
import { Router as Router13 } from "express";
import { z as z7 } from "zod";
import { MENU_ITEM_EVENT_VALUES } from "@sbaka/shared";
var router13 = Router13();
var trackEventSchema = z7.object({
  menuItemId: z7.number().int().positive(),
  restaurantId: z7.number().int().positive(),
  eventType: z7.enum(MENU_ITEM_EVENT_VALUES),
  sessionId: z7.string().optional()
});
router13.post("/api/analytics/track", async (req, res) => {
  try {
    const validationResult = trackEventSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors
      });
    }
    const { menuItemId, restaurantId, eventType, sessionId } = validationResult.data;
    await storage.createMenuItemEvent({
      menuItemId,
      restaurantId,
      eventType,
      sessionId: sessionId ?? null
    });
    res.status(201).json({ success: true });
  } catch (error) {
    logger_default.error(`Error tracking menu item event: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var batchTrackSchema = z7.object({
  events: z7.array(trackEventSchema).min(1).max(50)
});
router13.post("/api/analytics/track/batch", async (req, res) => {
  try {
    const validationResult = batchTrackSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors
      });
    }
    const { events } = validationResult.data;
    await Promise.all(
      events.map(
        (event) => storage.createMenuItemEvent({
          menuItemId: event.menuItemId,
          restaurantId: event.restaurantId,
          eventType: event.eventType,
          sessionId: event.sessionId ?? null
        })
      )
    );
    res.status(201).json({ success: true, count: events.length });
  } catch (error) {
    logger_default.error(`Error batch tracking menu item events: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var analytics_default = router13;

// routes/payments.ts
init_storage();
init_logger();
import { Router as Router14 } from "express";
import { z as z8 } from "zod";
var router14 = Router14();
var stripeSecretKey = process.env.STRIPE_SECRET_KEY;
var stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
var stripe = null;
if (stripeSecretKey) {
  import("stripe").then((Stripe) => {
    stripe = new Stripe.default(stripeSecretKey, {
      apiVersion: "2023-10-16"
    });
    logger_default.info("Stripe payment service initialized");
  }).catch((err) => {
    logger_default.warn(`Stripe package not installed: ${err.message}. Payment features will be disabled.`);
  });
} else {
  logger_default.warn("STRIPE_SECRET_KEY not configured. Payment features will be disabled.");
}
var createCheckoutSchema = z8.object({
  orderId: z8.number().int().positive(),
  restaurantId: z8.number().int().positive(),
  successUrl: z8.string().url(),
  cancelUrl: z8.string().url()
});
router14.post("/api/payments/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        message: "Payment service not available",
        enabled: false
      });
    }
    const validationResult = createCheckoutSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors
      });
    }
    const { orderId, restaurantId, successUrl, cancelUrl } = validationResult.data;
    const order = await storage.getOrderWithItems(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const restaurant = await storage.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    const lineItems = order.orderItems.map((item) => ({
      price_data: {
        currency: restaurant.currency?.toLowerCase() ?? "usd",
        product_data: {
          name: item.menuItem?.name ?? "Menu Item",
          description: item.menuItem?.description ?? void 0
        },
        unit_amount: item.price
        // Price in cents
      },
      quantity: item.quantity
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        orderId: orderId.toString(),
        restaurantId: restaurantId.toString(),
        orderNumber: order.orderNumber
      }
    });
    res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    logger_default.error(`Error creating checkout session: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router14.get("/api/payments/status/:sessionId", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        message: "Payment service not available",
        enabled: false
      });
    }
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.json({
      status: session.payment_status,
      orderId: session.metadata?.orderId,
      amount: session.amount_total,
      currency: session.currency
    });
  } catch (error) {
    logger_default.error(`Error retrieving payment status: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router14.post("/api/payments/webhook", async (req, res) => {
  try {
    if (!stripe || !stripeWebhookSecret) {
      return res.status(503).json({ message: "Webhook not configured" });
    }
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err) {
      logger_default.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          logger_default.info(`Payment completed for order ${orderId}`);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (orderId) {
          logger_default.info(`Payment session expired for order ${orderId}`);
        }
        break;
      }
      default:
        logger_default.debug(`Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    logger_default.error(`Error processing webhook: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router14.get("/api/payments/enabled", (_req, res) => {
  res.json({
    enabled: !!stripe,
    provider: "stripe"
  });
});
var payments_default = router14;

// routes/index.ts
init_middleware();

// routes.ts
async function registerRoutes(app2) {
  app2.use(createProgressiveIPRateLimit());
  app2.use(suspiciousActivityDetector);
  app2.use("/api/orders", rateLimits.orders);
  app2.use("/api/tables/qrcodes/all", rateLimits.heavy);
  app2.use("/api/menu", rateLimits.customer);
  app2.use("/api/customer/menu", rateLimits.customer);
  app2.use("/api/customer/menu-data", rateLimits.customer);
  app2.use("/api/restaurants/:restaurantId/translations", rateLimits.customer);
  setupAuth(app2);
  const httpServer = createServer(app2);
  const { broadcastToRestaurant, broadcastToTable } = setupWebSocket(httpServer);
  global.broadcastToRestaurant = broadcastToRestaurant;
  global.broadcastToTable = broadcastToTable;
  app2.use((err, _req, res, _next) => {
    logger_default.error(`${err.name}: ${err.message}`);
    if (err.stack) {
      logger_default.debug(err.stack);
    }
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
      message: sanitizeError(err)
    });
  });
  app2.use("/api", customerOnlyRoutes);
  app2.use(health_default);
  app2.use(dashboard_default);
  app2.use(restaurants_default);
  app2.use(categories_default);
  app2.use(menu_items_default);
  app2.use(ingredients_default);
  app2.use(tables_default);
  app2.use(orders_default);
  app2.use(customer_default);
  app2.use(translations_default);
  app2.use(translation_adapters_default);
  app2.use(oauth_default);
  app2.use(analytics_default);
  app2.use(payments_default);
  return httpServer;
}

// index.ts
init_logger();
import { config as config3 } from "dotenv";
config3();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://0.0.0.0:3000",
    "http://0.0.0.0:3001",
    "http://0.0.0.0:3002",
    "https://admin.eazmenu.com",
    "https://customer.eazmenu.com",
    "https://api.eazmenu.com"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Client-Type"]
}));
app.use(cookieParser());
app.use(tableSessionMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      const logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      logger_default.http(logLine);
    }
  });
  next();
});
(async () => {
  try {
    const { runDrizzleMigrations: runDrizzleMigrations2 } = await Promise.resolve().then(() => (init_drizzle_migrate(), drizzle_migrate_exports));
    await runDrizzleMigrations2();
    logger_default.info("Database migrations completed successfully");
  } catch (error) {
    logger_default.error(`Failed to run database migrations: ${sanitizeError(error)}`);
    process.exit(1);
  }
  const server = await registerRoutes(app);
  app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
  if (process.env.NODE_ENV === "production") {
    app.use("/admin", express.static(path.join(__dirname, "../public/admin")));
    app.use("/customer", express.static(path.join(__dirname, "../public/customer")));
    app.get("*", (req, res) => {
      const subdomain = req.hostname.split(".")[0];
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
        return res.status(404).json({ message: "Not found" });
      }
      if (subdomain === "admin") {
        res.sendFile(path.join(__dirname, "../public/admin/index.html"));
      } else if (subdomain === "customer") {
        res.sendFile(path.join(__dirname, "../public/customer/index.html"));
      } else {
        res.sendFile(path.join(__dirname, "../public/customer/index.html"));
      }
    });
  }
  app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    const isProductionLike = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
    const message = isProductionLike ? status < 500 ? err.message : "Internal Server Error" : err.message ?? "Internal Server Error";
    res.status(status).json({ message });
    if (status >= 500) {
      logger_default.error(`${err.name || "Error"} ${status}: ${err.message}`);
      if (err.stack && process.env.NODE_ENV === "development") {
        logger_default.debug(err.stack);
      }
    } else {
      logger_default.warn(`${err.name || "Error"} ${status}: ${err.message}`);
    }
  });
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
  const host = process.env.HOST || "0.0.0.0";
  server.listen(port, host, () => {
    logger_default.info(`Server running on port ${port}`);
    if (app.get("env") === "development") {
      logger_default.info(`WebSocket server available at ws://localhost:${port}/ws`);
    }
  });
  const shutdown = (signal) => {
    logger_default.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close((err) => {
      if (err) {
        logger_default.error(`Error during server shutdown: ${sanitizeError(err)}`);
        process.exit(1);
      }
      logger_default.info("Server closed successfully");
      process.exit(0);
    });
    setTimeout(() => {
      logger_default.warn("Forcefully shutting down after timeout");
      process.exit(1);
    }, 1e4);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
