# Enalysis ML Service

Machine Learning service for generating intelligent energy management recommendations.

## Features

- **Consumption Forecasting**: Prophet-based time series forecasting for energy consumption
- **Load Shift Recommendations**: ML-powered suggestions for shifting loads to low carbon/cost periods
- **Peak Avoidance**: Identifies peak consumption periods and suggests reduction strategies
- **Real-time Integration**: REST API for seamless integration with Next.js frontend

## Setup

### 1. Create Virtual Environment

```bash
cd ml-service
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Run the Service

```bash
# Development mode (auto-reload)
python -m app.main

# Or with uvicorn directly
uvicorn app.main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Generate Consumption Forecast
```
POST /api/forecast/consumption
{
  "site_id": "uuid",
  "hours_ahead": 24,
  "training_days": 7
}
```

### Generate Recommendations
```
POST /api/recommend/generate
{
  "site_id": "uuid",
  "forecast_hours": 24,
  "training_days": 7
}
```

## Architecture

```
ml-service/
├── app/
│   ├── main.py                 # FastAPI application
│   ├── database.py             # Database connection & queries
│   ├── routers/
│   │   ├── forecasting.py      # Forecasting endpoints
│   │   └── recommendations.py  # Recommendation endpoints
│   ├── services/
│   │   ├── consumption_forecaster.py   # Prophet forecasting
│   │   └── recommendation_engine.py    # Recommendation logic
│   └── models/                 # Trained model storage
├── requirements.txt
└── .env
```

## Integration with Next.js

The Next.js backend can call the ML service to generate recommendations:

```typescript
// app/api/recommendations/generate/route.ts
const response = await fetch('http://localhost:8000/api/recommend/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ site_id, forecast_hours: 24 })
});
```

## Models

### Consumption Forecasting
- **Algorithm**: Facebook Prophet
- **Training Data**: 7 days of historical measurements
- **Output**: 24-hour ahead forecast with confidence intervals
- **Use Case**: Predict future energy consumption patterns

### Recommendation Engine
- **Load Shifting**: Combines consumption forecast with carbon intensity to find optimal times
- **Peak Avoidance**: Identifies high-cost periods and suggests reductions
- **Confidence Scoring**: Each recommendation includes confidence level (70-95%)

## Development

### Adding New Models

1. Create model class in `app/services/`
2. Add router endpoint in `app/routers/`
3. Update `app/main.py` to include router

### Testing

```bash
# Test forecasting endpoint
curl -X POST http://localhost:8000/api/forecast/consumption \
  -H "Content-Type: application/json" \
  -d '{"site_id":"your-site-id","hours_ahead":24}'

# Test recommendations endpoint
curl -X POST http://localhost:8000/api/recommend/generate \
  -H "Content-Type: application/json" \
  -d '{"site_id":"your-site-id"}'
```

## Future Enhancements

- [ ] Solar generation forecasting (XGBoost)
- [ ] Battery optimization (Reinforcement Learning)
- [ ] LSTM models for complex time series
- [ ] Model versioning and A/B testing
- [ ] Caching layer for faster responses
