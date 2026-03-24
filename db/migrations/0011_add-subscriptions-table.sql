-- Migration: Add subscriptions table for Stripe plan management
-- Date: 2026-03-24
-- Description: Creates the subscriptions table to track merchant subscription plans,
--              trial periods, and Stripe billing integration.

-- Create subscription status enum
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  merchant_id INTEGER NOT NULL UNIQUE REFERENCES merchants(id),
  plan_id TEXT NOT NULL DEFAULT 'starter',
  status subscription_status NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  trial_ends_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS subscriptions_merchant_idx ON subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx ON subscriptions(stripe_subscription_id);

-- Backfill: Create trial subscriptions for existing merchants
INSERT INTO subscriptions (merchant_id, plan_id, status, trial_ends_at)
SELECT id, 'starter', 'trialing', NOW() + INTERVAL '14 days'
FROM merchants
WHERE id NOT IN (SELECT merchant_id FROM subscriptions)
ON CONFLICT (merchant_id) DO NOTHING;
