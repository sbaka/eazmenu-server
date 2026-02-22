-- Migration: Add language preference to merchants
-- Date: 2026-02-21
-- Description: Adds a 'language' column to the merchants table for persisting
--              the admin UI language preference per user account.

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Backfill existing rows
UPDATE merchants SET language = 'en' WHERE language IS NULL;
