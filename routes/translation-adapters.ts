import { Router } from "express";
import { Request, Response } from "express";
import { authenticate } from "../middleware";
import { translationService } from "../services/translation";
import logger, { sanitizeError } from "../logger";

const router = Router();

/**
 * Get available translation adapters
 */
router.get("/api/translation/adapters", authenticate, async (_req: Request, res: Response) => {
  try {
    const adapters = translationService.getAvailableAdapters();
    const defaultAdapter = translationService.getDefaultAdapter();
    
    // Check availability of each adapter
    const adaptersWithStatus = await Promise.all(
      adapters.map(async (name) => {
        const isAvailable = await translationService.isAdapterAvailable(name);
        return {
          name,
          isAvailable,
          isDefault: name === defaultAdapter,
        };
      })
    );

    res.json({
      adapters: adaptersWithStatus,
      defaultAdapter,
    });
  } catch (error) {
    logger.error(`Error fetching translation adapters: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Get supported languages for a specific adapter
 */
router.get("/api/translation/adapters/:adapterName/languages", authenticate, async (req: Request, res: Response) => {
  try {
    const adapterName = req.params.adapterName as string;
    
    const availableAdapters = translationService.getAvailableAdapters();
    if (!availableAdapters.includes(adapterName)) {
      return res.status(404).json({ message: "Translation adapter not found" });
    }

    const languages = await translationService.getSupportedLanguages(adapterName);
    res.json({ languages });
  } catch (error) {
    logger.error(`Error fetching supported languages: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Set default translation adapter
 */
router.put("/api/translation/adapters/default", authenticate, async (req: Request, res: Response) => {
  try {
    const { adapterName } = req.body;
    
    if (!adapterName) {
      return res.status(400).json({ message: "Adapter name is required" });
    }

    const availableAdapters = translationService.getAvailableAdapters();
    if (!availableAdapters.includes(adapterName)) {
      return res.status(404).json({ message: "Translation adapter not found" });
    }

    translationService.setDefaultAdapter(adapterName);
    
    res.json({ 
      message: "Default adapter updated successfully",
      defaultAdapter: adapterName 
    });
  } catch (error) {
    logger.error(`Error setting default adapter: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Test translation with a specific adapter
 */
router.post("/api/translation/adapters/:adapterName/test", authenticate, async (req: Request, res: Response) => {
  try {
    const adapterName = req.params.adapterName as string;
    const { text, sourceLanguage, targetLanguage } = req.body;
    
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: "Text and target language are required" });
    }

    const availableAdapters = translationService.getAvailableAdapters();
    if (!availableAdapters.includes(adapterName)) {
      return res.status(404).json({ message: "Translation adapter not found" });
    }

    const result = await translationService.translateWithAdapter({
      text,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
    }, adapterName);

    res.json({
      result,
      adapter: adapterName,
    });
  } catch (error) {
    logger.error(`Error testing translation adapter: ${sanitizeError(error)}`);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;