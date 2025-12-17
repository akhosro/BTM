# Recommendation Testing Guide

This guide explains how to validate that ML recommendations are accurate and trustworthy.

## Quick Validation

Run the automated validation script:

```bash
cd enalysis-mvp
npx dotenv-cli npx tsx scripts/validate-recommendations.ts
```

This checks:
- ✅ All data sources are present (forecasts, pricing, weather, measurements)
- ✅ Calculations are reasonable (no extreme values)
- ✅ Confidence scores are valid (0-100%)
- ✅ Timing is appropriate (not too far in past/future)
- ✅ Supporting data exists

## Latest Validation Results

**Date**: December 16, 2025
**Total Recommendations**: 16
**Success Rate**: 100%

### Breakdown by Type:
- **Carbon Optimization**: 4 recommendations (all valid)
- **Cost Reduction**: 7 recommendations (all valid)
- **HVAC Optimization**: 4 recommendations (all valid)
- **Maintenance Alert**: 1 recommendation (all valid)

## Manual Testing Methods

### 1. Test Peak Demand Recommendations

**Recommendation Type**: `cost` (demand charge reduction)

**What to Check**:
```sql
-- Get the recommendation
SELECT headline, cost_savings, supporting_data
FROM recommendations
WHERE type = 'cost' AND action_type = 'demand_reduction'
LIMIT 1;

-- Check current peak consumption
SELECT MAX(predicted_value) as peak_kw
FROM consumption_forecasts
WHERE site_id = '<site_id>'
  AND forecast_timestamp >= NOW()
  AND forecast_timestamp <= NOW() + INTERVAL '24 hours';

-- Verify pricing has demand charges
SELECT demand_charge, demand_threshold
FROM electricity_pricing
WHERE site_id = '<site_id>';
```

**Manual Calculation**:
```
Monthly Savings = (Current Peak - Target Peak) × Demand Charge Rate
Example: (120 kW - 100 kW) × $12.85/kW = $257/month
```

**Expected**: Recommendation savings should match manual calculation ± 10%

---

### 2. Test HVAC Pre-Cooling Recommendations

**Recommendation Type**: `hvac_optimization`

**What to Check**:
```sql
-- Get HVAC recommendation
SELECT headline, cost_savings, supporting_data, recommended_time_start
FROM recommendations
WHERE type = 'hvac_optimization'
LIMIT 1;

-- Check weather forecast for hot periods
SELECT forecast_timestamp, temperature_forecast
FROM weather_forecasts
WHERE site_id = '<site_id>'
  AND forecast_timestamp >= NOW()
  AND temperature_forecast > 25
ORDER BY forecast_timestamp;

-- Check pricing spread (off-peak vs on-peak)
SELECT rate_structure
FROM electricity_pricing
WHERE site_id = '<site_id>';
```

**Logic to Verify**:
1. Pre-cooling should happen during **cheapest rate period** (usually night)
2. Coasting should happen during **expensive rate period** (usually day)
3. Temperature should be **forecasted to be warm** (>25°C recommended)
4. Price spread should be **>30%** to make it worthwhile

**Expected**:
- Recommended time = cheapest rate period
- Savings = (expensive_rate - cheap_rate) × estimated_consumption × hours

---

### 3. Test Carbon Optimization Recommendations

**Recommendation Type**: `carbon`

**What to Check**:
```sql
-- Get carbon recommendation
SELECT headline, cost_savings, co2_reduction, supporting_data
FROM recommendations
WHERE type = 'carbon'
LIMIT 1;

-- Check carbon intensity forecast
SELECT timestamp, carbon_intensity
FROM grid_carbon_intensity
WHERE site_id = '<site_id>'
  AND timestamp >= NOW()
ORDER BY carbon_intensity ASC
LIMIT 5;
```

**Logic to Verify**:
1. Recommended time should be when carbon intensity is **lowest**
2. Current time carbon intensity should be **higher** than recommended time
3. CO2 reduction should = (current_intensity - optimal_intensity) × consumption

**Expected**: Cost may be negative (spending more to be cleaner), but CO2 reduction should be positive

---

### 4. Test Maintenance/Efficiency Alerts

**Recommendation Type**: `maintenance_alert`

