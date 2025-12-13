import { NextResponse } from "next/server";
import { db } from "@/db";
import { sites, meters, measurements, electricityPricing, gridCarbonIntensity, recommendations, consumptionForecasts } from "@/db/schema";
import { desc, eq, gte, lte, and, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const timeRange = searchParams.get("timeRange") || "today";
    // const region = searchParams.get("region") || "all"; // TODO: Implement region filtering when needed
    // Portfolio-level aggregation when no siteId is provided

    // Get sites - specific site if siteId provided, otherwise all active sites
    let userSites;
    if (siteId) {
      userSites = await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.userId, userId))).limit(1);
    } else {
      userSites = await db.select().from(sites).where(and(eq(sites.active, true), eq(sites.userId, userId)));
    }

    if (!userSites || userSites.length === 0) {
      return NextResponse.json({ error: "No active site found" }, { status: 404 });
    }

    const isPortfolioView = !siteId && userSites.length > 1;
    const selectedSite = userSites[0]; // For single-site or fallback

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

    // Get consumption forecast (using selected time range)
    const last24h = startTime;

    // Aggregate consumption across all sites in portfolio view
    let totalConsumption = 0;
    if (isPortfolioView) {
      for (const site of userSites) {
        const siteConsMeters = await db
          .select()
          .from(meters)
          .where(and(eq(meters.siteId, site.id), eq(meters.category, "CONS")));

        if (siteConsMeters.length > 0) {
          const siteMeasurements = await db
            .select()
            .from(measurements)
            .where(
              and(
                eq(measurements.entityId, siteConsMeters[0].id),
                eq(measurements.entityType, "meter"),
                gte(measurements.timestamp, last24h)
              )
            );
          totalConsumption += siteMeasurements.reduce((sum, m) => sum + m.value, 0);
        }
      }
    } else {
      const consMeters = await db
        .select()
        .from(meters)
        .where(and(eq(meters.siteId, selectedSite.id), eq(meters.category, "CONS")));

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
    }

    // Get pricing info and calculate weighted average rate
    let avgRate = 0.12; // Fallback
    if (isPortfolioView) {
      // Calculate weighted average rate across all sites
      let totalWeightedRate = 0;
      let totalSiteConsumption = 0;

      for (const site of userSites) {
        const sitePricing = await db
          .select()
          .from(electricityPricing)
          .where(eq(electricityPricing.siteId, site.id))
          .orderBy(desc(electricityPricing.validFrom))
          .limit(1);

        if (sitePricing.length > 0 && sitePricing[0].rateStructure) {
          const rates = Object.values(sitePricing[0].rateStructure as Record<string, any>)
            .filter(r => typeof r === 'number');
          const siteRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0.12;

          // Get site's consumption for weighting
          const siteConsMeters = await db
            .select()
            .from(meters)
            .where(and(eq(meters.siteId, site.id), eq(meters.category, "CONS")));

          let siteConsumption = 0;
          if (siteConsMeters.length > 0) {
            const siteMeasurements = await db
              .select()
              .from(measurements)
              .where(
                and(
                  eq(measurements.entityId, siteConsMeters[0].id),
                  eq(measurements.entityType, "meter"),
                  gte(measurements.timestamp, last24h)
                )
              );
            siteConsumption = siteMeasurements.reduce((sum, m) => sum + m.value, 0);
          }

          totalWeightedRate += siteRate * siteConsumption;
          totalSiteConsumption += siteConsumption;
        }
      }

      avgRate = totalSiteConsumption > 0 ? totalWeightedRate / totalSiteConsumption : 0.12;
    } else {
      const pricingData = await db
        .select()
        .from(electricityPricing)
        .where(eq(electricityPricing.siteId, selectedSite.id))
        .orderBy(desc(electricityPricing.validFrom))
        .limit(1);

      if (pricingData.length > 0 && pricingData[0].rateStructure) {
        const rates = Object.values(pricingData[0].rateStructure as Record<string, any>)
          .filter(r => typeof r === 'number');
        avgRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0.12;
      }
    }
    const energySpendForecast = (totalConsumption / 24) * 24 * avgRate; // Next 24h forecast

    // Historical spend for trend calculation
    const historicalStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const historicalEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let historicalConsumption = 0;

    if (isPortfolioView) {
      for (const site of userSites) {
        const siteConsMeters = await db
          .select()
          .from(meters)
          .where(and(eq(meters.siteId, site.id), eq(meters.category, "CONS")));

        if (siteConsMeters.length > 0) {
          const historicalMeasurements = await db
            .select()
            .from(measurements)
            .where(
              and(
                eq(measurements.entityId, siteConsMeters[0].id),
                eq(measurements.entityType, "meter"),
                gte(measurements.timestamp, historicalStart),
                lte(measurements.timestamp, historicalEnd)
              )
            );
          historicalConsumption += historicalMeasurements.reduce((sum, m) => sum + m.value, 0);
        }
      }
    } else {
      const consMeters = await db
        .select()
        .from(meters)
        .where(and(eq(meters.siteId, selectedSite.id), eq(meters.category, "CONS")));

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
    }
    const historicalSpend = (historicalConsumption / 24) * 24 * avgRate;
    const spendTrend = energySpendForecast > 0 && historicalSpend > 0
      ? ((energySpendForecast - historicalSpend) / historicalSpend * 100).toFixed(0)
      : "0";

    // Get peak demand forecast - maximum predicted consumption for selected time period
    let peakDemand = 0;
    let avgDemand = 0;

    if (isPortfolioView) {
      // Portfolio view: get peak across all sites
      let maxPeak = 0;
      let totalAvg = 0;
      let totalForecasts = 0;

      for (const site of userSites) {
        const forecasts = await db
          .select()
          .from(consumptionForecasts)
          .where(
            and(
              eq(consumptionForecasts.siteId, site.id),
              gte(consumptionForecasts.forecastTimestamp, startTime),
              lte(consumptionForecasts.forecastTimestamp, endTime)
            )
          )
          .orderBy(desc(consumptionForecasts.predictedValue));

        if (forecasts.length > 0) {
          // Site's peak is the max predicted value
          const sitePeak = forecasts[0].predictedValue;
          maxPeak += sitePeak; // Sum peaks across sites for portfolio peak

          // Calculate average for this site
          const siteAvg = forecasts.reduce((sum, f) => sum + f.predictedValue, 0) / forecasts.length;
          totalAvg += siteAvg;
          totalForecasts += forecasts.length;
        }
      }

      peakDemand = maxPeak;
      avgDemand = totalForecasts > 0 ? totalAvg / userSites.length : 0;
    } else {
      // Single site view
      const forecasts = await db
        .select()
        .from(consumptionForecasts)
        .where(
          and(
            eq(consumptionForecasts.siteId, selectedSite.id),
            gte(consumptionForecasts.forecastTimestamp, startTime),
            lte(consumptionForecasts.forecastTimestamp, endTime)
          )
        )
        .orderBy(desc(consumptionForecasts.predictedValue));

      if (forecasts.length > 0) {
        peakDemand = forecasts[0].predictedValue;
        avgDemand = forecasts.reduce((sum, f) => sum + f.predictedValue, 0) / forecasts.length;
      }
    }

    // Historical peak demand for trend calculation
    let historicalPeakDemand = 0;

    if (isPortfolioView) {
      let historicalMaxPeak = 0;

      for (const site of userSites) {
        const historicalForecasts = await db
          .select()
          .from(consumptionForecasts)
          .where(
            and(
              eq(consumptionForecasts.siteId, site.id),
              gte(consumptionForecasts.forecastTimestamp, historicalStart),
              lte(consumptionForecasts.forecastTimestamp, historicalEnd)
            )
          )
          .orderBy(desc(consumptionForecasts.predictedValue))
          .limit(1);

        if (historicalForecasts.length > 0) {
          historicalMaxPeak += historicalForecasts[0].predictedValue;
        }
      }

      historicalPeakDemand = historicalMaxPeak;
    } else {
      const historicalForecasts = await db
        .select()
        .from(consumptionForecasts)
        .where(
          and(
            eq(consumptionForecasts.siteId, selectedSite.id),
            gte(consumptionForecasts.forecastTimestamp, historicalStart),
            lte(consumptionForecasts.forecastTimestamp, historicalEnd)
          )
        )
        .orderBy(desc(consumptionForecasts.predictedValue))
        .limit(1);

      historicalPeakDemand = historicalForecasts.length > 0 ? historicalForecasts[0].predictedValue : 0;
    }

    const peakDemandTrend = peakDemand > 0 && historicalPeakDemand > 0
      ? ((peakDemand - historicalPeakDemand) / historicalPeakDemand * 100).toFixed(0)
      : "0";

    // Get actual recommendations to calculate optimization opportunity and savings
    // Use same time window as recommendations API for consistency
    // Format dates as strings without timezone for comparison with timestamp columns (same as recommendations API)
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

    let pendingRecs;
    if (isPortfolioView) {
      const siteIds = userSites.map(s => s.id);
      pendingRecs = await db
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.status, "pending"),
            sql`recommended_time_start >= ${startTimeStr}::timestamp`,
            sql`recommended_time_start <= ${endTimeStr}::timestamp`
          )
        );
      // Filter to only user's sites (since we can't use inArray with multiple conditions easily)
      pendingRecs = pendingRecs.filter(rec => siteIds.includes(rec.siteId));
    } else {
      pendingRecs = await db
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.siteId, selectedSite.id),
            eq(recommendations.status, "pending"),
            sql`recommended_time_start >= ${startTimeStr}::timestamp`,
            sql`recommended_time_start <= ${endTimeStr}::timestamp`
          )
        );
    }

    // Sum up all potential cost savings and CO2 reduction from recommendations
    console.log(`[STATS] Time range: ${timeRange}`);
    console.log(`[STATS] Filtering: ${startTimeStr} to ${endTimeStr}`);
    console.log(`[STATS] Found ${pendingRecs.length} pending recommendations`);
    console.log(`[STATS] Recommendations:`, pendingRecs.map(r => ({
      id: r.id,
      costSavings: r.costSavings,
      recommendedTimeStart: r.recommendedTimeStart
    })));
    const totalPotentialSavings = pendingRecs.reduce((sum, rec) => sum + (rec.costSavings || 0), 0);
    const totalCO2Reduction = pendingRecs.reduce((sum, rec) => sum + (rec.co2Reduction || 0), 0);
    console.log(`[STATS] Total potential savings: $${totalPotentialSavings}`);

    // Calculate optimization opportunity from production vs consumption
    let totalProduction = 0;
    if (isPortfolioView) {
      for (const site of userSites) {
        const siteProdMeters = await db
          .select()
          .from(meters)
          .where(and(eq(meters.siteId, site.id), eq(meters.category, "PROD")));

        if (siteProdMeters.length > 0) {
          const siteProdMeasurements = await db
            .select()
            .from(measurements)
            .where(
              and(
                eq(measurements.entityId, siteProdMeters[0].id),
                eq(measurements.entityType, "meter"),
                gte(measurements.timestamp, last24h)
              )
            );
          totalProduction += siteProdMeasurements.reduce((sum, m) => sum + m.value, 0);
        }
      }
    } else {
      const prodMeters = await db
        .select()
        .from(meters)
        .where(and(eq(meters.siteId, selectedSite.id), eq(meters.category, "PROD")));

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
    }

    // Optimization opportunity = percentage of production that could offset consumption
    const optimizationOpportunity = totalConsumption > 0 && totalProduction > 0
      ? Math.min((totalProduction / totalConsumption) * 100, 100).toFixed(0)
      : "0";

    // Historical production for trend
    let historicalProduction = 0;
    if (isPortfolioView) {
      for (const site of userSites) {
        const siteProdMeters = await db
          .select()
          .from(meters)
          .where(and(eq(meters.siteId, site.id), eq(meters.category, "PROD")));

        if (siteProdMeters.length > 0) {
          const historicalProdMeasurements = await db
            .select()
            .from(measurements)
            .where(
              and(
                eq(measurements.entityId, siteProdMeters[0].id),
                eq(measurements.entityType, "meter"),
                gte(measurements.timestamp, historicalStart),
                lte(measurements.timestamp, historicalEnd)
              )
            );
          historicalProduction += historicalProdMeasurements.reduce((sum, m) => sum + m.value, 0);
        }
      }
    } else {
      const prodMeters = await db
        .select()
        .from(meters)
        .where(and(eq(meters.siteId, selectedSite.id), eq(meters.category, "PROD")));

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
    }

    const historicalOptimization = historicalConsumption > 0 && historicalProduction > 0
      ? (historicalProduction / historicalConsumption) * 100
      : 0;

    const optimizationTrend = parseFloat(optimizationOpportunity) > 0 && historicalOptimization > 0
      ? ((parseFloat(optimizationOpportunity) - historicalOptimization) / historicalOptimization * 100).toFixed(0)
      : "0";

    // Potential savings trend - calculate from historical recommendations
    // Get historical recommendations from last period for comparison
    let historicalRecs;
    if (isPortfolioView) {
      const siteIds = userSites.map(s => s.id);
      historicalRecs = await db
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.status, "pending"),
            gte(recommendations.recommendedTimeStart, historicalStart),
            lte(recommendations.recommendedTimeStart, historicalEnd)
          )
        );
      // Filter to only user's sites
      historicalRecs = historicalRecs.filter(rec => siteIds.includes(rec.siteId));
    } else {
      historicalRecs = await db
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
    }

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
        peakDemand: {
          value: peakDemand > 0 ? peakDemand.toFixed(0) : "0",
          trend: `${parseFloat(peakDemandTrend) > 0 ? '+' : ''}${peakDemandTrend}%`,
          description: "Maximum predicted usage",
          unit: "kWh",
          avgDemand: avgDemand.toFixed(0),
        },
        optimizationOpportunity: {
          value: optimizationOpportunity,
          trend: `${parseFloat(optimizationTrend) > 0 ? '+' : ''}${optimizationTrend}%`,
          description: "Self-generation coverage",
          unit: "%",
        },
        potentialSavings: {
          value: totalPotentialSavings > 0 ? totalPotentialSavings.toFixed(0) : "0",
          trend: savingsTrendFormatted,
          description: totalCO2Reduction > 0 ? `${totalCO2Reduction.toFixed(1)} tCO₂ avoidable` : "0 tCO₂ avoidable",
          carbonReduction: totalCO2Reduction,
        },
      },
      siteInfo: isPortfolioView ? {
        id: "portfolio",
        name: "All Sites",
        location: `${userSites.length} sites`,
      } : {
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
