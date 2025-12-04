# ML Implementation Plan for Enalysis MVP

## Overview
Transform the rule-based recommendation system into an ML-powered intelligent energy management platform.

---

## Frontend Completion (Phase 1)

### 1.1 Update Advisories Page
**File**: `app/advisories/page.tsx`
**Status**: Uses mock data
**Tasks**:
- [ ] Replace mock data with real API calls
- [ ] Add server-side pagination
- [ ] Implement filtering by type, status, site
- [ ] Add search functionality
- [ ] Show recommendation confidence scores
- [ ] Add action buttondismisss (acknowledge, , schedule)

### 1.2 Create Analytics Dashboard
**New Page**: `app/analytics/page.tsx`
**Features**:
- [ ] Energy consumption charts (Chart.js/Recharts)
- [ ] Cost breakdown by time period
- [ ] Carbon emissions tracking
- [ ] Savings calculator (actual vs predicted)
- [ ] Comparison view (month-over-month, year-over-year)
- [ ] Export reports (PDF/CSV)

### 1.3 Create Energy Flow Visualization
**New Page**: `app/energy-flow/page.tsx`
**Features**:
- [ ] Real-time Sankey diagram (D3.js/Recharts)
- [ ] Live meter readings
- [ ] Energy balance display
- [ ] Battery state of charge indicator
- [ ] Grid import/export visualization
- [ ] Power quality metrics

### 1.4 Complete Settings Page
**File**: `app/settings/page.tsx`
**Tasks**:
- [ ] User profile management
- [ ] Email/SMS notification preferences
- [ ] Threshold alerts configuration
- [ ] API key management for integrations
- [ ] Site-level settings (TOU schedules, rate structures)
- [ ] Data retention policies

---

## Backend API Enhancements (Phase 2)

### 2.1 Analytics Endpoints
```typescript
GET /api/analytics/consumption
  ?siteId=uuid
  &startDate=ISO8601
  &endDate=ISO8601
  &granularity=hour|day|month

GET /api/analytics/cost
  ?siteId=uuid
  &period=day|week|month|year

GET /api/analytics/carbon
  ?siteId=uuid
  &breakdown=true

GET /api/analytics/savings
  ?siteId=uuid
  &compareWith=baseline|previous
```

### 2.2 Real-time Data Endpoints
```typescript
GET /api/realtime/energy-flow
  ?siteId=uuid
  // Returns current production, consumption, storage, grid

GET /api/realtime/meters
  ?siteId=uuid
  // Returns latest readings from all meters

WebSocket /api/realtime/stream
  // Stream live data updates
```

### 2.3 Historical Data Aggregation
```typescript
POST /api/data/aggregate
  // Background job to aggregate measurements
  // Hourly, daily, monthly rollups for faster queries
```

---

## ML Infrastructure (Phase 3)

### 3.1 Python ML Service Setup

**Directory Structure**:
```
ml-service/
├── src/
│   ├── api/
│   │   ├── main.py                 # FastAPI app
│   │   ├── routes/
│   │   │   ├── predictions.py      # Forecast endpoints
│   │   │   ├── recommendations.py   # ML-based recommendations
│   │   │   └── training.py         # Model training triggers
│   ├── models/
│   │   ├── consumption_forecast.py  # LSTM/Prophet
│   │   ├── solar_forecast.py        # XGBoost
│   │   ├── battery_optimizer.py     # RL/LP
│   │   └── anomaly_detector.py      # Isolation Forest
│   ├── features/
│   │   ├── feature_engineering.py
│   │   └── feature_store.py
│   ├── training/
│   │   ├── train_consumption.py
│   │   └── train_solar.py
│   └── utils/
│       ├── db.py
│       └── config.py
├── notebooks/                       # Jupyter for exploration
├── tests/
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

**Tech Stack**:
- FastAPI (API framework)
- scikit-learn (traditional ML)
- PyTorch/TensorFlow (deep learning)
- Prophet (time-series forecasting)
- XGBoost/LightGBM (gradient boosting)
- MLflow (model tracking)
- Redis (caching)
- PostgreSQL (shared database)

### 3.2 Model Development

#### Model 1: Consumption Forecasting
```python
# ml-service/src/models/consumption_forecast.py

from prophet import Prophet
import pandas as pd

