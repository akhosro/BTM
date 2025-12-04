# UtilityAPI Setup Guide

## Overview

This guide explains how to connect your utility company account to the Enalysis platform using UtilityAPI's Green Button Connect OAuth integration. This enables automatic retrieval of your electricity consumption data, bills, and interval usage.

## What You'll Need

1. **Utility Account** with one of the supported utilities
2. **Utility Login Credentials** (username and password for your utility account)
3. **UtilityAPI OAuth Registration** (platform owner must register once)

## Understanding UtilityAPI Integration

### Authentication Method: Green Button Connect OAuth

UtilityAPI uses **Green Button Connect**, a standardized OAuth 2.0 flow that allows you to securely authorize third-party applications to access your utility data.

- Your credentials are sent **directly to your utility company** (not to Enalysis or UtilityAPI)
- You receive an **OAuth access token** that grants Enalysis access to your consumption data
- Tokens automatically refresh to maintain continuous access
- You can revoke access at any time through your utility account

### What Data We Collect

- **Interval Usage**: 15-minute or hourly electricity consumption (kWh)
- **Bills**: Monthly bills with cost, usage, line items, and tariff details
- **Meter Information**: Service address, meter numbers, utility account details
- **Consumption Summary**: Daily, weekly, and monthly energy usage

## Supported Utilities

UtilityAPI currently supports Green Button Connect OAuth for the following utilities:

### California
- **PG&E** (Pacific Gas & Electric)
- **SCE** (Southern California Edison)
- **SDG&E** (San Diego Gas & Electric)

### Northeast
- **National Grid** (NY, MA)
- **Eversource** (CT, MA, NH)

### Midwest
- **Commonwealth Edison** (ComEd - Illinois)
- **Consumers Energy** (Michigan)

### Other
- **Duke Energy** (Multiple states)

**Note**: UtilityAPI is continuously adding support for more utilities. Check https://utilityapi.com/utilities for the latest list.

## Step-by-Step Setup

### Step 1: Select Your Utility

1. **Navigate to Data Connections**
   - Log into your Enalysis account
   - Go to Settings → Data Connections
   - Select the meter you want to connect (must be a consumption/CONS meter)

2. **Choose UtilityAPI**
   - Set data source type to "API Connection"
   - Choose "UtilityAPI" from the provider dropdown

3. **Select Your Utility**
   - From the "Your Utility Company" dropdown, select your utility
   - Make sure you select the correct utility for your service address

### Step 2: Authorize Access

1. **Initiate OAuth Flow**
   - Click "Connect to [YOUR UTILITY]" button
   - You'll be redirected to your utility's login page

2. **Log Into Your Utility Account**
   - Enter your utility account username and password
   - This is the same login you use on your utility's website
   - **Your credentials are NOT shared with Enalysis or UtilityAPI**

3. **Review and Authorize**
   - You'll see a screen showing what data Enalysis is requesting
   - Typical permissions:
     - Read your meter data
     - Read your billing information
     - Read your usage intervals
   - Click "Authorize" or "Allow" to grant access

4. **Return to Enalysis**
   - You'll be redirected back to Enalysis
   - The connection status will show "Utility Connected"
   - Your utility name and service address will be displayed

### Step 3: Test Connection

1. **Verify Data Access**
   - Click "Test Connection" to verify the integration
   - You should see:
     - Today's energy consumption (kWh)
     - Latest bill information (cost, usage, period)
     - Connection status: "Online"

2. **Review Data**
   - Check that the service address matches your location
   - Verify the consumption data looks correct
   - Review the latest bill details

### Step 4: Save

- Click "Save" to finalize the connection
- Data will be automatically fetched every 15 minutes
- Historical data will be imported on first connection

## Platform Owner Setup (One-Time)

If you are the **platform owner** setting up UtilityAPI for your Enalysis instance, follow these steps:

### 1. Register with UtilityAPI

1. Go to https://utilityapi.com/
2. Sign up for a developer account
3. Wait for email verification (1-2 business days to move from sandbox to live mode)

### 2. Register OAuth Applications

**IMPORTANT**: You need to register separately with EACH utility you want to support.

For each utility:
1. Log into UtilityAPI dashboard
2. Navigate to OAuth settings for that specific utility
3. Register your application:
   ```
   Application Name: Enalysis Energy Management
   Redirect URI: https://yourdomain.com/api/oauth/utilityapi/callback
   Scopes: Read meter data, billing, and intervals
   ```
4. Save your `client_id` and `client_secret` for that utility
5. Note the OAuth endpoints provided (authorize and token endpoints)

### 3. Configure Environment Variables

Add the following to your `.env.production`:

