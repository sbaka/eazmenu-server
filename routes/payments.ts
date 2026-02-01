import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import logger, { sanitizeError } from "../logger";

const router = Router();

// Check if Stripe is configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let stripe: any = null;
if (stripeSecretKey) {
  // Dynamic import to avoid errors when Stripe is not configured
  // @ts-ignore - stripe package may not be installed
  import('stripe').then((Stripe: any) => {
    stripe = new Stripe.default(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    logger.info('Stripe payment service initialized');
  }).catch((err) => {
    logger.warn(`Stripe package not installed: ${err.message}. Payment features will be disabled.`);
  });
} else {
  logger.warn('STRIPE_SECRET_KEY not configured. Payment features will be disabled.');
}

// Schema for creating checkout session
const createCheckoutSchema = z.object({
  orderId: z.number().int().positive(),
  restaurantId: z.number().int().positive(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

// Create Stripe checkout session for an order
router.post("/api/payments/create-checkout-session", async (req, res) => {
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

    // Get order details
    const order = await storage.getOrderWithItems(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Get restaurant details for metadata
    const restaurant = await storage.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Build line items from order items
    const lineItems = order.orderItems.map((item: any) => ({
      price_data: {
        currency: restaurant.currency?.toLowerCase() ?? 'usd',
        product_data: {
          name: item.menuItem?.name ?? 'Menu Item',
          description: item.menuItem?.description ?? undefined,
        },
        unit_amount: item.price, // Price in cents
      },
      quantity: item.quantity,
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        orderId: orderId.toString(),
        restaurantId: restaurantId.toString(),
        orderNumber: order.orderNumber,
      },
    });

    res.json({ 
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error(`Error creating checkout session: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Check payment status
router.get("/api/payments/status/:sessionId", async (req, res) => {
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
      currency: session.currency,
    });
  } catch (error) {
    logger.error(`Error retrieving payment status: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Stripe webhook handler
router.post("/api/payments/webhook", async (req, res) => {
  try {
    if (!stripe || !stripeWebhookSecret) {
      return res.status(503).json({ message: "Webhook not configured" });
    }

    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    let event;
    try {
      // Note: For production, raw body is needed. This should be configured in the main app.
      event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret);
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        
        if (orderId) {
          logger.info(`Payment completed for order ${orderId}`);
          // Optionally update order status or add payment record
          // await storage.updateOrderPaymentStatus(parseInt(orderId), 'paid');
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        
        if (orderId) {
          logger.info(`Payment session expired for order ${orderId}`);
        }
        break;
      }
      default:
        logger.debug(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error(`Error processing webhook: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Check if payments are enabled
router.get("/api/payments/enabled", (_req, res) => {
  res.json({ 
    enabled: !!stripe,
    provider: 'stripe',
  });
});

export default router;
