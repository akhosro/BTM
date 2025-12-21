# External API Integrations & Scheduled Jobs - Production Status

## 📊 Summary

| Category | Configured | Enabled | API Keys Needed | Status |
|----------|------------|---------|-----------------|---------|
| **Scheduled Jobs** | ✅ 4 jobs | ⚠️ Auto-enabled in prod | None required | **Working** (with fallbacks) |
| **ISO Market Prices** | ✅ Endpoint ready | ❌ Not scheduled | None (public APIs) | **Manual trigger only** |
| **Carbon Intensity** | ✅ Full integration | ⚠️ Fallback mode | WATTTIME_USERNAME, WATTTIME_PASSWORD | **Working** (estimated data) |
| **Weather** | ✅ Full integration | ❌ Not used by jobs | OPENWEATHERMAP_API_KEY, SOLCAST_API_KEY | **Ready** (not active) |
| **Consumption Forecast** | ✅ ML Service | ✅ Active | None | **Working** |

---

## 🔄 Scheduled Jobs (Currently Running)

### Configured Jobs in [lib/scheduler/index.ts](../lib/scheduler/index.ts):

| # | Job Name | Schedule | Purpose | API Dependencies | Status |
|---|----------|----------|---------|------------------|---------|
| 1 | **Energy Data Sync** | Every 15 min | Sync from Enphase, SolarEdge, Tesla, UtilityAPI | None (uses demo data) | ⚠️ **Runs but no real data** |
| 2 | **Carbon Intensity** | Every hour | Fetch grid carbon forecasts | WattTime API | ⚠️ **Runs with fallback data** |
| 3 | **AI Recommendations** | Every 6 hours | Generate optimization recommendations | ML Service | ✅ **Working** |
| 4 | **Data Cleanup** | Daily 2 AM | Clean expired data | None | ✅ **Working** |

### Activation Status:
- **Development:** ❌ Disabled (unless `ENABLE_SCHEDULER=true`)
- **Production (Vercel):** ✅ **AUTO-ENABLED** (`NODE_ENV=production`)

---

## 🌍 Carbon Intensity Integration

### API: WattTime (Real-time grid carbon intensity)

**Status:** ⚠️ **CONFIGURED BUT USING FALLBACK DATA**

**Implementation:** [lib/external-data/carbon-intensity-api.ts](../lib/external-data/carbon-intensity-api.ts)

#### Current Behavior:
- ✅ Code is production-ready
- ✅ Falls back to estimated carbon patterns if no API key
- ⚠️ Using fallback data (still realistic, just not real-time)

#### Fallback Carbon Intensity Patterns:
```
Off-Peak  (11pm-7am):  ~300 gCO2/kWh (moderate)
Mid-Day   (10am-4pm):  ~200 gCO2/kWh (solar peak - cleanest)
Peak      (6pm-10pm):  ~450 gCO2/kWh (gas plants ramp - dirtiest)
Other hours:           ~300 gCO2/kWh (baseline)
```

#### To Enable Real-Time Data:

**1. Sign up for WattTime:**
- Free Tier: 5,000 API calls/month (more than enough)
- Sign up: https://www.watttime.org/api-documentation/#register-new-user
- Registration endpoint:
  ```bash
  curl -X POST https://api.watttime.org/v3/register \
    -H "Content-Type: application/json" \
    -d '{
      "username": "your-email@enalysis.io",
      "password": "YourSecurePassword123!",
      "email": "your-email@enalysis.io",
      "org": "Enalysis"
    }'
  ```

**2. Add to Vercel:**
```
WATTTIME_USERNAME=your-email@enalysis.io
WATTTIME_PASSWORD=YourSecurePassword123!
```

**3. Supported Regions:**
- ✅ CAISO (California)
- ✅ ERCOT (Texas)
- ✅ PJM (Mid-Atlantic)
- ✅ ISO-NE (New England)
- ✅ NYISO (New York)
- ✅ MISO (Midwest)
- ✅ IESO (Ontario, Canada) - **Your primary market!**

---

## ⚡ ISO Market Prices (IESO & CAISO)

### API: IESO (Independent Electricity System Operator - Ontario)

**Status:** ✅ **READY BUT NOT SCHEDULED**

**Implementation:** [app/api/scheduled/iso-sync/route.ts](../app/api/scheduled/iso-sync/route.ts)

#### Current Situation:
- ✅ Code is production-ready
- ✅ IESO API is **public** (no API key needed!)
- ❌ **NOT scheduled to run automatically**
- ❌ **Needs external cron trigger**

#### What Works:
```bash
# Manual trigger (works right now):
curl -X POST https://enalysis.io/api/scheduled/iso-sync \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: your-secret-key" \
  -d '{"type": "both", "iso": "IESO"}'
```

#### What's Missing:
**You need to set up an external cron job** to call this endpoint on schedule:

**Option 1: Vercel Cron** (RECOMMENDED - Free!)

