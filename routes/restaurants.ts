import { Router } from "express";
import { authenticate } from "../middleware";
import { storage } from "../storage";
import { rateLimits } from "../security";
import logger, { sanitizeError } from "../logger";
import { insertRestaurantSchema, themeConfigSchema } from "@sbaka/shared";
import { z } from "zod";
import {
  uploadRestaurantBanner,
  uploadRestaurantLogo,
  validateAndUploadBanner,
  validateAndUploadLogo,
  deleteUploadedFile,
  STORAGE_BUCKETS,
} from "../middleware/upload";

const router = Router();

// Helper for optional URL fields (allow empty string, null, or valid URL)
const optionalUrl = z.string().refine(
  (val) => val === '' || val === null || val === undefined || z.string().url().safeParse(val).success,
  { message: 'Invalid URL' }
).optional().nullable();

// Helper for optional email (allow empty string, null, or valid email)
const optionalEmail = z.string().refine(
  (val) => val === '' || val === null || val === undefined || z.string().email().safeParse(val).success,
  { message: 'Invalid email' }
).optional().nullable();

// Helper for optional phone (allow empty string, null, or 10+ chars)
const optionalPhone = z.string().refine(
  (val) => val === '' || val === null || val === undefined || val.length >= 10,
  { message: 'Phone number must be at least 10 digits' }
).optional().nullable();

// Update schema for partial updates
const updateRestaurantSchema = z.object({
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
  chefMessage: z.string().max(500).optional().nullable(),
});

// Get restaurants for merchant
router.get("/api/restaurants", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurants = await storage.getRestaurantsByMerchantId(req.user!.id);
    res.json(restaurants);
  } catch (error) {
    logger.error(`Error fetching restaurants: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single restaurant by ID
router.get("/api/restaurants/:id", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const restaurant = await storage.getRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Verify ownership
    if (restaurant.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(restaurant);
  } catch (error) {
    logger.error(`Error fetching restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new restaurant
router.post("/api/restaurants", authenticate, rateLimits.api, async (req, res) => {
  try {
    // Validate request body
    const validationResult = insertRestaurantSchema.safeParse({
      ...req.body,
      merchantId: req.user!.id,
    });

    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Validation failed",
        errors: validationResult.error.flatten().fieldErrors 
      });
    }

    const restaurant = await storage.createRestaurant({
      ...validationResult.data,
      merchantId: req.user!.id,
    });

    logger.info(`Restaurant created: ${restaurant.name} by merchant ${req.user!.id}`);
    res.status(201).json(restaurant);
  } catch (error) {
    logger.error(`Error creating restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Update a restaurant
router.put("/api/restaurants/:id", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // Verify ownership first
    const existing = await storage.getRestaurantById(restaurantId);
    if (!existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (existing.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Partial validation for updates
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
      req.user!.id
    );

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    logger.info(`Restaurant updated: ${restaurant.name} by merchant ${req.user!.id}`);
    res.json(restaurant);
  } catch (error) {
    logger.error(`Error updating restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a restaurant
router.delete("/api/restaurants/:id", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // Verify ownership first
    const existing = await storage.getRestaurantById(restaurantId);
    if (!existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (existing.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const deleted = await storage.deleteRestaurant(restaurantId);
    if (!deleted) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    logger.info(`Restaurant deleted: ${restaurantId} by merchant ${req.user!.id}`);
    res.json({ message: "Restaurant deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting restaurant: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// =============================================================================
// RESTAURANT BRANDING ENDPOINTS
// =============================================================================

// Upload restaurant banner
router.post(
  "/api/restaurants/:id/banner",
  authenticate,
  rateLimits.api,
  uploadRestaurantBanner.single('image'),
  validateAndUploadBanner,
  async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.id as string);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: "Invalid restaurant ID" });
      }

      // Verify ownership
      const existing = await storage.getRestaurantById(restaurantId);
      if (!existing) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      if (existing.merchantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const uploadedUrl = (req as any).uploadedImageUrl;
      if (!uploadedUrl) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Delete old banner if exists
      if (existing.bannerUrl) {
        await deleteUploadedFile(existing.bannerUrl, STORAGE_BUCKETS.RESTAURANT_BANNERS);
      }

      // Update restaurant with new banner URL
      const restaurant = await storage.updateRestaurant(
        restaurantId,
        { bannerUrl: uploadedUrl },
        req.user!.id
      );

      logger.info(`Restaurant banner updated: ${restaurantId} by merchant ${req.user!.id}`);
      res.json({ bannerUrl: uploadedUrl, restaurant });
    } catch (error) {
      logger.error(`Error uploading restaurant banner: ${sanitizeError(error)}`);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete restaurant banner
router.delete("/api/restaurants/:id/banner", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // Verify ownership
    const existing = await storage.getRestaurantById(restaurantId);
    if (!existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (existing.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete banner from storage if exists
    if (existing.bannerUrl) {
      await deleteUploadedFile(existing.bannerUrl, STORAGE_BUCKETS.RESTAURANT_BANNERS);
    }

    // Update restaurant to remove banner URL
    const restaurant = await storage.updateRestaurant(
      restaurantId,
      { bannerUrl: null },
      req.user!.id
    );

    logger.info(`Restaurant banner deleted: ${restaurantId} by merchant ${req.user!.id}`);
    res.json({ message: "Banner deleted successfully", restaurant });
  } catch (error) {
    logger.error(`Error deleting restaurant banner: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Upload restaurant logo
router.post(
  "/api/restaurants/:id/logo",
  authenticate,
  rateLimits.api,
  uploadRestaurantLogo.single('image'),
  validateAndUploadLogo,
  async (req, res) => {
    try {
      const restaurantId = parseInt(req.params.id as string);
      if (isNaN(restaurantId)) {
        return res.status(400).json({ message: "Invalid restaurant ID" });
      }

      // Verify ownership
      const existing = await storage.getRestaurantById(restaurantId);
      if (!existing) {
        return res.status(404).json({ message: "Restaurant not found" });
      }
      if (existing.merchantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const uploadedUrl = (req as any).uploadedImageUrl;
      if (!uploadedUrl) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // Delete old logo if exists
      if (existing.logoUrl) {
        await deleteUploadedFile(existing.logoUrl, STORAGE_BUCKETS.RESTAURANT_LOGOS);
      }

      // Update restaurant with new logo URL
      const restaurant = await storage.updateRestaurant(
        restaurantId,
        { logoUrl: uploadedUrl },
        req.user!.id
      );

      logger.info(`Restaurant logo updated: ${restaurantId} by merchant ${req.user!.id}`);
      res.json({ logoUrl: uploadedUrl, restaurant });
    } catch (error) {
      logger.error(`Error uploading restaurant logo: ${sanitizeError(error)}`);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete restaurant logo
router.delete("/api/restaurants/:id/logo", authenticate, rateLimits.api, async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id as string);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // Verify ownership
    const existing = await storage.getRestaurantById(restaurantId);
    if (!existing) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (existing.merchantId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Delete logo from storage if exists
    if (existing.logoUrl) {
      await deleteUploadedFile(existing.logoUrl, STORAGE_BUCKETS.RESTAURANT_LOGOS);
    }

    // Update restaurant to remove logo URL
    const restaurant = await storage.updateRestaurant(
      restaurantId,
      { logoUrl: null },
      req.user!.id
    );

    logger.info(`Restaurant logo deleted: ${restaurantId} by merchant ${req.user!.id}`);
    res.json({ message: "Logo deleted successfully", restaurant });
  } catch (error) {
    logger.error(`Error deleting restaurant logo: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router; 