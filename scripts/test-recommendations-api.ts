import { db } from "../db";
import { sites, recommendations } from "../db/schema";
import { eq, and } from "drizzle-orm";

async function testRecommendationsAPI() {
  console.log("🧪 Testing recommendations API logic...\n");

  try {
    // Simulate what the API does
    const userId = "6bd51368-d32b-4fed-8740-9a622dc990bc"; // demo user

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
    console.log(`📍 Site: ${selectedSite.name}`);
    console.log(`   Location: ${selectedSite.location}`);
    console.log(`   Site ID: ${selectedSite.id}\n`);

    // Get all recommendations
    const recs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.siteId, selectedSite.id));

    console.log(`📊 Found ${recs.length} total recommendations for this site\n`);

    // Filter by status
    const pendingRecs = recs.filter((r) => r.status === "pending");
    console.log(`✅ Found ${pendingRecs.length} PENDING recommendations\n`);

    // Map to frontend format (exactly as API does)
    const mappedRecs = pendingRecs.map((rec) => ({
      id: rec.id,
      headline: rec.headline,
      description: rec.description,
      type: rec.type,
      site: selectedSite.name,
      timestamp: rec.createdAt.toISOString(),
      status: rec.status,
      confidence: rec.confidence,
      costSavings: rec.costSavings?.toFixed(0) || "0",
      co2Reduction: rec.co2Reduction?.toFixed(1) || "0",
      priority: rec.confidence > 90 ? "high" : rec.confidence > 80 ? "medium" : "low",
      metadata: rec.supportingData,
    }));

    console.log("📝 Mapped recommendations (as API would return):\n");
    console.log(JSON.stringify(mappedRecs, null, 2));

  } catch (error) {
    console.error("❌ Error testing API:", error);
    process.exit(1);
  }

  process.exit(0);
}

testRecommendationsAPI();
