import { NextResponse } from "next/server";
import { db } from "@/db";
import { meters, sites } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    // Only return meters from sites belonging to the current user
    const metersWithSites = await db
      .select({
        id: meters.id,
        name: meters.name,
        category: meters.category,
        siteId: meters.siteId,
        siteName: sites.name,
        capacity: meters.capacity,
        readingFrequency: meters.readingFrequency,
      })
      .from(meters)
      .leftJoin(sites, eq(meters.siteId, sites.id))
      .where(and(eq(meters.active, true), eq(sites.userId, userId)));

    return NextResponse.json(metersWithSites, { status: 200 });
  } catch (error) {
    console.error("Error fetching meters:", error);
    return NextResponse.json(
      { error: "Failed to fetch meters" },
      { status: 500 }
    );
  }
}
