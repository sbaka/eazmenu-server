import { Router, Request, Response, NextFunction } from "express";
import { authenticate, checkRestaurantOwnership, checkCategoryOwnership } from "../middleware";
import {
  createLanguage,
  updateLanguage,
  deleteLanguage,
  createMenuItemTranslation,
  getMenuItemTranslations,
  createCategoryTranslation,
  getCategoryTranslations,
  autoTranslate,
  getAllRestaurantTranslations,
  getLanguages,
} from "../translation";

const router = Router();

// Middleware to check category ownership for translation writes
async function checkCategoryOwnershipForTranslation(req: Request, res: Response, next: NextFunction) {
  try {
    const categoryId = req.body.categoryId || parseInt(req.params.categoryId);
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({ message: "Valid categoryId is required" });
    }
    
    const category = await checkCategoryOwnership(categoryId, req.user!.id);
    if (!category) {
      return res.status(403).json({ message: "Category not found or access denied" });
    }
    
    // Attach for downstream use
    (req as any).category = category;
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

// Staff language management routes - require authentication and restaurant ownership
router.get("/api/restaurants/:restaurantId/languages", authenticate, checkRestaurantOwnership, getLanguages);
router.post("/api/restaurants/:restaurantId/languages", authenticate, checkRestaurantOwnership, createLanguage);
router.put("/api/restaurants/:restaurantId/languages/:id", authenticate, checkRestaurantOwnership, updateLanguage);
router.delete("/api/restaurants/:restaurantId/languages/:id", authenticate, checkRestaurantOwnership, deleteLanguage);

// Menu item translation routes
router.post("/api/restaurants/:restaurantId/translations/menu-items", authenticate, checkRestaurantOwnership, createMenuItemTranslation);
router.get("/api/restaurants/:restaurantId/translations/menu-items/:menuItemId", authenticate, checkRestaurantOwnership, getMenuItemTranslations);

// Category translation routes
// POST requires ownership check (write operation)
router.post("/api/translations/categories", authenticate, checkCategoryOwnershipForTranslation, createCategoryTranslation);
// GET is public (read operation) - kept without ownership check per requirements
router.get("/api/translations/categories/:categoryId", getCategoryTranslations);

// Auto translation route - requires ownership check
router.post("/api/translations/auto", authenticate, autoTranslate);

// Get all translations for a restaurant (public read)
router.get("/api/restaurants/:restaurantId/translations", getAllRestaurantTranslations);

export default router; 