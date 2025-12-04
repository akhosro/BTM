import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { calculateSavings, calculateForecastAccuracy } from "@/lib/services/savings-calculator";

/**
 * Get savings analysis for a site
 *
 * GET /api/dashboard/savings?siteId=<uuid>&startDate=<iso>&endDate=<iso>
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get("siteId");
    if (!siteId) {
      return NextResponse.json(
        { error: "siteId is required" },
        { status: 400 }
      );
    }

    // Default to last 7 days
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : defaultStartDate;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : now;

    // Calculate savings
    const savings = await calculateSavings(siteId, startDate, endDate);

    // Calculate forecast accuracy (if we have both forecast and actual data)
    let accuracy = null;
    try {
      accuracy = await calculateForecastAccuracy(startDate, endDate);
    } catch (error) {
      console.log("Forecast accuracy calculation skipped:", error);
      // Not critical - may not have enough data yet
    }

    return NextResponse.json({
      success: true,
      siteId,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      savings,
      accuracy,
    });
  } catch (error) {
    console.error("Error calculating savings:", error);
    return NextResponse.json(
      {
        error: "Failed to calculate savings",
        details: String(error),
      },
      { status: 500 }
    );
  }
}
