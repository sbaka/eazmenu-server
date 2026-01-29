var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../packages/shared/src/tables/merchant.ts
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
var merchants, insertMerchantSchema, selectMerchantSchema;
var init_merchant = __esm({
  "../../packages/shared/src/tables/merchant.ts"() {
    "use strict";
    merchants = pgTable("merchants", {
      id: serial("id").primaryKey(),
      username: text("username").notNull().unique(),
      password: text("password").notNull(),
      email: text("email").notNull().unique(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    });
    insertMerchantSchema = createInsertSchema(merchants, {
      username: (schema) => schema.min(3, "Username must be at least 3 characters").max(50, "Username too long"),
      email: (schema) => schema.email("Invalid email format"),
      password: (schema) => schema.min(8, "Password must be at least 8 characters")
    });
    selectMerchantSchema = createSelectSchema(merchants);
  }
});

// ../../packages/shared/src/tables/restaurant.ts
import { pgTable as pgTable2, text as text2, serial as serial2, integer, timestamp as timestamp2 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema2, createSelectSchema as createSelectSchema2 } from "drizzle-zod";
var restaurants, insertRestaurantSchema, selectRestaurantSchema;
var init_restaurant = __esm({
  "../../packages/shared/src/tables/restaurant.ts"() {
    "use strict";
    init_merchant();
    restaurants = pgTable2("restaurants", {
      id: serial2("id").primaryKey(),
      name: text2("name").notNull(),
      address: text2("address").notNull(),
      phone: text2("phone"),
      email: text2("email"),
      merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
      createdAt: timestamp2("created_at").defaultNow().notNull(),
      updatedAt: timestamp2("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    });
    insertRestaurantSchema = createInsertSchema2(restaurants, {
      name: (schema) => schema.min(1, "Restaurant name is required").max(100, "Restaurant name too long"),
      address: (schema) => schema.min(1, "Address is required").max(200, "Address too long"),
      email: (schema) => schema.email("Invalid email format").optional(),
      phone: (schema) => schema.min(10, "Phone number must be at least 10 digits").optional()
    });
    selectRestaurantSchema = createSelectSchema2(restaurants);
  }
});

// ../../packages/shared/src/tables/language.ts
import { pgTable as pgTable3, text as text3, serial as serial3, integer as integer2, boolean, timestamp as timestamp3, unique, check } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema3, createSelectSchema as createSelectSchema3 } from "drizzle-zod";
import { sql } from "drizzle-orm";
var languages, insertLanguageSchema, selectLanguageSchema;
var init_language = __esm({
  "../../packages/shared/src/tables/language.ts"() {
    "use strict";
    init_restaurant();
    languages = pgTable3("languages", {
      id: serial3("id").primaryKey(),
      code: text3("code").notNull(),
      name: text3("name").notNull(),
      active: boolean("active").default(false).notNull(),
      isPrimary: boolean("is_primary").default(false),
      restaurantId: integer2("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }).notNull(),
      createdAt: timestamp3("created_at").defaultNow().notNull(),
      updatedAt: timestamp3("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => [
      unique().on(table.code, table.restaurantId),
      check("code_check", sql`code = lower(code)`)
    ]);
    insertLanguageSchema = createInsertSchema3(languages, {
      code: (schema) => schema.min(2, "Language code must be at least 2 characters").max(5, "Language code too long").regex(/^[a-z]+$/, "Language code must be lowercase letters only"),
      name: (schema) => schema.min(1, "Language name is required").max(50, "Language name too long")
    });
    selectLanguageSchema = createSelectSchema3(languages);
  }
});

// ../../packages/shared/src/tables/category.ts
import { pgTable as pgTable4, text as text4, serial as serial4, integer as integer3, timestamp as timestamp4, index } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema4, createSelectSchema as createSelectSchema4 } from "drizzle-zod";
var categories, insertCategorySchema, selectCategorySchema;
var init_category = __esm({
  "../../packages/shared/src/tables/category.ts"() {
    "use strict";
    init_restaurant();
    categories = pgTable4("categories", {
      id: serial4("id").primaryKey(),
      name: text4("name").notNull(),
      sortOrder: integer3("sort_order").default(0),
      restaurantId: integer3("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }).notNull(),
      createdAt: timestamp4("created_at").defaultNow().notNull(),
      updatedAt: timestamp4("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date()),
      deletedAt: timestamp4("deleted_at")
    }, (table) => ({
      restaurantIdx: index("categories_restaurant_idx").on(table.restaurantId),
      sortOrderIdx: index("categories_sort_order_idx").on(table.restaurantId, table.sortOrder)
    }));
    insertCategorySchema = createInsertSchema4(categories, {
      name: (schema) => schema.min(1, "Category name is required").max(100, "Category name too long"),
      sortOrder: (schema) => schema.min(0, "Sort order cannot be negative").optional()
    });
    selectCategorySchema = createSelectSchema4(categories);
  }
});

// ../../packages/shared/src/tables/menuItem.ts
import { pgTable as pgTable5, text as text5, serial as serial5, integer as integer4, boolean as boolean2, timestamp as timestamp5, index as index2, check as check2 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema5, createSelectSchema as createSelectSchema5 } from "drizzle-zod";
import { sql as sql2 } from "drizzle-orm";
var menuItems, insertMenuItemSchema, selectMenuItemSchema;
var init_menuItem = __esm({
  "../../packages/shared/src/tables/menuItem.ts"() {
    "use strict";
    init_category();
    menuItems = pgTable5("menu_items", {
      id: serial5("id").primaryKey(),
      name: text5("name").notNull(),
      description: text5("description"),
      price: integer4("price").notNull(),
      // Price in cents
      categoryId: integer4("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
      active: boolean2("active").default(true).notNull(),
      deletedAt: timestamp5("deleted_at"),
      createdAt: timestamp5("created_at").defaultNow().notNull(),
      updatedAt: timestamp5("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      categoryIdx: index2("menu_items_category_idx").on(table.categoryId),
      activeIdx: index2("menu_items_active_idx").on(table.active),
      activeItemsIdx: index2("menu_items_active_category_idx").on(table.categoryId, table.active).where(sql2`active = true`),
      priceCheck: check2("positive_price", sql2`price >= 0`)
    }));
    insertMenuItemSchema = createInsertSchema5(menuItems, {
      name: (schema) => schema.min(1, "Menu item name is required").max(100, "Menu item name too long"),
      description: (schema) => schema.max(500, "Description too long").optional(),
      price: (schema) => schema.min(0, "Price cannot be negative")
    });
    selectMenuItemSchema = createSelectSchema5(menuItems);
  }
});

// ../../packages/shared/src/tables/menuItemTranslation.ts
import { pgTable as pgTable6, text as text6, serial as serial6, integer as integer5, timestamp as timestamp6, unique as unique2, index as index3 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema6, createSelectSchema as createSelectSchema6 } from "drizzle-zod";
var menuItemTranslations, insertMenuItemTranslationSchema, selectMenuItemTranslationSchema;
var init_menuItemTranslation = __esm({
  "../../packages/shared/src/tables/menuItemTranslation.ts"() {
    "use strict";
    init_menuItem();
    init_language();
    menuItemTranslations = pgTable6("menu_item_translations", {
      id: serial6("id").primaryKey(),
      menuItemId: integer5("menu_item_id").references(() => menuItems.id, { onDelete: "cascade" }).notNull(),
      languageId: integer5("language_id").references(() => languages.id, { onDelete: "cascade" }).notNull(),
      name: text6("name").notNull(),
      description: text6("description"),
      createdAt: timestamp6("created_at").defaultNow().notNull(),
      updatedAt: timestamp6("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      uniqueTranslation: unique2().on(table.menuItemId, table.languageId),
      menuItemIdx: index3("menu_item_translations_item_idx").on(table.menuItemId),
      languageIdx: index3("menu_item_translations_lang_idx").on(table.languageId)
    }));
    insertMenuItemTranslationSchema = createInsertSchema6(menuItemTranslations, {
      name: (schema) => schema.min(1, "Translation name is required").max(100, "Translation name too long"),
      description: (schema) => schema.max(500, "Translation description too long").optional()
    });
    selectMenuItemTranslationSchema = createSelectSchema6(menuItemTranslations);
  }
});

// ../../packages/shared/src/tables/categoryTranslation.ts
import { pgTable as pgTable7, text as text7, serial as serial7, integer as integer6, timestamp as timestamp7, unique as unique3, index as index4 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema7, createSelectSchema as createSelectSchema7 } from "drizzle-zod";
var categoryTranslations, insertCategoryTranslationSchema, selectCategoryTranslationSchema;
var init_categoryTranslation = __esm({
  "../../packages/shared/src/tables/categoryTranslation.ts"() {
    "use strict";
    init_category();
    init_language();
    categoryTranslations = pgTable7("category_translations", {
      id: serial7("id").primaryKey(),
      categoryId: integer6("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
      languageId: integer6("language_id").references(() => languages.id, { onDelete: "cascade" }).notNull(),
      name: text7("name").notNull(),
      createdAt: timestamp7("created_at").defaultNow().notNull(),
      updatedAt: timestamp7("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      uniqueTranslation: unique3().on(table.categoryId, table.languageId),
      categoryIdx: index4("category_translations_cat_idx").on(table.categoryId),
      languageIdx: index4("category_translations_lang_idx").on(table.languageId)
    }));
    insertCategoryTranslationSchema = createInsertSchema7(categoryTranslations, {
      name: (schema) => schema.min(1, "Category translation name is required").max(100, "Category translation name too long")
    });
    selectCategoryTranslationSchema = createSelectSchema7(categoryTranslations);
  }
});

// ../../packages/shared/src/tables/table.ts
import { pgTable as pgTable8, text as text8, serial as serial8, integer as integer7, boolean as boolean3, timestamp as timestamp8, unique as unique4, index as index5, check as check3 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema8, createSelectSchema as createSelectSchema8 } from "drizzle-zod";
import { sql as sql3 } from "drizzle-orm";
var tables, insertTableSchema, selectTableSchema;
var init_table = __esm({
  "../../packages/shared/src/tables/table.ts"() {
    "use strict";
    init_restaurant();
    tables = pgTable8("tables", {
      id: serial8("id").primaryKey(),
      number: integer7("number").notNull(),
      seats: integer7("seats").notNull(),
      restaurantId: integer7("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }).notNull(),
      qrCode: text8("qr_code").notNull().unique(),
      active: boolean3("active").default(true).notNull(),
      createdAt: timestamp8("created_at").defaultNow().notNull(),
      updatedAt: timestamp8("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      uniqueNumberPerRestaurant: unique4().on(table.number, table.restaurantId),
      restaurantIdx: index5("tables_restaurant_idx").on(table.restaurantId),
      activeIdx: index5("tables_active_idx").on(table.restaurantId, table.active),
      qrCodeLookupIdx: index5("tables_qr_lookup_idx").on(table.qrCode, table.restaurantId, table.active),
      positiveSeatCheck: check3("positive_seats", sql3`seats > 0`),
      positiveNumberCheck: check3("positive_number", sql3`number > 0`)
    }));
    insertTableSchema = createInsertSchema8(tables, {
      number: (schema) => schema.min(1, "Table number must be positive"),
      seats: (schema) => schema.min(1, "Table must have at least 1 seat").max(20, "Table cannot have more than 20 seats")
    });
    selectTableSchema = createSelectSchema8(tables);
  }
});

// ../../packages/shared/src/tables/order.ts
import { pgTable as pgTable9, text as text9, serial as serial9, integer as integer8, timestamp as timestamp9, index as index6, check as check4, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema9, createSelectSchema as createSelectSchema9 } from "drizzle-zod";
import { sql as sql4 } from "drizzle-orm";
var orderStatusEnum, orders, insertOrderSchema, selectOrderSchema;
var init_order = __esm({
  "../../packages/shared/src/tables/order.ts"() {
    "use strict";
    init_table();
    init_restaurant();
    orderStatusEnum = pgEnum("order_status", [
      "Received",
      "Preparing",
      "Ready",
      "Served",
      "Cancelled"
    ]);
    orders = pgTable9("orders", {
      id: serial9("id").primaryKey(),
      orderNumber: text9("order_number").notNull().unique(),
      tableId: integer8("table_id").references(() => tables.id, { onDelete: "restrict" }).notNull(),
      status: orderStatusEnum("status").default("Received").notNull(),
      restaurantId: integer8("restaurant_id").references(() => restaurants.id, { onDelete: "cascade" }).notNull(),
      total: integer8("total").default(0).notNull(),
      // Total in cents
      createdAt: timestamp9("created_at").defaultNow().notNull(),
      updatedAt: timestamp9("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      tableIdx: index6("orders_table_idx").on(table.tableId),
      restaurantIdx: index6("orders_restaurant_idx").on(table.restaurantId),
      statusIdx: index6("orders_status_idx").on(table.status),
      createdAtIdx: index6("orders_created_at_idx").on(table.createdAt),
      restaurantStatusIdx: index6("orders_restaurant_status_idx").on(table.restaurantId, table.status),
      orderStatsIdx: index6("orders_stats_idx").on(table.restaurantId, table.createdAt, table.status),
      totalCheck: check4("non_negative_total", sql4`total >= 0`)
    }));
    insertOrderSchema = createInsertSchema9(orders, {
      orderNumber: (schema) => schema.min(1, "Order number is required"),
      total: (schema) => schema.min(0, "Total cannot be negative")
    });
    selectOrderSchema = createSelectSchema9(orders);
  }
});

// ../../packages/shared/src/tables/orderItem.ts
import { pgTable as pgTable10, text as text10, serial as serial10, integer as integer9, timestamp as timestamp10, index as index7, check as check5 } from "drizzle-orm/pg-core";
import { createInsertSchema as createInsertSchema10, createSelectSchema as createSelectSchema10 } from "drizzle-zod";
import { sql as sql5 } from "drizzle-orm";
var orderItems, insertOrderItemSchema, selectOrderItemSchema;
var init_orderItem = __esm({
  "../../packages/shared/src/tables/orderItem.ts"() {
    "use strict";
    init_order();
    init_menuItem();
    orderItems = pgTable10("order_items", {
      id: serial10("id").primaryKey(),
      orderId: integer9("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
      menuItemId: integer9("menu_item_id").references(() => menuItems.id, { onDelete: "restrict" }).notNull(),
      quantity: integer9("quantity").default(1).notNull(),
      price: integer9("price").notNull(),
      // Price at time of order in cents
      notes: text10("notes"),
      createdAt: timestamp10("created_at").defaultNow().notNull(),
      updatedAt: timestamp10("updated_at").defaultNow().notNull().$onUpdateFn(() => /* @__PURE__ */ new Date())
    }, (table) => ({
      orderIdx: index7("order_items_order_idx").on(table.orderId),
      menuItemIdx: index7("order_items_menu_item_idx").on(table.menuItemId),
      quantityCheck: check5("positive_quantity", sql5`quantity > 0`),
      priceCheck: check5("non_negative_price", sql5`price >= 0`)
    }));
    insertOrderItemSchema = createInsertSchema10(orderItems, {
      quantity: (schema) => schema.min(1, "Quantity must be at least 1").max(99, "Quantity cannot exceed 99"),
      price: (schema) => schema.min(0, "Price cannot be negative"),
      notes: (schema) => schema.max(200, "Notes too long").optional()
    });
    selectOrderItemSchema = createSelectSchema10(orderItems);
  }
});

// ../../packages/shared/src/tables/index.ts
var init_tables = __esm({
  "../../packages/shared/src/tables/index.ts"() {
    "use strict";
    init_merchant();
    init_restaurant();
    init_language();
    init_category();
    init_menuItem();
    init_menuItemTranslation();
    init_categoryTranslation();
    init_table();
    init_order();
    init_orderItem();
  }
});

// ../../packages/shared/src/tables/relations.ts
import { relations } from "drizzle-orm";
var merchantRelations, restaurantsRelations, languagesRelations, categoriesRelations, menuItemsRelations, menuItemTranslationsRelations, categoryTranslationsRelations, tablesRelations, ordersRelations, orderItemsRelations;
var init_relations = __esm({
  "../../packages/shared/src/tables/relations.ts"() {
    "use strict";
    init_tables();
    merchantRelations = relations(merchants, ({ many }) => ({
      restaurants: many(restaurants)
    }));
    restaurantsRelations = relations(restaurants, ({ one, many }) => ({
      merchant: one(merchants, { fields: [restaurants.merchantId], references: [merchants.id] }),
      tables: many(tables),
      languages: many(languages)
    }));
    languagesRelations = relations(languages, ({ one, many }) => ({
      restaurant: one(restaurants, { fields: [languages.restaurantId], references: [restaurants.id] }),
      menuItemTranslations: many(menuItemTranslations),
      categoryTranslations: many(categoryTranslations)
    }));
    categoriesRelations = relations(categories, ({ one, many }) => ({
      restaurant: one(restaurants, { fields: [categories.restaurantId], references: [restaurants.id] }),
      menuItems: many(menuItems),
      translations: many(categoryTranslations)
    }));
    menuItemsRelations = relations(menuItems, ({ one, many }) => ({
      category: one(categories, { fields: [menuItems.categoryId], references: [categories.id] }),
      translations: many(menuItemTranslations),
      orderItems: many(orderItems)
    }));
    menuItemTranslationsRelations = relations(menuItemTranslations, ({ one }) => ({
      menuItem: one(menuItems, { fields: [menuItemTranslations.menuItemId], references: [menuItems.id] }),
      language: one(languages, { fields: [menuItemTranslations.languageId], references: [languages.id] })
    }));
    categoryTranslationsRelations = relations(categoryTranslations, ({ one }) => ({
      category: one(categories, { fields: [categoryTranslations.categoryId], references: [categories.id] }),
      language: one(languages, { fields: [categoryTranslations.languageId], references: [languages.id] })
    }));
    tablesRelations = relations(tables, ({ one, many }) => ({
      restaurant: one(restaurants, { fields: [tables.restaurantId], references: [restaurants.id] }),
      orders: many(orders)
    }));
    ordersRelations = relations(orders, ({ one, many }) => ({
      table: one(tables, { fields: [orders.tableId], references: [tables.id] }),
      restaurant: one(restaurants, { fields: [orders.restaurantId], references: [restaurants.id] }),
      orderItems: many(orderItems)
    }));
    orderItemsRelations = relations(orderItems, ({ one }) => ({
      order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
      menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] })
    }));
  }
});

// ../../packages/shared/src/schema.ts
var init_schema = __esm({
  "../../packages/shared/src/schema.ts"() {
    "use strict";
    init_tables();
    init_relations();
  }
});

// ../../packages/shared/src/query-models/TableWithQrCodeImage.ts
import { z } from "zod";
var tableWithQrCodeImage, singleTableWithQrCodeImage;
var init_TableWithQrCodeImage = __esm({
  "../../packages/shared/src/query-models/TableWithQrCodeImage.ts"() {
    "use strict";
    tableWithQrCodeImage = z.object({
      table: z.object({
        id: z.number(),
        number: z.number(),
        seats: z.number(),
        active: z.boolean(),
        restaurantId: z.number()
      }),
      imageUrl: z.string(),
      qrCodeBase64: z.string()
    });
    singleTableWithQrCodeImage = z.object({
      tableId: z.number(),
      imageUrl: z.string(),
      qrCodeBase64: z.string()
    });
  }
});

// ../../packages/shared/src/query-models/CategoryQueryModels.ts
import { z as z2 } from "zod";
var categoryResponse, categoryListResponse, categoryCreateRequest, categoryUpdateRequest, categoryErrorResponse;
var init_CategoryQueryModels = __esm({
  "../../packages/shared/src/query-models/CategoryQueryModels.ts"() {
    "use strict";
    categoryResponse = z2.object({
      id: z2.number(),
      name: z2.string(),
      sortOrder: z2.number().nullable(),
      restaurantId: z2.number(),
      createdAt: z2.date(),
      updatedAt: z2.date()
    });
    categoryListResponse = z2.array(categoryResponse);
    categoryCreateRequest = z2.object({
      name: z2.string().min(1).max(100),
      sortOrder: z2.number().min(0).optional(),
      restaurantId: z2.number()
    });
    categoryUpdateRequest = z2.object({
      name: z2.string().min(1).max(100).optional(),
      sortOrder: z2.number().min(0).optional(),
      updatedAt: z2.date().optional()
    });
    categoryErrorResponse = z2.object({
      message: z2.string(),
      errors: z2.array(z2.string()).optional()
    });
  }
});

// ../../packages/shared/src/query-models/CustomerQueryModels.ts
import { z as z3 } from "zod";
var languageResponse, customerRestaurantInfo, customerTableInfo, customerMenuItem, customerCategory, customerMenuItemFlattened, customerMenuResponse, customerMenuErrorResponse, customerMenuQueryParams;
var init_CustomerQueryModels = __esm({
  "../../packages/shared/src/query-models/CustomerQueryModels.ts"() {
    "use strict";
    languageResponse = z3.object({
      id: z3.number(),
      code: z3.string(),
      name: z3.string(),
      active: z3.boolean(),
      isPrimary: z3.boolean().nullable(),
      restaurantId: z3.number(),
      createdAt: z3.date(),
      updatedAt: z3.date()
    });
    customerRestaurantInfo = z3.object({
      id: z3.number(),
      name: z3.string(),
      address: z3.string(),
      phone: z3.string().nullable(),
      email: z3.string().nullable()
    });
    customerTableInfo = z3.object({
      id: z3.number(),
      number: z3.number(),
      seats: z3.number()
    });
    customerMenuItem = z3.object({
      id: z3.number(),
      name: z3.string(),
      description: z3.string().nullable(),
      price: z3.string(),
      // Price as string for display
      active: z3.boolean(),
      originalName: z3.string(),
      originalDescription: z3.string().nullable(),
      hasTranslation: z3.boolean()
    });
    customerCategory = z3.object({
      id: z3.number(),
      name: z3.string(),
      sortOrder: z3.number().nullable(),
      originalName: z3.string(),
      hasTranslation: z3.boolean(),
      menuItems: z3.array(customerMenuItem)
    });
    customerMenuItemFlattened = customerMenuItem.extend({
      categoryId: z3.number(),
      categoryName: z3.string(),
      categoryOriginalName: z3.string()
    });
    customerMenuResponse = z3.object({
      restaurant: customerRestaurantInfo,
      table: customerTableInfo,
      language: languageResponse,
      availableLanguages: z3.array(languageResponse),
      categories: z3.array(customerCategory),
      menu: z3.array(customerMenuItemFlattened)
    });
    customerMenuErrorResponse = z3.object({
      error: z3.enum([
        "MISSING_QR_CODE",
        "INVALID_QR_CODE",
        "TABLE_NOT_FOUND",
        "TABLE_INACTIVE",
        "RESTAURANT_NOT_FOUND",
        "NO_LANGUAGES_AVAILABLE",
        "MENU_FETCH_ERROR",
        "SERVER_ERROR"
      ]),
      message: z3.string()
    });
    customerMenuQueryParams = z3.object({
      qrCode: z3.string(),
      lang: z3.string().optional()
    });
  }
});

// ../../packages/shared/src/query-models/DashboardQueryModels.ts
import { z as z4 } from "zod";
var dashboardOrderInfo, dashboardStats, dashboardResponse, dashboardErrorResponse;
var init_DashboardQueryModels = __esm({
  "../../packages/shared/src/query-models/DashboardQueryModels.ts"() {
    "use strict";
    dashboardOrderInfo = z4.object({
      id: z4.number(),
      orderNumber: z4.string(),
      tableId: z4.number(),
      status: z4.enum(["Received", "Preparing", "Ready", "Served", "Cancelled"]),
      restaurantId: z4.number(),
      total: z4.number(),
      // Total in cents
      createdAt: z4.date(),
      updatedAt: z4.date()
    });
    dashboardStats = z4.object({
      menuItemsCount: z4.number(),
      tablesCount: z4.number(),
      orders: z4.object({
        totalOrders: z4.number(),
        pendingOrders: z4.number(),
        preparingOrders: z4.number(),
        completedOrders: z4.number()
      }),
      // Legacy field for backward compatibility
      todayStats: z4.object({
        totalOrders: z4.number(),
        pendingOrders: z4.number(),
        preparingOrders: z4.number(),
        completedOrders: z4.number()
      }).optional(),
      recentOrders: z4.array(dashboardOrderInfo)
    });
    dashboardResponse = dashboardStats;
    dashboardErrorResponse = z4.object({
      message: z4.string()
    });
  }
});

// ../../packages/shared/src/query-models/HealthQueryModels.ts
import { z as z5 } from "zod";
var healthResponse;
var init_HealthQueryModels = __esm({
  "../../packages/shared/src/query-models/HealthQueryModels.ts"() {
    "use strict";
    healthResponse = z5.object({
      status: z5.literal("healthy"),
      timestamp: z5.string(),
      // ISO timestamp
      uptime: z5.number(),
      // Process uptime in seconds
      environment: z5.string()
      // NODE_ENV value
    });
  }
});

// ../../packages/shared/src/query-models/MenuItemQueryModels.ts
import { z as z6 } from "zod";
var menuItemResponse, menuItemListResponse, menuItemCreateRequest, menuItemUpdateRequest, menuItemErrorResponse;
var init_MenuItemQueryModels = __esm({
  "../../packages/shared/src/query-models/MenuItemQueryModels.ts"() {
    "use strict";
    menuItemResponse = z6.object({
      id: z6.number(),
      name: z6.string(),
      description: z6.string().nullable(),
      price: z6.number(),
      // Price in cents
      categoryId: z6.number(),
      active: z6.boolean(),
      deletedAt: z6.date().nullable(),
      createdAt: z6.date(),
      updatedAt: z6.date()
    });
    menuItemListResponse = z6.array(menuItemResponse);
    menuItemCreateRequest = z6.object({
      name: z6.string().min(1).max(100),
      description: z6.string().max(500).optional(),
      price: z6.number().min(0),
      // Price in cents
      categoryId: z6.number(),
      active: z6.boolean().optional()
    });
    menuItemUpdateRequest = z6.object({
      name: z6.string().min(1).max(100).optional(),
      description: z6.string().max(500).optional(),
      price: z6.number().min(0).optional(),
      // Price in cents
      categoryId: z6.number().optional(),
      active: z6.boolean().optional(),
      updatedAt: z6.date().optional()
    });
    menuItemErrorResponse = z6.object({
      message: z6.string(),
      errors: z6.array(z6.string()).optional()
    });
  }
});

// ../../packages/shared/src/query-models/OrderQueryModels.ts
import { z as z7 } from "zod";
var orderStatus, orderItemResponse, orderItemWithMenuItem, orderResponse, orderWithItemsResponse, orderListResponse, orderCreateRequest, orderStatusUpdateRequest, orderErrorResponse;
var init_OrderQueryModels = __esm({
  "../../packages/shared/src/query-models/OrderQueryModels.ts"() {
    "use strict";
    orderStatus = z7.enum(["Received", "Preparing", "Ready", "Served", "Cancelled"]);
    orderItemResponse = z7.object({
      id: z7.number(),
      orderId: z7.number(),
      menuItemId: z7.number(),
      quantity: z7.number(),
      price: z7.number(),
      // Price in cents at time of order
      notes: z7.string().nullable(),
      createdAt: z7.date(),
      updatedAt: z7.date()
    });
    orderItemWithMenuItem = orderItemResponse.extend({
      menuItem: z7.object({
        id: z7.number(),
        name: z7.string(),
        description: z7.string().nullable(),
        price: z7.number(),
        categoryId: z7.number(),
        active: z7.boolean()
      })
    });
    orderResponse = z7.object({
      id: z7.number(),
      orderNumber: z7.string(),
      tableId: z7.number(),
      status: orderStatus,
      restaurantId: z7.number(),
      total: z7.number(),
      // Total in cents
      createdAt: z7.date(),
      updatedAt: z7.date()
    });
    orderWithItemsResponse = orderResponse.extend({
      orderItems: z7.array(orderItemWithMenuItem)
    });
    orderListResponse = z7.array(orderWithItemsResponse);
    orderCreateRequest = z7.object({
      restaurantId: z7.number(),
      tableId: z7.number(),
      items: z7.array(z7.object({
        menuItemId: z7.number(),
        quantity: z7.number().min(1).max(99),
        price: z7.number().min(0),
        // Price in cents
        notes: z7.string().max(200).optional()
      }))
    });
    orderStatusUpdateRequest = z7.object({
      status: orderStatus
    });
    orderErrorResponse = z7.object({
      message: z7.string()
    });
  }
});

// ../../packages/shared/src/query-models/RestaurantQueryModels.ts
import { z as z8 } from "zod";
var restaurantResponse, restaurantListResponse, restaurantCreateRequest, restaurantUpdateRequest, restaurantErrorResponse;
var init_RestaurantQueryModels = __esm({
  "../../packages/shared/src/query-models/RestaurantQueryModels.ts"() {
    "use strict";
    restaurantResponse = z8.object({
      id: z8.number(),
      name: z8.string(),
      address: z8.string(),
      phone: z8.string().nullable(),
      email: z8.string().nullable(),
      merchantId: z8.number(),
      createdAt: z8.date(),
      updatedAt: z8.date()
    });
    restaurantListResponse = z8.array(restaurantResponse);
    restaurantCreateRequest = z8.object({
      name: z8.string().min(1).max(100),
      address: z8.string().min(1).max(200),
      phone: z8.string().min(10).optional(),
      email: z8.string().email().optional(),
      merchantId: z8.number()
    });
    restaurantUpdateRequest = z8.object({
      name: z8.string().min(1).max(100).optional(),
      address: z8.string().min(1).max(200).optional(),
      phone: z8.string().min(10).optional(),
      email: z8.string().email().optional(),
      updatedAt: z8.date().optional()
    });
    restaurantErrorResponse = z8.object({
      message: z8.string()
    });
  }
});

// ../../packages/shared/src/query-models/TableQueryModels.ts
import { z as z9 } from "zod";
var tableResponse, tableListResponse, tableCreateRequest, tableUpdateRequest, tableQrCodesResponse, singleTableQrCodeResponse, tableErrorResponse;
var init_TableQueryModels = __esm({
  "../../packages/shared/src/query-models/TableQueryModels.ts"() {
    "use strict";
    init_TableWithQrCodeImage();
    tableResponse = z9.object({
      id: z9.number(),
      number: z9.number(),
      seats: z9.number(),
      restaurantId: z9.number(),
      qrCode: z9.string(),
      active: z9.boolean(),
      createdAt: z9.date(),
      updatedAt: z9.date()
    });
    tableListResponse = z9.array(tableResponse);
    tableCreateRequest = z9.object({
      number: z9.number().min(1),
      seats: z9.number().min(1).max(20),
      restaurantId: z9.number(),
      active: z9.boolean().optional()
    });
    tableUpdateRequest = z9.object({
      number: z9.number().min(1).optional(),
      seats: z9.number().min(1).max(20).optional(),
      active: z9.boolean().optional(),
      updatedAt: z9.date().optional()
    });
    tableQrCodesResponse = z9.array(tableWithQrCodeImage);
    singleTableQrCodeResponse = singleTableWithQrCodeImage;
    tableErrorResponse = z9.object({
      message: z9.string(),
      errors: z9.array(z9.string()).optional()
    });
  }
});

// ../../packages/shared/src/query-models/TranslationQueryModels.ts
import { z as z10 } from "zod";
var languageCreateRequest, languageUpdateRequest, menuItemTranslationResponse, menuItemTranslationCreateRequest, menuItemTranslationListResponse, categoryTranslationResponse, categoryTranslationCreateRequest, categoryTranslationListResponse, autoTranslateRequest, restaurantTranslationsResponse, translationErrorResponse;
var init_TranslationQueryModels = __esm({
  "../../packages/shared/src/query-models/TranslationQueryModels.ts"() {
    "use strict";
    init_CustomerQueryModels();
    languageCreateRequest = z10.object({
      code: z10.string().min(2).max(5).regex(/^[a-z]+$/, "Language code must be lowercase letters only"),
      name: z10.string().min(1).max(50),
      active: z10.boolean().optional(),
      isPrimary: z10.boolean().optional(),
      restaurantId: z10.number()
    });
    languageUpdateRequest = z10.object({
      code: z10.string().min(2).max(5).regex(/^[a-z]+$/).optional(),
      name: z10.string().min(1).max(50).optional(),
      active: z10.boolean().optional(),
      isPrimary: z10.boolean().optional(),
      updatedAt: z10.date().optional()
    });
    menuItemTranslationResponse = z10.object({
      id: z10.number(),
      menuItemId: z10.number(),
      languageId: z10.number(),
      name: z10.string(),
      description: z10.string().nullable(),
      createdAt: z10.date(),
      updatedAt: z10.date()
    });
    menuItemTranslationCreateRequest = z10.object({
      menuItemId: z10.number(),
      languageId: z10.number(),
      name: z10.string().min(1).max(100),
      description: z10.string().max(500).optional()
    });
    menuItemTranslationListResponse = z10.array(menuItemTranslationResponse);
    categoryTranslationResponse = z10.object({
      id: z10.number(),
      categoryId: z10.number(),
      languageId: z10.number(),
      name: z10.string(),
      createdAt: z10.date(),
      updatedAt: z10.date()
    });
    categoryTranslationCreateRequest = z10.object({
      categoryId: z10.number(),
      languageId: z10.number(),
      name: z10.string().min(1).max(100)
    });
    categoryTranslationListResponse = z10.array(categoryTranslationResponse);
    autoTranslateRequest = z10.object({
      restaurantId: z10.number(),
      sourceLanguageId: z10.number(),
      targetLanguageId: z10.number(),
      itemType: z10.enum(["menuItem", "category"]),
      itemId: z10.number()
    });
    restaurantTranslationsResponse = z10.object({
      languages: z10.array(languageResponse),
      menuItemTranslations: z10.array(menuItemTranslationResponse),
      categoryTranslations: z10.array(categoryTranslationResponse)
    });
    translationErrorResponse = z10.object({
      message: z10.string(),
      errors: z10.array(z10.string()).optional()
    });
  }
});

// ../../packages/shared/src/query-models/UserQueryModels.ts
import { z as z11 } from "zod";
var userResponse, authUserResponse, userLoginRequest, userRegisterRequest;
var init_UserQueryModels = __esm({
  "../../packages/shared/src/query-models/UserQueryModels.ts"() {
    "use strict";
    userResponse = z11.object({
      id: z11.number(),
      username: z11.string(),
      email: z11.string(),
      createdAt: z11.date(),
      updatedAt: z11.date(),
      restaurantName: z11.string().optional()
    });
    authUserResponse = userResponse;
    userLoginRequest = z11.object({
      username: z11.string().min(1),
      password: z11.string().min(1)
    });
    userRegisterRequest = z11.object({
      username: z11.string().min(3).max(50),
      email: z11.string().email(),
      password: z11.string().min(6),
      restaurantName: z11.string().min(1).max(100).optional()
    });
  }
});

// ../../packages/shared/src/index.ts
var src_exports = {};
__export(src_exports, {
  authUserResponse: () => authUserResponse,
  autoTranslateRequest: () => autoTranslateRequest,
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  categoryCreateRequest: () => categoryCreateRequest,
  categoryErrorResponse: () => categoryErrorResponse,
  categoryListResponse: () => categoryListResponse,
  categoryResponse: () => categoryResponse,
  categoryTranslationCreateRequest: () => categoryTranslationCreateRequest,
  categoryTranslationListResponse: () => categoryTranslationListResponse,
  categoryTranslationResponse: () => categoryTranslationResponse,
  categoryTranslations: () => categoryTranslations,
  categoryTranslationsRelations: () => categoryTranslationsRelations,
  categoryUpdateRequest: () => categoryUpdateRequest,
  customerCategory: () => customerCategory,
  customerMenuErrorResponse: () => customerMenuErrorResponse,
  customerMenuItem: () => customerMenuItem,
  customerMenuItemFlattened: () => customerMenuItemFlattened,
  customerMenuQueryParams: () => customerMenuQueryParams,
  customerMenuResponse: () => customerMenuResponse,
  customerRestaurantInfo: () => customerRestaurantInfo,
  customerTableInfo: () => customerTableInfo,
  dashboardErrorResponse: () => dashboardErrorResponse,
  dashboardOrderInfo: () => dashboardOrderInfo,
  dashboardResponse: () => dashboardResponse,
  dashboardStats: () => dashboardStats,
  healthResponse: () => healthResponse,
  insertCategorySchema: () => insertCategorySchema,
  insertCategoryTranslationSchema: () => insertCategoryTranslationSchema,
  insertLanguageSchema: () => insertLanguageSchema,
  insertMenuItemSchema: () => insertMenuItemSchema,
  insertMenuItemTranslationSchema: () => insertMenuItemTranslationSchema,
  insertMerchantSchema: () => insertMerchantSchema,
  insertOrderItemSchema: () => insertOrderItemSchema,
  insertOrderSchema: () => insertOrderSchema,
  insertRestaurantSchema: () => insertRestaurantSchema,
  insertTableSchema: () => insertTableSchema,
  languageCreateRequest: () => languageCreateRequest,
  languageResponse: () => languageResponse,
  languageUpdateRequest: () => languageUpdateRequest,
  languages: () => languages,
  languagesRelations: () => languagesRelations,
  menuItemCreateRequest: () => menuItemCreateRequest,
  menuItemErrorResponse: () => menuItemErrorResponse,
  menuItemListResponse: () => menuItemListResponse,
  menuItemResponse: () => menuItemResponse,
  menuItemTranslationCreateRequest: () => menuItemTranslationCreateRequest,
  menuItemTranslationListResponse: () => menuItemTranslationListResponse,
  menuItemTranslationResponse: () => menuItemTranslationResponse,
  menuItemTranslations: () => menuItemTranslations,
  menuItemTranslationsRelations: () => menuItemTranslationsRelations,
  menuItemUpdateRequest: () => menuItemUpdateRequest,
  menuItems: () => menuItems,
  menuItemsRelations: () => menuItemsRelations,
  merchantRelations: () => merchantRelations,
  merchants: () => merchants,
  orderCreateRequest: () => orderCreateRequest,
  orderErrorResponse: () => orderErrorResponse,
  orderItemResponse: () => orderItemResponse,
  orderItemWithMenuItem: () => orderItemWithMenuItem,
  orderItems: () => orderItems,
  orderItemsRelations: () => orderItemsRelations,
  orderListResponse: () => orderListResponse,
  orderResponse: () => orderResponse,
  orderStatus: () => orderStatus,
  orderStatusEnum: () => orderStatusEnum,
  orderStatusUpdateRequest: () => orderStatusUpdateRequest,
  orderWithItemsResponse: () => orderWithItemsResponse,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  restaurantCreateRequest: () => restaurantCreateRequest,
  restaurantErrorResponse: () => restaurantErrorResponse,
  restaurantListResponse: () => restaurantListResponse,
  restaurantResponse: () => restaurantResponse,
  restaurantTranslationsResponse: () => restaurantTranslationsResponse,
  restaurantUpdateRequest: () => restaurantUpdateRequest,
  restaurants: () => restaurants,
  restaurantsRelations: () => restaurantsRelations,
  selectCategorySchema: () => selectCategorySchema,
  selectCategoryTranslationSchema: () => selectCategoryTranslationSchema,
  selectLanguageSchema: () => selectLanguageSchema,
  selectMenuItemSchema: () => selectMenuItemSchema,
  selectMenuItemTranslationSchema: () => selectMenuItemTranslationSchema,
  selectMerchantSchema: () => selectMerchantSchema,
  selectOrderItemSchema: () => selectOrderItemSchema,
  selectOrderSchema: () => selectOrderSchema,
  selectRestaurantSchema: () => selectRestaurantSchema,
  selectTableSchema: () => selectTableSchema,
  singleTableQrCodeResponse: () => singleTableQrCodeResponse,
  singleTableWithQrCodeImage: () => singleTableWithQrCodeImage,
  tableCreateRequest: () => tableCreateRequest,
  tableErrorResponse: () => tableErrorResponse,
  tableListResponse: () => tableListResponse,
  tableQrCodesResponse: () => tableQrCodesResponse,
  tableResponse: () => tableResponse,
  tableUpdateRequest: () => tableUpdateRequest,
  tableWithQrCodeImage: () => tableWithQrCodeImage,
  tables: () => tables,
  tablesRelations: () => tablesRelations,
  translationErrorResponse: () => translationErrorResponse,
  userLoginRequest: () => userLoginRequest,
  userRegisterRequest: () => userRegisterRequest,
  userResponse: () => userResponse
});
var init_src = __esm({
  "../../packages/shared/src/index.ts"() {
    "use strict";
    init_schema();
    init_TableWithQrCodeImage();
    init_CategoryQueryModels();
    init_CustomerQueryModels();
    init_DashboardQueryModels();
    init_HealthQueryModels();
    init_MenuItemQueryModels();
    init_OrderQueryModels();
    init_RestaurantQueryModels();
    init_TableQueryModels();
    init_TranslationQueryModels();
    init_UserQueryModels();
  }
});

// db/index.ts
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { config } from "dotenv";
var isProduction, isStaging, pool, db;
var init_db = __esm({
  "db/index.ts"() {
    "use strict";
    init_src();
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
      } : false
    });
    db = drizzle(pool, { schema: src_exports });
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
    where: eq2(tables.id, tableId),
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
    init_src();
    init_logger();
    authenticate = (req, res, next) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      next();
    };
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
import path from "path";
import { fileURLToPath } from "url";

// routes.ts
import { createServer } from "http";

// auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session2 from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// storage.ts
init_db();
init_logger();
import { eq as eq3, and as and2, desc, sql as sql6, count, inArray, ne } from "drizzle-orm";

// services/qr-code-service.ts
init_db();
init_src();
import { eq, and } from "drizzle-orm";

// qr-utils.ts
import { createHash } from "crypto";
var getHashSalt = () => {
  return process.env.SESSION_SECRET || "fallback-salt-for-qr-codes";
};
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

// services/qr-code-service.ts
init_logger();
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

// storage.ts
init_src();
import connectPg from "connect-pg-simple";
import session from "express-session";
var PostgresSessionStore = connectPg(session);
var DatabaseStorage = class {
  sessionStore;
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
      tableName: "user_sessions"
    });
  }
  async getRestaurantById(id) {
    return await db.query.restaurants.findFirst({
      where: eq3(restaurants.id, id)
    });
  }
  getRestaurantByName(name) {
    return db.query.restaurants.findFirst({
      where: eq3(restaurants.name, name)
    });
  }
  async createRestaurant(restaurantData) {
    const [restaurant] = await db.insert(restaurants).values({
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
      where: eq3(restaurants.merchantId, merchantId),
      orderBy: restaurants.name
    });
  }
  async updateRestaurant(id, restaurantData, merchantId) {
    if (merchantId !== void 0) {
      const restaurant = await db.query.restaurants.findFirst({
        where: eq3(restaurants.id, id)
      });
      if (!restaurant || restaurant.merchantId !== merchantId) {
        throw new Error("RESTAURANT_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }
    const [updated] = await db.update(restaurants).set(restaurantData).where(eq3(restaurants.id, id)).returning();
    return updated;
  }
  deleteRestaurant(id) {
    return db.delete(restaurants).where(eq3(restaurants.id, id)).then(() => true).catch(() => false);
  }
  async getMenuItemsByCategoryId(categoryId) {
    return db.query.menuItems.findMany({
      where: eq3(menuItems.categoryId, categoryId),
      orderBy: menuItems.name
    });
  }
  async getLanguagesByRestaurantId(restaurantId) {
    return db.query.languages.findMany({
      where: eq3(languages.restaurantId, restaurantId),
      orderBy: [desc(languages.isPrimary), languages.name]
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
  async createMerchant(userData) {
    const [user] = await db.insert(merchants).values({
      username: userData.username,
      password: userData.password,
      email: userData.email
    }).returning();
    return user;
  }
  // Category methods
  async createCategory(categoryData) {
    const [category] = await db.insert(categories).values({
      name: categoryData.name,
      restaurantId: categoryData.restaurantId,
      sortOrder: categoryData.sortOrder
    }).returning();
    return category;
  }
  async getCategoriesByRestaurantId(restaurantId) {
    return await db.query.categories.findMany({
      where: eq3(categories.restaurantId, restaurantId),
      orderBy: categories.sortOrder
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
    const [updated] = await db.update(categories).set(categoryData).where(eq3(categories.id, id)).returning();
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
      await db.delete(categories).where(eq3(categories.id, id));
      return true;
    } catch (error) {
      logger_default.error(`Error deleting category: ${sanitizeError(error)}`);
      return false;
    }
  }
  // MenuItem methods
  async createMenuItem(menuItemData) {
    const [menuItem] = await db.insert(menuItems).values({
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
      where: eq3(categories.restaurantId, restaurantId),
      columns: { id: true }
    })).map((cat) => cat.id);
    if (categoryIds.length === 0) return [];
    return await db.query.menuItems.findMany({
      where: and2(
        inArray(menuItems.categoryId, categoryIds),
        eq3(menuItems.active, true)
      ),
      orderBy: menuItems.name
    });
  }
  async getMenuItemsByCategory(categoryId) {
    return await db.query.menuItems.findMany({
      where: and2(
        eq3(menuItems.categoryId, categoryId),
        eq3(menuItems.active, true)
      ),
      orderBy: menuItems.name
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
    const [updated] = await db.update(menuItems).set(menuItemData).where(eq3(menuItems.id, id)).returning();
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
      await db.update(menuItems).set({
        active: false,
        deletedAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(menuItems.id, id));
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
        eq3(languages.code, languageData.code),
        eq3(languages.restaurantId, languageData.restaurantId)
      )
    });
    if (existingLanguage) {
      throw new Error(`Language with code '${languageData.code}' already exists for this restaurant`);
    }
    if (languageData.isPrimary) {
      await db.update(languages).set({ isPrimary: false, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(languages.restaurantId, languageData.restaurantId));
    }
    const existingCount = await db.select({ count: count() }).from(languages).where(eq3(languages.restaurantId, languageData.restaurantId));
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
  async updateLanguage(id, languageData) {
    const currentLanguage = await db.query.languages.findFirst({
      where: eq3(languages.id, id)
    });
    if (!currentLanguage) {
      return void 0;
    }
    if (languageData.isPrimary) {
      await db.update(languages).set({ isPrimary: false, updatedAt: /* @__PURE__ */ new Date() }).where(and2(
        eq3(languages.restaurantId, currentLanguage.restaurantId),
        ne(languages.id, id)
        // Exclude current language
      ));
    }
    const [updated] = await db.update(languages).set({ ...languageData, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(languages.id, id)).returning();
    return updated;
  }
  async deleteLanguage(id) {
    try {
      const language = await db.query.languages.findFirst({
        where: eq3(languages.id, id)
      });
      if (!language) {
        return false;
      }
      const languageCount = await db.select({ count: count() }).from(languages).where(eq3(languages.restaurantId, language.restaurantId));
      if (languageCount[0].count <= 1) {
        throw new Error("Cannot delete the last language for a restaurant");
      }
      await db.delete(languages).where(eq3(languages.id, id));
      if (language.isPrimary) {
        const nextLanguage = await db.query.languages.findFirst({
          where: eq3(languages.restaurantId, language.restaurantId),
          orderBy: languages.createdAt
        });
        if (nextLanguage) {
          await db.update(languages).set({ isPrimary: true, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(languages.id, nextLanguage.id));
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
    const [translation] = await db.insert(menuItemTranslations).values({
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
          eq3(menuItemTranslations.menuItemId, menuItemId),
          eq3(menuItemTranslations.languageId, languageId)
        )
      });
    }
    return await db.query.menuItemTranslations.findMany({
      where: eq3(menuItemTranslations.menuItemId, menuItemId),
      with: { language: true }
    });
  }
  async updateMenuItemTranslation(id, translationData) {
    const [updated] = await db.update(menuItemTranslations).set(translationData).where(eq3(menuItemTranslations.id, id)).returning();
    return updated;
  }
  async createCategoryTranslation(translationData) {
    const [translation] = await db.insert(categoryTranslations).values({
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
          eq3(categoryTranslations.categoryId, categoryId),
          eq3(categoryTranslations.languageId, languageId)
        )
      });
    }
    return await db.query.categoryTranslations.findMany({
      where: eq3(categoryTranslations.categoryId, categoryId),
      with: { language: true }
    });
  }
  async updateCategoryTranslation(id, translationData) {
    const [updated] = await db.update(categoryTranslations).set(translationData).where(eq3(categoryTranslations.id, id)).returning();
    return updated;
  }
  // Table methods
  async createTable(tableData) {
    const qrCode = await this.generateTableQrCode(tableData.restaurantId, tableData.number);
    const [table] = await db.insert(tables).values({
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
      where: eq3(tables.restaurantId, restaurantId),
      orderBy: tables.number
    });
  }
  async getTable(id) {
    return await db.query.tables.findFirst({
      where: eq3(tables.id, id)
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
    const [updated] = await db.update(tables).set(tableData).where(eq3(tables.id, id)).returning();
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
      await db.delete(tables).where(eq3(tables.id, id));
      return true;
    } catch (error) {
      logger_default.error(`Error deleting table: ${sanitizeError(error)}`);
      return false;
    }
  }
  // Order methods
  async createOrder(orderData) {
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
  async createOrderWithItems({ orderData, orderItems: orderItemsList }) {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
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
      where: eq3(orders.tableId, tableId),
      orderBy: desc(orders.createdAt),
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
        where: eq3(restaurants.id, restaurantId)
      });
      if (!restaurant || restaurant.merchantId !== merchantId) {
        throw new Error("RESTAURANT_NOT_FOUND_OR_ACCESS_DENIED");
      }
    }
    return await db.query.orders.findMany({
      where: eq3(orders.restaurantId, restaurantId),
      orderBy: desc(orders.createdAt),
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
  async getOrdersByTable(tableId) {
    return await db.query.orders.findMany({
      where: eq3(orders.tableId, tableId),
      orderBy: desc(orders.createdAt)
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
      where: eq3(orders.id, orderId),
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
    const [updated] = await db.update(orders).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq3(orders.id, id)).returning();
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
      where: eq3(categories.restaurantId, restaurantId),
      columns: { id: true }
    })).map((cat) => cat.id);
    let menuItemsCount = 0;
    if (categoryIds.length > 0) {
      const menuItemsResult = await db.select({ count: count() }).from(menuItems).where(inArray(menuItems.categoryId, categoryIds));
      menuItemsCount = menuItemsResult[0]?.count || 0;
    }
    const tablesResult = await db.select({ count: count() }).from(tables).where(eq3(tables.restaurantId, restaurantId));
    const tablesCount = tablesResult[0]?.count || 0;
    const tableIds = (await db.query.tables.findMany({
      where: eq3(tables.restaurantId, restaurantId),
      columns: { id: true }
    })).map((table) => table.id);
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    let todayOrders = [];
    if (tableIds.length > 0) {
      todayOrders = await db.query.orders.findMany({
        where: and2(
          inArray(orders.tableId, tableIds),
          sql6`${orders.createdAt} >= ${today}`
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
        where: inArray(orders.tableId, tableIds),
        orderBy: desc(orders.createdAt),
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
        where: eq3(restaurants.id, finalTable.restaurantId)
      });
      if (!restaurant) {
        throw new Error("RESTAURANT_NOT_FOUND");
      }
      const availableLanguages = await db.query.languages.findMany({
        where: and2(
          eq3(languages.restaurantId, finalTable.restaurantId),
          eq3(languages.active, true)
        ),
        orderBy: [desc(languages.isPrimary), languages.name]
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
        where: eq3(categories.restaurantId, finalTable.restaurantId),
        orderBy: categories.sortOrder
      });
      const categoryIds = restaurantCategories.map((cat) => cat.id);
      if (categoryIds.length === 0) {
        return {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address ?? "",
            phone: restaurant.phone ?? null,
            email: restaurant.email ?? null
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
          inArray(menuItems.categoryId, categoryIds),
          eq3(menuItems.active, true)
        ),
        orderBy: menuItems.name
      });
      const categoryTranslationsMap = /* @__PURE__ */ new Map();
      if (targetLanguage.id) {
        const categoryTranslationsData = await db.query.categoryTranslations.findMany({
          where: and2(
            eq3(categoryTranslations.languageId, targetLanguage.id),
            inArray(categoryTranslations.categoryId, categoryIds)
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
            eq3(menuItemTranslations.languageId, targetLanguage.id),
            inArray(menuItemTranslations.menuItemId, menuItemIds)
          )
        });
        menuItemTranslationsData.forEach((translation) => {
          menuItemTranslationsMap.set(translation.menuItemId, translation);
        });
      }
      const localizedCategories = restaurantCategories.map((category) => {
        const categoryTranslation = categoryTranslationsMap.get(category.id);
        const categoryMenuItems = restaurantMenuItems.filter((item) => item.categoryId === category.id).map((item) => {
          const itemTranslation = menuItemTranslationsMap.get(item.id);
          return {
            id: item.id,
            name: itemTranslation?.name || item.name,
            description: itemTranslation?.description || item.description,
            // price as string for display per shared model (two decimals)
            price: (item.price / 100).toFixed(2),
            active: item.active,
            originalName: item.name,
            originalDescription: item.description,
            hasTranslation: !!itemTranslation
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
          email: restaurant.email ?? null
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
var storage = new DatabaseStorage();

// auth.ts
init_logger();
var scryptAsync = promisify(scrypt);
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
function setupAuth(app2) {
  const isProduction2 = process.env.NODE_ENV === "production";
  const isStaging2 = process.env.NODE_ENV === "staging";
  if ((isProduction2 || isStaging2) && !process.env.SESSION_SECRET) {
    logger_default.error("ERROR: SESSION_SECRET environment variable is required in staging/production");
    process.exit(1);
  }
  const sessionSettings = {
    secret: process.env.SESSION_SECRET || "development-fallback-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      secure: isProduction2 || isStaging2,
      // Secure cookies in staging too
      sameSite: "strict",
      maxAge: 1e3 * 60 * 60 * 24
    }
  };
  app2.set("trust proxy", 1);
  app2.use(session2(sessionSettings));
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getMerchantByUsername(username);
        if (!user || !await comparePasswords(password, user.password)) {
          logger_default.warn(`Failed login attempt for username: ${username}`);
          return done(null, false);
        } else {
          logger_default.info(`Successful login for user: ${user.id} (${username})`);
          return done(null, user);
        }
      } catch (error) {
        logger_default.error(`Login error for username ${username}: ${sanitizeError(error)}`);
        return done(error);
      }
    })
  );
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getMerchantById(id);
      if (!user) {
        logger_default.warn(`User with ID ${id} no longer exists, clearing session`);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      logger_default.error(`Error deserializing user ${id}: ${sanitizeError(error)}`);
      done(error);
    }
  });
  app2.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || typeof username !== "string" || username.length < 3 || username.length > 50) {
        return res.status(400).json({ message: "Username must be between 3 and 50 characters" });
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return res.status(400).json({ message: "Password must contain uppercase, lowercase, and number" });
      }
      const existingUser = await storage.getMerchantByUsername(username);
      if (existingUser) {
        logger_default.warn(`Registration attempt with existing username: ${username}`);
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.createMerchant({
        ...req.body,
        password: await hashPassword(password)
      });
      const defaultRestaurant = await storage.createRestaurant({
        name: `${req.body.username}'s Restaurant`,
        address: "Default Address - Please Update",
        phone: null,
        email: null,
        merchantId: user.id
      });
      await storage.createLanguage({
        code: "en",
        name: "English",
        active: true,
        isPrimary: true,
        restaurantId: defaultRestaurant.id
      });
      req.login(user, (err) => {
        if (err) return next(err);
        const { password: password2, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });
  app2.post("/api/login", passport.authenticate("local"), (req, res) => {
    if (req.user) {
      const { password, ...userWithoutPassword } = req.user;
      res.status(200).json(userWithoutPassword);
    } else {
      res.status(401).json({ message: "Authentication failed" });
    }
  });
  app2.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });
  app2.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });
}

// routes.ts
init_logger();

// security.ts
init_logger();
import rateLimit from "express-rate-limit";
var sessionRateStore = /* @__PURE__ */ new Map();
var ipRateStore = /* @__PURE__ */ new Map();
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
function sanitizeInput(req, _res, next) {
  function sanitizeObject(obj) {
    if (typeof obj === "string") {
      return obj.replace(/[<>'"]/g, "").replace(/javascript:/gi, "").replace(/on\w+=/gi, "").trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === "object") {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanKey = key.replace(/\W/g, "");
        if (cleanKey.length > 0) {
          sanitized[cleanKey] = sanitizeObject(value);
        }
      }
      return sanitized;
    }
    return obj;
  }
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
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
import { Router as Router2 } from "express";
init_logger();
var router2 = Router2();
router2.get("/api/dashboard/:restaurantId", authenticate, rateLimits.api, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = req.restaurant.id;
    const stats = await storage.getDashboardStats(restaurantId);
    res.json(stats);
  } catch (error) {
    logger_default.error(`Error fetching dashboard stats: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var dashboard_default = router2;

// routes/restaurants.ts
init_middleware();
import { Router as Router3 } from "express";
init_logger();
var router3 = Router3();
router3.get("/api/restaurants", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurants2 = await storage.getRestaurantsByMerchantId(req.user.id);
    res.json(restaurants2);
  } catch (error) {
    logger_default.error(`Error fetching restaurants: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var restaurants_default = router3;

// routes/categories.ts
init_middleware();
import { Router as Router4 } from "express";
import { z as z12 } from "zod";
init_src();
init_logger();
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
    if (error instanceof z12.ZodError) {
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
    const categories2 = await storage.getCategoriesByRestaurantId(req.restaurant.id);
    res.json(categories2);
  } catch (error) {
    logger_default.error(`Error fetching categories: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var categories_default = router4;

// routes/menu-items.ts
init_middleware();
import { Router as Router5 } from "express";
import { z as z13 } from "zod";
init_src();
init_logger();
var router5 = Router5();
router5.get("/api/menu-items/:restaurantId", authenticate, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = req.restaurant.id;
    const menuItems2 = await storage.getMenuItemsByRestaurantId(restaurantId);
    res.json(menuItems2);
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
    const menuItems2 = await storage.getMenuItemsByCategory(categoryId);
    res.json(menuItems2);
  } catch (error) {
    logger_default.error(`Error fetching menu items by category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.post("/api/menu-items", authenticate, async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    if (!categoryId || isNaN(Number(categoryId))) {
      return res.status(400).json({ message: "Valid categoryId is required" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user.id);
    if (!category) {
      return res.status(403).json({ message: "Category not found or access denied" });
    }
    const validatedData = insertMenuItemSchema.parse(req.body);
    const menuItem = await storage.createMenuItem(validatedData);
    res.status(201).json(menuItem);
  } catch (error) {
    if (error instanceof z13.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router5.put("/api/menu-items/:id", authenticate, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.id);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user.id);
    if (!menuItem) {
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    const updated = await storage.updateMenuItem(menuItemId, { ...req.body, updatedAt: /* @__PURE__ */ new Date() }, req.user.id);
    if (!updated) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(updated);
  } catch (error) {
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

// routes/tables.ts
init_middleware();
import { Router as Router6 } from "express";
import { z as z14 } from "zod";
import { eq as eq4, and as and3 } from "drizzle-orm";
import QRCode from "qrcode";
init_src();
init_db();
init_logger();
var router6 = Router6();
router6.get("/api/tables", authenticate, async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and3(eq4(restaurants.id, restaurantId), eq4(restaurants.merchantId, req.user.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    const tables2 = await storage.getTablesByRestaurantId(restaurantId);
    res.json(tables2);
  } catch (error) {
    logger_default.error(`Error fetching tables: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.post("/api/tables", authenticate, async (req, res) => {
  try {
    const restaurantId = req.body.restaurantId;
    if (!restaurantId || isNaN(Number(restaurantId))) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and3(eq4(restaurants.id, Number(restaurantId)), eq4(restaurants.merchantId, req.user.id))
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
    if (error instanceof z14.ZodError) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
      });
    }
    logger_default.error(`Error creating table: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.put("/api/tables/:id", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const table = await db.query.tables.findFirst({
      where: eq4(tables.id, tableId),
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
router6.delete("/api/tables/:id", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const table = await db.query.tables.findFirst({
      where: eq4(tables.id, tableId),
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
router6.get("/api/tables/qrcodes/all", authenticate, rateLimits.heavy, async (req, res) => {
  try {
    const restaurants2 = await storage.getRestaurantsByMerchantId(req.user.id);
    if (restaurants2.length === 0) {
      return res.status(404).json({ message: "No restaurants found" });
    }
    const restaurant = restaurants2[0];
    const tables2 = await storage.getTablesByRestaurantId(restaurant.id);
    const CHUNK_SIZE = 10;
    const qrCodes = [];
    const processChunk = async (startIdx) => {
      const endIdx = Math.min(startIdx + CHUNK_SIZE, tables2.length);
      const chunk = tables2.slice(startIdx, endIdx);
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
    for (let i = 0; i < tables2.length; i += CHUNK_SIZE) {
      const chunkResults = await processChunk(i);
      qrCodes.push(...chunkResults);
    }
    res.json(qrCodes);
  } catch (error) {
    logger_default.error(`Error generating QR codes: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router6.get("/api/tables/:id/qrcode", authenticate, async (req, res) => {
  try {
    const tableId = parseInt(req.params.id);
    const merchantId = req.query.merchantId ? parseInt(req.query.merchantId) : req.user.id;
    if (isNaN(tableId)) {
      return res.status(400).json({ message: "Invalid table ID" });
    }
    const table = await db.query.tables.findFirst({
      where: eq4(tables.id, tableId),
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
var tables_default = router6;

// routes/orders.ts
init_middleware();
import { Router as Router7 } from "express";
import { eq as eq5, and as and4 } from "drizzle-orm";
init_src();
init_db();
init_logger();
var router7 = Router7();
router7.post("/api/orders", rateLimits.orders, async (req, res) => {
  try {
    const { restaurantId, tableId, items } = req.body;
    if (!restaurantId || !tableId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Invalid order data" });
    }
    const table = await db.query.tables.findFirst({
      where: and4(eq5(tables.id, tableId), eq5(tables.restaurantId, restaurantId))
    });
    if (!table) {
      return res.status(404).json({ message: "Table not found or does not belong to restaurant" });
    }
    if (!table.active) {
      return res.status(403).json({ message: "Table is currently unavailable for orders" });
    }
    const orderNumber = `ORD${Date.now().toString().slice(-6)}`;
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const order = await storage.createOrder({
      orderNumber,
      tableId,
      restaurantId,
      status: "Received",
      total
    });
    for (const item of items) {
      await storage.createOrderItem({
        orderId: order.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes
      });
    }
    const completeOrder = await storage.getOrderWithItems(order.id);
    res.status(201).json(completeOrder);
  } catch (error) {
    logger_default.error(`Error creating order: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.get("/api/orders", authenticate, async (req, res) => {
  try {
    const restaurantId = parseInt(req.query.restaurantId);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Missing or invalid restaurantId" });
    }
    const restaurant = await db.query.restaurants.findFirst({
      where: and4(eq5(restaurants.id, restaurantId), eq5(restaurants.merchantId, req.user.id))
    });
    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }
    const orders2 = await storage.getOrdersByRestaurantId(restaurantId, req.user.id);
    res.json(orders2);
  } catch (error) {
    logger_default.error(`Error fetching orders: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
router7.put("/api/orders/:id/status", authenticate, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const order = await db.query.orders.findFirst({
      where: eq5(orders.id, orderId),
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
    res.json(completeOrder);
  } catch (error) {
    logger_default.error(`Error updating order status: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});
var orders_default = router7;

// routes/customer.ts
import { Router as Router8 } from "express";
init_logger();

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

// routes/customer.ts
var router8 = Router8();
router8.get("/api/customer/menu", async (req, res) => {
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
router8.get("/api/customer/menu-data", async (req, res) => {
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
var customer_default = router8;

// routes/translations.ts
init_middleware();
import { Router as Router9 } from "express";

// translation.ts
init_logger();
init_src();
init_db();
import { z as z15 } from "zod";
import { eq as eq6, and as and5, inArray as inArray2 } from "drizzle-orm";
import fetch from "node-fetch";
import * as https from "https";
var httpsAgent = new https.Agent({ keepAlive: true });
var translationCache = {};
async function translateText(text11, sourceLanguage, targetLanguage) {
  if (!text11 || text11.trim() === "") {
    return "";
  }
  const cacheKey = `${sourceLanguage}:${targetLanguage}:${text11}`;
  if (translationCache[cacheKey]?.[targetLanguage]) {
    return translationCache[cacheKey][targetLanguage];
  }
  try {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPL_API_KEY environment variable is not set");
    }
    const url = "https://api-free.deepl.com/v2/translate";
    const deeplSourceLang = sourceLanguage === "auto" ? "auto" : sourceLanguage.toUpperCase();
    const deeplTargetLang = targetLanguage.toUpperCase();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: [text11],
        source_lang: deeplSourceLang === "AUTO" ? null : deeplSourceLang,
        // null for auto-detection
        target_lang: deeplTargetLang
      }),
      agent: httpsAgent
      // Use the HTTPS agent for connection reuse
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepL API error: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    const translated = data.translations[0].text;
    if (!translationCache[cacheKey]) {
      translationCache[cacheKey] = {};
    }
    translationCache[cacheKey][targetLanguage] = translated;
    return translated;
  } catch (error) {
    logger_default.error(`Translation error: ${sanitizeError(error)}`);
    return text11;
  }
}
async function translateMenuItems(menuItemIds, sourceLanguageId, targetLanguageId, sourceLanguage, targetLanguage) {
  const results = [];
  for (const menuItemId of menuItemIds) {
    const menuItem = await db.query.menuItems.findFirst({
      where: eq6(menuItems.id, menuItemId)
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
      where: eq6(categories.id, categoryId)
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
    if (error instanceof z15.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating language: ${sanitizeError(error)}`);
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
      where: and5(eq6(languages.id, languageId), eq6(languages.restaurantId, restaurantId))
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
    if (error instanceof z15.ZodError) {
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
      where: and5(eq6(languages.id, languageId), eq6(languages.restaurantId, restaurantId))
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
    if (error instanceof z15.ZodError) {
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
    if (error instanceof z15.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger_default.error(`Error creating category translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
async function getCategoryTranslations(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
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
    const { sourceLanguageId, targetLanguageId, menuItemIds, categoryIds } = req.body;
    if (!sourceLanguageId || !targetLanguageId) {
      return res.status(400).json({ message: "Source and target language IDs are required" });
    }
    const languages2 = await storage.getLanguagesByRestaurantId(userId);
    const sourceLanguage = languages2.find((lang) => lang.id === sourceLanguageId);
    const targetLanguage = languages2.find((lang) => lang.id === targetLanguageId);
    if (!sourceLanguage || !targetLanguage) {
      return res.status(400).json({ message: "Invalid source or target language" });
    }
    const results = {
      menuItems: [],
      categories: []
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
      where: and5(
        eq6(languages.restaurantId, restaurantId),
        eq6(languages.code, langCode.toLowerCase())
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
      where: and5(
        eq6(menuItemTranslations.languageId, language.id),
        // Use inArray operator for menu item IDs
        inArray2(menuItemTranslations.menuItemId, menuItemIds)
      )
    });
    const categoryTranslationsResult = await db.query.categoryTranslations.findMany({
      where: and5(
        eq6(categoryTranslations.languageId, language.id),
        // Use inArray operator for category IDs
        inArray2(categoryTranslations.categoryId, categoryIds)
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
var router9 = Router9();
router9.post("/api/restaurants/:restaurantId/languages", authenticate, checkRestaurantOwnership, createLanguage);
router9.put("/api/restaurants/:restaurantId/languages/:id", authenticate, checkRestaurantOwnership, updateLanguage);
router9.delete("/api/restaurants/:restaurantId/languages/:id", authenticate, checkRestaurantOwnership, deleteLanguage);
router9.post("/api/restaurants/:restaurantId/translations/menu-items", authenticate, checkRestaurantOwnership, createMenuItemTranslation);
router9.get("/api/restaurants/:restaurantId/translations/menu-items/:menuItemId", authenticate, checkRestaurantOwnership, getMenuItemTranslations);
router9.post("/api/translations/categories", authenticate, createCategoryTranslation);
router9.get("/api/translations/categories/:categoryId", authenticate, getCategoryTranslations);
router9.post("/api/translations/auto", authenticate, autoTranslate);
router9.get("/api/restaurants/:restaurantId/translations", authenticate, checkRestaurantOwnership, getAllRestaurantTranslations);
var translations_default = router9;

// routes/index.ts
init_middleware();

// routes.ts
async function registerRoutes(app2) {
  app2.use(createProgressiveIPRateLimit());
  app2.use(suspiciousActivityDetector);
  app2.use(sanitizeInput);
  app2.use("/api/login", rateLimits.auth);
  app2.use("/api/register", rateLimits.auth);
  app2.use("/api/orders", rateLimits.orders);
  app2.use("/api/tables/qrcodes/all", rateLimits.heavy);
  app2.use("/api/menu", rateLimits.customer);
  app2.use("/api/customer/menu", rateLimits.customer);
  app2.use("/api/customer/menu-data", rateLimits.customer);
  app2.use("/api/restaurants/:restaurantId/translations", rateLimits.customer);
  setupAuth(app2);
  const httpServer = createServer(app2);
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
  app2.use(tables_default);
  app2.use(orders_default);
  app2.use(customer_default);
  app2.use(translations_default);
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
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
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
