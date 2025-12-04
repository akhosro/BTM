# Background Job Scheduler Guide

## Overview

The Enalysis MVP includes a robust background job scheduler that automatically syncs energy data, updates carbon intensity forecasts, generates AI recommendations, and maintains database health.

## Architecture

```
lib/scheduler/
├── index.ts                    # Main scheduler orchestration
├── server.ts                   # Next.js integration
└── jobs/
    ├── sync-energy-data.ts     # Sync from Enphase, SolarEdge, Tesla, etc.
    ├── sync-carbon-intensity.ts # Fetch grid carbon forecasts
    ├── generate-recommendations.ts # AI optimization engine
    └── cleanup-expired-data.ts # Database maintenance
```

## Scheduled Jobs

### 1. Energy Data Sync
- **Schedule**: Every 15 minutes
- **Purpose**: Fetches latest measurements from all connected energy sources
- **Sources**: Enphase, SolarEdge, Tesla Powerwall, UtilityAPI

### 2. Carbon Intensity Sync
- **Schedule**: Every hour
- **Purpose**: Updates grid carbon intensity forecasts for all site regions
- **Data Source**: WattTime API (or ElectricityMaps)

### 3. AI Recommendations
- **Schedule**: Every 6 hours
- **Purpose**: Analyzes energy patterns and generates optimization opportunities
- **Analyzes**:
  - Load shifting opportunities (TOU pricing)
  - Solar self-consumption optimization
  - Battery peak shaving strategies
  - Carbon reduction opportunities

### 4. Data Cleanup
- **Schedule**: Daily at 2 AM
- **Purpose**: Removes expired data and optimizes database
- **Retention Periods**:
  - Measurements: 13 months
  - Carbon forecasts: 7 days
  - Expired recommendations: 90 days

## Configuration

### Enable/Disable Scheduler

By default, the scheduler only runs in production. To enable in development:

```bash
# .env
ENABLE_SCHEDULER=true
```

### Modify Schedules

Edit `lib/scheduler/index.ts` to change cron schedules:

```typescript
// Current: Every 15 minutes
const energySyncJob = cron.schedule("*/15 * * * *", async () => { ... });

// Change to: Every 30 minutes
const energySyncJob = cron.schedule("*/30 * * * *", async () => { ... });
```

**Cron Syntax Quick Reference:**
```
*  *  *  *  *
│  │  │  │  │
│  │  │  │  └─ Day of week (0-7, 0 and 7 are Sunday)
│  │  │  └──── Month (1-12)
│  │  └─────── Day of month (1-31)
│  └────────── Hour (0-23)
└───────────── Minute (0-59)

Examples:
*/15 * * * *   → Every 15 minutes
0 * * * *      → Every hour at minute 0
0 */6 * * *    → Every 6 hours
0 2 * * *      → Daily at 2:00 AM
0 0 * * 0      → Weekly on Sunday at midnight
```

## Manual Job Execution

### Via API

You can manually trigger jobs through the admin API:

```bash
# Trigger energy data sync
curl -X POST http://localhost:3000/api/admin/jobs \
  -H "Content-Type: application/json" \
  -d '{"jobName": "sync-energy"}'

# Available job names:
# - sync-energy
# - sync-carbon
# - generate-recommendations
# - cleanup
```

### Via Code

```typescript
import { runJobManually } from "@/lib/scheduler";

// Trigger a specific job
await runJobManually("sync-energy");
await runJobManually("generate-recommendations");
```

### Get Job Status

```bash
curl http://localhost:3000/api/admin/jobs
```

Response:
```json
{
  "success": true,
  "stats": {
    "measurements": 8640,
    "carbonIntensity": 24,
    "recommendations": 3
  },
  "availableJobs": [...]
}
```

## Monitoring

### Console Logs

The scheduler logs all job execution:

```
📅 Starting background job scheduler...
✅ Scheduler started with 4 jobs:
   - Energy data sync: Every 15 minutes
   - Carbon intensity: Every hour
   - AI recommendations: Every 6 hours
   - Data cleanup: Daily at 2 AM

🔄 [Job] Syncing energy data from all sources...
   Found 3 active energy sources to sync
   🔄 Syncing Enphase system: Rooftop Solar System
   ✅ Synced 96 Enphase measurements
   ✅ Synced 96 measurements in 234ms
✅ [Job] Energy data sync completed
```

