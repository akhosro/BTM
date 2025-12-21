# Next Steps - Production Deployment Checklist

## ✅ Completed

### Marketing & Sales
- ✅ Toronto prospect list (50 high-priority targets)
- ✅ Contact finding guide with LinkedIn/Apollo.io instructions
- ✅ CSV template for tracking prospects
- ✅ Complete Claude-powered marketing guide (zero budget)

### Scheduled Jobs & APIs
- ✅ GitHub Actions workflow for ISO price syncing
- ✅ CRON_SECRET generated and configured
- ✅ Weather API integration ready (OpenWeatherMap, SolCast)
- ✅ Complete API status documentation

---

## 🎯 Priority 1: GitHub Actions Setup (15 minutes)

**DO THIS FIRST** - Enables automated ISO market price syncing

### Step 1: Add GitHub Secrets (5 min)

Go to: https://github.com/akhosro/BTM/settings/secrets/actions

Add two secrets:

1. **CRON_SECRET**
   ```
   Value: 129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d
   ```

2. **VERCEL_PRODUCTION_URL**
   ```
   Value: https://enalysis.io
   ```

### Step 2: Add Vercel Environment Variable (5 min)

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

Add one variable:

**CRON_SECRET**
```
Value: 129887341520fefdcc47bb15b8e0fa8b619160aafafb02a5120973d3bc21c91d
Environment: ✅ Production
```

Then click **"Redeploy"** or wait for next deployment.

### Step 3: Test the Workflow (5 min)

1. Go to: https://github.com/akhosro/BTM/actions
2. Click "Sync ISO Market Prices"
3. Click "Run workflow"
4. Select:
   - Sync type: `both`
   - ISO: `IESO` (Ontario)
5. Click "Run workflow"
6. Wait 30 seconds, refresh, click on the run
7. Should see: ✅ ISO price sync completed successfully

### Verify Data in Database:

```sql
SELECT * FROM iso_market_prices
WHERE iso = 'IESO'
ORDER BY timestamp DESC
LIMIT 10;
```

Should see 24+ records (forecast + actual prices).

**Once working:** Workflow will auto-run every 6 hours!

---

## 🌍 Priority 2: WattTime API Setup (30 minutes)

**Enables real-time carbon intensity data** for better optimization

### Step 1: Register with WattTime (10 min)

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

**Save the username and password!**

### Step 2: Add to Vercel (5 min)

Go to: Vercel → Settings → Environment Variables

Add two variables:

1. **WATTTIME_USERNAME**
   ```
   Value: your-email@enalysis.io
   Environment: ✅ Production
   ```

2. **WATTTIME_PASSWORD**
   ```
   Value: YourSecurePassword123!
   Environment: ✅ Production
   ```

### Step 3: Redeploy & Verify (15 min)

1. Click "Redeploy" in Vercel
2. Wait for deployment to complete
3. Check logs: `vercel logs --follow`
4. Look for: `✅ Synced carbon intensity forecasts` (without "fallback" message)

### Verify in Database:

```sql
SELECT * FROM grid_carbon_intensity
WHERE data_source = 'watttime'
ORDER BY timestamp DESC
LIMIT 10;
```

Should see real WattTime data (not "estimated").

---

## 📊 Optional: Weather APIs (For Later)

**Skip this for MVP** - only needed when you add solar/HVAC features

