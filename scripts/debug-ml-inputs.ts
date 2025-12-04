import { db } from "../db";
import { sites, electricityPricing, gridCarbonIntensity, consumptionForecasts } from "../db/schema";
import { eq, gte, lte, and, desc } from "drizzle-orm";

async function debugMLInputs() {
  console.log("🔍 Debugging ML service inputs...\n");

  const siteId = "380974d5-8040-43a6-9c00-fac5e57f55f4";

  try {
    // 1. Check site
    const site = await db.select().from(sites).where(eq(sites.id, siteId)).limit(1);
    console.log("1️⃣  Site:");
    console.log("   Name:", site[0]?.name);
    console.log("   Location:", site[0]?.location);
    console.log("");

    // 2. Check electricity pricing
    const pricing = await db
      .select()
      .from(electricityPricing)
      .where(eq(electricityPricing.siteId, siteId))
      .limit(1);

    console.log("2️⃣  Electricity Pricing:");
    if (pricing.length > 0) {
      console.log("   Provider:", pricing[0].utilityProvider);
      console.log("   Rate Type:", pricing[0].rateType);
      console.log("   Active:", pricing[0].active);
      console.log("   Valid From:", pricing[0].validFrom);
      console.log("   Valid To:", pricing[0].validTo);

      if (pricing[0].rateStructure) {
        console.log("   Rate Structure:");
        const rates = pricing[0].rateStructure as Record<string, any>;
        for (const [period, config] of Object.entries(rates)) {
          console.log(`     ${period}: $${config.rate}/kWh`);
        }
      }
    } else {
      console.log("   ❌ No pricing data found!");
    }
    console.log("");

    // 3. Check carbon intensity
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const carbon = await db
      .select()
      .from(gridCarbonIntensity)
      .where(
        and(
          eq(gridCarbonIntensity.region, site[0]?.location || "Toronto, Ontario"),
          gte(gridCarbonIntensity.timestamp, now),
          lte(gridCarbonIntensity.timestamp, tomorrow)
        )
      )
      .limit(5);

    console.log("3️⃣  Carbon Intensity (next 24h):");
    console.log(`   Region: ${site[0]?.location}`);
    console.log(`   Records found: ${carbon.length}`);
    if (carbon.length > 0) {
      const intensities = carbon.map(c => c.carbonIntensity);
      console.log(`   Range: ${Math.min(...intensities)} - ${Math.max(...intensities)} g/kWh`);
      console.log("   Sample:");
      for (const c of carbon.slice(0, 3)) {
        console.log(`     ${c.timestamp.toISOString().split('T')[1].slice(0,5)}: ${c.carbonIntensity} g/kWh`);
      }
    } else {
      console.log("   ❌ No carbon data found!");
    }
    console.log("");

    // 4. Check consumption forecasts
    const forecasts = await db
      .select()
      .from(consumptionForecasts)
      .where(eq(consumptionForecasts.siteId, siteId))
      .orderBy(desc(consumptionForecasts.generatedAt))
      .limit(5);

    console.log("4️⃣  Consumption Forecasts:");
    console.log(`   Total forecasts: ${forecasts.length}`);
    if (forecasts.length > 0) {
      const values = forecasts.map(f => f.predictedConsumption);
      console.log(`   Range: ${Math.min(...values).toFixed(1)} - ${Math.max(...values).toFixed(1)} kWh`);
      console.log("   Sample:");
      for (const f of forecasts.slice(0, 3)) {
        console.log(`     ${f.forecastTimestamp.toISOString().split('T')[1].slice(0,5)}: ${f.predictedConsumption} kWh`);
      }
    } else {
      console.log("   ❌ No forecasts found!");
    }
    console.log("");

    // 5. Analysis
    console.log("📊 Analysis:");

    if (pricing.length === 0) {
      console.log("   ⚠️  Missing pricing data - cost recommendations impossible");
    }

    if (carbon.length === 0) {
      console.log("   ⚠️  Missing carbon data - carbon recommendations impossible");
    }

    if (carbon.length > 0) {
      const intensities = carbon.map(c => c.carbonIntensity);
      const variation = Math.max(...intensities) - Math.min(...intensities);
      if (variation < 10) {
        console.log(`   ⚠️  Low carbon variation (${variation} g/kWh) - limited shifting opportunity`);
      }
    }

    if (forecasts.length > 0 && forecasts.length < 24) {
      console.log(`   ⚠️  Only ${forecasts.length} forecast hours - recommendations need 24h`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

debugMLInputs();
