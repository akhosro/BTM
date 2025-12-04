# ISO Market Integration Guide

## Overview

Enalysis integrates with multiple Independent System Operators (ISOs) to fetch wholesale electricity market prices for energy optimization and cost savings analysis.

## Supported ISOs

### 1. IESO (Independent Electricity System Operator)
- **Region**: Ontario, Canada
- **Currency**: CAD
- **Data Source**: Public XML Reports
- **API**: https://reports-public.ieso.ca/public/

**Price Types**:
- Day-Ahead Forecasts: 24-hour hourly forecasts
- Real-Time Actuals: 5-minute settlement prices (aggregated to hourly)

**Update Schedule**:
- Forecasts: Daily at 6 AM EST (after IESO publishes day-ahead prices)
- Actuals: Hourly (with 2-hour delay for publication)

### 2. CAISO (California Independent System Operator)
- **Region**: California, USA
- **Currency**: USD
- **Data Source**: OASIS API
- **API**: http://oasis.caiso.com/oasisapi/

**Price Types**:
- Day-Ahead Market (DAM): Hourly forecasts
- Real-Time Market (RTM): 5-minute LMPs (aggregated to hourly)

**Trading Hub**: TH_NP15_GEN-APND (NP15 aggregate pricing node)

**Update Schedule**:
- Forecasts: Daily at 6 AM PST
- Actuals: Hourly (with 2-hour delay)

## Database Schema

All ISO price data is stored in a single unified table: `iso_market_prices`

