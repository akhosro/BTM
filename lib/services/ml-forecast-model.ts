/**
 * ML-Enhanced Forecast Model
 *
 * This service improves ISO price forecasts using historical data and pattern recognition.
 *
 * Approach:
 * 1. Collect historical forecast vs actual data
 * 2. Learn systematic forecast errors (bias patterns)
 * 3. Apply corrections to new forecasts
 *
 * Features:
 * - Time-of-day bias correction
 * - Day-of-week patterns
 * - Seasonal adjustments
 * - Forecast horizon decay modeling
 */

import { db } from "@/db";
import { isoMarketPrices } from "@/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";

export interface ModelTrainingData {
  timestamp: Date;
  forecastPrice: number;
  actualPrice: number;
  forecastError: number;
  forecastHorizon: number;
  hourOfDay: number;
  dayOfWeek: number;
  month: number;
}

export interface ForecastCorrectionModel {
  version: string;
  trainedAt: Date;
  dataPoints: number;

  // Bias corrections by hour of day (0-23)
  hourlyBias: Record<number, number>;

  // Bias corrections by day of week (0-6, Sunday=0)
  weekdayBias: Record<number, number>;

  // Bias corrections by forecast horizon
  horizonBias: Record<number, number>;

  // Overall model statistics
  stats: {
    meanAbsoluteError: number;
    meanAbsolutePercentageError: number;
    rootMeanSquareError: number;
    biasCorrection: number; // Overall systematic bias
  };
}

/**
 * Prepare training data by matching forecasts with actuals
 */
export async function prepareTrainingData(
  iso: string,
  startDate: Date,
  endDate: Date
): Promise<ModelTrainingData[]> {
  // Get all forecasts in the period
  const forecasts = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "forecast"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
    orderBy: (isoMarketPrices, { asc }) => [asc(isoMarketPrices.timestamp)],
  });

  // Get all actuals in the period
  const actuals = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "actual"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
    orderBy: (isoMarketPrices, { asc }) => [asc(isoMarketPrices.timestamp)],
  });

  // Create a map of actuals for fast lookup
  const actualsMap = new Map<string, number>();
  for (const actual of actuals) {
    const key = actual.timestamp.toISOString();
    actualsMap.set(key, actual.price);
  }

  // Match forecasts with actuals
  const trainingData: ModelTrainingData[] = [];

  for (const forecast of forecasts) {
    const key = forecast.timestamp.toISOString();
    const actualPrice = actualsMap.get(key);

    if (actualPrice !== undefined) {
      const timestamp = new Date(forecast.timestamp);
      const forecastHorizon = forecast.forecastHorizonHours
        ? parseFloat(forecast.forecastHorizonHours.toString())
        : 0;

      trainingData.push({
        timestamp,
        forecastPrice: forecast.price,
        actualPrice,
        forecastError: forecast.price - actualPrice,
        forecastHorizon,
        hourOfDay: timestamp.getHours(),
        dayOfWeek: timestamp.getDay(),
        month: timestamp.getMonth() + 1,
      });
    }
  }

  return trainingData;
}

/**
 * Train the forecast correction model
 */
