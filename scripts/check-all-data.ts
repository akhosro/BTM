import { db } from "../db";
import { sites, recommendations, users } from "../db/schema";

async function checkAllData() {
  console.log("📊 Checking all data in database...\\n");

  try {
    // Check users
    const allUsers = await db.select().from(users);
    console.log(`👥 Total users: ${allUsers.length}`);
    allUsers.forEach((u) => {
      console.log(`   - ${u.email} (ID: ${u.id})`);
    });

    console.log("");

    // Check sites
    const allSites = await db.select().from(sites);
    console.log(`📍 Total sites: ${allSites.length}`);
    allSites.forEach((s) => {
      console.log(`   - ${s.name} (ID: ${s.id}, User: ${s.userId})`);
    });

    console.log("");

    // Check recommendations
    const allRecs = await db.select().from(recommendations);
    console.log(`💡 Total recommendations: ${allRecs.length}`);
    allRecs.forEach((r) => {
      console.log(`   - ${r.headline} (Site: ${r.siteId}, Status: ${r.status})`);
    });

    console.log("");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkAllData();
