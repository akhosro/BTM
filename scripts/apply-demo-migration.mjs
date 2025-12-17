import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function applyMigration() {
  try {
    console.log('Applying demo_requests table migration...');

    const migrationSQL = readFileSync('./db/migrations/0003_premium_matthew_murdock.sql', 'utf8');

    await sql.unsafe(migrationSQL);

    console.log('✅ Migration applied successfully!');
    console.log('demo_requests table created');

    await sql.end();
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
