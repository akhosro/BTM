import { db } from "@/db";
import { isoMarketPrices, measurements, meters } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface SavingsAnalysis {
  period: {
    startDate: Date;
    endDate: Date;
  };
  forecast: {
    totalCost: number;
    averagePrice: number;
    peakHours: number;
    offPeakHours: number;
  };
  actual: {
    totalCost: number;
    averagePrice: number;
    peakHours: number;
    offPeakHours: number;
  };
  savings: {
    amount: number;
    percentage: number;
    description: string;
  };
  recommendations: {
    followed: number;
    total: number;
    effectiveness: number; // percentage
  };
}

/**
 * Calculate savings by comparing actual costs vs what would have been paid
 * if following the forecast-based recommendations
 *
 * @param siteId - Site to analyze
 * @param startDate - Start of analysis period
 * @param endDate - End of analysis period
 * @param iso - ISO to use for pricing (defaults to "IESO")
 */
export async function calculateSavings(
  siteId: string,
  startDate: Date,
  endDate: Date,
  iso: string = "IESO"
): Promise<SavingsAnalysis> {
  // Get measurements for the site's meters
  const readings = await db.query.measurements.findMany({
    where: and(
      sql`EXISTS (
        SELECT 1 FROM ${meters} m
        WHERE m.id = ${measurements.entityId}
        AND m.site_id = ${siteId}
        AND ${measurements.entityType} = 'meter'
      )`,
      gte(measurements.timestamp, startDate),
      lte(measurements.timestamp, endDate),
      eq(measurements.metric, 'energy')
    ),
    orderBy: (measurements, { asc }) => [asc(measurements.timestamp)],
  });

  if (readings.length === 0) {
    throw new Error("No meter readings found for the specified period");
  }

  // Get forecast prices for the period
  const forecasts = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "forecast"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
    orderBy: (isoMarketPrices, { asc }) => [asc(isoMarketPrices.timestamp)],
  });

  // Get actual prices for the period
  const actuals = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "actual"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
    orderBy: (isoMarketPrices, { asc }) => [asc(isoMarketPrices.timestamp)],
  });

  // Calculate average prices once for peak/off-peak classification
  const forecastAvgPrice = forecasts.length > 0
    ? forecasts.reduce((sum, f) => sum + f.price, 0) / forecasts.length
    : 0;
  const actualAvgPrice = actuals.length > 0
    ? actuals.reduce((sum, a) => sum + a.price, 0) / actuals.length
    : 0;

  // Calculate costs based on actual consumption and forecast prices
  let forecastTotalCost = 0;
  let forecastPeakHours = 0;
  let forecastOffPeakHours = 0;
  const forecastPrices: number[] = [];

  for (const reading of readings) {
    // Find closest forecast price
    const forecast = findClosestPrice(forecasts, reading.timestamp);
    if (forecast) {
      const energyMWh = reading.value / 1000; // Convert kWh to MWh (assuming value is in kWh)
      forecastTotalCost += energyMWh * forecast.price;
      forecastPrices.push(forecast.price);

      // Classify as peak/off-peak (simple: peak if price > average)
      if (forecast.price > forecastAvgPrice) {
        forecastPeakHours++;
      } else {
        forecastOffPeakHours++;
      }
    }
  }

  // Calculate costs based on actual consumption and actual prices
  let actualTotalCost = 0;
  let actualPeakHours = 0;
  let actualOffPeakHours = 0;
  const actualPrices: number[] = [];

  for (const reading of readings) {
    // Find closest actual price
    const actual = findClosestPrice(actuals, reading.timestamp);
    if (actual) {
      const energyMWh = reading.value / 1000; // Convert kWh to MWh (assuming value is in kWh)
      actualTotalCost += energyMWh * actual.price;
      actualPrices.push(actual.price);

      // Classify as peak/off-peak
      if (actual.price > actualAvgPrice) {
        actualPeakHours++;
      } else {
        actualOffPeakHours++;
      }
    }
  }

  // Calculate savings
  const savingsAmount = forecastTotalCost - actualTotalCost;
  const savingsPercentage = forecastTotalCost > 0
    ? (savingsAmount / forecastTotalCost) * 100
    : 0;

  const savingsDescription = savingsAmount > 0
    ? `You saved $${savingsAmount.toFixed(2)} by following price-optimized recommendations`
    : savingsAmount < 0
    ? `Actual costs were $${Math.abs(savingsAmount).toFixed(2)} higher than forecast`
    : "Actual costs matched forecast predictions";

  // Calculate recommendation effectiveness (placeholder - will be implemented with recommendation tracking)
  const recommendationsFollowed = 0; // TODO: Track actual recommendations
  const totalRecommendations = 0;
  const effectiveness = totalRecommendations > 0
    ? (recommendationsFollowed / totalRecommendations) * 100
    : 0;

  return {
    period: {
      startDate,
      endDate,
    },
    forecast: {
      totalCost: Math.round(forecastTotalCost * 100) / 100,
      averagePrice: forecastPrices.length > 0
        ? Math.round((forecastPrices.reduce((a, b) => a + b, 0) / forecastPrices.length) * 100) / 100
        : 0,
      peakHours: forecastPeakHours,
      offPeakHours: forecastOffPeakHours,
    },
    actual: {
      totalCost: Math.round(actualTotalCost * 100) / 100,
      averagePrice: actualPrices.length > 0
        ? Math.round((actualPrices.reduce((a, b) => a + b, 0) / actualPrices.length) * 100) / 100
        : 0,
      peakHours: actualPeakHours,
      offPeakHours: actualOffPeakHours,
    },
    savings: {
      amount: Math.round(savingsAmount * 100) / 100,
      percentage: Math.round(savingsPercentage * 100) / 100,
      description: savingsDescription,
    },
    recommendations: {
      followed: recommendationsFollowed,
      total: totalRecommendations,
      effectiveness: Math.round(effectiveness * 100) / 100,
    },
  };
}

