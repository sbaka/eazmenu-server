import { eq, sql, inArray } from "drizzle-orm";
import { db } from "@db";
import { subscriptions, merchants, restaurants, categories, menuItems, tables, languages, menuItemTranslations, categoryTranslations, type Subscription } from "@sbaka/shared";
import { PLAN_FEATURES, PLAN_LOOKUP_KEYS, FREE_TRIAL_DAYS, LOOKUP_KEY_TO_PLAN, getPlanFeatures, type PlanId, type PaidPlanId, type PlanFeatures } from "@sbaka/shared";
import { getStripePrices } from "./stripe-price-cache.service";
import { sendBillingChangeEmail } from "./transactional-email.service";
import logger from "../logger";

type SubscriptionWithSchedule = Subscription & {
  scheduledPlanId?: PlanId | null;
  scheduledPriceId?: string | null;
};

const subscriptionsWithSchedule = subscriptions as typeof subscriptions & {
  scheduledPlanId: typeof subscriptions.planId;
  scheduledPriceId: typeof subscriptions.stripePriceId;
};

// Lazy-loaded Stripe instance
let stripe: any = null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export type CheckoutRedirectContext = 'billing' | 'dashboard';

const CHECKOUT_REDIRECT_PATHS: Record<CheckoutRedirectContext, { successPath: string; cancelPath: string }> = {
  billing: {
    successPath: '/settings?tab=billing&checkout=success',
    cancelPath: '/settings?tab=billing&checkout=cancelled',
  },
  dashboard: {
    successPath: '/dashboard?checkout=success',
    cancelPath: '/dashboard?checkout=cancelled',
  },
};

function getAdminAppBaseUrl(): URL {
  return new URL(process.env.ADMIN_URL ?? 'http://localhost:3000');
}

function buildTrustedAdminUrl(path: string): string {
  return new URL(path, getAdminAppBaseUrl()).toString();
}

function getCheckoutRedirectUrls(context: CheckoutRedirectContext): { successUrl: string; cancelUrl: string } {
  const paths = CHECKOUT_REDIRECT_PATHS[context];

  return {
    successUrl: buildTrustedAdminUrl(paths.successPath),
    cancelUrl: buildTrustedAdminUrl(paths.cancelPath),
  };
}

function getBillingPortalReturnUrl(): string {
  return buildTrustedAdminUrl('/settings?tab=billing');
}

