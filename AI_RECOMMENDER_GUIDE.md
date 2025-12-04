# AI Recommender System - Complete Data Flow Guide

## Overview

The AI Recommender system analyzes energy data from Control Room onboarding and external data sources (pricing, carbon intensity, weather) to generate actionable recommendations for cost savings and carbon reduction.

---

## Complete Data Flow

### 1. Control Room Onboarding → Database

**User Journey:**
1. User completes Control Room onboarding ([control-room-onboarding.tsx](components/control-room-onboarding.tsx))
2. User configures:
   - **Sites**: Name, location, industry type, estimated load
   - **Energy Assets**: Solar, battery, generator, EV chargers
   - **Asset Details**: Capacity, provider, specifications

**API Call:**
```typescript
POST /api/onboarding/complete
{
  sites: [{ name, location, industryType, estimatedLoad }],
  assets: { solar, battery, generator, evChargers },
  solar: { provider, systemSize },
  battery: { provider, capacity, currentCharge },
  generator: { fuelType, capacity, runtime },
  evChargers: { count, powerRating, network }
}
```

**Database Writes:**
- `sites` table: Site information
- `meters` table: Consumption, production, storage, injection meters
- `energy_sources` table: Solar, battery, generator configurations

---

### 2. Seed Contextual Data for AI

Before the AI can make recommendations, we need pricing, carbon, and weather data.

**Step 1: Get Site ID**

After onboarding, get the site ID from your database or API response.

**Step 2: Seed Data**

```bash
POST /api/seed-recommender-data
{
  "siteId": "YOUR_SITE_ID",
  "region": "Ontario"
}
```

**What This Creates:**
- **Electricity Pricing** (1 record):
  - Ontario TOU rates (off-peak: $0.082, mid-peak: $0.113, on-peak: $0.170)
  - Valid from Nov 2024 - Apr 2025

- **Grid Carbon Intensity** (48 records):
  - Past 24 hours actual data
  - Future 24 hours forecast
  - Varies by time of day (25-110 gCO2/kWh)
  - Includes generation mix (nuclear, hydro, gas, wind, solar)

- **Weather Data** (24 records):
  - Past 24 hours observations
  - Temperature, cloud cover, solar irradiance, wind

- **Weather Forecasts** (48 records):
  - Next 48 hours forecast
  - Temperature, solar generation predictions, cloud cover
  - Hourly granularity with confidence scores

---

### 3. Generate AI Recommendations

Now the AI has all the data it needs to generate recommendations.

**API Call:**
```bash
POST /api/generate-recommendations
{
  "siteId": "YOUR_SITE_ID",
  "type": "all"  // or "carbon", "cost", "weather"
}
```

**AI Analysis Logic:**

#### Carbon Optimization
- Analyzes grid carbon intensity forecast
- Identifies cleanest hours (lowest gCO2/kWh)
- Compares to current carbon intensity
- **If EV Chargers exist**: Recommends shifting charging to cleanest hours
- **If Battery exists**: Recommends charging during low-carbon periods

#### Cost Optimization
- Analyzes TOU pricing structure
- Identifies current rate period (off-peak, mid-peak, on-peak)
- **If in peak hours**: Recommends HVAC load reduction
- **If Battery exists**: Recommends discharging during peak, recharging off-peak

#### Weather-Driven
- Analyzes solar generation forecasts
- **If high solar expected**: Recommends shifting loads to solar peak hours
- **If low solar tomorrow**: Recommends pre-charging battery tonight
- Uses cloud cover and irradiance predictions

**Database Writes:**
- `recommendations` table: AI-generated recommendations with:
  - Type (carbon/cost/weather)
  - Headline and description
  - Cost savings and CO2 reduction estimates
  - Confidence scores
  - Recommended time windows
  - Supporting data (rates, intensities, forecasts)
  - Expiration times

---

### 4. Display Recommendations to User

**Fetch Recommendations:**
```bash
GET /api/recommendations?siteId=YOUR_SITE_ID&status=pending
```

