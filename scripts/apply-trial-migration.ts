import { db } from "../db";
import { sql } from "drizzle-orm";

async function applyMigration() {
  try {
    console.log("Applying trial fields migration...\n");

    // Add subscription_status column
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial' NOT NULL`
    );
    console.log("✓ Added subscription_status column");

    // Add trial_ends_at column
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at timestamp`
    );
    console.log("✓ Added trial_ends_at column");

    // Add subscription_started_at column
    await db.execute(
      sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at timestamp`
    );
    console.log("✓ Added subscription_started_at column");

    // Update existing users to have trial_ends_at set to 14 days from their createdAt
    await db.execute(
      sql`UPDATE users SET trial_ends_at = created_at + INTERVAL '14 days' WHERE trial_ends_at IS NULL`
    );
    console.log(
      "✓ Set trial_ends_at for existing users to 14 days from signup\n"
    );

    console.log("✅ Migration applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
