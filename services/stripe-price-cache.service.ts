import { LOOKUP_KEY_TO_PLAN } from '@sbaka/shared';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StripePriceInfo {
  priceId:    string;
  /** Amount in cents (e.g. 2900 = €29.00) */
  unitAmount: number;
  currency:   string;
  interval:   'month' | 'year';
  trialDays:  number | null;
}

// ─── Lazy Stripe instance ───────────────────────────────────────────────────────

let stripe: any = null;

async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = await import('stripe');
    stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

// ─── TTL cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cache: Map<string, StripePriceInfo> | null = null;
let fetchedAt = 0;

const LOOKUP_KEYS = Object.keys(LOOKUP_KEY_TO_PLAN);

/**
 * Returns a map of lookup_key → StripePriceInfo, cached for 1 hour.
 *
 * Stripe is the single source of truth for all billing details
 * (amount, currency, interval, trial). Nothing is hardcoded here.
 */
export async function getStripePrices(): Promise<Map<string, StripePriceInfo>> {
  if (cache && Date.now() - fetchedAt < CACHE_TTL_MS) return cache;

  const stripeInstance = await getStripe();
  if (!stripeInstance) return new Map(); // Stripe not configured

  const { data } = await stripeInstance.prices.list({
    lookup_keys: LOOKUP_KEYS,
    active: true,
    limit: LOOKUP_KEYS.length + 5,
  });

  cache = new Map<string, StripePriceInfo>(
    (data as any[])
      .filter((p) => p.lookup_key && p.unit_amount !== null)
      .map((p) => [
        p.lookup_key as string,
        {
          priceId:    p.id,
          unitAmount: p.unit_amount as number,
          currency:   p.currency,
          interval:   p.recurring?.interval as 'month' | 'year',
          trialDays:  p.recurring?.trial_period_days ?? null,
        },
      ])
  );

  fetchedAt = Date.now();
  return cache;
}

/**
 * Look up a single price by its Stripe lookup_key.
 */
export async function getPriceByLookupKey(key: string): Promise<StripePriceInfo | undefined> {
  const prices = await getStripePrices();
  return prices.get(key);
}

/**
 * Invalidate the cache — call this after updating prices in Stripe.
 */
export function invalidateStripePriceCache(): void {
  cache = null;
  fetchedAt = 0;
}
