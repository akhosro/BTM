import { db } from "../db";
import { recommendations } from "../db/schema";
import { eq } from "drizzle-orm";

async function checkRecommendations() {
  console.log("🔍 Checking recommendations in database...\n");

  try {
    // Get all recommendations for the site
    const siteId = "12c2cfbc-ef9c-47cb-aee9-4324700900e5";

    const recs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.siteId, siteId));

    console.log(`Found ${recs.length} recommendations for site ${siteId}\n`);

    for (const rec of recs) {
      console.log("─".repeat(80));
      console.log(`ID: ${rec.id}`);
      console.log(`Type: ${rec.type}`);
      console.log(`Status: ${rec.status}`);
      console.log(`Recommended Time: ${rec.recommendedTimeStart} to ${rec.recommendedTimeEnd}`);
      console.log(`Title: ${rec.title}`);
      console.log(`Description: ${rec.description}`);
      console.log(`Cost Savings: $${rec.costSavings}`);
      console.log(`CO2 Reduction: ${rec.co2Reduction} kg`);
      console.log(`Confidence: ${rec.confidence}`);
      console.log(`Created: ${rec.createdAt}`);
      console.log("");
    }

  } catch (error) {
    console.error("❌ Error checking recommendations:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkRecommendations();
