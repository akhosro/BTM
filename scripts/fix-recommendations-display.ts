import { db } from "../db";
import { sites, recommendations } from "../db/schema";
import { eq } from "drizzle-orm";

async function fixRecommendationsDisplay() {
  console.log("🔧 Fixing recommendations to display properly...\n");

  try {
    // 1. Fix site locations to "Toronto, Ontario"
    console.log("1️⃣  Updating site locations to Ontario...");
    const allSites = await db.select().from(sites);

    for (const site of allSites) {
      console.log(`   Site: ${site.name} - Current location: ${site.location}`);

      if (!site.location || site.location.includes("San Francisco") || site.location.includes("California")) {
        await db
          .update(sites)
          .set({ location: "Toronto, Ontario" })
          .where(eq(sites.id, site.id));
        console.log(`   ✅ Updated ${site.name} -> Toronto, Ontario`);
      }
    }
    console.log("");

    // 2. Fix recommendations - add headline from description
    console.log("2️⃣  Fixing recommendation headlines...");
    const allRecs = await db.select().from(recommendations);

    for (const rec of allRecs) {
      if (!rec.headline && rec.description) {
        // Extract first sentence as headline
        const firstSentence = rec.description.split('.')[0] + '.';
        const headline = firstSentence.length > 100
          ? firstSentence.substring(0, 97) + '...'
          : firstSentence;

        await db
          .update(recommendations)
          .set({ headline: headline })
          .where(eq(recommendations.id, rec.id));

        console.log(`   ✅ Updated recommendation ${rec.id.substring(0, 8)}...`);
        console.log(`      Headline: ${headline}`);
      }
    }
    console.log("");

    // 3. Verify updates
    console.log("3️⃣  Verification:");
    const updatedSites = await db.select().from(sites);
    console.log(`   Sites:`);
    for (const site of updatedSites) {
      console.log(`   - ${site.name}: ${site.location}`);
    }
    console.log("");

    const updatedRecs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.status, "pending"));

    console.log(`   Found ${updatedRecs.length} pending recommendations:`);
    for (const rec of updatedRecs) {
      console.log(`   - ${rec.headline || '(no headline)'}`);
      console.log(`     Type: ${rec.type}, Confidence: ${rec.confidence}%`);
      console.log(`     Cost Savings: $${rec.costSavings}, CO2: ${rec.co2Reduction} kg`);
    }
    console.log("");

    console.log("✅ All fixes applied successfully!");
    console.log("\n📊 Next steps:");
    console.log("   1. Refresh your dashboard at http://localhost:3000");
    console.log("   2. Recommendations should now display with proper headlines");
    console.log("   3. Carbon intensity should query Ontario region");

  } catch (error) {
    console.error("❌ Error fixing recommendations:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixRecommendationsDisplay();
