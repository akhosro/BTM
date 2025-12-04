import { NextResponse } from "next/server";
import { db } from "@/db";
import { isoMarketPrices } from "@/db/schema";
import { fetchIESOForecastPrices, fetchIESOActualPrices } from "@/lib/services/ieso-api";
import { fetchCAISOForecastPrices, fetchCAISOActualPrices } from "@/lib/services/caiso-api";
import { eq, and } from "drizzle-orm";

/**
 * Scheduled ISO Price Sync
 *
 * This endpoint is designed to be called by a cron job or scheduler.
 * Supports multiple ISOs: IESO (Ontario), CAISO (California)
 *
 * Recommended schedule:
 * - Forecasts: Daily at 6 AM (after ISOs publish day-ahead prices)
 * - Actuals: Hourly (to capture real-time prices with 1-2 hour delay)
 *
 * Authentication: Uses API key for security
 *
 * POST /api/scheduled/iso-sync
 * Headers: X-Cron-Secret: <your-secret-key>
 * Body: { "type": "forecast" | "actual", "iso": "IESO" | "CAISO" | "both" }
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get("X-Cron-Secret");
    const expectedSecret = process.env.CRON_SECRET || "dev-secret-key";

    if (cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type = "both", iso = "both" } = body;

    const results = {
      IESO: {
        forecast: { fetched: 0, stored: 0, skipped: 0, errors: [] as string[] },
        actual: { fetched: 0, stored: 0, skipped: 0, errors: [] as string[] },
      },
      CAISO: {
        forecast: { fetched: 0, stored: 0, skipped: 0, errors: [] as string[] },
        actual: { fetched: 0, stored: 0, skipped: 0, errors: [] as string[] },
      },
    };

    // Sync forecast prices (daily)
    if (type === "forecast" || type === "both") {
      // IESO Forecasts
      if (iso === "IESO" || iso === "both") {
        try {
          console.log("[Scheduled Sync] Fetching IESO forecast prices...");
          const forecastPrices = await fetchIESOForecastPrices();
          results.IESO.forecast.fetched = forecastPrices.length;

          const now = new Date();

          for (const priceData of forecastPrices) {
            try {
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
                results.IESO.forecast.skipped++;
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
                  scheduledSync: true,
                },
              });

              results.IESO.forecast.stored++;
            } catch (error) {
              results.IESO.forecast.errors.push(`Failed to store forecast for ${priceData.timestamp}: ${error}`);
            }
          }

          console.log(`[Scheduled Sync] IESO forecast sync complete: ${results.IESO.forecast.stored} stored, ${results.IESO.forecast.skipped} skipped`);
        } catch (error) {
          console.error("[Scheduled Sync] Error syncing IESO forecast prices:", error);
          results.IESO.forecast.errors.push(String(error));
        }
      }

      // CAISO Forecasts
      if (iso === "CAISO" || iso === "both") {
        try {
          console.log("[Scheduled Sync] Fetching CAISO forecast prices...");
          const forecastPrices = await fetchCAISOForecastPrices();
          results.CAISO.forecast.fetched = forecastPrices.length;

          const now = new Date();

          for (const priceData of forecastPrices) {
            try {
              // Check if this exact forecast already exists
              const existing = await db.query.isoMarketPrices.findFirst({
                where: and(
                  eq(isoMarketPrices.iso, "CAISO"),
                  eq(isoMarketPrices.timestamp, priceData.timestamp),
                  eq(isoMarketPrices.priceType, "forecast"),
                  eq(isoMarketPrices.forecastedAt, priceData.forecastedAt!)
                ),
              });

              if (existing) {
                results.CAISO.forecast.skipped++;
                continue;
              }

              // Store the forecast price
              await db.insert(isoMarketPrices).values({
                iso: "CAISO",
                region: "California",
                priceType: "forecast",
                marketType: "energy",
                timestamp: priceData.timestamp,
                price: priceData.price,
                currency: "USD",
                forecastedAt: priceData.forecastedAt,
                forecastHorizonHours: priceData.forecastHorizonHours?.toString(),
                dataSource: "CAISO_OASIS",
                metadata: {
                  syncedAt: now.toISOString(),
                  scheduledSync: true,
                  node: priceData.node,
                },
              });

              results.CAISO.forecast.stored++;
            } catch (error) {
              results.CAISO.forecast.errors.push(`Failed to store forecast for ${priceData.timestamp}: ${error}`);
            }
          }

          console.log(`[Scheduled Sync] CAISO forecast sync complete: ${results.CAISO.forecast.stored} stored, ${results.CAISO.forecast.skipped} skipped`);
        } catch (error) {
          console.error("[Scheduled Sync] Error syncing CAISO forecast prices:", error);
          results.CAISO.forecast.errors.push(String(error));
        }
      }
    }

    // Sync actual prices (hourly - last 3 hours with delay)
    if (type === "actual" || type === "both") {
      // IESO Actuals
      if (iso === "IESO" || iso === "both") {
        try {
          console.log("[Scheduled Sync] Fetching IESO actual prices...");

          // Fetch last 3 hours of data (accounting for IESO's publication delay)
          const now = new Date();
          const endDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
          const startDate = new Date(endDate.getTime() - 3 * 60 * 60 * 1000); // 5 hours ago

          const actualPrices = await fetchIESOActualPrices(startDate, endDate);
          results.IESO.actual.fetched = actualPrices.length;

          for (const priceData of actualPrices) {
            try {
              // Check if this actual price already exists
              const existing = await db.query.isoMarketPrices.findFirst({
                where: and(
                  eq(isoMarketPrices.iso, "IESO"),
                  eq(isoMarketPrices.timestamp, priceData.timestamp),
                  eq(isoMarketPrices.priceType, "actual")
                ),
              });

              if (existing) {
                results.IESO.actual.skipped++;
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
                  syncedAt: now.toISOString(),
                  scheduledSync: true,
                },
              });

              results.IESO.actual.stored++;
            } catch (error) {
              results.IESO.actual.errors.push(`Failed to store actual for ${priceData.timestamp}: ${error}`);
            }
          }

          console.log(`[Scheduled Sync] IESO actual sync complete: ${results.IESO.actual.stored} stored, ${results.IESO.actual.skipped} skipped`);
        } catch (error) {
          console.error("[Scheduled Sync] Error syncing IESO actual prices:", error);
          results.IESO.actual.errors.push(String(error));
        }
      }

      // CAISO Actuals
      if (iso === "CAISO" || iso === "both") {
        try {
          console.log("[Scheduled Sync] Fetching CAISO actual prices...");

          // Fetch last 3 hours of data
          const now = new Date();
          const endDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
          const startDate = new Date(endDate.getTime() - 3 * 60 * 60 * 1000); // 5 hours ago

          const actualPrices = await fetchCAISOActualPrices(startDate, endDate);
          results.CAISO.actual.fetched = actualPrices.length;

          for (const priceData of actualPrices) {
            try {
              // Check if this actual price already exists
              const existing = await db.query.isoMarketPrices.findFirst({
                where: and(
                  eq(isoMarketPrices.iso, "CAISO"),
                  eq(isoMarketPrices.timestamp, priceData.timestamp),
                  eq(isoMarketPrices.priceType, "actual")
                ),
              });

              if (existing) {
                results.CAISO.actual.skipped++;
                continue;
              }

              // Store the actual price
              await db.insert(isoMarketPrices).values({
                iso: "CAISO",
                region: "California",
                priceType: "actual",
                marketType: "energy",
                timestamp: priceData.timestamp,
                price: priceData.price,
                currency: "USD",
                dataSource: "CAISO_OASIS",
                metadata: {
                  syncedAt: now.toISOString(),
                  scheduledSync: true,
                  node: priceData.node,
                },
              });

              results.CAISO.actual.stored++;
            } catch (error) {
              results.CAISO.actual.errors.push(`Failed to store actual for ${priceData.timestamp}: ${error}`);
            }
          }

          console.log(`[Scheduled Sync] CAISO actual sync complete: ${results.CAISO.actual.stored} stored, ${results.CAISO.actual.skipped} skipped`);
        } catch (error) {
          console.error("[Scheduled Sync] Error syncing CAISO actual prices:", error);
          results.CAISO.actual.errors.push(String(error));
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Scheduled sync completed",
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("[Scheduled Sync] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Scheduled sync failed",
        details: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Get sync schedule information
 *
 * GET /api/scheduled/iso-sync
 */
export async function GET() {
  return NextResponse.json({
    supportedISOs: ["IESO", "CAISO"],
    schedule: {
      forecast: {
        frequency: "Daily at 6:00 AM local time",
        description: "Fetch day-ahead forecast prices from ISOs",
        endpoint: "POST /api/scheduled/iso-sync",
        body: { type: "forecast", iso: "both" },
        isoSpecific: {
          IESO: "6:00 AM EST - After IESO publishes day-ahead prices",
          CAISO: "6:00 AM PST - After CAISO publishes day-ahead prices",
        },
      },
      actual: {
        frequency: "Every hour",
        description: "Fetch real-time actual prices from ISOs (with 2-hour delay)",
        endpoint: "POST /api/scheduled/iso-sync",
        body: { type: "actual", iso: "both" },
      },
    },
    setup: {
      cronSecret: "Set CRON_SECRET environment variable",
      header: "X-Cron-Secret: <your-secret-key>",
      examples: {
        vercel: "Use Vercel Cron Jobs in vercel.json",
        github: "Use GitHub Actions scheduled workflows",
        manual: "Use external cron service (e.g., cron-job.org, EasyCron)",
      },
    },
  });
}
