# Scheduled Jobs Setup Guide

This guide walks you through setting up automated ISO price syncing and weather forecasting for production.

---

## ✅ Priority 2: ISO Price Sync (GitHub Actions)

### What This Does:
- Automatically fetches IESO (Ontario) and CAISO (California) market prices
- Runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Syncs both forecast and actual prices
- **Completely FREE** (uses GitHub Actions free tier)

### Status:
✅ GitHub Actions workflow created: [`.github/workflows/iso-sync.yml`](../.github/workflows/iso-sync.yml)
✅ CRON_SECRET generated and added to `.env.local`

---

## 📋 Setup Steps

### Step 1: Add GitHub Secret (5 min)

1. **Go to your GitHub repository:**
   ```
   https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions
   ```

2. **Click "New repository secret"**

3. **Add the secret:**
   - Name: `CRON_SECRET`
   - Value: `129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d`
   - Click "Add secret"

4. **Add another secret for Vercel URL:**
   - Name: `VERCEL_PRODUCTION_URL`
   - Value: `https://enalysis.io` (or your production URL)
   - Click "Add secret"

### Step 2: Add to Vercel Environment Variables (2 min)

1. **Go to Vercel Dashboard:**
   ```
   https://vercel.com/YOUR_USERNAME/YOUR_PROJECT/settings/environment-variables
   ```

2. **Add the CRON_SECRET:**
   - Name: `CRON_SECRET`
   - Value: `129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d`
   - Environment: ✅ Production (check the box)
   - Click "Save"

3. **Redeploy your app** (or it will auto-apply on next deployment)

### Step 3: Commit and Push GitHub Workflow (1 min)

```bash
cd enalysis-mvp

# Add the workflow file
git add .github/workflows/iso-sync.yml

# Commit
git commit -m "Add GitHub Actions workflow for ISO price syncing"

# Push to GitHub
git push origin main
```

### Step 4: Verify It Works (2 min)

1. **Go to GitHub Actions:**
   ```
   https://github.com/YOUR_USERNAME/YOUR_REPO/actions
   ```

2. **You should see:** "Sync ISO Market Prices" workflow

3. **Test it manually:**
   - Click on the workflow
   - Click "Run workflow" dropdown
   - Select options:
     - Sync type: `both`
     - ISO: `IESO` (start with Ontario only)
   - Click "Run workflow"

4. **Check the logs:**
   - Should see: ✅ ISO price sync completed successfully
   - Should see: `IESO Forecast: X stored, Y skipped`

5. **Verify in database:**
   ```sql
   SELECT * FROM iso_market_prices
   WHERE iso = 'IESO'
   ORDER BY timestamp DESC
   LIMIT 10;
   ```

---

## 📅 Schedule Details

The workflow runs **every 6 hours** at:
- **00:00 UTC** (7:00 PM EST / 8:00 PM EDT)
- **06:00 UTC** (1:00 AM EST / 2:00 AM EDT) ← **Perfect for IESO day-ahead prices!**
- **12:00 UTC** (7:00 AM EST / 8:00 AM EDT)
- **18:00 UTC** (1:00 PM EST / 2:00 PM EDT)

### Why These Times?

**IESO publishes day-ahead forecast prices around 5:00 AM EST**, so the 06:00 UTC (2 AM EDT) run captures them.

The other runs capture **actual (real-time) prices** throughout the day with a 2-hour publication delay.

---

## 🧪 Testing

### Test Locally Before GitHub Actions:

```bash
# 1. Make sure CRON_SECRET is in your .env.local (already added)
# 2. Start dev server
npm run dev

# 3. In another terminal, test the endpoint:
curl -X POST http://localhost:3000/api/scheduled/iso-sync \
  -H "Content-Type: application/json" \
  -H "X-Cron-Secret: 129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d" \
  -d '{"type": "forecast", "iso": "IESO"}'
```

Expected response:
```json
{
  "success": true,
  "message": "Scheduled sync completed",
  "timestamp": "2024-12-21T...",
  "results": {
    "IESO": {
      "forecast": {
        "fetched": 24,
        "stored": 24,
        "skipped": 0,
        "errors": []
      }
    }
  }
}
```

### Manual Trigger from GitHub:

