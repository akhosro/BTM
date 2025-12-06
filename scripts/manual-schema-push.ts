import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';

async function pushSchema() {
  const connectionString = process.env.DATABASE_URL!;
  console.log('Connecting to Supabase...\n');

  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    console.log('Creating enums...\n');

    // Create enums - PostgreSQL doesn't support IF NOT EXISTS for types, so use DO blocks
    await client`
      DO $$ BEGIN
        CREATE TYPE direction_enum AS ENUM ('in', 'out', 'bi');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE relationship_enum AS ENUM ('energy_flow', 'data_flow', 'dependency');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE industry_type_enum AS ENUM ('biotech', 'datacenter', 'logistics', 'manufacturing', 'healthcare', 'retail', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE meter_category_enum AS ENUM ('CONS', 'PROD', 'INJ', 'STOR');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE reading_frequency_enum AS ENUM ('1min', '5min', '15min', 'hourly', 'daily');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        CREATE TYPE quality_enum AS ENUM ('good', 'bad', 'estimated');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    console.log('✅ Enums created\n');
    console.log('Creating tables...\n');

    // Create users table
    await client`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        auth_provider TEXT DEFAULT 'enphase',
        auth_provider_id TEXT,
        auth_token_encrypted TEXT,
        refresh_token_encrypted TEXT,
        token_expires_at TIMESTAMP,
        role TEXT DEFAULT 'user' NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ users table created');

    // Create sites table
    await client`
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
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ sites table created');

    // Create meters table
    await client`
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
        active BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ meters table created');

    // Add indexes for meters
    await client`CREATE INDEX IF NOT EXISTS idx_meters_site_id ON meters(site_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_meters_parent_meter_id ON meters(parent_meter_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_meters_category ON meters(category)`;

    // Create measurements table
    await client`
      CREATE TABLE IF NOT EXISTS measurements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meter_id UUID NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        quality quality_enum DEFAULT 'good',
        unit TEXT DEFAULT 'kWh',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ measurements table created');

    // Add indexes for measurements
    await client`CREATE INDEX IF NOT EXISTS idx_measurements_meter_timestamp ON measurements(meter_id, timestamp DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS idx_measurements_quality ON measurements(quality)`;

    // Create energy_sources table
    await client`
      CREATE TABLE IF NOT EXISTS energy_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        capacity DOUBLE PRECISION,
        active BOOLEAN DEFAULT TRUE NOT NULL,
        metadata JSONB DEFAULT '{}',
        cost_per_kwh NUMERIC(10, 4),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ energy_sources table created');

    // Add indexes for energy_sources
    await client`CREATE INDEX IF NOT EXISTS idx_energy_sources_site_id ON energy_sources(site_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_energy_sources_type ON energy_sources(source_type)`;

    // Create recommendations table
    await client`
      CREATE TABLE IF NOT EXISTS recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        recommendation_type TEXT NOT NULL,
        priority TEXT DEFAULT 'medium' NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        estimated_savings_kwh DOUBLE PRECISION,
        estimated_savings_dollars DOUBLE PRECISION,
        estimated_carbon_reduction_kg DOUBLE PRECISION,
        implementation_cost DOUBLE PRECISION,
        payback_period_months INTEGER,
        confidence_score DOUBLE PRECISION,
        data_sources JSONB DEFAULT '[]',
        action_items JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        valid_from TIMESTAMP DEFAULT NOW() NOT NULL,
        valid_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ recommendations table created');

    // Add indexes for recommendations
    await client`CREATE INDEX IF NOT EXISTS idx_recommendations_site_id ON recommendations(site_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(recommendation_type)`;
    await client`CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority)`;
    await client`CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status)`;
    await client`CREATE INDEX IF NOT EXISTS idx_recommendations_valid_from ON recommendations(valid_from)`;

    // Create user_preferences table
    await client`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notification_email BOOLEAN DEFAULT TRUE,
        notification_push BOOLEAN DEFAULT FALSE,
        notification_frequency TEXT DEFAULT 'weekly',
        theme TEXT DEFAULT 'light',
        timezone TEXT DEFAULT 'UTC',
        locale TEXT DEFAULT 'en-US',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ user_preferences table created');

    // Create electricity_pricing table
    await client`
      CREATE TABLE IF NOT EXISTS electricity_pricing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        price_per_kwh NUMERIC(10, 4) NOT NULL,
        currency TEXT DEFAULT 'USD',
        rate_type TEXT,
        demand_charge NUMERIC(10, 4),
        tier_level INTEGER,
        time_of_use_period TEXT,
        source TEXT,
        is_forecast BOOLEAN DEFAULT FALSE,
        forecast_confidence DOUBLE PRECISION,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        valid_from TIMESTAMP DEFAULT NOW() NOT NULL,
        valid_until TIMESTAMP
      )
    `;
    console.log('✅ electricity_pricing table created');

    // Add indexes for electricity_pricing
    await client`CREATE INDEX IF NOT EXISTS idx_electricity_pricing_site_timestamp ON electricity_pricing(site_id, timestamp DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_electricity_pricing_timestamp ON electricity_pricing(timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS idx_electricity_pricing_is_forecast ON electricity_pricing(is_forecast)`;

    // Create consumption_forecasts table
    await client`
      CREATE TABLE IF NOT EXISTS consumption_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meter_id UUID NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        forecasted_kwh DOUBLE PRECISION NOT NULL,
        confidence_interval_lower DOUBLE PRECISION,
        confidence_interval_upper DOUBLE PRECISION,
        model_name TEXT,
        model_version TEXT,
        features_used JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        forecast_horizon_hours INTEGER,
        accuracy_score DOUBLE PRECISION,
        created_by TEXT,
        notes TEXT
      )
    `;
    console.log('✅ consumption_forecasts table created');

    // Add indexes for consumption_forecasts
    await client`CREATE INDEX IF NOT EXISTS idx_consumption_forecasts_meter_timestamp ON consumption_forecasts(meter_id, timestamp DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_consumption_forecasts_timestamp ON consumption_forecasts(timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS idx_consumption_forecasts_model ON consumption_forecasts(model_name)`;
    await client`CREATE INDEX IF NOT EXISTS idx_consumption_forecasts_horizon ON consumption_forecasts(forecast_horizon_hours)`;

    // Create weather_forecasts table
    await client`
      CREATE TABLE IF NOT EXISTS weather_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        temperature DOUBLE PRECISION,
        humidity DOUBLE PRECISION,
        wind_speed DOUBLE PRECISION,
        cloud_cover DOUBLE PRECISION,
        solar_irradiance DOUBLE PRECISION,
        precipitation DOUBLE PRECISION,
        weather_condition TEXT,
        source TEXT DEFAULT 'openweather',
        is_forecast BOOLEAN DEFAULT TRUE,
        forecast_confidence DOUBLE PRECISION,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        forecast_horizon_hours INTEGER
      )
    `;
    console.log('✅ weather_forecasts table created');

    // Add indexes for weather_forecasts
    await client`CREATE INDEX IF NOT EXISTS idx_weather_forecasts_site_timestamp ON weather_forecasts(site_id, timestamp DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_weather_forecasts_timestamp ON weather_forecasts(timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS idx_weather_forecasts_is_forecast ON weather_forecasts(is_forecast)`;

    // Create grid_carbon_intensity table
    await client`
      CREATE TABLE IF NOT EXISTS grid_carbon_intensity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP NOT NULL,
        grid_region TEXT NOT NULL,
        carbon_intensity_gco2_per_kwh DOUBLE PRECISION NOT NULL,
        fossil_fuel_percentage DOUBLE PRECISION,
        renewable_percentage DOUBLE PRECISION,
        source TEXT DEFAULT 'electricitymaps',
        is_forecast BOOLEAN DEFAULT FALSE,
        forecast_confidence DOUBLE PRECISION,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        forecast_horizon_hours INTEGER
      )
    `;
    console.log('✅ grid_carbon_intensity table created');

    // Add indexes for grid_carbon_intensity
    await client`CREATE INDEX IF NOT EXISTS idx_grid_carbon_intensity_region_timestamp ON grid_carbon_intensity(grid_region, timestamp DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_grid_carbon_intensity_timestamp ON grid_carbon_intensity(timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS idx_grid_carbon_intensity_is_forecast ON grid_carbon_intensity(is_forecast)`;

    // Create iso_market_prices table
    await client`
      CREATE TABLE IF NOT EXISTS iso_market_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP NOT NULL,
        iso_region TEXT NOT NULL,
        node_id TEXT,
        lmp_price NUMERIC(10, 4) NOT NULL,
        energy_component NUMERIC(10, 4),
        congestion_component NUMERIC(10, 4),
        loss_component NUMERIC(10, 4),
        market_type TEXT,
        source TEXT DEFAULT 'caiso',
        is_forecast BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `;
    console.log('✅ iso_market_prices table created');

    // Add indexes for iso_market_prices
    await client`CREATE INDEX IF NOT EXISTS idx_iso_market_prices_region_timestamp ON iso_market_prices(iso_region, timestamp DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_iso_market_prices_timestamp ON iso_market_prices(timestamp)`;
    await client`CREATE INDEX IF NOT EXISTS idx_iso_market_prices_node ON iso_market_prices(node_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_iso_market_prices_market_type ON iso_market_prices(market_type)`;

    console.log('\n✅ All tables created successfully!');

    // Verify
    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log(`\n📊 Total tables in Supabase: ${tables.length}`);
    tables.forEach(row => console.log(`  - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    process.exit(0);
  }
}

pushSchema();
