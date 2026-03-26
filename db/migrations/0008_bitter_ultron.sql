CREATE TYPE "public"."order_lifecycle_protocol" AS ENUM('default', 'quick_turn', 'manual');--> statement-breakpoint
CREATE TYPE "public"."ingredient_category" AS ENUM('vegetables', 'fruits', 'proteins', 'dairy', 'grains', 'spices', 'oils', 'seafood', 'nuts', 'sweeteners', 'condiments', 'herbs', 'other');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "ingredient_category" DEFAULT 'other' NOT NULL,
	"is_allergen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_translations" (
	"id" serial PRIMARY KEY NOT NULL,
	"ingredient_id" integer NOT NULL,
	"language_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_translations_ingredient_id_language_id_unique" UNIQUE("ingredient_id","language_id")
);
--> statement-breakpoint
CREATE TABLE "menu_item_ingredients" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_item_id" integer NOT NULL,
	"ingredient_id" integer NOT NULL,
	CONSTRAINT "menu_item_ingredients_menu_item_id_ingredient_id_unique" UNIQUE("menu_item_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" integer NOT NULL,
	"plan_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_price_id" text,
	"trial_ends_at" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_merchant_id_unique" UNIQUE("merchant_id")
);
--> statement-breakpoint
ALTER TABLE "merchants" DROP CONSTRAINT "merchants_email_unique";--> statement-breakpoint
ALTER TABLE "tables" DROP CONSTRAINT "positive_seats";--> statement-breakpoint
ALTER TABLE "tables" DROP CONSTRAINT "positive_number";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "non_negative_total";--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ALTER COLUMN "supabase_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "provider" text DEFAULT 'email';--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "language" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "order_lifecycle_protocol" "order_lifecycle_protocol" DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "order_hide_delay_minutes" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "ingredient_translations" ADD CONSTRAINT "ingredient_translations_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_translations" ADD CONSTRAINT "ingredient_translations_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredients_category_idx" ON "ingredients" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "ingredient_translations_ingredient_idx" ON "ingredient_translations" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "ingredient_translations_lang_idx" ON "ingredient_translations" USING btree ("language_id");--> statement-breakpoint
CREATE INDEX "menu_item_ingredients_item_idx" ON "menu_item_ingredients" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_item_ingredients_ingredient_idx" ON "menu_item_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "subscriptions_merchant_idx" ON "subscriptions" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_sub_idx" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "restaurants_merchant_idx" ON "restaurants" USING btree ("merchant_id");--> statement-breakpoint
ALTER TABLE "merchants" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "positive_seats" CHECK (seats>0);--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "positive_number" CHECK (number>0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "non_negative_total" CHECK (total>= 0);