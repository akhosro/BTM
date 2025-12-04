/**
 * Type definitions inferred from the database schema
 * Use these types throughout your application for type safety
 */

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

// ===============================
// SELECT TYPES (for reading data)
// ===============================

export type Site = InferSelectModel<typeof schema.sites>;
export type Meter = InferSelectModel<typeof schema.meters>;
export type EnergySource = InferSelectModel<typeof schema.energySources>;
export type Measurement = InferSelectModel<typeof schema.measurements>;
export type Recommendation = InferSelectModel<typeof schema.recommendations>;
export type ElectricityPricing = InferSelectModel<typeof schema.electricityPricing>;
export type GridCarbonIntensity = InferSelectModel<typeof schema.gridCarbonIntensity>;
export type ConsumptionForecast = InferSelectModel<typeof schema.consumptionForecasts>;
export type WeatherForecast = InferSelectModel<typeof schema.weatherForecasts>;

// ===============================
// INSERT TYPES (for creating data)
// ===============================

export type NewSite = InferInsertModel<typeof schema.sites>;
export type NewMeter = InferInsertModel<typeof schema.meters>;
export type NewEnergySource = InferInsertModel<typeof schema.energySources>;
export type NewMeasurement = InferInsertModel<typeof schema.measurements>;
export type NewRecommendation = InferInsertModel<typeof schema.recommendations>;
export type NewElectricityPricing = InferInsertModel<typeof schema.electricityPricing>;
export type NewGridCarbonIntensity = InferInsertModel<typeof schema.gridCarbonIntensity>;
export type NewConsumptionForecast = InferInsertModel<typeof schema.consumptionForecasts>;
export type NewWeatherForecast = InferInsertModel<typeof schema.weatherForecasts>;

// ===============================
// ENUM TYPES
// ===============================

export type DirectionEnum = "in" | "out" | "bi";
export type RelationshipEnum = "energy_flow" | "data_flow" | "dependency";
export type IndustryTypeEnum =
  | "biotech"
  | "datacenter"
  | "logistics"
  | "manufacturing"
  | "healthcare"
  | "retail"
  | "other";
export type MeterCategoryEnum = "CONS" | "PROD" | "INJ" | "STOR";
export type ReadingFrequencyEnum = "1min" | "5min" | "15min" | "hourly" | "daily";
export type QualityEnum = "good" | "bad" | "estimated";
export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "dismissed";
export type GridType = "consumption" | "injection";
export type ImplementationComplexity = "low" | "medium" | "high";

// ===============================
// EXTENDED TYPES (with relations)
// ===============================

export type SiteWithMeters = Site & {
  meters: Meter[];
  recommendations: Recommendation[];
};

export type MeterWithSources = Meter & {
  energySources: EnergySource[];
};

export type SiteComplete = Site & {
  meters: (Meter & {
    energySources: EnergySource[];
  })[];
  recommendations: Recommendation[];
};

// ===============================
// UTILITY TYPES
// ===============================

export type EntityType = "meter" | "energy_source" | "site";

export type MeasurementEntity =
  | { type: "meter"; id: string }
  | { type: "energy_source"; id: string }
  | { type: "site"; id: string };

// ===============================
// METRIC TYPES
// ===============================

export type MetricType =
  | "power"
  | "energy"
  | "voltage"
  | "current"
  | "frequency"
  | "power_factor"
  | "temperature"
  | "cost"
  | "carbon";

export type MeasurementWithMetadata = Measurement & {
  metadata?: {
    source?: string;
    confidence?: number;
    [key: string]: any;
  };
};

// ===============================
// ANALYTICS TYPES
// ===============================

export interface EnergyMetrics {
  totalPower: number; // kW
  totalEnergy: number; // kWh
  totalCost: number; // $
  totalCarbon: number; // kg CO2
  efficiency: number; // %
}

export interface SiteMetrics extends EnergyMetrics {
  siteId: string;
  siteName: string;
  meterCount: number;
  timestamp: Date;
}

// ===============================
// QUERY RESULT TYPES
// ===============================

export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  metric: string;
  unit: string;
  quality: QualityEnum;
}

export interface EnergyFlowData {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  targetId: string;
  targetName: string;
  targetType: string;
  power: number;
  timestamp: Date;
}

// ===============================
// RECOMMENDATION TYPES
// ===============================

export interface RecommendationWithROI extends Recommendation {
  roi?: number; // calculated: (savings * 12) / (paybackMonths * (savings / paybackMonths))
  annualSavings?: number;
  annualCarbonReduction?: number;
}

// ===============================
// FILTER & QUERY TYPES
// ===============================

export interface MeasurementFilter {
  entityId?: string;
  entityType?: EntityType;
  metric?: MetricType;
  startDate?: Date;
  endDate?: Date;
  quality?: QualityEnum;
}

export interface SiteFilter {
  industryType?: IndustryTypeEnum;
  active?: boolean;
  search?: string;
}

export interface RecommendationFilter {
  siteId?: string;
  status?: RecommendationStatus;
  priority?: RecommendationPriority;
  category?: string;
  minSavings?: number;
  maxPayback?: number;
}