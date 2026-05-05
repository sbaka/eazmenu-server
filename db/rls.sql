-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR EAZMENU
-- Run this in Supabase SQL Editor or through the server migration wrapper
-- Idempotent: safe to re-run at any time
-- =====================================================

-- First, enable RLS on all tables
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTION: Get merchant_id from auth.uid()
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_merchant_id()
RETURNS integer AS $$
  SELECT id FROM public.merchants WHERE supabase_user_id = auth.uid()::text
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- =====================================================
-- HELPER FUNCTION: Get restaurant_ids owned by current user
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_restaurant_ids()
RETURNS SETOF integer AS $$
  SELECT r.id 
  FROM public.restaurants r
  INNER JOIN public.merchants m ON r.merchant_id = m.id
  WHERE m.supabase_user_id = auth.uid()::text
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- =====================================================
-- MERCHANTS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "merchants_select_own" ON public.merchants;
DROP POLICY IF EXISTS "merchants_insert_own" ON public.merchants;
DROP POLICY IF EXISTS "merchants_update_own" ON public.merchants;
DROP POLICY IF EXISTS "merchants_delete_own" ON public.merchants;

CREATE POLICY "merchants_select_own" ON public.merchants
  FOR SELECT USING (supabase_user_id = auth.uid()::text);

CREATE POLICY "merchants_insert_own" ON public.merchants
  FOR INSERT WITH CHECK (supabase_user_id = auth.uid()::text);

CREATE POLICY "merchants_update_own" ON public.merchants
  FOR UPDATE USING (supabase_user_id = auth.uid()::text);

CREATE POLICY "merchants_delete_own" ON public.merchants
  FOR DELETE USING (supabase_user_id = auth.uid()::text);

-- =====================================================
-- RESTAURANTS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "restaurants_select_own" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_insert_own" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_update_own" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_delete_own" ON public.restaurants;
DROP POLICY IF EXISTS "restaurants_public_select" ON public.restaurants;

CREATE POLICY "restaurants_select_own" ON public.restaurants
  FOR SELECT USING (merchant_id = public.get_merchant_id());

CREATE POLICY "restaurants_insert_own" ON public.restaurants
  FOR INSERT WITH CHECK (merchant_id = public.get_merchant_id());

CREATE POLICY "restaurants_update_own" ON public.restaurants
  FOR UPDATE USING (merchant_id = public.get_merchant_id());

CREATE POLICY "restaurants_delete_own" ON public.restaurants
  FOR DELETE USING (merchant_id = public.get_merchant_id());

-- =====================================================
-- CATEGORIES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
DROP POLICY IF EXISTS "categories_public_select" ON public.categories;

CREATE POLICY "categories_select_own" ON public.categories
  FOR SELECT USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "categories_insert_own" ON public.categories
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

-- =====================================================
-- CATEGORY TRANSLATIONS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "category_translations_select_own" ON public.category_translations;
DROP POLICY IF EXISTS "category_translations_insert_own" ON public.category_translations;
DROP POLICY IF EXISTS "category_translations_update_own" ON public.category_translations;
DROP POLICY IF EXISTS "category_translations_delete_own" ON public.category_translations;
DROP POLICY IF EXISTS "category_translations_public_select" ON public.category_translations;

