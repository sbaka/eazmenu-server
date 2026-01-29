import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware";
import { db } from "@db";
import { eq, asc } from "drizzle-orm";
import { 
  ingredients, 
  ingredientTranslations, 
  insertIngredientSchema,
  INGREDIENT_CATEGORY_VALUES
} from "@eazmenu/shared";
import logger, { sanitizeError } from "../logger";

const router = Router();

// Get all ingredients (global, available to all authenticated users)
router.get("/api/ingredients", authenticate, async (_req, res) => {
  try {
    const allIngredients = await db.query.ingredients.findMany({
      orderBy: [asc(ingredients.category), asc(ingredients.name)],
      with: {
        translations: true,
      },
    });
    
    res.json(allIngredients);
  } catch (error) {
    logger.error(`Error fetching ingredients: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get ingredients grouped by category
router.get("/api/ingredients/grouped", authenticate, async (_req, res) => {
  try {
    const allIngredients = await db.query.ingredients.findMany({
      orderBy: [asc(ingredients.category), asc(ingredients.name)],
      with: {
        translations: true,
      },
    });
    
    // Group by category
    const grouped = INGREDIENT_CATEGORY_VALUES.reduce((acc, category) => {
      acc[category] = allIngredients.filter(ing => ing.category === category);
      return acc;
    }, {} as Record<string, typeof allIngredients>);
    
    res.json(grouped);
  } catch (error) {
    logger.error(`Error fetching grouped ingredients: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create a new ingredient (global, any authenticated user can add)
router.post("/api/ingredients", authenticate, async (req, res) => {
  try {
    const validatedData = insertIngredientSchema.parse(req.body);
    
    // Check if ingredient with same name already exists (case-insensitive)
    const existing = await db.query.ingredients.findFirst({
      where: eq(ingredients.name, validatedData.name),
    });
    
    if (existing) {
      return res.status(409).json({ 
        message: "Ingredient already exists", 
        ingredient: existing 
      });
    }
    
    const [ingredient] = await db.insert(ingredients).values({
      name: validatedData.name,
      category: validatedData.category,
      isAllergen: validatedData.isAllergen ?? false,
    }).returning();
    
    res.status(201).json(ingredient);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    logger.error(`Error creating ingredient: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Get translations for an ingredient
router.get("/api/ingredients/:ingredientId/translations", authenticate, async (req, res) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ message: "Invalid ingredient ID" });
    }
    
    const translations = await db.query.ingredientTranslations.findMany({
      where: eq(ingredientTranslations.ingredientId, ingredientId),
    });
    
    res.json(translations);
  } catch (error) {
    logger.error(`Error fetching ingredient translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

// Create or update translation for an ingredient
router.post("/api/ingredients/:ingredientId/translations", authenticate, async (req, res) => {
  try {
    const ingredientId = parseInt(req.params.ingredientId);
    if (isNaN(ingredientId)) {
      return res.status(400).json({ message: "Invalid ingredient ID" });
    }
    
    const { languageId, name } = req.body;
    
    if (!languageId || !name) {
      return res.status(400).json({ message: "languageId and name are required" });
    }
    
    // Check if translation already exists
    const existing = await db.query.ingredientTranslations.findFirst({
      where: eq(ingredientTranslations.ingredientId, ingredientId),
    });
    
    if (existing && existing.languageId === languageId) {
      // Update existing translation
      const [updated] = await db.update(ingredientTranslations)
        .set({ name, updatedAt: new Date() })
        .where(eq(ingredientTranslations.id, existing.id))
        .returning();
      return res.json(updated);
    }
    
    // Create new translation
    const [translation] = await db.insert(ingredientTranslations).values({
      ingredientId,
      languageId,
      name,
    }).returning();
    
    res.status(201).json(translation);
  } catch (error) {
    logger.error(`Error creating ingredient translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
