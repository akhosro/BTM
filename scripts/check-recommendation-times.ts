import { db } from "../db";
import { recommendations } from "../db/schema";
import { eq, desc } from "drizzle-orm";

async function checkRecommendationTimes() {
  console.log("🕐 Checking recommendation timestamps...\n");

  const siteId = "380974d5-8040-43a6-9c00-fac5e57f55f4";
  const now = new Date();

  const recs = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.siteId, siteId))
    .orderBy(desc(recommendations.generatedAt))
    .limit(10);

  console.log(`Current time: ${now.toISOString()}`);
  console.log(`\nFound ${recs.length} recommendations:\n`);

  let futureCount = 0;
  let pastCount = 0;

  for (const rec of recs) {
    const isFuture = rec.recommendedTimeStart > now;
    if (isFuture) futureCount++;
    else pastCount++;

    console.log(`Type: ${rec.type}`);
    console.log(`  Cost Savings: $${rec.costSavings}`);
    console.log(`  Status: ${rec.status}`);
    console.log(`  Start: ${rec.recommendedTimeStart?.toISOString()}`);
    console.log(`  End: ${rec.recommendedTimeEnd?.toISOString()}`);
    console.log(`  Is Future: ${isFuture ? '✅ YES' : '❌ NO (PAST)'}`);
    console.log('');
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Future recommendations (will show in Potential Savings): ${futureCount}`);
  console.log(`  Past recommendations (excluded from Potential Savings): ${pastCount}`);

  if (pastCount > 0) {
    console.log(`\n⚠️  Problem: ${pastCount} recommendations have past timestamps!`);
    console.log(`   The dashboard stats API filters for recommended_time_start >= now`);
    console.log(`   These past recommendations won't be counted in Potential Savings`);
  }

  process.exit(0);
}

checkRecommendationTimes();
