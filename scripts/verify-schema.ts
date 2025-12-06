import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function verifySchema() {
  console.log("🔍 Verifying database schema...\n");

  try {
    // Check all tables exist
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log("📋 Tables in database:");
    tables.forEach((t) => console.log(`  ✓ ${t.table_name}`));
    console.log();

    // Check users table columns
    const usersCols = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
      ORDER BY ordinal_position
    `;

    console.log("👤 Users table columns:");
    usersCols.forEach((col) => {
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : "";
      console.log(`  ✓ ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });
    console.log();

    // Check sites table columns
    const sitesCols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sites'
      ORDER BY ordinal_position
    `;

    console.log("🏢 Sites table columns:");
    sitesCols.forEach((col) => {
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      console.log(`  ✓ ${col.column_name}: ${col.data_type} ${nullable}`);
    });
    console.log();

    // Check enums
    const enums = await sql`
      SELECT typname
      FROM pg_type
      WHERE typcategory = 'E'
      ORDER BY typname
    `;

    console.log("📊 Enums:");
    enums.forEach((e) => console.log(`  ✓ ${e.typname}`));
    console.log();

    console.log("✅ Schema verification complete!");

  } catch (error: any) {
    console.error("❌ Verification failed:", error.message);
    await sql.end();
    process.exit(1);
  }

  await sql.end();
}

verifySchema().catch(console.error);
