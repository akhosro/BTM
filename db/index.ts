import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

console.log('[DB] Connecting to:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log connection events
pool.on('connect', () => {
  console.log('[DB] Pool connected to database');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

export const db = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === "development",
});