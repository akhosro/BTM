# Data Population Guide

This guide explains how to populate all the tables in your Enalysis MVP database with test/production data.

## Overview

Your system has the following data sources already implemented:

✅ **Already Implemented:**
- ISO Market Prices (IESO API)
- Grid Carbon Intensity (WattTime API with fallback)
- Consumption Forecasts (Python ML Service)
- Weather Forecasts (Python ML Service)
- Recommendations (Python ML Service)

## Quick Start - Populate ALL Data

### Step 1: Start the Python ML Service

```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

The ML service should start on `http://localhost:8000`

### Step 2: Sync IESO Market Prices

**Fetch day-ahead forecast prices:**

*PowerShell:*
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/iso-prices/sync" -Method POST -ContentType "application/json" -Body '{"priceType": "forecast"}'
```

*Bash/Linux:*
```bash
curl -X POST http://localhost:3000/api/iso-prices/sync \
  -H "Content-Type: application/json" \
  -d '{"priceType": "forecast"}'
```

**Fetch historical actual prices (last 7 days):**

*PowerShell:*
```powershell
$body = @{
    priceType = "actual"
    startDate = "2025-11-30"
    endDate = "2025-12-07"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/iso-prices/sync" -Method POST -ContentType "application/json" -Body $body
```

*Bash/Linux:*
```bash
curl -X POST http://localhost:3000/api/iso-prices/sync \
  -H "Content-Type: application/json" \
  -d '{
    "priceType": "actual",
    "startDate": "2025-11-30",
    "endDate": "2025-12-07"
  }'
```

**Fetch both forecast and actual:**

*PowerShell:*
```powershell
$body = @{
    priceType = "both"
    startDate = "2025-11-30"
    endDate = "2025-12-07"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/iso-prices/sync" -Method POST -ContentType "application/json" -Body $body
```

*Bash/Linux:*
```bash
curl -X POST http://localhost:3000/api/iso-prices/sync \
  -H "Content-Type: application/json" \
  -d '{
    "priceType": "both",
    "startDate": "2025-11-30",
    "endDate": "2025-12-07"
  }'
```

### Step 3: Run Background Jobs

You can trigger all jobs via the admin API:

**Sync Carbon Intensity:**

*PowerShell:*
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/jobs" -Method POST -ContentType "application/json" -Body '{"jobName": "sync-carbon"}' -Headers @{"Cookie"="<your-session-cookie>"}
```

*Bash/Linux:*
```bash
curl -X POST http://localhost:3000/api/admin/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"jobName": "sync-carbon"}'
```

**Generate Recommendations (includes consumption & weather forecasts):**

*PowerShell:*
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/jobs" -Method POST -ContentType "application/json" -Body '{"jobName": "generate-recommendations"}' -Headers @{"Cookie"="<your-session-cookie>"}
```

*Bash/Linux:*
```bash
curl -X POST http://localhost:3000/api/admin/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"jobName": "generate-recommendations"}'
```

**✅ RECOMMENDED: Use the Admin Dashboard**
Navigate to `/admin` in your browser and click the "Run Job" buttons for each job. This is easier than managing session cookies in PowerShell!

### Step 4: Verify Data

**Check ISO prices:**
```bash
curl http://localhost:3000/api/iso-prices/sync
```

**Check consumption forecasts:**
```bash
curl "http://localhost:3000/api/forecasts/consumption?siteId=YOUR_SITE_ID&hours=24"
```

**Check weather forecasts:**
```bash
curl "http://localhost:3000/api/forecasts/weather?siteId=YOUR_SITE_ID&hours=24"
```

**Check recommendations:**
```bash
curl "http://localhost:3000/api/dashboard/recommendations?siteId=YOUR_SITE_ID"
```

## Detailed Breakdown

### 1. Consumption Forecasts (`consumption_forecasts` table)

**Source:** Python ML Service (Prophet model)
**Populated by:** `generate-recommendations` job
**How it works:**
- ML service fetches historical measurements from your database
- Trains Prophet model on consumption patterns
- Generates 24-48 hour forecasts
- Saves forecasts to `consumption_forecasts` table

**Data fields populated:**
- `siteId` - The site being forecasted
- `forecastTimestamp` - When the forecast applies
- `generatedAt` - When the forecast was created
- `forecastHorizonHours` - How many hours ahead
- `predictedValue` - Main forecast value (kW)
- `lowerBound` / `upperBound` - Confidence intervals
- `modelType` - "prophet"
- `confidence` - Model confidence score
- `dataSource` - "ml_service"

### 2. Grid Carbon Intensity (`grid_carbon_intensity` table)

**Source:** WattTime API (with fallback to estimated patterns)
**Populated by:** `sync-carbon` job
**How it works:**
- Fetches 24-hour carbon intensity forecasts for each site's location
- Falls back to realistic patterns if WattTime unavailable
- Stores actual, forecast, and estimated values

**Data fields populated:**
- `region` - Geographic region (e.g., "Ontario")
- `gridOperator` - Grid operator (e.g., "IESO")
- `timestamp` - When the intensity applies
- `carbonIntensity` - gCO2/kWh
- `generationMix` - Mix of energy sources (if available)
- `forecastType` - "actual" | "forecast" | "estimated"
- `dataSource` - "watttime" or "estimated"
- `confidence` - Forecast confidence

**Configuration:**
Set environment variables for real data:
```bash
WATTTIME_USERNAME=your_username
WATTTIME_PASSWORD=your_password
```

### 3. ISO Market Prices (`iso_market_prices` table)

**Source:** IESO Public API
**Populated by:** Manual API call to `/api/iso-prices/sync`
**How it works:**
- Fetches day-ahead forecast prices from IESO
- Fetches real-time actual prices for historical data
- No API key required (public data)

**Data fields populated:**
- `iso` - "IESO"
- `region` - "Ontario"
- `priceType` - "forecast" | "actual"
- `marketType` - "energy"
- `timestamp` - When the price applies
- `price` - $/MWh
- `currency` - "CAD"
- `forecastedAt` - When forecast was made (for forecast type)
- `forecastHorizonHours` - Hours ahead (for forecast type)
- `dataSource` - "IESO_API"

**No configuration needed** - uses public IESO data.

### 4. Weather Forecasts (`weather_forecasts` table)

**Source:** Python ML Service (using Weather API)
**Populated by:** `generate-recommendations` job
**How it works:**
- ML service fetches weather data for site coordinates
- Generates solar generation forecasts based on weather
- Combines with solar panel capacity data

**Data fields populated:**
- `siteId` - The site being forecasted
- `forecastTimestamp` - When the forecast applies
- `generatedAt` - When forecast was created
- `forecastHorizonHours` - Hours ahead
- `temperatureForecast` - Temperature (°C)
- `cloudCoverForecast` - Cloud cover (0-1)
- `windSpeedForecast` - Wind speed (m/s)
- `precipitationForecast` - Precipitation (mm)
- `precipitationProbability` - Probability (0-1)
- `solarIrradianceForecast` - W/m²
- `solarGenerationForecast` - Expected solar output (kW)
- `confidence` - Forecast confidence
- `dataSource` - Weather API source

### 5. Recommendations (`recommendations` table)

**Source:** Python ML Service (AI recommendations engine)
**Populated by:** `generate-recommendations` job
**How it works:**
- Analyzes consumption patterns, forecasts, carbon intensity, and prices
- Generates optimization recommendations (shift loads, charge batteries, etc.)
- Calculates potential cost savings and CO2 reductions

**Data fields populated:**
- `siteId` - Target site
- `type` - "carbon" | "cost" | "weather"
- `headline` - Short recommendation title
- `description` - Detailed explanation
- `costSavings` - Potential $ savings
- `co2Reduction` - Potential CO2 reduction (kg)
- `confidence` - Recommendation confidence
- `actionType` - Recommended action
- `recommendedTimeStart` / `End` - When to act
- `supportingData` - Additional context (JSON)
- `status` - "pending" | "accepted" | "dismissed"
- `generatedAt` - When created
- `expiresAt` - When recommendation expires

## Automation Setup

### Option 1: Scheduled Jobs (Production)

The system has built-in job scheduling. Jobs run automatically:

- **sync-carbon**: Every hour
- **generate-recommendations**: Every 6 hours
- **sync-energy**: Every 15 minutes

To enable automatic scheduling, ensure your app is running continuously.

### Option 2: Cron Jobs (Self-hosted)

Add to crontab:

```bash
# Sync carbon intensity every hour
0 * * * * curl -X POST http://localhost:3000/api/admin/jobs -d '{"jobName":"sync-carbon"}'

