# Production Readiness Guide - OAuth & API Integration

This guide covers everything needed to make the Enalysis MVP production-ready for real API integrations.

## Table of Contents
1. [Enphase OAuth Setup](#1-enphase-oauth-setup)
2. [SolarEdge API Setup](#2-solaredge-api-setup)
3. [Other Providers Setup](#3-other-providers-setup)
4. [Real API Implementation](#4-real-api-implementation)
5. [Security Hardening](#5-security-hardening)
6. [Rate Limiting & Caching](#6-rate-limiting--caching)
7. [Error Handling & Monitoring](#7-error-handling--monitoring)
8. [Testing & Deployment](#8-testing--deployment)

---

## 1. Enphase OAuth Setup

### Step 1.1: Register as Enphase Developer

1. Go to [https://developer.enphase.com/](https://developer.enphase.com/)
2. Click "Sign Up" or "Log In" if you have an account
3. Complete the registration process
4. Verify your email

### Step 1.2: Create Application

1. Log into Enphase Developer Portal
2. Navigate to "My Apps" → "Create New App"
3. Fill in application details:
   - **Application Name**: Enalysis Energy Management
   - **Description**: Multi-site energy management and optimization platform
   - **Application Type**: Web Application
   - **OAuth Redirect URIs**:
     - Development: `http://localhost:3000/api/oauth/enphase/callback`
     - Production: `https://yourdomain.com/api/oauth/enphase/callback`
   - **Requested Scopes**:
     - `read_data` - Read energy production data
     - `read_system` - Read system information
     - (Check all necessary scopes based on your needs)

4. Submit the application
5. Wait for approval (usually 1-3 business days)

### Step 1.3: Get Credentials

Once approved:
1. Copy your **Client ID**
2. Copy your **Client Secret** (keep this secure!)
3. Note the approved **Redirect URI**

### Step 1.4: Configure Environment Variables

Update your `.env` file:

```bash
# Enphase OAuth Configuration (Production)
ENPHASE_CLIENT_ID="your_real_client_id_here"
ENPHASE_CLIENT_SECRET="your_real_client_secret_here"
ENPHASE_REDIRECT_URI="https://yourdomain.com/api/oauth/enphase/callback"

# For development, use:
# ENPHASE_REDIRECT_URI="http://localhost:3000/api/oauth/enphase/callback"
```

### Step 1.5: Implement Real API Calls

The current implementation uses mock data. You need to replace the TODO comments with real API calls.

**Files to update:**
- `app/api/test-solar-connection/route.ts` (line 69-72)
- Create: `app/api/enphase/fetch-data/route.ts` (for production data fetching)

---

## 2. SolarEdge API Setup

### Step 2.1: Get API Key

1. Log into your SolarEdge monitoring portal: [https://monitoring.solaredge.com](https://monitoring.solaredge.com)
2. Navigate to: **Admin** → **Site Access** → **API Access**
3. Click "Generate API Key"
4. Copy and save your API key securely
5. Find your Site ID from the URL or site details

### Step 2.2: Configure Environment Variables

```bash
# SolarEdge API Configuration
SOLAREDGE_API_KEY="your_api_key_here"
```

**Note**: SolarEdge uses API keys per site, so users will enter their own API keys in the data connections modal.

### Step 2.3: Test API Access

Test your API key:
```bash
curl "https://monitoringapi.solaredge.com/site/{siteId}/overview.json?api_key={apiKey}"
```

---

## 3. Other Providers Setup

### Fronius Solar API
- **Documentation**: https://www.fronius.com/en/solar-energy/installers-partners/technical-data/all-products/system-monitoring/open-interfaces/fronius-solar-api-json-
- **Authentication**: Local network access (no API key needed)
- **Endpoint**: `http://{device-ip}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`

### SMA Solar
- **Documentation**: https://www.sma.de/en/products/monitoring-control/webconnect.html
- **Authentication**: Username/Password
- **API**: Modbus or WebConnect

### Tesla Powerwall
- **Documentation**: https://www.tesla.com/support/energy/powerwall/own/monitoring-from-home-network
- **Authentication**: Local network access, requires local IP
- **Endpoint**: `https://{powerwall-ip}/api/meters/aggregates`

### Huawei FusionSolar
- **Documentation**: https://support.huawei.com/enterprise/en/doc/EDOC1100261860
- **Authentication**: API key
- **Portal**: https://intl.fusionsolar.huawei.com

### Growatt
- **Documentation**: https://www.growatt-server.com/
- **Authentication**: API key + username
- **Endpoint**: `https://server.growatt.com/`

---

## 4. Real API Implementation

### Step 4.1: Replace Mock Data in Test Connection

Update `app/api/test-solar-connection/route.ts`:

```typescript
// Current (line 69-72):
// TODO: Make actual API call to Enphase with OAuth token
// For now, return mock data

// Replace with:
if (provider === "enphase" || provider === "enphase_battery") {
  const systemId = credentials.systemId
  const accessToken = credentials.accessToken

  // Call Enphase API
  const enphaseResponse = await fetch(
    `https://api.enphaseenergy.com/api/v2/systems/${systemId}/summary`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!enphaseResponse.ok) {
    // Check if token expired
    if (enphaseResponse.status === 401) {
      return NextResponse.json(
        { error: "Access token expired. Please refresh your connection." },
        { status: 401 }
      )
    }
    throw new Error("Failed to fetch Enphase data")
  }

  const enphaseData = await enphaseResponse.json()

  return NextResponse.json({
    success: true,
    provider,
    currentPower: enphaseData.current_power / 1000, // Convert W to kW
    energyToday: enphaseData.energy_today / 1000, // Convert Wh to kWh
    status: enphaseData.status,
    lastUpdate: new Date().toISOString(),
  })
}

// Similarly for SolarEdge (line 91-95):
if (provider === "solaredge") {
  const apiKey = credentials.apiKey
  const siteId = credentials.siteId

  const solarEdgeResponse = await fetch(
    `https://monitoringapi.solaredge.com/site/${siteId}/currentPowerFlow.json?api_key=${apiKey}`
  )

  if (!solarEdgeResponse.ok) {
    throw new Error("Failed to fetch SolarEdge data")
  }

  const solarEdgeData = await solarEdgeResponse.json()
  const powerFlow = solarEdgeData.siteCurrentPowerFlow

  return NextResponse.json({
    success: true,
    provider,
    currentPower: powerFlow.PV?.currentPower || 0,
    energyToday: powerFlow.PV?.todayEnergy || 0,
    status: powerFlow.GRID?.status || "online",
    lastUpdate: new Date().toISOString(),
  })
}
```

### Step 4.2: Create Production Data Fetching Service

Create `lib/api-clients/enphase.ts`:

```typescript
export class EnphaseClient {
  private baseUrl = "https://api.enphaseenergy.com/api/v2"

  async getSystemSummary(systemId: string, accessToken: string) {
    const response = await fetch(`${this.baseUrl}/systems/${systemId}/summary`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Enphase API error: ${response.status}`)
    }

    return response.json()
  }

  async getProductionData(systemId: string, accessToken: string, startDate: string, endDate: string) {
    const response = await fetch(
      `${this.baseUrl}/systems/${systemId}/energy_lifetime?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Enphase API error: ${response.status}`)
    }

    return response.json()
  }
}
```

Create `lib/api-clients/solaredge.ts`:

```typescript
export class SolarEdgeClient {
  private baseUrl = "https://monitoringapi.solaredge.com"

  async getCurrentPowerFlow(siteId: string, apiKey: string) {
    const response = await fetch(
      `${this.baseUrl}/site/${siteId}/currentPowerFlow.json?api_key=${apiKey}`
    )

    if (!response.ok) {
      throw new Error(`SolarEdge API error: ${response.status}`)
    }

    return response.json()
  }

  async getEnergyDetails(siteId: string, apiKey: string, startTime: string, endTime: string) {
    const response = await fetch(
      `${this.baseUrl}/site/${siteId}/energyDetails?startTime=${startTime}&endTime=${endTime}&api_key=${apiKey}`
    )

    if (!response.ok) {
      throw new Error(`SolarEdge API error: ${response.status}`)
    }

    return response.json()
  }
}
```

### Step 4.3: Create Scheduled Data Fetching

Create `app/api/cron/fetch-energy-data/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { db } from "@/db"
import { energySources, measurements } from "@/db/schema"
import { eq } from "drizzle-orm"
import { EnphaseClient } from "@/lib/api-clients/enphase"
import { SolarEdgeClient } from "@/lib/api-clients/solaredge"

// This should be called by a cron job (e.g., every 15 minutes)
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Fetch all active API-connected energy sources
    const sources = await db.query.energySources.findMany({
      where: eq(energySources.active, true),
      with: {
        meter: true,
      },
    })

    const results = []

    for (const source of sources) {
      if (source.metadata?.dataSourceType !== "api") continue

      const provider = source.metadata.apiProvider
      const accessToken = source.metadata.accessToken
      const systemId = source.metadata.systemId

      try {
        let data

        if (provider === "enphase" || provider === "enphase_battery") {
          // Check if token needs refresh
          if (needsRefresh(source.metadata.tokenExpiry)) {
            await refreshEnphaseToken(source.id)
            // Refetch source to get new token
            const updatedSource = await db.query.energySources.findFirst({
              where: eq(energySources.id, source.id),
            })
            if (!updatedSource) continue
            source.metadata = updatedSource.metadata
          }

          const client = new EnphaseClient()
          data = await client.getSystemSummary(systemId, source.metadata.accessToken)
        } else if (provider === "solaredge") {
          const client = new SolarEdgeClient()
          data = await client.getCurrentPowerFlow(systemId, source.metadata.apiKey)
        }
        // Add more providers here

        if (data) {
          // Store measurement in database
          await db.insert(measurements).values({
            meterId: source.meterId,
            timestamp: new Date(),
            value: data.current_power || data.currentPower || 0,
            unit: "kW",
            source: "api",
            metadata: {
              provider,
              energyToday: data.energy_today || data.energyToday,
              status: data.status,
            },
          })

          results.push({ sourceId: source.id, status: "success" })
        }
      } catch (error) {
        console.error(`Error fetching data for source ${source.id}:`, error)
        results.push({ sourceId: source.id, status: "error", error: error.message })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error in cron job:", error)
    return NextResponse.json(
      { error: "Failed to fetch energy data" },
      { status: 500 }
    )
  }
}

function needsRefresh(tokenExpiry: string | undefined): boolean {
  if (!tokenExpiry) return false
  const expiryDate = new Date(tokenExpiry)
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
  return expiryDate <= fiveMinutesFromNow
}

async function refreshEnphaseToken(energySourceId: string) {
  // Call the refresh endpoint
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/enphase/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ energySourceId }),
  })

  if (!response.ok) {
    throw new Error("Failed to refresh token")
  }
}
```

---

## 5. Security Hardening

### Step 5.1: Environment Variables

**Never commit sensitive data to Git!**

Add to `.gitignore`:
```
.env
.env.local
.env.production
```

Use environment variable providers:
- **Vercel**: Use Vercel Environment Variables UI
- **AWS**: Use AWS Secrets Manager
- **Google Cloud**: Use Secret Manager
- **Azure**: Use Azure Key Vault

### Step 5.2: Encrypt Sensitive Data in Database

Install encryption library:
```bash
npm install crypto-js
```

Create `lib/encryption.ts`:
```typescript
import CryptoJS from "crypto-js"

const SECRET_KEY = process.env.ENCRYPTION_SECRET || "your-secret-key"

export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString()
}

export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}
```

Update OAuth callback to encrypt tokens:
```typescript
import { encrypt } from "@/lib/encryption"

// In callback route:
const updatedMetadata = {
  ...existingSource.metadata,
  accessToken: encrypt(tokenData.access_token),
  refreshToken: encrypt(tokenData.refresh_token),
  // ... rest
}
```

### Step 5.3: Add CSRF Protection

Already implemented via state parameter in OAuth flow.

### Step 5.4: Implement Rate Limiting

Install rate limiting library:
```bash
npm install @upstash/ratelimit @upstash/redis
```

Create `lib/rate-limit.ts`:
```typescript
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
  analytics: true,
})
```

---

## 6. Rate Limiting & Caching

### Step 6.1: Implement API Response Caching

Install Redis:
```bash
npm install redis
```

Create `lib/cache.ts`:
```typescript
import { createClient } from "redis"

const client = createClient({
  url: process.env.REDIS_URL,
})

client.connect()

export async function getCached(key: string) {
  const cached = await client.get(key)
  return cached ? JSON.parse(cached) : null
}

export async function setCache(key: string, value: any, ttl: number = 300) {
  await client.setEx(key, ttl, JSON.stringify(value))
}
```

Use in API routes:
```typescript
import { getCached, setCache } from "@/lib/cache"

// Check cache first
const cacheKey = `enphase:${systemId}:summary`
const cached = await getCached(cacheKey)
if (cached) {
  return NextResponse.json(cached)
}

// Fetch from API
const data = await fetchFromEnphase(systemId, accessToken)

// Cache for 5 minutes
await setCache(cacheKey, data, 300)
```

### Step 6.2: Respect Provider Rate Limits

| Provider | Rate Limit | Recommendation |
|----------|-----------|----------------|
| Enphase | 10 req/min | Cache for 5-15 minutes |
| SolarEdge | 300 req/day | Cache for 15-30 minutes |
| Tesla Powerwall | No official limit | Cache for 1-5 minutes |

---

## 7. Error Handling & Monitoring

### Step 7.1: Implement Error Logging

Install Sentry:
```bash
npm install @sentry/nextjs
```

Configure Sentry:
```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
})
```

Add to error handlers:
```typescript
} catch (error) {
  Sentry.captureException(error)
  console.error("Error:", error)
}
```

### Step 7.2: Add Health Check Endpoint

Create `app/api/health/route.ts`:
```typescript
export async function GET() {
  try {
    // Check database connection
    await db.query.sites.findFirst()

    // Check Redis connection
    await getCached("health-check")

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: error.message },
      { status: 500 }
    )
  }
}
```

---

## 8. Testing & Deployment

### Step 8.1: Testing Checklist

- [ ] Test OAuth flow with real Enphase credentials
- [ ] Test token refresh mechanism
- [ ] Test API key authentication for SolarEdge
- [ ] Test rate limiting
- [ ] Test error handling (invalid credentials, expired tokens)
- [ ] Test caching
- [ ] Load test with multiple concurrent requests
- [ ] Security audit (check for exposed secrets)

### Step 8.2: Deployment Checklist

**Pre-Deployment:**
- [ ] Update `ENPHASE_REDIRECT_URI` to production URL
- [ ] Set up production database
- [ ] Set up Redis for caching
- [ ] Configure environment variables in hosting platform
- [ ] Set up Sentry for error monitoring
- [ ] Set up cron job for data fetching (Vercel Cron, AWS EventBridge, etc.)

**Post-Deployment:**
- [ ] Test OAuth flow in production
- [ ] Monitor error logs
- [ ] Check API rate limits
- [ ] Verify data is being fetched correctly
- [ ] Test with real user accounts

### Step 8.3: Vercel Deployment

Add `vercel.json`:
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

Add cron secret to environment variables:
```bash
CRON_SECRET="generate-a-random-secret-here"
```

---

## 9. Monitoring & Maintenance

### Daily Tasks
- Monitor error rates in Sentry
- Check API quota usage
- Review failed data fetches

### Weekly Tasks
- Review token refresh success rates
- Check cache hit rates
- Analyze API response times

### Monthly Tasks
- Review and rotate secrets
- Update dependencies
- Review API provider documentation for changes

---

## Quick Start Production Setup

1. **Get Enphase Credentials** (1-3 business days)
   - Register at https://developer.enphase.com/
   - Create application
   - Get Client ID and Secret

2. **Update Environment Variables**
   ```bash
   ENPHASE_CLIENT_ID="real_client_id"
   ENPHASE_CLIENT_SECRET="real_client_secret"
   ENPHASE_REDIRECT_URI="https://yourdomain.com/api/oauth/enphase/callback"
   ```

3. **Replace Mock API Calls**
   - Update `app/api/test-solar-connection/route.ts`
   - Implement real Enphase API calls

4. **Set Up Cron Job**
   - Create cron endpoint
   - Schedule every 15 minutes
   - Fetch data for all connected systems

5. **Deploy to Production**
   - Deploy to Vercel/AWS/GCP
   - Configure environment variables
   - Test OAuth flow

6. **Monitor**
   - Set up Sentry
   - Monitor API quotas
   - Track error rates

---

## Support Resources

- **Enphase API Docs**: https://developer.enphase.com/docs
- **SolarEdge API Docs**: https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf
- **OAuth 2.0 Spec**: https://oauth.net/2/
- **Next.js Deployment**: https://nextjs.org/docs/deployment

---

## Cost Estimates

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Vercel Pro | $20 | For cron jobs |
| Upstash Redis | $0-10 | Free tier available |
| Sentry | $0-26 | Free tier: 5K events/month |
| **Total** | **$20-56** | Scales with usage |

For high-volume applications, consider:
- Self-hosted Redis
- AWS Lambda for cron jobs
- Self-hosted error tracking
