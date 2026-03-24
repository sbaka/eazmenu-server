import { eq } from "drizzle-orm";
import { db } from "@db";
import { subscriptions, merchants, type Subscription } from "@sbaka/shared";
import { PLAN_FEATURES, FREE_TRIAL_DAYS, LOOKUP_KEY_TO_PLAN, getPlanFeatures, type PlanId, type PlanFeatures } from "@sbaka/shared";
import logger from "../logger";

// Lazy-loaded Stripe instance
let stripe: any = null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

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

  return subscription;
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

  return subscription;
}

/**
 * Get a merchant's subscription
 */
export async function getSubscription(merchantId: number): Promise<Subscription | null> {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.merchantId, merchantId),
  });
  return subscription ?? null;
}

/**
 * Get or create a subscription for a merchant (ensures every merchant has one)
 */
export async function getOrCreateSubscription(merchantId: number): Promise<Subscription> {
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

/**
 * Get subscription with resolved plan features for API response
 */
export async function getSubscriptionWithFeatures(merchantId: number) {
  const subscription = await getOrCreateSubscription(merchantId);
  const active = isSubscriptionActive(subscription);
  const features = active ? (getPlanFeatures(subscription.planId) ?? PLAN_FEATURES.free) : null;

  return {
    subscription: {
      id: subscription.id,
      planId: subscription.planId,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      createdAt: subscription.createdAt,
    },
    isActive: active,
    features,
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
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string } | null> {
  const stripeInstance = await getStripe();
  if (!stripeInstance) {
    logger.warn('Stripe not configured, cannot create checkout session');
    return null;
  }

  const subscription = await getOrCreateSubscription(merchantId);

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
export async function createBillingPortalSession(merchantId: number, returnUrl: string): Promise<{ url: string } | null> {
  const stripeInstance = await getStripe();
  if (!stripeInstance) return null;

  const subscription = await getSubscription(merchantId);
  if (!subscription?.stripeCustomerId) return null;

  const session = await stripeInstance.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
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

  await db.update(subscriptions).set({
    cancelAtPeriodEnd: true,
    updatedAt: new Date(),
  }).where(eq(subscriptions.merchantId, merchantId));

  const { end: periodEnd } = getStripePeriodDates(updated);
  const cancelAt = periodEnd ?? subscription.currentPeriodEnd;

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

      const planId = resolvePlanFromLookupKey(priceItem?.lookup_key);

      const period = getStripePeriodDates(stripeSub);
      await db.update(subscriptions).set({
        status: 'active',
        stripeSubscriptionId,
        stripePriceId,
        planId,
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

      const period = getStripePeriodDates(stripeSub);
      await db.update(subscriptions).set({
        status: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, stripeSubId));

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

      const period = getStripePeriodDates(stripeSub);
      const updateData: any = {
        planId,
        stripePriceId,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        updatedAt: new Date(),
      };

      if (stripeSub.status === 'active') updateData.status = 'active';
      else if (stripeSub.status === 'past_due') updateData.status = 'past_due';
      else if (stripeSub.status === 'canceled') updateData.status = 'canceled';

      await db.update(subscriptions).set(updateData)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));

      logger.info(`Subscription updated: ${stripeSub.id}, status: ${stripeSub.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object;

      // Downgrade to free plan when Stripe subscription is deleted
      await db.update(subscriptions).set({
        planId: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        billingInterval: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));

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