See [SCHEDULED_JOBS_SETUP.md](./SCHEDULED_JOBS_SETUP.md#priority-3-weather-api-setup-optional---for-later) for details.

---

## 🎯 Marketing Action Plan

### Week 1: Build Prospect List

1. **Open:** [PROSPECT_CONTACTS.csv](./PROSPECT_CONTACTS.csv)
2. **Sign up for Apollo.io** (free - 100 contacts/month)
3. **Search for top 10 data centers:**
   - Use LinkedIn search URLs from CSV
   - Fill in names and emails
4. **Alternative:** Use LinkedIn direct (no emails needed)
   - Connect with prospects directly
   - Use connection note templates from [HOW_TO_FIND_CONTACTS.md](./HOW_TO_FIND_CONTACTS.md)

### Week 2: Start Outreach

See [CLAUDE_MARKETING_AGENT.md](./CLAUDE_MARKETING_AGENT.md) for:
- Email templates
- LinkedIn message templates
- Cold call scripts
- Content calendar

Target: 10 emails/day → 5 demo requests/week

---

## 🔍 Monitoring & Verification

### Check Scheduled Jobs are Running

**Vercel logs:**
```bash
vercel logs --follow
```

Look for:
```
✅ Scheduler started with 4 jobs
✅ [Job] Carbon intensity sync completed
✅ [Job] AI recommendations generated
```

### Check ISO Price Syncs

**GitHub Actions:**
https://github.com/akhosro/BTM/actions

Should see runs every 6 hours with ✅ success.

### Check Database Data

**Carbon intensity:**
```sql
SELECT COUNT(*), data_source FROM grid_carbon_intensity
GROUP BY data_source;
```

**ISO prices:**
```sql
SELECT iso, price_type, COUNT(*) FROM iso_market_prices
GROUP BY iso, price_type;
```

---

## 📝 Current Status

### ✅ Working (No Action Needed)
- Scheduled jobs (auto-enabled in production)
- ML service / consumption forecasting
- Carbon intensity (using fallback data)
- Database (production ready)
- Landing page & blog posts

### ⚠️ Needs Setup (This Week)
- [ ] GitHub Actions secrets
- [ ] Vercel CRON_SECRET
- [ ] Test ISO price sync
- [ ] WattTime registration
- [ ] WattTime credentials to Vercel

### 📅 Future Enhancements
- [ ] Weather APIs (when adding solar forecasting)
- [ ] Additional ISOs (ERCOT, PJM, etc.)
- [ ] Email automation (Mailchimp)
- [ ] LinkedIn automation (Sales Navigator)

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| **[API_INTEGRATIONS_STATUS.md](./API_INTEGRATIONS_STATUS.md)** | Complete status of all external APIs |
| **[SCHEDULED_JOBS_SETUP.md](./SCHEDULED_JOBS_SETUP.md)** | Step-by-step setup for ISO sync & weather |
| **[TORONTO_PROSPECT_LIST.md](./TORONTO_PROSPECT_LIST.md)** | 50 high-priority Toronto prospects |
| **[PROSPECT_CONTACTS.csv](./PROSPECT_CONTACTS.csv)** | CSV template for tracking prospects |
| **[HOW_TO_FIND_CONTACTS.md](./HOW_TO_FIND_CONTACTS.md)** | Guide to finding contact info |
| **[CLAUDE_MARKETING_AGENT.md](./CLAUDE_MARKETING_AGENT.md)** | Zero-budget marketing guide |
| **[MARKETING_QUICK_START.md](./MARKETING_QUICK_START.md)** | 30-day customer acquisition plan |

---

## 🚀 Launch Day Checklist

### Before Going Live:

- [ ] GitHub Actions working (test manual trigger)
- [ ] Vercel environment variables set
- [ ] WattTime API connected
- [ ] ISO prices syncing automatically
- [ ] Database verified (check queries above)
- [ ] Landing page reviewed
- [ ] Blog posts reviewed
- [ ] Demo request form tested
- [ ] LinkedIn profile updated

### Launch Day:

- [ ] Deploy to Vercel production
- [ ] Verify all jobs running
- [ ] Send first 10 LinkedIn messages
- [ ] Post first LinkedIn content
- [ ] Monitor logs for errors

### Week 1 After Launch:

- [ ] Daily: Check GitHub Actions runs
- [ ] Daily: Send 10 outreach emails
- [ ] Daily: Post LinkedIn content
- [ ] Weekly: Review database metrics
- [ ] Weekly: Analyze response rates

---

## 🆘 Need Help?

**GitHub Actions not working?**
→ Check [SCHEDULED_JOBS_SETUP.md - Troubleshooting](./SCHEDULED_JOBS_SETUP.md#-troubleshooting)

**WattTime registration failed?**
→ Check [API_INTEGRATIONS_STATUS.md - WattTime](./API_INTEGRATIONS_STATUS.md#-carbon-intensity-integration)

**Marketing questions?**
→ See [CLAUDE_MARKETING_AGENT.md - FAQ](./CLAUDE_MARKETING_AGENT.md#faq)

**Contact finding?**
→ See [HOW_TO_FIND_CONTACTS.md](./HOW_TO_FIND_CONTACTS.md)

---

**Your immediate next step:** Add GitHub secrets (5 minutes) ↑

**Generated:** December 21, 2024
