# ML Service Architecture & Usage Guide

## Overview

The Enalysis platform uses a **hybrid architecture** with two main components:

1. **Next.js Frontend + TypeScript Backend** (Port 3000)
   - Handles UI, authentication, database operations
   - Orchestrates background jobs
   - Serves API endpoints to frontend

2. **Python ML Service** (Port 8000)
   - Runs Facebook Prophet forecasting models
   - Generates ML-powered recommendations
   - Performs weather-enhanced predictions
   - Handles complex statistical calculations

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / Frontend                        │
│                  (React + Next.js UI)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Requests
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (Port 3000)                  │
│  • Authentication                                            │
│  • Dashboard endpoints                                       │
│  • Background job scheduler                                  │
│  • Database CRUD operations                                  │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
             │ Fetch                        │ Direct DB
             ↓                              ↓
┌────────────────────────┐      ┌─────────────────────────┐
│  Python ML Service     │      │   PostgreSQL Database   │
│    (Port 8000)         │      │    (Supabase)           │
│                        │      │                         │
│ • Prophet Forecasting  │←────→│  • Sites                │
│ • Recommendation Eng.  │      │  • Measurements         │
│ • Weather Integration  │      │  • Forecasts            │
│ • Carbon API           │      │  • Recommendations      │
│ • CAISO API            │      │  • Pricing              │
└────────────────────────┘      └─────────────────────────┘
```

## How It Works: End-to-End Flow

### 1. Background Job Scheduler

**Location**: [lib/scheduler/server.ts](c:\Users\tinas\Multisite\enalysis-mvp\lib\scheduler\server.ts)

The Next.js app runs a background scheduler that triggers jobs periodically:

```typescript
// Jobs run on a schedule
scheduledJobs.push(
  schedule.scheduleJob("0 */6 * * *", async () => {
    // Every 6 hours: Generate AI recommendations
    await generateRecommendations();
  })
);
```

### 2. Recommendation Generation Job

**Location**: [lib/scheduler/jobs/generate-recommendations.ts](c:\Users\tinas\Multisite\enalysis-mvp\lib\scheduler\jobs\generate-recommendations.ts)

This job orchestrates the ML service:

```typescript
async function generateRecommendations() {
  // 1. Check if Python ML service is available
  const mlServiceAvailable = await checkMLServiceHealth();
  // GET http://localhost:8000/health

  if (!mlServiceAvailable) {
    console.warn("ML service not available");
    return;
  }

  // 2. Get all active sites from database
  const activeSites = await db.select().from(sites);

  // 3. Call ML service for each site
  for (const site of activeSites) {
    const result = await callMLService(site.id);
    // POST http://localhost:8000/api/recommend/generate
    // Body: { site_id, forecast_hours: 24, training_days: 7 }
  }
}
```

### 3. Python ML Service Processing

**Location**: [ml-service/app/routers/recommendations.py](c:\Users\tinas\Multisite\enalysis-mvp\ml-service\app\routers\recommendations.py)

When the ML service receives a request:

```python
@router.post("/generate")
async def generate_recommendations(request: RecommendationRequest):
    site_id = request.site_id

    # Step 1: Fetch Data from Database
    measurements = fetch_measurements(site_id, days=7)
    pricing = fetch_pricing_data(site_id)
    carbon_forecast = fetch_carbon_intensity(site_id)

    # Step 2: Generate Consumption Forecast (Prophet)
    forecaster = ConsumptionForecaster()
    consumption_forecast = forecaster.forecast(
        measurements=measurements,
        weather_data=weather_data,  # External API
        hours=24
    )

    # Step 3: Generate Weather Forecast
    weather_forecasts = generate_weather_forecasts(site_id)

    # Step 4: Generate Recommendations
    engine = RecommendationEngine()
    recommendations = engine.generate_recommendations(
        consumption_forecast=consumption_forecast,
        carbon_forecast=carbon_forecast,
        pricing_data=pricing,
        weather_forecast=weather_forecasts
    )

    # Step 5: Save to Database
    save_forecasts_to_db(consumption_forecast)
    save_weather_to_db(weather_forecasts)
    save_recommendations_to_db(recommendations)

    return {
        "saved_count": len(recommendations),
        "forecasts_saved": len(consumption_forecast),
        "weather_forecasts_saved": len(weather_forecasts)
    }
