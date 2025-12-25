# GitHub Secrets Setup - Quick Guide

## ✅ Vercel Environment Variables

**Good news:** `CRON_SECRET` already exists in Vercel for all environments!

No need to add it again.

---

## 🔑 GitHub Repository Secrets (Still Needed)

You need to add **2 secrets** to GitHub for the ISO sync workflow to work.

### Step 1: Go to GitHub Secrets Page

Click this link:
```
https://github.com/akhosro/BTM/settings/secrets/actions
```

Or manually:
1. Go to your repository: https://github.com/akhosro/BTM
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)

---

### Step 2: Add First Secret - CRON_SECRET

1. Click **"New repository secret"** button
2. Fill in:
   - **Name:** `CRON_SECRET`
   - **Secret:** `129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d`
3. Click **"Add secret"**

---

### Step 3: Add Second Secret - VERCEL_PRODUCTION_URL

1. Click **"New repository secret"** button again
2. Fill in:
   - **Name:** `VERCEL_PRODUCTION_URL`
   - **Secret:** `https://enalysis.io`
3. Click **"Add secret"**

---

## ✅ Verification

After adding both secrets, you should see:

```
Repository secrets

CRON_SECRET                     Updated now
VERCEL_PRODUCTION_URL          Updated now
```

---

## 🧪 Test the Workflow

### Option 1: Manual Trigger (Recommended - Test Immediately)

1. Go to: https://github.com/akhosro/BTM/actions
2. Click on **"Sync ISO Market Prices"** workflow
3. Click **"Run workflow"** dropdown button
4. Keep defaults or select:
   - Sync type: `both`
   - ISO: `IESO` (Ontario only for first test)
5. Click **"Run workflow"** button
6. Refresh the page after a few seconds
7. Click on the workflow run that appears
8. Should see: ✅ All steps green with "ISO price sync completed successfully"

### Option 2: Wait for Scheduled Run

The workflow will automatically run at:
- 00:00 UTC (7:00 PM EST)
- 06:00 UTC (1:00 AM EST) ← Best time for IESO day-ahead prices
- 12:00 UTC (7:00 AM EST)
- 18:00 UTC (1:00 PM EST)

---

## 🔍 What to Look For in Logs

When the workflow runs successfully, you'll see:

```
🔄 Syncing ISO market prices...
Sync type: both
ISO: IESO
Response code: 200

📊 Sync Results:
IESO Forecast: 24 stored, 0 skipped
IESO Actual: 3 stored, 0 skipped
CAISO Forecast: 0 stored, 0 skipped
CAISO Actual: 0 stored, 0 skipped

✅ ISO price sync completed successfully
```

---

## ❌ Troubleshooting

### Error: "Unauthorized" (401)

**Problem:** CRON_SECRET doesn't match between GitHub and Vercel

**Solution:**
1. Check GitHub secret value matches exactly: `129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d`
2. Check Vercel has same value (it should already exist)
3. Try running workflow again

### Error: "Connection failed"

**Problem:** VERCEL_PRODUCTION_URL is wrong or Vercel app isn't deployed

**Solution:**
1. Make sure Vercel app is deployed at `https://enalysis.io`
2. Try visiting: https://enalysis.io/api/scheduled/iso-sync
3. Should see JSON with schedule information

### Error: "No data stored"

**Problem:** IESO API might be temporarily down

**Solution:**
1. This is normal - IESO API occasionally has issues
2. Workflow will retry automatically on next scheduled run (6 hours)
3. Check IESO API status: http://reports.ieso.ca/public/

---

## 📊 Verify Data in Database

After successful run, check your database:

```sql
-- Check if ISO prices were stored
SELECT
  iso,
  price_type,
  COUNT(*) as count,
  MIN(timestamp) as earliest_price,
  MAX(timestamp) as latest_price
FROM iso_market_prices
GROUP BY iso, price_type
ORDER BY iso, price_type;
```

Expected result after first successful run:
```
iso    | price_type | count | earliest_price      | latest_price
-------|------------|-------|---------------------|-------------------
IESO   | actual     | 3     | 2024-12-21 15:00:00 | 2024-12-21 17:00:00
IESO   | forecast   | 24    | 2024-12-22 00:00:00 | 2024-12-22 23:00:00
```

---

## 🎯 Next Steps After GitHub Secrets Are Added

1. **Test workflow manually** (see above)
2. **Verify data in database** (SQL query above)
3. **Monitor first few scheduled runs** (check Actions tab every 6 hours)
4. **Move to Priority 1:** Set up WattTime API for real-time carbon data

---

## 📝 Summary

- ✅ CRON_SECRET already in Vercel (no action needed)
- ⚠️ Need to add CRON_SECRET to GitHub (5 min)
- ⚠️ Need to add VERCEL_PRODUCTION_URL to GitHub (1 min)
- ✅ Workflow file already pushed to GitHub
- ⚠️ Test manual trigger after adding secrets

**Total time: ~10 minutes**

---

**Quick Links:**
- Add GitHub Secrets: https://github.com/akhosro/BTM/settings/secrets/actions
- View Workflows: https://github.com/akhosro/BTM/actions
- Vercel Dashboard: https://vercel.com/YOUR_USERNAME/YOUR_PROJECT

**CRON_SECRET value (copy this):**
```
129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d
```
