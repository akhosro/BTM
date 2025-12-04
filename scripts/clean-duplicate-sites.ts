import { db } from "../db";
import { sites, meters, recommendations, electricityPricing } from "../db/schema";
import { eq, sql } from "drizzle-orm";

async function cleanDuplicateSites() {
  console.log("🧹 Cleaning up duplicate sites...\n");

  try {
    const userId = "6bd51368-d32b-4fed-8740-9a622dc990bc"; // demo user

    // Get all sites for user
    const allSites = await db
      .select()
      .from(sites)
      .where(eq(sites.userId, userId));

    console.log(`📊 Found ${allSites.length} sites for demo user:\n`);

    for (const site of allSites) {
      console.log(`   ${site.id}`);
      console.log(`   - Name: ${site.name}`);
      console.log(`   - Active: ${site.active}`);
      console.log(`   - Created: ${site.createdAt}`);
      console.log("");
    }

    if (allSites.length <= 1) {
      console.log("✅ No duplicates found!");
      return;
    }

    // Keep the first site (oldest), delete the rest
    const siteToKeep = allSites.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];

    const sitesToDelete = allSites.filter(s => s.id !== siteToKeep.id);

    console.log(`✅ Keeping site: ${siteToKeep.id} (${siteToKeep.name})`);
    console.log(`🗑️  Deleting ${sitesToDelete.length} duplicate sites:\n`);

    for (const site of sitesToDelete) {
      console.log(`   Deleting site: ${site.id}`);

      // Move all meters from duplicate site to the site we're keeping
      const metersToMove = await db
        .select()
        .from(meters)
        .where(eq(meters.siteId, site.id));

      if (metersToMove.length > 0) {
        console.log(`   - Moving ${metersToMove.length} meters to kept site`);
        for (const meter of metersToMove) {
          await db
            .update(meters)
            .set({ siteId: siteToKeep.id })
            .where(eq(meters.id, meter.id));
        }
      }

      // Move all recommendations
      const recsToMove = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.siteId, site.id));

      if (recsToMove.length > 0) {
        console.log(`   - Moving ${recsToMove.length} recommendations to kept site`);
        for (const rec of recsToMove) {
          await db
            .update(recommendations)
            .set({ siteId: siteToKeep.id })
            .where(eq(recommendations.id, rec.id));
        }
      }

      // Move all electricity pricing
      const pricingToMove = await db
        .select()
        .from(electricityPricing)
        .where(eq(electricityPricing.siteId, site.id));

      if (pricingToMove.length > 0) {
        console.log(`   - Moving ${pricingToMove.length} pricing records to kept site`);
        for (const pricing of pricingToMove) {
          await db
            .update(electricityPricing)
            .set({ siteId: siteToKeep.id })
            .where(eq(electricityPricing.id, pricing.id));
        }
      }

      // Now delete the duplicate site
      await db.delete(sites).where(eq(sites.id, site.id));
      console.log(`   ✅ Deleted site: ${site.id}\n`);
    }

    // Verify cleanup
    const remainingSites = await db
      .select()
      .from(sites)
      .where(eq(sites.userId, userId));

    console.log(`\n✅ Cleanup complete!`);
    console.log(`📊 Remaining sites: ${remainingSites.length}`);
    for (const site of remainingSites) {
      console.log(`   - ${site.name} (${site.id})`);

      // Count associated data
      const meterCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(meters)
        .where(eq(meters.siteId, site.id));

      const recCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(recommendations)
        .where(eq(recommendations.siteId, site.id));

      console.log(`     Meters: ${meterCount[0].count}, Recommendations: ${recCount[0].count}`);
    }

  } catch (error) {
    console.error("❌ Error cleaning duplicate sites:", error);
    process.exit(1);
  }

  process.exit(0);
}

cleanDuplicateSites();