```

### 4. Prophet Forecasting Model

**Location**: [ml-service/app/services/consumption_forecaster.py](c:\Users\tinas\Multisite\enalysis-mvp\ml-service\app\services\consumption_forecaster.py)

Uses Facebook Prophet for time series forecasting:

```python
class ConsumptionForecaster:
    def forecast(self, measurements, weather_data, hours=24):
        # Prepare data for Prophet
        df = pd.DataFrame({
            'ds': [m['timestamp'] for m in measurements],
            'y': [m['value'] for m in measurements]
        })

        # Add weather as external regressors
        if weather_data:
            df['temperature'] = weather_data['temperature']
            df['humidity'] = weather_data['humidity']
            df['cloud_cover'] = weather_data['cloud_cover']

        # Train Prophet model
        model = Prophet()
        model.add_regressor('temperature')
        model.add_regressor('humidity')
        model.add_regressor('cloud_cover')
        model.fit(df)

        # Generate forecast
        future = model.make_future_dataframe(periods=hours, freq='H')
        forecast = model.predict(future)

        return forecast
```

### 5. Recommendation Engine

**Location**: [ml-service/app/services/recommendation_engine.py](c:\Users\tinas\Multisite\enalysis-mvp\ml-service\app\services\recommendation_engine.py)

Generates 7 types of recommendations:

```python
class RecommendationEngine:
    def generate_recommendations(self, consumption_forecast, carbon_forecast,
                                pricing_data, weather_forecast):
        recommendations = []

        # 1. Load Shifting (Carbon)
        carbon_rec = self.generate_carbon_reduction_recommendation(
            consumption_forecast, carbon_forecast
        )
        if carbon_rec:
            recommendations.append(carbon_rec)

        # 2. Peak Avoidance (Cost)
        peak_rec = self.generate_peak_avoidance_recommendation(
            consumption_forecast, pricing_data
        )
        if peak_rec:
            recommendations.append(peak_rec)

        # 3. Demand Charge Reduction (Cost)
        demand_rec = self.generate_demand_charge_recommendation(
            consumption_forecast, pricing_data
        )
        if demand_rec:
            recommendations.append(demand_rec)

        # 4. Weather-based Alerts (NEW)
        weather_rec = self.generate_weather_alert(
            weather_forecast, consumption_forecast, pricing_data
        )
        if weather_rec:
            recommendations.append(weather_rec)

        # 5. Efficiency/Maintenance Alerts (NEW)
        efficiency_rec = self.generate_efficiency_alert(
            consumption_forecast, historical_baseline
        )
        if efficiency_rec:
            recommendations.append(efficiency_rec)

        # 6. HVAC Pre-cooling (NEW)
        hvac_rec = self.generate_hvac_precool_recommendation(
            weather_forecast, pricing_data
        )
        if hvac_rec:
            recommendations.append(hvac_rec)

        # 7. EV Charging Optimization (NEW)
        ev_rec = self.generate_ev_charging_recommendation(
            pricing_data, carbon_forecast
        )
        if ev_rec:
            recommendations.append(ev_rec)

        # Sort by savings and return top 5
        recommendations.sort(key=lambda x: x['cost_savings'], reverse=True)
        return recommendations[:5]
