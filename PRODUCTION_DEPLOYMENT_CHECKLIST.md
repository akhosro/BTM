# Production Deployment Checklist - Enalysis MVP

## Overview
This checklist covers everything needed to deploy the Enalysis MVP to production safely and securely.

**Estimated Timeline**: 1-2 weeks (depending on OAuth approvals)

---

## 🔴 CRITICAL - Must Fix Before Production

### 1. Security Issues

#### 1.1 Exposed Secrets in .env Files
- [ ] **CRITICAL**: Database password exposed in `.env` and `.env.local`
  - Current: `postgresql://postgres:1519188@127.0.0.1:5432/enalysis_mvp`
  - Action: Use environment variables in production hosting platform
  - Never commit real credentials to git

- [ ] **CRITICAL**: SESSION_SECRET is hardcoded
  - Current: `SESSION_SECRET="aec8fc532b1b2cdbd5f1d6a60d0f32f6f4813711a66342efd72465cc5f9a8abe"`
  - Action: Generate new secret for production
  - Command: `openssl rand -hex 64`

- [ ] **CRITICAL**: API keys exposed in `.env` and `ml-service/.env`
  - Current: `OPENWEATHER_API_KEY=a53902175c3eced21bcd3ac813d4c9ba`
  - Current: `UTILITYAPI_API_TOKEN=58b6ea484c944134a19a1ca4ca531787`
  - Action: Move to secure environment variable storage

#### 1.2 Mock OAuth Credentials
- [ ] Replace mock Enphase credentials
  - Current: `ENPHASE_CLIENT_ID="test_client_id_12345"`
  - Action: Get real credentials from Enphase Developer Portal (1-3 business days)
  - URL: https://developer.enphase.com/

#### 1.3 Database Security
- [ ] Set up production database with SSL
  - Options: Supabase, Neon, AWS RDS, Azure Database
  - Enable SSL mode: `?sslmode=require`

- [ ] Encrypt sensitive data in database
  - Access tokens, refresh tokens, API keys
  - Install: `npm install crypto-js`
  - Create encryption helpers

#### 1.4 HTTPS and SSL
- [ ] Ensure all API calls use HTTPS
- [ ] Configure SSL certificate for domain
- [ ] Update cookie settings for production:
  ```typescript
  secure: true, // Currently only true in production
  sameSite: "strict", // Change from "lax" to "strict"
  ```

---

## 🟠 HIGH PRIORITY - Recommended Before Production

### 2. Data & Timestamps

#### 2.1 Measurement Data Maintenance
- [ ] **IMPORTANT**: Implement automated timestamp updates
  - Issue: Measurements become stale over time (currently 55 hours behind)
  - Solution: Create scheduled job to regenerate data or sync from real sources
  - Script created: `scripts/update-to-current-time.ts`

- [ ] Set up real data sources
  - Enphase Solar API
  - SolarEdge API
  - UtilityAPI for bill data
  - Or: Continue using synthetic data with auto-refresh

#### 2.2 Carbon Intensity Data
- [ ] Implement live carbon intensity updates
  - Option 1: ElectricityMaps API (50 req/hour free)
  - Option 2: WattTime API (free for non-commercial)
  - Option 3: Continue using Ontario IESO fallback data

### 3. ML Service Production Setup

#### 3.1 ML Service Deployment
- [ ] Deploy Python ML service separately
  - Options: Railway, Render, AWS ECS, Google Cloud Run
  - Update `ML_SERVICE_URL` to production URL

- [ ] Configure ML service environment variables
  - DATABASE_URL (production database)
  - API_HOST and API_PORT
  - OPENWEATHER_API_KEY

- [ ] Set up ML service monitoring
  - Health check endpoint: `/health`
  - Error logging
  - Response time tracking

#### 3.2 Model Optimization
- [ ] Add model caching
  - Currently trains new model each time
  - Save trained models to disk/S3
  - Implement model versioning

- [ ] Optimize Prophet training
  - Current: trains on 7-30 days of data
  - Consider: pre-train models for common patterns
  - Cache forecast results

