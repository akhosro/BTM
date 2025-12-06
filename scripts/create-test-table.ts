import postgres from 'postgres';

async function createTestTable() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);

  try {
    console.log('Creating test table...\n');

    await client`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;

    console.log('✅ Test table created!');

    // Check if it exists
    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log('\nTables in public schema:');
    tables.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

createTestTable();
