/**
 * Battery Energy Storage Optimization
 *
 * Optimizes battery charge/discharge schedules based on:
 * - Time-of-use electricity pricing
 * - Solar production forecasts
 * - Consumption patterns
 * - Grid carbon intensity
 * - Battery specifications (capacity, efficiency, degradation)
 */

import { db } from "@/db";
import { measurements, meters, electricityPricing, gridCarbonIntensity } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { forecastSolarProduction } from "./solar-forecast";

export interface BatterySchedule {
  timestamp: Date;
  action: "charge" | "discharge" | "hold";
  power: number; // kW (positive = charge, negative = discharge)
  stateOfCharge: number; // % (0-100)
  reason: string;
  savings: number; // $ saved by this action
}

export interface OptimizationParams {
  batteryMeterId: string;
  consumptionMeterId: string;
  solarMeterId?: string;
  siteId: string;
  startDate: Date;
  endDate: Date;
  optimizeFor?: "cost" | "carbon" | "balanced"; // Default: balanced
}

export interface BatterySpecs {
  capacity: number; // kWh
  maxChargePower: number; // kW
  maxDischargePower: number; // kW
  efficiency: number; // 0-1 (round-trip efficiency)
  minSoC: number; // Minimum state of charge (%)
  maxSoC: number; // Maximum state of charge (%)
  currentSoC: number; // Current state of charge (%)
}

/**
 * Generate optimal battery charge/discharge schedule
 */
export async function optimizeBatterySchedule(
  params: OptimizationParams
): Promise<BatterySchedule[]> {
  const {
    batteryMeterId,
    consumptionMeterId,
    solarMeterId,
    siteId,
    startDate,
    endDate,
    optimizeFor = "balanced",
  } = params;

  // Get battery specifications and site details
  const batteryMeter = await db.query.meters.findFirst({
    where: eq(meters.id, batteryMeterId),
    with: {
      site: true,
    },
  });

  if (!batteryMeter || batteryMeter.category !== "STOR") {
    throw new Error("Invalid battery meter");
  }

  const batterySpecs = await getBatterySpecs(batteryMeterId);

  // Extract site coordinates for carbon intensity API (convert null to undefined)
  const latitude = batteryMeter.site?.latitude ?? undefined;
  const longitude = batteryMeter.site?.longitude ?? undefined;

  // Get pricing data
  const pricing = await db
    .select()
    .from(electricityPricing)
    .where(eq(electricityPricing.siteId, siteId))
    .orderBy(desc(electricityPricing.validFrom))
    .limit(1);

  if (!pricing.length) {
    throw new Error("No pricing data available");
  }

  const rateStructure = pricing[0].rateStructure as any;

  // Get consumption forecast (based on historical patterns)
  const consumptionForecast = await forecastConsumption(
    consumptionMeterId,
    startDate,
    endDate
  );

  // Get solar forecast if available
  let solarForecast: { timestamp: Date; expectedProduction: number }[] = [];
  if (solarMeterId) {
    solarForecast = await forecastSolarProduction({
      meterId: solarMeterId,
      startDate,
      endDate,
    });
  }

  // Get carbon intensity forecast
  let carbonForecast = await db
    .select()
    .from(gridCarbonIntensity)
    .where(
      and(
        gte(gridCarbonIntensity.timestamp, startDate),
        lte(gridCarbonIntensity.timestamp, endDate)
      )
    );

  // If carbon optimization requested and we have coordinates, fetch real-time carbon data
  if ((optimizeFor === "carbon" || optimizeFor === "balanced") && latitude && longitude) {
    try {
      const { getCarbonIntensityForecast } = await import(
        "@/lib/external-data/carbon-intensity-api"
      );

      const hours = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000)
      );

      const realTimeCarbonData = await getCarbonIntensityForecast(
        latitude,
        longitude,
        hours
      );

      // Convert to database format for consistency
      if (realTimeCarbonData.length > 0) {
        carbonForecast = realTimeCarbonData.map((data) => ({
          id: "", // Not needed for optimization
          region: data.region,
          gridOperator: null,
          timestamp: data.timestamp,
          carbonIntensity: data.carbonIntensity,
          generationMix: null,
          forecastType: data.confidence ? "forecast" : "estimated",
          forecastHorizonHours: null,
          dataSource: data.source,
          confidence: data.confidence || null,
          metadata: {},
          createdAt: new Date(),
        }));

        console.log(
          `Using real-time carbon intensity data from ${realTimeCarbonData[0].source}`
        );
      }
    } catch (error) {
      console.warn(
        "Failed to fetch real-time carbon intensity, using database values:",
        error
      );
    }
  }

  // Generate optimal schedule using dynamic programming approach
  const schedule = await generateOptimalSchedule({
    batterySpecs,
    rateStructure,
    consumptionForecast,
    solarForecast,
    carbonForecast,
    startDate,
    endDate,
    optimizeFor,
    demandCharge: pricing[0].demandCharge || 0,
    latitude,
    longitude,
  });

  return schedule;
}

