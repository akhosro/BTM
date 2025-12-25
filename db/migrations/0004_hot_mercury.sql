ALTER TABLE "users" ADD COLUMN "subscription_status" text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_started_at" timestamp;