import { db } from "../db";
import { sites, recommendations } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function testRecommendationsDB() {
  console.log("🧪 Testing recommendations database query...\\n");

  try {
    const userId = "73cffd06-e0a3-4a91-9364-f8e5058027ed";

    // Get site
    const site = await db
      .select()
      .from(sites)
      .where(and(eq(sites.active, true), eq(sites.userId, userId)))
      .limit(1);

    if (!site || site.length === 0) {
      console.log("❌ No site found for user");
      return;
    }

    const selectedSite = site[0];
    console.log(`📍 Site: ${selectedSite.name} (ID: ${selectedSite.id})\\n`);

    // Get ALL recommendations for this site (no filters)
    const allRecs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.siteId, selectedSite.id));

    console.log(`📊 Total recommendations for site: ${allRecs.length}\\n`);

    if (allRecs.length > 0) {
      console.log("Sample recommendation:");
      console.log(JSON.stringify(allRecs[0], null, 2));
    }

    // Get pending recommendations (with status filter)
    const pendingRecs = await db
      .select()
      .from(recommendations)
      .where(and(
        eq(recommendations.siteId, selectedSite.id),
        eq(recommendations.status, "pending")
      ));

    console.log(`\\n✅ Pending recommendations: ${pendingRecs.length}\\n`);

    if (pendingRecs.length > 0) {
      console.log("Sample pending recommendation:");
      console.log(JSON.stringify(pendingRecs[0], null, 2));
    }

  } catch (error) {
    console.error("❌ Error testing database:", error);
    process.exit(1);
  }

  process.exit(0);
}

testRecommendationsDB();
