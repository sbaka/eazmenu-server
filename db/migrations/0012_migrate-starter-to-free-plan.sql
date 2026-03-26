-- Migration: Rename starter plan to free plan (3-tier model)
-- Date: 2026-03-24
-- Description: Migrates existing 'starter' plan subscriptions to 'free' plan
--              and updates defaults as part of the Free/Essentiel/Pro model migration.

-- Rename existing 'starter' plan subscriptions to 'free'
UPDATE subscriptions SET plan_id = 'free' WHERE plan_id = 'starter';

-- Update default for plan_id column
ALTER TABLE subscriptions ALTER COLUMN plan_id SET DEFAULT 'free';

-- Update existing 'trialing' starter subscriptions to 'active' free
-- (Free plan has no trial — it's permanently active)
UPDATE subscriptions
SET status = 'active', trial_ends_at = NULL
WHERE plan_id = 'free' AND status = 'trialing';