**User Actions:**
- **Accept**: Updates `status` to "accepted", sets `actedOnAt`
- **Dismiss**: Updates `status` to "dismissed", sets `actedOnAt`
- **Add Feedback**: Updates `userFeedback` field

```bash
PATCH /api/recommendations
{
  "id": "RECOMMENDATION_ID",
  "status": "accepted",
  "userFeedback": "Implemented successfully"
}
```

---

## Complete Example Workflow

### Step-by-Step Test

```bash
# 1. Complete Control Room Onboarding (via UI or API)
POST /api/onboarding/complete
{
  "config": {
    "sites": [{
      "id": "site-123",
      "name": "Toronto Data Center",
      "industryType": "datacenter",
      "location": "Ontario",
      "estimatedLoad": 850
    }],
    "assets": {
      "grid": true,
      "solar": true,
      "battery": true,
      "evChargers": true
    },
    "solar": { "provider": "solaredge", "systemSize": 100 },
    "battery": { "provider": "tesla", "capacity": 200 },
    "evChargers": { "count": 4, "powerRating": 50 }
  }
}

# Response includes created siteId

# 2. Seed recommender data
POST /api/seed-recommender-data
{
  "siteId": "RETURNED_SITE_ID",
  "region": "Ontario"
}

# Response:
{
  "success": true,
  "counts": {
    "pricing": 1,
    "carbonData": 48,
    "weatherData": 24,
    "weatherForecasts": 48
  }
}

# 3. Generate recommendations
POST /api/generate-recommendations
{
  "siteId": "RETURNED_SITE_ID",
  "type": "all"
}

# Response:
{
  "success": true,
  "count": 6,
  "recommendations": [
    {
      "type": "carbon",
      "headline": "Shift EV charging to 23:00 for cleaner grid",
      "costSavings": null,
      "co2Reduction": 2.75,
      "confidence": 88
    },
    {
      "type": "cost",
      "headline": "Reduce HVAC load during peak hours",
      "costSavings": 17.60,
      "co2Reduction": null,
      "confidence": 93
    },
    // ... more recommendations
  ]
}

# 4. Fetch and display to user
GET /api/recommendations?siteId=RETURNED_SITE_ID&status=pending

# 5. User accepts recommendation
PATCH /api/recommendations
{
  "id": "REC_ID",
  "status": "accepted"
}
```

---

## API Endpoints Summary

### Core Flow
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding/complete` | POST | Save Control Room configuration |
| `/api/seed-recommender-data` | POST | Create mock pricing/carbon/weather data |
| `/api/generate-recommendations` | POST | AI generates recommendations |
| `/api/recommendations` | GET | Fetch recommendations |
| `/api/recommendations` | PATCH | Accept/dismiss recommendations |

### Data Management
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/electricity-pricing` | GET/POST/PATCH | Manage TOU pricing data |
| `/api/grid-carbon` | GET/POST/PUT | Manage carbon intensity data |
| `/api/weather` | GET/POST/PUT | Manage weather data/forecasts |

---

## Database Schema

### Input Tables (from Control Room)
- **sites**: Site configuration
- **meters**: Energy meters (CONS, PROD, INJ, STOR)
- **energy_sources**: Solar, battery, generator details

### Context Tables (from external APIs or seed)
- **electricity_pricing**: TOU rate structures
- **grid_carbon_intensity**: Carbon intensity (actual + forecast)
- **weather_data**: Current weather observations
- **weather_forecasts**: Future weather predictions

### Output Table (AI-generated)
- **recommendations**: AI recommendations with metrics

---

## Recommendation Types

### 1. Carbon Optimization
**Triggers:**
- Grid carbon intensity forecast shows >30% reduction opportunity
- Site has EV chargers or battery storage

**Examples:**
- "Shift EV charging to 11 PM when grid is 65% cleaner"
- "Charge battery during low-carbon period at 2 AM"

**Metrics:**
- CO2 reduction (tCO2)
- Carbon intensity comparison (gCO2/kWh)
- Generation mix breakdown

### 2. Cost Optimization
**Triggers:**
- TOU pricing with significant peak/off-peak differential
- Currently in or approaching peak period
- Site has controllable loads or battery

