import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites, meters, energySources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

// GET all sites with their complete hierarchy
// This replaces the old portfolios endpoint
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    // Get only sites belonging to the current user
    const allSites = await db.query.sites.findMany({
      where: eq(sites.userId, userId),
      with: {
        meters: {
          with: {
            energySources: true,
          },
        },
      },
    });

    return NextResponse.json(allSites);
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
    const { name, location, industryType, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Site name is required" },
        { status: 400 }
      );
    }

    const [newSite] = await db
      .insert(sites)
      .values({
        userId, // Assign site to current user
        name,
        location,
        industryType: industryType || "other",
        description,
      })
      .returning();

    return NextResponse.json(newSite, { status: 201 });
  } catch (error) {
    console.error("Error creating site:", error);
    return NextResponse.json(
      { error: "Failed to create site" },
      { status: 500 }
    );
  }
}
