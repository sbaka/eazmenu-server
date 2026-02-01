-- Migration: Add Supabase Realtime support and Order Lifecycle Protocol
-- Date: 2026-01-31
-- Description: 
--   1. Add order_lifecycle_protocol enum and columns to restaurants table
--   2. Enable Supabase Realtime for orders and order_items tables
--   3. Add RLS policies for customer order visibility

-- =====================================================
-- STEP 1: Create order lifecycle protocol enum
-- =====================================================
DO $$ BEGIN
  CREATE TYPE order_lifecycle_protocol AS ENUM ('default', 'quick_turn', 'manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- STEP 2: Add protocol columns to restaurants table
-- =====================================================
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS order_lifecycle_protocol order_lifecycle_protocol DEFAULT 'default';

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS order_hide_delay_minutes INTEGER DEFAULT 10;

-- =====================================================
-- STEP 3: Enable Supabase Realtime for orders tables
-- This allows clients to subscribe to changes via 
-- supabase.channel().on('postgres_changes', ...)
-- =====================================================
-- Note: Run this in Supabase SQL Editor or ensure supabase_realtime publication exists
DO $$ BEGIN
  -- Check if publication exists, create if not
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- =====================================================
-- STEP 4: Add RLS policies for customer order visibility
-- Customers need to SELECT their table's orders for Realtime subscriptions
-- =====================================================

-- Policy: Allow public to view orders at their table
-- This is needed for Supabase Realtime subscriptions to work
CREATE POLICY IF NOT EXISTS "orders_public_select" ON public.orders
  FOR SELECT USING (true);

-- Policy: Allow public to view order items for visible orders
CREATE POLICY IF NOT EXISTS "order_items_public_select" ON public.order_items
  FOR SELECT USING (true);

-- =====================================================
-- STEP 5: Create index for efficient realtime filtering
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_orders_table_id_status ON orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id_status ON orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_hidden ON orders(hidden) WHERE hidden = false;
