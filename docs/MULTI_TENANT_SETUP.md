# Multi-Tenant OAuth Setup Guide

## Understanding the Architecture

Your Enalysis platform is a **multi-tenant SaaS application**. This means:

- **You (Enalysis)**: Register ONE OAuth application with Enphase
- **Your Users**: Each connects their own Enphase account to your app
- **The Flow**: Users authorize your app to access their solar data

## Key Concept

```
┌─────────────────────────────────────────────────────────────┐
│  YOU (Platform Owner)                                       │
│  • Register ONE app with Enphase                            │
│  • Get ONE Client ID/Secret                                 │
│  • Store in YOUR .env file                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Your app uses these credentials
                          │ to facilitate OAuth for ALL users
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  USER 1 (Building Manager A)                                │
│  • Clicks "Connect to Enphase" in your app                  │
│  • Logs in with THEIR Enphase credentials                   │
│  • Authorizes YOUR app to access THEIR data                 │
│  • Gets unique access token stored in YOUR database         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  USER 2 (Building Manager B)                                │
│  • Clicks "Connect to Enphase" in your app                  │
│  • Logs in with THEIR Enphase credentials                   │
│  • Authorizes YOUR app to access THEIR data                 │
│  • Gets unique access token stored in YOUR database         │
└─────────────────────────────────────────────────────────────┘

... and so on for each user
```

## What You (Platform Owner) Do ONCE

### Step 1: Register Your Application (One Time)

1. Go to https://developer.enphase.com/
2. Register YOUR company/platform
3. Create ONE application:
   ```
   Application Name: Enalysis Energy Management Platform
   Company: [Your Company]
   Type: Web Application
   Redirect URI: https://yourdomain.com/api/oauth/enphase/callback
   Scopes: read_data, read_system
   Description: Multi-site energy management and optimization platform
   ```

4. Wait for approval (1-3 business days)

### Step 2: Configure Your Environment (One Time)

Add to your `.env` (production):
```bash
# These are YOUR platform's credentials
# Used for ALL users' OAuth flows
ENPHASE_CLIENT_ID="your_platform_client_id"
ENPHASE_CLIENT_SECRET="your_platform_client_secret"
ENPHASE_REDIRECT_URI="https://yourdomain.com/api/oauth/enphase/callback"
```

### Step 3: Deploy (One Time)

Deploy your app with these environment variables set.

**That's it!** You're done. You never touch this again.

## What Each User Does

### User's Perspective:

1. User logs into YOUR app (Enalysis)
2. User goes to Settings → Data Connections
3. User selects their "Rooftop Solar" meter
4. User clicks "Connect to Enphase"
5. User is redirected to **Enphase's website**
6. User logs in with **their own Enphase credentials**
7. User clicks "Authorize" to let your app access their data
8. User is redirected back to your app
9. **Done!** Their access token is stored in your database

### What Gets Stored (Per User):

```sql
-- In energy_sources table
{
  "id": "uuid-1",
  "meterId": "user1-meter-solar",
  "metadata": {
    "apiProvider": "enphase",
    "systemId": "123456",  -- User 1's system ID
    "accessToken": "token_abc...",  -- User 1's access token
    "refreshToken": "refresh_xyz...",  -- User 1's refresh token
    "tokenExpiry": "2025-11-10T..."
  }
}

{
  "id": "uuid-2",
  "meterId": "user2-meter-solar",
  "metadata": {
    "apiProvider": "enphase",
    "systemId": "789012",  -- User 2's system ID (different!)
    "accessToken": "token_def...",  -- User 2's access token (different!)
    "refreshToken": "refresh_uvw...",
    "tokenExpiry": "2025-11-10T..."
  }
}
```

## The OAuth Flow (Per User)