export async function trainModel(
  iso: string,
  startDate: Date,
  endDate: Date
): Promise<ForecastCorrectionModel> {
  const trainingData = await prepareTrainingData(iso, startDate, endDate);

  if (trainingData.length < 100) {
    throw new Error(`Insufficient training data: ${trainingData.length} points (minimum 100 required)`);
  }

  // Calculate bias corrections by hour of day
  const hourlyGroups: Record<number, number[]> = {};
  for (let i = 0; i < 24; i++) {
    hourlyGroups[i] = [];
  }

  // Calculate bias corrections by day of week
  const weekdayGroups: Record<number, number[]> = {};
  for (let i = 0; i < 7; i++) {
    weekdayGroups[i] = [];
  }

  // Calculate bias corrections by forecast horizon (bucketed)
  const horizonGroups: Record<number, number[]> = {
    0: [],  // 0-6 hours
    6: [],  // 6-12 hours
    12: [], // 12-18 hours
    18: [], // 18-24 hours
  };

  // Group errors
  for (const point of trainingData) {
    hourlyGroups[point.hourOfDay].push(point.forecastError);
    weekdayGroups[point.dayOfWeek].push(point.forecastError);

    // Bucket horizon
    const horizonBucket = Math.floor(point.forecastHorizon / 6) * 6;
    const bucket = Math.min(18, horizonBucket);
    if (horizonGroups[bucket]) {
      horizonGroups[bucket].push(point.forecastError);
    }
  }

  // Calculate mean bias for each group
  const hourlyBias: Record<number, number> = {};
  for (let i = 0; i < 24; i++) {
    const errors = hourlyGroups[i];
    hourlyBias[i] = errors.length > 0
      ? errors.reduce((sum, err) => sum + err, 0) / errors.length
      : 0;
  }

  const weekdayBias: Record<number, number> = {};
  for (let i = 0; i < 7; i++) {
    const errors = weekdayGroups[i];
    weekdayBias[i] = errors.length > 0
      ? errors.reduce((sum, err) => sum + err, 0) / errors.length
      : 0;
  }

  const horizonBias: Record<number, number> = {};
  for (const bucket of [0, 6, 12, 18]) {
    const errors = horizonGroups[bucket];
    horizonBias[bucket] = errors.length > 0
      ? errors.reduce((sum, err) => sum + err, 0) / errors.length
      : 0;
  }

  // Calculate overall model statistics
  const allErrors = trainingData.map(p => p.forecastError);
  const absoluteErrors = allErrors.map(e => Math.abs(e));
  const squaredErrors = allErrors.map(e => e * e);

  const mae = absoluteErrors.reduce((sum, e) => sum + e, 0) / absoluteErrors.length;

  const mape = trainingData.reduce((sum, point) => {
    if (point.actualPrice !== 0) {
      return sum + (Math.abs(point.forecastError) / point.actualPrice) * 100;
    }
    return sum;
  }, 0) / trainingData.length;

  const rmse = Math.sqrt(squaredErrors.reduce((sum, e) => sum + e, 0) / squaredErrors.length);
  const overallBias = allErrors.reduce((sum, e) => sum + e, 0) / allErrors.length;

  return {
    version: "1.0.0",
    trainedAt: new Date(),
    dataPoints: trainingData.length,
    hourlyBias,
    weekdayBias,
    horizonBias,
    stats: {
      meanAbsoluteError: Math.round(mae * 100) / 100,
      meanAbsolutePercentageError: Math.round(mape * 100) / 100,
      rootMeanSquareError: Math.round(rmse * 100) / 100,
      biasCorrection: Math.round(overallBias * 100) / 100,
    },
  };
}

/**
 * Apply model corrections to a forecast
 */
export function applyModelCorrection(
  forecastPrice: number,
  timestamp: Date,
  forecastHorizon: number,
  model: ForecastCorrectionModel
): number {
  const hourOfDay = timestamp.getHours();
  const dayOfWeek = timestamp.getDay();

  // Get horizon bucket
  const horizonBucket = Math.min(18, Math.floor(forecastHorizon / 6) * 6);

  // Apply corrections (weighted combination)
  const hourlyCorrection = model.hourlyBias[hourOfDay] || 0;
  const weekdayCorrection = model.weekdayBias[dayOfWeek] || 0;
  const horizonCorrection = model.horizonBias[horizonBucket] || 0;
  const overallCorrection = model.stats.biasCorrection;

  // Weighted average: 40% hourly, 20% weekday, 20% horizon, 20% overall
  const totalCorrection =
    hourlyCorrection * 0.4 +
    weekdayCorrection * 0.2 +
    horizonCorrection * 0.2 +
    overallCorrection * 0.2;

  // Apply correction (subtract because we're correcting for forecast error)
  const correctedPrice = forecastPrice - totalCorrection;

  // Ensure price stays positive
  return Math.max(0, Math.round(correctedPrice * 100) / 100);
}

/**
 * Get improved forecasts by applying ML corrections
 */
