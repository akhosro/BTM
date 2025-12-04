CREATE TABLE "iso_market_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iso" text NOT NULL,
	"region" text,
	"price_type" text NOT NULL,
	"market_type" text DEFAULT 'energy',
	"timestamp" timestamp NOT NULL,
	"price" double precision NOT NULL,
	"currency" text DEFAULT 'CAD' NOT NULL,
	"forecasted_at" timestamp,
	"forecast_horizon_hours" numeric,
	"data_source" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_iso_prices_iso_time_type" ON "iso_market_prices" USING btree ("iso","timestamp","price_type");--> statement-breakpoint
CREATE INDEX "idx_iso_prices_forecasted_at" ON "iso_market_prices" USING btree ("forecasted_at");--> statement-breakpoint
CREATE INDEX "idx_iso_prices_timestamp" ON "iso_market_prices" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_iso_prices_unique" ON "iso_market_prices" USING btree ("iso","timestamp","price_type","forecasted_at");