```
User clicks "Connect to Enphase"
       ↓
Your app saves energy source
       ↓
Your app redirects to: /api/oauth/enphase/authorize
       ↓
Your backend creates authorization URL using YOUR credentials:
  https://api.enphaseenergy.com/oauth/authorize?
    client_id=YOUR_CLIENT_ID&
    redirect_uri=YOUR_REDIRECT_URI&
    state=random_csrf_token
       ↓
User sees Enphase login page
       ↓
User enters THEIR Enphase username/password
       ↓
User clicks "Authorize Enalysis to access my data"
       ↓
Enphase redirects back to YOUR app:
  https://yourdomain.com/api/oauth/enphase/callback?
    code=auth_code_123&
    state=csrf_token
       ↓
Your backend exchanges code for tokens using YOUR credentials:
  POST https://api.enphaseenergy.com/oauth/token
  Body: {
    grant_type: "authorization_code",
    code: "auth_code_123",
    client_id: YOUR_CLIENT_ID,
    client_secret: YOUR_CLIENT_SECRET,
    redirect_uri: YOUR_REDIRECT_URI
  }
       ↓
Enphase returns USER'S access token & refresh token
       ↓
Your backend stores USER'S tokens in database
       ↓
Done! You can now fetch data for THIS user's system
```

## Fetching Data for Each User

When fetching data, you use:
- **YOUR** Client ID/Secret to refresh tokens
- **THEIR** access token to fetch data
- **THEIR** system ID to identify their system

Example:
```typescript
// Fetching data for User 1
const user1Token = "token_abc..."  // From database
const user1SystemId = "123456"     // From database

const data = await fetch(
  `https://api.enphaseenergy.com/api/v2/systems/${user1SystemId}/summary`,
  {
    headers: {
      Authorization: `Bearer ${user1Token}`  // User 1's token
    }
  }
)
```

## Common Questions

### Q: Does each user need their own Enphase developer account?
**A: No!** Only you (the platform owner) need one developer account.

### Q: Do users need to register anything with Enphase?
**A: No!** They just need their regular Enphase account (the one they use to view their solar data).

### Q: Can users revoke access?
**A: Yes!** Users can revoke your app's access from their Enphase account settings. When they do, the tokens will stop working.

### Q: What if a user has multiple Enphase systems?
**A: Each system gets a separate connection.** They'll connect each system separately in your UI.

### Q: How do I test this without real users?
**A: Two ways:**
1. Use your own Enphase account (if you have one) for testing
2. Use the mock mode (already implemented) for demo purposes

### Q: Do I need to pay Enphase for API access?
**A: Usually no** for standard monitoring API access. Check Enphase's developer terms.

### Q: What about SolarEdge, Tesla, etc.?
**A: Same concept!**
- SolarEdge: Users enter their own API keys (simpler - no OAuth)
- Tesla: Similar OAuth flow, you register once
- Others: Depends on the provider

## Implementation Status

✅ **Already Implemented:**
- Multi-tenant OAuth flow
- Per-user token storage
- Token refresh mechanism
- CSRF protection
- Multiple provider support

❌ **Still Using Mock Data:**
- Test connection endpoint returns fake data
- Need to replace with real API calls (see PRODUCTION_READINESS.md)

## Production Checklist

### One-Time Setup (You):
- [ ] Register application at https://developer.enphase.com/
- [ ] Get Client ID and Client Secret
- [ ] Add to environment variables
- [ ] Deploy to production
- [ ] Replace mock API calls with real ones

### Per User (Automatic):
- [ ] User clicks "Connect to Enphase"
- [ ] User authorizes on Enphase
- [ ] Tokens stored automatically
- [ ] Data fetches automatically every 15 min

## Security Notes

1. **Your Client Secret**: Keep this secure! Never expose in frontend code.
2. **User Tokens**: Encrypted in database, never exposed to other users
3. **Token Refresh**: Automatic before expiry
4. **Revocation**: If user revokes, tokens stop working (handle gracefully)

## Cost Implications

**Your Costs:**
- $20-60/month for hosting (Vercel Pro + Redis + Sentry)
- No per-user API costs (users' systems call Enphase with their tokens)

**User Costs:**
- Free! (They're accessing their own data)

## Next Steps

1. **Today**: Register at https://developer.enphase.com/
2. **This Week**: Get credentials, update `.env`, deploy
3. **Testing**: Use your own Enphase account or mock mode
4. **Production**: Users start connecting their systems!

---

## Summary

**You**: Register once, get credentials, deploy
**Your Users**: Click "Connect", authorize, done!
**Result**: Each user's data flows into your platform automatically

The architecture I built is already correct for this multi-tenant model!