/** Safely parse a Stripe timestamp (Unix seconds or ISO string) into a Date */
function parseStripeTimestamp(value: unknown): Date {
  if (typeof value === 'number') return new Date(value * 1000);
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

/**
 * Extract current period dates from a Stripe subscription object.
 * In Stripe SDK v20+ (API 2025+), current_period_start/end moved
 * from the subscription root to items.data[0].
 */
function getStripePeriodDates(stripeSub: any): { start: Date; end: Date } {
  const item = stripeSub.items?.data?.[0];
  return {
    start: parseStripeTimestamp(item?.current_period_start ?? stripeSub.current_period_start),
    end: parseStripeTimestamp(item?.current_period_end ?? stripeSub.current_period_end),
  };
}

async function getStripe() {
  if (!stripe && stripeSecretKey) {
    const Stripe = await import('stripe');
    stripe = new Stripe.default(stripeSecretKey);
  }
  return stripe;
}

async function getAllowedPaidPriceIds(): Promise<Set<string>> {
  const prices = await getStripePrices();
  const allowedLookupKeys = [
    PLAN_LOOKUP_KEYS.essentiel.monthly,
    PLAN_LOOKUP_KEYS.essentiel.yearly,
    PLAN_LOOKUP_KEYS.pro.monthly,
    PLAN_LOOKUP_KEYS.pro.yearly,
  ];

  const allowed = new Set<string>();
  for (const key of allowedLookupKeys) {
    const price = prices.get(key);
    if (price?.priceId) {
      allowed.add(price.priceId);
    }
  }

  return allowed;
}

async function getAllowedDowngradePriceIds(): Promise<Set<string>> {
  const prices = await getStripePrices();
  const allowedLookupKeys = [
    PLAN_LOOKUP_KEYS.essentiel.monthly,
    PLAN_LOOKUP_KEYS.essentiel.yearly,
  ];

  const allowed = new Set<string>();
  for (const key of allowedLookupKeys) {
    const price = prices.get(key);
    if (price?.priceId) {
      allowed.add(price.priceId);
    }
  }

  return allowed;
}

async function resolvePriceSelection(priceId: string): Promise<{ planId: PaidPlanId; billingInterval: 'monthly' | 'yearly' } | null> {
  const prices = await getStripePrices();
  for (const [lookupKey, price] of prices.entries()) {
    const plan = LOOKUP_KEY_TO_PLAN[lookupKey];
    if (price.priceId === priceId && plan) {
      return {
        planId: plan.planId,
        billingInterval: plan.interval,
      };
    }
  }
  return null;
}

async function notifyBillingChange(
  merchantId: number,
  input: Omit<Parameters<typeof sendBillingChangeEmail>[0], 'to' | 'customerName'>,
): Promise<void> {
  const merchant = await db.query.merchants.findFirst({
    where: eq(merchants.id, merchantId),
    columns: { email: true, displayName: true, username: true },
  });

  try {
    await sendBillingChangeEmail({
      to: merchant?.email ?? null,
      customerName: merchant?.displayName ?? merchant?.username ?? 'there',
      ...input,
    });
  } catch (error) {
    logger.error(`Failed to send billing change email: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getAllowedUpgradePriceIds(): Promise<Set<string>> {
  const prices = await getStripePrices();
  const allowedLookupKeys = [
    PLAN_LOOKUP_KEYS.pro.monthly,
    PLAN_LOOKUP_KEYS.pro.yearly,
  ];

  const allowed = new Set<string>();
  for (const key of allowedLookupKeys) {
    const price = prices.get(key);
    if (price?.priceId) {
      allowed.add(price.priceId);
    }
  }

  return allowed;
}

/**
 * Create a free subscription for a merchant (permanently active, no trial)
 */
export async function createFreeSubscription(merchantId: number): Promise<Subscription> {
  const [subscription] = await db.insert(subscriptions).values({
    merchantId,
    planId: 'free',
    status: 'active',
  }).onConflictDoNothing({ target: subscriptions.merchantId }).returning();

  // If conflict (already exists), return existing
  if (!subscription) {
    const existing = await getSubscription(merchantId);
    return existing!;
  }

  return subscription as SubscriptionWithSchedule;
}

/**
 * Create an Essentiel trial subscription (14-day trial for free-to-paid upgrade)
 */
export async function createEssentielTrial(merchantId: number): Promise<Subscription> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + FREE_TRIAL_DAYS);

  const [subscription] = await db.update(subscriptions).set({
    planId: 'essentiel',
    status: 'trialing',
    trialEndsAt,
    updatedAt: new Date(),
  }).where(eq(subscriptions.merchantId, merchantId)).returning();

  return subscription as SubscriptionWithSchedule;
}

/**
 * Get a merchant's subscription
 */
export async function getSubscription(merchantId: number): Promise<SubscriptionWithSchedule | null> {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.merchantId, merchantId),
  });
  return (subscription as SubscriptionWithSchedule | null) ?? null;
}

/**
 * Get or create a subscription for a merchant (ensures every merchant has one)
 */
export async function getOrCreateSubscription(merchantId: number): Promise<SubscriptionWithSchedule> {
  const existing = await getSubscription(merchantId);
  if (existing) return existing;
  return createFreeSubscription(merchantId);
}

/**
 * Check if a subscription is currently active (trialing, active, or canceled but within period)
 */
export function isSubscriptionActive(subscription: Subscription): boolean {
  // Free plan is always active
  if (subscription.planId === 'free') return true;

  const now = new Date();

  switch (subscription.status) {
    case 'trialing':
      return subscription.trialEndsAt ? subscription.trialEndsAt > now : false;
    case 'active':
      return true;
    case 'past_due':
      return true; // Still active during grace period
    case 'canceled':
      // Active until end of current period
      return subscription.currentPeriodEnd ? subscription.currentPeriodEnd > now : false;
    case 'expired':
      return false;
    default:
      return false;
  }
}

/**
 * Get plan features for a merchant, returns null if subscription expired
 */
export async function getMerchantPlanFeatures(merchantId: number): Promise<PlanFeatures | null> {
  const subscription = await getOrCreateSubscription(merchantId);

  if (!isSubscriptionActive(subscription)) {
    return null;
  }

  return getPlanFeatures(subscription.planId) ?? PLAN_FEATURES.free;
}

/** Replace Infinity with -1 so JSON.stringify keeps the value */
export function sanitizeFeaturesForJson(f: PlanFeatures): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    out[k] = v === Infinity ? -1 : v;
  }
  return out;
}

/**
 * Get subscription with resolved plan features for API response
 */
export async function getSubscriptionWithFeatures(merchantId: number) {
  const subscription = await getOrCreateSubscription(merchantId);
  const active = isSubscriptionActive(subscription);
  const rawFeatures = active ? (getPlanFeatures(subscription.planId) ?? PLAN_FEATURES.free) : null;
  // Infinity is not valid JSON (serialises as null), so use -1 to mean "unlimited"
  const features = rawFeatures ? sanitizeFeaturesForJson(rawFeatures) : null;

  // Gather current usage counts across all merchant restaurants
  const merchantRestaurants = await db.query.restaurants.findMany({
    where: eq(restaurants.merchantId, merchantId),
    columns: { id: true },
  });
  const restaurantIds = merchantRestaurants.map(r => r.id);

  let menuItemsCount = 0;
  let languagesCount = 0;
  let translationCharacters = 0;

  if (restaurantIds.length > 0) {
    const [itemsResult, langsResult, menuCharResult, catCharResult] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` })
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(inArray(categories.restaurantId, restaurantIds)),
      db.select({ count: sql<number>`COUNT(*)` })
        .from(languages)
        .where(inArray(languages.restaurantId, restaurantIds)),
      db.select({
        totalChars: sql<number>`COALESCE(SUM(
          COALESCE(LENGTH(${menuItemTranslations.name}), 0) +
          COALESCE(LENGTH(${menuItemTranslations.description}), 0)
        ), 0)`,
      })
        .from(menuItemTranslations)
        .innerJoin(menuItems, eq(menuItemTranslations.menuItemId, menuItems.id))
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(inArray(categories.restaurantId, restaurantIds)),
      db.select({
        totalChars: sql<number>`COALESCE(SUM(COALESCE(LENGTH(${categoryTranslations.name}), 0)), 0)`,
      })
        .from(categoryTranslations)
        .innerJoin(categories, eq(categoryTranslations.categoryId, categories.id))
        .where(inArray(categories.restaurantId, restaurantIds)),
    ]);
    menuItemsCount = Number(itemsResult[0]?.count ?? 0);
    languagesCount = Number(langsResult[0]?.count ?? 0);
    translationCharacters = Number(menuCharResult[0]?.totalChars ?? 0) + Number(catCharResult[0]?.totalChars ?? 0);
  }

  return {
    subscription: {
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      billingInterval: subscription.billingInterval,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      scheduledPlanId: subscription.scheduledPlanId,
      createdAt: subscription.createdAt,
    },
    isActive: active,
    features,
    usage: {
      menuItems: menuItemsCount,
      languages: languagesCount,
      translationCharacters,
      restaurants: merchantRestaurants.length,
    },
    trialDaysRemaining: subscription.status === 'trialing' && subscription.trialEndsAt
      ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null,
  };
}

