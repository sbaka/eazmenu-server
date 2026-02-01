import { Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import logger, { sanitizeError } from "./logger";
import {
  insertLanguageSchema,
  insertMenuItemTranslationSchema,
  insertCategoryTranslationSchema,
  menuItems,
  categories,
  languages,
  menuItemTranslations,
  categoryTranslations,
  ingredients,
  restaurants,
} from "@sbaka/shared";
import { db } from "@db";
import { eq, and, inArray } from "drizzle-orm";
import { translationService } from "./services/translation";

// Wrapper function to use the new translation service
async function translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
  try {
    const result = await translationService.translate({
      text,
      sourceLanguage,
      targetLanguage,
    });
    return result.translatedText;
  } catch (error) {
    logger.error(`Translation error: ${sanitizeError(error)}`);
    // Fallback in case of error - return original text
    return text;
  }
}

// Helper function to translate menu items
async function translateMenuItems(
  menuItemIds: number[],
  sourceLanguageId: number,
  targetLanguageId: number,
  sourceLanguage: any,
  targetLanguage: any
): Promise<any[]> {
  const results: any[] = [];
  
  for (const menuItemId of menuItemIds) {
    const menuItem = await db.query.menuItems.findFirst({
      where: eq(menuItems.id, menuItemId),
    });
    if (!menuItem) continue;

    const sourceTranslations = await storage.getMenuItemTranslations(menuItemId, sourceLanguageId);
    const sourceTranslation = sourceTranslations[0];

    const sourceName = sourceTranslation?.name || menuItem.name;
    const sourceDescription = sourceTranslation?.description || menuItem.description || '';

    const translatedName = await translateText(sourceName, sourceLanguage.code, targetLanguage.code);
    const translatedDescription = sourceDescription ?
      await translateText(sourceDescription, sourceLanguage.code, targetLanguage.code) :
      '';

    const existingTranslations = await storage.getMenuItemTranslations(menuItemId, targetLanguageId);
    
    if (existingTranslations.length > 0) {
      const updatedTranslation = await storage.updateMenuItemTranslation(existingTranslations[0].id, {
        name: translatedName,
        description: translatedDescription,
      });
      results.push(updatedTranslation);
    } else {
      const newTranslation = await storage.createMenuItemTranslation({
        menuItemId,
        languageId: targetLanguageId,
        name: translatedName,
        description: translatedDescription,
      });
      results.push(newTranslation);
    }
  }
  
  return results;
}

// Helper function to translate categories
async function translateCategories(
  categoryIds: number[],
  sourceLanguageId: number,
  targetLanguageId: number,
  sourceLanguage: any,
  targetLanguage: any
): Promise<any[]> {
  const results: any[] = [];
  
  for (const categoryId of categoryIds) {
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });
    if (!category) continue;

    const sourceTranslations = await storage.getCategoryTranslations(categoryId, sourceLanguageId);
    const sourceTranslation = sourceTranslations[0];

    const sourceName = sourceTranslation?.name || category.name;
    const translatedName = await translateText(sourceName, sourceLanguage.code, targetLanguage.code);

    const existingTranslations = await storage.getCategoryTranslations(categoryId, targetLanguageId);
    
    if (existingTranslations.length > 0) {
      const updatedTranslation = await storage.updateCategoryTranslation(existingTranslations[0].id, {
        name: translatedName,
      });
      results.push(updatedTranslation);
    } else {
      const newTranslation = await storage.createCategoryTranslation({
        categoryId,
        languageId: targetLanguageId,
        name: translatedName,
      });
      results.push(newTranslation);
    }
  }
  
  return results;
}

// Helper function to translate ingredients (global - not restaurant-specific)
async function translateIngredients(
  ingredientIds: number[],
  sourceLanguageId: number,
  targetLanguageId: number,
  sourceLanguage: any,
  targetLanguage: any
): Promise<any[]> {
  const results: any[] = [];
  
  for (const ingredientId of ingredientIds) {
    const ingredient = await db.query.ingredients.findFirst({
      where: eq(ingredients.id, ingredientId),
    });
    if (!ingredient) continue;

    // Check for existing source translation
    const sourceTranslations = await storage.getIngredientTranslations(ingredientId, sourceLanguageId);
    const sourceTranslation = sourceTranslations[0];

    // Use the source translation if available, otherwise use the base ingredient name
    const sourceName = sourceTranslation?.name || ingredient.name;
    const translatedName = await translateText(sourceName, sourceLanguage.code, targetLanguage.code);

    const existingTranslations = await storage.getIngredientTranslations(ingredientId, targetLanguageId);
    
    if (existingTranslations.length > 0) {
      const updatedTranslation = await storage.updateIngredientTranslation(existingTranslations[0].id, {
        name: translatedName,
      });
      results.push(updatedTranslation);
    } else {
      const newTranslation = await storage.createIngredientTranslation({
        ingredientId,
        languageId: targetLanguageId,
        name: translatedName,
      });
      results.push(newTranslation);
    }
  }
  
  return results;
}

