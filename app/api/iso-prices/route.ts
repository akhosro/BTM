import { NextResponse } from "next/server";
import { db } from "@/db";
import { isoMarketPrices } from "@/db/schema";
import { and, eq, gte, lte, desc } from "drizzle-orm";

/**
 * Get ISO Market Prices
 *
 * GET /api/iso-prices?iso=IESO&priceType=forecast&startDate=2024-01-01&endDate=2024-01-02
 *
 * Query parameters:
 * - iso: ISO identifier (default: "IESO")
 * - priceType: "forecast" | "actual" | "both" (default: "forecast")
 * - startDate: ISO date string (default: now)
 * - endDate: ISO date string (default: 24 hours from now)
 * - limit: Max number of records to return (default: 100, max: 1000)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const iso = searchParams.get("iso") || "IESO";
    const priceType = searchParams.get("priceType") || "forecast";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100", 10),
      1000
    );

    // Parse date range
    const now = new Date();
    const defaultEndDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : now;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : defaultEndDate;

    // Build query conditions
    const conditions = [
      eq(isoMarketPrices.iso, iso),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate),
    ];

    // Add price type filter if not "both"
    if (priceType !== "both") {
      conditions.push(eq(isoMarketPrices.priceType, priceType as "forecast" | "actual"));
    }

    // Query prices
    const prices = await db
      .select()
      .from(isoMarketPrices)
      .where(and(...conditions))
      .orderBy(desc(isoMarketPrices.timestamp))
      .limit(limit);

    // Group by price type for easier consumption
    const forecastPrices = prices.filter((p) => p.priceType === "forecast");
    const actualPrices = prices.filter((p) => p.priceType === "actual");

    return NextResponse.json({
      success: true,
      query: {
        iso,
        priceType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit,
      },
      data: {
        forecast: {
          count: forecastPrices.length,
          prices: forecastPrices,
        },
        actual: {
          count: actualPrices.length,
          prices: actualPrices,
        },
        total: prices.length,
      },
    });
  } catch (error) {
    console.error("Error fetching ISO prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch ISO prices", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get price statistics for a date range
 *
 * Useful for recommendation engine to understand price patterns
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { iso = "IESO", startDate, endDate, priceType = "forecast" } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Query prices in date range
    const prices = await db
      .select()
      .from(isoMarketPrices)
      .where(
        and(
          eq(isoMarketPrices.iso, iso),
          eq(isoMarketPrices.priceType, priceType),
          gte(isoMarketPrices.timestamp, start),
          lte(isoMarketPrices.timestamp, end)
        )
      )
      .orderBy(isoMarketPrices.timestamp);

    if (prices.length === 0) {
      return NextResponse.json({
        success: true,
        statistics: null,
        message: "No prices found for the specified date range",
      });
    }

    // Calculate statistics
    const priceValues = prices.map((p) => p.price);
    const min = Math.min(...priceValues);
    const max = Math.max(...priceValues);
    const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;

    // Find median
    const sorted = [...priceValues].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    // Find peak and off-peak periods
    // Peak is typically top 25% of prices
    const peakThreshold = sorted[Math.floor(sorted.length * 0.75)];
    const offPeakThreshold = sorted[Math.floor(sorted.length * 0.25)];

    const peakPeriods = prices.filter((p) => p.price >= peakThreshold);
    const offPeakPeriods = prices.filter((p) => p.price <= offPeakThreshold);

    // Calculate hourly averages
    const hourlyAverages = Array(24).fill(0);
    const hourlyCounts = Array(24).fill(0);

    prices.forEach((p) => {
      const hour = new Date(p.timestamp).getHours();
      hourlyAverages[hour] += p.price;
      hourlyCounts[hour]++;
    });

    const hourlyStats = hourlyAverages.map((sum, hour) => ({
      hour,
      averagePrice: hourlyCounts[hour] > 0 ? sum / hourlyCounts[hour] : 0,
      count: hourlyCounts[hour],
    }));

    // Find best times to consume/shift load (lowest prices)
    const bestTimes = prices
      .sort((a, b) => a.price - b.price)
      .slice(0, 5)
      .map((p) => ({
        timestamp: p.timestamp,
        price: p.price,
        hour: new Date(p.timestamp).getHours(),
      }));

    return NextResponse.json({
      success: true,
      statistics: {
        count: prices.length,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        peakThreshold: Math.round(peakThreshold * 100) / 100,
        offPeakThreshold: Math.round(offPeakThreshold * 100) / 100,
        peakPeriods: {
          count: peakPeriods.length,
          averagePrice:
            Math.round(
              (peakPeriods.reduce((a, b) => a + b.price, 0) / peakPeriods.length) * 100
            ) / 100,
        },
        offPeakPeriods: {
          count: offPeakPeriods.length,
          averagePrice:
            Math.round(
              (offPeakPeriods.reduce((a, b) => a + b.price, 0) / offPeakPeriods.length) * 100
            ) / 100,
        },
        hourlyStats: hourlyStats.filter((h) => h.count > 0),
        bestTimes,
      },
    });
  } catch (error) {
    console.error("Error calculating price statistics:", error);
    return NextResponse.json(
      { error: "Failed to calculate price statistics", details: String(error) },
      { status: 500 }
    );
  }
}