1. Go to Actions → "Sync ISO Market Prices"
2. Click "Run workflow"
3. Select your options
4. Click "Run workflow" button
5. Refresh and click on the run to see logs

---

## ✅ Priority 3: Weather API Setup (Optional - For Later)

### When You Need This:
- Solar PV generation forecasting
- HVAC pre-cooling optimization
- Temperature-based demand forecasting

### APIs Available:

#### 1. OpenWeatherMap (General Weather)
**Free Tier:** 1,000 calls/day

**Setup:**
1. Sign up: https://openweathermap.org/api
2. Get API key from dashboard
3. Add to Vercel:
   - Name: `OPENWEATHERMAP_API_KEY`
   - Value: `your-api-key`

**Usage:**
```typescript
import { getWeatherForecast } from '@/lib/external-data/weather-api';

// Get 48-hour forecast for Toronto
const forecast = await getWeatherForecast(43.6532, -79.3832, 48);
// Returns: cloudCover, temperature, irradiance, precipitation, etc.
```

#### 2. SolCast (Solar Irradiance Forecasting)
**Free Tier:** 50 calls/day (enough for 1 call per site per day)

**Setup:**
1. Sign up: https://solcast.com/
2. Get API key from dashboard
3. Add to Vercel:
   - Name: `SOLCAST_API_KEY`
   - Value: `your-api-key`

**Usage:**
```typescript
import { getSolarIrradianceForecast } from '@/lib/external-data/weather-api';

// Get 7-day solar forecast for a site
const solarForecast = await getSolarIrradianceForecast(43.6532, -79.3832, 168);
// Returns: timestamp, irradiance (W/m²)
```

### Adding Weather to Scheduled Jobs

When you're ready, you can add a weather sync job to [`lib/scheduler/index.ts`](../lib/scheduler/index.ts):

```typescript
// Job 5: Sync weather forecasts every 6 hours
const weatherSyncJob = cron.schedule("0 */6 * * *", async () => {
  console.log("🔄 [Job] Syncing weather forecasts...");
  try {
    await syncWeatherData();
    console.log("✅ [Job] Weather data sync completed");
  } catch (error) {
    console.error("❌ [Job] Weather sync failed:", error);
  }
});
activeJobs.push(weatherSyncJob);
```

Create the sync function in [`lib/scheduler/jobs/sync-weather-data.ts`](../lib/scheduler/jobs/):

```typescript
import { db } from "@/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getWeatherForecast } from "@/lib/external-data/weather-api";

export async function syncWeatherData() {
  const activeSites = await db
    .select()
    .from(sites)
    .where(eq(sites.active, true));

  for (const site of activeSites) {
    if (!site.latitude || !site.longitude) continue;

    const forecast = await getWeatherForecast(
      site.latitude,
      site.longitude,
      48 // 48-hour forecast
    );

    // Store forecast in weather_forecasts table
    // (you'll need to create this table in schema)
  }
}
```

---

## 📊 Monitoring

### Check ISO Price Sync Status:

**View recent syncs:**
```sql
SELECT
  iso,
  price_type,
  COUNT(*) as count,
  MIN(timestamp) as earliest,
  MAX(timestamp) as latest,
  MAX(metadata->>'syncedAt') as last_sync
FROM iso_market_prices
GROUP BY iso, price_type
ORDER BY iso, price_type;
```

**Check for gaps:**
```sql
SELECT
  iso,
  DATE(timestamp) as date,
  COUNT(*) as hours_available
FROM iso_market_prices
WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY iso, DATE(timestamp)
ORDER BY iso, date DESC;
```

### GitHub Actions Logs:

1. Go to: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
2. Click on "Sync ISO Market Prices"
3. Click on any run to see detailed logs
4. Should see:
   - ✅ ISO price sync completed successfully
   - 📊 Sync Results with stored/skipped counts

### Set Up Alerts (Optional):

Create `.github/workflows/iso-sync-notify.yml` for Slack/email notifications on failure:

