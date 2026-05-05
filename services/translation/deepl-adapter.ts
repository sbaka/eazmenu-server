import fetch from "node-fetch";
import * as https from "https";
import logger, { sanitizeError } from "../../logger";
import {
  TranslationAdapter,
  TranslationAdapterConfig,
  TranslationError,
  TranslationRequest,
  TranslationResponse,
} from "./translation-adapter.interface";

const REQUEST_INTERVAL_MS = 250;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export class DeepLAdapter implements TranslationAdapter {
  private readonly httpsAgent: https.Agent;
  private readonly cache = new Map<string, TranslationResponse>();

  // Simple serial queue: each API call waits for the previous one + a minimum interval
  private lastRequestTime = 0;
  private requestQueue: Promise<void> = Promise.resolve();

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

      const response = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          text: ['test'],
          target_lang: 'EN',
        }),
        agent: this.httpsAgent,
      });

      return response.ok || response.status === 400;
    } catch (error) {
      logger.error(`DeepL availability check failed: ${sanitizeError(error)}`);
      return false;
    }
  }

  async getSupportedLanguages(): Promise<string[]> {
    return [
      'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR',
      'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL',
      'PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH', 'AR',
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

    // Separate cached / empty from those that need API calls
    const output: (TranslationResponse | null)[] = new Array(requests.length).fill(null);
    const pendingIndices: number[] = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];

      if (!request.text || request.text.trim() === '') {
        output[i] = { translatedText: '' };
        continue;
      }

      if (this.config.cacheEnabled) {
        const cached = this.cache.get(this.getCacheKey(request));
        if (cached) {
          output[i] = cached;
          continue;
        }
      }

      pendingIndices.push(i);
    }

    // Group pending requests by language pair so we can batch texts in one API call
    const groups = new Map<string, number[]>();
    for (const idx of pendingIndices) {
      const r = requests[idx];
      const key = `${r.sourceLanguage}||${r.targetLanguage}`;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(idx);
    }

    // Process each language-pair group as a single DeepL batch call (max 50 texts per call)
    const BATCH_SIZE = 50;
    for (const [, indices] of groups) {
      for (let start = 0; start < indices.length; start += BATCH_SIZE) {
        const chunk = indices.slice(start, start + BATCH_SIZE);
        const texts = chunk.map((i) => requests[i].text);
        const sample = requests[chunk[0]];

        try {
          const data = await this.enqueueApiRequest(
            texts,
            sample.sourceLanguage,
            sample.targetLanguage
          );

          const translations: any[] = data.translations ?? [];
          for (let j = 0; j < chunk.length; j++) {
            const result: TranslationResponse = {
              translatedText: translations[j]?.text ?? requests[chunk[j]].text,
              detectedSourceLanguage: translations[j]?.detected_source_language,
            };

            if (this.config.cacheEnabled) {
              this.cache.set(this.getCacheKey(requests[chunk[j]]), result);
            }
            output[chunk[j]] = result;
          }
        } catch (error) {
          if (error instanceof TranslationError) {
            throw error;
          }
          logger.error(`DeepL translation error: ${sanitizeError(error)}`);
          // Fallback for the whole chunk
          for (const idx of chunk) {
            output[idx] = {
              translatedText: requests[idx].text,
              detectedSourceLanguage: requests[idx].sourceLanguage,
            };
          }
        }
      }
    }

    return output as TranslationResponse[];
  }

  // --------------- rate-limited request queue ---------------

  /**
   * Enqueue an API request through the serial queue so we never exceed the rate limit.
   * Retries with exponential backoff on 429 responses.
   */
  private enqueueApiRequest(
    texts: string[],
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<any> {
    const task = this.requestQueue.then(() => this.throttledRequest(texts, sourceLanguage, targetLanguage));
    // Update the queue tail (swallow errors so the queue keeps running)
    this.requestQueue = task.then(() => { }, () => { });
    return task;
  }

  private async throttledRequest(
    texts: string[],
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<any> {
    // Enforce minimum interval between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < REQUEST_INTERVAL_MS) {
      await this.sleep(REQUEST_INTERVAL_MS - elapsed);
    }

    try {
      return await this.makeApiRequestWithRetry(texts, sourceLanguage, targetLanguage);
    } finally {
      this.lastRequestTime = Date.now();
    }
  }

  private async makeApiRequestWithRetry(
    texts: string[],
    sourceLanguage: string,
    targetLanguage: string,
    attempt = 0
  ): Promise<any> {
    const deeplSourceLang = this.mapLanguageCode(sourceLanguage);
    const deeplTargetLang = this.mapLanguageCode(targetLanguage);

    const body: Record<string, any> = {
      text: texts,
      target_lang: deeplTargetLang,
    };
    if (deeplSourceLang !== 'AUTO') {
      body.source_lang = deeplSourceLang;
    }

    const response = await fetch(this.getApiUrl(), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      agent: this.httpsAgent,
    });

    if (response.status === 429 || response.status === 529) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        const delay = retryAfter > 0
          ? retryAfter * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        logger.warn(`DeepL rate limited (${response.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await this.sleep(delay);
        return this.makeApiRequestWithRetry(texts, sourceLanguage, targetLanguage, attempt + 1);
      }
      throw new TranslationError(
        `DeepL API rate limit exceeded after ${MAX_RETRIES} retries`,
        'RATE_LIMITED',
        { status: response.status }
      );
    }

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

  // --------------- helpers ---------------

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
    if (language === 'auto') {
      return 'AUTO';
    }
    return language.toUpperCase();
  }

  private getCacheKey(request: TranslationRequest): string {
    return `${request.sourceLanguage}:${request.targetLanguage}:${request.text}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}