/**
 * Create a Stripe checkout session for subscribing to a plan
 */
export async function createCheckoutSession(
  merchantId: number,
  priceId: string,
  redirectContext: CheckoutRedirectContext,
): Promise<{ url: string } | null> {
  const allowedPriceIds = await getAllowedPaidPriceIds();
  if (!allowedPriceIds.has(priceId)) {
    throw new Error('Invalid subscription price');
  }

  const stripeInstance = await getStripe();
  if (!stripeInstance) {
    logger.warn('Stripe not configured, cannot create checkout session');
    return null;
  }

  const subscription = await getOrCreateSubscription(merchantId);
  if (subscription.planId !== 'free') {
    throw new Error('Checkout is only available for free subscriptions');
  }

  if (subscription.stripeSubscriptionId) {
    throw new Error('A Stripe subscription is already attached to this account');
  }

  const { successUrl, cancelUrl } = getCheckoutRedirectUrls(redirectContext);

  // Get or create Stripe customer
  let stripeCustomerId = subscription.stripeCustomerId;
  if (!stripeCustomerId) {
    const merchant = await db.query.merchants.findFirst({
      where: eq(merchants.id, merchantId),
    });

    if (!merchant) {
      throw new Error('Merchant not found');
    }

    const customer = await stripeInstance.customers.create({
      email: merchant.email ?? undefined,
      name: merchant.displayName ?? merchant.username,
      metadata: { merchantId: merchantId.toString() },
    });

    stripeCustomerId = customer.id;

    // Save Stripe customer ID
    await db.update(subscriptions)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(subscriptions.merchantId, merchantId));
  }

  const session = await stripeInstance.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { merchantId: merchantId.toString() },
  });

  return { url: session.url };
}

