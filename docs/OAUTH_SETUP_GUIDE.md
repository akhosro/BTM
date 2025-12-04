# OAuth Setup Guide for Solar APIs

This guide walks you through setting up OAuth credentials for Enphase and UtilityAPI integrations.

---

## Enphase Energy OAuth Setup

### Prerequisites
- An Enphase system owner account
- Access to the Enphase Developer Portal

### Step 1: Register for Enphase Developer Account

1. Go to [Enphase Developer Portal](https://developer.enphase.com/)
2. Click **Sign Up** or **Login** if you already have an account
3. Complete the registration process
4. Verify your email address

### Step 2: Create a New Application

1. Log in to the [Enphase Developer Portal](https://developer.enphase.com/)
2. Navigate to **Applications** → **Create New Application**
3. Fill in the application details:
   - **Application Name**: `Enalysis Energy Management`
   - **Description**: `Energy management and optimization platform`
   - **Redirect URI**: `http://localhost:3000/api/oauth/enphase/callback` (for development)
   - For production, add: `https://yourdomain.com/api/oauth/enphase/callback`

### Step 3: Get Your Credentials

1. After creating the application, you'll receive:
   - **Client ID** (also called API Key)
   - **Client Secret**
2. Copy these values securely

### Step 4: Update Environment Variables

Add to your `.env` file:

```bash
# Enphase OAuth Configuration
ENPHASE_CLIENT_ID="your_client_id_here"
ENPHASE_CLIENT_SECRET="your_client_secret_here"
ENPHASE_REDIRECT_URI="http://localhost:3000/api/oauth/enphase/callback"
```

### Step 5: Request API Access Levels

Enphase has different access levels. Request access to:
- **System Summary** - Current production data
- **Energy Lifetime** - Historical energy data
- **Stats** - Detailed statistics
- **Telemetry** - Real-time telemetry (if needed)

### Enphase API Endpoints

Once authorized, you can access:

```
GET https://api.enphaseenergy.com/api/v2/systems/{system_id}/summary
GET https://api.enphaseenergy.com/api/v2/systems/{system_id}/energy_lifetime
GET https://api.enphaseenergy.com/api/v2/systems/{system_id}/stats
```

**Rate Limits:**
- 10 requests per minute per system
- 3,600 requests per hour

**Token Expiry:**
- Access tokens expire after 1 hour
- Refresh tokens expire after 6 months
- Implement automatic token refresh

---

## UtilityAPI OAuth Setup

### Prerequisites
- A UtilityAPI account
- Access to the UtilityAPI developer portal

### Step 1: Register for UtilityAPI Account

1. Go to [UtilityAPI](https://utilityapi.com/)
2. Click **Sign Up** or **Contact Sales** for API access
3. Choose the appropriate plan:
   - **Developer**: Free for testing (limited to 10 authorizations)
   - **Starter**: $99/month (100 authorizations)
   - **Professional**: Custom pricing

### Step 2: Get API Credentials

1. Log in to [UtilityAPI Dashboard](https://utilityapi.com/dashboard)
2. Navigate to **Settings** → **API Keys**
3. Click **Create New API Key**
4. Copy your API Token securely

### Step 3: Configure OAuth Application

1. In the UtilityAPI Dashboard, go to **Settings** → **OAuth**
2. Set up your application:
   - **Application Name**: `Enalysis`
   - **Redirect URI**: `http://localhost:3000/api/oauth/utilityapi/callback`
   - For production: `https://yourdomain.com/api/oauth/utilityapi/callback`
3. Note your **OAuth Client ID** and **Client Secret**

### Step 4: Update Environment Variables

Add to your `.env` file:

```bash
# UtilityAPI Configuration
UTILITYAPI_API_TOKEN="your_api_token_here"
UTILITYAPI_CLIENT_ID="your_oauth_client_id_here"
UTILITYAPI_CLIENT_SECRET="your_oauth_client_secret_here"
UTILITYAPI_REDIRECT_URI="http://localhost:3000/api/oauth/utilityapi/callback"
```

### UtilityAPI Features

**Available Data:**
- Electricity bills (historical)
- Usage data (interval data if available from utility)
- Cost breakdowns
- Demand charges
- Time-of-use rates

**Supported Utilities:**
UtilityAPI supports 60+ utilities in the US, including:
- PG&E (California)
- SCE (Southern California Edison)
- SDG&E (San Diego Gas & Electric)
- ComEd (Chicago)
- National Grid (Northeast US)
- [Full list](https://utilityapi.com/utilities)

**Rate Limits:**
- 120 requests per minute
- No daily limit

**Token Expiry:**
- Access tokens expire after 90 days
- Refresh tokens are provided for automatic renewal

---

## SolarEdge API Setup (API Key - No OAuth)

### Step 1: Access Your SolarEdge Monitoring Portal

1. Go to [SolarEdge Monitoring Portal](https://monitoring.solaredge.com/)
2. Log in with your installer or site owner credentials

### Step 2: Generate API Key

1. Navigate to **Admin** → **Site Access**
2. Click on **API Access**
3. Generate a new API key
4. Copy the API key (it will only be shown once)

### Step 3: Get Your Site ID

1. In the monitoring portal, note your **Site ID**
2. It's usually visible in the URL or on the main dashboard

### Step 4: Update Environment Variables

SolarEdge doesn't require environment variables (users provide their own API keys), but you can set a default for testing:

```bash
# SolarEdge API (Optional - for testing)
SOLAREDGE_API_KEY="your_api_key_here"
SOLAREDGE_SITE_ID="your_site_id_here"
```

**Rate Limits:**
- 300 API requests per day per site
- Daily reset at midnight UTC

---

## Tesla Powerwall Setup

### Step 1: Local Network Access

Tesla Powerwall provides a local API for real-time data. No cloud OAuth required.

1. Ensure your Powerwall is on the same network
2. Find your Powerwall IP address:
   - Check your router's DHCP client list
   - Look for device named "Tesla Energy Gateway"
   - Common IP: `192.168.91.1` or similar

### Step 2: Authentication

1. Get the Powerwall password:
   - Located on the Tesla Gateway device (sticker)
   - Format: last 5 characters of the serial number + last 5 characters of the site ID
2. Or use Tesla Cloud API (requires Tesla account OAuth)

### Step 3: Local API Endpoints

```
# Authentication
POST https://{powerwall_ip}/api/login/Basic
Body: { "username": "customer", "password": "..." }

# System Status
GET https://{powerwall_ip}/api/system_status/soe

# Power Flow
GET https://{powerwall_ip}/api/meters/aggregates

# Grid Status
GET https://{powerwall_ip}/api/system_status/grid_status
```

**Note:** Local API uses self-signed SSL certificates. You'll need to disable SSL verification for local access.

---

## Security Best Practices

### 1. Environment Variables
- ✅ Never commit `.env` files to version control
- ✅ Use different credentials for development and production
- ✅ Rotate secrets regularly (every 90 days minimum)
- ✅ Use a secrets manager in production (AWS Secrets Manager, HashiCorp Vault, etc.)

### 2. Token Storage
- ✅ Store refresh tokens encrypted in the database
- ✅ Never expose tokens in client-side code
- ✅ Implement automatic token refresh before expiry
- ✅ Revoke tokens immediately when user disconnects

### 3. OAuth Flow Security
- ✅ Use PKCE (Proof Key for Code Exchange) for enhanced security
- ✅ Validate state parameter to prevent CSRF attacks
- ✅ Use HTTPS for all redirect URIs in production
- ✅ Implement proper error handling for failed authorization

### 4. Rate Limiting
- ✅ Implement exponential backoff for failed requests
- ✅ Cache API responses when possible (e.g., 5-minute cache for power data)
- ✅ Track API usage to avoid hitting rate limits
- ✅ Notify users when approaching rate limits

---

## Testing Your Integration

### Test the OAuth Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the Data Connections page in your app

3. Click **Connect** on the Enphase provider

4. You should be redirected to Enphase login

5. Authorize the application

6. You'll be redirected back with an authorization code

7. The app will exchange the code for access/refresh tokens

8. Test data fetching

### Verify Token Refresh

1. Manually set token expiry to 1 minute in the database
2. Wait for token to expire
3. Make an API request
4. Verify automatic token refresh occurs
5. Check that new tokens are stored in database

### Monitor API Usage

Check your provider dashboards regularly:
- **Enphase**: Developer Portal → Usage
- **UtilityAPI**: Dashboard → API Usage
- **SolarEdge**: No usage dashboard (track client-side)

---

## Troubleshooting

### Common Issues

**"Invalid redirect_uri" error:**
- Ensure the redirect URI in your app matches exactly what's registered
- Check for trailing slashes
- Verify http vs https

**"Invalid client_id" error:**
- Double-check your client ID in `.env`
- Ensure no extra spaces or quotes
- Verify the client ID is for the correct environment (dev vs prod)

**Rate limit errors:**
- Implement caching to reduce API calls
- Use webhooks instead of polling (when available)
- Spread requests across time intervals

**Token refresh failures:**
- Check that refresh token hasn't expired
- Verify client secret is correct
- Ensure token storage is working properly

---

## Production Deployment Checklist

Before deploying to production:

- [ ] Replace localhost URLs with production domain
- [ ] Update redirect URIs in all provider portals
- [ ] Enable HTTPS for all OAuth callbacks
- [ ] Set up secrets manager (not `.env` file)
- [ ] Implement proper error logging
- [ ] Set up monitoring and alerting
- [ ] Test token refresh flow
- [ ] Implement rate limit handling
- [ ] Add user notification for failed connections
- [ ] Document API usage for billing purposes

---

## Support Contacts

- **Enphase Developer Support**: developer@enphaseenergy.com
- **UtilityAPI Support**: support@utilityapi.com
- **SolarEdge Support**: monitoring@solaredge.com
- **Tesla Powerwall**: No official API support (community forums)

---

## Additional Resources

- [Enphase API Documentation](https://developer.enphase.com/docs)
- [UtilityAPI Documentation](https://utilityapi.com/docs)
- [SolarEdge API Guide](https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf)
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
