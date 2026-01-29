import fetch from "node-fetch";
import * as https from "https";
import logger, { sanitizeError } from "../../logger";
import {
  TranslationAdapter,
  TranslationRequest,
  TranslationResponse,
  TranslationAdapterConfig,
  TranslationError,
} from "./translation-adapter.interface";

/**
 * DeepL translation adapter implementation
 */
export class DeepLAdapter implements TranslationAdapter {
  private httpsAgent: https.Agent;
  private cache: Map<string, TranslationResponse> = new Map();

  constructor(private config: TranslationAdapterConfig) {
    this.httpsAgent = new https.Agent({ 
      keepAlive: true,
      timeout: config.timeout || 30000,
    });
  }

  getAdapterName(): string {
    return "DeepL";
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        return false;
      }

      // Test the API with a simple request
      const response = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          text: ['test'],
          target_lang: 'EN',
        }),
        agent: this.httpsAgent,
      });

      return response.ok || response.status === 400; // 400 is also ok, means API is responding
    } catch (error) {
      logger.error(`DeepL availability check failed: ${sanitizeError(error)}`);
      return false;
    }
  }

  async getSupportedLanguages(): Promise<string[]> {
    // DeepL supported languages (as of 2024)
    return [
      'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR',
      'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL',
      'PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH'
    ];
  }

  async translate(request: TranslationRequest): Promise<TranslationResponse> {
    const results = await this.translateBatch([request]);
    return results[0];
  }

  async translateBatch(requests: TranslationRequest[]): Promise<TranslationResponse[]> {
    if (!this.config.apiKey) {
      throw new TranslationError(
        'DeepL API key is not configured',
        'MISSING_API_KEY'
      );
    }

    const results: TranslationResponse[] = [];

    for (const request of requests) {
      try {
        // Check cache first if enabled
        if (this.config.cacheEnabled) {
          const cacheKey = this.getCacheKey(request);
          const cached = this.cache.get(cacheKey);
          if (cached) {
            results.push(cached);
            continue;
          }
        }

        // Don't translate empty strings
        if (!request.text || request.text.trim() === '') {
          results.push({ translatedText: '' });
          continue;
        }

        const response = await this.makeApiRequest(request);
        const result = this.parseApiResponse(response);

        // Cache the result if caching is enabled
        if (this.config.cacheEnabled) {
          const cacheKey = this.getCacheKey(request);
          this.cache.set(cacheKey, result);
        }

        results.push(result);
      } catch (error) {
        if (error instanceof TranslationError) {
          throw error;
        }
        
        logger.error(`DeepL translation error: ${sanitizeError(error)}`);
        
        // Fallback: return original text
        results.push({ 
          translatedText: request.text,
          detectedSourceLanguage: request.sourceLanguage 
        });
      }
    }

    return results;
  }

  private async makeApiRequest(request: TranslationRequest): Promise<any> {
    const deeplSourceLang = this.mapLanguageCode(request.sourceLanguage);
    const deeplTargetLang = this.mapLanguageCode(request.targetLanguage);

    const body = {
      text: [request.text],
      source_lang: deeplSourceLang === 'AUTO' ? null : deeplSourceLang,
      target_lang: deeplTargetLang,
    };

    const response = await fetch(this.getApiUrl(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      agent: this.httpsAgent,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TranslationError(
        `DeepL API error: ${response.status} ${errorText}`,
        'API_ERROR',
        { status: response.status, body: errorText }
      );
    }

    return await response.json();
  }

  private parseApiResponse(data: any): TranslationResponse {
    if (!data.translations || !Array.isArray(data.translations) || data.translations.length === 0) {
      throw new TranslationError(
        'Invalid response format from DeepL API',
        'INVALID_RESPONSE',
        data
      );
    }

    const translation = data.translations[0];
    return {
      translatedText: translation.text,
      detectedSourceLanguage: translation.detected_source_language,
    };
  }

  private getApiUrl(): string {
    return this.config.endpoint || 'https://api-free.deepl.com/v2/translate';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `DeepL-Auth-Key ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private mapLanguageCode(language: string): string {
    // Handle auto-detection
    if (language === 'auto') {
      return 'AUTO';
    }
    
    // DeepL uses uppercase language codes
    return language.toUpperCase();
  }

  private getCacheKey(request: TranslationRequest): string {
    return `${request.sourceLanguage}:${request.targetLanguage}:${request.text}`;
  }
}