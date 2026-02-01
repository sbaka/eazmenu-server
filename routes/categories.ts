import { Router } from "express";
import { z } from "zod";
import { authenticate, checkRestaurantOwnership, checkCategoryOwnership } from "../middleware";
import { storage } from "../storage";
import { rateLimits } from "../security";
import { insertCategorySchema } from "@sbaka/shared";
import logger, { sanitizeError } from "../logger";

const router = Router();

// Create category
router.post("/api/categories/:restaurantId", authenticate, rateLimits.api, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = (req as any).restaurant.id;
    const validatedData = insertCategorySchema.parse({
      ...req.body,
      restaurantId,
    });

    const category = await storage.createCategory(validatedData);
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: (error as z.ZodError).issues });
    }
    logger.error(`Error creating category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Update category
router.put("/api/categories/:categoryId", authenticate, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId as string);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user!.id);
    if (!category) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const updated = await storage.updateCategory(categoryId, {...req.body, updatedAt: new Date()}, req.user!.id);
    if (!updated) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(updated);
  } catch (error) {
    logger.error(`Error updating category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete category
router.delete("/api/categories/:categoryId", authenticate, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId as string);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }
    const category = await checkCategoryOwnership(categoryId, req.user!.id);
    if (!category) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const success = await storage.deleteCategory(categoryId, req.user!.id);
    if (!success) {
      return res.status(404).json({ message: "Category not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get categories by restaurant
router.get("/api/categories/:restaurantId", authenticate, checkRestaurantOwnership, async (req, res) => {
  try {
    const categories = await storage.getCategoriesByRestaurantId((req as any).restaurant.id);
    res.json(categories);
  } catch (error) {
    logger.error(`Error fetching categories: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router; 