```

### 6. Database Persistence

**Location**: [ml-service/app/database.py](c:\Users\tinas\Multisite\enalysis-mvp\ml-service\app\database.py)

The Python service writes directly to PostgreSQL:

```python
def save_recommendations(recommendations):
    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            for rec in recommendations:
                cursor.execute("""
                    INSERT INTO recommendations (
                        site_id, type, headline, description,
                        cost_savings, co2_reduction, confidence,
                        action_type, recommended_time_start,
                        supporting_data, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    rec['site_id'],
                    rec['type'],
                    rec['headline'],
                    rec['description'],
                    rec['cost_savings'],
                    rec['co2_reduction'],
                    rec['confidence'],
                    rec['action_type'],
                    rec['recommended_time_start'],
                    json.dumps(rec['supporting_data']),
                    'pending'
                ))
            conn.commit()
```

### 7. Frontend Display

**Location**: [components/dashboard-content.tsx](c:\Users\tinas\Multisite\enalysis-mvp\components\dashboard-content.tsx)

The UI fetches recommendations from the Next.js API:

```typescript
// Frontend calls Next.js API
const response = await fetch('/api/dashboard/recommendations?timeRange=today');
const { recommendations } = await response.json();

// Display in UI
{recommendations.map(rec => (
  <RecommendationCard
    headline={rec.headline}
    description={rec.description}
    savings={rec.costSavings}
    confidence={rec.confidence}
  />
))}
```

## ML Service Endpoints

### Base URL
- **Development**: `http://localhost:8000`
- **Production**: `https://your-ml-service.railway.app` (or wherever deployed)

### Available Endpoints

#### 1. Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy"
}
```

#### 2. Generate Recommendations
```http
POST /api/recommend/generate
Content-Type: application/json

{
  "site_id": "uuid",
  "forecast_hours": 24,
  "training_days": 7
}
```

**What it does**:
1. Fetches 7 days of historical measurements
2. Generates 24-hour consumption forecast using Prophet
3. Fetches weather forecasts (40 hours)
4. Generates 4-7 recommendations
5. Saves everything to database

**Response**:
```json
{
  "success": true,
  "site_id": "uuid",
  "saved_count": 5,
  "forecasts_saved": 24,
  "weather_forecasts_saved": 40,
  "recommendations": [
    {
      "type": "cost",
      "headline": "Reduce peak demand at 14:00 to save $247",
      "cost_savings": 247.43,
      "confidence": 90
    }
  ]
}
```

#### 3. Consumption Forecast (Standalone)
```http
POST /api/forecast/consumption
Content-Type: application/json

{
  "site_id": "uuid",
  "hours": 24
}
```

**Response**:
```json
{
  "forecast": [
    {
      "timestamp": "2025-12-16T10:00:00Z",
      "predicted_value": 145.2,
      "lower_bound": 130.5,
      "upper_bound": 160.8,
      "confidence": 92
    }
  ],
  "model_info": {
    "model_type": "prophet",
    "training_data_points": 168,
    "regressors": ["temperature", "humidity", "cloud_cover"]
  }
}
```

## Data Flow for Each Recommendation Type

### 1. **Peak Demand Reduction**

**Data Required**:
- ✅ Consumption forecast (Prophet)
- ✅ Pricing data (from database)
- ✅ Demand charge rate

**Calculation**:
```python
# Find peak consumption hour
peak_hour = max(consumption_forecast, key=lambda x: x['predicted_value'])
current_peak_kw = peak_hour['predicted_value']

# Calculate reduction needed
reducible_kw = (current_peak_kw - demand_threshold) * 0.15  # 15% reduction

# Calculate monthly savings
monthly_savings = reducible_kw * demand_charge_rate

recommendation = {
    'type': 'cost',
    'action_type': 'demand_reduction',
    'headline': f'Reduce peak demand at {peak_time} to save ${monthly_savings:.0f}',
    'cost_savings': monthly_savings,
    'confidence': 90
}
```

---

### 2. **HVAC Pre-cooling**

**Data Required**:
- ✅ Weather forecast (external API)
- ✅ Pricing data (TOU rates)
- ✅ Consumption forecast

**Calculation**:
```python
# Find expensive period
expensive_periods = [p for p in pricing if p['rate'] > 0.12]

# Find cheap period before expensive period
cheap_periods = [p for p in pricing if p['rate'] < 0.08 and p['hour'] < expensive_periods[0]['hour']]

# Calculate savings from rate arbitrage
precool_consumption = 150  # kWh estimate
savings = precool_consumption * (expensive_rate - cheap_rate)

recommendation = {
    'type': 'hvac_optimization',
    'headline': f'Pre-cool building at {cheap_time} to save ${savings:.0f}',
    'cost_savings': savings,
    'recommended_time_start': cheap_period_start,
    'confidence': 80
}
```

---

### 3. **Efficiency Alert**

**Data Required**:
- ✅ Historical measurements (baseline)
- ✅ Recent measurements (current)
- ✅ Pricing data

**Calculation**:
```python
# Calculate baseline (older data)
baseline_avg = np.mean([m['value'] for m in historical_measurements[-720:-168]])

# Calculate recent average (last 7 days)
recent_avg = np.mean([m['value'] for m in historical_measurements[-168:]])

# Check if consumption increased >20%
increase_percent = ((recent_avg - baseline_avg) / baseline_avg) * 100

if increase_percent > 20:
    # Calculate monthly waste
    monthly_waste_kwh = (recent_avg - baseline_avg) * 730
    monthly_cost = monthly_waste_kwh * avg_rate

    recommendation = {
        'type': 'maintenance_alert',
        'headline': f'Equipment consuming {increase_percent:.0f}% more than normal',
        'cost_savings': monthly_cost,
        'confidence': 75
    }
```

## Running the ML Service

### Local Development

```bash
# 1. Navigate to ML service directory
cd enalysis-mvp/ml-service

# 2. Install dependencies
python -m pip install -r requirements.txt

# 3. Start the service
python -m app.main
```

The service will start on **port 8000** and be available at `http://localhost:8000`

### Production Deployment

The ML service should be deployed separately from the Next.js app:

**Option 1: Railway**
```bash
# Railway will automatically detect requirements.txt
railway up
```

**Option 2: Docker**
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "-m", "app.main"]
```

**Option 3: Heroku**
```bash
heroku create enalysis-ml-service
git push heroku main
```

### Environment Variables

Set these in the ML service:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
API_HOST=0.0.0.0
API_PORT=8000
OPENWEATHER_API_KEY=your-key-here  # Optional
```

Set this in the Next.js app:

```bash
ML_SERVICE_URL=http://localhost:8000  # Development
ML_SERVICE_URL=https://your-ml-service.railway.app  # Production
```

## Testing the ML Service

### 1. Test Health Endpoint

```bash
curl http://localhost:8000/health
```

Expected:
```json
{"status": "healthy"}
```

### 2. Test Recommendation Generation

```bash
curl -X POST http://localhost:8000/api/recommend/generate \
  -H "Content-Type: application/json" \
  -d '{
    "site_id": "your-site-id",
    "forecast_hours": 24,
    "training_days": 7
  }'
```

Expected:
```json
{
  "success": true,
  "saved_count": 5,
  "forecasts_saved": 24,
  "weather_forecasts_saved": 40
}
```

### 3. Test via Background Jobs

```bash
cd enalysis-mvp
npx dotenv-cli npx tsx scripts/run-all-jobs.ts
```

This will:
1. Check if ML service is running (health check)
2. Call ML service for each site
3. Generate forecasts and recommendations
4. Save to database

## Performance & Scaling

### Current Performance

- **Forecast Generation**: 15-20 seconds per site
- **Prophet Training**: 10-15 seconds (with 7 days data)
- **Recommendation Logic**: <1 second
- **Weather API Calls**: 2-3 seconds
- **Database Writes**: <1 second

**Total per site**: ~20-30 seconds

### Scaling Considerations

For **< 100 sites**:
- Single Python service instance is sufficient
- Run as scheduled job every 6 hours

For **100-1000 sites**:
- Add job queue (Redis + Bull)
- Process sites in parallel (10 at a time)
- Cache weather data

For **1000+ sites**:
- Separate forecasting service from recommendation service
- Use distributed task queue (Celery)
- Pre-train Prophet models
- Batch database writes

## Troubleshooting

### Issue: "ML service not available"

**Check**:
```bash
# Is the service running?
ps aux | grep python

# Can you reach it?
curl http://localhost:8000/health

# Check logs
cd ml-service
python -m app.main
```

**Solution**: Start the ML service

---

### Issue: "Prophet training fails"

**Check logs**:
```
cmdstanpy - ERROR - Chain [1] failed
```

**Solution**: This is usually due to insufficient data. Need at least 48 hours of measurements.

---

### Issue: "No recommendations generated"

**Check**:
1. ML service is running
2. Sites have recent measurements (last 7 days)
3. Sites have pricing data
4. Database connection is working

```bash
# Run validation
cd enalysis-mvp
npx dotenv-cli npx tsx scripts/validate-recommendations.ts
```

## Summary

The ML service is used as a **standalone Python microservice** that:

1. ✅ Receives requests from Next.js background jobs
2. ✅ Fetches data from PostgreSQL database
3. ✅ Runs Facebook Prophet forecasting models
4. ✅ Calls external APIs (weather, carbon intensity)
5. ✅ Generates 4-7 recommendations per site
6. ✅ Writes forecasts and recommendations back to database
7. ✅ Returns summary to Next.js orchestrator

**Key Benefits**:
- Python-specific ML libraries (Prophet, NumPy, Pandas)
- Isolation (ML crashes don't affect main app)
- Independent scaling
- Language-appropriate tools (TypeScript for web, Python for ML)

**Current Status**: ✅ Running on port 8000, generating ~16 recommendations across 4 sites every 6 hours
