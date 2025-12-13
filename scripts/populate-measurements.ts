import { db } from "../db";
import { sites, meters, measurements } from "../db/schema";
import { sql } from "drizzle-orm";

console.log("🔄 Populating measurements table with test data...\n");

async function populateMeasurements() {
  try {
    // Fetch all active sites and their meters
    const allSites = await db.select().from(sites).where(sql`${sites.active} = true`);

    if (allSites.length === 0) {
      console.log("❌ No active sites found. Please create sites first.");
      process.exit(1);
    }

    console.log(`📊 Found ${allSites.length} active sites`);

    let totalMeasurements = 0;

    // For each site, get meters and create measurements
    for (const site of allSites) {
      console.log(`\n🏢 Processing site: ${site.name}`);

      const siteMeters = await db.select().from(meters).where(sql`${meters.siteId} = ${site.id}`);

      if (siteMeters.length === 0) {
        console.log(`  ⚠️  No meters found for ${site.name}`);
        continue;
      }

      console.log(`  📟 Found ${siteMeters.length} meters`);

      // Generate measurements for the last 7 days
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);

      for (const meter of siteMeters) {
        const measurementData = [];

        // Generate hourly measurements for the last 7 days
        for (let d = new Date(startDate); d <= now; d.setHours(d.getHours() + 1)) {
          const timestamp = new Date(d);
          const hour = timestamp.getHours();

          // Generate realistic values based on meter category and time of day
          let baseValue = 0;
          let variance = 0;

          switch (meter.category) {
            case "CONS": // Consumption - higher during day
              baseValue = 50 + (hour >= 6 && hour <= 22 ? 30 : 0);
              variance = 15;
              break;
            case "PROD": // Production (solar) - follows sun
              if (hour >= 6 && hour <= 18) {
                const solarCurve = Math.sin(((hour - 6) / 12) * Math.PI);
                baseValue = 40 * solarCurve;
                variance = 10;
              } else {
                baseValue = 0;
                variance = 0;
              }
              break;
            case "STOR": // Storage - varies
              baseValue = 25;
              variance = 20;
              break;
            case "INJ": // Injection - lower values
              baseValue = 10;
              variance = 5;
              break;
            default:
              baseValue = 30;
              variance = 10;
          }

          // Add random variance
          const value = Math.max(0, baseValue + (Math.random() - 0.5) * variance * 2);

          measurementData.push({
            entityId: meter.id,
            entityType: "meter" as const,
            timestamp,
            metric: "energy",
            value: parseFloat(value.toFixed(2)),
            unit: "kWh",
            quality: "good" as const,
            metadata: {
              generatedBy: "test-data-script",
              meterCategory: meter.category,
            },
          });
        }

        // Insert measurements in batches
        const batchSize = 100;
        for (let i = 0; i < measurementData.length; i += batchSize) {
          const batch = measurementData.slice(i, i + batchSize);
          await db.insert(measurements).values(batch);
        }

        totalMeasurements += measurementData.length;
        console.log(`  ✅ Added ${measurementData.length} measurements for ${meter.name} (${meter.category})`);
      }
    }

    console.log(`\n✅ Successfully populated ${totalMeasurements} measurements across ${allSites.length} sites`);

    // Show summary
    const summary = await db.execute(sql`
      SELECT
        entity_type,
        COUNT(*) as count,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM measurements
      GROUP BY entity_type
    `);

    console.log("\n📊 Measurements Summary:");
    console.log(summary.rows);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error populating measurements:", error);
    process.exit(1);
  }
}

populateMeasurements();
