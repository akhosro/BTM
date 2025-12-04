import { db } from "../db";
import { sites } from "../db/schema";
import { eq } from "drizzle-orm";

async function updateSiteLocations() {
  console.log("🔄 Updating site locations to Ontario...");

  try {
    // Get all sites
    const allSites = await db.select().from(sites);
    console.log(`Found ${allSites.length} sites`);

    for (const site of allSites) {
      if (site.location && site.location.includes("San Francisco")) {
        await db
          .update(sites)
          .set({ location: "Toronto, Ontario" })
          .where(eq(sites.id, site.id));

        console.log(`✅ Updated site: ${site.name} -> Toronto, Ontario`);
      }
    }

    console.log("\n✅ All sites updated successfully!");
  } catch (error) {
    console.error("❌ Error updating sites:", error);
    process.exit(1);
  }

  process.exit(0);
}

updateSiteLocations();