```sql
CREATE TABLE iso_market_prices (
  id UUID PRIMARY KEY,
  iso TEXT NOT NULL,              -- "IESO" | "CAISO" | "ERCOT" | etc.
  region TEXT,                    -- "Ontario" | "California" | etc.
  price_type TEXT NOT NULL,       -- "forecast" | "actual"
  market_type TEXT DEFAULT 'energy',
  timestamp TIMESTAMP NOT NULL,
  price DOUBLE PRECISION NOT NULL, -- $/MWh
  currency TEXT NOT NULL,          -- "CAD" | "USD"
  forecasted_at TIMESTAMP,         -- When forecast was made
  forecast_horizon_hours NUMERIC,  -- Hours ahead
  data_source TEXT NOT NULL,       -- "IESO_API" | "CAISO_OASIS"
  metadata JSONB DEFAULT '{}',     -- ISO-specific fields
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- `idx_iso_prices_iso_time_type` ON (iso, timestamp, price_type)
- `idx_iso_prices_forecasted_at` ON (forecasted_at)
- `idx_iso_prices_timestamp` ON (timestamp)
- `idx_iso_prices_unique` UNIQUE ON (iso, timestamp, price_type, forecasted_at)

## API Endpoints

### 1. Manual Sync (Development/Testing)

**Endpoint**: `POST /api/iso-prices/sync`

Manually trigger a price sync for any ISO.

**Request**:
```json
{
  "priceType": "both",           // "forecast" | "actual" | "both"
  "iso": "IESO",                 // "IESO" | "CAISO" | "both"
  "startDate": "2025-08-06",     // Optional for actuals
  "endDate": "2025-08-07"        // Optional for actuals
}
```

**Response**:
```json
{
  "success": true,
  "message": "ISO prices synced successfully",
  "results": {
    "forecast": { "fetched": 24, "stored": 24, "skipped": 0 },
    "actual": { "fetched": 48, "stored": 48, "skipped": 0 }
  }
}
```

### 2. Scheduled Sync (Production)

**Endpoint**: `POST /api/scheduled/iso-sync`

**Authentication**: Requires `X-Cron-Secret` header

**Request**:
```json
{
  "type": "both",    // "forecast" | "actual" | "both"
  "iso": "both"      // "IESO" | "CAISO" | "both"
}
```

**Headers**:
```
X-Cron-Secret: <your-secret-key>
```

**Response**:
```json
{
  "success": true,
  "message": "Scheduled sync completed",
  "timestamp": "2025-08-20T10:00:00Z",
  "results": {
    "IESO": {
      "forecast": { "fetched": 24, "stored": 24, "skipped": 0, "errors": [] },
      "actual": { "fetched": 3, "stored": 3, "skipped": 0, "errors": [] }
    },
    "CAISO": {
      "forecast": { "fetched": 24, "stored": 24, "skipped": 0, "errors": [] },
      "actual": { "fetched": 3, "stored": 3, "skipped": 0, "errors": [] }
    }
  }
}
```

### 3. Query Prices

**Endpoint**: `GET /api/iso-prices/query`

Query stored price data with filters.

**Query Parameters**:
- `iso` - Filter by ISO (e.g., "IESO", "CAISO")
- `priceType` - Filter by type (e.g., "forecast", "actual")
- `startDate` - Start of date range (ISO 8601)
- `endDate` - End of date range (ISO 8601)

**Example**:
```
GET /api/iso-prices/query?iso=IESO&priceType=forecast&startDate=2025-08-20&endDate=2025-08-21
```

**Response**:
```json
{
  "success": true,
  "prices": [
    {
      "id": "uuid",
      "iso": "IESO",
      "region": "Ontario",
      "priceType": "forecast",
      "timestamp": "2025-08-20T00:00:00Z",
      "price": 25.50,
      "currency": "CAD",
      "forecastedAt": "2025-08-19T06:00:00Z",
      "forecastHorizonHours": 18,
      "dataSource": "IESO_API"
    }
  ],
  "count": 24
}
```

## ML Forecast Improvement

### Training the Model

**Endpoint**: `POST /api/ml/forecast-model`

Train the ML model using historical data to improve forecast accuracy.

**Request**:
```json
{
  "iso": "IESO",
  "trainStartDate": "2025-01-01",
  "trainEndDate": "2025-08-01",
  "testStartDate": "2025-08-01",
  "testEndDate": "2025-08-15"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Model trained successfully",
  "model": {
    "version": "1.0.0",
    "trainedAt": "2025-08-20T10:00:00Z",
    "dataPoints": 5000,
    "stats": {
      "meanAbsoluteError": 3.25,
      "meanAbsolutePercentageError": 12.5,
      "rootMeanSquareError": 4.75,
      "biasCorrection": -1.2
    }
  },
  "evaluation": {
    "originalPerformance": {
      "mae": 5.0,
      "mape": 18.0,
      "rmse": 6.5
    },
    "improvedPerformance": {
      "mae": 3.25,
      "mape": 12.5,
      "rmse": 4.75
    },
    "improvement": {
      "maeReduction": 35.0,
      "mapeReduction": 30.5,
      "rmseReduction": 26.9
    }
  }
}
```

### Getting Improved Forecasts

**Endpoint**: `GET /api/ml/forecast-model`

Get improved forecasts using the trained model.

**Query Parameters**:
- `iso` - ISO to get forecasts for
- `startDate` - Start date
- `endDate` - End date

**Example**:
```
GET /api/ml/forecast-model?iso=IESO&startDate=2025-08-20&endDate=2025-08-21
```

**Response**:
```json
{
  "success": true,
  "model": {
    "version": "1.0.0",
    "trainedAt": "2025-08-20T10:00:00Z",
    "dataPoints": 5000
  },
  "forecasts": [
    {
      "timestamp": "2025-08-20T00:00:00Z",
      "originalForecast": 25.50,
      "improvedForecast": 24.30,
      "correction": 1.20
    }
  ],
  "count": 24
}
```

## Cron Job Setup

### Vercel Cron Jobs

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/scheduled/iso-sync",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/scheduled/iso-sync",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Environment Variables

Set in `.env.local`:

```
CRON_SECRET=your-secure-secret-key
```

### Manual Cron Service

Use services like cron-job.org or EasyCron:

**Daily Forecast Sync (6 AM EST)**:
```
URL: https://your-domain.com/api/scheduled/iso-sync
Method: POST
Headers: X-Cron-Secret: your-secret-key
Body: {"type": "forecast", "iso": "both"}
Schedule: 0 6 * * *
```

**Hourly Actual Sync**:
```
URL: https://your-domain.com/api/scheduled/iso-sync
Method: POST
Headers: X-Cron-Secret: your-secret-key
Body: {"type": "actual", "iso": "both"}
Schedule: 0 * * * *
```

## Adding New ISOs

To add support for a new ISO:

### 1. Create API Service

Create `lib/services/{iso-name}-api.ts`:

```typescript
interface ISOPriceData {
  timestamp: Date;
  price: number;
  priceType: "forecast" | "actual";
  forecastedAt?: Date;
  forecastHorizonHours?: number;
}

