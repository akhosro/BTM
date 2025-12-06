import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function checkSchema() {
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);

  try {
    console.log('Checking Supabase schema...\n');

    const result = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    if (result.length === 0) {
      console.log('❌ No tables found in Supabase!');
      console.log('\nYou need to run: npm run db:push');
    } else {
      console.log(`✅ Found ${result.length} tables in Supabase:\n`);
      result.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

checkSchema();
