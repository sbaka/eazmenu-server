-- Migration: Add profile fields to merchants table
-- These fields are synced from Supabase user metadata on login

ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'email';
