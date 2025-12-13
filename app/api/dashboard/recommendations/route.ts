import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites, recommendations } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const status = searchParams.get("status") || "pending";
    const timeRange = searchParams.get("timeRange") || "today";
    // const region = searchParams.get("region") || "all"; // TODO: Implement region filtering when needed

    console.log(`[RECOMMENDATIONS API] Called with userId=${userId}, siteId=${siteId}, status=${status}, timeRange=${timeRange}`);

    // Get all user sites or specific site
    let userSites;
    if (siteId) {
      // Get specific site
      userSites = await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.userId, userId))).limit(1);
    } else {
      // Get all active sites for user
      userSites = await db.select().from(sites).where(and(eq(sites.active, true), eq(sites.userId, userId)));
    }

    console.log(`[RECOMMENDATIONS API] Found ${userSites?.length || 0} sites for user`);

    if (!userSites || userSites.length === 0) {
      console.log(`[RECOMMENDATIONS API] No sites found, returning empty array`);
      return NextResponse.json({ recommendations: [] });
    }

    const now = new Date();

    // Calculate time window based on timeRange
    let startTime: Date | null = null;
    let endTime: Date | null = null;

    switch (timeRange) {
      case "tomorrow":
        startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(startTime);
        endTime.setHours(23, 59, 59, 999);
        break;
      case "7days":
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        endTime.setHours(23, 59, 59, 999);
        break;
      default: // "today"
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(now);
        endTime.setHours(23, 59, 59, 999);
    }

    // Build query conditions - if siteId provided, filter by it; otherwise get all sites
    const conditions = siteId
      ? [eq(recommendations.siteId, siteId)]
      : [];

    // Add status filter if not "all"
    if (status !== "all") {
      conditions.push(eq(recommendations.status, status));
    }

    // Add time range filter if recommendedTimeStart is available
    if (startTime && endTime) {
      console.log(`[DEBUG] Filtering recommendations for timeRange: ${timeRange}`);
      console.log(`[DEBUG] Start time: ${startTime.toISOString()} (${startTime})`);
      console.log(`[DEBUG] End time: ${endTime.toISOString()} (${endTime})`);

      // Format dates as strings without timezone for comparison with timestamp columns
      const formatTimestamp = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
      };

      const startTimeStr = formatTimestamp(startTime);
      const endTimeStr = formatTimestamp(endTime);
      console.log(`[DEBUG] Formatted start: ${startTimeStr}`);
      console.log(`[DEBUG] Formatted end: ${endTimeStr}`);

      // Use raw SQL to compare timestamps without timezone conversion
      conditions.push(
        sql`recommended_time_start >= ${startTimeStr}::timestamp`,
        sql`recommended_time_start <= ${endTimeStr}::timestamp`
      );
    }

    // Fetch recommendations
    const recs = await db
      .select()
      .from(recommendations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(recommendations.confidence));

    console.log(`[RECOMMENDATIONS API] Query conditions:`, conditions.map(c => c.toString()));
    console.log(`[RECOMMENDATIONS API] Found ${recs.length} recommendations matching criteria`);
    if (recs.length > 0) {
      console.log(`[RECOMMENDATIONS API] Sample recommendation:`, {
        id: recs[0].id,
        headline: recs[0].headline,
        siteId: recs[0].siteId,
        status: recs[0].status,
        recommendedTimeStart: recs[0].recommendedTimeStart
      });
    }

    // Create a map of siteId to siteName for efficient lookup
    const siteMap = new Map(userSites.map(s => [s.id, s.name]));

    // Map to frontend format
    const mappedRecs = recs.map((rec) => ({
      id: rec.id,
      headline: rec.headline,
      description: rec.description,
      type: rec.type,
      site: siteMap.get(rec.siteId) || "Unknown Site",
      timestamp: rec.createdAt.toISOString(),
      status: rec.status,
      confidence: rec.confidence,
      costSavings: rec.costSavings?.toFixed(0) || "0",
      co2Reduction: rec.co2Reduction?.toFixed(1) || "0",
      priority: rec.confidence > 90 ? "high" : rec.confidence > 80 ? "medium" : "low",
      metadata: rec.supportingData,
    }));

    return NextResponse.json({
      success: true,
      recommendations: mappedRecs,
      count: mappedRecs.length,
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch recommendations",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
