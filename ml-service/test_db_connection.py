import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = "postgresql://postgres:1519188@localhost:5432/enalysis_mvp"

print("Testing database connection...")
print(f"Connecting to: {DATABASE_URL}")

try:
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    print("Connected successfully!")

    with conn.cursor() as cursor:
        # Test query without schema prefix
        print("\nTesting measurements table...")
        cursor.execute("SELECT COUNT(*) as count FROM measurements WHERE entity_type = 'meter';")
        result = cursor.fetchone()
        print(f"Found {result['count']} measurements in public schema")

        # Test query with table info
        cursor.execute("""
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_name = 'measurements';
        """)
        tables = cursor.fetchall()
        print(f"\nMeasurements tables found:")
        for table in tables:
            print(f"  - {table['table_schema']}.{table['table_name']}")

        # Test the actual query from the ML service
        print("\nTesting actual ML service query...")
        site_id = '1cc35b4c-da27-4be2-bdb6-87435e253d9f'
        cursor.execute("""
            SELECT
                m.timestamp,
                m.value,
                m.unit,
                mt.category
            FROM measurements m
            JOIN meters mt ON m.entity_id = mt.id
            WHERE mt.site_id = %s
              AND mt.category = 'CONS'
              AND m.entity_type = 'meter'
            ORDER BY m.timestamp ASC
            LIMIT 5;
        """, (site_id,))
        results = cursor.fetchall()
        print(f"Query returned {len(results)} rows")
        if results:
            print("Sample data:")
            for row in results[:3]:
                print(f"  - {row['timestamp']}: {row['value']} {row['unit']}")

    conn.close()
    print("\nAll database tests passed!")

except Exception as e:
    print(f"\nError: {e}")
    import traceback
    traceback.print_exc()
