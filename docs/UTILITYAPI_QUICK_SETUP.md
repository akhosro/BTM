# UtilityAPI Quick Setup Guide

## Your Current Setup

Based on your authorization link:
```
https://utilityapi.com/authorize/arman_enalysis?f=3c900826-2a19-4ac5-a9c0-d1e2107f21bb
```

- **Account**: `arman_enalysis`
- **Form ID**: `3c900826-2a19-4ac5-a9c0-d1e2107f21bb`

## Step 1: Get Your API Token

1. Log in to [UtilityAPI Dashboard](https://utilityapi.com/dashboard)
2. Go to **Settings** → **API Keys**
3. Copy your **API Token** (starts with `token_`)

## Step 2: Get Your API Token

**Where to Find It:**
1. Log into [UtilityAPI Dashboard](https://utilityapi.com/dashboard)
2. Look for one of these sections:
   - **API Keys** tab
   - **Tokens** section
   - **Settings** → **API Access**
   - It might be visible right on the main dashboard
3. Copy the token (format: `token_xxxxxxxxxxxxxxx`)

**If you can't find it:**
- Email support@utilityapi.com and ask: "Where can I find my API token?"
- Or look for a "Show API Key" or "Reveal Token" button

## Step 3: Update .env File

Simply add your API token to `.env`:

```bash
# UtilityAPI API Token (for backend API calls)
UTILITYAPI_API_TOKEN="token_paste_your_token_here"
```

**That's it!** UtilityAPI uses "authorization forms" instead of traditional OAuth apps, so the authorization link you already have (`https://utilityapi.com/authorize/arman_enalysis?f=3c900826...`) handles everything automatically.

## ~~Step 4: Register Your Redirect URI~~ (NOT NEEDED)

**Update:** UtilityAPI authorization forms don't require redirect URI registration. The form handles the entire flow, and users are automatically redirected back to your app after authorizing their utility account.

The redirect happens automatically through the form configuration

## Step 5: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. In your app, navigate to **Data Connections**

3. Click **Connect** on the UtilityAPI provider

4. Select your utility (e.g., PG&E)

5. You'll be redirected to authorize

6. Log in to your utility account

7. Authorize access

8. You'll be redirected back to your app with the connection established

## Understanding the OAuth Flow

```
┌─────────────┐
│   Your App  │
│ (Enalysis)  │
└──────┬──────┘
       │ 1. User clicks "Connect UtilityAPI"
       │
       ▼
┌─────────────────────────────────────┐
│ /api/oauth/utilityapi/authorize     │
│ - Generates state token             │
│ - Stores state in cookie            │
│ - Redirects to UtilityAPI           │
└──────┬──────────────────────────────┘
       │
       │ 2. Redirect to UtilityAPI
       ▼
┌─────────────────────────────────────┐
│  UtilityAPI Authorization Page      │
│  https://utilityapi.com/authorize   │
└──────┬──────────────────────────────┘
       │
       │ 3. User logs in to utility
       │    User authorizes access
       ▼
┌─────────────────────────────────────┐
│ Redirect back to callback           │
│ /api/oauth/utilityapi/callback      │
│ ?code=xxx&state=yyy                 │
└──────┬──────────────────────────────┘
       │
       │ 4. Verify state
       │ 5. Exchange code for token
       ▼
┌─────────────────────────────────────┐
│ POST https://utilityapi.com/api/    │
│ /v2/authorizations                  │
│ - Get access token                  │
│ - Get refresh token                 │
└──────┬──────────────────────────────┘
       │
       │ 6. Store tokens in database
       ▼
┌─────────────────────────────────────┐
│ energy_sources.metadata             │
│ {                                   │
│   "accessToken": "...",             │
│   "refreshToken": "...",            │
│   "tokenExpiry": "..."              │
│ }                                   │
└─────────────────────────────────────┘
```

## Supported Utilities

UtilityAPI supports 60+ utilities. Common ones include:

### California
- **PG&E** (Pacific Gas & Electric) - Code: `pge`
- **SCE** (Southern California Edison) - Code: `sce`
- **SDGE** (San Diego Gas & Electric) - Code: `sdge`

### Other Major Utilities
- **ComEd** (Illinois) - Code: `comed`
- **National Grid** (NY/MA) - Code: `national_grid`
- **Duke Energy** (Southeast) - Code: `duke`
- **FPL** (Florida Power & Light) - Code: `fpl`

[Full list of supported utilities](https://utilityapi.com/utilities)

## Data You Can Access

Once authorized, you can fetch:

1. **Bills** - Historical electricity bills with costs
2. **Interval Data** - 15-minute or hourly usage data (if available)
3. **Rate Information** - Current utility rates
4. **Account Information** - Meter numbers, service address

## API Rate Limits

- **120 requests per minute** per API token
- No daily limit
- Refresh tokens every 90 days

## Troubleshooting

### "Invalid redirect_uri" Error

- Ensure your redirect URI in `.env` matches exactly what's registered in UtilityAPI dashboard
- Check for trailing slashes
- Verify http vs https

### "Invalid client_id" Error

- Double-check the `UTILITYAPI_CLIENT_ID_XXX` in `.env`
- Ensure it matches the form ID from your authorization link
- Verify you're using the correct utility code

### "State mismatch" Error

- Check that cookies are enabled
- Clear browser cookies and try again
- Ensure `UTILITYAPI_REDIRECT_URI` is correct

### No Data Returned

- Utility might not provide interval data (some only provide monthly bills)
- Check if authorization succeeded in UtilityAPI dashboard
- Verify account has historical data available

## Testing Without Real Utility Account

For development/testing, you can:

1. Use UtilityAPI's test utility credentials (contact support for test accounts)
2. Mock the OAuth flow (already implemented in your app for demo purposes)
3. Use the mock data endpoint for testing UI

## Production Checklist

Before deploying:

- [ ] Replace `http://localhost:3000` with production domain in `.env`
- [ ] Update redirect URI in UtilityAPI dashboard
- [ ] Ensure HTTPS is enabled
- [ ] Set up token refresh automation
- [ ] Implement error handling for expired tokens
- [ ] Add user notifications for failed connections
- [ ] Test with at least 2-3 different utilities
- [ ] Monitor API usage in UtilityAPI dashboard

## Getting Help

- **UtilityAPI Docs**: https://utilityapi.com/docs
- **Support Email**: support@utilityapi.com
- **Status Page**: https://status.utilityapi.com/

## Next Steps

1. ✅ Configure `.env` with your credentials (above)
2. ✅ Register redirect URI in UtilityAPI dashboard
3. ✅ Test OAuth flow with your own utility account
4. ✅ Verify data is fetched correctly
5. ✅ Set up automatic token refresh (already implemented)
