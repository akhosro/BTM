import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  doublePrecision,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ===============================
// 1. ENUMS & FOUNDATIONAL TYPES
// ===============================

export const directionEnum = pgEnum("direction_enum", ["in", "out", "bi"]);
export const relationshipEnum = pgEnum("relationship_enum", [
  "energy_flow",
  "data_flow",
  "dependency",
]);
export const industryTypeEnum = pgEnum("industry_type_enum", [
  "biotech",
  "datacenter",
  "logistics",
  "manufacturing",
  "healthcare",
  "retail",
  "other",
]);
export const meterCategoryEnum = pgEnum("meter_category_enum", [
  "CONS",
  "PROD",
  "INJ",
  "STOR",
]);
export const readingFrequencyEnum = pgEnum("reading_frequency_enum", [
  "1min",
  "5min",
  "15min",
  "hourly",
  "daily",
]);
export const qualityEnum = pgEnum("quality_enum", ["good", "bad", "estimated"]);

// ===============================
// 2. CORE ENTITIES
// ===============================

// PORTFOLIOS - REMOVED FOR MVP
// Multi-tenant complexity not needed for MVP
// Sites are now the top-level entity

// ---- SITES ----
// Top-level entity in simplified MVP schema
export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(), // Each site belongs to a user
  name: text("name").notNull(),
  location: text("location"),
  latitude: doublePrecision("latitude"), // Required for weather forecasts
  longitude: doublePrecision("longitude"), // Required for weather forecasts
  industryType: industryTypeEnum("industry_type").default("other"),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ASSET TYPES - REMOVED FOR MVP
// Assets and asset types are too granular for MVP
// Meters provide sufficient granularity for energy tracking

// ---- METERS ----
export const meters = pgTable(
  "meters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id, { onDelete: "cascade" })
      .notNull(),
    parentMeterId: uuid("parent_meter_id").references((): any => meters.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    category: meterCategoryEnum("category").notNull(),
    readingFrequency: readingFrequencyEnum("reading_frequency").default(
      "15min"
    ),
    capacity: doublePrecision("capacity"), // in kW
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdIdx: index("idx_meters_site_id").on(table.siteId),
    categoryIdx: index("idx_meters_category").on(table.category),
    parentMeterIdIdx: index("idx_meters_parent_meter_id").on(table.parentMeterId),
  })
);

// ASSETS - REMOVED FOR MVP
// Too granular for MVP - meters are sufficient for tracking energy sources

// ---- ENERGY SOURCES ----
// Stores configuration for data sources (solar panels, batteries, etc.)
// and API connection details in metadata field
export const energySources = pgTable(
  "energy_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meterId: uuid("meter_id")
      .references(() => meters.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull(), // solar, wind, battery, grid, etc.
    capacity: doublePrecision("capacity"), // in kW
    // carbonIntensity and costPerMwh REMOVED - should be calculated, not stored
    // carbonIntensity: derived from sourceType (solar=0, grid=varies by region)
    // costPerMwh: derived from tariff table based on time-of-use rates
    metadata: jsonb("metadata").default({}), // API config: { useAPI, apiProvider, apiKey, systemId, updateFrequency, connectionStatus, lastTested }
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    meterIdIdx: index("idx_energy_sources_meter_id").on(table.meterId),
    sourceTypeIdx: index("idx_energy_sources_type").on(table.sourceType),
  })
);

// ASSET CONNECTIONS - REMOVED FOR MVP
// Only needed if assets table exists

// ENERGY CONNECTIONS - REMOVED FOR MVP
// Overly complex for MVP - relationships handled by foreign keys
// meters.parentMeterId provides hierarchical relationships
// energySources.meterId provides source-to-meter relationships

// ---- MEASUREMENTS ----
export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull(), // Can be asset, meter, or energy source
    entityType: text("entity_type").notNull(), // 'asset', 'meter', 'energy_source'
    timestamp: timestamp("timestamp").notNull(),
    metric: text("metric").notNull(), // 'power', 'energy', 'voltage', 'current', etc.
    value: doublePrecision("value").notNull(),
    unit: text("unit").default("kWh").notNull(),
    quality: qualityEnum("quality").default("good"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index("idx_measurements_entity").on(
      table.entityId,
      table.entityType
    ),
    timestampIdx: index("idx_measurements_timestamp").on(table.timestamp),
    metricIdx: index("idx_measurements_metric").on(table.metric),
  })
);

// ---- RECOMMENDATIONS ----
// AI-generated energy optimization recommendations
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id, { onDelete: "cascade" })
      .notNull(),

    // Recommendation details
    type: text("type").notNull(), // "carbon" | "cost" | "weather"
    headline: text("headline").notNull(),
    description: text("description").notNull(),

    // Impact metrics
    costSavings: doublePrecision("cost_savings"),
    co2Reduction: doublePrecision("co2_reduction"),
    confidence: doublePrecision("confidence").notNull(),

    // Action details
    actionType: text("action_type"),
    recommendedTimeStart: timestamp("recommended_time_start"),
    recommendedTimeEnd: timestamp("recommended_time_end"),

    // Supporting data
    supportingData: jsonb("supporting_data").default({}),

    // User interaction
    status: text("status").default("pending").notNull(), // "pending" | "accepted" | "dismissed"
    userFeedback: text("user_feedback"),

    // Timestamps
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    actedOnAt: timestamp("acted_on_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("idx_recommendations_site").on(table.siteId),
    statusIdx: index("idx_recommendations_status").on(table.status),
    typeIdx: index("idx_recommendations_type").on(table.type),
    expiresIdx: index("idx_recommendations_expires").on(table.expiresAt),
    generatedIdx: index("idx_recommendations_generated").on(table.generatedAt),
  })
);