```yaml
# Add to the iso-sync.yml file:
- name: Notify on Failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'ISO price sync failed! Check logs.'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 🔧 Troubleshooting

### ISO Sync Returns 401 Unauthorized

**Problem:** CRON_SECRET not matching between GitHub and Vercel

**Solution:**
1. Check GitHub secret: Settings → Secrets → Actions → CRON_SECRET
2. Check Vercel env var: Settings → Environment Variables → CRON_SECRET
3. Make sure both have the same value
4. Redeploy Vercel if you just added the env var

### No Data Being Stored

**Problem:** IESO or CAISO API might be down

**Solution:**
1. Check workflow logs for error messages
2. Test IESO API directly:
   ```bash
   curl "http://reports.ieso.ca/public/GenOutputbyFuelHourly/PUB_GenOutputbyFuelHourly_2024121901.xml"
   ```
3. If API is down, workflow will retry on next scheduled run (6 hours)

### GitHub Actions Not Running

**Problem:** Workflow file syntax error or GitHub Actions disabled

**Solution:**
1. Check workflow file for YAML syntax errors
2. Go to Settings → Actions → General
3. Make sure "Allow all actions and reusable workflows" is selected
4. Check that Actions are enabled for your repository

### Getting Rate Limited

**Problem:** Too many manual triggers

**Solution:**
- GitHub Actions free tier: 2,000 minutes/month
- Current workflow: ~30 seconds per run
- 4 runs/day × 30 days = 120 runs = 60 minutes/month
- You have plenty of quota!

---

## 📈 Expected Results

### After First Run (Manual Test):

**IESO:**
- Forecast: ~24 hours of day-ahead prices stored
- Actual: ~3 hours of real-time prices stored

**CAISO:**
- Forecast: ~24 hours of day-ahead prices stored
- Actual: ~3 hours of real-time prices stored

### After 7 Days of Automated Runs:

**IESO:**
- Forecast: ~7 days of forecast data (168 hours)
- Actual: ~7 days of actual prices (168 hours)
- Total: ~336 price records

**CAISO:**
- Forecast: ~7 days of forecast data
- Actual: ~7 days of actual prices
- Total: ~336 price records

### After 30 Days:

**IESO + CAISO:**
- Total: ~2,880 price records (30 days × 2 ISOs × 48 hours each)
- Database size: ~500 KB

---

## ✅ Checklist

### Priority 2: ISO Price Sync

- [ ] Add `CRON_SECRET` to GitHub repository secrets
- [ ] Add `VERCEL_PRODUCTION_URL` to GitHub repository secrets
- [ ] Add `CRON_SECRET` to Vercel environment variables
- [ ] Commit and push `.github/workflows/iso-sync.yml`
- [ ] Manually trigger workflow from GitHub Actions UI
- [ ] Verify data in database using SQL query
- [ ] Monitor first few scheduled runs

### Priority 3: Weather APIs (Optional)

- [ ] Sign up for OpenWeatherMap (if needed for weather forecasting)
- [ ] Add `OPENWEATHERMAP_API_KEY` to Vercel
- [ ] Sign up for SolCast (if needed for solar forecasting)
- [ ] Add `SOLCAST_API_KEY` to Vercel
- [ ] Create weather sync scheduled job (when ready)
- [ ] Create `weather_forecasts` database table
- [ ] Test weather forecast integration

---

## 🎯 Next Steps

1. **Complete Priority 2 Setup** (15 minutes)
   - Follow checklist above
   - Test manual trigger
   - Verify data in database

2. **Monitor for 24 Hours**
   - Check GitHub Actions logs after 6 hours
   - Verify 4 successful runs in first 24 hours
   - Check database has growing price data

3. **Skip Priority 3 for Now**
   - Weather APIs only needed for solar/HVAC features
   - Come back to this when you're ready to add those features

4. **Move to Priority 1** (if not done yet)
   - Set up WattTime for real-time carbon data
   - See [API_INTEGRATIONS_STATUS.md](./API_INTEGRATIONS_STATUS.md)

---

## 📞 Need Help?

**Check these first:**
- GitHub Actions logs: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
- Vercel deployment logs: `vercel logs --follow`
- Database query results (SQL above)

**Common issues:**
- CRON_SECRET mismatch → Check GitHub and Vercel match
- 401 Unauthorized → Redeploy Vercel after adding env var
- No data stored → Check IESO/CAISO API status
- Workflow not running → Check Actions are enabled in Settings

---

**Generated:** December 21, 2024
**CRON_SECRET:** `129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d`
**Production URL:** https://enalysis.io
