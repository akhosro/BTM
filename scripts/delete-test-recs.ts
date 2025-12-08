import { db } from "../db";
import { recommendations } from "../db/schema";
import { eq } from "drizzle-orm";

async function deleteTestRecs() {
  console.log("🗑️  Deleting test recommendations for Manufacturing Plant A...\n");

  const manufacturingSiteId = "3ed267ca-06ff-4c6d-af65-08ed908aa9bf";

  try {
    const result = await db
      .delete(recommendations)
      .where(eq(recommendations.siteId, manufacturingSiteId));

    console.log(`✅ Deleted test recommendations for Manufacturing Plant A`);
    console.log(`\n📊 Remaining recommendations are ML-generated only\n`);
  } catch (error) {
    console.error("❌ Error deleting recommendations:", error);
    process.exit(1);
  }

  process.exit(0);
}

deleteTestRecs();
