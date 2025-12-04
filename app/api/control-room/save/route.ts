import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites, meters, energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sites: sitesData, meters: metersData, deletedSiteIds, deletedMeterIds } = body;

    if (!sitesData || !Array.isArray(sitesData)) {
      return NextResponse.json(
        { error: "Sites data is required and must be an array" },
        { status: 400 }
      );
    }

    const savedSites: any[] = [];
    const savedMeters: any[] = [];
    const siteIdMap = new Map<string, string>(); // Map temp site IDs to real site IDs
    const meterIdMap = new Map<string, string>(); // Map temp meter IDs to real meter IDs

    // Handle deletions first
    if (deletedMeterIds && Array.isArray(deletedMeterIds) && deletedMeterIds.length > 0) {
      for (const meterId of deletedMeterIds) {
        await db.delete(meters).where(eq(meters.id, meterId));
      }
    }

    if (deletedSiteIds && Array.isArray(deletedSiteIds) && deletedSiteIds.length > 0) {
      for (const siteId of deletedSiteIds) {
        // Delete all meters associated with this site first
        await db.delete(meters).where(eq(meters.siteId, siteId));
        // Then delete the site
        await db.delete(sites).where(eq(sites.id, siteId));
      }
    }

    // Process sites and build ID mapping
    for (const siteData of sitesData) {
      // DEBUG: Log the incoming site data
      console.log("💾 Saving site:", JSON.stringify({
        name: siteData.name,
        location: siteData.location,
        latitude: siteData.latitude,
        longitude: siteData.longitude
      }));

      let savedSite;

      if (siteData.id) {
        // Update existing site
        const [updatedSite] = await db
          .update(sites)
          .set({
            name: siteData.name,
            location: siteData.location,
            latitude: siteData.latitude,
            longitude: siteData.longitude,
            industryType: siteData.industryType || "other",
            metadata: siteData.metadata || {},
            active: siteData.active ?? true,
            updatedAt: new Date(),
          })
          .where(eq(sites.id, siteData.id))
          .returning();
        savedSite = updatedSite;
      } else {
        // Create new site
        const [newSite] = await db
          .insert(sites)
          .values({
            name: siteData.name,
            location: siteData.location,
            latitude: siteData.latitude,
            longitude: siteData.longitude,
            industryType: siteData.industryType || "other",
            metadata: siteData.metadata || {},
            active: siteData.active ?? true,
          })
          .returning();
        savedSite = newSite;

        // Map temp ID to real ID using tempId field
        if (siteData.tempId) {
          siteIdMap.set(siteData.tempId, savedSite.id);
        }
      }

      savedSites.push(savedSite);
    }

    // Process meters with ID mapping
    if (metersData && Array.isArray(metersData)) {
      for (const meterData of metersData) {
        let siteId = meterData.siteId;

        // Map temp site ID to real site ID
        if (siteId && siteIdMap.has(siteId)) {
          siteId = siteIdMap.get(siteId)!;
        }

        if (!siteId) continue;

        // Map temp parent meter ID to real meter ID
        let parentMeterId = meterData.parentMeterId || null;
        if (parentMeterId && meterIdMap.has(parentMeterId)) {
          parentMeterId = meterIdMap.get(parentMeterId)!;
        }

        let savedMeter;

        if (meterData.id) {
          // Update existing meter
          const [updatedMeter] = await db
            .update(meters)
            .set({
              name: meterData.name,
              category: meterData.category,
              readingFrequency: meterData.readingFrequency || "15min",
              capacity: meterData.capacity,
              parentMeterId: parentMeterId,
              metadata: meterData.metadata || {},
              active: meterData.active ?? true,
              updatedAt: new Date(),
            })
            .where(eq(meters.id, meterData.id))
            .returning();
          savedMeter = updatedMeter;
        } else {
          // Create new meter
          const [newMeter] = await db
            .insert(meters)
            .values({
              siteId: siteId,
              parentMeterId: parentMeterId,
              name: meterData.name,
              category: meterData.category,
              readingFrequency: meterData.readingFrequency || "15min",
              capacity: meterData.capacity,
              metadata: meterData.metadata || {},
              active: meterData.active ?? true,
            })
            .returning();
          savedMeter = newMeter;

          // Map temp meter ID to real meter ID using tempId field
          if (meterData.tempId) {
            meterIdMap.set(meterData.tempId, savedMeter.id);
          }

          // Auto-create energy source for ALL meter types
          const sourceTypeMap: Record<string, { type: string; label: string; defaultDataSource: string }> = {
            PROD: { type: "solar", label: "Solar Panel", defaultDataSource: "manual" },
            STOR: { type: "battery", label: "Battery Storage", defaultDataSource: "manual" },
            CONS: { type: "grid_import", label: "Grid Import", defaultDataSource: "manual" },
            INJ: { type: "grid_export", label: "Grid Export", defaultDataSource: "calculated" }, // Default to calculated for injection
          };

          const sourceConfig = sourceTypeMap[savedMeter.category];
          if (sourceConfig) {
            const sourceName = `${savedMeter.name} - ${sourceConfig.label}`;

            await db.insert(energySources).values({
              meterId: savedMeter.id,
              name: sourceName,
              sourceType: sourceConfig.type,
              capacity: savedMeter.category === "STOR" ? savedMeter.capacity : null,
              metadata: {
                dataSourceType: sourceConfig.defaultDataSource,
              },
              active: true,
            });
          }
        }

        savedMeters.push(savedMeter);
      }
    }

    return NextResponse.json(
      {
        success: true,
        sites: savedSites,
        meters: savedMeters,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving canvas:", error);
    return NextResponse.json(
      { error: "Failed to save canvas", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
