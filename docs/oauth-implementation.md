# OAuth 2.0 Implementation for Enphase API Integration

## Overview

This document describes the OAuth 2.0 authentication flow implemented for Enphase solar and battery system integrations in the Enalysis MVP application.

## Architecture

### Components

1. **Data Connections Modal** ([components/data-connections-modal.tsx](components/data-connections-modal.tsx))
   - UI for initiating OAuth flow
   - Displays OAuth connection status
   - Shows token expiry information
   - Provides disconnect functionality

2. **OAuth Authorization Route** ([app/api/oauth/enphase/authorize/route.ts](app/api/oauth/enphase/authorize/route.ts))
   - Initiates OAuth flow
   - Generates CSRF protection state
   - Redirects to Enphase authorization page

3. **OAuth Callback Route** ([app/api/oauth/enphase/callback/route.ts](app/api/oauth/enphase/callback/route.ts))
   - Handles OAuth callback from Enphase
   - Exchanges authorization code for tokens
   - Stores tokens in database
   - Validates CSRF state

4. **Token Refresh Route** ([app/api/oauth/enphase/refresh/route.ts](app/api/oauth/enphase/refresh/route.ts))
   - Refreshes expired access tokens
   - Uses refresh token to obtain new access token
   - Updates database with new tokens

5. **Test Connection Route** ([app/api/test-solar-connection/route.ts](app/api/test-solar-connection/route.ts))
   - Tests API connections
   - Handles both OAuth (Enphase) and API key (SolarEdge, etc.) providers
   - Checks token expiry before testing

## OAuth Flow

### 1. User Initiates Connection

```typescript
// User clicks "Connect to Enphase" button in data connections modal
const initiateOAuthFlow = async (provider: string) => {
  // Save energy source to database first
  const response = await fetch("/api/energy-sources", {
    method: "POST",
    body: JSON.stringify({ sources: [energySource] }),
  })

  // Redirect to OAuth authorization endpoint
  window.location.href = `/api/oauth/${provider}/authorize?meterId=${meterId}&energySourceId=${energySourceId}`
}
```

### 2. Authorization Request

**Endpoint:** `GET /api/oauth/enphase/authorize`

**Parameters:**
- `meterId`: The meter to associate with this connection
- `energySourceId`: The energy source ID to store tokens

**Process:**
1. Generates random state parameter for CSRF protection
2. Stores state, meterId, and energySourceId in a secure cookie
3. Redirects to Enphase authorization URL:
   ```
   https://api.enphaseenergy.com/oauth/authorize?
     response_type=code&
     client_id={ENPHASE_CLIENT_ID}&
     redirect_uri={ENPHASE_REDIRECT_URI}&
     state={random_state}
   ```

### 3. User Authorizes on Enphase

User logs into their Enphase account and grants permission to access their system data.

### 4. OAuth Callback

**Endpoint:** `GET /api/oauth/enphase/callback`

**Parameters:**
- `code`: Authorization code from Enphase
- `state`: State parameter for CSRF validation

**Process:**
1. Validates state parameter against cookie
2. Exchanges authorization code for tokens via POST to Enphase:
   ```
   POST https://api.enphaseenergy.com/oauth/token
   Body: grant_type=authorization_code&code={code}&...
   ```
3. Receives access token, refresh token, and expiry time
4. Updates energy source in database with tokens:
   ```typescript
   metadata: {
     accessToken: "...",
     refreshToken: "...",
     tokenExpiry: "2025-11-10T12:00:00.000Z",
     tokenType: "Bearer",
     dataSourceType: "api",
     connectionStatus: "success"
   }
   ```
5. Redirects to `/settings?tab=data-connections&oauth_success=true`

### 5. Token Refresh

**Endpoint:** `POST /api/oauth/enphase/refresh`

**Request Body:**
```json
{
  "energySourceId": "uuid"
}
```

**Process:**
1. Retrieves energy source from database
2. Uses refresh token to obtain new access token:
   ```
   POST https://api.enphaseenergy.com/oauth/token
   Body: grant_type=refresh_token&refresh_token={token}&...
   ```
3. Updates database with new tokens
4. If refresh fails, marks connection as failed and requires re-authentication

**When to Refresh:**
- Before making API calls if token expires in < 5 minutes
- When API returns 401 Unauthorized
- Proactively via scheduled job (recommended)

## Database Schema

### Energy Source Metadata

OAuth tokens are stored in the `metadata` JSONB column of the `energy_sources` table:

```typescript
metadata: {
  // OAuth fields (Enphase)
  accessToken?: string           // Bearer token for API calls
  refreshToken?: string          // Token for refreshing access token
  tokenExpiry?: string           // ISO timestamp of token expiration
  tokenType?: string             // Usually "Bearer"

  // API Key fields (SolarEdge, Fronius, etc.)
  apiKey?: string                // API key for authentication

  // Common fields
  apiProvider: string            // "enphase", "solaredge", etc.
  systemId: string               // System/Site ID from provider
  siteId?: string                // Site ID (for some providers)
  dataSourceType: string         // "api", "manual", "calculated"
  connectionStatus?: string      // "success", "failed", "not_tested"
  lastConnectionTest?: string    // ISO timestamp
  lastConnectionError?: string   // Error message if failed
}
```

## Environment Variables

Required environment variables in `.env`:

```bash
# Enphase OAuth Configuration
ENPHASE_CLIENT_ID="your_client_id"
ENPHASE_CLIENT_SECRET="your_client_secret"
ENPHASE_REDIRECT_URI="http://localhost:3000/api/oauth/enphase/callback"
```

