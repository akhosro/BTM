import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { optimizeBatterySchedule, calculateBatterySavings, estimateBatteryHealth } from "@/lib/ml/battery-optimization";
import { db } from "@/db";
import { meters } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ml/battery-schedule
 * Generate optimal battery charge/discharge schedule
 */
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();

    const {
      batteryMeterId,
      consumptionMeterId,
      solarMeterId,
      siteId,
      days = 1,
      optimizeFor = "balanced",
    } = body;

    if (!batteryMeterId || !consumptionMeterId || !siteId) {
      return NextResponse.json(
        { error: "Missing required parameters: batteryMeterId, consumptionMeterId, siteId" },
        { status: 400 }
      );
    }

    // Verify user owns these meters
    const battery = await db.query.meters.findFirst({
      where: eq(meters.id, batteryMeterId),
      with: { site: true },
    });

    if (!battery || battery.site?.userId !== userId) {
      return NextResponse.json(
        { error: "Battery meter not found or access denied" },
        { status: 404 }
      );
    }

    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000); // Start 1 hour from now
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    // Generate optimal schedule
    const schedule = await optimizeBatterySchedule({
      batteryMeterId,
      consumptionMeterId,
      solarMeterId,
      siteId,
      startDate,
      endDate,
      optimizeFor,
    });

    // Calculate savings
    const savings = await calculateBatterySavings(schedule);

    // Get battery health
    const health = await estimateBatteryHealth(batteryMeterId);

    return NextResponse.json({
      success: true,
      schedule: {
        batteryId: batteryMeterId,
        batteryName: battery.name,
        optimizationMode: optimizeFor,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        intervals: schedule.map((s) => ({
          timestamp: s.timestamp.toISOString(),
          action: s.action,
          power: Math.round(s.power * 100) / 100,
          stateOfCharge: Math.round(s.stateOfCharge * 10) / 10,
          reason: s.reason,
          savings: Math.round(s.savings * 100) / 100,
        })),
        summary: {
          totalSavings: Math.round(savings.totalSavings * 100) / 100,
          energyCostSavings: Math.round(savings.energyCostSavings * 100) / 100,
          demandChargeSavings: Math.round(savings.demandChargeSavings * 100) / 100,
          carbonReduction: Math.round(savings.carbonReduction * 100) / 100,
          chargeEvents: schedule.filter((s) => s.action === "charge").length,
          dischargeEvents: schedule.filter((s) => s.action === "discharge").length,
        },
      },
      health: {
        degradation: Math.round(health.degradation * 10) / 10,
        estimatedCapacity: Math.round(health.estimatedRemainingCapacity * 10) / 10,
        recommendations: health.recommendedActions,
      },
    });
  } catch (error) {
    console.error("Error generating battery schedule:", error);
    return NextResponse.json(
      {
        error: "Failed to generate battery schedule",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
