import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { forecastSolarProduction, validateForecastAccuracy } from "@/lib/ml/solar-forecast";
import { db } from "@/db";
import { meters, sites } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/ml/solar-forecast
 * Get solar production forecast for a meter
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);

    const meterId = searchParams.get("meterId");
    const days = parseInt(searchParams.get("days") || "1");
    const validate = searchParams.get("validate") === "true";

    if (!meterId) {
      return NextResponse.json(
        { error: "Missing meterId parameter" },
        { status: 400 }
      );
    }

    // Verify user owns this meter
    const meter = await db.query.meters.findFirst({
      where: eq(meters.id, meterId),
      with: {
        site: true,
      },
    });

    if (!meter || meter.site?.userId !== userId) {
      return NextResponse.json(
        { error: "Meter not found or access denied" },
        { status: 404 }
      );
    }

    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000); // Start 1 hour from now
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Generate forecast
    const forecasts = await forecastSolarProduction({
      meterId,
      startDate,
      endDate,
    });

    // Calculate totals by day
    const dailyTotals: Record<string, number> = {};
    for (const forecast of forecasts) {
      const day = forecast.timestamp.toISOString().split("T")[0];
      dailyTotals[day] = (dailyTotals[day] || 0) + forecast.expectedProduction;
    }

    let accuracy = null;
    if (validate) {
      // Validate against historical data
      const validationStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      accuracy = await validateForecastAccuracy(
        meterId,
        validationStart,
        now
      );
    }

    return NextResponse.json({
      success: true,
      forecast: {
        meterId,
        meterName: meter.name,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        intervals: forecasts.map((f) => ({
          timestamp: f.timestamp.toISOString(),
          expectedProduction: Math.round(f.expectedProduction * 100) / 100,
          confidence: Math.round(f.confidence * 100),
          weather: f.weatherImpact,
        })),
        dailyTotals: Object.entries(dailyTotals).map(([date, total]) => ({
          date,
          total: Math.round(total * 100) / 100,
        })),
        totalExpectedProduction: Math.round(
          forecasts.reduce((sum, f) => sum + f.expectedProduction, 0) * 100
        ) / 100,
      },
      accuracy,
    });
  } catch (error) {
    console.error("Error generating solar forecast:", error);
    return NextResponse.json(
      {
        error: "Failed to generate solar forecast",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