Create `vercel.json` in project root:
```json
{
  "crons": [
    {
      "path": "/api/scheduled/iso-sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Note: Vercel Cron requires **Pro plan** ($20/month)

**Option 2: GitHub Actions** (FREE!)

Create `.github/workflows/iso-sync.yml`:
```yaml
name: Sync ISO Prices
on:
  schedule:
    - cron: '0 6,18 * * *'  # 6 AM & 6 PM daily
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ISO Sync
        run: |
          curl -X POST https://enalysis.io/api/scheduled/iso-sync \
            -H "Content-Type: application/json" \
            -H "X-Cron-Secret: ${{ secrets.CRON_SECRET }}" \
            -d '{"type": "both", "iso": "both"}'
```

**Option 3: EasyCron** (FREE - 20 jobs)
- Sign up: https://www.easycron.com
- Add cron job: `POST https://enalysis.io/api/scheduled/iso-sync`
- Schedule: `0 */6 * * *` (every 6 hours)
- Header: `X-Cron-Secret: your-secret-key`
- Body: `{"type": "both", "iso": "IESO"}`

#### Recommended Schedule:

| Data Type | Frequency | Reason |
|-----------|-----------|--------|
| **Forecast Prices** | Daily at 6 AM EST | IESO publishes day-ahead prices at ~5 AM |
| **Actual Prices** | Every hour | Real-time prices published with 2-hour delay |

#### Environment Variables Needed:

```bash
CRON_SECRET=your-random-secret-key-here
```

Generate a secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🌤️ Weather API Integration

### API: OpenWeatherMap & SolCast

**Status:** ✅ **READY BUT NOT USED**

**Implementation:** [lib/external-data/weather-api.ts](../lib/external-data/weather-api.ts)

#### Current Situation:
- ✅ Code is production-ready
- ✅ Has mock fallback data
- ❌ Not currently used by any scheduled jobs
- ℹ️ **Will be needed when you add solar forecasting features**

#### When You'll Need This:
1. **Solar PV forecasting** - predict solar generation 24-48 hours ahead
2. **HVAC optimization** - pre-cool buildings before hot days
3. **Demand forecasting** - weather affects consumption patterns

#### APIs Supported:

**OpenWeatherMap** (General weather)
- Free tier: 1,000 calls/day
- Sign up: https://openweathermap.org/api
- Add to Vercel: `OPENWEATHERMAP_API_KEY=your-key`

**SolCast** (Solar-specific forecasting)
- Free tier: 50 calls/day
- Sign up: https://solcast.com/
- Add to Vercel: `SOLCAST_API_KEY=your-key`

#### Example Usage (not currently active):
```typescript
import { getWeatherForecast } from '@/lib/external-data/weather-api';

// Get 48-hour weather forecast for a site
const forecast = await getWeatherForecast(43.6532, -79.3832, 48);
```

---

## 🔮 Consumption Forecast (ML Service)

### ML Service: Railway-hosted Python FastAPI

**Status:** ✅ **WORKING**

**Implementation:** ML service at `https://btm-production-77c3.up.railway.app`

#### Current Situation:
- ✅ ML service is deployed and running
- ✅ Consumption forecasting endpoint working
- ✅ Battery optimization endpoint working
- ✅ Used by AI recommendations job (every 6 hours)

#### What It Does:
1. **Load Forecasting** - Predicts consumption 24 hours ahead
2. **Battery Optimization** - Determines optimal charge/discharge schedule
3. **Peak Demand Prediction** - Identifies future demand spikes

#### No Configuration Needed:
- Environment variable `ML_SERVICE_URL` is already set
- No API keys required (internal service)
- Automatically used by jobs

---

## 📝 Complete Environment Variables Checklist

### Currently Required (Already Set):
```bash
✅ DATABASE_URL=postgresql://...
✅ SESSION_SECRET=...
✅ ML_SERVICE_URL=https://btm-production-77c3.up.railway.app
```

### Optional But Recommended:

#### For Real-Time Carbon Data:
```bash
⚠️ WATTTIME_USERNAME=your-email@enalysis.io
⚠️ WATTTIME_PASSWORD=YourSecurePassword123!
```

#### For ISO Price Scheduling:
```bash
⚠️ CRON_SECRET=your-random-secret-key
```

#### For Weather Forecasting (Future):
```bash
❌ OPENWEATHERMAP_API_KEY=your-key  (not needed yet)
❌ SOLCAST_API_KEY=your-key  (not needed yet)
```

---

## 🎯 Action Items for Production

### Priority 1: Enable Real-Time Carbon Data (30 min)

1. **Register with WattTime:**
   ```bash
   curl -X POST https://api.watttime.org/v3/register \
     -H "Content-Type: application/json" \
     -d '{
       "username": "your-email@enalysis.io",
       "password": "SecurePassword123!",
       "email": "your-email@enalysis.io",
       "org": "Enalysis"
     }'
   ```

2. **Add to Vercel:**
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Add `WATTTIME_USERNAME` and `WATTTIME_PASSWORD`
   - Redeploy

3. **Verify it works:**
   - Check logs for: `✅ Synced carbon intensity forecasts` (not fallback message)

### Priority 2: Schedule ISO Price Syncs (15 min - FREE)

**Option A: GitHub Actions (Recommended - FREE)**

