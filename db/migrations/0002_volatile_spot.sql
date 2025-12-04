-- Step 1: Add user_id column as nullable first
ALTER TABLE "sites" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- Step 2: Set all existing sites to demo user (demo@enalysis.com)
UPDATE "sites" SET "user_id" = (SELECT "id" FROM "users" WHERE "email" = 'demo@enalysis.com' LIMIT 1);--> statement-breakpoint

-- Step 3: Make user_id NOT NULL
ALTER TABLE "sites" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Step 4: Add foreign key constraint
ALTER TABLE "sites" ADD CONSTRAINT "sites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;