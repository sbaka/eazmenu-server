import { eq, and, sql } from "drizzle-orm";
import { db } from "@db";
import {
  languages,
  menuItems,
  menuItemTranslations,
  categoryTranslations,
  categories,
  restaurants,
} from "@sbaka/shared";
import { type PlanFeatures } from "@sbaka/shared";
import { getMerchantPlanFeatures } from "./subscription.service";

interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  planId?: string;
}

/**
 * Check if a merchant can create another restaurant
 */
export async function checkRestaurantLimit(merchantId: number): Promise<LimitCheckResult> {
  const features = await getMerchantPlanFeatures(merchantId);

  if (!features) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const merchantRestaurants = await db.query.restaurants.findMany({
    where: eq(restaurants.merchantId, merchantId),
  });

  return {
    allowed: merchantRestaurants.length < features.maxRestaurants,
    current: merchantRestaurants.length,
    limit: features.maxRestaurants,
  };
}

/**
 * Check if a merchant can add another language to their restaurant
 */
export async function checkLanguageLimit(merchantId: number, restaurantId: number): Promise<LimitCheckResult> {
  const features = await getMerchantPlanFeatures(merchantId);

  if (!features) {
    return { allowed: false, current: 0, limit: 0, planId: undefined };
  }

  const activeLanguages = await db.query.languages.findMany({
    where: and(
      eq(languages.restaurantId, restaurantId),
      eq(languages.active, true),
    ),
  });

  return {
    allowed: activeLanguages.length < features.maxLanguages,
    current: activeLanguages.length,
    limit: features.maxLanguages,
  };
}

/**
 * Check if a merchant can translate more characters
 * Counts total characters across all existing translations
 */
export async function checkTranslationCharacterLimit(
  merchantId: number,
  restaurantId: number,
  additionalCharacters: number = 0,
): Promise<LimitCheckResult> {
  const features = await getMerchantPlanFeatures(merchantId);

  if (!features) {
    return { allowed: false, current: 0, limit: 0 };
  }

  // Count characters in menu item translations for this restaurant
  const menuItemCharCount = await db
    .select({
      totalChars: sql<number>`COALESCE(SUM(
        COALESCE(LENGTH(${menuItemTranslations.name}), 0) +
        COALESCE(LENGTH(${menuItemTranslations.description}), 0)
      ), 0)`,
    })
    .from(menuItemTranslations)
    .innerJoin(menuItems, eq(menuItemTranslations.menuItemId, menuItems.id))
    .innerJoin(categories, eq(menuItems.categoryId, categories.id))
    .where(eq(categories.restaurantId, restaurantId));

  // Count characters in category translations for this restaurant
  const categoryCharCount = await db
    .select({
      totalChars: sql<number>`COALESCE(SUM(COALESCE(LENGTH(${categoryTranslations.name}), 0)), 0)`,
    })
    .from(categoryTranslations)
    .innerJoin(categories, eq(categoryTranslations.categoryId, categories.id))
    .where(eq(categories.restaurantId, restaurantId));

  const currentChars = Number(menuItemCharCount[0]?.totalChars ?? 0) + Number(categoryCharCount[0]?.totalChars ?? 0);

  return {
    allowed: (currentChars + additionalCharacters) <= features.maxTranslationCharacters,
    current: currentChars,
    limit: features.maxTranslationCharacters,
  };
}

/**
 * Get theme restrictions based on merchant's plan
 */
export async function getThemeRestrictions(merchantId: number): Promise<{
  allowed: boolean;
  level: 'none' | 'basic' | 'full' | null;
  allowedFields: string[];
}> {
  const features = await getMerchantPlanFeatures(merchantId);

  if (!features) {
    return { allowed: false, level: null, allowedFields: [] };
  }

  if (features.themeCustomization === 'full') {
    return {
      allowed: true,
      level: 'full',
      allowedFields: ['primaryColor', 'accentColor', 'fontFamily'],
    };
  }

  if (features.themeCustomization === 'basic') {
    return {
      allowed: true,
      level: 'basic',
      allowedFields: ['primaryColor', 'fontFamily'],
    };
  }

  // Free plan — no theme customization
  return { allowed: false, level: 'none', allowedFields: [] };
}

/**
 * Check if a merchant can create another menu item (Free plan has 20-item cap)
 */
export async function checkMenuItemLimit(merchantId: number, restaurantId: number): Promise<LimitCheckResult> {
  const features = await getMerchantPlanFeatures(merchantId);

  if (!features) {
    return { allowed: false, current: 0, limit: 0 };
  }

  // Unlimited items for paid plans
  if (!isFinite(features.maxMenuItems)) {
    return { allowed: true, current: 0, limit: features.maxMenuItems };
  }

  // Count existing menu items for this restaurant
  const existingItems = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(menuItems)
    .innerJoin(categories, eq(menuItems.categoryId, categories.id))
    .where(eq(categories.restaurantId, restaurantId));

  const current = Number(existingItems[0]?.count ?? 0);

  return {
    allowed: current < features.maxMenuItems,
    current,
    limit: features.maxMenuItems,
  };
}

/**
 * Check access to a boolean feature
 */
export async function checkFeatureAccess(
  merchantId: number,
  feature: keyof Pick<PlanFeatures, 'chefMessage' | 'bioLabels' | 'featuredItems' | 'perTableQrCodes' | 'nutritionalInfo' | 'customBranding' | 'whiteLabel' | 'prioritySupport'>,
): Promise<boolean> {
  const features = await getMerchantPlanFeatures(merchantId);
  if (!features) return false;
  return features[feature];
}

/**
 * Get analytics access level for a merchant
 */
export async function getAnalyticsLevel(merchantId: number): Promise<'none' | 'basic' | 'advanced'> {
  const features = await getMerchantPlanFeatures(merchantId);
  if (!features) return 'none';
  return features.analytics;
}
