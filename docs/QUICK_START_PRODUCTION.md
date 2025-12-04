# Quick Start: Production Setup (30-60 minutes)

This is a streamlined guide to get your OAuth integration production-ready quickly.

## Prerequisites
- [ ] Enphase developer account registered
- [ ] Access to your deployment platform (Vercel recommended)
- [ ] Domain name configured

## Step 1: Get Enphase Credentials (15-30 min + approval wait)

### 1.1 Register Application
1. Go to https://developer.enphase.com/ → Sign Up/Login
2. Click "Create New App"
3. Fill in:
   ```
   Name: Enalysis Energy Management
   Type: Web Application
   Redirect URI: https://yourdomain.com/api/oauth/enphase/callback
   Scopes: read_data, read_system
   ```
4. Submit and wait for approval (1-3 business days)

### 1.2 Get Credentials
Once approved:
- Copy **Client ID**
- Copy **Client Secret**
- Save these securely!

## Step 2: Update Environment Variables (5 min)

### Production `.env`:
```bash
# Database
DATABASE_URL="your_production_database_url"

# Enphase OAuth (Production)
ENPHASE_CLIENT_ID="your_approved_client_id"
ENPHASE_CLIENT_SECRET="your_approved_client_secret"
ENPHASE_REDIRECT_URI="https://yourdomain.com/api/oauth/enphase/callback"

# Enable production mode
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"

# Optional but recommended
ENCRYPTION_SECRET="generate_random_32_char_string"
CRON_SECRET="generate_random_32_char_string"
```

## Step 3: Implement Real API Calls (15 min)

I'll create helper functions you can drop in:

### 3.1 Create API Client Library

The files are ready in the guide. Just copy:
- `lib/api-clients/enphase.ts`
- `lib/api-clients/solaredge.ts`

### 3.2 Update Test Connection Route

Replace lines 69-72 in `app/api/test-solar-connection/route.ts` with real implementation (see PRODUCTION_READINESS.md section 4.1)

## Step 4: Deploy (10 min)

### Vercel Deployment:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd enalysis-mvp
vercel

# Add environment variables in Vercel dashboard
# Settings → Environment Variables → Add each variable
```

### Environment Variables to Add in Vercel:
- `DATABASE_URL`
- `ENPHASE_CLIENT_ID`
- `ENPHASE_CLIENT_SECRET`
- `ENPHASE_REDIRECT_URI`
- `ENCRYPTION_SECRET`
- `CRON_SECRET`

## Step 5: Test Production OAuth (5 min)

1. Visit your production URL
2. Go to Settings → Data Connections
3. Select a PROD meter
4. Choose "Enphase Solar" provider
5. Enter System ID
6. Click "Connect to Enphase"
7. Authorize on Enphase
8. Should redirect back with tokens stored

## Step 6: Set Up Data Fetching Cron (10 min)

### Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-energy-data",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Redeploy:
```bash
vercel --prod
```

## Verification Checklist

- [ ] OAuth flow completes successfully
- [ ] Access token stored in database
- [ ] Test connection returns real data (not mock)
- [ ] Cron job runs every 15 minutes
- [ ] Data appears in measurements table
- [ ] Token refresh works before expiry

## Troubleshooting

### "OAuth configuration not set up"
- Check environment variables in deployment platform
- Redeploy after adding variables

### "Redirect URI mismatch"
- Ensure ENPHASE_REDIRECT_URI matches exactly in:
  - Enphase developer portal
  - Your environment variables
  - No trailing slashes

### "Invalid grant" error
- Token expired, need to re-authorize
- Check token refresh mechanism

### Mock data still showing
- Check if real API calls are implemented
- Verify environment variables loaded
- Check logs for API errors

## What's Next?

### Immediate (Today):
- [ ] Test with 2-3 real Enphase systems
- [ ] Monitor error logs
- [ ] Check data is updating every 15 min

### This Week:
- [ ] Add other providers (SolarEdge, Tesla)
- [ ] Set up monitoring (Sentry)
- [ ] Implement caching (Redis)
- [ ] Add error notifications

### This Month:
- [ ] Security audit
- [ ] Load testing
- [ ] Optimize API calls
- [ ] User documentation

## Support

Need help? Check:
1. Server logs: `vercel logs`
2. [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) - Full guide
3. [oauth-implementation.md](./oauth-implementation.md) - Technical docs
4. Enphase API docs: https://developer.enphase.com/docs

## Cost Summary

**Minimum to get started**: $20/month (Vercel Pro)

**Recommended for production**: $40-60/month
- Vercel Pro: $20
- Upstash Redis: $10
- Sentry: $0-26 (free tier available)
- Database: Varies (Supabase free tier available)
