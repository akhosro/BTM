import postgres from 'postgres';

async function cleanup() {
  const client = postgres(process.env.DATABASE_URL!);
  try {
    await client`DROP TABLE IF EXISTS test_table`;
    console.log('✅ Test table dropped');
  } finally {
    await client.end();
    process.exit(0);
  }
}

cleanup();
