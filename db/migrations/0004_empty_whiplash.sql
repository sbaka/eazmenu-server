ALTER TABLE "merchants" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "supabase_user_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_supabase_user_id_unique" UNIQUE("supabase_user_id");