import logger from "../../logger";
import {
  TranslationAdapter,
  TranslationRequest,
  TranslationResponse,
  TranslationError,
} from "./translation-adapter.interface";
import { DeepLAdapter } from "./deepl-adapter";

/**
 * Central translation service that manages multiple translation adapters
 * and provides a unified interface for the application
 */
export class TranslationService {
  private adapters: Map<string, TranslationAdapter> = new Map();
  private defaultAdapter: string | null = null;

  constructor() {
    this.initializeAdapters();
  }

  /**
   * Initialize available translation adapters
   */
  private initializeAdapters(): void {
    // Initialize DeepL adapter if API key is available
    const deeplApiKey = process.env.DEEPL_API_KEY;
    if (deeplApiKey) {
      const deeplAdapter = new DeepLAdapter({
        apiKey: deeplApiKey,
        timeout: 30000,
        retryAttempts: 3,
        cacheEnabled: true,
      });
      
      this.adapters.set('deepl', deeplAdapter);
      
      // Set DeepL as default if no other default is set
      if (!this.defaultAdapter) {
        this.defaultAdapter = 'deepl';
      }
    }

    // Future adapters can be added here:
    // - Google Translate
    // - Azure Translator
    // - Amazon Translate
    // etc.
  }

  /**
   * Register a new translation adapter
   */
  registerAdapter(name: string, adapter: TranslationAdapter): void {
    this.adapters.set(name, adapter);
    
    // Set as default if no default exists
    if (!this.defaultAdapter) {
      this.defaultAdapter = name;
    }
    
    logger.info(`Translation adapter '${name}' registered`);
  }

  /**
   * Set the default translation adapter
   */
  setDefaultAdapter(name: string): void {
    if (!this.adapters.has(name)) {
      throw new TranslationError(`Adapter '${name}' is not registered`, 'ADAPTER_NOT_FOUND');
    }
    
    this.defaultAdapter = name;
    logger.info(`Default translation adapter set to '${name}'`);
  }

  /**
   * Get available adapter names
   */
  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a specific adapter is available
   */
  async isAdapterAvailable(name: string): Promise<boolean> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      return false;
    }
    
    return await adapter.isAvailable();
  }

  /**
   * Translate text using the default adapter
   */
  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    return this.translateWithAdapter(request, this.defaultAdapter);
  }

  /**
   * Translate text using a specific adapter
   */
  async translateWithAdapter(
    request: TranslationRequest, 
    adapterName: string | null = null
  ): Promise<TranslationResponse> {
    const name = adapterName || this.defaultAdapter;
    
    if (!name) {
      throw new TranslationError('No translation adapter available', 'NO_ADAPTER');
    }

    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new TranslationError(`Adapter '${name}' not found`, 'ADAPTER_NOT_FOUND');
    }

    try {
      logger.debug(`Translating with adapter '${name}': ${request.sourceLanguage} -> ${request.targetLanguage}`);
      return await adapter.translate(request);
    } catch (error) {
      logger.error(`Translation failed with adapter '${name}': ${error}`);
      
      // Try fallback to other adapters if available
      if (this.adapters.size > 1) {
        const otherAdapters = Array.from(this.adapters.keys()).filter(key => key !== name);
        
        for (const fallbackName of otherAdapters) {
          try {
            logger.info(`Trying fallback adapter '${fallbackName}'`);
            const fallbackAdapter = this.adapters.get(fallbackName)!;
            return await fallbackAdapter.translate(request);
          } catch (fallbackError) {
            logger.warn(`Fallback adapter '${fallbackName}' also failed: ${fallbackError}`);
          }
        }
      }
      
      // If all adapters fail, return original text
      logger.warn('All translation adapters failed, returning original text');
      return {
        translatedText: request.text,
        detectedSourceLanguage: request.sourceLanguage,
      };
    }
  }

  /**
   * Translate multiple texts in batch
   */
  async translateBatch(
    requests: TranslationRequest[], 
    adapterName: string | null = null
  ): Promise<TranslationResponse[]> {
    const name = adapterName || this.defaultAdapter;
    
    if (!name) {
      throw new TranslationError('No translation adapter available', 'NO_ADAPTER');
    }

    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new TranslationError(`Adapter '${name}' not found`, 'ADAPTER_NOT_FOUND');
    }

    try {
      return await adapter.translateBatch(requests);
    } catch (error) {
      logger.error(`Batch translation failed with adapter '${name}': ${error}`);
      
      // Fallback to individual translations
      const results: TranslationResponse[] = [];
      for (const request of requests) {
        try {
          const result = await this.translateWithAdapter(request, name);
          results.push(result);
        } catch (individualError) {
          logger.warn(`Individual translation failed: ${individualError}`);
          results.push({
            translatedText: request.text,
            detectedSourceLanguage: request.sourceLanguage,
          });
        }
      }
      
      return results;
    }
  }

  /**
   * Get supported languages for a specific adapter
   */
  async getSupportedLanguages(adapterName: string | null = null): Promise<string[]> {
    const name = adapterName || this.defaultAdapter;
    
    if (!name) {
      throw new TranslationError('No translation adapter available', 'NO_ADAPTER');
    }

    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new TranslationError(`Adapter '${name}' not found`, 'ADAPTER_NOT_FOUND');
    }

    return await adapter.getSupportedLanguages();
  }

  /**
   * Get the current default adapter name
   */
  getDefaultAdapter(): string | null {
    return this.defaultAdapter;
  }
}

// Export singleton instance
export const translationService = new TranslationService();