/**
 * Solar Generation Forecasting
 *
 * Predicts solar production based on:
 * - Historical production patterns
 * - Weather forecasts (cloud cover, temperature, irradiance)
 * - Seasonal variations
 * - System characteristics (capacity, panel degradation)
 */

import { db } from "@/db";
import { measurements, meters, energySources } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface SolarForecast {
  timestamp: Date;
  expectedProduction: number; // kWh
  confidence: number; // 0-1
  weatherImpact: {
    cloudCover: number; // 0-100%
    temperature: number; // Celsius
    irradiance: number; // W/m²
  } | null;
}

export interface ForecastParams {
  meterId: string;
  startDate: Date;
  endDate: Date;
  intervalMinutes?: number; // Default: 15
}

/**
 * Generate solar production forecast for a given meter
 */
export async function forecastSolarProduction(
  params: ForecastParams
): Promise<SolarForecast[]> {
  const { meterId, startDate, endDate, intervalMinutes = 15 } = params;

  // Get meter and site details (for location coordinates)
  const meter = await db.query.meters.findFirst({
    where: eq(meters.id, meterId),
    with: {
      site: true,
    },
  });

  if (!meter || meter.category !== "PROD") {
    throw new Error("Invalid production meter");
  }

  // Extract site coordinates for weather API
  const latitude = meter.site?.latitude || undefined;
  const longitude = meter.site?.longitude || undefined;

  // Get historical production data (last 30 days)
  const historicalStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const historicalData = await db
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.entityId, meterId),
        eq(measurements.entityType, "meter"),
        gte(measurements.timestamp, historicalStart),
        lte(measurements.timestamp, startDate)
      )
    );

  // Calculate average production patterns by hour of day
  const hourlyPatterns = calculateHourlyPatterns(historicalData);

  // Generate forecasts
  const forecasts: SolarForecast[] = [];
  const totalIntervals = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (intervalMinutes * 60 * 1000)
  );

  for (let i = 0; i < totalIntervals; i++) {
    const timestamp = new Date(
      startDate.getTime() + i * intervalMinutes * 60 * 1000
    );

    const hour = timestamp.getHours();
    const minute = timestamp.getMinutes();

    // Base prediction from historical patterns
    const basePrediction = hourlyPatterns[hour] || 0;

    // Apply solar curve (bell curve during daylight hours)
    const solarCurve = calculateSolarCurve(hour, minute);

    // Apply seasonal variation
    const seasonalFactor = calculateSeasonalFactor(timestamp);

    // Weather impact (integrates with weather API if coordinates available)
    const weatherFactor = await estimateWeatherImpact(
      timestamp,
      latitude,
      longitude
    );

    // Calculate expected production
    const expectedProduction =
      basePrediction * solarCurve * seasonalFactor * weatherFactor.factor;

    // Confidence decreases with forecast horizon
    const hoursAhead = (timestamp.getTime() - new Date().getTime()) / (60 * 60 * 1000);
    const confidence = Math.max(0.5, 1 - hoursAhead / 72); // Decreases over 72 hours

    forecasts.push({
      timestamp,
      expectedProduction: Math.max(0, expectedProduction),
      confidence,
      weatherImpact: weatherFactor.impact,
    });
  }

  return forecasts;
}

/**
 * Calculate average production by hour of day from historical data
 */
function calculateHourlyPatterns(
  historicalData: typeof measurements.$inferSelect[]
): Record<number, number> {
  const hourlyTotals: Record<number, { sum: number; count: number }> = {};

  for (const measurement of historicalData) {
    const hour = measurement.timestamp.getHours();

    if (!hourlyTotals[hour]) {
      hourlyTotals[hour] = { sum: 0, count: 0 };
    }

    hourlyTotals[hour].sum += measurement.value;
    hourlyTotals[hour].count += 1;
  }

  // Calculate averages
  const patterns: Record<number, number> = {};
  for (const [hour, data] of Object.entries(hourlyTotals)) {
    patterns[Number(hour)] = data.sum / data.count;
  }

  return patterns;
}

/**
 * Calculate solar production curve (bell curve during daylight)
 */
function calculateSolarCurve(hour: number, minute: number): number {
  const timeOfDay = hour + minute / 60;

  // No production at night (before 6 AM or after 7 PM)
  if (timeOfDay < 6 || timeOfDay > 19) {
    return 0;
  }

  // Peak production at solar noon (12:30 PM)
  const peakHour = 12.5;
  const hoursFromPeak = Math.abs(timeOfDay - peakHour);

  // Gaussian/bell curve
  // Max at peak, drops off symmetrically
  const stdDev = 4; // Controls width of curve
  const curve = Math.exp(-Math.pow(hoursFromPeak / stdDev, 2));

  return curve;
}