### 4. API Integrations

#### 4.1 Replace Mock API Calls
Files to update:
- [ ] `app/api/test-solar-connection/route.ts`
  - Lines 69-72: Enphase mock data
  - Lines 91-95: SolarEdge mock data
  - Replace with real API calls

- [ ] `lib/scheduler/jobs/sync-energy-data.ts`
  - Implement real data fetching
  - Handle OAuth token refresh
  - Implement retry logic

#### 4.2 OAuth Flow Completion
- [ ] Update Enphase redirect URI to production domain
  - Current: `http://localhost:3000/api/oauth/enphase/callback`
  - Production: `https://yourdomain.com/api/oauth/enphase/callback`

- [ ] Test complete OAuth flow in production
  - Authorization
  - Token exchange
  - Token refresh
  - Error handling

### 5. Background Jobs & Scheduler

#### 5.1 Enable Production Scheduler
- [ ] Set `ENABLE_SCHEDULER=true` in production
- [ ] Configure cron jobs for:
  - Energy data sync (every 15 minutes)
  - Carbon intensity updates (hourly)
  - Weather forecast sync (every 3 hours)
  - Recommendation generation (daily)

#### 5.2 Set Up Cron Infrastructure
Choose one:
- [ ] Vercel Cron (easiest for Vercel deployment)
- [ ] AWS EventBridge
- [ ] Google Cloud Scheduler
- [ ] Render Cron Jobs

---

## 🟡 MEDIUM PRIORITY - Should Fix Soon

### 6. Performance & Scalability

#### 6.1 Implement Caching
- [ ] Set up Redis for API response caching
  - Options: Upstash Redis (free tier), Redis Cloud, AWS ElastiCache
  - Cache dashboard stats (5 minutes)
  - Cache recommendations (15 minutes)
  - Cache carbon intensity data (1 hour)

- [ ] Install caching library:
  ```bash
  npm install @upstash/redis
  ```

#### 6.2 Database Optimization
- [ ] Add database indexes
  ```sql
  CREATE INDEX idx_measurements_timestamp ON measurements(timestamp);
  CREATE INDEX idx_measurements_entity_id ON measurements(entity_id);
  CREATE INDEX idx_recommendations_site_status ON recommendations(site_id, status);
  CREATE INDEX idx_carbon_intensity_region_timestamp ON grid_carbon_intensity(region, timestamp);
  ```

- [ ] Implement connection pooling
  - Configure max connections
  - Set up read replicas for heavy queries

#### 6.3 Rate Limiting
- [ ] Implement API rate limiting
  ```bash
  npm install @upstash/ratelimit
  ```

- [ ] Add rate limits to:
  - Login endpoint: 5 attempts per minute
  - API endpoints: 100 requests per minute per user
  - Public endpoints: 10 requests per minute per IP

### 7. Error Handling & Monitoring

#### 7.1 Set Up Error Tracking
- [ ] Install Sentry or similar
  ```bash
  npm install @sentry/nextjs
  ```

- [ ] Configure error tracking
  - Capture exceptions
  - Track user sessions
  - Monitor performance

- [ ] Set up alerts for:
  - API failures
  - Database connection errors
  - OAuth token refresh failures
  - ML service downtime

#### 7.2 Logging Infrastructure
- [ ] Implement structured logging
  - Use Winston or Pino
  - Log levels: error, warn, info, debug

- [ ] Set up log aggregation
  - Options: Datadog, LogRocket, Better Stack
  - Track: API calls, errors, performance metrics

#### 7.3 Health Checks
- [ ] Create comprehensive health check endpoint
  - Database connectivity
  - Redis connectivity
  - ML service status
  - External API status

### 8. Frontend & UX

#### 8.1 Production Build
- [ ] Test production build
  ```bash
  npm run build
  npm start
  ```

- [ ] Fix build warnings/errors
- [ ] Optimize bundle size
- [ ] Test in multiple browsers