CREATE POLICY "category_translations_select_own" ON public.category_translations
  FOR SELECT USING (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "category_translations_insert_own" ON public.category_translations
  FOR INSERT WITH CHECK (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "category_translations_update_own" ON public.category_translations
  FOR UPDATE USING (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "category_translations_delete_own" ON public.category_translations
  FOR DELETE USING (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

-- =====================================================
-- MENU ITEMS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "menu_items_select_own" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_insert_own" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_update_own" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_delete_own" ON public.menu_items;
DROP POLICY IF EXISTS "menu_items_public_select" ON public.menu_items;

CREATE POLICY "menu_items_select_own" ON public.menu_items
  FOR SELECT USING (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_items_insert_own" ON public.menu_items
  FOR INSERT WITH CHECK (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_items_update_own" ON public.menu_items
  FOR UPDATE USING (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_items_delete_own" ON public.menu_items
  FOR DELETE USING (
    category_id IN (
      SELECT c.id FROM public.categories c 
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

-- =====================================================
-- MENU ITEM TRANSLATIONS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "menu_item_translations_select_own" ON public.menu_item_translations;
DROP POLICY IF EXISTS "menu_item_translations_insert_own" ON public.menu_item_translations;
DROP POLICY IF EXISTS "menu_item_translations_update_own" ON public.menu_item_translations;
DROP POLICY IF EXISTS "menu_item_translations_delete_own" ON public.menu_item_translations;
DROP POLICY IF EXISTS "menu_item_translations_public_select" ON public.menu_item_translations;

CREATE POLICY "menu_item_translations_select_own" ON public.menu_item_translations
  FOR SELECT USING (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_item_translations_insert_own" ON public.menu_item_translations
  FOR INSERT WITH CHECK (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_item_translations_update_own" ON public.menu_item_translations
  FOR UPDATE USING (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_item_translations_delete_own" ON public.menu_item_translations
  FOR DELETE USING (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

-- =====================================================
-- MENU ITEM INGREDIENTS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "menu_item_ingredients_select_own" ON public.menu_item_ingredients;
DROP POLICY IF EXISTS "menu_item_ingredients_insert_own" ON public.menu_item_ingredients;
DROP POLICY IF EXISTS "menu_item_ingredients_update_own" ON public.menu_item_ingredients;
DROP POLICY IF EXISTS "menu_item_ingredients_delete_own" ON public.menu_item_ingredients;

CREATE POLICY "menu_item_ingredients_select_own" ON public.menu_item_ingredients
  FOR SELECT USING (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_item_ingredients_insert_own" ON public.menu_item_ingredients
  FOR INSERT WITH CHECK (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_item_ingredients_update_own" ON public.menu_item_ingredients
  FOR UPDATE USING (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "menu_item_ingredients_delete_own" ON public.menu_item_ingredients
  FOR DELETE USING (
    menu_item_id IN (
      SELECT mi.id FROM public.menu_items mi
      INNER JOIN public.categories c ON mi.category_id = c.id
      WHERE c.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

-- =====================================================
-- MENU ITEM EVENTS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "menu_item_events_select_own" ON public.menu_item_events;
DROP POLICY IF EXISTS "menu_item_events_insert_own" ON public.menu_item_events;
DROP POLICY IF EXISTS "menu_item_events_update_own" ON public.menu_item_events;
DROP POLICY IF EXISTS "menu_item_events_delete_own" ON public.menu_item_events;
DROP POLICY IF EXISTS "menu_item_events_public_insert" ON public.menu_item_events;

CREATE POLICY "menu_item_events_select_own" ON public.menu_item_events
  FOR SELECT USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "menu_item_events_insert_own" ON public.menu_item_events
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "menu_item_events_update_own" ON public.menu_item_events
  FOR UPDATE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "menu_item_events_delete_own" ON public.menu_item_events
  FOR DELETE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

-- =====================================================
-- INGREDIENTS TABLE POLICIES (shared across all users)
-- =====================================================
DROP POLICY IF EXISTS "ingredients_select_all" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_insert_authenticated" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_update_authenticated" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients_delete_authenticated" ON public.ingredients;

CREATE POLICY "ingredients_select_all" ON public.ingredients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ingredients_insert_authenticated" ON public.ingredients
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ingredients_update_authenticated" ON public.ingredients
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "ingredients_delete_authenticated" ON public.ingredients
  FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================
-- INGREDIENT TRANSLATIONS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "ingredient_translations_select_all" ON public.ingredient_translations;
DROP POLICY IF EXISTS "ingredient_translations_insert_authenticated" ON public.ingredient_translations;
DROP POLICY IF EXISTS "ingredient_translations_update_authenticated" ON public.ingredient_translations;
DROP POLICY IF EXISTS "ingredient_translations_delete_authenticated" ON public.ingredient_translations;

CREATE POLICY "ingredient_translations_select_all" ON public.ingredient_translations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ingredient_translations_insert_authenticated" ON public.ingredient_translations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ingredient_translations_update_authenticated" ON public.ingredient_translations
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "ingredient_translations_delete_authenticated" ON public.ingredient_translations
  FOR DELETE USING (auth.role() = 'authenticated');

-- =====================================================
-- LANGUAGES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "languages_select_own" ON public.languages;
DROP POLICY IF EXISTS "languages_insert_own" ON public.languages;
DROP POLICY IF EXISTS "languages_update_own" ON public.languages;
DROP POLICY IF EXISTS "languages_delete_own" ON public.languages;
DROP POLICY IF EXISTS "languages_public_select" ON public.languages;

CREATE POLICY "languages_select_own" ON public.languages
  FOR SELECT USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "languages_insert_own" ON public.languages
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "languages_update_own" ON public.languages
  FOR UPDATE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "languages_delete_own" ON public.languages
  FOR DELETE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

-- =====================================================
-- TABLES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "tables_select_own" ON public.tables;
DROP POLICY IF EXISTS "tables_insert_own" ON public.tables;
DROP POLICY IF EXISTS "tables_update_own" ON public.tables;
DROP POLICY IF EXISTS "tables_delete_own" ON public.tables;
DROP POLICY IF EXISTS "tables_public_select" ON public.tables;

CREATE POLICY "tables_select_own" ON public.tables
  FOR SELECT USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "tables_insert_own" ON public.tables
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "tables_update_own" ON public.tables
  FOR UPDATE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "tables_delete_own" ON public.tables
  FOR DELETE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

-- =====================================================
-- ORDERS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_own" ON public.orders;
DROP POLICY IF EXISTS "orders_public_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_public_select" ON public.orders;
DROP POLICY IF EXISTS "orders_public_select_by_table" ON public.orders;

CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT WITH CHECK (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

CREATE POLICY "orders_delete_own" ON public.orders
  FOR DELETE USING (restaurant_id IN (SELECT public.get_user_restaurant_ids()));

-- =====================================================
-- ORDER ITEMS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_delete_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_public_insert" ON public.order_items;
DROP POLICY IF EXISTS "order_items_public_select" ON public.order_items;

CREATE POLICY "order_items_select_own" ON public.order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM public.orders o 
      WHERE o.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "order_items_insert_own" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o 
      WHERE o.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "order_items_update_own" ON public.order_items
  FOR UPDATE USING (
    order_id IN (
      SELECT o.id FROM public.orders o 
      WHERE o.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

CREATE POLICY "order_items_delete_own" ON public.order_items
  FOR DELETE USING (
    order_id IN (
      SELECT o.id FROM public.orders o 
      WHERE o.restaurant_id IN (SELECT public.get_user_restaurant_ids())
    )
  );

-- =====================================================
-- SUBSCRIPTIONS TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (merchant_id = public.get_merchant_id());

CREATE POLICY "subscriptions_insert_own" ON public.subscriptions
  FOR INSERT WITH CHECK (merchant_id = public.get_merchant_id());

CREATE POLICY "subscriptions_update_own" ON public.subscriptions
  FOR UPDATE USING (merchant_id = public.get_merchant_id());

CREATE POLICY "subscriptions_delete_own" ON public.subscriptions
  FOR DELETE USING (merchant_id = public.get_merchant_id());

-- =====================================================
-- PUBLIC ACCESS POLICIES (for customer-facing app)
-- These allow anonymous users to view menus
-- =====================================================

CREATE POLICY "restaurants_public_select" ON public.restaurants
  FOR SELECT USING (true);

CREATE POLICY "categories_public_select" ON public.categories
  FOR SELECT USING (true);

CREATE POLICY "menu_items_public_select" ON public.menu_items
  FOR SELECT USING (true);

CREATE POLICY "category_translations_public_select" ON public.category_translations
  FOR SELECT USING (true);

CREATE POLICY "menu_item_translations_public_select" ON public.menu_item_translations
  FOR SELECT USING (true);

CREATE POLICY "languages_public_select" ON public.languages
  FOR SELECT USING (true);

CREATE POLICY "tables_public_select" ON public.tables
  FOR SELECT USING (true);

CREATE POLICY "orders_public_insert" ON public.orders
  FOR INSERT WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants)
    AND table_id IN (SELECT id FROM public.tables WHERE restaurant_id = orders.restaurant_id)
  );

CREATE POLICY "orders_public_select_by_table" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "order_items_public_insert" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM public.orders)
  );

CREATE POLICY "order_items_public_select" ON public.order_items
  FOR SELECT USING (true);

CREATE POLICY "menu_item_events_public_insert" ON public.menu_item_events
  FOR INSERT WITH CHECK (
    restaurant_id IN (SELECT id FROM public.restaurants)
  );

-- =====================================================
-- SUPABASE STORAGE BUCKET POLICIES
-- =====================================================

-- RESTAURANT BANNERS BUCKET
DROP POLICY IF EXISTS "restaurant_banners_public_select" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_banners_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_banners_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_banners_authenticated_delete" ON storage.objects;

CREATE POLICY "restaurant_banners_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-banners');

CREATE POLICY "restaurant_banners_authenticated_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-banners'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "restaurant_banners_authenticated_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-banners'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "restaurant_banners_authenticated_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-banners'
  AND auth.role() = 'authenticated'
);

-- RESTAURANT LOGOS BUCKET
DROP POLICY IF EXISTS "restaurant_logos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_logos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_logos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "restaurant_logos_authenticated_delete" ON storage.objects;

CREATE POLICY "restaurant_logos_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-logos');

CREATE POLICY "restaurant_logos_authenticated_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-logos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "restaurant_logos_authenticated_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'restaurant-logos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "restaurant_logos_authenticated_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'restaurant-logos'
  AND auth.role() = 'authenticated'
);

-- MENU ITEMS BUCKET
DROP POLICY IF EXISTS "menu_items_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "menu_items_images_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "menu_items_images_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "menu_items_images_authenticated_delete" ON storage.objects;

CREATE POLICY "menu_items_images_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-items');

CREATE POLICY "menu_items_images_authenticated_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'menu-items'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "menu_items_images_authenticated_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'menu-items'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "menu_items_images_authenticated_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'menu-items'
  AND auth.role() = 'authenticated'
);