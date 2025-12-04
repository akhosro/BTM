import { db } from "../db";
import { electricityPricing } from "../db/schema";
import { eq } from "drizzle-orm";

async function fixRateStructure() {
  console.log("🔧 Fixing rate structure format...\n");

  const siteId = "380974d5-8040-43a6-9c00-fac5e57f55f4";

  try {
    // Ontario TOU rate structure with proper format
    const correctRateStructure = {
      offPeak: {
        rate: 0.082,
        hours: [[0, 7], [19, 24]],
        days: [0, 1, 2, 3, 4, 5, 6],
        label: "Off-Peak"
      },
      midPeak: {
        rate: 0.113,
        hours: [[7, 11], [17, 19]],
        days: [0, 1, 2, 3, 4],
        label: "Mid-Peak"
      },
      onPeak: {
        rate: 0.151,
        hours: [[11, 17]],
        days: [0, 1, 2, 3, 4],
        label: "On-Peak"
      },
      weekend: {
        rate: 0.082,
        hours: [[0, 24]],
        days: [5, 6],
        label: "Weekend Off-Peak"
      }
    };

    await db
      .update(electricityPricing)
      .set({
        rateStructure: correctRateStructure,
        utilityProvider: "Ontario Hydro",
        region: "Ontario"
      })
      .where(eq(electricityPricing.siteId, siteId));

    console.log("✅ Updated rate structure to proper TOU format\n");

    // Verify
    const updated = await db
      .select()
      .from(electricityPricing)
      .where(eq(electricityPricing.siteId, siteId))
      .limit(1);

    console.log("Verified rate structure:");
    console.log(JSON.stringify(updated[0].rateStructure, null, 2));

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixRateStructure();
