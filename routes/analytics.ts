import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import logger, { sanitizeError } from "../logger";
import { MENU_ITEM_EVENT_VALUES } from "@eazmenu/shared";

const router = Router();

// Schema for tracking events
const trackEventSchema = z.object({
  menuItemId: z.number().int().positive(),
  restaurantId: z.number().int().positive(),
  eventType: z.enum(MENU_ITEM_EVENT_VALUES),
  sessionId: z.string().optional(),
});

// Track menu item event (public endpoint for customer app)
router.post("/api/analytics/track", async (req, res) => {
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
      sessionId: sessionId ?? null,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    logger.error(`Error tracking menu item event: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Batch track events (for multiple events at once)
const batchTrackSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(50),
});

router.post("/api/analytics/track/batch", async (req, res) => {
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
      events.map(event => 
        storage.createMenuItemEvent({
          menuItemId: event.menuItemId,
          restaurantId: event.restaurantId,
          eventType: event.eventType,
          sessionId: event.sessionId ?? null,
        })
      )
    );

    res.status(201).json({ success: true, count: events.length });
  } catch (error) {
    logger.error(`Error batch tracking menu item events: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