**Examples:**
- "Reduce HVAC load during peak hours (4-7 PM)"
- "Discharge battery during $0.17/kWh peak, recharge at $0.082/kWh off-peak"

**Metrics:**
- Cost savings ($)
- Rate comparison ($/kWh)
- Load shifting amounts (kW)

### 3. Weather-Driven
**Triggers:**
- High solar generation forecast (>50 kW)
- Significant day-to-day solar variance (>50% change)
- Site has solar panels

**Examples:**
- "High solar output expected tomorrow at 1 PM - delay energy-intensive operations"
- "Low solar forecast for tomorrow - charge battery to 100% tonight"

**Metrics:**
- Solar generation forecast (kW)
- Cloud cover (%)
- Self-consumption optimization

---

## AI Logic Summary

The recommendation generator ([generate-recommendations/route.ts](app/api/generate-recommendations/route.ts)) follows this logic:

1. **Fetch site configuration** (energy assets, capabilities)
2. **Query contextual data** (pricing, carbon, weather)
3. **Analyze patterns**:
   - Find optimal time windows (lowest cost, lowest carbon, highest solar)
   - Calculate potential savings/reductions
   - Match opportunities to site capabilities
4. **Generate recommendations** with:
   - Clear, actionable headlines
   - Detailed descriptions with specific metrics
   - Time windows for action
   - Confidence scores based on forecast reliability
   - Expiration times (recommendations expire if not acted upon)
5. **Store in database** for user review

---

## Next Steps

### For Production
1. **Replace seed data** with real API integrations:
   - IESO API for Ontario pricing and carbon
   - OpenWeatherMap / Solcast for weather
   - WattTime / ElectricityMap for grid carbon

2. **Add background jobs** (cron):
   - Hourly: Fetch latest pricing, carbon, weather
   - Daily: Generate new recommendations
   - Weekly: Cleanup expired recommendations

3. **Enhance AI logic**:
   - Machine learning for pattern recognition
   - Historical analysis for better predictions
   - User behavior feedback loop

4. **Add notifications**:
   - Email/SMS for time-sensitive recommendations
   - Dashboard alerts for urgent actions

---

## Testing the Complete Flow

```bash
# Start dev server
npm run dev

# 1. Open http://localhost:3000/control-room
# 2. Complete onboarding wizard (add sites + assets)
# 3. Get siteId from database or response

# 4. Seed data via API call:
curl -X POST http://localhost:3000/api/seed-recommender-data \
  -H "Content-Type: application/json" \
  -d '{"siteId":"YOUR_SITE_ID","region":"Ontario"}'

# 5. Generate recommendations:
curl -X POST http://localhost:3000/api/generate-recommendations \
  -H "Content-Type: application/json" \
  -d '{"siteId":"YOUR_SITE_ID","type":"all"}'

# 6. View in advisories UI at /advisories
```

---

## Files Reference

**UI Components:**
- [control-room-onboarding.tsx](components/control-room-onboarding.tsx) - User inputs site/asset config
- [advisories-content.tsx](components/advisories-content.tsx) - Displays recommendations

**API Routes:**
- [onboarding/complete/route.ts](app/api/onboarding/complete/route.ts) - Saves onboarding data
- [seed-recommender-data/route.ts](app/api/seed-recommender-data/route.ts) - Creates mock data
- [generate-recommendations/route.ts](app/api/generate-recommendations/route.ts) - AI brain
- [recommendations/route.ts](app/api/recommendations/route.ts) - CRUD for recommendations
- [electricity-pricing/route.ts](app/api/electricity-pricing/route.ts) - Pricing data management
- [grid-carbon/route.ts](app/api/grid-carbon/route.ts) - Carbon data management
- [weather/route.ts](app/api/weather/route.ts) - Weather data management

**Database:**
- [schema.ts](db/schema.ts) - All table definitions
- [migrations/add-recommendations-infrastructure.sql](db/migrations/add-recommendations-infrastructure.sql) - Schema migration

---

**Status: ✅ All components built and ready for testing**