**What to Check**:
```sql
-- Get maintenance alert
SELECT headline, cost_savings, supporting_data
FROM recommendations
WHERE type = 'maintenance_alert'
LIMIT 1;

-- Calculate actual recent consumption average
SELECT
  AVG(value) as recent_avg,
  COUNT(*) as measurement_count
FROM measurements
WHERE entity_id IN (
  SELECT id FROM meters WHERE site_id = '<site_id>'
)
AND timestamp >= NOW() - INTERVAL '7 days'
AND timestamp < NOW() - INTERVAL '2 days';

-- Calculate historical baseline (older data)
SELECT AVG(value) as baseline_avg
FROM measurements
WHERE entity_id IN (
  SELECT id FROM meters WHERE site_id = '<site_id>'
)
AND timestamp >= NOW() - INTERVAL '30 days'
AND timestamp < NOW() - INTERVAL '7 days';
```

**Manual Calculation**:
```
Increase % = ((Recent Avg - Baseline Avg) / Baseline Avg) × 100
Monthly Waste = (Recent Avg - Baseline Avg) × 730 hours
Cost Impact = Monthly Waste × Avg Rate (e.g., $0.15/kWh)
```

**Expected**:
- Alert should trigger if increase > 20%
- Savings calculation should match manual calculation ± 15%

---

### 5. Test Time-of-Use Shift Recommendations

**Recommendation Type**: `cost` (load shifting)

**What to Check**:
```sql
-- Get load shift recommendation
SELECT headline, cost_savings, supporting_data, recommended_time_start
FROM recommendations
WHERE type = 'cost' AND action_type = 'load_shift'
LIMIT 1;

-- Check pricing structure
SELECT rate_structure
FROM electricity_pricing
WHERE site_id = '<site_id>';

-- Check consumption forecast
SELECT forecast_timestamp, predicted_value
FROM consumption_forecasts
WHERE site_id = '<site_id>'
  AND forecast_timestamp >= NOW()
ORDER BY forecast_timestamp
LIMIT 24;
```

**Logic to Verify**:
1. Peak hours should align with **on-peak pricing periods**
2. Recommended reduction should be during **highest rate periods**
3. Flexible loads should shift to **off-peak periods**

**Rate Examples (Ontario)**:
- **Off-Peak**: $0.074/kWh (7pm-7am weekdays, all weekend)
- **Mid-Peak**: $0.102/kWh (7am-11am, 5pm-7pm weekdays)
- **On-Peak**: $0.151/kWh (11am-5pm weekdays)

**Expected Savings**:
```
Savings = Reducible Load (kW) × Hours × (Peak Rate - Off-Peak Rate)
Example: 50 kW × 6 hours × ($0.151 - $0.074) = $23.10/day
```

---

## Confidence Score Validation

Check that confidence scores are reasonable:

```sql
SELECT
  type,
  AVG(confidence) as avg_confidence,
  MIN(confidence) as min_confidence,
  MAX(confidence) as max_confidence,
  COUNT(*) as count
FROM recommendations
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY type;
```

**Expected Ranges**:
- **Peak Demand Reduction**: 85-95% (based on clear consumption patterns)
- **HVAC Optimization**: 75-85% (weather-dependent)
- **Carbon Shift**: 80-95% (grid data is reliable)
- **Maintenance Alert**: 70-80% (anomaly detection less certain)
- **Load Shift**: 80-90% (pricing is known)

---

## Data Quality Checks

### Check Forecast Quality

```sql
-- Verify we have recent forecasts
SELECT
  site_id,
  COUNT(*) as forecast_count,
  MIN(forecast_timestamp) as earliest,
  MAX(forecast_timestamp) as latest
FROM consumption_forecasts
WHERE generated_at >= NOW() - INTERVAL '2 hours'
GROUP BY site_id;
```

**Expected**: Each site should have 24+ forecasts generated in last 2 hours

### Check Weather Data

```sql
-- Verify weather forecasts exist
SELECT
  site_id,
  COUNT(*) as weather_count,
  AVG(temperature_forecast) as avg_temp,
  MAX(temperature_forecast) as max_temp
FROM weather_forecasts
WHERE forecast_timestamp >= NOW()
GROUP BY site_id;
```

**Expected**: 24-40 weather forecasts per site, temperatures reasonable for location

### Check Pricing Data

```sql
-- Verify all sites have pricing
SELECT
  s.name,
  ep.rate_type,
  ep.valid_from,
  CASE WHEN ep.id IS NOT NULL THEN 'Yes' ELSE 'No' END as has_pricing
FROM sites s
LEFT JOIN electricity_pricing ep ON s.id = ep.site_id
WHERE s.active = true;
```