/**
 * Get battery specifications from meter and energy source
 */
async function getBatterySpecs(meterId: string): Promise<BatterySpecs> {
  const meter = await db.query.meters.findFirst({
    where: eq(meters.id, meterId),
  });

  const energySource = await db.query.energySources.findFirst({
    where: eq(meters.id, meterId),
  });

  const metadata = (energySource?.metadata as any) || {};

  // Get current state of charge from latest measurement
  const latestMeasurement = await db
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.entityId, meterId),
        eq(measurements.entityType, "meter")
      )
    )
    .orderBy(desc(measurements.timestamp))
    .limit(1);

  const currentSoC =
    ((latestMeasurement[0]?.metadata as any)?.soc as number) || 50; // Default 50%

  return {
    capacity: meter?.capacity || metadata.usableCapacity || 1000, // kWh
    maxChargePower: metadata.maxChargePower || 250, // kW
    maxDischargePower: metadata.maxDischargePower || 250, // kW
    efficiency: metadata.efficiency || 0.9, // 90% round-trip efficiency
    minSoC: metadata.minSoC || 10, // 10% minimum
    maxSoC: metadata.maxSoC || 90, // 90% maximum (preserve battery life)
    currentSoC,
  };
}

/**
 * Forecast consumption based on historical patterns
 */
async function forecastConsumption(
  meterId: string,
  startDate: Date,
  endDate: Date
): Promise<{ timestamp: Date; expectedConsumption: number }[]> {
  // Get historical consumption (last 30 days)
  const historicalStart = new Date(
    startDate.getTime() - 30 * 24 * 60 * 60 * 1000
  );

  const historicalData = await db
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.entityId, meterId),
        gte(measurements.timestamp, historicalStart),
        lte(measurements.timestamp, startDate)
      )
    );

  // Calculate hourly patterns
  const hourlyPatterns: Record<number, number> = {};
  const hourlyCounts: Record<number, number> = {};

  for (const measurement of historicalData) {
    const hour = measurement.timestamp.getHours();
    hourlyPatterns[hour] = (hourlyPatterns[hour] || 0) + measurement.value;
    hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
  }

  // Average patterns
  for (const hour in hourlyPatterns) {
    hourlyPatterns[hour] /= hourlyCounts[hour];
  }

  // Generate forecast
  const forecast: { timestamp: Date; expectedConsumption: number }[] = [];
  const intervals = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (15 * 60 * 1000)
  );

  for (let i = 0; i < intervals; i++) {
    const timestamp = new Date(startDate.getTime() + i * 15 * 60 * 1000);
    const hour = timestamp.getHours();

    // Add some randomness to simulate variability
    const baseConsumption = hourlyPatterns[hour] || 0;
    const variability = 1 + (Math.random() - 0.5) * 0.2; // ±10% variation

    forecast.push({
      timestamp,
      expectedConsumption: baseConsumption * variability,
    });
  }

  return forecast;
}

