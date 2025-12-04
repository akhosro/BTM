import { db } from "../db";
import { sites, electricityPricing } from "../db/schema";
import { eq } from "drizzle-orm";

async function checkAndFixPricing() {
  console.log("🔍 Checking electricity pricing data...\n");

  try {
    const userId = "6bd51368-d32b-4fed-8740-9a622dc990bc";

    // Get active site
    const site = await db
      .select()
      .from(sites)
      .where(eq(sites.userId, userId))
      .limit(1);

    if (!site || site.length === 0) {
      console.log("❌ No site found");
      return;
    }

    const activeSite = site[0];
    console.log(`📍 Site: ${activeSite.name} (${activeSite.id})`);
    console.log(`   Location: ${activeSite.location}\n`);

    // Check pricing data
    const pricing = await db
      .select()
      .from(electricityPricing)
      .where(eq(electricityPricing.siteId, activeSite.id));

    console.log(`📊 Found ${pricing.length} pricing records for this site\n`);

    if (pricing.length === 0) {
      console.log("⚠️  No pricing data found! Creating Ontario TOU rates...\n");

      // Create Ontario TOU pricing (similar to what exists)
      const ontarioTOU = {
        siteId: activeSite.id,
        region: "Ontario",
        utilityProvider: "Ontario Hydro",
        rateType: "TOU",
        rateStructure: {
          offPeak: {
            rate: 0.082,
            hours: [[0, 7], [19, 24]],
            days: [0, 1, 2, 3, 4, 5, 6],
            label: "Off-Peak"
          },
          midPeak: {
            rate: 0.113,
            hours: [[7, 11], [17, 19]],
            days: [0, 1, 2, 3, 4],
            label: "Mid-Peak"
          },
          onPeak: {
            rate: 0.151,
            hours: [[11, 17]],
            days: [0, 1, 2, 3, 4],
            label: "On-Peak"
          },
          weekend: {
            rate: 0.082,
            hours: [[0, 24]],
            days: [5, 6],
            label: "Weekend Off-Peak"
          }
        },
        currency: "CAD",
        demandCharge: 0,
        demandThreshold: 0,
        validFrom: new Date("2025-01-01"),
        validTo: new Date("2025-12-31"),
        active: true,
        dataSource: "manual",
        metadata: {},
      };

      await db.insert(electricityPricing).values(ontarioTOU);
      console.log("✅ Created Ontario TOU pricing structure");
      console.log("   Off-Peak: $0.082/kWh (0-7am, 7pm-midnight)");
      console.log("   Mid-Peak: $0.113/kWh (7-11am, 5-7pm weekdays)");
      console.log("   On-Peak: $0.151/kWh (11am-5pm weekdays)");
      console.log("   Weekend: $0.082/kWh (all day)\n");

    } else {
      console.log("✅ Pricing data exists:");
      for (const p of pricing) {
        console.log(`   - ${p.utilityProvider} (${p.rateType})`);
        console.log(`     Active: ${p.active}`);
        console.log(`     Valid: ${p.validFrom?.toISOString().split('T')[0]} to ${p.validTo?.toISOString().split('T')[0]}`);
        if (p.rateStructure) {
          console.log(`     Rate Structure: ${Object.keys(p.rateStructure).join(', ')}`);
        }
      }
      console.log("");
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

checkAndFixPricing();
