import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Create PostgreSQL connection
const connectionString = process.env.DATABASE_URL;

// For query purposes
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });