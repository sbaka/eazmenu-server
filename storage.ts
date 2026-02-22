import { db } from "@db";
import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import logger, { sanitizeError } from "./logger";
import { findTableByQrCode, generateQrCodeForTable } from "./services";
import {
  categories,
  categoryTranslations,
  ingredients,
  ingredientTranslations,
  InsertCategory,
  InsertCategoryTranslation,
  InsertIngredientTranslation,
  InsertLanguage,
  InsertMenuItem,
  InsertMenuItemEvent,
  InsertMenuItemTranslation,
  InsertMerchant,
  InsertOrder,
  InsertOrderItem,
  InsertRestaurant,
  InsertTable,
  languages,
  menuItemEvents,
  menuItemIngredients,
  menuItems,
  menuItemTranslations,
  Merchant,
  merchants,
  orderItems,
  orders,
  OrderWithItemsResponse,
  Restaurant,
  restaurants,
  tables,
} from "@sbaka/shared";

// Currency code to symbol mapping for customer display
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CHF: 'CHF',
  CNY: '¥',
  INR: '₹',
  MXN: '$',
  BRL: 'R$',
  KRW: '₩',
  SGD: 'S$',
  HKD: 'HK$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  AED: 'د.إ',
  SAR: '﷼',
  TRY: '₺',
  MAD: 'د.م.',
};

function getCurrencySymbol(currencyCode: string | null | undefined): string {
  return CURRENCY_SYMBOLS[currencyCode ?? 'USD'] ?? '$';
}

interface CreateOrderWithItemsParams {
  orderData: Omit<InsertOrder, "id">;
  orderItems: Array<Omit<InsertOrderItem, "id" | "orderId">>;
}

interface IStorage {
  // User methods
  getMerchantById: (id: number, requestingMerchantId?: number) => Promise<Merchant | undefined>;
  getMerchantByUsername: (username: string) => Promise<Merchant | undefined>;
  getMerchantBySupabaseUserId: (supabaseUserId: string) => Promise<Merchant | undefined>;
  createMerchant: (userData: Omit<InsertMerchant, "id">) => Promise<Merchant>;
  updateMerchant: (id: number, data: Partial<InsertMerchant>) => Promise<Merchant | undefined>;
  updateMerchantProfile: (id: number, profileData: {
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    provider: string;
  }) => Promise<Merchant | undefined>;

  // Restaurant methods
  getRestaurantById: (id: number) => Promise<Restaurant | undefined>;
  getRestaurantByName: (name: string) => Promise<Restaurant | undefined>;
  createRestaurant: (restaurantData: Omit<InsertRestaurant, "id">) => Promise<Restaurant>;
  updateRestaurant: (id: number, restaurantData: Partial<InsertRestaurant>, merchantId?: number) => Promise<Restaurant | undefined>;
  deleteRestaurant: (id: number) => Promise<boolean>;
  getRestaurantsByMerchantId: (merchantId: number) => Promise<Restaurant[]>;

  // Category methods
  createCategory: (categoryData: Omit<InsertCategory, "id">) => Promise<typeof categories.$inferSelect>;
  getCategoriesByRestaurantId: (restaurantId: number) => Promise<(typeof categories.$inferSelect)[]>;
  updateCategory: (id: number, categoryData: Partial<InsertCategory>, merchantId?: number) => Promise<typeof categories.$inferSelect | undefined>;
  deleteCategory: (id: number, merchantId?: number) => Promise<boolean>;

  // MenuItem methods
  createMenuItem: (menuItemData: Omit<InsertMenuItem, "id">) => Promise<typeof menuItems.$inferSelect>;
  getMenuItemsByCategoryId: (categoryId: number) => Promise<(typeof menuItems.$inferSelect)[]>;
  getMenuItemsByCategory: (categoryId: number) => Promise<(typeof menuItems.$inferSelect)[]>;
  updateMenuItem: (id: number, menuItemData: Partial<InsertMenuItem>, merchantId?: number) => Promise<typeof menuItems.$inferSelect | undefined>;
  deleteMenuItem: (id: number, merchantId?: number) => Promise<boolean>;

  // Language methods
  createLanguage: (languageData: Omit<InsertLanguage, "id">) => Promise<typeof languages.$inferSelect>;
  getLanguagesByRestaurantId: (restaurantId: number) => Promise<(typeof languages.$inferSelect)[]>;
  updateLanguage: (id: number, languageData: Partial<InsertLanguage>) => Promise<typeof languages.$inferSelect | undefined>;
  deleteLanguage: (id: number) => Promise<boolean>;

  // Translation methods
  createMenuItemTranslation: (translationData: Omit<InsertMenuItemTranslation, "id">) => Promise<typeof menuItemTranslations.$inferSelect>;
  getMenuItemTranslations: (menuItemId: number, languageId?: number) => Promise<(typeof menuItemTranslations.$inferSelect)[]>;
  updateMenuItemTranslation: (id: number, translationData: Partial<InsertMenuItemTranslation>) => Promise<typeof menuItemTranslations.$inferSelect | undefined>;

