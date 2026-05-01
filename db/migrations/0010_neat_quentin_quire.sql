ALTER TABLE "restaurants" ADD COLUMN "order_verification_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "scheduled_plan_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "scheduled_price_id" text;