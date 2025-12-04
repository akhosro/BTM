import { NextResponse } from "next/server";
import { db } from "@/db";
import { isoMarketPrices } from "@/db/schema";
import { fetchIESOForecastPrices, fetchIESOActualPrices } from "@/lib/services/ieso-api";
import { and, eq, gte, lte } from "drizzle-orm";

/**
 * Sync ISO Market Prices - Fetch and Store IESO Prices
 *
 * POST /api/iso-prices/sync
 *
 * This endpoint fetches price data from IESO and stores it in the database.
 * It can be called manually or scheduled via cron job.
 *
 * Body parameters:
 * - priceType: "forecast" | "actual" | "both" (default: "forecast")
 * - startDate: ISO date string (for actual prices)
 * - endDate: ISO date string (for actual prices)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { priceType = "forecast", startDate, endDate } = body;

    const results = {
      forecast: { fetched: 0, stored: 0, skipped: 0 },
      actual: { fetched: 0, stored: 0, skipped: 0 },
    };

    // Fetch and store forecast prices
    if (priceType === "forecast" || priceType === "both") {
      try {
        const forecastPrices = await fetchIESOForecastPrices();
        results.forecast.fetched = forecastPrices.length;

        const now = new Date();

        for (const priceData of forecastPrices) {
          // Check if this exact forecast already exists
          const existing = await db.query.isoMarketPrices.findFirst({
            where: and(
              eq(isoMarketPrices.iso, "IESO"),
              eq(isoMarketPrices.timestamp, priceData.timestamp),
              eq(isoMarketPrices.priceType, "forecast"),
              eq(isoMarketPrices.forecastedAt, priceData.forecastedAt!)
            ),
          });

          if (existing) {
            results.forecast.skipped++;
            continue;
          }

          // Store the forecast price
          await db.insert(isoMarketPrices).values({
            iso: "IESO",
            region: "Ontario",
            priceType: "forecast",
            marketType: "energy",
            timestamp: priceData.timestamp,
            price: priceData.price,
            currency: "CAD",
            forecastedAt: priceData.forecastedAt,
            forecastHorizonHours: priceData.forecastHorizonHours?.toString(),
            dataSource: "IESO_API",
            metadata: {
              syncedAt: now.toISOString(),
            },
          });

          results.forecast.stored++;
        }
      } catch (error) {
        console.error("Error syncing forecast prices:", error);
        return NextResponse.json(
          { error: "Failed to sync forecast prices", details: String(error) },
          { status: 500 }
        );
      }
    }

    // Fetch and store actual prices
    if (priceType === "actual" || priceType === "both") {
      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: "startDate and endDate are required for actual prices" },
          { status: 400 }
        );
      }

      try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const actualPrices = await fetchIESOActualPrices(start, end);
        results.actual.fetched = actualPrices.length;

        for (const priceData of actualPrices) {
          // Check if this actual price already exists
          const existing = await db.query.isoMarketPrices.findFirst({
            where: and(
              eq(isoMarketPrices.iso, "IESO"),
              eq(isoMarketPrices.timestamp, priceData.timestamp),
              eq(isoMarketPrices.priceType, "actual")
            ),
          });

          if (existing) {
            results.actual.skipped++;
            continue;
          }

          // Store the actual price
          await db.insert(isoMarketPrices).values({
            iso: "IESO",
            region: "Ontario",
            priceType: "actual",
            marketType: "energy",
            timestamp: priceData.timestamp,
            price: priceData.price,
            currency: "CAD",
            dataSource: "IESO_API",
            metadata: {
              syncedAt: new Date().toISOString(),
            },
          });

          results.actual.stored++;
        }
      } catch (error) {
        console.error("Error syncing actual prices:", error);
        return NextResponse.json(
          { error: "Failed to sync actual prices", details: String(error) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "ISO prices synced successfully",
      results,
    });
  } catch (error) {
    console.error("Error in ISO prices sync:", error);
    return NextResponse.json(
      { error: "Failed to sync ISO prices", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get sync status and latest prices
 *
 * GET /api/iso-prices/sync
 */
export async function GET() {
  try {
    // Get latest forecast
    const latestForecast = await db.query.isoMarketPrices.findFirst({
      where: and(
        eq(isoMarketPrices.iso, "IESO"),
        eq(isoMarketPrices.priceType, "forecast")
      ),
      orderBy: (isoMarketPrices, { desc }) => [desc(isoMarketPrices.forecastedAt)],
    });

    // Get latest actual
    const latestActual = await db.query.isoMarketPrices.findFirst({
      where: and(
        eq(isoMarketPrices.iso, "IESO"),
        eq(isoMarketPrices.priceType, "actual")
      ),
      orderBy: (isoMarketPrices, { desc }) => [desc(isoMarketPrices.timestamp)],
    });

    // Count total records
    const forecastCount = await db
      .select()
      .from(isoMarketPrices)
      .where(
        and(
          eq(isoMarketPrices.iso, "IESO"),
          eq(isoMarketPrices.priceType, "forecast")
        )
      );

    const actualCount = await db
      .select()
      .from(isoMarketPrices)
      .where(
        and(
          eq(isoMarketPrices.iso, "IESO"),
          eq(isoMarketPrices.priceType, "actual")
        )
      );

    return NextResponse.json({
      status: "ready",
      forecast: {
        count: forecastCount.length,
        latest: latestForecast,
      },
      actual: {
        count: actualCount.length,
        latest: latestActual,
      },
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
