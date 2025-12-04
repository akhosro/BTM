/**
 * Database Seed Script - Demo Data
 *
 * Creates realistic demo data for testing and development:
 * - Demo user account
 * - Sample site (Biotech facility)
 * - Meters (consumption, solar production, battery storage)
 * - Energy sources (Solar panels, Battery system)
 * - 30 days of historical measurement data
 * - Electricity pricing data
 * - Grid carbon intensity data
 * - AI-generated recommendations
 *
 * Run with: npm run seed:demo
 */

import "dotenv/config";
import { db } from "../db";
import {
  users,
  sites,
  meters,
  energySources,
  measurements,
  electricityPricing,
  gridCarbonIntensity,
  recommendations,
  userPreferences,
} from "../db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

// Configuration
const DEMO_EMAIL = "demo@enalysis.com";
const DEMO_PASSWORD = "demo123";
const DAYS_OF_DATA = 30;
const INTERVALS_PER_DAY = 96; // 15-minute intervals

async function main() {
  console.log("<1 Starting database seed...\n");

  try {
    // Step 1: Create demo user
    console.log("1�  Creating demo user...");

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, DEMO_EMAIL),
    });

    if (user) {
      console.log("   9  Demo user already exists");
    } else {
      const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      [user] = await db
        .insert(users)
        .values({
          email: DEMO_EMAIL,
          passwordHash,
          firstName: "Demo",
          lastName: "User",
          company: "Enalysis Demo Corp",
          jobTitle: "Energy Manager",
          phone: "+1-555-0123",
        })
        .returning();

      console.log(`    Created demo user: ${DEMO_EMAIL}`);
      console.log(`   = Password: ${DEMO_PASSWORD}`);
    }

    // Create user preferences
    const existingPrefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, user.id),
    });

    if (!existingPrefs) {
      await db.insert(userPreferences).values({
        userId: user.id,
        theme: "light",
        emailNotifications: true,
        language: "en",
        timezone: "America/Toronto",
      });
      console.log("    Created user preferences");
    }

    // Step 2: Create demo site
    console.log("\n2�  Creating demo site...");

    const [site] = await db
      .insert(sites)
      .values({
        userId: user.id,
        name: "Biotech Research Campus",
        industryType: "biotech",
        location: "San Francisco, CA",
        latitude: 37.7749,
        longitude: -122.4194,
        timezone: "America/Los_Angeles",
      })
      .returning()
      .onConflictDoNothing();

    if (site) {
      console.log(`    Created site: ${site.name}`);
    } else {
      console.log("   9  Site already exists, using existing site");
      const existingSite = await db.query.sites.findFirst({
        where: eq(sites.userId, user.id),
      });
      if (!existingSite) throw new Error("Could not find or create site");
      Object.assign(site, existingSite);
    }

    // Step 3: Create meters
    console.log("\n3�  Creating meters...");

    const [consumptionMeter] = await db
      .insert(meters)
      .values({
        siteId: site!.id,
        name: "Main Building Consumption",
        category: "CONS",
        readingFrequency: "15min",
        capacity: 1000, // 1 MW capacity
      })
      .returning()
      .onConflictDoNothing();

    const [solarMeter] = await db
      .insert(meters)
      .values({
        siteId: site!.id,
        name: "Rooftop Solar Array",
        category: "PROD",
        readingFrequency: "15min",
        capacity: 500, // 500 kW capacity
      })
      .returning()
      .onConflictDoNothing();

    const [batteryMeter] = await db
      .insert(meters)
      .values({
        siteId: site!.id,
        name: "Battery Energy Storage",
        category: "STOR",
        readingFrequency: "15min",
        capacity: 1000, // 1 MWh capacity
      })
      .returning()
      .onConflictDoNothing();

    console.log(`    Created consumption meter: ${consumptionMeter?.name || "already exists"}`);
    console.log(`    Created solar meter: ${solarMeter?.name || "already exists"}`);
    console.log(`    Created battery meter: ${batteryMeter?.name || "already exists"}`);

    // Get existing meters if creation was skipped
    const meters_list = await db.query.meters.findMany({
      where: eq(meters.siteId, site!.id),
    });

    const consumption = meters_list.find((m) => m.category === "CONS")!;
    const solar = meters_list.find((m) => m.category === "PROD")!;
    const battery = meters_list.find((m) => m.category === "STOR")!;

    // Step 4: Create energy sources
    console.log("\n4�  Creating energy sources...");

    await db
      .insert(energySources)
      .values({
        meterId: solar.id,
        name: "Rooftop Solar System",
        sourceType: "solar",
        capacity: 500, // 500 kW
        metadata: {
          provider: "solaredge",
          systemSize: 500,
          panelCount: 1250,
          inverterModel: "SolarEdge SE100K",
        },
      })
      .onConflictDoNothing();

    await db
      .insert(energySources)
      .values({
        meterId: battery.id,
        name: "Battery Energy Storage System",
        sourceType: "battery",
        capacity: 1000, // 1 MWh
        metadata: {
          provider: "tesla",
          batteryModel: "Tesla Megapack",
          usableCapacity: 1000,
          maxChargePower: 250,
          maxDischargePower: 250,
        },
      })
      .onConflictDoNothing();

    console.log("    Created solar energy source (500 kW)");
    console.log("    Created battery energy source (1 MWh)");

    // Step 5: Generate measurement data
    console.log(`\n5�  Generating ${DAYS_OF_DATA} days of measurement data...`);
    console.log("   � This may take a minute...");

    const now = new Date();
    const measurementsToInsert: typeof measurements.$inferInsert[] = [];

    for (let day = 0; day < DAYS_OF_DATA; day++) {
      for (let interval = 0; interval < INTERVALS_PER_DAY; interval++) {
        const timestamp = new Date(now);
        timestamp.setDate(timestamp.getDate() - (DAYS_OF_DATA - day));
        timestamp.setHours(Math.floor((interval * 15) / 60));
        timestamp.setMinutes((interval * 15) % 60);
        timestamp.setSeconds(0);
        timestamp.setMilliseconds(0);

        const hour = timestamp.getHours();
        const minute = timestamp.getMinutes();

        // Realistic consumption pattern (kW)
        // Peak hours: 8 AM - 6 PM
        let baseConsumption = 200; // kW base load
        if (hour >= 8 && hour < 18) {
          baseConsumption = 400 + Math.sin((hour - 8) / 10 * Math.PI) * 100;
        }
        const consumptionPower = baseConsumption + (Math.random() - 0.5) * 50;

        // Solar production (kW) - bell curve during daylight
        let solarProduction = 0;
        if (hour >= 6 && hour < 19) {
          const solarHour = hour + minute / 60;
          const peakHour = 12.5;
          const hourFromPeak = Math.abs(solarHour - peakHour);
          solarProduction = Math.max(0, 400 * Math.exp(-Math.pow(hourFromPeak / 4, 2)));
          solarProduction *= 0.8 + Math.random() * 0.4; // Add variability
        }

        // Battery state (charging/discharging based on solar-consumption difference)
        const netPower = solarProduction - consumptionPower;
        let batteryPower = 0;
        if (Math.abs(netPower) > 50) {
          batteryPower = Math.min(Math.max(netPower * 0.7, -250), 250);
        }

        // Insert measurements (converted to kWh for 15-min interval)
        const kWhFactor = 0.25; // 15 min = 0.25 hours

        measurementsToInsert.push({
          entityId: consumption.id,
          entityType: "meter",
          timestamp,
          metric: "energy",
          value: consumptionPower * kWhFactor,
          unit: "kWh",
          quality: "good",
        });

        measurementsToInsert.push({
          entityId: solar.id,
          entityType: "meter",
          timestamp,
          metric: "energy",
          value: solarProduction * kWhFactor,
          unit: "kWh",
          quality: "good",
        });

        measurementsToInsert.push({
          entityId: battery.id,
          entityType: "meter",
          timestamp,
          metric: "energy",
          value: batteryPower * kWhFactor, // Positive = charging, Negative = discharging
          unit: "kWh",
          quality: "good",
        });
      }

      if ((day + 1) % 10 === 0) {
        console.log(`   =� Generated ${day + 1}/${DAYS_OF_DATA} days...`);
      }
    }

    // Batch insert measurements (in chunks to avoid memory issues)
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < measurementsToInsert.length; i += CHUNK_SIZE) {
      const chunk = measurementsToInsert.slice(i, i + CHUNK_SIZE);
      await db.insert(measurements).values(chunk).onConflictDoNothing();
    }

    console.log(`    Inserted ${measurementsToInsert.length.toLocaleString()} measurements`);

    // Step 6: Create electricity pricing data
    console.log("\n6�  Creating electricity pricing data...");

    await db
      .insert(electricityPricing)
      .values({
        siteId: site!.id,
        region: "San Francisco, CA", // Match site location
        utilityProvider: "PG&E",
        rateType: "time_of_use",
        rateStructure: {
          peak: 0.45,
          partPeak: 0.30,
          offPeak: 0.18,
        },
        currency: "USD",
        demandCharge: 18.50,
        validFrom: new Date(now.getFullYear(), 0, 1), // Start of current year
        metadata: {
          rateSchedule: "E-TOU-C",
          peakHours: [16, 17, 18, 19, 20, 21], // 4 PM - 9 PM
          summerMonths: [6, 7, 8, 9],
          winterMonths: [1, 2, 3, 4, 5, 10, 11, 12],
        },
      })
      .onConflictDoNothing();

    console.log("    Created TOU pricing structure (PG&E E-TOU-C)");

    // Step 7: Create grid carbon intensity data
    console.log("\n7�  Creating grid carbon intensity data...");

    const carbonData: typeof gridCarbonIntensity.$inferInsert[] = [];
    // Generate forecast for next 24 hours starting from current hour
    const currentHour = now.getHours();
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now);
      timestamp.setHours(currentHour + i, 0, 0, 0);
      timestamp.setMinutes(0);
      timestamp.setSeconds(0);
      timestamp.setMilliseconds(0);

      // Realistic carbon intensity pattern (gCO2/kWh)
      // Lower at night (more renewables), higher during peak
      const hour = timestamp.getHours();
      let intensity = 300;
      if (hour >= 10 && hour < 16) {
        intensity = 200; // Solar peak
      } else if (hour >= 18 && hour < 22) {
        intensity = 450; // Evening peak (natural gas)
      }

      carbonData.push({
        region: "San Francisco, CA", // Match site location for proper querying
        timestamp,
        carbonIntensity: intensity + (Math.random() - 0.5) * 50,
        forecastType: "forecast",
        dataSource: "WattTime",
      });
    }

    await db.insert(gridCarbonIntensity).values(carbonData).onConflictDoNothing();
    console.log("    Created 24-hour carbon intensity forecast");

    // Step 8: Create AI recommendations
    console.log("\n8�  Creating AI recommendations...");

    // Create time windows for recommendations (today + tomorrow)
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const recommendationsData: typeof recommendations.$inferInsert[] = [
      {
        siteId: site!.id,
        type: "cost",
        headline: "Shift EV Charging to Off-Peak Hours",
        description:
          "Move electric vehicle charging from peak hours (4-9 PM) to off-peak hours (11 PM - 6 AM) to save on time-of-use rates.",
        costSavings: 2400,
        co2Reduction: 1200,
        confidence: 0.85,
        actionType: "load_shifting",
        recommendedTimeStart: new Date(today.getTime() + 23 * 60 * 60 * 1000), // 11 PM today
        recommendedTimeEnd: new Date(tomorrow.getTime() + 6 * 60 * 60 * 1000), // 6 AM tomorrow
        status: "pending",
        supportingData: {
          implementationSteps: [
            "Configure EV charger timer settings",
            "Set charging schedule for 11 PM start time",
            "Monitor first week of adjusted charging",
          ],
          affectedEquipment: ["EV Chargers"],
          savingsBreakdown: {
            energyCost: 2400,
            demandCharge: 0,
          },
        },
      },
      {
        siteId: site!.id,
        type: "cost",
        headline: "Use Battery Storage During Peak Hours",
        description:
          "Discharge battery system during peak rate hours (4-9 PM) to avoid expensive electricity and reduce demand charges.",
        costSavings: 5600,
        co2Reduction: 2800,
        confidence: 0.90,
        actionType: "peak_avoidance",
        recommendedTimeStart: new Date(today.getTime() + 16 * 60 * 60 * 1000), // 4 PM today
        recommendedTimeEnd: new Date(today.getTime() + 21 * 60 * 60 * 1000), // 9 PM today
        status: "pending",
        supportingData: {
          implementationSteps: [
            "Configure battery dispatch schedule",
            "Set peak-shaving threshold at 350 kW",
            "Enable automatic discharge 4-9 PM daily",
          ],
          affectedEquipment: ["Tesla Megapack"],
          savingsBreakdown: {
            energyCost: 3200,
            demandCharge: 2400,
          },
        },
      },
      {
        siteId: site!.id,
        type: "carbon",
        headline: "Increase Solar Self-Consumption",
        description:
          "Schedule heavy equipment operation during solar production hours (10 AM - 3 PM) to maximize clean energy usage.",
        costSavings: 1800,
        co2Reduction: 8500,
        confidence: 0.75,
        actionType: "carbon_reduction",
        recommendedTimeStart: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10 AM today
        recommendedTimeEnd: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 3 PM today
        status: "pending",
        supportingData: {
          implementationCost: 500,
          paybackPeriod: 0.3,
          implementationSteps: [
            "Identify flexible load equipment",
            "Create optimal operation schedule",
            "Implement scheduling automation",
            "Monitor carbon intensity metrics",
          ],
          affectedEquipment: ["HVAC Systems", "Industrial Equipment"],
        },
      },
    ];

    await db.insert(recommendations).values(recommendationsData).onConflictDoNothing();
    console.log(`    Created ${recommendationsData.length} AI recommendations`);

    // Summary
    console.log("\n( Seed completed successfully!\n");
    console.log("=� Summary:");
    console.log(`   " User: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log(`   " Site: ${site!.name}`);
    console.log(`   " Meters: 3 (Consumption, Solar, Battery)`);
    console.log(`   " Measurements: ${measurementsToInsert.length.toLocaleString()} data points (${DAYS_OF_DATA} days)`);
    console.log(`   " Recommendations: ${recommendationsData.length} optimization opportunities`);
    console.log(`   " Estimated annual savings: $${(2400 + 5600 + 1800).toLocaleString()}`);
    console.log(`   " Estimated carbon reduction: ${((1200 + 2800 + 8500) / 1000).toFixed(1)} tonnes CO2/year\n`);

    console.log("=� You can now:");
    console.log(`   1. Login with: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    console.log("   2. View dashboard with real data");
    console.log("   3. Explore 30 days of energy patterns");
    console.log("   4. Review AI-generated recommendations");

  } catch (error) {
    console.error("\nL Error seeding database:", error);
    throw error;
  }
}

// Run the seed
main()
  .then(() => {
    console.log("\n Database seed complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nL Database seed failed:", error);
    process.exit(1);
  });
