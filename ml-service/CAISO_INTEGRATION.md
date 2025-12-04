# CAISO Real-Time Pricing Integration

## Overview
The ML service now integrates real-time electricity pricing from CAISO (California Independent System Operator) for sites located in California. This provides dynamic, market-based pricing that reflects actual grid conditions, improving recommendation accuracy.

## What Was Implemented

### 1. CAISO API Client (`app/services/caiso_client.py`)
A complete Python client for the CAISO OASIS API that:
- Fetches real-time market (RTM) pricing with 5-minute intervals
- Supports day-ahead market (DAM) pricing forecasts
- Provides hourly averages from 5-minute data
- Includes realistic fallback pricing when API is unavailable
- Converts $/MWh to $/kWh automatically
- No authentication required (public API)

**Node ID**: `TH_NP15_GEN-APND` (Northern California / SF Bay Area Trading Hub)

### 2. Automatic Detection (`app/routers/recommendations.py`)
The recommendation endpoint now:
- Detects California sites based on location field
- Automatically fetches CAISO pricing for CA sites
- Passes real-time pricing to recommendation engine
- Falls back gracefully if CAISO fetch fails

**Location Detection Keywords**:
`california`, `ca`, `san francisco`, `los angeles`, `san diego`, `sacramento`

### 3. Recommendation Engine Updates (`app/services/recommendation_engine.py`)
Updated all pricing calculation methods to:
- Accept optional `caiso_pricing` parameter
- **Prioritize real-time CAISO pricing** when available
- Fall back to TOU (Time-of-Use) rates if CAISO unavailable
- Match timestamps within same hour for pricing lookup

**Methods Updated**:
- `calculate_electricity_cost()` - Cost calculations now use real-time LMP
- `get_rate_at_time()` - Rate lookups prefer CAISO data
- `generate_load_shift_recommendation()` - Uses dynamic pricing
- `generate_peak_avoidance_recommendation()` - Uses dynamic pricing
- `generate_recommendations()` - Accepts and passes CAISO pricing

## How It Works

### Data Flow
```
1. User triggers recommendation generation for SF site
2. Router detects "San Francisco" in site.location
3. CAISO client fetches last 48 hours of real-time pricing
4. CAISO client aggregates 5-min intervals → hourly averages
5. Recommendation engine receives both TOU rates + CAISO pricing
6. Engine prefers CAISO pricing for cost calculations
7. Generates recommendations with accurate market-based costs
```

### Pricing Priority
1. **First choice**: CAISO real-time LMP (if available and timestamp matches)
2. **Fallback**: TOU rate structure from database
3. **Final fallback**: $0.12/kWh default rate

### Example CAISO Pricing Pattern
```
Off-peak night (12am-6am):    $30/MWh  → $0.030/kWh
Morning ramp (6am-9am):        $55/MWh  → $0.055/kWh
Mid-day solar (9am-4pm):       $45/MWh  → $0.045/kWh
Peak evening (4pm-9pm):       $110/MWh  → $0.110/kWh
Late evening (9pm-12am):       $50/MWh  → $0.050/kWh
```

## API Details

### CAISO OASIS API
- **Base URL**: `http://oasis.caiso.com/oasisapi/SingleZip`
- **Query Type**: `PRC_LMP` (Locational Marginal Pricing)
- **Market**: `RTM` (Real-Time Market) or `DAM` (Day-Ahead Market)
- **Format**: XML (ZIP compressed)
- **Authentication**: None required (public data)
- **Documentation**: http://www.caiso.com/oasisapi/

### Trading Hub Zones
- **NP15** (`TH_NP15_GEN-APND`): Northern California (SF Bay Area)
- **SP15** (`TH_SP15_GEN-APND`): Southern California (LA, San Diego)
- **ZP26** (`TH_ZP26_GEN-APND`): Central California

## Testing

### Test CAISO Integration
```powershell
# Start ML service
cd C:\Users\tinas\Multisite\enalysis-mvp\ml-service
.\venv\Scripts\python.exe -m app.main

# Generate recommendations for SF site
Invoke-RestMethod -Uri "http://localhost:8000/api/recommend/generate" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"site_id": "12c2cfbc-ef9c-47cb-aee9-4324700900e5", "forecast_hours": 24, "training_days": 7}'
```

### Expected Output
```
Fetching CAISO real-time pricing for node TH_NP15_GEN-APND...
✅ Fetched 288 CAISO pricing records  # 48 hours × 12 five-min intervals/hour
✅ Fetched 48 CAISO real-time pricing records  # Aggregated to hourly
```

### Verify CAISO Usage
Check recommendation logs for:
- "Using CAISO pricing" vs "Using TOU rates"
- Cost savings should reflect real-time market conditions
- Peak period recommendations should align with actual grid stress

## Benefits

### More Accurate Recommendations
- **Dynamic pricing**: Reflects actual market conditions, not static schedules
- **Grid conditions**: Prices spike during grid stress, enabling better DR
- **Time precision**: Hourly granularity vs TOU's 3-4 period blocks

### Better User Value
- **Real savings**: Recommendations based on actual market prices
- **Grid participation**: Users respond to real-time grid needs
- **Arbitrage opportunities**: Identify price spreads for battery optimization

## Future Enhancements

### Optional Improvements
1. **Caching**: Cache CAISO pricing in database to reduce API calls
2. **Background job**: Fetch CAISO pricing every hour automatically
3. **Day-ahead forecasts**: Use DAM pricing for longer-term planning
4. **Other ISOs**: Add support for ERCOT, PJM, NYISO, etc.
5. **Price forecasting**: ML model to predict future CAISO prices

### Database Table (Optional)
```sql
CREATE TABLE iso_market_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_name TEXT NOT NULL,  -- 'CAISO', 'ERCOT', etc.
  node_id TEXT NOT NULL,   -- Trading hub/node identifier
  timestamp TIMESTAMPTZ NOT NULL,
  lmp NUMERIC NOT NULL,    -- Locational Marginal Price ($/MWh)
  lmp_kwh NUMERIC NOT NULL, -- Converted to $/kWh
  market_type TEXT,        -- 'RTM', 'DAM', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Files Modified

1. **Created**: `ml-service/app/services/caiso_client.py` (246 lines)
2. **Modified**: `ml-service/app/routers/recommendations.py` (lines 148-170)
3. **Modified**: `ml-service/app/services/recommendation_engine.py` (6 methods)

## No Configuration Required

The CAISO integration works out of the box:
- ✅ No API keys needed (public data)
- ✅ No environment variables required
- ✅ Automatic detection of California sites
- ✅ Graceful fallback to TOU rates

## Summary

California sites now receive recommendations based on **real-time market pricing** from CAISO, providing more accurate cost savings estimates and enabling better grid participation. The system automatically detects CA locations and falls back to TOU rates for non-CA sites or if CAISO data is unavailable.