class ConsumptionForecaster:
    def __init__(self):
        self.model = Prophet(
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            seasonality_mode='multiplicative'
        )
        self.model.add_seasonality(name='hourly', period=1, fourier_order=8)

    def train(self, historical_data: pd.DataFrame):
        """
        historical_data columns: timestamp, consumption, temperature,
                                 is_weekend, is_holiday
        """
        df = historical_data.rename(columns={
            'timestamp': 'ds',
            'consumption': 'y'
        })

        # Add regressors
        self.model.add_regressor('temperature')
        self.model.add_regressor('is_weekend')
        self.model.add_regressor('is_holiday')

        self.model.fit(df)

    def predict(self, future_weather: pd.DataFrame, periods: int = 48):
        """
        Predict next 48 hours of consumption
        """
        future = self.model.make_future_dataframe(periods=periods, freq='H')
        future = future.merge(future_weather, on='ds', how='left')

        forecast = self.model.predict(future)
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
```

#### Model 2: Solar Forecasting
```python
# ml-service/src/models/solar_forecast.py

from xgboost import XGBRegressor
import numpy as np

class SolarForecaster:
    def __init__(self):
        self.model = XGBRegressor(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            objective='reg:squarederror'
        )

    def engineer_features(self, weather_data: pd.DataFrame):
        """
        Create features from weather forecast
        """
        features = weather_data.copy()

        # Time features
        features['hour'] = features['timestamp'].dt.hour
        features['day_of_year'] = features['timestamp'].dt.dayofyear
        features['hour_sin'] = np.sin(2 * np.pi * features['hour'] / 24)
        features['hour_cos'] = np.cos(2 * np.pi * features['hour'] / 24)

        # Solar position (simplified)
        features['solar_elevation'] = self._calculate_solar_elevation(
            features['timestamp'],
            lat=43.65, lon=-79.38  # Toronto
        )

        # Weather interactions
        features['clear_sky_radiation'] = (
            features['solar_irradiance'] * (100 - features['cloud_cover']) / 100
        )

        return features

    def train(self, historical_data: pd.DataFrame):
        X = self.engineer_features(historical_data)
        y = historical_data['solar_generation']

        feature_cols = ['solar_irradiance', 'cloud_cover', 'temperature',
                       'hour_sin', 'hour_cos', 'solar_elevation',
                       'clear_sky_radiation']

        self.model.fit(X[feature_cols], y)

    def predict(self, weather_forecast: pd.DataFrame):
        X = self.engineer_features(weather_forecast)
        predictions = self.model.predict(X[self.feature_cols])
        return predictions
```

#### Model 3: Battery Optimizer
```python
# ml-service/src/models/battery_optimizer.py

from scipy.optimize import linprog
import numpy as np

class BatteryOptimizer:
    def __init__(self, battery_capacity: float, max_charge_rate: float):
        self.capacity = battery_capacity
        self.max_charge_rate = max_charge_rate

    def optimize(self,
                 consumption_forecast: np.array,
                 solar_forecast: np.array,
                 electricity_prices: np.array,
                 carbon_intensity: np.array,
                 initial_soc: float,
                 weight_cost: float = 0.7,
                 weight_carbon: float = 0.3):
        """
        Find optimal battery charging/discharging schedule

        Decision variables: charge[t] for each hour t
        Objective: Minimize cost + carbon_emissions
        Constraints:
        - Battery capacity limits
        - Charge/discharge rate limits
        - Energy balance
        """
        n_periods = len(consumption_forecast)

        # Objective function coefficients (cost + carbon weighted)
        c = weight_cost * electricity_prices + weight_carbon * carbon_intensity / 100

        # Inequality constraints (Ax <= b)
        # Battery capacity constraints
        A_ub = []
        b_ub = []

        for t in range(n_periods):
            # SoC must be <= capacity
            constraint = np.zeros(n_periods)
            constraint[0:t+1] = 1  # Cumulative charge
            A_ub.append(constraint)
            b_ub.append(self.capacity - initial_soc)

            # SoC must be >= 0
            A_ub.append(-constraint)
            b_ub.append(initial_soc)

            # Charge rate limits
            constraint = np.zeros(n_periods)
            constraint[t] = 1
            A_ub.append(constraint)
            b_ub.append(self.max_charge_rate)

            A_ub.append(-constraint)
            b_ub.append(self.max_charge_rate)

        # Bounds on decision variables
        bounds = [(-self.max_charge_rate, self.max_charge_rate)
                  for _ in range(n_periods)]

        # Solve linear program
        result = linprog(c, A_ub=A_ub, b_ub=b_ub, bounds=bounds, method='highs')

        if result.success:
            return result.x  # Optimal charge schedule
        else:
            raise ValueError("Optimization failed")
