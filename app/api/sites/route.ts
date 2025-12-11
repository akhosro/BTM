import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";
import { validateAndGetGridZone } from "@/lib/utils/geocoding";

// GET fetch sites
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      // Get specific site - ensure it belongs to the user
      const site = await db.query.sites.findFirst({
        where: and(
          eq(sites.id, id),
          eq(sites.userId, userId)
        ),
      });

      if (!site) {
        return NextResponse.json(
          { error: "Site not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(site);
    }

    // Get all sites for the current user
    const userSites = await db.query.sites.findMany({
      where: eq(sites.userId, userId),
      with: {
        meters: {
          with: {
            energySources: true,
          },
        },
      },
    });
    return NextResponse.json(userSites);
  } catch (error) {
    console.error("Error fetching sites:", error);
    return NextResponse.json(
      { error: "Failed to fetch sites" },
      { status: 500 }
    );
  }
}

// POST create a new site
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const { name, location, latitude, longitude, gridZone, industryType, description, estimatedLoad } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Site name is required" },
        { status: 400 }
      );
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    // Validate coordinates and auto-detect grid zone if not provided
    let finalGridZone = gridZone;

    if (!finalGridZone) {
      const validation = validateAndGetGridZone(latitude, longitude);
      if (!validation.success) {
        return NextResponse.json(
          { error: validation.error || "Invalid coordinates" },
          { status: 400 }
        );
      }
      finalGridZone = validation.gridZone;
    }

    const [newSite] = await db
      .insert(sites)
      .values({
        userId, // Assign site to current user
        name,
        location: location || null,
        latitude,
        longitude,
        gridZone: finalGridZone!,
        industryType: industryType || "other",
        description: description || null,
        metadata: estimatedLoad ? { estimatedLoad } : {},
      })
      .returning();

    return NextResponse.json(newSite, { status: 201 });
  } catch (error) {
    console.error("Error creating site:", error);
    return NextResponse.json(
      {
        error: "Failed to create site",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// PATCH update a site
export async function PATCH(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const { id, name, location, industryType, description, metadata, active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (industryType !== undefined) updateData.industryType = industryType;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (active !== undefined) updateData.active = active;

    // Only update if site belongs to current user
    const [updatedSite] = await db
      .update(sites)
      .set(updateData)
      .where(and(
        eq(sites.id, id),
        eq(sites.userId, userId)
      ))
      .returning();

    if (!updatedSite) {
      return NextResponse.json(
        { error: "Site not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        site: updatedSite,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating site:", error);
    return NextResponse.json(
      {
        error: "Failed to update site",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
