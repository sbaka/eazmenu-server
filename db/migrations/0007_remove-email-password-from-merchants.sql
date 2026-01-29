-- Migration: Remove email and password columns from merchants table
-- These fields are now handled entirely by Supabase authentication
-- Date: 2026-01-24

-- Drop unique constraint on email if it exists
ALTER TABLE "merchants" DROP CONSTRAINT IF EXISTS "merchants_email_unique";

-- Drop the email column
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "email";

-- Drop the password column
ALTER TABLE "merchants" DROP COLUMN IF EXISTS "password";

-- Make supabase_user_id required (NOT NULL) since it's now the only auth method
-- First update any NULL values (shouldn't exist, but just in case)
-- Then add the NOT NULL constraint
ALTER TABLE "merchants" ALTER COLUMN "supabase_user_id" SET NOT NULL;
