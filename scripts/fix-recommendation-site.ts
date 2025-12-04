import { db } from "../db";
import { sites, recommendations } from "../db/schema";
import { eq } from "drizzle-orm";

async function fixRecommendationSite() {
  console.log("🔧 Fixing recommendation site assignments...\n");

  try {
    // Get all sites
    const allSites = await db.select().from(sites);
    console.log("📍 All sites:");
    for (const site of allSites) {
      console.log(`   ${site.id}`);
      console.log(`   - Name: ${site.name}`);
      console.log(`   - Active: ${site.active}`);
      console.log(`   - User: ${site.userId}`);
      console.log("");
    }

    // Get the active site for demo user
    const userId = "6bd51368-d32b-4fed-8740-9a622dc990bc";
    const activeSite = await db
      .select()
      .from(sites)
      .where(eq(sites.userId, userId))
      .limit(1);

    if (!activeSite || activeSite.length === 0) {
      console.log("❌ No site found for demo user");
      return;
    }

    const correctSite = activeSite[0];
    console.log(`✅ Active site for demo user: ${correctSite.id} (${correctSite.name})\n`);

    // Get all recommendations
    const allRecs = await db.select().from(recommendations);
    console.log(`📊 Found ${allRecs.length} total recommendations\n`);

    // Update recommendations to correct site
    let updated = 0;
    for (const rec of allRecs) {
      if (rec.siteId !== correctSite.id) {
        await db
          .update(recommendations)
          .set({ siteId: correctSite.id })
          .where(eq(recommendations.id, rec.id));

        console.log(`   ✅ Updated recommendation ${rec.id.substring(0, 8)}...`);
        console.log(`      From site: ${rec.siteId.substring(0, 8)}...`);
        console.log(`      To site: ${correctSite.id.substring(0, 8)}...`);
        updated++;
      }
    }

    console.log(`\n✅ Updated ${updated} recommendations to correct site`);

    // Verify
    const verifyRecs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.siteId, correctSite.id));

    console.log(`\n📊 Verification: ${verifyRecs.length} recommendations now assigned to ${correctSite.name}`);
    for (const rec of verifyRecs) {
      console.log(`   - ${rec.headline || '(no headline)'}`);
      console.log(`     Type: ${rec.type}, Status: ${rec.status}`);
    }

  } catch (error) {
    console.error("❌ Error fixing recommendations:", error);
    process.exit(1);
  }

  process.exit(0);
}

fixRecommendationSite();
