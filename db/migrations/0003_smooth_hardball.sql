ALTER TABLE "orders" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "served_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_session_idx" ON "orders" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_hidden_idx" ON "orders" USING btree ("hidden","status");