```bash
# UtilityAPI API Token (for accessing UtilityAPI REST API)
UTILITYAPI_API_TOKEN="your_utilityapi_api_token"

# UtilityAPI OAuth Redirect URI
UTILITYAPI_REDIRECT_URI="https://yourdomain.com/api/oauth/utilityapi/callback"

# PG&E OAuth Configuration
UTILITYAPI_CLIENT_ID_PGE="your_pge_client_id"
UTILITYAPI_CLIENT_SECRET_PGE="your_pge_client_secret"
UTILITYAPI_OAUTH_AUTHORIZE_ENDPOINT_PGE="https://pge.oauth.endpoint/authorize"
UTILITYAPI_OAUTH_TOKEN_ENDPOINT_PGE="https://pge.oauth.endpoint/token"

# SCE OAuth Configuration
UTILITYAPI_CLIENT_ID_SCE="your_sce_client_id"
UTILITYAPI_CLIENT_SECRET_SCE="your_sce_client_secret"
UTILITYAPI_OAUTH_AUTHORIZE_ENDPOINT_SCE="https://sce.oauth.endpoint/authorize"
UTILITYAPI_OAUTH_TOKEN_ENDPOINT_SCE="https://sce.oauth.endpoint/token"

# Repeat for each utility you support...
```

**Pattern**: `UTILITYAPI_CLIENT_ID_{UTILITY}` where `{UTILITY}` is the uppercase utility code (PGE, SCE, SDGE, etc.)

### 4. Deploy

Deploy your updated environment variables and restart your application.

## Data Fetching

### How Often Is Data Fetched?

- **Test Connection**: On-demand when you click "Test"
- **Automated Fetching**: Every 15 minutes (once connected)
- **Interval Data**: Updated as soon as utility posts new data (typically 24-48 hours delay)
- **Bills**: Updated monthly when new bill is issued

### What Happens When Data Is Unavailable?

- **Utility Maintenance**: Data fetching will fail gracefully and retry
- **Token Expiration**: Tokens automatically refresh before expiry (default: 1 hour)
- **Authorization Revoked**: Error message will appear in dashboard
- **Network Issues**: Automatic retry with exponential backoff

## Security & Privacy

### Local vs. Cloud Authentication

- **OAuth Flow**: Your utility credentials are sent directly to your utility (not stored by Enalysis)
- **Token Storage**: Only OAuth access/refresh tokens are stored (encrypted in database)
- **HTTPS**: All communication uses TLS encryption
- **Token Refresh**: Automatic before expiration

### Data Privacy

- **Your Data**: Only YOU can access your consumption data in Enalysis
- **Multi-Tenant**: Each user's tokens are stored separately (no data sharing)
- **Utility Access**: Your utility company can see that you authorized Enalysis
- **Revocation**: You can revoke access anytime through your utility account

### Revoking Access

To revoke Enalysis access to your utility data:

1. **In Enalysis**: Click "Disconnect" on your UtilityAPI connection
2. **At Your Utility** (optional, to invalidate token):
   - Log into your utility account online
   - Navigate to "Third-Party Access" or "Authorized Applications"
   - Find "Enalysis" and click "Revoke"

## Troubleshooting

### Error: "OAuth configuration not set up for [utility]"

**Cause**: Platform owner hasn't registered OAuth credentials for this utility

**Solution**:
- Platform owner: Follow "Platform Owner Setup" section above
- User: Contact platform administrator or choose a different utility

### Error: "Missing OAuth credentials. Please connect your utility account."

**Cause**: Haven't completed OAuth flow yet

**Solution**: Click "Connect to [UTILITY]" and complete authorization

### Error: "Access token expired or expiring soon"

**Cause**: Token needs to be refreshed

**Solution**:
1. Disconnect the utility connection
2. Reconnect by clicking "Connect to [UTILITY]"
3. Complete OAuth flow again

### Error: "Utility meter not found. Please reconnect"

**Cause**: Meter information wasn't properly saved during OAuth callback

**Solution**:
1. Disconnect and reconnect
2. If problem persists, check UtilityAPI API token is configured correctly

### Connection Test Shows "0 kWh" Today

**Possible Reasons**:
- It's early in the day and no consumption has been recorded yet
- Utility hasn't posted today's data yet (utilities have 24-48 hour delay)
- Your meter may not be providing interval data

**Solution**: Wait 24-48 hours and check again. View "Latest Bill" section instead.

### Utility Login Failed

**Possible Reasons**:
- Incorrect username or password
- Utility account is locked or suspended
- Utility website is down for maintenance

**Solutions**:
1. Verify you can log into your utility's website directly
2. Reset your utility password if needed
3. Contact utility customer support if account is locked
4. Try again later if utility is in maintenance

### Wrong Service Address Displayed

**Cause**: You may have multiple service addresses on your utility account

**Solution**:
1. Disconnect and reconnect
2. During OAuth flow, carefully select the correct service address
3. If only one address is available, contact utility support

## Green Button Data Format

UtilityAPI uses the **Green Button** standard (ESPI - Energy Services Provider Interface).

