CREATE TYPE "public"."allergen_type" AS ENUM('Gluten', 'Dairy', 'Eggs', 'Nuts', 'Peanuts', 'Soy', 'Fish', 'Shellfish', 'Sesame', 'Celery', 'Mustard', 'Sulfites');--> statement-breakpoint
CREATE TYPE "public"."menu_item_event_type" AS ENUM('view', 'click', 'addToCart', 'ordered');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_item_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_item_id" integer NOT NULL,
	"restaurant_id" integer NOT NULL,
	"event_type" "menu_item_event_type" NOT NULL,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "theme_config" jsonb;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "chef_message" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "allergens" text[];--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_bio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_item_events" ADD CONSTRAINT "menu_item_events_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_item_events" ADD CONSTRAINT "menu_item_events_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_item_events_item_idx" ON "menu_item_events" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_item_events_restaurant_idx" ON "menu_item_events" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_item_events_type_idx" ON "menu_item_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_item_events_created_at_idx" ON "menu_item_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_item_events_analytics_idx" ON "menu_item_events" USING btree ("restaurant_id","menu_item_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_featured_idx" ON "menu_items" USING btree ("is_featured") WHERE is_featured = true;