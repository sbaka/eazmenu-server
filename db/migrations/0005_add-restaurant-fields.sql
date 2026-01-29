ALTER TABLE "restaurants" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "google_maps_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "instagram_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "tiktok_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "currency" text DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "timezone" text DEFAULT 'UTC';