/**
 * Create a Stripe billing portal session
 */
export async function createBillingPortalSession(merchantId: number): Promise<{ url: string } | null> {
  const stripeInstance = await getStripe();
  if (!stripeInstance) return null;

  const subscription = await getSubscription(merchantId);
  if (!subscription?.stripeCustomerId) return null;

  const session = await stripeInstance.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: getBillingPortalReturnUrl(),
  });

  return { url: session.url };
}

/**
 * Cancel a subscription at the end of the current billing period.
 * For trialing subscriptions, cancels immediately.
 */
export async function cancelSubscription(merchantId: number): Promise<{ cancelAt: Date | null }> {
  const stripeInstance = await getStripe();
  const subscription = await getSubscription(merchantId);

  if (!subscription) {
    throw new Error('No subscription found');
  }

  // Free plan — nothing to cancel
  if (subscription.planId === 'free') {
    throw new Error('Cannot cancel a free plan');
  }

  // If trialing without Stripe sub, just downgrade to free
  if (subscription.status === 'trialing' && !subscription.stripeSubscriptionId) {
    await db.update(subscriptions).set({
      planId: 'free',
      status: 'active',
      trialEndsAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    }).where(eq(subscriptions.merchantId, merchantId));

    logger.info(`Trial canceled (no Stripe sub), downgraded to free: merchant ${merchantId}`);
    return { cancelAt: null };
  }

  // Cancel via Stripe at period end
  if (!stripeInstance || !subscription.stripeSubscriptionId) {
    throw new Error('Cannot cancel: no active Stripe subscription');
  }

  const updated = await stripeInstance.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await db.update(subscriptionsWithSchedule).set({
    cancelAtPeriodEnd: true,
    scheduledPlanId: null,
    scheduledPriceId: null,
    updatedAt: new Date(),
  } as any).where(eq(subscriptions.merchantId, merchantId));

  const { end: periodEnd } = getStripePeriodDates(updated);
  const cancelAt = periodEnd ?? subscription.currentPeriodEnd;

  await notifyBillingChange(merchantId, {
    changeType: 'cancel',
    fromLabel: subscription.planId,
    toLabel: 'free',
    effectiveDate: cancelAt,
  });

  logger.info(`Subscription scheduled for cancellation: merchant ${merchantId}, cancels at ${cancelAt}`);
  return { cancelAt };
}

/**
 * Resume a subscription that was scheduled for cancellation.
 */
export async function resumeSubscription(merchantId: number): Promise<void> {
  const stripeInstance = await getStripe();
  const subscription = await getSubscription(merchantId);

  if (!subscription || !subscription.stripeSubscriptionId) {
    throw new Error('No active subscription to resume');
  }

  if (!subscription.cancelAtPeriodEnd) {
    throw new Error('Subscription is not scheduled for cancellation');
  }

  if (!stripeInstance) {
    throw new Error('Payment service not available');
  }

  await stripeInstance.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await db.update(subscriptions).set({
    cancelAtPeriodEnd: false,
    updatedAt: new Date(),
  }).where(eq(subscriptions.merchantId, merchantId));

  await notifyBillingChange(merchantId, {
    changeType: 'resume',
    toLabel: subscription.planId,
    effectiveDate: subscription.currentPeriodEnd,
  });

  logger.info(`Subscription cancellation reversed: merchant ${merchantId}`);
}

/**
 * Handle Stripe webhook events for subscriptions
 */