#### 8.2 Error Boundaries
- [ ] Add React error boundaries
- [ ] Implement graceful error messages
- [ ] Add retry mechanisms for failed requests

#### 8.3 Loading States
- [ ] Add loading spinners for all async operations
- [ ] Implement skeleton screens
- [ ] Add timeout handling (30 seconds max)

### 9. Testing

#### 9.1 Unit Tests
- [ ] Test utility functions
- [ ] Test API route handlers
- [ ] Test database queries
- [ ] Target: 70%+ code coverage

#### 9.2 Integration Tests
- [ ] Test OAuth flow end-to-end
- [ ] Test recommendation generation
- [ ] Test data sync jobs
- [ ] Test error scenarios

#### 9.3 Load Testing
- [ ] Test with 100 concurrent users
- [ ] Test database under load
- [ ] Test ML service response times
- [ ] Identify bottlenecks

---

## 🟢 NICE TO HAVE - Post-Launch Improvements

### 10. Advanced Features

- [ ] Email notifications
  - Password reset
  - Recommendation alerts
  - System status updates

- [ ] Multi-factor authentication (MFA)
- [ ] User profile customization
- [ ] Advanced analytics dashboard
- [ ] Export data to CSV/PDF
- [ ] Mobile app (React Native)

### 11. Documentation

- [ ] API documentation (Swagger/OpenAPI)
- [ ] User guide
- [ ] Admin documentation
- [ ] Deployment runbook

### 12. Compliance

- [ ] Privacy policy
- [ ] Terms of service
- [ ] GDPR compliance (if serving EU users)
- [ ] Data retention policy
- [ ] Cookie consent banner

---

## Deployment Platforms Comparison

### Option 1: Vercel (Recommended for MVP)
**Pros:**
- ✅ Easiest Next.js deployment
- ✅ Built-in cron jobs
- ✅ Global CDN
- ✅ Automatic SSL

**Cons:**
- ❌ Serverless functions (cold starts)
- ❌ Need separate ML service hosting

**Cost:** $20-50/month

**Setup Steps:**
1. Push code to GitHub
2. Connect Vercel to repository
3. Set environment variables in Vercel dashboard
4. Deploy ML service to Railway/Render
5. Configure custom domain
6. Enable Vercel Cron

### Option 2: AWS (Best for Scale)
**Pros:**
- ✅ Full control
- ✅ Scalable infrastructure
- ✅ Many service options

**Cons:**
- ❌ Complex setup
- ❌ Requires DevOps knowledge

**Cost:** $50-200/month

**Services:**
- ECS/Fargate for containers
- RDS for PostgreSQL
- ElastiCache for Redis
- EventBridge for cron
- CloudWatch for monitoring

### Option 3: Railway (Simplest All-in-One)
**Pros:**
- ✅ Simple deployment
- ✅ Can host both Next.js + Python ML service
- ✅ Built-in PostgreSQL

**Cons:**
- ❌ Limited free tier
- ❌ Less mature than Vercel/AWS

**Cost:** $20-40/month

---

## Pre-Deployment Commands

```bash
# 1. Generate new production secrets
openssl rand -hex 64  # For SESSION_SECRET
openssl rand -hex 32  # For ENCRYPTION_SECRET

# 2. Test production build
npm run build
npm start

# 3. Run database migrations
npm run db:migrate

# 4. Seed initial data (if needed)
npm run seed:demo

# 5. Test ML service
curl http://localhost:8000/health

# 6. Generate recommendations
curl -X POST http://localhost:8000/api/recommend/generate \
  -H "Content-Type: application/json" \
  -d '{"site_id": "your-site-id", "forecast_hours": 24, "training_days": 7}'
```

---

## Production Environment Variables Checklist

