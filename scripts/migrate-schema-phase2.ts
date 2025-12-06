import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migratePhase2() {
  console.log("⚠️  Starting Phase 2: Creating tables...");

  try {
    // 1. USERS TABLE
    console.log("Creating users table...");
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        first_name TEXT,
        last_name TEXT,
        job_title TEXT,
        company TEXT,
        phone TEXT,
        avatar_url TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // 2. SITES TABLE
    console.log("Creating sites table...");
    await sql`
      CREATE TABLE IF NOT EXISTS sites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        location TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        industry_type industry_type_enum DEFAULT 'other',
        description TEXT,
        metadata JSONB DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // 3. METERS TABLE
    console.log("Creating meters table...");
    await sql`
      CREATE TABLE IF NOT EXISTS meters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        parent_meter_id UUID REFERENCES meters(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category meter_category_enum NOT NULL,
        reading_frequency reading_frequency_enum DEFAULT '15min',
        capacity DOUBLE PRECISION,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for meters
    await sql`CREATE INDEX IF NOT EXISTS idx_meters_site_id ON meters(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_meters_category ON meters(category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_meters_parent_meter_id ON meters(parent_meter_id)`;

    // 4. ENERGY SOURCES TABLE
    console.log("Creating energy_sources table...");
    await sql`
      CREATE TABLE IF NOT EXISTS energy_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meter_id UUID NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        capacity DOUBLE PRECISION,
        metadata JSONB DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for energy_sources
    await sql`CREATE INDEX IF NOT EXISTS idx_energy_sources_meter_id ON energy_sources(meter_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_energy_sources_type ON energy_sources(source_type)`;

    // 5. MEASUREMENTS TABLE
    console.log("Creating measurements table...");
    await sql`
      CREATE TABLE IF NOT EXISTS measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_id UUID NOT NULL,
        entity_type TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        metric TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        unit TEXT NOT NULL DEFAULT 'kWh',
        quality quality_enum DEFAULT 'good',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for measurements
    await sql`CREATE INDEX IF NOT EXISTS idx_measurements_entity ON measurements(entity_id, entity_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_measurements_metric ON measurements(metric)`;

    // 6. RECOMMENDATIONS TABLE
    console.log("Creating recommendations table...");
    await sql`
      CREATE TABLE IF NOT EXISTS recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        headline TEXT NOT NULL,
        description TEXT NOT NULL,
        cost_savings DOUBLE PRECISION,
        co2_reduction DOUBLE PRECISION,
        confidence DOUBLE PRECISION NOT NULL,
        action_type TEXT,
        recommended_time_start TIMESTAMP,
        recommended_time_end TIMESTAMP,
        supporting_data JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        user_feedback TEXT,
        generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP,
        acted_on_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for recommendations
    await sql`CREATE INDEX IF NOT EXISTS idx_recommendations_site ON recommendations(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recommendations_expires ON recommendations(expires_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_recommendations_generated ON recommendations(generated_at)`;

    // 7. USER PREFERENCES TABLE
    console.log("Creating user_preferences table...");
    await sql`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT DEFAULT 'system',
        email_notifications BOOLEAN DEFAULT true,
        alert_thresholds JSONB DEFAULT '{"highConsumption": 1000, "lowProduction": 50, "batteryLow": 20}',
        language TEXT DEFAULT 'en',
        timezone TEXT DEFAULT 'America/Toronto',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // 8. ELECTRICITY PRICING TABLE
    console.log("Creating electricity_pricing table...");
    await sql`
      CREATE TABLE IF NOT EXISTS electricity_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        region TEXT NOT NULL,
        utility_provider TEXT,
        rate_type TEXT NOT NULL,
        rate_structure JSONB NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CAD',
        demand_charge DOUBLE PRECISION,
        demand_threshold DOUBLE PRECISION,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP,
        active BOOLEAN DEFAULT true,
        data_source TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for electricity_pricing
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_site ON electricity_pricing(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_region ON electricity_pricing(region)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pricing_valid_dates ON electricity_pricing(valid_from, valid_to)`;

    // 9. CONSUMPTION FORECASTS TABLE
    console.log("Creating consumption_forecasts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS consumption_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        forecast_timestamp TIMESTAMP NOT NULL,
        generated_at TIMESTAMP NOT NULL,
        forecast_horizon_hours NUMERIC NOT NULL,
        predicted_value DOUBLE PRECISION NOT NULL,
        lower_bound DOUBLE PRECISION,
        upper_bound DOUBLE PRECISION,
        unit TEXT NOT NULL DEFAULT 'kW',
        model_type TEXT NOT NULL,
        model_version TEXT,
        confidence DOUBLE PRECISION,
        data_source TEXT NOT NULL,
        training_data_points NUMERIC,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for consumption_forecasts
    await sql`CREATE INDEX IF NOT EXISTS idx_consumption_forecast_site_time ON consumption_forecasts(site_id, forecast_timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consumption_forecast_generated ON consumption_forecasts(generated_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consumption_forecast_horizon ON consumption_forecasts(forecast_horizon_hours)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consumption_forecast_timestamp ON consumption_forecasts(forecast_timestamp)`;

    // 10. WEATHER FORECASTS TABLE
    console.log("Creating weather_forecasts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS weather_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        forecast_timestamp TIMESTAMP NOT NULL,
        generated_at TIMESTAMP NOT NULL,
        forecast_horizon_hours NUMERIC NOT NULL,
        temperature_forecast DOUBLE PRECISION,
        cloud_cover_forecast DOUBLE PRECISION,
        wind_speed_forecast DOUBLE PRECISION,
        precipitation_forecast DOUBLE PRECISION,
        precipitation_probability DOUBLE PRECISION,
        solar_irradiance_forecast DOUBLE PRECISION,
        solar_generation_forecast DOUBLE PRECISION,
        confidence DOUBLE PRECISION,
        data_source TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for weather_forecasts
    await sql`CREATE INDEX IF NOT EXISTS idx_forecast_site_time ON weather_forecasts(site_id, forecast_timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_forecast_generated ON weather_forecasts(generated_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_forecast_horizon ON weather_forecasts(forecast_horizon_hours)`;

    // 11. GRID CARBON INTENSITY TABLE
    console.log("Creating grid_carbon_intensity table...");
    await sql`
      CREATE TABLE IF NOT EXISTS grid_carbon_intensity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        region TEXT NOT NULL,
        grid_operator TEXT,
        timestamp TIMESTAMP NOT NULL,
        carbon_intensity DOUBLE PRECISION NOT NULL,
        generation_mix JSONB,
        forecast_type TEXT NOT NULL,
        forecast_horizon_hours NUMERIC,
        data_source TEXT NOT NULL,
        confidence DOUBLE PRECISION,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for grid_carbon_intensity
    await sql`CREATE INDEX IF NOT EXISTS idx_carbon_region_time ON grid_carbon_intensity(region, timestamp)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carbon_forecast_type ON grid_carbon_intensity(forecast_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_carbon_timestamp ON grid_carbon_intensity(timestamp)`;

    // 12. ISO MARKET PRICES TABLE
    console.log("Creating iso_market_prices table...");
    await sql`
      CREATE TABLE IF NOT EXISTS iso_market_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        iso TEXT NOT NULL,
        region TEXT,
        price_type TEXT NOT NULL,
        market_type TEXT DEFAULT 'energy',
        timestamp TIMESTAMP NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CAD',
        forecasted_at TIMESTAMP,
        forecast_horizon_hours NUMERIC,
        data_source TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    // Create indexes for iso_market_prices
    await sql`CREATE INDEX IF NOT EXISTS idx_iso_prices_iso_time_type ON iso_market_prices(iso, timestamp, price_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_iso_prices_forecasted_at ON iso_market_prices(forecasted_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_iso_prices_timestamp ON iso_market_prices(timestamp)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_iso_prices_unique ON iso_market_prices(iso, timestamp, price_type, forecasted_at)`;

    console.log("✅ Phase 2 complete - All tables created successfully!");
    console.log("\n🎉 Schema migration complete!");
    console.log("\nNext steps:");
    console.log("1. Test sign-up in production");
    console.log("2. Add environment variables to Vercel");
    console.log("3. Update ML service CORS for production domain");

  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    console.error("Full error:", error);
    await sql.end();
    process.exit(1);
  }

  // Close the connection
  await sql.end();
}

migratePhase2().catch(console.error);
