import { NextResponse } from "next/server";
import { db } from "@/db";
import { consumptionForecasts, sites } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const hours = parseInt(searchParams.get("hours") || "24");

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 }
      );
    }

    // Verify the site belongs to the current user
    const site = await db.query.sites.findFirst({
      where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
    });

    if (!site) {
      return NextResponse.json(
        { error: "Site not found or access denied" },
        { status: 403 }
      );
    }

    // Get the latest forecasts for this site
    const forecasts = await db
      .select()
      .from(consumptionForecasts)
      .where(eq(consumptionForecasts.siteId, siteId))
      .orderBy(desc(consumptionForecasts.generatedAt), consumptionForecasts.forecastTimestamp)
      .limit(hours);

    if (forecasts.length === 0) {
      return NextResponse.json({
        success: true,
        forecasts: [],
        message: "No forecasts found for this site",
      });
    }

    const latestGeneratedAt = forecasts[0]?.generatedAt;

    return NextResponse.json({
      success: true,
      forecasts: forecasts.map((f) => ({
        timestamp: f.forecastTimestamp,
        predictedValue: f.predictedValue,
        lowerBound: f.lowerBound,
        upperBound: f.upperBound,
        unit: f.unit,
        confidence: f.confidence,
        modelType: f.modelType,
        horizonHours: f.forecastHorizonHours,
      })),
      generatedAt: latestGeneratedAt,
      count: forecasts.length,
    });
  } catch (error) {
    console.error("Error fetching consumption forecasts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch forecasts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