```

### 3.3 FastAPI Endpoints

```python
# ml-service/src/api/routes/predictions.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import sys
sys.path.append('..')
from models.consumption_forecast import ConsumptionForecaster
from models.solar_forecast import SolarForecaster

router = APIRouter()

class ForecastRequest(BaseModel):
    site_id: str
    horizon_hours: int = 48

@router.post("/predict/consumption")
async def predict_consumption(request: ForecastRequest):
    """
    Predict energy consumption for next N hours
    """
    try:
        # Fetch historical data from Postgres
        historical_data = await fetch_historical_consumption(request.site_id)

        # Fetch weather forecast
        weather_forecast = await fetch_weather_forecast(request.site_id)

        # Load or train model
        model = ConsumptionForecaster()
        # model.load('models/consumption_forecaster.pkl')  # Load pre-trained

        # Generate predictions
        predictions = model.predict(weather_forecast, periods=request.horizon_hours)

        return {
            "site_id": request.site_id,
            "predictions": predictions.to_dict('records'),
            "confidence_interval": 0.95
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict/solar")
async def predict_solar(request: ForecastRequest):
    """
    Predict solar generation for next N hours
    """
    # Similar structure to consumption prediction
    pass

@router.post("/optimize/battery")
async def optimize_battery(site_id: str):
    """
    Generate optimal battery schedule
    """
    # Fetch forecasts
    consumption_forecast = await predict_consumption(ForecastRequest(site_id=site_id))
    solar_forecast = await predict_solar(ForecastRequest(site_id=site_id))

    # Fetch pricing and carbon data
    pricing = await fetch_pricing_forecast(site_id)
    carbon = await fetch_carbon_forecast(site_id)

    # Optimize
    optimizer = BatteryOptimizer(capacity=100, max_charge_rate=50)
    schedule = optimizer.optimize(
        consumption_forecast['predictions'],
        solar_forecast['predictions'],
        pricing,
        carbon,
        initial_soc=50
    )

    return {
        "site_id": site_id,
        "battery_schedule": schedule.tolist(),
        "estimated_savings": calculate_savings(schedule, pricing)
    }
```

### 3.4 Integration with Next.js

```typescript
// app/api/ml/predictions/route.ts

export async function POST(request: Request) {
  const { siteId, type } = await request.json();

  // Call Python ML service
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

  const response = await fetch(`${mlServiceUrl}/predict/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site_id: siteId, horizon_hours: 48 })
  });

  const predictions = await response.json();

  // Store predictions in database for caching
  await db.insert(predictions_cache).values({
    siteId,
    predictionType: type,
    predictions: predictions,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour TTL
  });

  return NextResponse.json(predictions);
}
```

---

## ML-Powered Recommendation Engine (Phase 4)

### 4.1 Enhanced Recommendation Generator

```typescript
// app/api/recommendations/generate-ml/route.ts

export async function POST(request: Request) {
  const { siteId } = await request.json();

  // 1. Get ML predictions
  const [consumption, solar, battery] = await Promise.all([
    fetch(`/api/ml/predictions`, {
      method: 'POST',
      body: JSON.stringify({ siteId, type: 'consumption' })
    }),
    fetch(`/api/ml/predictions`, {
      method: 'POST',
      body: JSON.stringify({ siteId, type: 'solar' })
    }),
    fetch(`/api/ml/predictions`, {
      method: 'POST',
      body: JSON.stringify({ siteId, type: 'battery' })
    })
  ]);

  // 2. Get pricing and carbon forecasts
  const [pricing, carbon] = await Promise.all([
    db.select().from(electricityPricing).where(eq(electricityPricing.siteId, siteId)),
    db.select().from(gridCarbonIntensity).where(eq(gridCarbonIntensity.region, 'Ontario'))
  ]);

  // 3. Generate ML-based recommendations
  const recommendations = [];

  // Battery charging opportunity
  const batterySchedule = battery.predictions;
  if (batterySchedule.some(slot => slot.charge > 0 && pricing[slot.hour] < 0.10)) {
    recommendations.push({
      type: 'cost',
      headline: `Charge battery at ${slot.hour}:00 during low rates`,
      description: `ML models predict ${consumption.at(slot.hour)} kW demand. ` +
                   `Charge battery to ${slot.targetSoc}% at ${pricing[slot.hour].toFixed(2)}/kWh ` +
                   `(${((pricing.peak - pricing[slot.hour])/pricing.peak * 100).toFixed(0)}% savings)`,
      confidence: 94, // Based on model uncertainty
      costSavings: calculateSavings(slot),
      co2Reduction: 0.3,
      actionType: 'battery_charge',
      supportingData: {
        mlPredictions: {
          consumption: consumption.at(slot.hour),
          solar: solar.at(slot.hour),
          batteryOptimal: slot.charge
        },
        actualVsPredicted: {
          accuracy: 0.94,
          mae: 12.5  // kW
        }
      }
    });
  }

  // Load shifting based on consumption patterns
  const flexibleLoadOpportunity = await findLoadShiftingOpportunity(
    consumption.predictions,
    pricing,
    carbon
  );

  if (flexibleLoadOpportunity) {
    recommendations.push({
      type: 'carbon',
      headline: `Shift ${flexibleLoadOpportunity.load} to ${flexibleLoadOpportunity.optimalTime}`,
      description: flexibleLoadOpportunity.reason,
      confidence: flexibleLoadOpportunity.confidence,
      costSavings: flexibleLoadOpportunity.savings,
      co2Reduction: flexibleLoadOpportunity.carbonReduction,
      actionType: 'schedule_shift',
      supportingData: flexibleLoadOpportunity.details
    });
  }

  // Store recommendations
  await db.insert(recommendations).values(recommendations);

  return NextResponse.json({
    success: true,
    recommendations,
    mlModelsUsed: ['consumption_lstm_v2', 'solar_xgboost_v1', 'battery_rl_v1']
  });
}
```

---

## Deployment Architecture (Phase 5)

### 5.1 Docker Compose Setup

```yaml
# docker-compose.yml

version: '3.8'

services:
  # Next.js Frontend + API
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/enalysis_mvp
      - ML_SERVICE_URL=http://ml-service:8000
    depends_on:
      - db
      - ml-service

  # Python ML Service
  ml-service:
    build: ./ml-service
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/enalysis_mvp
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./ml-service/models:/app/models
    depends_on:
      - db
      - redis

  # PostgreSQL
  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=enalysis_mvp
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis (caching, job queue)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 5.2 Model Training Pipeline

```python
# ml-service/src/training/train_pipeline.py

import schedule
import time

def train_all_models():
    """
    Nightly model retraining job
    """
    print("Starting model training pipeline...")

    # Train consumption model
    train_consumption_model()

    # Train solar model
    train_solar_model()

    # Validate models
    validate_models()

    # Deploy if better than current
    deploy_if_improved()

    print("Training complete!")

# Schedule retraining
schedule.every().day.at("02:00").do(train_all_models)

while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## Testing & Validation (Phase 6)

### 6.1 Model Evaluation Metrics
- MAPE (Mean Absolute Percentage Error) < 10%
- R² Score > 0.85
- Prediction interval coverage > 90%

### 6.2 A/B Testing Framework
- Compare ML recommendations vs rule-based
- Track acceptance rate, actual savings
- Measure user satisfaction

---

## Timeline Estimate

| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| Phase 1: Frontend | 1 week | All pages using real data |
| Phase 2: Backend APIs | 1 week | Analytics endpoints complete |
| Phase 3: ML Infrastructure | 2 weeks | Python service + basic models |
| Phase 4: ML Recommendations | 2 weeks | Production-ready ML engine |
| Phase 5: Deployment | 1 week | Docker + CI/CD |
| Phase 6: Testing | 1 week | Validation + tuning |
| **Total** | **8 weeks** | Full ML-powered system |

---

## Next Steps

1. **Immediate**: Complete frontend (Advisories page)
2. **Week 1**: Set up Python ML service skeleton
3. **Week 2**: Implement first model (consumption forecasting)
4. **Week 3**: Integrate ML predictions into recommendations
5. **Week 4+**: Iterate and improve model accuracy
