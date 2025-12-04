import { NextResponse } from "next/server";
import { db } from "@/db";
import { weatherForecasts } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const hours = parseInt(searchParams.get("hours") || "24");

    if (!siteId) {
      return NextResponse.json(
        { error: "Site ID is required" },
        { status: 400 }
      );
    }

    // Get the latest weather forecasts for this site
    const forecasts = await db
      .select()
      .from(weatherForecasts)
      .where(eq(weatherForecasts.siteId, siteId))
      .orderBy(desc(weatherForecasts.generatedAt), weatherForecasts.forecastTimestamp)
      .limit(hours);

    if (forecasts.length === 0) {
      return NextResponse.json({
        success: true,
        forecasts: [],
        message: "No weather forecasts found for this site",
      });
    }

    const latestGeneratedAt = forecasts[0]?.generatedAt;

    return NextResponse.json({
      success: true,
      forecasts: forecasts.map((f) => ({
        timestamp: f.forecastTimestamp,
        temperature: f.temperatureForecast,
        cloudCover: f.cloudCoverForecast,
        windSpeed: f.windSpeedForecast,
        precipitation: f.precipitationForecast,
        precipitationProbability: f.precipitationProbability,
        solarIrradiance: f.solarIrradianceForecast,
        solarGeneration: f.solarGenerationForecast,
        confidence: f.confidence,
        dataSource: f.dataSource,
        horizonHours: f.forecastHorizonHours,
      })),
      generatedAt: latestGeneratedAt,
      count: forecasts.length,
    });
  } catch (error) {
    console.error("Error fetching weather forecasts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch weather forecasts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