// ---- ELECTRICITY PRICING ----
// Time-of-use pricing schedules and rate structures
export const electricityPricing = pgTable(
  "electricity_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),

    // Geographic info
    region: text("region").notNull(),
    utilityProvider: text("utility_provider"),

    // Rate structure
    rateType: text("rate_type").notNull(), // "time_of_use" | "fixed" | "real_time" | "tiered"
    rateStructure: jsonb("rate_structure").notNull(),

    currency: text("currency").default("CAD").notNull(),

    // Demand charges
    demandCharge: doublePrecision("demand_charge"),
    demandThreshold: doublePrecision("demand_threshold"),

    // Validity period
    validFrom: timestamp("valid_from").notNull(),
    validTo: timestamp("valid_to"),
    active: boolean("active").default(true),

    // Data source
    dataSource: text("data_source"),
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    siteIdx: index("idx_pricing_site").on(table.siteId),
    regionIdx: index("idx_pricing_region").on(table.region),
    validDatesIdx: index("idx_pricing_valid_dates").on(table.validFrom, table.validTo),
  })
);

// ---- GRID CARBON INTENSITY ----
// Real-time and forecasted grid carbon intensity data
export const gridCarbonIntensity = pgTable(
  "grid_carbon_intensity",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Geographic info
    region: text("region").notNull(),
    gridOperator: text("grid_operator"),

    // Timestamp
    timestamp: timestamp("timestamp").notNull(),

    // Carbon intensity
    carbonIntensity: doublePrecision("carbon_intensity").notNull(), // gCO2/kWh

    // Generation mix
    generationMix: jsonb("generation_mix"),

    // Data type
    forecastType: text("forecast_type").notNull(), // "actual" | "forecast" | "estimated"
    forecastHorizonHours: numeric("forecast_horizon_hours"),

    // Data source
    dataSource: text("data_source").notNull(),
    confidence: doublePrecision("confidence"),

    // Metadata
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    regionTimeIdx: index("idx_carbon_region_time").on(table.region, table.timestamp),
    forecastTypeIdx: index("idx_carbon_forecast_type").on(table.forecastType),
    timestampIdx: index("idx_carbon_timestamp").on(table.timestamp),
  })
);

// ---- CONSUMPTION FORECASTS ----
// Energy consumption forecasts from ML models
export const consumptionForecasts = pgTable(
  "consumption_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id, { onDelete: "cascade" })
      .notNull(),

    // Forecast details
    forecastTimestamp: timestamp("forecast_timestamp").notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    forecastHorizonHours: numeric("forecast_horizon_hours").notNull(),

    // Consumption prediction
    predictedValue: doublePrecision("predicted_value").notNull(),
    lowerBound: doublePrecision("lower_bound"),
    upperBound: doublePrecision("upper_bound"),
    unit: text("unit").default("kW").notNull(),

    // Model information
    modelType: text("model_type").notNull(), // "prophet", "lstm", "arima", etc.
    modelVersion: text("model_version"),
    confidence: doublePrecision("confidence"),

    // Data source and quality
    dataSource: text("data_source").notNull(), // "ml_service", "external_api", etc.
    trainingDataPoints: numeric("training_data_points"), // How many historical points used

    // Additional data
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    siteTimeIdx: index("idx_consumption_forecast_site_time").on(table.siteId, table.forecastTimestamp),
    generatedIdx: index("idx_consumption_forecast_generated").on(table.generatedAt),
    horizonIdx: index("idx_consumption_forecast_horizon").on(table.forecastHorizonHours),
    timestampIdx: index("idx_consumption_forecast_timestamp").on(table.forecastTimestamp),
  })
);

// ---- WEATHER FORECASTS ----
// Weather and solar generation forecasts
export const weatherForecasts = pgTable(
  "weather_forecasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .references(() => sites.id, { onDelete: "cascade" })
      .notNull(),

    // Forecast details
    forecastTimestamp: timestamp("forecast_timestamp").notNull(),
    generatedAt: timestamp("generated_at").notNull(),
    forecastHorizonHours: numeric("forecast_horizon_hours").notNull(),

    // Weather forecast
    temperatureForecast: doublePrecision("temperature_forecast"),
    cloudCoverForecast: doublePrecision("cloud_cover_forecast"),
    windSpeedForecast: doublePrecision("wind_speed_forecast"),
    precipitationForecast: doublePrecision("precipitation_forecast"),
    precipitationProbability: doublePrecision("precipitation_probability"),

    // Solar generation forecast
    solarIrradianceForecast: doublePrecision("solar_irradiance_forecast"),
    solarGenerationForecast: doublePrecision("solar_generation_forecast"),

    // Confidence
    confidence: doublePrecision("confidence"),

    // Data source
    dataSource: text("data_source").notNull(),

    // Additional data
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    siteTimeIdx: index("idx_forecast_site_time").on(table.siteId, table.forecastTimestamp),
    generatedIdx: index("idx_forecast_generated").on(table.generatedAt),
    horizonIdx: index("idx_forecast_horizon").on(table.forecastHorizonHours),
  })
);

