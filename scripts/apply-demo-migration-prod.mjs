import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';

// PRODUCTION DATABASE URL
const connectionString = "postgresql://postgres.lccbpaopmruxdvfkdoor:6495424Ari%21@aws-0-us-west-2.pooler.supabase.com:6543/postgres";

if (!connectionString) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function applyMigration() {
  try {
    console.log('Applying demo_requests table migration to PRODUCTION...');

    const migrationSQL = readFileSync('./db/migrations/0003_premium_matthew_murdock.sql', 'utf8');

    await sql.unsafe(migrationSQL);

    console.log('✅ Migration applied successfully to PRODUCTION!');
    console.log('demo_requests table created in production database');

    await sql.end();
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
