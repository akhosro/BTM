/**
 * Energy Data Sync Job
 *
 * Syncs measurement data from all connected energy sources:
 * - Enphase solar systems
 * - SolarEdge inverters
 * - Tesla Powerwall batteries
 * - UtilityAPI utility meters
 */

import { db } from "@/db";
import { energySources, measurements, meters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { EnphaseClient } from "@/lib/api-clients/enphase";
import { SolarEdgeClient } from "@/lib/api-clients/solaredge";
import { TeslaPowerwallClient } from "@/lib/api-clients/tesla";
import { UtilityAPIClient } from "@/lib/api-clients/utilityapi";

// Initialize API clients
const enphaseClient = new EnphaseClient();
const solarEdgeClient = new SolarEdgeClient();
const teslaClient = new TeslaPowerwallClient();
const utilityApiClient = new UtilityAPIClient();

export async function syncAllEnergyData() {
  const startTime = Date.now();
  let totalSynced = 0;

  try {
    // Get all active energy sources with their meters
    const sources = await db
      .select({
        source: energySources,
        meter: meters,
      })
      .from(energySources)
      .leftJoin(meters, eq(meters.id, energySources.meterId))
      .where(eq(energySources.active, true));

    console.log(`   Found ${sources.length} active energy sources to sync`);

    // Sync each source based on its type
    for (const { source, meter } of sources) {
      if (!meter) {
        console.warn(`   ⚠️  Skipping source ${source.id}: No associated meter found`);
        continue;
      }

      try {
        const synced = await syncEnergySource(source, meter);
        totalSynced += synced;
      } catch (error) {
        console.error(`   ❌ Failed to sync ${source.name}:`, error);
        // Continue with other sources even if one fails
      }
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Synced ${totalSynced} measurements in ${duration}ms`);

    return { totalSynced, duration };
  } catch (error) {
    console.error("   ❌ Energy data sync error:", error);
    throw error;
  }
}

async function syncEnergySource(
  source: typeof energySources.$inferSelect,
  meter: typeof meters.$inferSelect
) {
  const metadata = source.metadata as any;

  switch (source.sourceType) {
    case "solar": {
      if (metadata?.provider === "enphase") {
        return await syncEnphaseSystem(source, meter, metadata);
      } else if (metadata?.provider === "solaredge") {
        return await syncSolarEdgeSystem(source, meter, metadata);
      }
      console.warn(`   ⚠️  Unknown solar provider: ${metadata?.provider}`);
      return 0;
    }

    case "battery": {
      if (metadata?.provider === "tesla") {
        return await syncTeslaPowerwall(source, meter, metadata);
      }
      console.warn(`   ⚠️  Unknown battery provider: ${metadata?.provider}`);
      return 0;
    }

    case "grid":
    case "consumption": {
      // Grid/consumption data comes from utility
      return await syncUtilityMeter(source, meter, metadata);
    }

    default:
      console.warn(`   ⚠️  Unknown source type: ${source.sourceType}`);
      return 0;
  }
}

async function syncEnphaseSystem(
  source: typeof energySources.$inferSelect,
  meter: typeof meters.$inferSelect,
  metadata: any
) {
  console.log(`   🔄 Syncing Enphase system: ${source.name}`);

  if (!metadata?.systemId || !metadata?.accessToken) {
    console.warn(`   ⚠️  Missing Enphase credentials for ${source.name}`);
    return 0;
  }

  try {
    // Fetch last 24 hours of data
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

    const data = await enphaseClient.getEnergyLifetime(
      metadata.systemId,
      metadata.accessToken,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Process production data - note: production array contains Wh values
    const measurementsToInsert = data.production?.slice(0, 96).map((wh: number, idx: number) => ({
      entityId: meter.id,
      entityType: "meter" as const,
      timestamp: new Date(startDate.getTime() + idx * 15 * 60 * 1000), // 15-min intervals
      metric: "energy",
      value: wh / 1000, // Convert Wh to kWh
      unit: "kWh",
      quality: "good" as const,
    })) || [];

    if (measurementsToInsert.length > 0) {
      await db.insert(measurements).values(measurementsToInsert).onConflictDoNothing();
    }

    console.log(`   ✅ Synced ${measurementsToInsert.length} Enphase measurements`);
    return measurementsToInsert.length;
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      console.error(`   ❌ Enphase auth error - token may be expired`);
    } else if (error.message === "RATE_LIMIT_EXCEEDED") {
      console.warn(`   ⚠️  Enphase rate limit - will retry next sync`);
    } else {
      throw error;
    }
    return 0;
  }
}

async function syncSolarEdgeSystem(
  source: typeof energySources.$inferSelect,
  meter: typeof meters.$inferSelect,
  metadata: any
) {
  console.log(`   🔄 Syncing SolarEdge system: ${source.name}`);

  if (!metadata?.siteId || !metadata?.apiKey) {
    console.warn(`   ⚠️  Missing SolarEdge credentials for ${source.name}`);
    return 0;
  }

  // TODO: Implement SolarEdge sync with solarEdgeClient
  console.log(`   ℹ️  SolarEdge sync not yet implemented - skipping`);
  return 0;
}

async function syncTeslaPowerwall(
  source: typeof energySources.$inferSelect,
  meter: typeof meters.$inferSelect,
  metadata: any
) {
  console.log(`   🔄 Syncing Tesla Powerwall: ${source.name}`);

  if (!metadata?.gatewayId || !metadata?.accessToken) {
    console.warn(`   ⚠️  Missing Tesla credentials for ${source.name}`);
    return 0;
  }

  // TODO: Implement Tesla sync with teslaClient
  console.log(`   ℹ️  Tesla Powerwall sync not yet implemented - skipping`);
  return 0;
}

async function syncUtilityMeter(
  source: typeof energySources.$inferSelect,
  meter: typeof meters.$inferSelect,
  metadata: any
) {
  console.log(`   🔄 Syncing utility meter: ${source.name}`);

  if (!metadata?.authorizationId) {
    console.warn(`   ⚠️  Missing UtilityAPI authorization for ${source.name}`);
    return 0;
  }

  // TODO: Implement UtilityAPI sync with utilityApiClient
  console.log(`   ℹ️  UtilityAPI sync not yet implemented - skipping`);
  return 0;
}