# Generate recommendations every 6 hours
0 */6 * * * curl -X POST http://localhost:3000/api/admin/jobs -d '{"jobName":"generate-recommendations"}'

# Sync ISO prices daily at 6 AM
0 6 * * * curl -X POST http://localhost:3000/api/iso-prices/sync -d '{"priceType":"forecast"}'
```

### Option 3: Manual Testing

Use the admin dashboard at `/admin` to manually trigger jobs whenever needed.

## Verification Queries

Check data in each table:

```sql
-- Check consumption forecasts
SELECT COUNT(*), MIN(forecast_timestamp), MAX(forecast_timestamp)
FROM consumption_forecasts;

-- Check grid carbon intensity
SELECT COUNT(*), MIN(timestamp), MAX(timestamp)
FROM grid_carbon_intensity;

-- Check ISO market prices
SELECT COUNT(*), price_type, MIN(timestamp), MAX(timestamp)
FROM iso_market_prices
GROUP BY price_type;

-- Check weather forecasts
SELECT COUNT(*), MIN(forecast_timestamp), MAX(forecast_timestamp)
FROM weather_forecasts;

-- Check recommendations
SELECT COUNT(*), type, status
FROM recommendations
GROUP BY type, status;
```

## Troubleshooting

### ML Service Not Available

**Error:** "ML service unavailable"
**Solution:** Start the Python ML service:
```bash
cd ml-service
python -m app.main
```

### WattTime API Errors

**Error:** "WattTime API unavailable"
**Impact:** System falls back to estimated carbon intensity
**Solution:** Configure WattTime credentials in `.env`:
```
WATTTIME_USERNAME=your_username
WATTTIME_PASSWORD=your_password
```

### IESO API Errors

**Error:** "Failed to fetch IESO forecast prices"
**Possible causes:**
- Date too far in the past/future
- IESO server temporarily down
- Network connectivity issues
**Solution:** Try a different date range or retry later

### No Forecasts Generated

**Cause:** Not enough historical data
**Solution:** Ensure you have at least 7 days of measurement data:
```bash
npx tsx scripts/seed-measurement-data.ts
```

## Summary

To populate all tables, run these commands in order:

```bash
# 1. Ensure measurement data exists (from your seed scripts)
npx tsx scripts/seed-measurement-data.ts

# 2. Start ML service
cd ml-service && python -m app.main

# 3. Sync ISO prices
curl -X POST http://localhost:3000/api/iso-prices/sync -d '{"priceType":"forecast"}'

# 4. Run jobs (or use admin dashboard at /admin)
curl -X POST http://localhost:3000/api/admin/jobs -d '{"jobName":"sync-carbon"}'
curl -X POST http://localhost:3000/api/admin/jobs -d '{"jobName":"generate-recommendations"}'
```

That's it! All five tables will be populated with realistic data. ✅