export async function fetchForecastPrices(
  targetDate?: Date
): Promise<ISOPriceData[]> {
  // Implement ISO-specific API call
}

export async function fetchActualPrices(
  startDate: Date,
  endDate: Date
): Promise<ISOPriceData[]> {
  // Implement ISO-specific API call
}
```

### 2. Update Scheduled Sync

Add new ISO to `app/api/scheduled/iso-sync/route.ts`:

```typescript
import { fetchNewISOForecastPrices, fetchNewISOActualPrices } from "@/lib/services/newiso-api";

// Add to forecast sync section
if (iso === "NEWISO" || iso === "both") {
  const forecastPrices = await fetchNewISOForecastPrices();
  // Store with appropriate metadata
}

// Add to actual sync section
if (iso === "NEWISO" || iso === "both") {
  const actualPrices = await fetchNewISOActualPrices(startDate, endDate);
  // Store with appropriate metadata
}
```

### 3. Update ML Model

The ML model (`lib/services/ml-forecast-model.ts`) is ISO-agnostic and works with any ISO by filtering on the `iso` field.

### 4. Test Integration

```bash
# Test forecast sync
curl -X POST http://localhost:3000/api/iso-prices/sync \
  -H "Content-Type: application/json" \
  -d '{"priceType":"forecast","iso":"NEWISO"}'

# Test actual sync
curl -X POST http://localhost:3000/api/iso-prices/sync \
  -H "Content-Type: application/json" \
  -d '{"priceType":"actual","iso":"NEWISO","startDate":"2025-08-20","endDate":"2025-08-21"}'
```

## Troubleshooting

### No Data Fetched

1. Check ISO API availability
2. Verify date formats match ISO requirements
3. Check timezone handling (EST/EDT for IESO, PST/PDT for CAISO)
4. Review API rate limits

### Duplicate Data

The unique constraint on `(iso, timestamp, price_type, forecasted_at)` prevents duplicates. If duplicates are detected, sync will skip them.

### Missing Actual Prices

ISOs publish actual prices with a delay (typically 1-2 hours). Ensure the cron job accounts for this delay by fetching prices from 2-5 hours ago.

### Timezone Issues

- IESO uses EST/EDT timezone
- CAISO uses PST/PDT timezone
- Store all timestamps in UTC in the database
- Convert to local timezone in UI/API responses

## Performance Considerations

### Data Retention

Consider implementing data retention policies:
- Keep last 1 year of hourly data
- Aggregate older data to daily averages
- Archive historical data for ML training

### Caching

Implement caching for frequently accessed data:
- Cache current day forecasts (TTL: 1 hour)
- Cache actual prices (TTL: 24 hours)

### Batch Operations

When syncing large date ranges:
- Process in batches of 100 records
- Use transactions for atomicity
- Implement retry logic for failed inserts

## Security

### API Authentication

- Use `X-Cron-Secret` header for scheduled syncs
- Rotate secrets regularly
- Store secrets in environment variables, never in code

### Rate Limiting

Implement rate limiting on sync endpoints:
- Max 10 requests per hour for manual sync
- Use queues for scheduled jobs

## Monitoring

Track key metrics:
- Sync success/failure rates
- Data freshness (time since last update)
- Forecast accuracy (MAE, MAPE, RMSE)
- API response times
- Error rates by ISO

## Future Enhancements

1. **Additional ISOs**:
   - ERCOT (Texas)
   - PJM (Mid-Atlantic)
   - NYISO (New York)
   - MISO (Midwest)

2. **Advanced ML Features**:
   - LSTM/GRU models for time-series forecasting
   - Weather integration for improved accuracy
   - Demand pattern recognition

3. **Real-Time Updates**:
   - WebSocket connections for live price updates
   - Push notifications for price spikes

4. **Data Quality**:
   - Anomaly detection for outlier prices
   - Data validation and cleansing
   - Gap filling for missing data