/**
 * Generate optimal schedule using optimization algorithm
 */
async function generateOptimalSchedule(config: {
  batterySpecs: BatterySpecs;
  rateStructure: any;
  consumptionForecast: { timestamp: Date; expectedConsumption: number }[];
  solarForecast: { timestamp: Date; expectedProduction: number }[];
  carbonForecast: typeof gridCarbonIntensity.$inferSelect[];
  startDate: Date;
  endDate: Date;
  optimizeFor: "cost" | "carbon" | "balanced";
  demandCharge: number;
  latitude?: number;
  longitude?: number;
}): Promise<BatterySchedule[]> {
  const {
    batterySpecs,
    rateStructure,
    consumptionForecast,
    solarForecast,
    carbonForecast,
    optimizeFor,
    demandCharge,
  } = config;

  const schedule: BatterySchedule[] = [];
  let currentSoC = batterySpecs.currentSoC;

  // Define pricing tiers
  const peakRate = rateStructure.peak || 0.45;
  const partPeakRate = rateStructure.partPeak || 0.30;
  const offPeakRate = rateStructure.offPeak || 0.18;

  for (let i = 0; i < consumptionForecast.length; i++) {
    const { timestamp, expectedConsumption } = consumptionForecast[i];
    const hour = timestamp.getHours();

    // Get solar production for this interval
    const solar = solarForecast.find(
      (s) => Math.abs(s.timestamp.getTime() - timestamp.getTime()) < 60000
    );
    const solarProduction = solar?.expectedProduction || 0;

    // Net load (consumption - solar)
    const netLoad = expectedConsumption - solarProduction;

    // Get carbon intensity for this interval
    const carbonData = carbonForecast.find(
      (c) => Math.abs(c.timestamp.getTime() - timestamp.getTime()) < 60 * 60 * 1000
    );
    const currentCarbonIntensity = carbonData?.carbonIntensity || 400; // gCO2/kWh

    // Calculate average carbon intensity for planning
    const avgCarbonIntensity =
      carbonForecast.length > 0
        ? carbonForecast.reduce((sum, c) => sum + c.carbonIntensity, 0) /
          carbonForecast.length
        : 400;

    // Determine electricity rate for this hour
    let currentRate = offPeakRate;
    if (hour >= 16 && hour < 21) {
      currentRate = peakRate; // Peak: 4-9 PM
    } else if (hour >= 12 && hour < 16) {
      currentRate = partPeakRate; // Part-peak: 12-4 PM
    }

    // Decision logic based on optimization goal
    let action: "charge" | "discharge" | "hold" = "hold";
    let power = 0;
    let reason = "";
    let savings = 0;

    if (optimizeFor === "cost") {
      // COST OPTIMIZATION STRATEGY

      // Discharge during peak hours to avoid expensive electricity
      if (currentRate === peakRate && netLoad > 0 && currentSoC > batterySpecs.minSoC) {
        action = "discharge";
        power = Math.min(
          batterySpecs.maxDischargePower,
          netLoad,
          (currentSoC - batterySpecs.minSoC) / 100 * batterySpecs.capacity * 4 // Max discharge for 15 min
        );
        reason = `Peak shaving during $${currentRate}/kWh period`;
        savings = power * 0.25 * (currentRate - offPeakRate); // Savings vs off-peak
      }
      // Charge during off-peak if there's excess solar or low rates
      else if (
        currentRate === offPeakRate &&
        currentSoC < batterySpecs.maxSoC &&
        (solarProduction > expectedConsumption || hour < 6)
      ) {
        action = "charge";
        power = Math.min(
          batterySpecs.maxChargePower,
          solarProduction > expectedConsumption
            ? solarProduction - expectedConsumption
            : batterySpecs.maxChargePower,
          (batterySpecs.maxSoC - currentSoC) / 100 * batterySpecs.capacity * 4
        );
        reason = solarProduction > expectedConsumption
          ? "Storing excess solar"
          : `Charging at low rate ($${currentRate}/kWh)`;
        savings = power * 0.25 * (peakRate - currentRate); // Potential savings
      }
    } else if (optimizeFor === "carbon") {
      // CARBON OPTIMIZATION STRATEGY

      // Discharge when grid is dirty (high carbon intensity)
      if (
        currentCarbonIntensity > avgCarbonIntensity * 1.15 &&
        netLoad > 0 &&
        currentSoC > batterySpecs.minSoC
      ) {
        action = "discharge";
        power = Math.min(
          batterySpecs.maxDischargePower,
          netLoad,
          ((currentSoC - batterySpecs.minSoC) / 100) * batterySpecs.capacity * 4
        );
        const carbonReduction =
          (power * 0.25 * (currentCarbonIntensity - avgCarbonIntensity)) / 1000; // kg CO2
        reason = `Grid is ${Math.round(((currentCarbonIntensity / avgCarbonIntensity - 1) * 100))}% dirtier - use stored clean energy (save ${carbonReduction.toFixed(1)} kg CO2)`;
        savings = carbonReduction * 0.05; // Estimate monetary value at $50/ton CO2
      }
      // Charge when grid is clean (low carbon intensity)
      else if (
        currentCarbonIntensity < avgCarbonIntensity * 0.85 &&
        currentSoC < batterySpecs.maxSoC
      ) {
        action = "charge";
        power = Math.min(
          batterySpecs.maxChargePower,
          solarProduction > expectedConsumption
            ? solarProduction - expectedConsumption
            : batterySpecs.maxChargePower,
          ((batterySpecs.maxSoC - currentSoC) / 100) * batterySpecs.capacity * 4
        );
        reason = solarProduction > expectedConsumption
          ? `Storing excess solar (0 gCO2/kWh)`
          : `Grid is ${Math.round(((1 - currentCarbonIntensity / avgCarbonIntensity) * 100))}% cleaner - store clean energy (${Math.round(currentCarbonIntensity)} gCO2/kWh)`;
        savings = (power * 0.25 * (avgCarbonIntensity - currentCarbonIntensity)) / 1000 * 0.05;
      }
    } else if (optimizeFor === "balanced") {
      // BALANCED OPTIMIZATION STRATEGY
      // Balance cost savings with carbon reduction

      // Calculate cost advantage score (0-1)
      const costAdvantage =
        currentRate === peakRate
          ? 1.0 // Strong cost reason to discharge
          : currentRate === offPeakRate
            ? -0.5 // Weak cost reason to charge
            : 0;

      // Calculate carbon advantage score (0-1)
      const carbonAdvantage =
        (avgCarbonIntensity - currentCarbonIntensity) / avgCarbonIntensity;

      // Combined score (weighted 60% cost, 40% carbon)
      const combinedScore = costAdvantage * 0.6 + carbonAdvantage * 0.4;

      // Discharge if combined advantage is positive and we need power
      if (combinedScore > 0.3 && netLoad > 0 && currentSoC > batterySpecs.minSoC) {
        action = "discharge";
        power = Math.min(
          batterySpecs.maxDischargePower,
          netLoad,
          ((currentSoC - batterySpecs.minSoC) / 100) * batterySpecs.capacity * 4
        );
        const costSavings = power * 0.25 * (currentRate - offPeakRate);
        const carbonReduction =
          (power * 0.25 * (currentCarbonIntensity - avgCarbonIntensity)) / 1000;
        reason = `Balanced optimization: Save $${costSavings.toFixed(2)} + ${Math.abs(carbonReduction).toFixed(1)} kg CO2`;
        savings = costSavings + Math.abs(carbonReduction) * 0.05;
      }
      // Charge if grid is cheap AND clean
      else if (
        combinedScore < -0.3 &&
        currentSoC < batterySpecs.maxSoC
      ) {
        action = "charge";
        power = Math.min(
          batterySpecs.maxChargePower,
          solarProduction > expectedConsumption
            ? solarProduction - expectedConsumption
            : batterySpecs.maxChargePower,
          ((batterySpecs.maxSoC - currentSoC) / 100) * batterySpecs.capacity * 4
        );
        reason = solarProduction > expectedConsumption
          ? "Storing excess solar (zero cost, zero carbon)"
          : `Charging: Low rate ($${currentRate.toFixed(2)}/kWh) + clean grid (${Math.round(currentCarbonIntensity)} gCO2/kWh)`;
        savings = power * 0.25 * (peakRate - currentRate);
      }
    }

    // Update state of charge
    if (action === "charge") {
      const energyStored = (power * 0.25) * batterySpecs.efficiency; // 15 min = 0.25 hr
      currentSoC += (energyStored / batterySpecs.capacity) * 100;
    } else if (action === "discharge") {
      const energyReleased = (power * 0.25) / batterySpecs.efficiency;
      currentSoC -= (energyReleased / batterySpecs.capacity) * 100;
    }

    // Clamp SoC to valid range
    currentSoC = Math.max(
      batterySpecs.minSoC,
      Math.min(batterySpecs.maxSoC, currentSoC)
    );

    schedule.push({
      timestamp,
      action,
      power: action === "discharge" ? -power : power,
      stateOfCharge: currentSoC,
      reason,
      savings,
    });
  }

  return schedule;
}

