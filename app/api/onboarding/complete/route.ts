import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites, meters, energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { config } = body;

    if (!config || !config.sites || config.sites.length === 0) {
      return NextResponse.json(
        { error: "At least one site is required" },
        { status: 400 }
      );
    }

    // Start a transaction
    const result = await db.transaction(async (tx) => {
      const createdSites: any[] = [];
      const createdMeters: any[] = [];
      const createdEnergySources: any[] = [];

      // 1. Create all sites
      for (const siteConfig of config.sites) {
        const [site] = await tx
          .insert(sites)
          .values({
            name: siteConfig.name,
            location: siteConfig.location,
            latitude: siteConfig.latitude,
            longitude: siteConfig.longitude,
            industryType: siteConfig.industryType,
            metadata: {
              estimatedLoad: siteConfig.estimatedLoad,
            },
          })
          .returning();

        createdSites.push(site);

        // 3. Create a default consumption meter for each site
        const [consumptionMeter] = await tx
          .insert(meters)
          .values({
            siteId: site.id,
            name: `${site.name} - Main Consumption`,
            category: "CONS",
            capacity: siteConfig.estimatedLoad,
            readingFrequency: "15min",
          })
          .returning();

        createdMeters.push(consumptionMeter);
      }

      // Get the first site for energy sources (they can be moved later)
      const primarySite = createdSites[0];

      // 4. Create production meter for energy sources if any assets are configured
      let productionMeter = null;
      if (config.assets.solar || config.assets.battery || config.assets.generator) {
        const [prodMeter] = await tx
          .insert(meters)
          .values({
            siteId: primarySite.id,
            name: `${primarySite.name} - Production`,
            category: "PROD",
            readingFrequency: "15min",
          })
          .returning();

        productionMeter = prodMeter;
        createdMeters.push(prodMeter);
      }

      // 5. Create storage meter for battery if configured
      let storageMeter = null;
      if (config.assets.battery) {
        const [storMeter] = await tx
          .insert(meters)
          .values({
            siteId: primarySite.id,
            name: `${primarySite.name} - Storage`,
            category: "STOR",
            capacity: config.battery?.capacity,
            readingFrequency: "15min",
          })
          .returning();

        storageMeter = storMeter;
        createdMeters.push(storMeter);
      }

      // 6. Create injection meter for grid export if configured
      let injectionMeter = null;
      if (config.assets.solar || config.assets.battery) {
        const [injMeter] = await tx
          .insert(meters)
          .values({
            siteId: primarySite.id,
            name: `${primarySite.name} - Grid Injection`,
            category: "INJ",
            readingFrequency: "15min",
          })
          .returning();

        injectionMeter = injMeter;
        createdMeters.push(injMeter);
      }

      // 7. Create energy sources based on config
      if (config.solar && productionMeter) {
        const [solarSource] = await tx
          .insert(energySources)
          .values({
            meterId: productionMeter.id,
            name: `Solar Array - ${config.solar.provider}`,
            sourceType: "solar",
            capacity: config.solar.systemSize,
            metadata: {
              provider: config.solar.provider,
            },
          })
          .returning();

        createdEnergySources.push(solarSource);
      }

      if (config.battery && storageMeter) {
        const [batterySource] = await tx
          .insert(energySources)
          .values({
            meterId: storageMeter.id,
            name: `Battery Storage - ${config.battery.provider}`,
            sourceType: "battery",
            capacity: config.battery.capacity,
            metadata: {
              provider: config.battery.provider,
              currentCharge: config.battery.currentCharge,
            },
          })
          .returning();

        createdEnergySources.push(batterySource);
      }

      if (config.generator && productionMeter) {
        const [generatorSource] = await tx
          .insert(energySources)
          .values({
            meterId: productionMeter.id,
            name: `Generator - ${config.generator.fuelType}`,
            sourceType: "generator",
            capacity: config.generator.capacity,
            metadata: {
              fuelType: config.generator.fuelType,
              runtime: config.generator.runtime,
            },
          })
          .returning();

        createdEnergySources.push(generatorSource);
      }

      if (config.evChargers) {
        // Create EV chargers as a consumption meter
        const [evMeter] = await tx
          .insert(meters)
          .values({
            siteId: primarySite.id,
            name: `EV Charging Station`,
            category: "CONS",
            capacity: config.evChargers.count * config.evChargers.powerRating,
            readingFrequency: "15min",
            metadata: {
              chargerCount: config.evChargers.count,
              powerRating: config.evChargers.powerRating,
              network: config.evChargers.network,
            },
          })
          .returning();

        createdMeters.push(evMeter);
      }

      return {
        sites: createdSites,
        meters: createdMeters,
        energySources: createdEnergySources,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "Onboarding completed successfully",
    });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding", details: error },
      { status: 500 }
    );
  }
}