// ---- ISO MARKET PRICES ----
// Wholesale electricity market prices from ISOs (IESO, CAISO, etc.)
// Stores both forecasts (day-ahead prices) and actual prices (real-time/historical)
export const isoMarketPrices = pgTable(
  "iso_market_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ISO identification
    iso: text("iso").notNull(), // "IESO", "CAISO", "ERCOT", etc.
    region: text("region"), // Sub-region if applicable (e.g., "Ontario", "Northern California")

    // Price type
    priceType: text("price_type").notNull(), // "forecast" | "actual"
    marketType: text("market_type").default("energy"), // "energy", "demand", "ancillary"

    // Timestamp - when this price applies
    timestamp: timestamp("timestamp").notNull(),

    // Price data
    price: doublePrecision("price").notNull(), // $/MWh
    currency: text("currency").default("CAD").notNull(),

    // Forecast metadata (only for forecast prices)
    forecastedAt: timestamp("forecasted_at"), // When this forecast was generated (null for actual prices)
    forecastHorizonHours: numeric("forecast_horizon_hours"), // How many hours ahead this forecast was made

    // Data source
    dataSource: text("data_source").notNull(), // "IESO_API", "CAISO_OASIS", etc.

    // Additional data
    metadata: jsonb("metadata").default({}), // Can include generation mix, demand levels, etc.

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // Composite index for fast queries by ISO, timestamp, and type
    isoTimestampTypeIdx: index("idx_iso_prices_iso_time_type").on(
      table.iso,
      table.timestamp,
      table.priceType
    ),
    // Index for finding forecasts
    forecastedAtIdx: index("idx_iso_prices_forecasted_at").on(table.forecastedAt),
    // Index for time-based queries
    timestampIdx: index("idx_iso_prices_timestamp").on(table.timestamp),
    // Unique constraint to prevent duplicate entries
    uniquePriceEntry: uniqueIndex("idx_iso_prices_unique").on(
      table.iso,
      table.timestamp,
      table.priceType,
      table.forecastedAt
    ),
  })
);

// ===============================
// 3. RELATIONS
// ===============================

// PORTFOLIOS RELATIONS - REMOVED FOR MVP

export const sitesRelations = relations(sites, ({ many }) => ({
  meters: many(meters),
  recommendations: many(recommendations),
  electricityPricing: many(electricityPricing),
  weatherForecasts: many(weatherForecasts),
  consumptionForecasts: many(consumptionForecasts),
}));

export const metersRelations = relations(meters, ({ one, many }) => ({
  site: one(sites, {
    fields: [meters.siteId],
    references: [sites.id],
  }),
  energySources: many(energySources),
}));

// ASSETS RELATIONS - REMOVED FOR MVP

export const energySourcesRelations = relations(energySources, ({ one }) => ({
  meter: one(meters, {
    fields: [energySources.meterId],
    references: [meters.id],
  }),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  site: one(sites, {
    fields: [recommendations.siteId],
    references: [sites.id],
  }),
}));

export const electricityPricingRelations = relations(electricityPricing, ({ one }) => ({
  site: one(sites, {
    fields: [electricityPricing.siteId],
    references: [sites.id],
  }),
}));

export const weatherForecastsRelations = relations(weatherForecasts, ({ one }) => ({
  site: one(sites, {
    fields: [weatherForecasts.siteId],
    references: [sites.id],
  }),
}));

export const consumptionForecastsRelations = relations(consumptionForecasts, ({ one }) => ({
  site: one(sites, {
    fields: [consumptionForecasts.siteId],
    references: [sites.id],
  }),
}));

// ASSET CONNECTIONS RELATIONS - REMOVED FOR MVP
// GRID LINKS RELATIONS - REMOVED FOR MVP

// ===============================
// USER MANAGEMENT
// ===============================

// ---- USERS ----
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // Nullable for migration, will update existing users
  firstName: text("first_name"),
  lastName: text("last_name"),
  jobTitle: text("job_title"),
  company: text("company"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---- USER PREFERENCES ----
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  // Appearance
  theme: text("theme").default("system"), // "light", "dark", "system"
  // Notifications
  emailNotifications: boolean("email_notifications").default(true),
  alertThresholds: jsonb("alert_thresholds").default({
    highConsumption: 1000, // kWh
    lowProduction: 50, // kW
    batteryLow: 20, // %
  }),
  // Language & Locale
  language: text("language").default("en"), // "en", "fr", etc.
  timezone: text("timezone").default("America/Toronto"),
  // Additional settings
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---- RELATIONS ----
export const usersRelations = relations(users, ({ one }) => ({
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId],
  }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));