export async function handleWebhookEvent(event: any): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription') return;

      const merchantId = parseInt(session.metadata?.merchantId);
      if (!merchantId) return;

      // Determine plan from the price lookup_key (no env vars needed)
      const stripeSubscriptionId = session.subscription;
      const stripeInstance = await getStripe();
      const stripeSub = await stripeInstance.subscriptions.retrieve(stripeSubscriptionId);
      const priceItem = stripeSub.items.data[0]?.price;
      const stripePriceId = priceItem?.id;
      const billingInterval = resolveBillingIntervalFromLookupKey(priceItem?.lookup_key);

      const planId = resolvePlanFromLookupKey(priceItem?.lookup_key);

      const period = getStripePeriodDates(stripeSub);
      await db.update(subscriptions).set({
        status: 'active',
        stripeSubscriptionId,
        stripePriceId,
        planId,
        billingInterval,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        updatedAt: new Date(),
      }).where(eq(subscriptions.merchantId, merchantId));

      logger.info(`Subscription activated for merchant ${merchantId}, plan: ${planId}`);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const stripeSubId = invoice.subscription;
      if (!stripeSubId) return;

      const stripeInstance = await getStripe();
      const stripeSub = await stripeInstance.subscriptions.retrieve(stripeSubId);
      const priceItem = stripeSub.items.data[0]?.price;
      const billingInterval = resolveBillingIntervalFromLookupKey(priceItem?.lookup_key);

      const period = getStripePeriodDates(stripeSub);
      const existingSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeSubscriptionId, stripeSubId),
        columns: {
          scheduledPlanId: true,
        } as any,
      }) as { scheduledPlanId?: PlanId | null } | null;

      const updateData: any = {
        status: 'active',
        billingInterval,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        updatedAt: new Date(),
      };

      // Apply scheduled downgrade on renewal
      if (existingSub?.scheduledPlanId) {
        updateData.planId = existingSub.scheduledPlanId;
        updateData.scheduledPlanId = null;
        updateData.scheduledPriceId = null;
        logger.info(`Scheduled downgrade applied via invoice.paid: ${stripeSubId}, new plan: ${existingSub.scheduledPlanId}`);
      }

      await db.update(subscriptions).set(updateData)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

      logger.info(`Invoice paid for subscription ${stripeSubId}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const stripeSubId = invoice.subscription;
      if (!stripeSubId) return;

      await db.update(subscriptions).set({
        status: 'past_due',
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

      logger.warn(`Payment failed for subscription ${stripeSubId}`);
      break;
    }

    case 'customer.subscription.updated': {
      const stripeSub = event.data.object;
      const priceItem = stripeSub.items.data[0]?.price;
      const stripePriceId = priceItem?.id;
      const planId = resolvePlanFromLookupKey(priceItem?.lookup_key);
      const billingInterval = resolveBillingIntervalFromLookupKey(priceItem?.lookup_key);

      const period = getStripePeriodDates(stripeSub);

      // Use Stripe metadata (carried on the event itself — no DB read race)
      // to detect if this update is from a scheduled downgrade.
      const isScheduledDowngrade = !!stripeSub.metadata?.scheduled_downgrade_from;

      const existingSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeSubscriptionId, stripeSub.id),
        columns: { currentPeriodStart: true },
      });

      const isRenewal = existingSub?.currentPeriodStart &&
        period.start.getTime() !== existingSub.currentPeriodStart.getTime();

      const updateData: any = {
        stripePriceId,
        billingInterval,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        updatedAt: new Date(),
      };

      if (stripeSub.status === 'active') updateData.status = 'active';
      else if (stripeSub.status === 'past_due') updateData.status = 'past_due';
      else if (stripeSub.status === 'canceled') updateData.status = 'canceled';

      // Scheduled downgrades: NEVER update planId here — invoice.paid handles it
      // reliably on actual renewal. The Stripe price update fires this webhook
      // mid-period with item-level period dates that can differ from the DB,
      // causing isRenewal to be a false positive.
      if (isScheduledDowngrade) {
        if (isRenewal) {
          // invoice.paid already applied the plan change; just clear schedule flags.
          updateData.scheduledPlanId = null;
          updateData.scheduledPriceId = null;
          logger.info(`Scheduled downgrade cleared on renewal: ${stripeSub.id}`);
        }
      } else if (isRenewal) {
        // Non-downgrade renewal — safe to update planId.
        updateData.planId = planId;
      }
      // Mid-period (non-downgrade): NEVER touch planId here.
      // Upgrades set planId directly in upgradeSubscription().

      await db.update(subscriptions).set(updateData)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));

      logger.info(`Subscription updated: ${stripeSub.id}, status: ${stripeSub.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object;

      // Downgrade to free plan when Stripe subscription is deleted
      await db.update(subscriptionsWithSchedule).set({
        planId: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        billingInterval: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        scheduledPlanId: null,
        scheduledPriceId: null,
        updatedAt: new Date(),
      } as any).where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));

      logger.info(`Subscription canceled, downgraded to free: ${stripeSub.id}`);
      break;
    }
  }
}