/**
 * Calculate seasonal variation factor
 */
function calculateSeasonalFactor(date: Date): number {
  const month = date.getMonth(); // 0-11

  // Higher in summer (June-August), lower in winter (Dec-Feb)
  const seasonalFactors = [
    0.7,  // Jan
    0.75, // Feb
    0.85, // Mar
    0.95, // Apr
    1.05, // May
    1.1,  // Jun
    1.1,  // Jul
    1.05, // Aug
    0.95, // Sep
    0.85, // Oct
    0.75, // Nov
    0.7,  // Dec
  ];

  return seasonalFactors[month];
}

/**
 * Estimate weather impact on solar production
 *
 * Integrates with weather APIs if available, otherwise uses probabilistic model
 */
async function estimateWeatherImpact(
  timestamp: Date,
  latitude?: number,
  longitude?: number
): Promise<{
  factor: number;
  impact: SolarForecast["weatherImpact"];
}> {
  const hour = timestamp.getHours();
  const month = timestamp.getMonth();

  let cloudCover = 30; // Default: 30% average cloud cover
  let temperature = 20; // Default: 20°C average
  let irradiance = 800; // Default: 800 W/m²

  // Try to get real weather data if coordinates provided
  if (latitude && longitude) {
    try {
      const { getSolarIrradianceForecast } = await import(
        "@/lib/external-data/weather-api"
      );

      const weatherForecasts = await getSolarIrradianceForecast(
        latitude,
        longitude,
        48
      );

      // Find closest forecast to our timestamp
      const closest = weatherForecasts.find(
        (f) => Math.abs(f.timestamp.getTime() - timestamp.getTime()) < 60 * 60 * 1000
      );

      if (closest) {
        irradiance = closest.irradiance;

        // Estimate cloud cover from irradiance
        // Clear sky irradiance ≈ 1000 W/m²
        cloudCover = Math.max(0, (1 - irradiance / 1000) * 100);
      }
    } catch (error) {
      console.warn("Weather API unavailable, using fallback model:", error);
    }
  }

  // Fallback: Use probabilistic model if no real data
  if (!latitude || !longitude || irradiance === 800) {
    // Morning clouds tend to clear
    if (hour < 10) {
      cloudCover += 20;
    }

    // Higher temps in summer affect efficiency slightly
    if (month >= 5 && month <= 8) {
      temperature += 10;
      cloudCover -= 10; // Less cloudy in summer
    }
  }

  // Calculate impact factor
  // Cloud cover reduces production
  const cloudFactor = 1 - (cloudCover / 100) * 0.7; // Up to 70% reduction

  // Temperature affects efficiency (panels less efficient when hot)
  const tempOptimal = 25; // Optimal operating temperature
  const tempDiff = Math.abs(temperature - tempOptimal);
  const tempFactor = 1 - (tempDiff * 0.004); // 0.4% loss per degree from optimal

  const factor = Math.max(0.1, cloudFactor * tempFactor);

  return {
    factor,
    impact: {
      cloudCover,
      temperature,
      irradiance,
    },
  };
}

/**
 * Calculate total forecasted production for a period
 */
export async function getTotalForecastedProduction(
  meterId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const forecasts = await forecastSolarProduction({
    meterId,
    startDate,
    endDate,
  });

  return forecasts.reduce((sum, f) => sum + f.expectedProduction, 0);
}

/**
 * Get production forecast accuracy by comparing with actual data
 */
export async function validateForecastAccuracy(
  meterId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  meanAbsoluteError: number;
  meanAbsolutePercentageError: number;
  accuracy: number;
}> {
  // Get forecast that was made
  const forecasts = await forecastSolarProduction({
    meterId,
    startDate,
    endDate,
  });

  // Get actual production
  const actuals = await db
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.entityId, meterId),
        gte(measurements.timestamp, startDate),
        lte(measurements.timestamp, endDate)
      )
    );

  // Match forecasts to actuals by timestamp
  let totalError = 0;
  let totalPercentError = 0;
  let count = 0;

  for (const forecast of forecasts) {
    const actual = actuals.find(
      (a) => Math.abs(a.timestamp.getTime() - forecast.timestamp.getTime()) < 60000
    );

    if (actual) {
      const error = Math.abs(forecast.expectedProduction - actual.value);
      totalError += error;

      if (actual.value > 0) {
        const percentError = error / actual.value;
        totalPercentError += percentError;
      }

      count++;
    }
  }

  const mae = count > 0 ? totalError / count : 0;
  const mape = count > 0 ? totalPercentError / count : 0;
  const accuracy = Math.max(0, 1 - mape);

  return {
    meanAbsoluteError: mae,
    meanAbsolutePercentageError: mape,
    accuracy,
  };
}