### Interval Data
- **Time Resolution**: 15-minute or hourly intervals (depends on utility)
- **Data Points**: Each interval shows kWh consumed during that period
- **Typical Delay**: 24-48 hours from actual consumption

### Bill Data
- **Billing Period**: Start and end dates
- **Total Cost**: Charges in dollars
- **Total Usage**: kWh consumed during billing period
- **Line Items**: Individual charges (energy, delivery, taxes, etc.)
- **Tariff**: Rate plan information

## Rate Limits

### UtilityAPI API Limits
- **Default**: 100 requests per minute
- **Burst**: 500 requests per hour
- **Exceeded**: Automatic retry with exponential backoff

### Utility-Specific Limits
- Each utility sets its own rate limits for Green Button OAuth
- Typical: 10-100 requests per hour
- Our system respects these limits automatically

## Cost Implications

### Platform Owner Costs
- **UtilityAPI Subscription**: ~$200-500/month depending on number of users
- **Per-Authorization Fee**: $0-10/month per connected utility account
- **Data Storage**: Minimal (UtilityAPI hosts the data)

### User Costs
- **FREE**: Users don't pay anything to connect their utility account
- **Utility Bills**: Normal electricity bills apply (not affected by Enalysis)

## Data Accuracy

### Why Is My Data Different from Utility Website?

**Possible Reasons**:
1. **Timing**: Enalysis may have more recent data (or vice versa)
2. **Aggregation**: We aggregate intervals differently (daily vs. billing period)
3. **Units**: Ensure comparing kWh to kWh (not kW power to kWh energy)
4. **Time Zone**: Data may be in different time zones

### Typical Accuracy
- **Energy Consumption**: ±1% (utility meter accuracy)
- **Cost**: Exact match with utility bill
- **Timing**: Within 24-48 hours of actual consumption

## Production vs. Development

### Development Mode
- Uses UtilityAPI sandbox mode
- Connect test accounts only
- No real utility data
- Requires email verification to upgrade to live mode

### Production Mode
- Requires UtilityAPI account verification
- Access real utility data
- Must register OAuth apps with each utility
- 1-3 day approval process per utility

## Advanced Features

### Webhook Support

UtilityAPI can send webhooks when new data is available:

**Configuration** (platform owner):
1. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/utilityapi`
2. Configure in UtilityAPI dashboard
3. Receive real-time notifications for new bills and intervals

### Historical Data Import

On first connection, UtilityAPI can import:
- **Bills**: Last 12-24 months
- **Intervals**: Last 13 months (Green Button Connect standard)
- **Automatic**: Happens in background after OAuth authorization

### Multiple Service Addresses

If you have multiple service addresses with the same utility:
1. Each address needs a separate meter in Enalysis
2. Connect each meter separately through OAuth
3. Each gets its own authorization and tokens

## Support Resources

- **UtilityAPI Docs**: https://utilityapi.com/docs
- **Green Button Standard**: https://www.greenbuttondata.org/
- **Supported Utilities**: https://utilityapi.com/utilities
- **API Status**: https://status.utilityapi.com/

## FAQs

### Q: Do I need a UtilityAPI account as a user?
**A:** No! Only the platform owner needs a UtilityAPI account. Users just use their normal utility credentials.

### Q: Can utilities see what I'm doing in Enalysis?
**A:** No. Utilities only see that you authorized "Enalysis" to access your data. They can't see your analysis, reports, or recommendations.

### Q: What if my utility isn't supported?
**A:** Check https://utilityapi.com/utilities for the latest list. If not supported, you can:
- Use CSV upload for manual data entry
- Wait for utility to be added
- Contact UtilityAPI to request support

### Q: Can I connect multiple utility accounts?
**A:** Yes! Create separate meters for each utility account and connect each one.

### Q: What happens if I move to a new address?
**A:** Disconnect the old meter and connect a new one with your new utility account.

### Q: How long does historical data import take?
**A:** Typically 5-30 minutes depending on how much data is available.

### Q: Is real-time data available?
**A:** No. Utilities typically have a 24-48 hour delay for interval data. Bills are posted monthly.

### Q: Can I see my neighbor's data?
**A:** Absolutely not. You can only access data for utility accounts YOU own and authorize.

---

## Quick Reference

| What | Where to Find |
|------|---------------|
| **Utility Login** | Your utility company's website |
| **Service Address** | Your utility bill or account page |
| **Supported Utilities** | Enalysis dropdown or https://utilityapi.com/utilities |
| **Revoke Access** | Your utility's "Third-Party Apps" settings |
| **Latest Bill** | Shown after connecting and testing |
| **Interval Data** | Available in dashboard after 24-48 hours |

## Next Steps

1. **Connect Your Utility**: Follow Step-by-Step Setup above
2. **Verify Data**: Check dashboard for consumption metrics
3. **Explore Analytics**: View trends and optimization recommendations
4. **Set Up Alerts**: Configure notifications for unusual consumption

---

**Need Help?** Contact support or check the troubleshooting section above.