/**
 * Resolve plan ID from a Stripe price lookup_key.
 * Uses LOOKUP_KEY_TO_PLAN — no env vars, no hardcoded price IDs needed.
 */
function resolvePlanFromLookupKey(lookupKey: string | null | undefined): PlanId {
  if (lookupKey && LOOKUP_KEY_TO_PLAN[lookupKey]) {
    return LOOKUP_KEY_TO_PLAN[lookupKey].planId;
  }
  return 'essentiel'; // safe default for any paid Stripe subscription
}

function resolveBillingIntervalFromLookupKey(lookupKey: string | null | undefined): 'monthly' | 'yearly' | null {
  if (lookupKey && LOOKUP_KEY_TO_PLAN[lookupKey]) {
    return LOOKUP_KEY_TO_PLAN[lookupKey].interval;
  }
  return null;
}

/**
 * Get a cancel preview with data counts and downgrade offer.
 * Helps users understand what they'll lose and offers a downgrade alternative.
 */
export async function getCancelPreview(merchantId: number) {
  const subscription = await getSubscription(merchantId);
  if (!subscription || subscription.planId === 'free') {
    throw new Error('No active paid subscription');
  }

  // Count merchant data across all restaurants
  const merchantRestaurants = await db.query.restaurants.findMany({
    where: eq(restaurants.merchantId, merchantId),
    columns: { id: true },
  });
  const restaurantIds = merchantRestaurants.map(r => r.id);

  let menuItemsCount = 0;
  let categoriesCount = 0;
  let tablesCount = 0;
  let languagesCount = 0;

  if (restaurantIds.length > 0) {
    const [itemsResult, catsResult, tablesResult, langsResult] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` })
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(inArray(categories.restaurantId, restaurantIds)),
      db.select({ count: sql<number>`COUNT(*)` })
        .from(categories)
        .where(inArray(categories.restaurantId, restaurantIds)),
      db.select({ count: sql<number>`COUNT(*)` })
        .from(tables)
        .where(inArray(tables.restaurantId, restaurantIds)),
      db.select({ count: sql<number>`COUNT(*)` })
        .from(languages)
        .where(inArray(languages.restaurantId, restaurantIds)),
    ]);
    menuItemsCount = Number(itemsResult[0]?.count ?? 0);
    categoriesCount = Number(catsResult[0]?.count ?? 0);
    tablesCount = Number(tablesResult[0]?.count ?? 0);
    languagesCount = Number(langsResult[0]?.count ?? 0);
  }

  // Determine downgrade target (Pro → Essentiel, Essentiel → no downgrade offer)
  let downgradeOffer: {
    planId: PaidPlanId;
    features: PlanFeatures;
    pricing: { monthly: { amount: number; priceId: string | null }; yearly: { amount: number; priceId: string | null } };
  } | null = null;

  if (subscription.planId === 'pro') {
    const prices = await getStripePrices();
    const monthlyPrice = prices.get(PLAN_LOOKUP_KEYS.essentiel.monthly);
    const yearlyPrice = prices.get(PLAN_LOOKUP_KEYS.essentiel.yearly);

    downgradeOffer = {
      planId: 'essentiel',
      features: PLAN_FEATURES.essentiel,
      pricing: {
        monthly: {
          amount: monthlyPrice ? monthlyPrice.unitAmount / 100 : 0,
          priceId: monthlyPrice?.priceId ?? null,
        },
        yearly: {
          amount: yearlyPrice ? yearlyPrice.unitAmount / 100 : 0,
          priceId: yearlyPrice?.priceId ?? null,
        },
      },
    };
  }

  return {
    currentPlan: {
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
    dataCounts: {
      restaurants: merchantRestaurants.length,
      menuItems: menuItemsCount,
      categories: categoriesCount,
      tables: tablesCount,
      languages: languagesCount,
    },
    downgradeOffer,
  };
}

/**
 * Downgrade a Pro subscription to Essentiel via Stripe.
 * The Stripe price is updated immediately (so the next invoice uses the lower
 * rate), but the user keeps Pro features until the current billing period ends.
 * The actual planId switch happens in the webhook when the period renews.
 */
export async function downgradeSubscription(
  merchantId: number,
  priceId: string,
): Promise<{ success: boolean; effectiveDate: Date | null }> {
  const allowedDowngradePriceIds = await getAllowedDowngradePriceIds();
  if (!allowedDowngradePriceIds.has(priceId)) {
    throw new Error('Invalid downgrade price');
  }

  const stripeInstance = await getStripe();
  const subscription = await getSubscription(merchantId);

  if (!subscription) {
    throw new Error('No subscription found');
  }

  if (subscription.planId !== 'pro') {
    throw new Error('Only Pro subscriptions can be downgraded');
  }

  if (!stripeInstance || !subscription.stripeSubscriptionId) {
    throw new Error('Cannot downgrade: no active Stripe subscription');
  }

  // Resolve the target plan from the price so we know what to schedule
  const prices = await getStripePrices();
  let targetPlanId: PlanId = 'essentiel';
  for (const [lookupKey, info] of prices.entries()) {
    if (info.priceId === priceId) {
      targetPlanId = resolvePlanFromLookupKey(lookupKey);
      break;
    }
  }

  // 1. Record the scheduled downgrade in DB
  await db.update(subscriptionsWithSchedule).set({
    scheduledPlanId: targetPlanId,
    scheduledPriceId: priceId,
    cancelAtPeriodEnd: false,
    updatedAt: new Date(),
  } as any).where(eq(subscriptions.merchantId, merchantId));

  // 2. Update the Stripe subscription price (no proration — billed at next cycle)
  //    Metadata tells the webhook handler to NOT overwrite planId in the DB.
  const stripeSub = await stripeInstance.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const currentItem = stripeSub.items.data[0];

  if (!currentItem) {
    throw new Error('No subscription item found');
  }

  await stripeInstance.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: priceId }],
    proration_behavior: 'none',
    cancel_at_period_end: false,
    metadata: { scheduled_downgrade_from: subscription.planId },
  });

  logger.info(`Pro → Essentiel downgrade scheduled for merchant ${merchantId}, effective at period end`);
  return { success: true, effectiveDate: subscription.currentPeriodEnd };
}

/**
 * Upgrade an existing paid subscription (Essentiel → Pro) via Stripe.
 * Switches the subscription's price item in Stripe.
 * Also clears any pending scheduled downgrade.
 */
export async function upgradeSubscription(
  merchantId: number,
  priceId: string,
): Promise<{ success: boolean }> {
  const allowedPriceIds = await getAllowedUpgradePriceIds();
  if (!allowedPriceIds.has(priceId)) {
    throw new Error('Invalid upgrade price');
  }

  const stripeInstance = await getStripe();
  const subscription = await getSubscription(merchantId);
  const target = await resolvePriceSelection(priceId);

  if (!subscription || subscription.planId === 'free') {
    throw new Error('No active paid subscription found');
  }

  if (!target) {
    throw new Error('Invalid upgrade price');
  }

  const planOrder = ['free', 'essentiel', 'pro'];
  if (planOrder.indexOf(target.planId) <= planOrder.indexOf(subscription.planId)) {
    throw new Error('Target plan is not an upgrade');
  }

  if (!stripeInstance || !subscription.stripeSubscriptionId) {
    throw new Error('Cannot upgrade: no active Stripe subscription');
  }

  const stripeSub = await stripeInstance.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) {
    throw new Error('No subscription item found');
  }

  const updated = await stripeInstance.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: priceId }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
    metadata: { scheduled_downgrade_from: '' },
  });
  const period = getStripePeriodDates(updated);

  await db.update(subscriptionsWithSchedule).set({
    planId: target.planId,
    stripePriceId: priceId,
    billingInterval: target.billingInterval,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: false,
    scheduledPlanId: null,
    scheduledPriceId: null,
    updatedAt: new Date(),
  } as any).where(eq(subscriptions.merchantId, merchantId));

  await notifyBillingChange(merchantId, {
    changeType: 'upgrade',
    fromLabel: `${subscription.planId} ${subscription.billingInterval ?? ''}`.trim(),
    toLabel: `${target.planId} ${target.billingInterval}`,
    effectiveDate: period.end,
  });

  logger.info(`Subscription upgrade initiated for merchant ${merchantId}: ${subscription.planId} -> ${target.planId}`);
  return { success: true };
}

/**
 * Cancel a scheduled downgrade, reverting the Stripe subscription back to the
 * current plan's price.
 */
export async function cancelScheduledDowngrade(merchantId: number): Promise<{ success: boolean }> {
  const subscription = await getSubscription(merchantId);

  if (!subscription || !subscription.scheduledPlanId) {
    throw new Error('No scheduled downgrade to cancel');
  }

  const stripeInstance = await getStripe();
  if (!stripeInstance || !subscription.stripeSubscriptionId) {
    throw new Error('Cannot cancel downgrade: no active Stripe subscription');
  }

  const currentPlanId = subscription.planId as PaidPlanId;
  const interval = subscription.billingInterval ?? 'monthly';
  const lookupKey = PLAN_LOOKUP_KEYS[currentPlanId]?.[interval];
  if (!lookupKey) {
    throw new Error('Cannot resolve current plan price');
  }

  const prices = await getStripePrices();
  const currentPrice = prices.get(lookupKey);
  if (!currentPrice?.priceId) {
    throw new Error('Cannot resolve current plan price from Stripe');
  }

  const stripeSub = await stripeInstance.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) {
    throw new Error('No subscription item found');
  }

  await stripeInstance.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: currentPrice.priceId }],
    proration_behavior: 'none',
    metadata: { scheduled_downgrade_from: '' },
  });

  await db.update(subscriptionsWithSchedule).set({
    scheduledPlanId: null,
    scheduledPriceId: null,
    updatedAt: new Date(),
  } as any).where(eq(subscriptions.merchantId, merchantId));

  logger.info(`Scheduled downgrade canceled for merchant ${merchantId}, staying on ${currentPlanId}`);
  return { success: true };
}

export async function changeBillingInterval(
  merchantId: number,
  priceId: string,
): Promise<{ success: boolean }> {
  const allowedPriceIds = await getAllowedPaidPriceIds();
  if (!allowedPriceIds.has(priceId)) {
    throw new Error('Invalid billing interval price');
  }

  const stripeInstance = await getStripe();
  const subscription = await getSubscription(merchantId);
  const target = await resolvePriceSelection(priceId);

  if (!subscription || subscription.planId === 'free') {
    throw new Error('No active paid subscription found');
  }

  if (!target || target.planId !== subscription.planId) {
    throw new Error('Billing interval changes must keep the same plan');
  }

  if (subscription.billingInterval === target.billingInterval) {
    throw new Error('Billing interval is already active');
  }

  if (!stripeInstance || !subscription.stripeSubscriptionId) {
    throw new Error('Cannot change billing interval: no active Stripe subscription');
  }

  const stripeSub = await stripeInstance.subscriptions.retrieve(subscription.stripeSubscriptionId);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) {
    throw new Error('No subscription item found');
  }

  const updated = await stripeInstance.subscriptions.update(subscription.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: priceId }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
  });
  const period = getStripePeriodDates(updated);

  await db.update(subscriptions).set({
    stripePriceId: priceId,
    billingInterval: target.billingInterval,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    updatedAt: new Date(),
  }).where(eq(subscriptions.merchantId, merchantId));

  await notifyBillingChange(merchantId, {
    changeType: 'interval_change',
    fromLabel: `${subscription.planId} ${subscription.billingInterval ?? 'current billing'}`,
    toLabel: `${subscription.planId} ${target.billingInterval}`,
    effectiveDate: period.end,
  });

  logger.info(`Billing interval changed for merchant ${merchantId}: ${subscription.billingInterval} -> ${target.billingInterval}`);
  return { success: true };
}