// Route handler for creating a new language
export async function createLanguage(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get restaurantId from the URL params (validated by checkRestaurantOwnership middleware)
    const restaurantId = parseInt(req.params.restaurantId as string);

    const validatedData = insertLanguageSchema.parse({
      ...req.body,
      restaurantId,
    });

    const language = await storage.createLanguage(validatedData);
    res.status(201).json(language);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: (error as z.ZodError).issues });
    }
    logger.error(`Error creating language: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for getting restaurant's languages
export async function getLanguages(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get restaurantId from the URL params (validated by checkRestaurantOwnership middleware)
    const restaurantId = parseInt(req.params.restaurantId as string);

    const languages = await storage.getLanguagesByRestaurantId(restaurantId);
    res.status(200).json(languages);
  } catch (error) {
    logger.error(`Error fetching languages: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for updating a language
export async function updateLanguage(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get restaurantId from the URL params (validated by checkRestaurantOwnership middleware)
    const restaurantId = parseInt(req.params.restaurantId as string);
    const languageId = parseInt(req.params.id as string);
    if (isNaN(languageId)) {
      return res.status(400).json({ message: "Invalid language ID" });
    }

    // Additional validation: ensure the language belongs to this restaurant
    const existingLanguage = await db.query.languages.findFirst({
      where: and(eq(languages.id, languageId), eq(languages.restaurantId, restaurantId)),
    });

    if (!existingLanguage) {
      return res.status(404).json({ message: "Language not found or access denied" });
    }

    const language = await storage.updateLanguage(languageId, req.body);
    if (!language) {
      return res.status(404).json({ message: "Language not found" });
    }

    res.status(200).json(language);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: (error as z.ZodError).issues });
    }
    logger.error(`Error updating language: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for deleting a language
export async function deleteLanguage(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get restaurantId from the URL params (validated by checkRestaurantOwnership middleware)
    const restaurantId = parseInt(req.params.restaurantId as string);
    const languageId = parseInt(req.params.id as string);
    if (isNaN(languageId)) {
      return res.status(400).json({ message: "Invalid language ID" });
    }

    // Additional validation: ensure the language belongs to this restaurant
    const existingLanguage = await db.query.languages.findFirst({
      where: and(eq(languages.id, languageId), eq(languages.restaurantId, restaurantId)),
    });

    if (!existingLanguage) {
      return res.status(404).json({ message: "Language not found or access denied" });
    }

    const success = await storage.deleteLanguage(languageId);
    if (!success) {
      return res.status(404).json({ message: "Language not found or could not be deleted" });
    }

    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting language: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for creating a menu item translation
export async function createMenuItemTranslation(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = insertMenuItemTranslationSchema.parse(req.body);
    const translation = await storage.createMenuItemTranslation(validatedData);

    res.status(201).json(translation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: (error as z.ZodError).issues });
    }
    logger.error(`Error creating menu item translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for getting menu item translations
export async function getMenuItemTranslations(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const menuItemId = parseInt(req.params.menuItemId as string);
    if (isNaN(menuItemId)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }

    let languageId: number | undefined = undefined;
    if (req.query.languageId && typeof req.query.languageId === 'string') {
      languageId = parseInt(req.query.languageId);
      if (isNaN(languageId)) {
        return res.status(400).json({ message: "Invalid language ID" });
      }
    }

    const translations = await storage.getMenuItemTranslations(menuItemId, languageId);
    res.status(200).json(translations);
  } catch (error) {
    logger.error(`Error fetching menu item translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for creating a category translation
export async function createCategoryTranslation(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validatedData = insertCategoryTranslationSchema.parse(req.body);
    const translation = await storage.createCategoryTranslation(validatedData);

    res.status(201).json(translation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: (error as z.ZodError).issues });
    }
    logger.error(`Error creating category translation: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for getting category translations (PUBLIC - no auth required for reads)
export async function getCategoryTranslations(req: Request, res: Response) {
  try {
    const categoryId = parseInt(req.params.categoryId as string);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    let languageId: number | undefined = undefined;
    if (req.query.languageId && typeof req.query.languageId === 'string') {
      languageId = parseInt(req.query.languageId);
      if (isNaN(languageId)) {
        return res.status(400).json({ message: "Invalid language ID" });
      }
    }

    const translations = await storage.getCategoryTranslations(categoryId, languageId);
    res.status(200).json(translations);
  } catch (error) {
    logger.error(`Error fetching category translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for auto-translating content
export async function autoTranslate(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { restaurantId, sourceLanguageId, targetLanguageId, menuItemIds, categoryIds, ingredientIds } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    if (!sourceLanguageId || !targetLanguageId) {
      return res.status(400).json({ message: "Source and target language IDs are required" });
    }

    // Verify user owns the restaurant
    const restaurant = await db.query.restaurants.findFirst({
      where: and(eq(restaurants.id, restaurantId), eq(restaurants.merchantId, userId)),
    });

    if (!restaurant) {
      return res.status(403).json({ message: "Restaurant not found or access denied" });
    }

    // Get languages for the actual restaurant (FIX: was using userId instead of restaurantId)
    const restaurantLanguages = await storage.getLanguagesByRestaurantId(restaurantId);
    const sourceLanguage = restaurantLanguages.find((lang: any) => lang.id === sourceLanguageId);
    const targetLanguage = restaurantLanguages.find((lang: any) => lang.id === targetLanguageId);

    if (!sourceLanguage || !targetLanguage) {
      return res.status(400).json({ message: "Invalid source or target language for this restaurant" });
    }

    const results: {
      menuItems: any[],
      categories: any[],
      ingredients: any[]
    } = {
      menuItems: [],
      categories: [],
      ingredients: [],
    };

    // Translate menu items if provided
    if (menuItemIds && Array.isArray(menuItemIds) && menuItemIds.length > 0) {
      results.menuItems = await translateMenuItems(
        menuItemIds,
        sourceLanguageId,
        targetLanguageId,
        sourceLanguage,
        targetLanguage
      );
    }

    // Translate categories if provided
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      results.categories = await translateCategories(
        categoryIds,
        sourceLanguageId,
        targetLanguageId,
        sourceLanguage,
        targetLanguage
      );
    }

    // Translate ingredients if provided (global - not restaurant-specific)
    if (ingredientIds && Array.isArray(ingredientIds) && ingredientIds.length > 0) {
      results.ingredients = await translateIngredients(
        ingredientIds,
        sourceLanguageId,
        targetLanguageId,
        sourceLanguage,
        targetLanguage
      );
    }

    res.status(200).json(results);
  } catch (error) {
    logger.error(`Error auto-translating content: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}

// Route handler for getting all translations for a restaurant in a specific language
export async function getAllRestaurantTranslations(req: Request, res: Response) {
  try {
    // Get restaurantId from the URL params (validated by checkRestaurantOwnership middleware)
    const restaurantId = parseInt(req.params.restaurantId as string);

    // Get language code from query parameter
    const langCode = req.query.lang as string;
    if (!langCode) {
      return res.status(400).json({ message: "Language code is required" });
    }

    // Get the language ID from the language code
    const language = await db.query.languages.findFirst({
      where: and(
        eq(languages.restaurantId, restaurantId),
        eq(languages.code, langCode.toLowerCase())
      ),
    });

    if (!language) {
      return res.status(404).json({ message: "Language not found" });
    }

    // Get all menu items for this restaurant
    const restaurantMenuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
    const menuItemIds = restaurantMenuItems.map((item: any) => item.id);

    // Get all categories for this restaurant
    const restaurantCategories = await storage.getCategoriesByRestaurantId(restaurantId);
    const categoryIds = restaurantCategories.map((category: any) => category.id);

    // Get all translations for menu items
    const menuItemTranslationsResult = await db.query.menuItemTranslations.findMany({
      where: and(
        eq(menuItemTranslations.languageId, language.id),
        // Use inArray operator for menu item IDs
        inArray(menuItemTranslations.menuItemId, menuItemIds)
      ),
    });

    // Get all translations for categories
    const categoryTranslationsResult = await db.query.categoryTranslations.findMany({
      where: and(
        eq(categoryTranslations.languageId, language.id),
        // Use inArray operator for category IDs
        inArray(categoryTranslations.categoryId, categoryIds)
      ),
    });

    // Return all translations
    res.status(200).json({
      language: language,
      menuItemTranslations: menuItemTranslationsResult,
      categoryTranslations: categoryTranslationsResult,
    });
  } catch (error) {
    logger.error(`Error fetching all translations: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
}
