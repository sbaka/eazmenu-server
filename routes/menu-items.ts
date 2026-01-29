import { Router } from "express";
import { z } from "zod";
import { authenticate, checkRestaurantOwnership, checkCategoryOwnership, checkMenuItemOwnership } from "../middleware";
import { uploadMenuItemImage, validateAndUploadToSupabase, deleteUploadedFile, getFilenameFromUrl } from "../middleware/upload";
import { storage } from "../storage";
import { insertMenuItemSchema, menuItemIngredients } from "@eazmenu/shared";
import { db } from "@db";
import { eq } from "drizzle-orm";
import logger, { sanitizeError } from "../logger";

const router = Router();

// Get menu items by restaurant
router.get("/api/menu-items/:restaurantId", authenticate, checkRestaurantOwnership, async (req, res) => {
  try {
    const restaurantId = (req as any).restaurant.id;
    const menuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
    res.json(menuItems);
  } catch (error) {
    logger.error(`Error fetching menu items: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get menu items by category
router.get("/api/menu-items/category/:categoryId", authenticate, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Validate category ownership before accessing menu items
    const category = await checkCategoryOwnership(categoryId, req.user!.id);
    if (!category) {
      return res.status(403).json({ message: "Category not found or access denied" });
    }

    const menuItems = await storage.getMenuItemsByCategory(categoryId);
    res.json(menuItems);
  } catch (error) {
    logger.error(`Error fetching menu items by category: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get ingredients for a specific menu item
router.get("/api/menu-items/:menuItemId/ingredients", authenticate, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.menuItemId);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user!.id);
    if (!menuItem) {
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    
    const ingredients = await db.query.menuItemIngredients.findMany({
      where: eq(menuItemIngredients.menuItemId, menuItemId),
      with: {
        ingredient: {
          with: {
            translations: true,
          },
        },
      },
    });
    
    res.json(ingredients.map(mi => mi.ingredient));
  } catch (error) {
    logger.error(`Error fetching menu item ingredients: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create menu item
router.post("/api/menu-items", authenticate, uploadMenuItemImage.single('image'), validateAndUploadToSupabase, async (req, res) => {
  try {
    // Validate categoryId belongs to merchant
    const categoryId = req.body.categoryId;
    if (!categoryId || isNaN(Number(categoryId))) {
      // Clean up uploaded file if validation fails
      if ((req as any).uploadedFileName) {
        await deleteUploadedFile((req as any).uploadedFileName);
      }
      return res.status(400).json({ message: "Valid categoryId is required" });
    }
    
    const category = await checkCategoryOwnership(categoryId, req.user!.id);
    if (!category) {
      // Clean up uploaded file if validation fails
      if ((req as any).uploadedFileName) {
        await deleteUploadedFile((req as any).uploadedFileName);
      }
      return res.status(403).json({ message: "Category not found or access denied" });
    }
    
    // Prepare data for validation - handle image upload
    const requestData = {
      ...req.body,
      categoryId: parseInt(req.body.categoryId),
      price: parseInt(req.body.price),
      active: req.body.active === 'true',
      isBio: req.body.isBio === 'true',
      isFeatured: req.body.isFeatured === 'true',
      // Parse allergens from form data (comma-separated or JSON array)
      allergens: req.body.allergens 
        ? (typeof req.body.allergens === 'string' 
          ? (req.body.allergens.startsWith('[') 
            ? JSON.parse(req.body.allergens) 
            : req.body.allergens.split(',').filter(Boolean))
          : req.body.allergens)
        : null,
      // Use Supabase URL from middleware, or fallback to provided imageUrl
      imageUrl: (req as any).uploadedImageUrl || req.body.imageUrl || null
    };
    
    const validatedData = insertMenuItemSchema.parse(requestData);
    
    const menuItem = await storage.createMenuItem(validatedData);
    
    // Handle ingredients if provided
    const ingredientIds = req.body.ingredientIds;
    if (ingredientIds) {
      const parsedIngredientIds = typeof ingredientIds === 'string'
        ? (ingredientIds.startsWith('[') ? JSON.parse(ingredientIds) : ingredientIds.split(',').map(Number).filter(Boolean))
        : ingredientIds;
      
      if (Array.isArray(parsedIngredientIds) && parsedIngredientIds.length > 0) {
        await db.insert(menuItemIngredients).values(
          parsedIngredientIds.map((ingredientId: number) => ({
            menuItemId: menuItem.id,
            ingredientId,
          }))
        );
      }
    }
    
    res.status(201).json(menuItem);
  } catch (error) {
    // Clean up uploaded file if error occurs
    if ((req as any).uploadedFileName) {
      await deleteUploadedFile((req as any).uploadedFileName);
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger.error(`Error creating menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Update menu item
router.put("/api/menu-items/:id", authenticate, uploadMenuItemImage.single('image'), validateAndUploadToSupabase, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.id);
    if (isNaN(menuItemId)) {
      // Clean up uploaded file if validation fails
      if ((req as any).uploadedFileName) {
        await deleteUploadedFile((req as any).uploadedFileName);
      }
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user!.id);
    if (!menuItem) {
      // Clean up uploaded file if validation fails
      if ((req as any).uploadedFileName) {
        await deleteUploadedFile((req as any).uploadedFileName);
      }
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    
    // Prepare update data - handle image upload
    const updateData: any = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // Handle image upload - if new image is uploaded, delete old one and set new URL
    if ((req as any).uploadedImageUrl) {
      // Delete old image if it exists and is our uploaded file
      if ((menuItem as any).imageUrl) {
        const oldFilename = getFilenameFromUrl((menuItem as any).imageUrl);
        if (oldFilename) {
          await deleteUploadedFile(oldFilename);
        }
      }
      updateData.imageUrl = (req as any).uploadedImageUrl;
    } else if (req.body.categoryId) {
      // Parse form data types when no file is uploaded
      updateData.categoryId = parseInt(req.body.categoryId);
      updateData.price = parseInt(req.body.price);
      updateData.active = req.body.active === 'true';
      updateData.isBio = req.body.isBio === 'true';
      updateData.isFeatured = req.body.isFeatured === 'true';
      // Parse allergens from form data (comma-separated or JSON array)
      if (req.body.allergens !== undefined) {
        updateData.allergens = req.body.allergens 
          ? (typeof req.body.allergens === 'string' 
            ? (req.body.allergens.startsWith('[') 
              ? JSON.parse(req.body.allergens) 
              : req.body.allergens.split(',').filter(Boolean))
            : req.body.allergens)
          : null;
      }
    }
    
    // Handle ingredients if provided (replace all existing)
    const ingredientIds = req.body.ingredientIds;
    if (ingredientIds !== undefined) {
      // Delete existing ingredients for this menu item
      await db.delete(menuItemIngredients).where(eq(menuItemIngredients.menuItemId, menuItemId));
      
      // Add new ingredients if provided
      const parsedIngredientIds = typeof ingredientIds === 'string'
        ? (ingredientIds.startsWith('[') ? JSON.parse(ingredientIds) : ingredientIds.split(',').map(Number).filter(Boolean))
        : ingredientIds;
      
      if (Array.isArray(parsedIngredientIds) && parsedIngredientIds.length > 0) {
        await db.insert(menuItemIngredients).values(
          parsedIngredientIds.map((ingredientId: number) => ({
            menuItemId,
            ingredientId,
          }))
        );
      }
    }
    
    const updated = await storage.updateMenuItem(menuItemId, updateData, req.user!.id);
    if (!updated) {
      // Clean up uploaded file if update fails
      if ((req as any).uploadedFileName) {
        await deleteUploadedFile((req as any).uploadedFileName);
      }
      return res.status(404).json({ message: "Menu item not found" });
    }
    res.json(updated);
  } catch (error) {
    // Clean up uploaded file if error occurs
    if ((req as any).uploadedFileName) {
      await deleteUploadedFile((req as any).uploadedFileName);
    }
    
    logger.error(`Error updating menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete menu item
router.delete("/api/menu-items/:id", authenticate, async (req, res) => {
  try {
    const menuItemId = parseInt(req.params.id);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }
    
    const menuItem = await checkMenuItemOwnership(menuItemId, req.user!.id);
    if (!menuItem) {
      return res.status(403).json({ message: "Menu item not found or access denied" });
    }
    
    // Delete associated image file if it exists and is our uploaded file
    if ((menuItem as any).imageUrl) {
      const filename = getFilenameFromUrl((menuItem as any).imageUrl);
      if (filename) {
        await deleteUploadedFile(filename);
      }
    }
    
    const success = await storage.deleteMenuItem(menuItemId, req.user!.id);
    if (!success) {
      return res.status(404).json({ message: "Menu item not found or could not be deleted" });
    }
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting menu item: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router; 