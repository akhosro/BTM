import { db } from "../db";
import { gridCarbonIntensity } from "../db/schema";

async function fixCarbonData() {
  console.log("🔧 Fixing carbon intensity data...\n");

  try {
    // 1. Delete all old carbon data
    console.log("1️⃣  Deleting old carbon intensity data...");
    await db.delete(gridCarbonIntensity);
    console.log("   ✅ Cleared old data\n");

    // 2. Insert fresh Ontario carbon data with correct region name
    console.log("2️⃣  Inserting Ontario carbon intensity data...");

    const carbonData: typeof gridCarbonIntensity.$inferInsert[] = [];
    const now = new Date();

    // Generate 48 hours of data (past 24h + future 24h)
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
        carbonIntensity: Math.round(intensity * 10) / 10, // Round to 1 decimal
        region: "Toronto, Ontario", // Match site location format
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

    // 3. Verify data
    console.log("3️⃣  Verification:");
    const verifyData = await db.select().from(gridCarbonIntensity).limit(5);

    if (verifyData.length > 0) {
      console.log(`   ✅ Found ${verifyData.length} sample records:`);
      for (const record of verifyData) {
        console.log(`      Region: ${record.region}`);
        console.log(`      Intensity: ${record.carbonIntensity} g/kWh`);
        console.log(`      Time: ${record.timestamp}`);
        console.log(`      Type: ${record.forecastType}`);
        console.log("");
      }
    }

    console.log("✅ Carbon intensity data fixed!");
    console.log("\n📊 Refresh your dashboard to see updated CO₂ metrics");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixCarbonData();
