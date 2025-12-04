# ML Service Integration - Complete

## Overview

Successfully integrated Machine Learning service with Next.js frontend for generating intelligent energy management recommendations.

## What Was Built

### 1. **ML Service (Python FastAPI)**
Located in `ml-service/` directory

**Components:**
- **Prophet Forecasting Model** - Predicts energy consumption 24 hours ahead
- **Recommendation Engine** - Generates smart load shifting and peak avoidance recommendations
- **Database Integration** - Connects to PostgreSQL to read measurements and save recommendations

**Endpoints:**
- `GET /health` - Health check
- `POST /api/forecast/consumption` - Generate consumption forecast
- `POST /api/recommend/generate` - Generate ML-powered recommendations

**Running:** http://localhost:8000

### 2. **Next.js Integration**
Located in `app/api/ml/generate-recommendations/route.ts`

**Purpose:** Bridge between Next.js frontend and Python ML service

**Features:**
- Calls ML service to generate recommendations
- Validates site ID
- Handles errors gracefully
- Returns success/error messages to UI

### 3. **Overview Page Button**
Located in `components/dashboard-content.tsx`

**Features:**
- "Generate ML Recommendations" button with Sparkles icon
- Only enabled when a specific site is selected
- Shows loading state while generating
- Displays success message with count of generated recommendations
- Automatically refreshes recommendations after generation

## How It Works

1. **User Action**: User selects a site and clicks "Generate ML Recommendations" button
2. **API Call**: Next.js calls `/api/ml/generate-recommendations`
3. **ML Processing**:
   - ML service fetches 7 days of historical measurements
   - Trains Prophet model on consumption data
   - Generates 24-hour forecast
   - Combines with carbon intensity and pricing data
   - Creates actionable recommendations (load shift, peak avoidance)
4. **Save to DB**: Recommendations are automatically saved to `recommendations` table
5. **Display**: Overview page refreshes and shows new ML-powered recommendations

## ML Algorithms

### Consumption Forecasting
- **Algorithm**: Facebook Prophet
- **Training Data**: 7 days of historical measurements (minimum 48 data points)
- **Output**: 24-hour ahead forecast with confidence intervals
- **Use Case**: Predict future energy consumption patterns

### Recommendation Types

#### 1. Load Shift Recommendations
- **Goal**: Shift loads to low carbon/cost periods
- **Inputs**: Consumption forecast + carbon intensity forecast
- **Logic**: Finds time windows with lowest combined score (30% consumption, 70% carbon weight)
- **Output**: Specific time window to shift loads with expected savings

#### 2. Peak Avoidance Recommendations
- **Goal**: Reduce consumption during high-rate periods
- **Inputs**: Consumption forecast + electricity pricing
- **Logic**: Identifies 75th percentile consumption periods as peaks
- **Output**: Peak time windows with reduction suggestions

## Services Running

Make sure both services are running:

```bash
# Next.js (Terminal 1)
cd enalysis-mvp
npm run dev
# Running on http://localhost:3000

# ML Service (Terminal 2)
cd ml-service
venv\Scripts\activate
python -m app.main
# Running on http://localhost:8000
```

## Usage

1. Navigate to http://localhost:3000 (Overview page)
2. Select a specific site from the dropdown (e.g., "TD1")
3. Click "Generate ML Recommendations" button
4. Wait for processing (5-10 seconds)
5. See new recommendations appear in the timeline

## Database Schema

Recommendations are saved to:
```sql
enalysis_mvp.recommendations (
  id UUID,
  site_id UUID,
  type VARCHAR, -- 'cost' or 'carbon'
  headline VARCHAR,
  description TEXT,
  cost_savings NUMERIC,
  co2_reduction NUMERIC,
  confidence INTEGER, -- 70-95
  action_type VARCHAR, -- 'load_shift' or 'demand_response'
  recommended_time_start TIMESTAMP,
  recommended_time_end TIMESTAMP,
  supporting_data JSONB,
  status VARCHAR, -- 'pending', 'acknowledged', 'dismissed'
  generated_at TIMESTAMP
)
```

## Future Enhancements

From ML Implementation Plan:

- [ ] Solar generation forecasting (XGBoost)
- [ ] Battery optimization (Reinforcement Learning)
- [ ] LSTM models for complex time series
- [ ] Model versioning and A/B testing
- [ ] Caching layer for faster responses
- [ ] Real-time updates via WebSockets

## Troubleshooting

### ML Service Not Running
```bash
cd ml-service
venv\Scripts\python.exe -m app.main
```

### Check ML Service Health
```bash
curl http://localhost:8000/health
```

### Check Next.js API
```bash
curl http://localhost:3000/api/sites
```

### View ML Service Logs
Check the terminal where ML service is running for detailed error messages.

## Success Criteria

✅ ML service running on port 8000
✅ Next.js running on port 3000
✅ "Generate ML Recommendations" button visible on Overview
✅ Button calls ML service successfully
✅ Recommendations saved to database
✅ Recommendations display in Overview timeline

## Technical Stack

**ML Service:**
- Python 3.13
- FastAPI 0.121
- Prophet 1.2.1 (time series forecasting)
- XGBoost 3.1.1 (future use)
- Scikit-learn 1.7.2
- Pandas 2.3.3
- Psycopg2 (PostgreSQL)

**Frontend:**
- Next.js 16.0.0
- TypeScript
- React Server Components
- Tailwind CSS

**Database:**
- PostgreSQL 14+
- Schema: enalysis_mvp

---

**Status**: ✅ Complete and Ready for Use

Once you have measurement data in the database, the ML service will generate intelligent, data-driven recommendations based on actual consumption patterns, carbon intensity, and electricity pricing.
