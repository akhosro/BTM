import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites, meters, measurements, electricityPricing, gridCarbonIntensity, recommendations } from "@/db/schema";
import { desc, eq, gte, lte, and } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const timeRange = searchParams.get("timeRange") || "today";
    // const region = searchParams.get("region") || "all"; // TODO: Implement region filtering when needed

    // Get the first site belonging to the current user if no siteId provided
    const site = siteId
      ? await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.userId, userId))).limit(1)
      : await db.select().from(sites).where(and(eq(sites.active, true), eq(sites.userId, userId))).limit(1);

    if (!site || site.length === 0) {
      return NextResponse.json({ error: "No active site found" }, { status: 404 });
    }

    const selectedSite = site[0];

    const now = new Date();

    // Calculate time window based on timeRange
    let startTime: Date, endTime: Date;
    switch (timeRange) {
      case "tomorrow":
        startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(startTime);
        endTime.setHours(23, 59, 59, 999);
        break;
      case "7days":
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      default: // "today"
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    // Get consumption forecast (using selected time range)
    const last24h = startTime;

    const consMeters = await db
      .select()
      .from(meters)
      .where(and(eq(meters.siteId, selectedSite.id), eq(meters.category, "CONS")));

    let totalConsumption = 0;
    if (consMeters.length > 0) {
      const consMeasurements = await db
        .select()
        .from(measurements)
        .where(
          and(
            eq(measurements.entityId, consMeters[0].id),
            eq(measurements.entityType, "meter"),
            gte(measurements.timestamp, last24h)
          )
        );

      totalConsumption = consMeasurements.reduce((sum, m) => sum + m.value, 0);
    }

    // Get pricing info
    const pricingData = await db
      .select()
      .from(electricityPricing)
      .where(eq(electricityPricing.siteId, selectedSite.id))
      .orderBy(desc(electricityPricing.validFrom))
      .limit(1);

    // Calculate average rate from rate structure
    let avgRate = 0.12; // Fallback
    if (pricingData.length > 0 && pricingData[0].rateStructure) {
      const rates = Object.values(pricingData[0].rateStructure as Record<string, any>)
        .filter(r => typeof r === 'number');
      avgRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0.12;
    }
    const energySpendForecast = (totalConsumption / 24) * 24 * avgRate; // Next 24h forecast

    // Historical spend for trend calculation
    const historicalStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const historicalEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let historicalConsumption = 0;
    if (consMeters.length > 0) {
      const historicalMeasurements = await db
        .select()
        .from(measurements)
        .where(
          and(
            eq(measurements.entityId, consMeters[0].id),
            eq(measurements.entityType, "meter"),
            gte(measurements.timestamp, historicalStart),
            lte(measurements.timestamp, historicalEnd)
          )
        );
      historicalConsumption = historicalMeasurements.reduce((sum, m) => sum + m.value, 0);
    }
    const historicalSpend = (historicalConsumption / 24) * 24 * avgRate;
    const spendTrend = energySpendForecast > 0 && historicalSpend > 0
      ? ((energySpendForecast - historicalSpend) / historicalSpend * 100).toFixed(0)
      : "0";

    // Get carbon intensity forecast - use site location if available
    const region = selectedSite.location || "Ontario";
    const carbonForecast = await db
      .select()
      .from(gridCarbonIntensity)
      .where(
        and(
          eq(gridCarbonIntensity.region, region),
          gte(gridCarbonIntensity.timestamp, now),
          eq(gridCarbonIntensity.forecastType, "forecast")
        )
      )
      .orderBy(gridCarbonIntensity.timestamp)
      .limit(24);

    const avgCarbonIntensity = carbonForecast.length > 0
      ? carbonForecast.reduce((sum, c) => sum + c.carbonIntensity, 0) / carbonForecast.length
      : 0;

    // Get current carbon intensity (most recent within last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const currentCarbon = await db
      .select()
      .from(gridCarbonIntensity)
      .where(
        and(
          eq(gridCarbonIntensity.region, region),
          gte(gridCarbonIntensity.timestamp, oneHourAgo),
          lte(gridCarbonIntensity.timestamp, now)
        )
      )
      .orderBy(desc(gridCarbonIntensity.timestamp))
      .limit(1);

    const currentCarbonIntensity = currentCarbon.length > 0 ? currentCarbon[0].carbonIntensity : avgCarbonIntensity;

    // Determine grid status (clean vs dirty)
    // Using typical baseline of 400 gCO2/kWh (US average)
    const baselineIntensity = 400;
    let gridStatus = "moderate";
    let gridStatusColor = "yellow";
    if (currentCarbonIntensity < baselineIntensity * 0.7) {
      gridStatus = "clean";
      gridStatusColor = "green";
    } else if (currentCarbonIntensity > baselineIntensity * 1.2) {
      gridStatus = "dirty";
      gridStatusColor = "red";
    }

    // Calculate clean energy percentage
    const cleanEnergyPercent = Math.max(0, Math.min(100, ((baselineIntensity - currentCarbonIntensity) / baselineIntensity) * 100));

    // Historical carbon for trend
    const historicalCarbon = await db
      .select()
      .from(gridCarbonIntensity)
      .where(
        and(
          eq(gridCarbonIntensity.region, region),
          gte(gridCarbonIntensity.timestamp, historicalStart),
          lte(gridCarbonIntensity.timestamp, historicalEnd)
        )
      )
      .orderBy(gridCarbonIntensity.timestamp)
      .limit(24);

    const historicalAvgCarbon = historicalCarbon.length > 0
      ? historicalCarbon.reduce((sum, c) => sum + c.carbonIntensity, 0) / historicalCarbon.length
      : 0;

    const carbonTrend = currentCarbonIntensity > 0 && historicalAvgCarbon > 0
      ? ((currentCarbonIntensity - historicalAvgCarbon) / historicalAvgCarbon * 100).toFixed(0)
      : "0";

    // Get actual recommendations to calculate optimization opportunity and savings
    const pendingRecs = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.siteId, selectedSite.id),
          eq(recommendations.status, "pending"),
          gte(recommendations.recommendedTimeStart, now)
        )
      );

    // Sum up all potential cost savings and CO2 reduction from recommendations
    const totalPotentialSavings = pendingRecs.reduce((sum, rec) => sum + (rec.costSavings || 0), 0);
    const totalCO2Reduction = pendingRecs.reduce((sum, rec) => sum + (rec.co2Reduction || 0), 0);

    // Calculate optimization opportunity from production vs consumption
    const prodMeters = await db
      .select()
      .from(meters)
      .where(and(eq(meters.siteId, selectedSite.id), eq(meters.category, "PROD")));

    let totalProduction = 0;
    if (prodMeters.length > 0) {
      const prodMeasurements = await db
        .select()
        .from(measurements)
        .where(
          and(
            eq(measurements.entityId, prodMeters[0].id),
            eq(measurements.entityType, "meter"),
            gte(measurements.timestamp, last24h)
          )
        );
      totalProduction = prodMeasurements.reduce((sum, m) => sum + m.value, 0);
    }

    // Optimization opportunity = percentage of production that could offset consumption
    const optimizationOpportunity = totalConsumption > 0 && totalProduction > 0
      ? Math.min((totalProduction / totalConsumption) * 100, 100).toFixed(0)
      : "0";

    // Historical production for trend
    let historicalProduction = 0;
    if (prodMeters.length > 0) {
      const historicalProdMeasurements = await db
        .select()
        .from(measurements)
        .where(
          and(
            eq(measurements.entityId, prodMeters[0].id),
            eq(measurements.entityType, "meter"),
            gte(measurements.timestamp, historicalStart),
            lte(measurements.timestamp, historicalEnd)
          )
        );
      historicalProduction = historicalProdMeasurements.reduce((sum, m) => sum + m.value, 0);
    }

    const historicalOptimization = historicalConsumption > 0 && historicalProduction > 0
      ? (historicalProduction / historicalConsumption) * 100
      : 0;

    const optimizationTrend = parseFloat(optimizationOpportunity) > 0 && historicalOptimization > 0
      ? ((parseFloat(optimizationOpportunity) - historicalOptimization) / historicalOptimization * 100).toFixed(0)
      : "0";

    // Potential savings trend - calculate from historical recommendations
    // Get historical recommendations from last period for comparison
    const historicalRecs = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.siteId, selectedSite.id),
          eq(recommendations.status, "pending"),
          gte(recommendations.recommendedTimeStart, historicalStart),
          lte(recommendations.recommendedTimeStart, historicalEnd)
        )
      );

    const historicalSavings = historicalRecs.reduce((sum, rec) => sum + (rec.costSavings || 0), 0);

    const savingsTrend = totalPotentialSavings > 0 && historicalSavings > 0
      ? ((totalPotentialSavings - historicalSavings) / historicalSavings * 100).toFixed(0)
      : totalPotentialSavings > 0
        ? "+100" // First time recommendations, show strong positive
        : "0";

    const savingsTrendFormatted = parseFloat(savingsTrend) > 0 ? `+${savingsTrend}%` : `${savingsTrend}%`;

    return NextResponse.json({
      success: true,
      stats: {
        energySpendForecast: {
          value: energySpendForecast > 0 ? energySpendForecast.toFixed(0) : "0",
          trend: `${parseFloat(spendTrend) > 0 ? '+' : ''}${spendTrend}%`,
          description: "Next 24h",
        },
        carbonIntensity: {
          value: currentCarbonIntensity > 0 ? currentCarbonIntensity.toFixed(0) : "0",
          trend: `${parseFloat(carbonTrend) > 0 ? '+' : ''}${carbonTrend}%`,
          description: "Current grid intensity",
          unit: "g/kWh",
          status: gridStatus,
          statusColor: gridStatusColor,
          cleanEnergyPercent: cleanEnergyPercent.toFixed(0),
          forecast24hAvg: avgCarbonIntensity.toFixed(0),
        },
        optimizationOpportunity: {
          value: optimizationOpportunity,
          trend: `${parseFloat(optimizationTrend) > 0 ? '+' : ''}${optimizationTrend}%`,
          description: "Load can be shifted",
          unit: "%",
        },
        potentialSavings: {
          value: totalPotentialSavings > 0 ? totalPotentialSavings.toFixed(0) : "0",
          trend: savingsTrendFormatted,
          description: totalCO2Reduction > 0 ? `${totalCO2Reduction.toFixed(1)} tCO₂ avoidable` : "0 tCO₂ avoidable",
          carbonReduction: totalCO2Reduction,
        },
      },
      siteInfo: {
        id: selectedSite.id,
        name: selectedSite.name,
        location: selectedSite.location,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch dashboard stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
