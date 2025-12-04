# Next Steps to Complete App Setup

## ✅ What's Been Fixed

1. **Duplicate sites cleaned up** - Only 1 site remains for demo user
2. **ML service carbon intensity fixed** - Changed from 400 g/kWh (US) to 40 g/kWh (Ontario)
3. **CO2 calculations updated** - Using Ontario's clean grid values (30-70 g/kWh)
4. **Electricity pricing verified** - PG&E TOU rates exist in database
5. **Old recommendations deleted** - Ready for fresh generation

## 🔧 What You Need to Do Now

### Step 1: Restart the ML Service

The ML service code has been updated with the carbon intensity fixes. You need to restart it to load the new code.

**In PowerShell:**

```powershell
# Navigate to project root
cd C:\Users\tinas\Multisite\enalysis-mvp

# Navigate to ML service directory
cd ml-service

# Start the ML service with the virtual environment
& "..\venv\Scripts\python.exe" -m app.main
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

Leave this terminal running.

### Step 2: Generate New Recommendations

**In a NEW PowerShell terminal:**

```powershell
# Navigate to project root
cd C:\Users\tinas\Multisite\enalysis-mvp

# Generate recommendations for the demo site
Invoke-RestMethod -Uri "http://localhost:8000/api/recommend/generate" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"site_id": "380974d5-8040-43a6-9c00-fac5e57f55f4", "forecast_hours": 24, "training_days": 7}'
```

Expected output:
```json
{
  "recommendations": [
    {
      "type": "carbon",
      "headline": "Shift flexible loads to XX:XX for lowest carbon",
      "cost_savings": X.XX,
      "co2_reduction": X.XX,
      "confidence": XX
    },
    ...
  ],
  "recommendations_saved": 2,
  "forecasts_saved": 24,
  "weather_forecasts_saved": 40
}
```

### Step 3: Refresh Dashboard

Open your browser and go to:
```
http://localhost:3000
```

You should now see:
- ✅ Recommendations displaying with proper headlines
- ✅ Carbon intensity using Ontario values (30-70 g/kWh)
- ✅ Cost savings calculated from TOU rate differences
- ✅ All dashboard metrics populated

---

## 📊 Expected Results After These Steps

### Dashboard Metrics:
- **Energy Spend Forecast**: ~$1,948 (calculated from measurements)
- **CO₂ Intensity Forecast**: 30-70 g/kWh (Ontario average)
- **Optimization Opportunity**: Based on production/consumption ratio
- **Potential Savings**: Sum of recommendation cost savings

### Recommendations:
You should see 2-3 recommendations:
1. **Carbon optimization** - Shift loads to low-carbon hours (using Ontario 30-70 g/kWh data)
2. **Cost optimization** - Reduce consumption during peak TOU hours ($0.151/kWh → $0.082/kWh)

---

## 🚀 Additional Setup for Full Functionality

### Priority Tasks (After Basic Demo Works):

#### 1. Enable Background Data Sync
```powershell
# Add to .env.local
ENABLE_SCHEDULER=true
```

This will enable:
- Automatic carbon intensity updates
- Weather forecast sync
- ISO price updates

#### 2. Add External API Keys (Optional but Recommended)

**For real-time carbon data:**
```
ELECTRICITYMAPS_API_KEY=your_key_here
```
Sign up: https://www.electricitymaps.com/free-tier-api (50 requests/hour free)

**For weather data:**
```
OPENWEATHER_API_KEY=your_key_here
```
Sign up: https://openweathermap.org/api (1000 calls/day free)

#### 3. OAuth Integrations (For Real Device Data)

**Enphase Solar:**
```
ENPHASE_CLIENT_ID=your_client_id
ENPHASE_CLIENT_SECRET=your_secret
```

**Tesla Powerwall:**
```
TESLA_CLIENT_ID=your_client_id
TESLA_CLIENT_SECRET=your_secret
```

**UtilityAPI (Bill Data):**
```
UTILITYAPI_TOKEN=your_token
```

---

## 🐛 Troubleshooting

### ML Service Won't Start
```powershell
# Verify Python environment
& "..\venv\Scripts\python.exe" --version

# Should show Python 3.11.x or 3.12.x
```

### Recommendations Not Showing
1. Check ML service is running: `curl http://localhost:8000/health`
2. Check recommendations in database:
   ```powershell
   cd enalysis-mvp
   npm run db:studio
   # Open http://localhost:4983
   # Check 'recommendations' table
   ```

### Dashboard Shows Zeros
1. Verify measurements exist in last 24 hours
2. Check site location is "Toronto, Ontario"
3. Verify carbon intensity data exists for Ontario region

---

## 📁 Quick Reference - Important Files

**Fixed Files:**
- `ml-service/app/services/recommendation_engine.py` - Carbon intensity: 400→40 g/kWh
- `ml-service/app/services/carbon_intensity_client.py` - Ontario fallback data (30-70)

**Configuration:**
- `.env.local` - Environment variables
- `db/schema.ts` - Database schema

**Scripts Created:**
- `scripts/clean-duplicate-sites.ts` - Remove duplicate sites
- `scripts/check-and-fix-pricing.ts` - Verify TOU rates
- `scripts/fix-recommendation-site.ts` - Reassign recommendations to correct site

---

## ✅ Checklist

- [x] Duplicate sites cleaned
- [x] ML service code updated (carbon intensity)
- [x] Old recommendations deleted
- [x] Pricing data verified
- [ ] **ML service restarted** ← YOU ARE HERE
- [ ] **Recommendations regenerated**
- [ ] **Dashboard verified**
- [ ] Background scheduler enabled (optional)
- [ ] External API keys added (optional)

---

**Ready to proceed?** Follow Steps 1-3 above to complete the setup!