  createCategoryTranslation: (translationData: Omit<InsertCategoryTranslation, "id">) => Promise<typeof categoryTranslations.$inferSelect>;
  getCategoryTranslations: (categoryId: number, languageId?: number) => Promise<(typeof categoryTranslations.$inferSelect)[]>;
  updateCategoryTranslation: (id: number, translationData: Partial<InsertCategoryTranslation>) => Promise<typeof categoryTranslations.$inferSelect | undefined>;

  // Ingredient Translation methods
  createIngredientTranslation: (translationData: Omit<InsertIngredientTranslation, "id">) => Promise<typeof ingredientTranslations.$inferSelect>;
  getIngredientTranslations: (ingredientId: number, languageId?: number) => Promise<(typeof ingredientTranslations.$inferSelect)[]>;
  updateIngredientTranslation: (id: number, translationData: Partial<InsertIngredientTranslation>) => Promise<typeof ingredientTranslations.$inferSelect | undefined>;

  // Table methods
  createTable: (tableData: Omit<InsertTable, "id">) => Promise<typeof tables.$inferSelect>;
  getTablesByRestaurantId: (restaurantId: number) => Promise<(typeof tables.$inferSelect)[]>;
  getTable: (id: number) => Promise<typeof tables.$inferSelect | undefined>;
  updateTable: (id: number, tableData: Partial<InsertTable>, merchantId?: number) => Promise<typeof tables.$inferSelect | undefined>;
  deleteTable: (id: number, merchantId?: number) => Promise<boolean>;

  // Order methods
  createOrder: (orderData: Omit<InsertOrder, "id">) => Promise<typeof orders.$inferSelect>;
  getOrdersByTableId: (tableId: number, merchantId?: number) => Promise<(typeof orders.$inferSelect)[]>;
  getOrdersByRestaurantId: (restaurantId: number, merchantId?: number) => Promise<OrderWithItemsResponse[]>;
  getOrdersByTable: (tableId: number) => Promise<(typeof orders.$inferSelect)[]>;
  getOrderWithItems: (orderId: number, merchantId?: number) => Promise<any>;
  updateOrderStatus: (id: number, status: "Received" | "Preparing" | "Ready" | "Served" | "Cancelled", merchantId?: number) => Promise<typeof orders.$inferSelect | undefined>;

  // Order item methods
  createOrderItem: (orderItemData: typeof orderItems.$inferInsert) => Promise<typeof orderItems.$inferSelect>;
  getOrderItemsByOrder: (orderId: number) => Promise<(typeof orderItems.$inferSelect)[]>;

  // Dashboard stats
  getDashboardStats: (restaurantId: number) => Promise<any>;

  // Menu item events (analytics)
  createMenuItemEvent: (eventData: Omit<InsertMenuItemEvent, "id">) => Promise<typeof menuItemEvents.$inferSelect>;
  getPopularMenuItems: (restaurantId: number, limit?: number) => Promise<any[]>;

  // Updated order method with transaction support
  createOrderWithItems: (params: CreateOrderWithItemsParams) => Promise<typeof orders.$inferSelect>;

  // Menu by table QR code with language support
  getMenuByTableQrCode: (qrCode: string, languageCode?: string) => Promise<any>;
}

class DatabaseStorage implements IStorage {

  constructor() {
    // No session store needed - using JWT authentication
  }
  async getRestaurantById(id: number) {
    return await db.query.restaurants.findFirst({
      where: eq(restaurants.id, id),
    });
  };
  getRestaurantByName(name: string) {
    return db.query.restaurants.findFirst({
      where: eq(restaurants.name, name),
    });
  }

  async createRestaurant(restaurantData: Omit<InsertRestaurant, "id">) {
    const [restaurant] = await db.insert(restaurants).values({
      name: restaurantData.name,
      address: restaurantData.address,
      phone: restaurantData.phone,
      email: restaurantData.email,
      currency: restaurantData.currency,
      merchantId: restaurantData.merchantId
    }).returning();
    return restaurant;
  }

