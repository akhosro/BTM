CREATE TYPE "public"."direction_enum" AS ENUM('in', 'out', 'bi');--> statement-breakpoint
CREATE TYPE "public"."industry_type_enum" AS ENUM('biotech', 'datacenter', 'logistics', 'manufacturing', 'healthcare', 'retail', 'other');--> statement-breakpoint
CREATE TYPE "public"."meter_category_enum" AS ENUM('CONS', 'PROD', 'INJ', 'STOR');--> statement-breakpoint
CREATE TYPE "public"."quality_enum" AS ENUM('good', 'bad', 'estimated');--> statement-breakpoint
CREATE TYPE "public"."reading_frequency_enum" AS ENUM('1min', '5min', '15min', 'hourly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."relationship_enum" AS ENUM('energy_flow', 'data_flow', 'dependency');--> statement-breakpoint
CREATE TABLE "consumption_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"forecast_timestamp" timestamp NOT NULL,
	"generated_at" timestamp NOT NULL,
	"forecast_horizon_hours" numeric NOT NULL,
	"predicted_value" double precision NOT NULL,
	"lower_bound" double precision,
	"upper_bound" double precision,
	"unit" text DEFAULT 'kW' NOT NULL,
	"model_type" text NOT NULL,
	"model_version" text,
	"confidence" double precision,
	"data_source" text NOT NULL,
	"training_data_points" numeric,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electricity_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"region" text NOT NULL,
	"utility_provider" text,
	"rate_type" text NOT NULL,
	"rate_structure" jsonb NOT NULL,
	"currency" text DEFAULT 'CAD' NOT NULL,
	"demand_charge" double precision,
	"demand_threshold" double precision,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"active" boolean DEFAULT true,
	"data_source" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "energy_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"capacity" double precision,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_carbon_intensity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"grid_operator" text,
	"timestamp" timestamp NOT NULL,
	"carbon_intensity" double precision NOT NULL,
	"generation_mix" jsonb,
	"forecast_type" text NOT NULL,
	"forecast_horizon_hours" numeric,
	"data_source" text NOT NULL,
	"confidence" double precision,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"metric" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text DEFAULT 'kWh' NOT NULL,
	"quality" "quality_enum" DEFAULT 'good',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"parent_meter_id" uuid,
	"name" text NOT NULL,
	"category" "meter_category_enum" NOT NULL,
	"reading_frequency" "reading_frequency_enum" DEFAULT '15min',
	"capacity" double precision,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"type" text NOT NULL,
	"headline" text NOT NULL,
	"description" text NOT NULL,
	"cost_savings" double precision,
	"co2_reduction" double precision,
	"confidence" double precision NOT NULL,
	"action_type" text,
	"recommended_time_start" timestamp,
	"recommended_time_end" timestamp,
	"supporting_data" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_feedback" text,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"acted_on_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"latitude" double precision,
	"longitude" double precision,
	"industry_type" "industry_type_enum" DEFAULT 'other',
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"timestamp" timestamp NOT NULL,
	"temperature" double precision,
	"feels_like" double precision,
	"humidity" double precision,
	"pressure" double precision,
	"cloud_cover" double precision,
	"solar_irradiance" double precision,
	"uv_index" double precision,
	"wind_speed" double precision,
	"wind_direction" double precision,
	"wind_gust" double precision,
	"precipitation" double precision,
	"precipitation_probability" double precision,
	"visibility" double precision,
	"data_source" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"forecast_timestamp" timestamp NOT NULL,
	"generated_at" timestamp NOT NULL,
	"forecast_horizon_hours" numeric NOT NULL,
	"temperature_forecast" double precision,
	"cloud_cover_forecast" double precision,
	"wind_speed_forecast" double precision,
	"precipitation_forecast" double precision,
	"precipitation_probability" double precision,
	"solar_irradiance_forecast" double precision,
	"solar_generation_forecast" double precision,
	"confidence" double precision,
	"data_source" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumption_forecasts" ADD CONSTRAINT "consumption_forecasts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electricity_pricing" ADD CONSTRAINT "electricity_pricing_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "energy_sources" ADD CONSTRAINT "energy_sources_meter_id_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meters" ADD CONSTRAINT "meters_parent_meter_id_meters_id_fk" FOREIGN KEY ("parent_meter_id") REFERENCES "public"."meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_data" ADD CONSTRAINT "weather_data_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_forecasts" ADD CONSTRAINT "weather_forecasts_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_consumption_forecast_site_time" ON "consumption_forecasts" USING btree ("site_id","forecast_timestamp");--> statement-breakpoint
CREATE INDEX "idx_consumption_forecast_generated" ON "consumption_forecasts" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_consumption_forecast_horizon" ON "consumption_forecasts" USING btree ("forecast_horizon_hours");--> statement-breakpoint
CREATE INDEX "idx_consumption_forecast_timestamp" ON "consumption_forecasts" USING btree ("forecast_timestamp");--> statement-breakpoint
CREATE INDEX "idx_pricing_site" ON "electricity_pricing" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_pricing_region" ON "electricity_pricing" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_pricing_valid_dates" ON "electricity_pricing" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "idx_energy_sources_meter_id" ON "energy_sources" USING btree ("meter_id");--> statement-breakpoint
CREATE INDEX "idx_energy_sources_type" ON "energy_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_carbon_region_time" ON "grid_carbon_intensity" USING btree ("region","timestamp");--> statement-breakpoint
CREATE INDEX "idx_carbon_forecast_type" ON "grid_carbon_intensity" USING btree ("forecast_type");--> statement-breakpoint
CREATE INDEX "idx_carbon_timestamp" ON "grid_carbon_intensity" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_measurements_entity" ON "measurements" USING btree ("entity_id","entity_type");--> statement-breakpoint
CREATE INDEX "idx_measurements_timestamp" ON "measurements" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_measurements_metric" ON "measurements" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "idx_meters_site_id" ON "meters" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_meters_category" ON "meters" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_meters_parent_meter_id" ON "meters" USING btree ("parent_meter_id");--> statement-breakpoint
CREATE INDEX "idx_recommendations_site" ON "recommendations" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "idx_recommendations_status" ON "recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_recommendations_type" ON "recommendations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_recommendations_expires" ON "recommendations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_recommendations_generated" ON "recommendations" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_weather_site_time" ON "weather_data" USING btree ("site_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_weather_timestamp" ON "weather_data" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_forecast_site_time" ON "weather_forecasts" USING btree ("site_id","forecast_timestamp");--> statement-breakpoint
CREATE INDEX "idx_forecast_generated" ON "weather_forecasts" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_forecast_horizon" ON "weather_forecasts" USING btree ("forecast_horizon_hours");