1. Create `.github/workflows/iso-sync.yml` (see above)
2. Add GitHub secret: `CRON_SECRET` (Settings → Secrets → Actions)
3. Generate secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Add same `CRON_SECRET` to Vercel environment variables
5. Commit and push

**Option B: EasyCron (Also FREE)**

1. Sign up at https://www.easycron.com
2. Create cron job:
   - URL: `https://enalysis.io/api/scheduled/iso-sync`
   - Method: POST
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Headers: `X-Cron-Secret: <your-secret>`, `Content-Type: application/json`
   - Body: `{"type": "both", "iso": "IESO"}`

### Priority 3: Weather APIs (Optional - For Later)

Only needed when you add solar forecasting features. Skip for now.

---

## 🧪 How to Test

### Test Carbon Intensity Job Locally:

1. Add to `.env.local`:
   ```
   ENABLE_SCHEDULER=true
   WATTTIME_USERNAME=your-username
   WATTTIME_PASSWORD=your-password
   ```

2. Restart dev server:
   ```bash
   npm run dev
   ```

3. Check logs for:
   ```
   ✅ Scheduler started with 4 jobs
   🔄 [Job] Syncing grid carbon intensity forecasts...
   ✅ [Job] Carbon intensity sync completed
   ```

### Test ISO Price Sync Manually:

```bash
# Generate a secret first
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Test locally
curl -X POST http://localhost:3000/api/scheduled/iso-sync \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: $SECRET" \
  -d '{"type": "forecast", "iso": "IESO"}'

# Test production
curl -X POST https://enalysis.io/api/scheduled/iso-sync \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: $SECRET" \
  -d '{"type": "forecast", "iso": "IESO"}'
```

### Verify Jobs are Running in Production:

Check Vercel deployment logs for these messages:
```
✅ Scheduler started with 4 jobs
✅ [Job] Energy data sync completed
✅ [Job] Carbon intensity sync completed
✅ [Job] AI recommendations generated
✅ [Job] Data cleanup completed
```

---

## 📊 Current vs. Full Functionality

### What's Working NOW (Without Any Changes):

✅ AI consumption forecasting (ML service)
✅ Battery optimization recommendations
✅ Carbon intensity patterns (estimated)
✅ Scheduled jobs (auto-run in production)
✅ Manual ISO price sync (works via API)

### What Needs API Keys:

⚠️ Real-time carbon data (WattTime - free tier available)
⚠️ Weather forecasting (OpenWeatherMap - free tier available)
⚠️ Solar irradiance (SolCast - free tier available)

### What Needs External Cron Setup:

⚠️ Automated ISO price syncs (IESO & CAISO)
   - Option 1: Vercel Cron (requires Pro plan $20/mo)
   - Option 2: GitHub Actions (FREE!)
   - Option 3: EasyCron (FREE!)

---

## 🔍 Monitoring & Troubleshooting

### Check if Jobs are Running:

**Vercel Logs:**
```bash
vercel logs --follow
```

Look for:
- `📅 Starting background job scheduler...`
- `✅ Scheduler started with 4 jobs`
- Job completion messages every 15min, 1hr, 6hrs

### Check Carbon Intensity Data:

```sql
SELECT * FROM grid_carbon_intensity
ORDER BY timestamp DESC
LIMIT 10;
```

If `data_source = 'watttime'` → Real data ✅
If `data_source = 'estimated'` → Fallback data ⚠️

### Check ISO Market Prices:

```sql
SELECT * FROM iso_market_prices
WHERE iso = 'IESO'
ORDER BY timestamp DESC
LIMIT 10;
```

If no data → ISO sync not running ❌
If data exists → ISO sync working ✅

---

## ❓ FAQ

**Q: Are jobs running in production right now?**
A: Yes! Jobs auto-start when `NODE_ENV=production` (Vercel sets this automatically).

**Q: Why is carbon intensity using estimated data?**
A: You haven't added WattTime API credentials yet. The app falls back to realistic estimated patterns.

**Q: Do I need to pay for APIs?**
A: No! All recommended APIs have free tiers that are more than sufficient:
- WattTime: 5,000 calls/month free
- OpenWeatherMap: 1,000 calls/day free
- SolCast: 50 calls/day free
- IESO/CAISO: Public APIs (no auth needed)

**Q: Why aren't ISO prices syncing automatically?**
A: The endpoint exists but needs an external trigger (cron job). Use GitHub Actions (FREE) or EasyCron (FREE).

**Q: Can I test locally before production?**
A: Yes! Add `ENABLE_SCHEDULER=true` to `.env.local` and restart `npm run dev`.

---

## 📌 Quick Start Recommendations

**For MVP Launch (Do This First):**
1. ✅ Deploy to Vercel (jobs will auto-start)
2. ⚠️ Add WattTime credentials (30 min setup)
3. ⚠️ Set up GitHub Actions for ISO sync (15 min setup)

**For Full Production (Do Later):**
4. Add OpenWeatherMap for weather forecasting
5. Add SolCast for solar irradiance forecasting
6. Set up monitoring/alerts for job failures

---

**Last Updated:** December 21, 2024
**Production URL:** https://enalysis.io
**ML Service:** https://btm-production-77c3.up.railway.app