export async function getImprovedForecasts(
  iso: string,
  startDate: Date,
  endDate: Date,
  model: ForecastCorrectionModel
): Promise<Array<{
  timestamp: Date;
  originalForecast: number;
  improvedForecast: number;
  correction: number;
}>> {
  const forecasts = await db.query.isoMarketPrices.findMany({
    where: and(
      eq(isoMarketPrices.iso, iso),
      eq(isoMarketPrices.priceType, "forecast"),
      gte(isoMarketPrices.timestamp, startDate),
      lte(isoMarketPrices.timestamp, endDate)
    ),
    orderBy: (isoMarketPrices, { asc }) => [asc(isoMarketPrices.timestamp)],
  });

  return forecasts.map(forecast => {
    const forecastHorizon = forecast.forecastHorizonHours
      ? parseFloat(forecast.forecastHorizonHours.toString())
      : 0;

    const improvedPrice = applyModelCorrection(
      forecast.price,
      forecast.timestamp,
      forecastHorizon,
      model
    );

    return {
      timestamp: forecast.timestamp,
      originalForecast: forecast.price,
      improvedForecast: improvedPrice,
      correction: forecast.price - improvedPrice,
    };
  });
}

/**
 * Evaluate model performance on test data
 */
export async function evaluateModel(
  iso: string,
  testStartDate: Date,
  testEndDate: Date,
  model: ForecastCorrectionModel
): Promise<{
  originalPerformance: {
    mae: number;
    mape: number;
    rmse: number;
  };
  improvedPerformance: {
    mae: number;
    mape: number;
    rmse: number;
  };
  improvement: {
    maeReduction: number; // percentage
    mapeReduction: number;
    rmseReduction: number;
  };
}> {
  const testData = await prepareTrainingData(iso, testStartDate, testEndDate);

  if (testData.length === 0) {
    throw new Error("No test data available");
  }

  // Calculate original forecast errors
  const originalErrors = testData.map(p => p.forecastError);
  const originalAbsErrors = originalErrors.map(e => Math.abs(e));
  const originalSquaredErrors = originalErrors.map(e => e * e);

  const originalMAE = originalAbsErrors.reduce((sum, e) => sum + e, 0) / originalAbsErrors.length;
  const originalMAPE = testData.reduce((sum, point) => {
    if (point.actualPrice !== 0) {
      return sum + (Math.abs(point.forecastError) / point.actualPrice) * 100;
    }
    return sum;
  }, 0) / testData.length;
  const originalRMSE = Math.sqrt(originalSquaredErrors.reduce((sum, e) => sum + e, 0) / originalSquaredErrors.length);

  // Calculate improved forecast errors
  const improvedErrors = testData.map(point => {
    const improved = applyModelCorrection(
      point.forecastPrice,
      point.timestamp,
      point.forecastHorizon,
      model
    );
    return improved - point.actualPrice;
  });

  const improvedAbsErrors = improvedErrors.map(e => Math.abs(e));
  const improvedSquaredErrors = improvedErrors.map(e => e * e);

  const improvedMAE = improvedAbsErrors.reduce((sum, e) => sum + e, 0) / improvedAbsErrors.length;
  const improvedMAPE = testData.map((point, i) => {
    if (point.actualPrice !== 0) {
      return (Math.abs(improvedErrors[i]) / point.actualPrice) * 100;
    }
    return 0;
  }).reduce((sum, e) => sum + e, 0) / testData.length;
  const improvedRMSE = Math.sqrt(improvedSquaredErrors.reduce((sum, e) => sum + e, 0) / improvedSquaredErrors.length);

  return {
    originalPerformance: {
      mae: Math.round(originalMAE * 100) / 100,
      mape: Math.round(originalMAPE * 100) / 100,
      rmse: Math.round(originalRMSE * 100) / 100,
    },
    improvedPerformance: {
      mae: Math.round(improvedMAE * 100) / 100,
      mape: Math.round(improvedMAPE * 100) / 100,
      rmse: Math.round(improvedRMSE * 100) / 100,
    },
    improvement: {
      maeReduction: Math.round(((originalMAE - improvedMAE) / originalMAE) * 10000) / 100,
      mapeReduction: Math.round(((originalMAPE - improvedMAPE) / originalMAPE) * 10000) / 100,
      rmseReduction: Math.round(((originalRMSE - improvedRMSE) / originalRMSE) * 10000) / 100,
    },
  };
}