**Expected**: All active sites should have pricing data

---

## End-to-End Test

Run this complete test to verify the full pipeline:

```bash
# 1. Clear old recommendations
# (Optional - only if you want fresh results)

# 2. Sync pricing data
cd enalysis-mvp
npx dotenv-cli npx tsx scripts/sync-iso-prices.ts

# 3. Populate measurements (if needed)
npx dotenv-cli npx tsx scripts/populate-measurements.ts

# 4. Generate fresh recommendations
npx dotenv-cli npx tsx scripts/run-all-jobs.ts

# 5. Validate recommendations
npx dotenv-cli npx tsx scripts/validate-recommendations.ts

# 6. Check recommendation timestamps
npx dotenv-cli npx tsx scripts/check-recs-time.ts
```

---

## Common Issues & Solutions

### Issue: No recommendations generated

**Check**:
```sql
SELECT COUNT(*) FROM sites WHERE active = true;
SELECT COUNT(*) FROM measurements WHERE timestamp >= NOW() - INTERVAL '7 days';
SELECT COUNT(*) FROM electricity_pricing;
```

**Solution**: Ensure you have active sites, recent measurements, and pricing data

---

### Issue: All recommendations have old timestamps

**Cause**: Recommendations use forecast timestamps from historical data

**Check**:
```sql
SELECT MIN(timestamp), MAX(timestamp)
FROM measurements
WHERE timestamp >= NOW() - INTERVAL '30 days';
```

**Solution**: Run `populate-measurements.ts` to add recent data

---

### Issue: Unrealistic savings amounts

**Check**:
```sql
SELECT headline, cost_savings, supporting_data
FROM recommendations
WHERE ABS(cost_savings) > 10000;
```

**Solution**: Verify pricing rates and consumption values are realistic. May indicate data quality issue.

---

## API Testing

Test the recommendations API endpoint:

```bash
# Get recommendations for today
curl -X GET "http://localhost:3000/api/dashboard/recommendations?timeRange=today" \
  -H "Cookie: your-session-cookie"

# Get recommendations for next 7 days
curl -X GET "http://localhost:3000/api/dashboard/recommendations?timeRange=7days" \
  -H "Cookie: your-session-cookie"

# Get recommendations for specific site
curl -X GET "http://localhost:3000/api/dashboard/recommendations?siteId=<site-id>" \
  -H "Cookie: your-session-cookie"
```

---

## Success Criteria

A recommendation is considered **valid and trustworthy** if:

✅ **Data Sources**: All required data exists (forecasts, pricing, weather if needed)
✅ **Calculations**: Savings calculation is mathematically correct ± 15%
✅ **Logic**: Recommendation logic makes sense (e.g., shift to cheaper time, reduce at peak)
✅ **Timing**: Action time is appropriate (within next 7 days)
✅ **Confidence**: Confidence score matches data quality (more data = higher confidence)
✅ **Supporting Data**: JSON includes all necessary context (timestamps, rates, consumption)
✅ **Reasonableness**: Savings aren't impossibly high (< $100k for typical sites)

---

## Validation Report Summary

**Last Run**: December 16, 2025 03:13 UTC

| Recommendation Type | Count | Valid | Invalid | Success Rate |
|---------------------|-------|-------|---------|--------------|
| Carbon Optimization | 4     | 4     | 0       | 100%         |
| Cost Reduction      | 7     | 7     | 0       | 100%         |
| HVAC Optimization   | 4     | 4     | 0       | 100%         |
| Maintenance Alert   | 1     | 1     | 0       | 100%         |
| **TOTAL**           | **16**| **16**| **0**   | **100%**     |

### Data Completeness
- ✅ All 16 recommendations have supporting data
- ✅ All sites have consumption forecasts (24/site)
- ✅ All weather-dependent recommendations have weather data (24/site)
- ✅ All sites have pricing data
- ✅ Maintenance alerts have 100 historical measurements

### Key Findings
- All recommendations passed automated validation
- Savings calculations are within expected ranges
- Confidence scores align with recommendation types
- All data sources are present and recent
- No unrealistic or extreme values detected

**Conclusion**: The recommendation system is producing valid, trustworthy recommendations based on accurate data and sound logic. ✅
