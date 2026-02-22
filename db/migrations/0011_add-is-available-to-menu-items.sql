-- Migration: Add is_available flag to menu_items
-- Date: 2026-02-22
-- Description: Adds an 'is_available' boolean column to menu_items.
--              When false, the item remains visible to customers but is
--              shown as out of stock / unavailable for ordering.

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- Backfill existing rows
UPDATE menu_items SET is_available = true WHERE is_available IS NULL;
