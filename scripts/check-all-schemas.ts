import postgres from 'postgres';

async function checkAllSchemas() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);

  try {
    console.log('Checking all schemas in Supabase...\n');

    // Check all schemas
    const schemas = await client`
      SELECT schema_name
      FROM information_schema.schemata
      ORDER BY schema_name;
    `;

    console.log('Available schemas:');
    schemas.forEach(row => console.log(`  - ${row.schema_name}`));

    // Check tables in all schemas
    const allTables = await client`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `;

    console.log('\nAll tables:');
    if (allTables.length === 0) {
      console.log('  (no tables found)');
    } else {
      allTables.forEach(row => {
        console.log(`  - ${row.table_schema}.${row.table_name}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

checkAllSchemas();
