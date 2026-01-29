/**
 * Translation adapter interface for abstracting translation services
 * This interface allows switching between different translation providers (DeepL, Google Translate, etc.)
 */

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedSourceLanguage?: string;
  confidence?: number;
}

export interface TranslationAdapter {
  /**
   * Translate a single text from source language to target language
   */
  translate(request: TranslationRequest): Promise<TranslationResponse>;

  /**
   * Translate multiple texts in batch (more efficient for some providers)
   */
  translateBatch(requests: TranslationRequest[]): Promise<TranslationResponse[]>;

  /**
   * Check if the translation service is available and configured
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get supported languages by this translation provider
   */
  getSupportedLanguages(): Promise<string[]>;

  /**
   * Get the name/identifier of this translation adapter
   */
  getAdapterName(): string;
}

export interface TranslationAdapterConfig {
  apiKey?: string;
  endpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  cacheEnabled?: boolean;
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}