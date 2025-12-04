import { db } from "../db";
import { measurements, gridCarbonIntensity, recommendations } from "../db/schema";
import { sql } from "drizzle-orm";

async function fixAllTimestamps() {
  console.log("🔄 Fixing all timestamps to current date...\n");

  try {
    // 1. Delete all old recommendations
    console.log("1️⃣  Deleting hardcoded recommendations...");
    await db.delete(recommendations);
    console.log("   ✅ Deleted all old recommendations\n");

    // 2. Get the date range of current measurements
    const result = await db.execute(sql`
      SELECT
        MIN(timestamp) as min_ts,
        MAX(timestamp) as max_ts,
        COUNT(*) as count
      FROM measurements
    `);

    const row = result[0] || result.rows?.[0];
    const oldMin = row?.min_ts;
    const oldMax = row?.max_ts;
    const count = row?.count;

    if (!oldMin || !oldMax) {
      console.log("   ⚠️  No measurements found");
      return;
    }

    console.log(`2️⃣  Found ${count} measurements from ${oldMin} to ${oldMax}`);

    // Calculate the time shift needed (from old max to now)
    const now = new Date();
    const oldMaxDate = new Date(oldMax);
    const shiftMs = now.getTime() - oldMaxDate.getTime();
    const shiftHours = Math.round(shiftMs / (1000 * 60 * 60));

    console.log(`   📅 Shifting timestamps forward by ${shiftHours} hours\n`);

    // 3. Update all measurement timestamps
    console.log("3️⃣  Updating measurement timestamps...");
    await db.execute(sql`
      UPDATE measurements
      SET timestamp = timestamp + interval '${sql.raw(shiftHours.toString())} hours'
    `);
    console.log(`   ✅ Updated ${count} measurement timestamps\n`);

    // 4. Verify update
    const verifyResult = await db.execute(sql`
      SELECT
        MIN(timestamp) as new_min,
        MAX(timestamp) as new_max
      FROM measurements
    `);

    const verifyRow = verifyResult[0] || verifyResult.rows?.[0];
    console.log(`4️⃣  Verification:`);
    console.log(`   New range: ${verifyRow?.new_min} to ${verifyRow?.new_max}`);
    console.log(`   ✅ Measurements now end at approximately: ${new Date().toISOString().split('T')[0]}\n`);

    console.log("✅ All timestamps updated successfully!");
    console.log("\n📊 Next steps:");
    console.log("   1. Refresh your dashboard at http://localhost:3000");
    console.log("   2. The dashboard should now show real consumption/production data");
    console.log("   3. Start ML service and generate recommendations");

  } catch (error) {
    console.error("❌ Error fixing timestamps:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixAllTimestamps();