### Obtaining Enphase Credentials

1. Register as an Enphase developer: https://developer.enphase.com/
2. Create a new application
3. Configure redirect URI: `http://localhost:3000/api/oauth/enphase/callback` (development) or `https://yourdomain.com/api/oauth/enphase/callback` (production)
4. Copy Client ID and Client Secret to `.env`

## Security Considerations

### CSRF Protection

- State parameter is randomly generated (32 bytes)
- Stored in httpOnly, secure cookie
- Validated on callback
- Cookie expires in 10 minutes

### Token Storage

- Tokens stored in database, not browser
- Transmitted over HTTPS only in production
- Refresh tokens allow long-term access without storing passwords

### Cookie Configuration

```typescript
response.cookies.set("enphase_oauth_state", stateData, {
  httpOnly: true,                              // Not accessible via JavaScript
  secure: process.env.NODE_ENV === "production", // HTTPS only in production
  sameSite: "lax",                            // CSRF protection
  maxAge: 600,                                // 10 minutes
  path: "/",
})
```

## UI Components

### Connection Status Display

The modal shows different UI based on connection state:

**OAuth Connected:**
```tsx
<div className="bg-green-50">
  <CheckCircle2 /> OAuth Connected
  Token expires: {tokenExpiry}
  <Button>Disconnect</Button>
</div>
```

**Not Connected:**
```tsx
<div className="bg-blue-50">
  <p>Enphase requires OAuth 2.0 authentication</p>
  <Button onClick={initiateOAuthFlow}>
    Connect to Enphase
  </Button>
</div>
```

### Provider Detection

```typescript
const isOAuthProvider =
  apiProvider === "enphase" ||
  apiProvider === "enphase_battery"
```

## API Provider Support

### OAuth Providers
- Enphase Solar (`enphase`)
- Enphase Battery (`enphase_battery`)

### API Key Providers
- SolarEdge (`solaredge`)
- Fronius (`fronius`)
- SMA (`sma`)
- Huawei (`huawei`)
- Growatt (`growatt`)
- Tesla Powerwall (`tesla_powerwall`)

## Testing

### Manual Testing Checklist

1. **Initial Connection**
   - [ ] Click "Connect to Enphase" button
   - [ ] Redirected to Enphase login
   - [ ] After authorization, redirected back with success message
   - [ ] Token stored in database
   - [ ] UI shows "OAuth Connected" with expiry time

2. **Connection Status**
   - [ ] Settings page shows "API Connected" badge
   - [ ] Token expiry displayed correctly
   - [ ] Can disconnect and reconnect

3. **Token Refresh**
   - [ ] Call refresh endpoint before token expires
   - [ ] New token stored in database
   - [ ] Connection remains active

4. **Error Handling**
   - [ ] Invalid state parameter shows error
   - [ ] Expired refresh token prompts re-authentication
   - [ ] Network errors handled gracefully

### Testing Without Real Credentials

For development without Enphase credentials, the test-connection endpoint returns mock data:

```typescript
// Still validates OAuth fields are present
// Returns mock power generation data
{
  success: true,
  currentPower: 98.3,
  energyToday: 380.7,
  status: "online"
}
```

## Error Handling

### OAuth Errors

All OAuth errors redirect to: `/settings?tab=data-connections&oauth_error={error_type}`

**Error Types:**
- `missing_params` - Missing code or state parameter
- `invalid_state` - State cookie not found
- `state_mismatch` - State parameter doesn't match cookie
- `config_missing` - Missing environment variables
- `token_exchange_failed` - Failed to exchange code for token
- `source_not_found` - Energy source not found in database
- `server_error` - Unexpected server error

### API Call Errors

```typescript
// Token expired or expiring soon
if (tokenExpiry <= fiveMinutesFromNow) {
  return { error: "Access token expired. Please refresh." }
}

// Refresh token invalid
if (!refreshTokenValid) {
  // Mark connection as failed
  metadata.connectionStatus = "failed"
  metadata.lastConnectionError = "Refresh token expired. Please re-authenticate."
}
```

## Future Enhancements

1. **Automatic Token Refresh**
   - Scheduled job to refresh tokens before expiry
   - Background process to check all OAuth connections

2. **Webhook Support**
   - Register webhooks with Enphase for real-time updates
   - Reduce API polling frequency

3. **Multi-System Support**
   - Allow users to connect multiple Enphase systems
   - Aggregate data across systems

4. **Rate Limiting**
   - Implement rate limiting to stay within API quotas
   - Queue and batch API requests

5. **Enhanced Error Recovery**
   - Automatic retry with exponential backoff
   - User notifications for failed connections

## Troubleshooting

### Common Issues

**Issue:** "OAuth configuration not set up"
- **Solution:** Ensure `ENPHASE_CLIENT_ID`, `ENPHASE_CLIENT_SECRET`, and `ENPHASE_REDIRECT_URI` are set in `.env`

**Issue:** "State mismatch" error
- **Solution:** Ensure cookies are enabled, check for cookie conflicts, verify redirect URI matches exactly

**Issue:** Token refresh fails
- **Solution:** Re-authenticate by clicking "Connect to Enphase" again

**Issue:** Redirect URI mismatch
- **Solution:** Ensure the redirect URI in Enphase developer portal matches `ENPHASE_REDIRECT_URI` in `.env` exactly

## References

- [Enphase API Documentation](https://developer.enphase.com/docs)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