### Next.js App (.env.production)
```bash
# Database
DATABASE_URL="postgresql://..."  # Production database with SSL

# Security
SESSION_SECRET="<generate-new-64-char-hex>"
ENCRYPTION_SECRET="<generate-new-32-char-hex>"

# OAuth - Enphase
ENPHASE_CLIENT_ID="<real-client-id>"
ENPHASE_CLIENT_SECRET="<real-client-secret>"
ENPHASE_REDIRECT_URI="https://yourdomain.com/api/oauth/enphase/callback"

# OAuth - UtilityAPI
UTILITYAPI_API_TOKEN="<your-token>"
UTILITYAPI_REDIRECT_URI="https://yourdomain.com/api/oauth/utilityapi/callback"

# ML Service
ML_SERVICE_URL="https://ml-service.yourdomain.com"

# External APIs
OPENWEATHERMAP_API_KEY="<your-key>"
ELECTRICITYMAPS_API_KEY="<your-key>"  # Optional

# Scheduler
ENABLE_SCHEDULER=true

# Monitoring
SENTRY_DSN="<your-sentry-dsn>"
NEXT_PUBLIC_SENTRY_DSN="<your-sentry-dsn>"

# App URL
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# Cron Security
CRON_SECRET="<generate-random-secret>"
```

### ML Service (.env.production)
```bash
DATABASE_URL="postgresql://..."  # Same as above

API_HOST=0.0.0.0
API_PORT=8000

LOG_LEVEL=info

MODEL_CACHE_DIR=/app/models/cache

OPENWEATHER_API_KEY="<your-key>"
ELECTRICITYMAPS_API_KEY="<your-key>"
```

---

## Post-Deployment Verification

### Immediately After Deployment
- [ ] Dashboard loads successfully
- [ ] Login works
- [ ] Database connections work
- [ ] ML service responds to health checks
- [ ] Background jobs are running

### Within First Hour
- [ ] Test OAuth flow with real credentials
- [ ] Generate test recommendations
- [ ] Verify data sync jobs execute
- [ ] Check error logs for issues

### Within First Day
- [ ] Monitor error rates
- [ ] Check API response times
- [ ] Verify cron jobs executed
- [ ] Test with real user accounts

### Within First Week
- [ ] Review performance metrics
- [ ] Analyze user feedback
- [ ] Check database growth
- [ ] Monitor API quota usage
- [ ] Optimize slow queries

---

## Emergency Rollback Plan

If critical issues occur:

1. **Revert to previous deployment**
   ```bash
   # Vercel
   vercel rollback

   # Railway
   railway rollback
   ```

2. **Switch to maintenance mode**
   - Display maintenance page
   - Prevent new user signups
   - Preserve data integrity

3. **Database rollback**
   - Have database backups ready
   - Test restore process before deployment

---

## Support Contacts

- **Enphase Developer Support**: https://developer.enphase.com/support
- **UtilityAPI Support**: support@utilityapi.com
- **Vercel Support**: https://vercel.com/support
- **Database Provider**: (Supabase, Neon, AWS, etc.)

---

## Estimated Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Week 1** | 5 days | OAuth approvals, security fixes, env setup |
| **Week 2** | 3 days | Testing, ML service deployment, monitoring |
| **Week 3** | 2 days | Production deployment, verification |
| **Total** | **2-3 weeks** | From start to production |

---

## Next Steps

1. ✅ **Review this checklist** with your team
2. ⏭️ **Start with CRITICAL items** (security, secrets)
3. ⏭️ **Apply for Enphase OAuth credentials** (1-3 days wait)
4. ⏭️ **Choose deployment platform** (Vercel recommended)
5. ⏭️ **Set up production database** (Supabase/Neon recommended)
6. ⏭️ **Deploy ML service** (Railway/Render recommended)
7. ⏭️ **Configure monitoring** (Sentry)
8. ⏭️ **Test in staging environment**
9. ⏭️ **Deploy to production**
10. ⏭️ **Monitor and iterate**

---

**Questions or need help?** Review the detailed guides:
- [PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) - Detailed OAuth setup
- [OAUTH_SETUP_GUIDE.md](docs/OAUTH_SETUP_GUIDE.md) - OAuth implementation
- [SCHEDULER_GUIDE.md](docs/SCHEDULER_GUIDE.md) - Background jobs setup
