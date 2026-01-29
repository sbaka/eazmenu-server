import { Router } from "express";
import { authenticate, checkRestaurantOwnership } from "../middleware";
import { storage } from "../storage";
import { rateLimits } from "../security";
import logger, { sanitizeError } from "../logger";

const router = Router();

// Dashboard API - needs restaurantId
router.get("/api/dashboard/:restaurantId", authenticate, rateLimits.api, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = (req as any).restaurant.id;
    const [stats, popularItems] = await Promise.all([
      storage.getDashboardStats(restaurantId),
      storage.getPopularMenuItems(restaurantId, 5),
    ]);
    res.json({
      ...stats,
      popularItems,
    });
  } catch (error) {
    logger.error(`Error fetching dashboard stats: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router; 