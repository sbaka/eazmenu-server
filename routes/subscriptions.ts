import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware";
import {
  getSubscriptionWithFeatures,
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  resumeSubscription,
  handleWebhookEvent,
  getCancelPreview,
  downgradeSubscription,
  upgradeSubscription,
  changeBillingInterval,
} from "../services/subscription.service";
import { PLAN_IDS, PLAN_FEATURES, PLAN_LOOKUP_KEYS } from "@sbaka/shared";
import { getStripePrices } from "../services/stripe-price-cache.service";
import logger, { sanitizeError } from "../logger";

const router = Router();

const stripeWebhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

// Get available plans with pricing (public - no auth required)
// Amounts, currency and trial settings come live from Stripe (TTL-cached).
router.get("/api/subscription/plans", async (_req, res) => {
  try {
    const prices = await getStripePrices();

    /** Resolve a Stripe price entry from its lookup_key */
    const toPricing = (lookupKey: string) => {
      const p = prices.get(lookupKey);
      return {
        amount: p ? p.unitAmount / 100 : 0,   // cents → euros
        priceId: p ? p.priceId : null,
        currency: p ? p.currency : 'eur',
      };
    };

    const plans = [
      {
        id: PLAN_IDS.FREE,
        features: PLAN_FEATURES.free,
        pricing: {
          monthly: { amount: 0, priceId: null, currency: 'eur' },
          yearly: { amount: 0, priceId: null, currency: 'eur' },
        },
      },
      {
        id: PLAN_IDS.ESSENTIEL,
        features: PLAN_FEATURES.essentiel,
        pricing: {
          monthly: toPricing(PLAN_LOOKUP_KEYS.essentiel.monthly),
          yearly: toPricing(PLAN_LOOKUP_KEYS.essentiel.yearly),
        },
      },
      {
        id: PLAN_IDS.PRO,
        features: PLAN_FEATURES.pro,
        pricing: {
          monthly: toPricing(PLAN_LOOKUP_KEYS.pro.monthly),
          yearly: toPricing(PLAN_LOOKUP_KEYS.pro.yearly),
        },
      },
    ];

    res.json({ plans });
  } catch (error) {
    logger.error(`Error fetching plans: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current merchant's subscription and plan features
router.get("/api/subscription", authenticate, async (req, res) => {
  try {
    const merchantId = req.user!.id;
    const result = await getSubscriptionWithFeatures(merchantId);

    res.json(result);
  } catch (error) {
    logger.error(`Error fetching subscription: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create Stripe checkout session
const checkoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

router.post("/api/subscription/checkout", authenticate, async (req, res) => {
  try {
    const validation = checkoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { priceId, successUrl, cancelUrl } = validation.data;
    const merchantId = req.user!.id;

    const result = await createCheckoutSession(merchantId, priceId, successUrl, cancelUrl);

    if (!result) {
      return res.status(503).json({ message: "Payment service not available" });
    }

    res.json(result);
  } catch (error) {
    logger.error(`Error creating checkout session: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create Stripe billing portal session
router.post("/api/subscription/portal", authenticate, async (req, res) => {
  try {
    const merchantId = req.user!.id;
    const returnUrl = req.body.returnUrl || process.env.ADMIN_URL || 'http://localhost:3000/settings';

    const result = await createBillingPortalSession(merchantId, returnUrl);

    if (!result) {
      return res.status(503).json({ message: "Billing portal not available. Please subscribe first." });
    }

    res.json(result);
  } catch (error) {
    logger.error(`Error creating billing portal session: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Cancel subscription (at period end)
router.post("/api/subscription/cancel", authenticate, async (req, res) => {
  try {
    const merchantId = req.user!.id;
    const result = await cancelSubscription(merchantId);
    res.json(result);
  } catch (error: any) {
    logger.error(`Error canceling subscription: ${sanitizeError(error)}`);
    res.status(400).json({ message: error.message || "Failed to cancel subscription" });
  }
});

// Get cancel preview with data counts and downgrade offer
router.get("/api/subscription/cancel-preview", authenticate, async (req, res) => {
  try {
    const merchantId = req.user!.id;
    const result = await getCancelPreview(merchantId);
    res.json(result);
  } catch (error: any) {
    logger.error(`Error fetching cancel preview: ${sanitizeError(error)}`);
    res.status(400).json({ message: error.message || "Failed to fetch cancel preview" });
  }
});

// Downgrade subscription (Pro → Essentiel)
const downgradeSchema = z.object({
  priceId: z.string().min(1),
});

const changeBillingIntervalSchema = z.object({
  priceId: z.string().min(1),
  confirmed: z.literal(true),
});

router.post("/api/subscription/upgrade", authenticate, async (req, res) => {
  try {
    const validation = downgradeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }
    const merchantId = req.user!.id;
    const result = await upgradeSubscription(merchantId, validation.data.priceId);
    res.json(result);
  } catch (error: any) {
    logger.error(`Error upgrading subscription: ${sanitizeError(error)}`);
    res.status(400).json({ message: error.message || "Failed to upgrade subscription" });
  }
});

router.post("/api/subscription/change-interval", authenticate, async (req, res) => {
  try {
    const validation = changeBillingIntervalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }
    const merchantId = req.user!.id;
    const result = await changeBillingInterval(merchantId, validation.data.priceId);
    res.json(result);
  } catch (error: any) {
    logger.error(`Error changing billing interval: ${sanitizeError(error)}`);
    res.status(400).json({ message: error.message || "Failed to change billing interval" });
  }
});

router.post("/api/subscription/downgrade", authenticate, async (req, res) => {
  try {
    const validation = downgradeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      });
    }
    const merchantId = req.user!.id;
    const result = await downgradeSubscription(merchantId, validation.data.priceId);
    res.json(result);
  } catch (error: any) {
    logger.error(`Error downgrading subscription: ${sanitizeError(error)}`);
    res.status(400).json({ message: error.message || "Failed to downgrade subscription" });
  }
});

// Resume a subscription scheduled for cancellation
router.post("/api/subscription/resume", authenticate, async (req, res) => {
  try {
    const merchantId = req.user!.id;
    await resumeSubscription(merchantId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error(`Error resuming subscription: ${sanitizeError(error)}`);
    res.status(400).json({ message: error.message || "Failed to resume subscription" });
  }
});

// Stripe webhook handler - uses raw body for signature verification
router.post("/api/subscription/webhook", async (req, res) => {
  try {
    if (!stripeWebhookSecret) {
      return res.status(503).json({ message: "Webhook not configured" });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    // Dynamic import stripe for webhook verification
    const Stripe = await import('stripe');
    const stripeInstance = new Stripe.default(process.env.STRIPE_SECRET_KEY!);

    let event;
    try {
      event = stripeInstance.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err: any) {
      logger.error(`Subscription webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    await handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    logger.error(`Error processing subscription webhook: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
