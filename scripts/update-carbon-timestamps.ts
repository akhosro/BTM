import { db } from "../db";
import { gridCarbonIntensity } from "../db/schema";

async function updateCarbonIntensity() {
  console.log("🔄 Updating carbon intensity timestamps...");

  try {
    // Delete old data
    await db.delete(gridCarbonIntensity);
    console.log("✅ Cleared old carbon intensity data");

    // Generate new data for next 24 hours
    const carbonData: typeof gridCarbonIntensity.$inferInsert[] = [];
    const now = new Date();

    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now);
      timestamp.setHours(now.getHours() + i, 0, 0, 0);

      // Ontario pattern: 30-70 gCO2/kWh
      const hour = timestamp.getHours();
      let intensity = 40; // Base Ontario average

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

      carbonData.push({
        timestamp,
        carbonIntensity: intensity,
        region: "Ontario",
        forecastType: "forecast",
        dataSource: "ElectricityMaps",
      });
    }

    await db.insert(gridCarbonIntensity).values(carbonData);
    console.log(`✅ Inserted ${carbonData.length} carbon intensity records for next 24 hours`);
    console.log(`   Timestamps: ${carbonData[0].timestamp} to ${carbonData[carbonData.length - 1].timestamp}`);

  } catch (error) {
    console.error("❌ Error updating carbon intensity:", error);
    process.exit(1);
  }

  process.exit(0);
}

updateCarbonIntensity();