/**
 * Calculate total savings from optimal battery operation
 */
export async function calculateBatterySavings(
  schedule: BatterySchedule[]
): Promise<{
  totalSavings: number;
  energyCostSavings: number;
  demandChargeSavings: number;
  carbonReduction: number;
}> {
  const totalSavings = schedule.reduce((sum, s) => sum + s.savings, 0);

  // Estimate demand charge savings (reduced peak demand)
  const peakReduction = schedule
    .filter((s) => s.action === "discharge")
    .reduce((sum, s) => sum + Math.abs(s.power), 0);

  const demandChargeSavings = peakReduction * 0.1; // Simplified estimate

  // Carbon reduction from shifting consumption to cleaner periods
  const carbonReduction = schedule
    .filter((s) => s.action === "discharge")
    .reduce((sum, s) => sum + Math.abs(s.power) * 0.5, 0); // kg CO2

  return {
    totalSavings,
    energyCostSavings: totalSavings - demandChargeSavings,
    demandChargeSavings,
    carbonReduction,
  };
}

/**
 * Get battery health and degradation estimate
 */
export async function estimateBatteryHealth(
  meterId: string
): Promise<{
  cycleCount: number;
  degradation: number; // %
  estimatedRemainingCapacity: number; // kWh
  recommendedActions: string[];
}> {
  // TODO: Track actual cycle count from measurements
  // For now, estimate based on operational time

  const batterySpecs = await getBatterySpecs(meterId);

  // Simplified degradation model
  // Lithium-ion batteries typically lose 2-3% capacity per year
  const assumedAge = 2; // years
  const degradation = assumedAge * 2.5; // %

  const estimatedRemainingCapacity =
    batterySpecs.capacity * (1 - degradation / 100);

  const recommendedActions = [];

  if (degradation > 15) {
    recommendedActions.push("Consider battery replacement or warranty claim");
  }

  if (batterySpecs.currentSoC < 20) {
    recommendedActions.push("Charge battery to maintain optimal health");
  }

  if (batterySpecs.currentSoC > 95) {
    recommendedActions.push("Avoid keeping battery at full charge for extended periods");
  }

  return {
    cycleCount: 0, // Would track from measurements
    degradation,
    estimatedRemainingCapacity,
    recommendedActions,
  };
}
