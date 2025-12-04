import { db } from "../db";
import { measurements, gridCarbonIntensity, recommendations } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";

async function updateToCurrentTime() {
  console.log("🕐 Updating all data to current time...\n");

  try {
    // 1. Check current latest measurement
    const latest = await db
      .select()
      .from(measurements)
      .where(eq(measurements.entityType, "meter"))
      .orderBy(desc(measurements.timestamp))
      .limit(1);

    if (!latest || latest.length === 0) {
      console.log("❌ No measurements found");
      return;
    }

    const latestTimestamp = latest[0].timestamp;
    const now = new Date();
    const diffMs = now.getTime() - latestTimestamp.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    console.log(`📊 Current state:`);
    console.log(`   Latest measurement: ${latestTimestamp.toISOString()}`);
    console.log(`   Current time: ${now.toISOString()}`);
    console.log(`   Hours behind: ${diffHours}\n`);

    if (diffHours < 1) {
      console.log("✅ Data is already current!");
      process.exit(0);
    }

    // 2. Update measurements
    console.log(`1️⃣  Shifting ${diffHours} hours forward on measurements...`);
    await db.execute(sql`
      UPDATE measurements
      SET timestamp = timestamp + interval '${sql.raw(diffHours.toString())} hours'
    `);
    console.log("   ✅ Updated measurements\n");

    // 3. Delete old carbon data and create fresh Ontario data
    console.log("2️⃣  Updating carbon intensity data...");
    await db.delete(gridCarbonIntensity);

    const carbonData: typeof gridCarbonIntensity.$inferInsert[] = [];

    // Generate 48 hours of Ontario carbon data (past 24h + future 24h)
    for (let i = -24; i < 24; i++) {
      const timestamp = new Date(now);
      timestamp.setHours(now.getHours() + i, 0, 0, 0);

      // Ontario pattern: 30-70 gCO2/kWh based on time of day
      const hour = timestamp.getHours();
      let intensity = 40; // Default

      if (hour >= 0 && hour < 6) {
        intensity = 30; // Night: minimal gas
      } else if (hour >= 6 && hour < 9) {
        intensity = 50; // Morning ramp
      } else if (hour >= 9 && hour < 17) {
        intensity = 40; // Daytime moderate
      } else if (hour >= 17 && hour < 22) {
        intensity = 70; // Evening peak: max gas
      } else {
        intensity = 45; // Late evening
      }

      // Add small random variation
      const variation = Math.random() * 10 - 5;
      intensity = Math.max(25, Math.min(75, intensity + variation));

      carbonData.push({
        timestamp,
        carbonIntensity: Math.round(intensity * 10) / 10,
        region: "Toronto, Ontario",
        forecastType: i < 0 ? "actual" : "forecast",
        dataSource: "Ontario IESO",
        gridOperator: "IESO",
        forecastHorizonHours: i < 0 ? null : String(Math.abs(i)),
        confidence: i < 0 ? null : 0.85,
        metadata: {},
      });
    }

    await db.insert(gridCarbonIntensity).values(carbonData);
    console.log(`   ✅ Inserted ${carbonData.length} carbon intensity records\n`);

    // 4. Delete old recommendations (they'll be regenerated with new timestamps)
    console.log("3️⃣  Deleting old recommendations...");
    await db.delete(recommendations);
    console.log("   ✅ Cleared recommendations\n");

    console.log("✅ All data updated to current time!");
    console.log("\n🚀 Next step: Generate fresh recommendations:");
    console.log("   curl -X POST http://localhost:8000/api/recommend/generate \\");
    console.log("     -H 'Content-Type: application/json' \\");
    console.log('     -d \'{"site_id": "380974d5-8040-43a6-9c00-fac5e57f55f4", "forecast_hours": 24, "training_days": 7}\'');

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

updateToCurrentTime();