  async getRestaurantsByMerchantId(merchantId: number) {
    return await db.query.restaurants.findMany({
      where: eq(restaurants.merchantId, merchantId),
      orderBy: restaurants.name,
    });
  }
  async updateRestaurant(id: number, restaurantData: Partial<InsertRestaurant>, merchantId?: number) {
    // If merchantId provided, verify ownership
    if (merchantId !== undefined) {
      const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, id),
      });
      if (!restaurant || restaurant.merchantId !== merchantId) {
        throw new Error("RESTAURANT_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    const [updated] = await db
      .update(restaurants)
      .set(restaurantData)
      .where(eq(restaurants.id, id))
      .returning();
    return updated;
  }

  deleteRestaurant(id: number) {
    return db.delete(restaurants).where(eq(restaurants.id, id)).then(() => true).catch(() => false);
  }


  async getMenuItemsByCategoryId(categoryId: number) {
    return db.query.menuItems.findMany({
      where: eq(menuItems.categoryId, categoryId),
      orderBy: menuItems.name,
    });
  };

  async getLanguagesByRestaurantId(restaurantId: number) {
    return db.query.languages.findMany({
      where: eq(languages.restaurantId, restaurantId),
      orderBy: [desc(languages.isPrimary), languages.name],
    });
  }

  // User methods
  async getMerchantById(id: number, requestingMerchantId?: number) {
    // If requesting merchant is specified, only allow access to own data
    if (requestingMerchantId !== undefined && id !== requestingMerchantId) {
      throw new Error("MERCHANT_ACCESS_DENIED");
    }

    const result = await db.query.merchants.findFirst({
      where: eq(merchants.id, id),
    });
    return result;
  }

  async getMerchantByUsername(username: string) {
    return db.query.merchants.findFirst({
      where: eq(merchants.username, username),
    });
  }

  async getMerchantBySupabaseUserId(supabaseUserId: string) {
    return db.query.merchants.findFirst({
      where: eq(merchants.supabaseUserId, supabaseUserId),
    });
  }

  async createMerchant(userData: Omit<InsertMerchant, "id">) {
    const [user] = await db.insert(merchants).values({
      username: userData.username,
      supabaseUserId: userData.supabaseUserId,
      email: userData.email,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl,
      provider: userData.provider ?? 'email',
    }).returning();
    return user;
  }

  async updateMerchant(id: number, data: Partial<InsertMerchant>) {
    const [updated] = await db.update(merchants)
      .set(data)
      .where(eq(merchants.id, id))
      .returning();
    return updated;
  }

  async updateMerchantProfile(id: number, profileData: {
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    provider: string;
  }) {
    const [updated] = await db.update(merchants)
      .set({
        email: profileData.email,
        displayName: profileData.displayName,
        avatarUrl: profileData.avatarUrl,
        provider: profileData.provider,
      })
      .where(eq(merchants.id, id))
      .returning();
    return updated;
  }

  // Category methods
  async createCategory(categoryData: Omit<InsertCategory, "id">) {
    const [category] = await db.insert(categories).values({
      name: categoryData.name,
      restaurantId: categoryData.restaurantId,
      sortOrder: categoryData.sortOrder
    }).returning();
    return category;
  }

  async getCategoriesByRestaurantId(restaurantId: number) {
    return await db.query.categories.findMany({
      where: eq(categories.restaurantId, restaurantId),
      orderBy: categories.sortOrder,
    });
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>, merchantId?: number) {
    // If merchantId provided, verify ownership
    if (merchantId !== undefined) {
      const { checkCategoryOwnership } = await import('./middleware');
      const category = await checkCategoryOwnership(id, merchantId);
      if (!category) {
        throw new Error("CATEGORY_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    const [updated] = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: number, merchantId?: number) {
    try {
      // If merchantId provided, verify ownership
      if (merchantId !== undefined) {
        const { checkCategoryOwnership } = await import('./middleware');
        const category = await checkCategoryOwnership(id, merchantId);
        if (!category) {
          throw new Error("CATEGORY_NOT_FOUND_OR_ACCESS_DENIED");
        }
      }

      await db.delete(categories).where(eq(categories.id, id));
      return true;
    } catch (error) {
      logger.error(`Error deleting category: ${sanitizeError(error)}`);
      return false;
    }
  }

  // MenuItem methods
  async createMenuItem(menuItemData: Omit<InsertMenuItem, "id">) {
    const [menuItem] = await db.insert(menuItems).values(menuItemData).returning();
    return menuItem;
  }

  async getMenuItemsByRestaurantId(restaurantId: number) {
    // Get all menu items for a restaurant (across all categories)
    const categoryIds = (await db.query.categories.findMany({
      where: eq(categories.restaurantId, restaurantId),
      columns: { id: true },
    })).map((cat: any) => cat.id);
    if (categoryIds.length === 0) return [];
    return db.query.menuItems.findMany({
      where: and(
        inArray(menuItems.categoryId, categoryIds),
        eq(menuItems.active, true)
      ),
      orderBy: menuItems.name,
    });
  }

  async getMenuItemsByCategory(categoryId: number) {
    return db.query.menuItems.findMany({
      where: and(
        eq(menuItems.categoryId, categoryId),
        eq(menuItems.active, true)
      ),
      orderBy: menuItems.name,
    });
  }

  async updateMenuItem(id: number, menuItemData: Partial<InsertMenuItem>, merchantId?: number) {
    // If merchantId provided, verify ownership
    if (merchantId !== undefined) {
      const { checkMenuItemOwnership } = await import('./middleware');
      const menuItem = await checkMenuItemOwnership(id, merchantId);
      if (!menuItem) {
        throw new Error("MENU_ITEM_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    const [updated] = await db
      .update(menuItems)
      .set(menuItemData)
      .where(eq(menuItems.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItem(id: number, merchantId?: number) {
    try {
      // If merchantId provided, verify ownership
      if (merchantId !== undefined) {
        const { checkMenuItemOwnership } = await import('./middleware');
        const menuItem = await checkMenuItemOwnership(id, merchantId);
        if (!menuItem) {
          throw new Error("MENU_ITEM_NOT_FOUND_OR_ACCESS_DENIED");
        }
      }

      // Use soft delete instead of hard delete to preserve order history
      await db
        .update(menuItems)
        .set({
          active: false,
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(menuItems.id, id));
      return true;
    } catch (error) {
      logger.error(`Error deleting menu item: ${sanitizeError(error)}`);
      return false;
    }
  }

  // Language methods
  async createLanguage(languageData: Omit<InsertLanguage, "id">) {
    // Check if a language with this code already exists for this restaurant
    const existingLanguage = await db.query.languages.findFirst({
      where: and(
        eq(languages.code, languageData.code),
        eq(languages.restaurantId, languageData.restaurantId)
      ),
    });

    if (existingLanguage) {
      throw new Error(`Language with code '${languageData.code}' already exists for this restaurant`);
    }

    // If this is set as primary, ensure no other languages are primary for this restaurant
    if (languageData.isPrimary) {
      await db
        .update(languages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(languages.restaurantId, languageData.restaurantId));
    }

    // If this is the first language for the restaurant, make it primary
    const existingCount = await db
      .select({ count: count() })
      .from(languages)
      .where(eq(languages.restaurantId, languageData.restaurantId));

    if (existingCount[0].count === 0) {
      languageData.isPrimary = true;
    }

    const [language] = await db.insert(languages).values({
      code: languageData.code,
      name: languageData.name,
      active: languageData.active,
      isPrimary: languageData.isPrimary,
      restaurantId: languageData.restaurantId
    }).returning();
    return language;
  }




  async updateLanguage(id: number, languageData: Partial<InsertLanguage>) {
    // Get the current language to check restaurant ownership
    const currentLanguage = await db.query.languages.findFirst({
      where: eq(languages.id, id),
    });

    if (!currentLanguage) {
      return undefined;
    }

    // If this is set as primary, ensure other languages in the same restaurant are not primary
    if (languageData.isPrimary) {
      await db
        .update(languages)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(
          eq(languages.restaurantId, currentLanguage.restaurantId),
          ne(languages.id, id) // Exclude current language
        ));
    }

    const [updated] = await db
      .update(languages)
      .set({ ...languageData, updatedAt: new Date() })
      .where(eq(languages.id, id))
      .returning();
    return updated;
  }

  async deleteLanguage(id: number) {
    try {
      // Get the language to check if it's primary and get restaurant info
      const language = await db.query.languages.findFirst({
        where: eq(languages.id, id),
      });

      if (!language) {
        return false;
      }

      // Don't allow deletion of the last language for a restaurant
      const languageCount = await db
        .select({ count: count() })
        .from(languages)
        .where(eq(languages.restaurantId, language.restaurantId));

      if (languageCount[0].count <= 1) {
        throw new Error("Cannot delete the last language for a restaurant");
      }

      await db.delete(languages).where(eq(languages.id, id));

      // If we deleted the primary language, make another one primary
      if (language.isPrimary) {
        const nextLanguage = await db.query.languages.findFirst({
          where: eq(languages.restaurantId, language.restaurantId),
          orderBy: languages.createdAt,
        });

        if (nextLanguage) {
          await db
            .update(languages)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(languages.id, nextLanguage.id));
        }
      }

      return true;
    } catch (error) {
      logger.error(`Error deleting language: ${sanitizeError(error)}`);
      return false;
    }
  }

  // Translation methods
  async createMenuItemTranslation(translationData: Omit<InsertMenuItemTranslation, "id">) {
    const [translation] = await db.insert(menuItemTranslations).values({
      name: translationData.name,
      description: translationData.description,
      menuItemId: translationData.menuItemId,
      languageId: translationData.languageId
    }).returning();
    return translation;
  }

  async getMenuItemTranslations(menuItemId: number, languageId?: number) {
    if (languageId) {
      return await db.query.menuItemTranslations.findMany({
        where: and(
          eq(menuItemTranslations.menuItemId, menuItemId),
          eq(menuItemTranslations.languageId, languageId)
        ),
      });
    }

    return await db.query.menuItemTranslations.findMany({
      where: eq(menuItemTranslations.menuItemId, menuItemId),
      with: { language: true },
    });
  }

  async updateMenuItemTranslation(id: number, translationData: Partial<InsertMenuItemTranslation>) {
    const [updated] = await db
      .update(menuItemTranslations)
      .set(translationData)
      .where(eq(menuItemTranslations.id, id))
      .returning();
    return updated;
  }

  async createCategoryTranslation(translationData: Omit<InsertCategoryTranslation, "id">) {
    const [translation] = await db.insert(categoryTranslations).values({
      name: translationData.name,
      categoryId: translationData.categoryId,
      languageId: translationData.languageId
    }).returning();
    return translation;
  }

  async getCategoryTranslations(categoryId: number, languageId?: number) {
    if (languageId) {
      return await db.query.categoryTranslations.findMany({
        where: and(
          eq(categoryTranslations.categoryId, categoryId),
          eq(categoryTranslations.languageId, languageId)
        ),
      });
    }

    return await db.query.categoryTranslations.findMany({
      where: eq(categoryTranslations.categoryId, categoryId),
      with: { language: true },
    });
  }

  async updateCategoryTranslation(id: number, translationData: Partial<InsertCategoryTranslation>) {
    const [updated] = await db
      .update(categoryTranslations)
      .set(translationData)
      .where(eq(categoryTranslations.id, id))
      .returning();
    return updated;
  }

  // Ingredient Translation methods
  async createIngredientTranslation(translationData: Omit<InsertIngredientTranslation, "id">) {
    const [translation] = await db.insert(ingredientTranslations).values({
      name: translationData.name,
      ingredientId: translationData.ingredientId,
      languageId: translationData.languageId
    }).returning();
    return translation;
  }

  async getIngredientTranslations(ingredientId: number, languageId?: number) {
    if (languageId) {
      return await db.query.ingredientTranslations.findMany({
        where: and(
          eq(ingredientTranslations.ingredientId, ingredientId),
          eq(ingredientTranslations.languageId, languageId)
        ),
      });
    }

    return await db.query.ingredientTranslations.findMany({
      where: eq(ingredientTranslations.ingredientId, ingredientId),
      with: { language: true },
    });
  }

  async updateIngredientTranslation(id: number, translationData: Partial<InsertIngredientTranslation>) {
    const [updated] = await db
      .update(ingredientTranslations)
      .set(translationData)
      .where(eq(ingredientTranslations.id, id))
      .returning();
    return updated;
  }

  // Table methods
  async createTable(tableData: Omit<InsertTable, "id">) {
    // Generate QR code for the table
    const qrCode = await this.generateTableQrCode(tableData.restaurantId, tableData.number);

    // Insert table with generated QR code
    const [table] = await db.insert(tables).values({
      number: tableData.number,
      seats: tableData.seats,
      restaurantId: tableData.restaurantId,
      active: tableData.active,
      qrCode: qrCode // Add the generated QR code
    }).returning();

    return table;
  }

  // Helper method to generate QR code
  private async generateTableQrCode(restaurantId: number, tableNumber: number): Promise<string> {
    // Generate a short, unique hash ID for the table using the service
    return generateQrCodeForTable(restaurantId, tableNumber);
  }

  async getTablesByRestaurantId(restaurantId: number) {
    return await db.query.tables.findMany({
      where: eq(tables.restaurantId, restaurantId),
      orderBy: tables.number,
    });
  }

  async getTable(id: number) {
    return await db.query.tables.findFirst({
      where: eq(tables.id, id),
    });
  }

  async updateTable(id: number, tableData: Partial<InsertTable>, merchantId?: number) {
    // If merchantId provided, verify table ownership via restaurant
    if (merchantId !== undefined) {
      const { checkTableOwnership } = await import('./middleware');
      const table = await checkTableOwnership(id, merchantId);
      if (!table) {
        throw new Error("TABLE_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    const [updated] = await db
      .update(tables)
      .set(tableData)
      .where(eq(tables.id, id))
      .returning();
    return updated;
  }

  async deleteTable(id: number, merchantId?: number) {
    try {
      // If merchantId provided, verify table ownership via restaurant
      if (merchantId !== undefined) {
        const { checkTableOwnership } = await import('./middleware');
        const table = await checkTableOwnership(id, merchantId);
        if (!table) {
          throw new Error("TABLE_NOT_FOUND_OR_ACCESS_DENIED");
        }
      }

      await db.delete(tables).where(eq(tables.id, id));
      return true;
    } catch (error) {
      logger.error(`Error deleting table: ${sanitizeError(error)}`);
      return false;
    }
  }

  // Order methods
  async createOrder(orderData: Omit<InsertOrder, "id">) {
    // Legacy method - use createOrderWithItems for new code
    const [order] = await db.insert(orders).values({
      orderNumber: orderData.orderNumber,
      tableId: orderData.tableId,
      status: orderData.status,
      restaurantId: orderData.restaurantId,
      total: orderData.total
    }).returning();
    return order;
  }

  // Transaction-safe order creation with items
  async createOrderWithItems({ orderData, orderItems: orderItemsList }: CreateOrderWithItemsParams) {
    // Run the whole operation in a single transaction so we guarantee atomicity
    return await db.transaction(async (tx) => {
      // Insert the order first
      const [order] = await tx.insert(orders).values({
        orderNumber: orderData.orderNumber,
        tableId: orderData.tableId,
        status: orderData.status,
        restaurantId: orderData.restaurantId,
        total: orderData.total,
      }).returning();

      if (!order) {
        throw new Error("Failed to create order");
      }

      // Insert all order items referencing the newly created order
      if (orderItemsList.length > 0) {
        const values = orderItemsList.map((item) => ({
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes,
        }));

        // Drizzle currently requires individual insert calls for returning(),
        // but we can still execute them within the same transaction. Using Promise.all
        // to parallelise while staying inside the same transaction context.
        await Promise.all(values.map((v) => tx.insert(orderItems).values(v)));
      }

      return order;
    });
  }

  async getOrdersByTableId(tableId: number, merchantId?: number) {
    // If merchantId provided, verify table ownership via restaurant
    if (merchantId !== undefined) {
      const { checkTableOwnership } = await import('./middleware');
      const table = await checkTableOwnership(tableId, merchantId);
      if (!table) {
        throw new Error("TABLE_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    // Limit results to prevent unbounded queries (default: 50 orders per table)
    return await db.query.orders.findMany({
      where: eq(orders.tableId, tableId),
      orderBy: desc(orders.createdAt),
      limit: 50,
      with: {
        table: true,
        orderItems: {
          with: {
            menuItem: true,
          },
        },
      },
    });
  }

  async getOrdersByRestaurantId(restaurantId: number, merchantId?: number) {
    // If merchantId provided, verify restaurant ownership
    if (merchantId !== undefined) {
      const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
        columns: { id: true, merchantId: true },
      });
      if (!restaurant || restaurant.merchantId !== merchantId) {
        throw new Error("RESTAURANT_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    // Optimized: exclude hidden orders and limit results
    return await db.query.orders.findMany({
      where: and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.hidden, false)
      ),
      orderBy: desc(orders.createdAt),
      with: {
        table: true,
        orderItems: {
          with: {
            menuItem: true,
          },
        },
      },
      limit: 100,
    });
  }

  async getOrdersByTable(tableId: number) {
    return await db.query.orders.findMany({
      where: eq(orders.tableId, tableId),
      orderBy: desc(orders.createdAt),
    });
  }

  async getOrderWithItems(orderId: number, merchantId?: number) {
    // If merchantId provided, verify order ownership via restaurant
    if (merchantId !== undefined) {
      const { checkOrderOwnership } = await import('./middleware');
      const order = await checkOrderOwnership(orderId, merchantId);
      if (!order) {
        throw new Error("ORDER_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    return await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        table: true,
        orderItems: {
          with: {
            menuItem: true,
          },
        },
      },
    });
  }

  async updateOrderStatus(id: number, status: "Received" | "Preparing" | "Ready" | "Served" | "Cancelled", merchantId?: number) {
    // If merchantId provided, verify order ownership via restaurant
    if (merchantId !== undefined) {
      const { checkOrderOwnership } = await import('./middleware');
      const order = await checkOrderOwnership(id, merchantId);
      if (!order) {
        throw new Error("ORDER_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }

    // Build update payload - set servedAt timestamp when status changes to 'Served'
    const updatePayload: { status: typeof status; updatedAt: Date; servedAt?: Date } = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'Served') {
      updatePayload.servedAt = new Date();
    }

    const [updated] = await db
      .update(orders)
      .set(updatePayload)
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // Order item methods
  async createOrderItem(orderItemData: typeof orderItems.$inferInsert) {
    const [orderItem] = await db.insert(orderItems).values(orderItemData).returning();
    return orderItem;
  }

  async getOrderItemsByOrder(orderId: number) {
    return await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, orderId),
      with: {
        menuItem: true,
      },
    });
  }

  // Dashboard stats
  async getDashboardStats(restaurantId: number) {
    // Get categories for this restaurant to filter menu items
    const categoryIds = (await db.query.categories.findMany({
      where: eq(categories.restaurantId, restaurantId),
      columns: { id: true },
    })).map((cat: any) => cat.id);

    // Get menu items count
    let menuItemsCount = 0;
    if (categoryIds.length > 0) {
      const menuItemsResult = await db
        .select({ count: count() })
        .from(menuItems)
        .where(inArray(menuItems.categoryId, categoryIds));
      menuItemsCount = menuItemsResult[0]?.count || 0;
    }

    // Get tables count
    const tablesResult = await db
      .select({ count: count() })
      .from(tables)
      .where(eq(tables.restaurantId, restaurantId));

    const tablesCount = tablesResult[0]?.count || 0;

    // Get table IDs for this restaurant to filter orders
    const tableIds = (await db.query.tables.findMany({
      where: eq(tables.restaurantId, restaurantId),
      columns: { id: true },
    })).map((table: any) => table.id);

    // Get today's orders stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayOrders: typeof orders.$inferSelect[] = [];
    if (tableIds.length > 0) {
      todayOrders = await db.query.orders.findMany({
        where: and(
          inArray(orders.tableId, tableIds),
          sql`${orders.createdAt} >= ${today}`
        ),
      });
    }

    const totalOrders = todayOrders.length;
    const pendingOrders = todayOrders.filter(order => order.status === 'Received').length;
    const preparingOrders = todayOrders.filter(order => order.status === 'Preparing').length;
    const completedOrders = todayOrders.filter(order =>
      order.status === 'Ready' || order.status === 'Served'
    ).length;

    // Get recent orders
    let recentOrders: Array<typeof orders.$inferSelect & {
      table: typeof tables.$inferSelect;
      orderItems: typeof orderItems.$inferSelect[];
    }> = [];
    if (tableIds.length > 0) {
      recentOrders = await db.query.orders.findMany({
        where: inArray(orders.tableId, tableIds),
        orderBy: desc(orders.createdAt),
        limit: 3,
        with: {
          table: true,
          orderItems: true,
        },
      });
    }

    return {
      menuItemsCount,
      tablesCount,
      todayStats: {
        totalOrders,
        pendingOrders,
        preparingOrders,
        completedOrders,
      },
      recentOrders,
    };
  }

  // Create menu item event (for analytics tracking)
  async createMenuItemEvent(eventData: Omit<InsertMenuItemEvent, "id">) {
    const [event] = await db.insert(menuItemEvents).values(eventData).returning();
    return event;
  }

  // Get popular menu items based on events (clicks, views, orders)
  async getPopularMenuItems(restaurantId: number, limit: number = 5) {
    // Get category IDs for this restaurant
    const categoryIds = (await db.query.categories.findMany({
      where: eq(categories.restaurantId, restaurantId),
      columns: { id: true },
    })).map((cat: any) => cat.id);

    if (categoryIds.length === 0) {
      return [];
    }

    // Get event counts grouped by menu item
    const eventCounts = await db
      .select({
        menuItemId: menuItemEvents.menuItemId,
        views: sql<number>`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'view' THEN 1 END)`,
        clicks: sql<number>`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'click' THEN 1 END)`,
        addToCarts: sql<number>`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'addToCart' THEN 1 END)`,
        ordered: sql<number>`COUNT(CASE WHEN ${menuItemEvents.eventType} = 'ordered' THEN 1 END)`,
        totalEvents: count(),
      })
      .from(menuItemEvents)
      .where(eq(menuItemEvents.restaurantId, restaurantId))
      .groupBy(menuItemEvents.menuItemId)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    // Get menu item details for these items
    const menuItemIds = eventCounts.map(e => e.menuItemId);
    if (menuItemIds.length === 0) {
      return [];
    }

    const items = await db.query.menuItems.findMany({
      where: inArray(menuItems.id, menuItemIds),
    });

    // Combine data
    return eventCounts.map(eventData => {
      const item = items.find(i => i.id === eventData.menuItemId);
      return {
        menuItem: item,
        stats: {
          views: Number(eventData.views),
          clicks: Number(eventData.clicks),
          addToCarts: Number(eventData.addToCarts),
          ordered: Number(eventData.ordered),
          totalEvents: Number(eventData.totalEvents),
        },
      };
    });
  }

  // Get menu by table QR code with comprehensive language support
  async getMenuByTableQrCode(qrCode: string, languageCode?: string): Promise<import('@sbaka/shared').CustomerMenuResponse> {
    try {
      // Use the QR code service to find the table
      const lookupResult = await findTableByQrCode(qrCode);

      if (!lookupResult.isValid || !lookupResult.table) {
        throw new Error("INVALID_QR_CODE");
      }

      const finalTable = lookupResult.table;

      // Verify table exists
      if (!finalTable) {
        throw new Error("TABLE_NOT_FOUND");
      }

      // Verify table is active
      if (!finalTable.active) {
        throw new Error("TABLE_INACTIVE");
      }

      // Get restaurant information
      const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, finalTable.restaurantId),
      });

      if (!restaurant) {
        throw new Error("RESTAURANT_NOT_FOUND");
      }

      // Get all available languages for this restaurant
      let availableLanguages = await db.query.languages.findMany({
        where: and(
          eq(languages.restaurantId, finalTable.restaurantId),
          eq(languages.active, true)
        ),
        orderBy: [desc(languages.isPrimary), languages.name],
      });

      // If no languages exist, create a default English language
      if (availableLanguages.length === 0) {
        const [defaultLanguage] = await db.insert(languages).values({
          code: "en",
          name: "English",
          active: true,
          isPrimary: true,
          restaurantId: finalTable.restaurantId
        }).returning();

        availableLanguages = [defaultLanguage];
        logger.info(`Created default English language for restaurant ${finalTable.restaurantId}`);
      }

      // Determine target language
      let targetLanguage = availableLanguages[0]; // Default to primary language

      if (languageCode) {
        const requestedLanguage = availableLanguages.find(
          lang => lang.code.toLowerCase() === languageCode.toLowerCase()
        );
        if (requestedLanguage) {
          targetLanguage = requestedLanguage;
        }
        // If requested language not found, we continue with primary language
      }

      // Get all categories for this restaurant
      const restaurantCategories = await db.query.categories.findMany({
        where: eq(categories.restaurantId, finalTable.restaurantId),
        orderBy: categories.sortOrder,
      });

      // Get all menu items for this restaurant
      const categoryIds = restaurantCategories.map((cat: typeof categories.$inferSelect) => cat.id);
      if (categoryIds.length === 0) {
        return {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address ?? '',
            phone: restaurant.phone ?? null,
            email: restaurant.email ?? null,
            chefMessage: restaurant.chefMessage ?? null,
            themeConfig: restaurant.themeConfig ?? null,
            currency: restaurant.currency ?? 'USD',
            currencySymbol: getCurrencySymbol(restaurant.currency),
            bannerUrl: restaurant.bannerUrl ?? null,
            logoUrl: restaurant.logoUrl ?? null,
            googleMapsUrl: restaurant.googleMapsUrl ?? null,
            websiteUrl: restaurant.websiteUrl ?? null,
            instagramUrl: restaurant.instagramUrl ?? null,
            facebookUrl: restaurant.facebookUrl ?? null,
            tiktokUrl: restaurant.tiktokUrl ?? null,
          },
          table: {
            id: finalTable.id,
            number: finalTable.number,
            seats: finalTable.seats,
          },
          language: targetLanguage,
          availableLanguages,
          categories: [],
          menu: []
        };
      }

      const restaurantMenuItems = await db.query.menuItems.findMany({
        where: and(
          inArray(menuItems.categoryId, categoryIds),
          eq(menuItems.active, true)
        ),
        orderBy: menuItems.name,
      });

      // Get translations for categories
      const categoryTranslationsMap = new Map();
      if (targetLanguage.id) {
        const categoryTranslationsData = await db.query.categoryTranslations.findMany({
          where: and(
            eq(categoryTranslations.languageId, targetLanguage.id),
            inArray(categoryTranslations.categoryId, categoryIds)
          ),
        });

        categoryTranslationsData.forEach(translation => {
          categoryTranslationsMap.set(translation.categoryId, translation);
        });
      }

      // Get translations for menu items
      const menuItemTranslationsMap = new Map();
      if (targetLanguage.id && restaurantMenuItems.length > 0) {
        const menuItemIds = restaurantMenuItems.map((item: typeof menuItems.$inferSelect) => item.id);
        const menuItemTranslationsData = await db.query.menuItemTranslations.findMany({
          where: and(
            eq(menuItemTranslations.languageId, targetLanguage.id),
            inArray(menuItemTranslations.menuItemId, menuItemIds)
          ),
        });

        menuItemTranslationsData.forEach(translation => {
          menuItemTranslationsMap.set(translation.menuItemId, translation);
        });
      }

      // Get ingredients for all menu items
      const menuItemIngredientsMap = new Map<number, string[]>();
      if (restaurantMenuItems.length > 0) {
        const menuItemIds = restaurantMenuItems.map((item: typeof menuItems.$inferSelect) => item.id);

        // Get all menu item ingredient relations
        const menuItemIngredientRelations = await db.query.menuItemIngredients.findMany({
          where: inArray(menuItemIngredients.menuItemId, menuItemIds),
        });

        if (menuItemIngredientRelations.length > 0) {
          // Get all unique ingredient IDs
          const ingredientIds = [...new Set(menuItemIngredientRelations.map(rel => rel.ingredientId))];

          // Get all ingredients
          const ingredientsData = await db.query.ingredients.findMany({
            where: inArray(ingredients.id, ingredientIds),
          });

          // Get ingredient translations for target language
          const ingredientTranslationsData = targetLanguage.id
            ? await db.query.ingredientTranslations.findMany({
              where: and(
                eq(ingredientTranslations.languageId, targetLanguage.id),
                inArray(ingredientTranslations.ingredientId, ingredientIds)
              ),
            })
            : [];

          // Build ingredient name map (translated or original)
          const ingredientNameMap = new Map<number, string>();
          ingredientsData.forEach(ing => {
            const translation = ingredientTranslationsData.find(t => t.ingredientId === ing.id);
            ingredientNameMap.set(ing.id, translation?.name || ing.name);
          });

          // Build menu item to ingredient names map
          menuItemIngredientRelations.forEach(rel => {
            const ingredientName = ingredientNameMap.get(rel.ingredientId);
            if (ingredientName) {
              if (!menuItemIngredientsMap.has(rel.menuItemId)) {
                menuItemIngredientsMap.set(rel.menuItemId, []);
              }
              menuItemIngredientsMap.get(rel.menuItemId)!.push(ingredientName);
            }
          });
        }
      }

      // Build localized categories with menu items
      const localizedCategories = restaurantCategories.map((category: typeof categories.$inferSelect) => {
        const categoryTranslation = categoryTranslationsMap.get(category.id);

        // Get menu items for this category
        const categoryMenuItems = restaurantMenuItems
          .filter((item: typeof menuItems.$inferSelect) => item.categoryId === category.id)
          .map((item: typeof menuItems.$inferSelect) => {
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
              ingredients: itemIngredients,
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
      }).filter(category => category.menuItems.length > 0); // Only include categories with active menu items

      return {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address ?? '',
          phone: restaurant.phone ?? null,
          email: restaurant.email ?? null,
          chefMessage: restaurant.chefMessage ?? null,
          themeConfig: restaurant.themeConfig ?? null,
          currency: restaurant.currency ?? 'USD',
          currencySymbol: getCurrencySymbol(restaurant.currency),
          bannerUrl: restaurant.bannerUrl ?? null,
          logoUrl: restaurant.logoUrl ?? null,
          googleMapsUrl: restaurant.googleMapsUrl ?? null,
          websiteUrl: restaurant.websiteUrl ?? null,
          instagramUrl: restaurant.instagramUrl ?? null,
          facebookUrl: restaurant.facebookUrl ?? null,
          tiktokUrl: restaurant.tiktokUrl ?? null,
        },
        table: {
          id: finalTable.id,
          number: finalTable.number,
          seats: finalTable.seats,
        },
        language: targetLanguage,
        availableLanguages,
        categories: localizedCategories,
        // Flattened menu for easier consumption
        menu: localizedCategories.flatMap(cat =>
          cat.menuItems.map(item => ({
            ...item,
            categoryId: cat.id,
            categoryName: cat.name,
            categoryOriginalName: cat.originalName
          }))
        )
      };

    } catch (error) {
      // Log the actual error but throw specific user-friendly errors
      logger.error(`Error in getMenuByTableQrCode: ${sanitizeError(error)}`);

      // Re-throw known errors
      if (error instanceof Error && [
        "TABLE_NOT_FOUND",
        "TABLE_INACTIVE",
        "RESTAURANT_NOT_FOUND",
        "NO_LANGUAGES_AVAILABLE"
      ].includes(error.message)) {
        throw error;
      }

      // For unknown errors, throw a generic error
      throw new Error("MENU_FETCH_ERROR");
    }
  }
}

export const storage = new DatabaseStorage();
