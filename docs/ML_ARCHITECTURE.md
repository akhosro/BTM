# ML Service Architecture

## Overview

The Enalysis platform uses a **hybrid ML architecture** combining Python and TypeScript services for optimal performance and flexibility.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App (Port 3000)                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Background Job Scheduler                       │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  lib/scheduler/jobs/generate-recommendations.ts     │  │ │
│  │  │  - Runs every 6 hours                                │  │ │
│  │  │  - Calls Python ML Service for each active site     │  │ │
│  │  │  - Health check & graceful degradation             │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────────┘
                          │ HTTP POST
                          │ /api/recommend/generate
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python ML Service (Port 8000)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  FastAPI Service (ml-service/)                             │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Prophet Consumption Forecaster                      │  │ │
│  │  │  - 24-hour ahead forecasting                         │  │ │
│  │  │  - Trained on 7 days historical data                 │  │ │
│  │  │  - Confidence intervals                              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Weather Service (OpenWeatherMap/SolCast)           │  │ │
│  │  │  - Solar irradiance forecasting                      │  │ │
│  │  │  - Cloud cover, temperature                          │  │ │
│  │  │  - Solar generation estimates                        │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Recommendation Engine                               │  │ │
│  │  │  - Load shifting opportunities                       │  │ │
│  │  │  - Peak avoidance strategies                         │  │ │
│  │  │  - Solar self-consumption optimization               │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                              │ │
│  │  Saves to Database:                                          │ │
│  │  ✓ Consumption forecasts                                    │ │
│  │  ✓ Weather forecasts                                        │ │
│  │  ✓ AI recommendations                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            TypeScript ML Services (lib/ml/)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Battery Optimization (battery-optimization.ts)            │ │
│  │  - Real-time charge/discharge scheduling                   │ │
│  │  - Carbon-aware optimization modes                         │ │
│  │  - Dynamic programming algorithm                           │ │
│  │  - Tight integration with Next.js                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Solar Forecasting (solar-forecast.ts)                     │ │
│  │  - Statistical bell curve model                            │ │
│  │  - Weather API integration                                 │ │
│  │  - Fallback when Python service unavailable                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Python ML Service (`ml-service/`)

**Purpose**: Advanced machine learning forecasting and recommendations

**Key Features**:
- **Prophet-based forecasting**: Facebook Prophet for consumption prediction
- **Weather integration**: OpenWeatherMap and SolCast for solar forecasting
- **Recommendation engine**: ML-powered load shifting and peak avoidance
- **Database persistence**: Saves forecasts and recommendations directly

**When to use**:
- Complex time series forecasting
- Historical pattern analysis
- Long-term predictions (24+ hours)
- Batch recommendation generation

**Dependencies**:
- Python 3.x
- FastAPI
- Prophet (Facebook)
- PostgreSQL (via psycopg2)

### TypeScript ML Services (`lib/ml/`)

**Purpose**: Real-time optimization and calculations

**Key Features**:
- **Battery optimization**: Real-time charge/discharge decisions
- **Carbon-aware modes**: Cost, carbon, or balanced optimization
- **Weather-enhanced**: Uses weather APIs for solar forecasting
- **Fast execution**: Native TypeScript performance

**When to use**:
- Real-time battery control decisions
- User-triggered calculations
- Dashboard statistics
- Immediate optimization needs

**Dependencies**:
- TypeScript
- Drizzle ORM
- Next.js runtime

### Background Scheduler (`lib/scheduler/`)

**Purpose**: Orchestration layer between systems

**Key Features**:
- **Health checking**: Verifies Python ML service availability
- **Graceful degradation**: Continues if ML service unavailable
- **Automatic scheduling**: Runs every 6 hours
- **Multi-site support**: Processes all active sites sequentially

**Jobs**:
1. **Energy data sync**: Every 15 minutes
2. **Carbon intensity**: Every hour
3. **AI recommendations**: Every 6 hours (calls Python ML service)
4. **Data cleanup**: Daily at 2 AM

## Data Flow

### Recommendation Generation Flow

```
1. Scheduler triggers (every 6 hours)
   ↓
2. Health check Python ML service
   ↓
3. For each active site:
   a. Fetch site_id
   b. POST /api/recommend/generate
      {
        "site_id": "uuid",
        "forecast_hours": 24,
        "training_days": 7
      }
   c. Python service:
      - Fetches historical measurements
      - Trains Prophet model
      - Generates 24h forecast
      - Fetches weather data
      - Analyzes carbon intensity
      - Creates recommendations
      - Saves to database
   d. Returns: saved_count, forecasts_saved, weather_forecasts_saved
   ↓
4. Log results and statistics
```

### Dashboard Display Flow

```
1. User visits dashboard
   ↓
2. API route: /api/dashboard/recommendations
   ↓
3. Query recommendations table
   ↓
4. Filter by:
   - status = 'pending'
   - recommendedTimeStart >= now
   - siteId (if specified)
   ↓
5. Return to frontend
   ↓
6. Display in "AI Recommendations" section
```

## Setup Instructions

### 1. Start Python ML Service

```bash
cd ml-service

# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Run service
python -m app.main
```

Service will start on `http://localhost:8000`

### 2. Configure Environment Variables

In `.env`:
```bash
# Python ML Service URL
ML_SERVICE_URL="http://localhost:8000"

# Enable background scheduler
ENABLE_SCHEDULER=true

# Optional: Weather APIs for better forecasts
OPENWEATHERMAP_API_KEY="your_key"
SOLCAST_API_KEY="your_key"
```

### 3. Start Next.js App

```bash
npm run dev
```

### 4. Verify Integration

Visit:
- Python ML Service: http://localhost:8000 (should show service info)
- Next.js Dashboard: http://localhost:3000

Check logs for:
```
✅ Python ML service is healthy
🔍 Calling ML service for Site Name...
✅ Generated 3 recommendations, 24 forecasts, 24 weather forecasts
```

## Troubleshooting

### Python ML Service Not Available

**Symptom**: Logs show `⚠️ Python ML service not available`

**Solution**:
```bash
cd ml-service
python -m app.main
```

Verify service is running:
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy"}
```

### No Recommendations Generated

**Possible causes**:
1. Insufficient historical data (need 48+ measurements)
2. No active sites in database
3. Python ML service not running

**Debug**:
```bash
# Check active sites
psql postgresql://postgres:1519188@127.0.0.1:5432/enalysis_mvp
SELECT id, name, active FROM sites;

# Check measurements
SELECT COUNT(*) FROM measurements;

# Manually trigger recommendation job
# In Next.js console or API route:
import { runJobManually } from "@/lib/scheduler";
await runJobManually("generate-recommendations");
```

### TypeScript Type Errors

If you see import errors for `forecastSolarProduction` or `calculateBatterySavings`, these functions were removed in favor of the Python ML service. The TypeScript ML services are now focused on real-time battery optimization only.

## Performance Considerations

### Python ML Service
- **Startup time**: ~2-3 seconds
- **Forecast generation**: ~500ms per site
- **Recommendation generation**: ~1-2 seconds per site
- **Memory**: ~100-200 MB

### TypeScript Services
- **Battery optimization**: ~50-100ms
- **Solar forecast**: ~20-50ms
- **Memory**: Shared with Next.js process

## Future Enhancements

- [ ] LSTM models for advanced consumption forecasting
- [ ] Reinforcement learning for battery control
- [ ] Solar generation forecasting with XGBoost
- [ ] Model versioning and A/B testing
- [ ] Caching layer for faster responses
- [ ] WebSocket real-time updates
- [ ] Multi-tenancy support with rate limiting