### Error Handling

Failed jobs log errors but don't crash the server:

```
❌ [Job] Energy data sync failed: API rate limit exceeded
```

Jobs will retry on next scheduled run.

## Production Deployment

### Docker

The scheduler automatically starts when the Next.js app starts:

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

# Scheduler starts automatically with Next.js
CMD ["npm", "start"]
```

### Environment Variables

```bash
# Required for production
NODE_ENV=production
DATABASE_URL=postgresql://...

# API credentials for data sources
ENPHASE_CLIENT_ID=...
ENPHASE_CLIENT_SECRET=...
SOLAREDGE_API_KEY=...
TESLA_ACCESS_TOKEN=...
UTILITYAPI_API_TOKEN=...

# Optional
ENABLE_SCHEDULER=true  # Already enabled in production by default
```

### Vercel/Serverless

**Note**: The cron-based scheduler works best on traditional servers (VPS, containers).

For serverless platforms like Vercel, use Vercel Cron instead:

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/admin/jobs",
      "schedule": "*/15 * * * *"  // Every 15 min
    }
  ]
}
```

## Extending the Scheduler

### Add a New Job

1. Create job file:

```typescript
// lib/scheduler/jobs/my-new-job.ts
export async function myNewJob() {
  console.log("🔄 Running my new job...");

  // Your logic here

  console.log("✅ Job completed");
}
```

2. Register in scheduler:

```typescript
// lib/scheduler/index.ts
import { myNewJob } from "./jobs/my-new-job";

// In startScheduler():
const myJob = cron.schedule("0 * * * *", async () => {
  console.log("🔄 [Job] Running my new job...");
  try {
    await myNewJob();
    console.log("✅ [Job] My new job completed");
  } catch (error) {
    console.error("❌ [Job] My new job failed:", error);
  }
});
activeJobs.push(myJob);
```

3. Add to manual trigger:

```typescript
// lib/scheduler/index.ts
export async function runJobManually(jobName: string) {
  switch (jobName) {
    // ... existing cases
    case "my-new-job":
      await myNewJob();
      break;
  }
}
```

## Troubleshooting

### Scheduler Not Starting

**Symptom**: No scheduler logs in console

**Solutions**:
1. Check `NODE_ENV` or `ENABLE_SCHEDULER` environment variable
2. Verify `instrumentation.ts` is in project root
3. Ensure `next.config.js` has `instrumentationHook: true`
4. Restart Next.js dev server

### Jobs Not Running on Schedule

**Symptom**: Logs show scheduler started but no job execution

**Solutions**:
1. Check cron syntax is valid
2. Wait for next scheduled time (e.g., hourly job waits until next hour)
3. Manually trigger job to test: `runJobManually("job-name")`

### Database Connection Errors

**Symptom**: `Failed to fetch dashboard stats` or similar errors

**Solutions**:
1. Verify `DATABASE_URL` is set correctly
2. Check database is running and accessible
3. Test connection: `psql $DATABASE_URL`

### API Rate Limits

**Symptom**: Energy sync fails with 429 errors

**Solutions**:
1. Reduce sync frequency (e.g., every 30 min instead of 15)
2. Implement exponential backoff
3. Check API rate limits for your plan

## Best Practices

1. **Monitor Logs**: Always watch scheduler logs in production
2. **Test Manually First**: Use manual triggers to test jobs before relying on cron
3. **Graceful Degradation**: Jobs should handle errors without crashing
4. **Idempotent Operations**: Jobs should be safe to run multiple times
5. **Database Indexing**: Ensure timestamp columns are indexed for cleanup queries

## Next Steps

- [ ] Integrate real WattTime API for carbon data
- [ ] Add Sentry error tracking for job failures
- [ ] Implement job result history table
- [ ] Add Slack/email notifications for critical failures
- [ ] Create admin dashboard for job monitoring
