-- ===============================
-- ENALYSIS MVP DATABASE SCHEMA
-- Inspired by energy management system
-- ===============================

-- 1. ENUMS & FOUNDATIONAL TYPES
-- ===============================

CREATE TYPE direction_enum AS ENUM ('in', 'out', 'bi');
CREATE TYPE relationship_enum AS ENUM ('energy_flow', 'data_flow', 'dependency');
CREATE TYPE industry_type_enum AS ENUM ('biotech', 'datacenter', 'logistics', 'manufacturing', 'healthcare', 'retail', 'other');
CREATE TYPE meter_category_enum AS ENUM ('CONS', 'PROD', 'INJ', 'STOR');
CREATE TYPE reading_frequency_enum AS ENUM ('1min', '5min', '15min', 'hourly', 'daily');
CREATE TYPE quality_enum AS ENUM ('good', 'bad', 'estimated');

-- ===============================
-- 2. CORE ENTITIES
-- ===============================

-- ---- PORTFOLIOS ----
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ---- SITES ----
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    industry_type industry_type_enum DEFAULT 'other',
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_sites_portfolio_id ON sites(portfolio_id);

-- ---- ASSET TYPES ----
CREATE TABLE asset_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    direction direction_enum NOT NULL,
    is_expandable BOOLEAN DEFAULT TRUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ---- METERS ----
CREATE TABLE meters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    category meter_category_enum NOT NULL,
    reading_frequency reading_frequency_enum DEFAULT '15min',
    capacity DOUBLE PRECISION,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_meters_site_id ON meters(site_id);
CREATE INDEX idx_meters_category ON meters(category);

-- ---- ASSETS ----
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID REFERENCES meters(id) ON DELETE CASCADE NOT NULL,
    type_id UUID REFERENCES asset_types(id) ON DELETE RESTRICT NOT NULL,
    parent_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    model TEXT,
    manufacturer TEXT,
    capacity DOUBLE PRECISION,
    specs JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_assets_meter_id ON assets(meter_id);
CREATE INDEX idx_assets_parent ON assets(parent_asset_id);
CREATE INDEX idx_assets_type_id ON assets(type_id);

-- ---- ENERGY SOURCES ----
CREATE TABLE energy_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id UUID REFERENCES meters(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    capacity DOUBLE PRECISION,
    carbon_intensity DOUBLE PRECISION,
    cost_per_mwh DOUBLE PRECISION,
    metadata JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_energy_sources_meter_id ON energy_sources(meter_id);
CREATE INDEX idx_energy_sources_type ON energy_sources(source_type);

-- ---- ASSET CONNECTIONS ----
CREATE TABLE asset_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
    target_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
    relationship_type relationship_enum DEFAULT 'energy_flow',
    flow_capacity DOUBLE PRECISION,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (source_asset_id, target_asset_id, relationship_type)
);

CREATE INDEX idx_asset_connections_source ON asset_connections(source_asset_id);
CREATE INDEX idx_asset_connections_target ON asset_connections(target_asset_id);

-- ---- ENERGY CONNECTIONS ----
CREATE TABLE energy_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL,
    target_id UUID NOT NULL,
    source_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    power DOUBLE PRECISION,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_energy_connections_source ON energy_connections(source_id, source_type);
CREATE INDEX idx_energy_connections_target ON energy_connections(target_id, target_type);

-- ---- MEASUREMENTS ----
CREATE TABLE measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    metric TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT DEFAULT 'kWh' NOT NULL,
    quality quality_enum DEFAULT 'good',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_measurements_entity ON measurements(entity_id, entity_type);
CREATE INDEX idx_measurements_timestamp ON measurements(timestamp);
CREATE INDEX idx_measurements_metric ON measurements(metric);

-- ---- GRID LINKS ----
CREATE TABLE grid_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    grid_name TEXT,
    grid_type TEXT NOT NULL CHECK (grid_type IN ('consumption', 'injection')),
    capacity_mw NUMERIC(10, 3),
    tariff_structure JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_grid_links_site_id ON grid_links(site_id);

-- ---- RECOMMENDATIONS ----
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
    estimated_savings DOUBLE PRECISION,
    estimated_cost_reduction DOUBLE PRECISION,
    estimated_carbon_reduction DOUBLE PRECISION,
    payback_months DOUBLE PRECISION,
    implementation_complexity TEXT CHECK (implementation_complexity IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_recommendations_site_id ON recommendations(site_id);
CREATE INDEX idx_recommendations_status ON recommendations(status);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);

-- ===============================
-- 3. BASE DATA (REFERENCE)
-- ===============================

INSERT INTO asset_types (code, name, direction, is_expandable, description)
VALUES
('CONS', 'Consumption', 'in', TRUE, 'Meters or equipment consuming power'),
('PROD', 'Production', 'out', FALSE, 'Assets generating power such as solar or wind'),
('C/I', 'Battery/Storage', 'bi', TRUE, 'Bidirectional energy storage'),
('INJ', 'Grid Injection', 'out', FALSE, 'Exporting electricity to grid');

-- ===============================
-- 4. HELPER FUNCTIONS (OPTIONAL)
-- ===============================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meters_updated_at BEFORE UPDATE ON meters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_energy_sources_updated_at BEFORE UPDATE ON energy_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at BEFORE UPDATE ON recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();