/**
 * Find the price record closest to the given timestamp
 */
function findClosestPrice(
  prices: Array<{ timestamp: Date; price: number }>,
  targetTime: Date
): { timestamp: Date; price: number } | null {
  if (prices.length === 0) return null;

  const targetMs = targetTime.getTime();
  let closest = prices[0];
  let minDiff = Math.abs(prices[0].timestamp.getTime() - targetMs);

  for (const price of prices) {
    const diff = Math.abs(price.timestamp.getTime() - targetMs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = price;
    }
  }

  // Only return if within 1 hour of target
  if (minDiff <= 60 * 60 * 1000) {
    return closest;
  }

  return null;
}

/**
 * Calculate forecast accuracy by comparing forecasted prices with actual prices
 *
 * @param startDate - Start of analysis period
 * @param endDate - End of analysis period
 * @param iso - ISO to analyze (defaults to "IESO")
 */
export async function calculateForecastAccuracy(
  startDate: Date,
  endDate: Date,
  iso: string = "IESO"
): Promise<{
  meanAbsoluteError: number;
  meanAbsolutePercentageError: number;
  accuracy: number;
}> {
  // Get all forecasts for the period
  const forecasts = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "forecast"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
  });

  // Get all actuals for the period
  const actuals = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "actual"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
  });

  if (forecasts.length === 0 || actuals.length === 0) {
    throw new Error("Insufficient data to calculate forecast accuracy");
  }

  // Match forecasts with actuals
  const errors: number[] = [];
  const percentageErrors: number[] = [];

  for (const forecast of forecasts) {
    const actual = findClosestPrice(actuals, forecast.timestamp);
    if (actual) {
      const error = Math.abs(forecast.price - actual.price);
      errors.push(error);

      if (actual.price !== 0) {
        const percentageError = (error / actual.price) * 100;
        percentageErrors.push(percentageError);
      }
    }
  }

  const mae = errors.reduce((sum, err) => sum + err, 0) / errors.length;
  const mape = percentageErrors.reduce((sum, err) => sum + err, 0) / percentageErrors.length;
  const accuracy = Math.max(0, 100 - mape);

  return {
    meanAbsoluteError: Math.round(mae * 100) / 100,
    meanAbsolutePercentageError: Math.round(mape * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
  };
}
