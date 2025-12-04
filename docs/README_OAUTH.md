# OAuth Integration Documentation

This directory contains all documentation for implementing production-ready OAuth and API integrations for the Enalysis platform.

## 🎯 Start Here

**New to this?** → Read [MULTI_TENANT_SETUP.md](./MULTI_TENANT_SETUP.md) first!

This explains the fundamental concept: You register once, your users connect their own accounts.

## 📚 Documentation Overview

### For Platform Owners (You)

| Document | Purpose | Time | When to Read |
|----------|---------|------|--------------|
| **[MULTI_TENANT_SETUP.md](./MULTI_TENANT_SETUP.md)** | Understanding the architecture | 10 min | **Start here** |
| **[QUICK_START_PRODUCTION.md](./QUICK_START_PRODUCTION.md)** | Fast production deployment | 30-60 min | Ready to deploy |
| **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)** | Complete implementation guide | 2-3 hours | Deep dive |
| **[oauth-implementation.md](./oauth-implementation.md)** | Technical architecture details | 1 hour | For developers |

### For Developers

| Document | Purpose |
|----------|---------|
| **[oauth-implementation.md](./oauth-implementation.md)** | OAuth flow, security, database schema |
| **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)** | API clients, caching, monitoring |

## 🚀 Quick Setup Path

### If you just want to get it working:

1. **Read**: [MULTI_TENANT_SETUP.md](./MULTI_TENANT_SETUP.md) (10 min)
   - Understand how multi-tenant OAuth works

2. **Follow**: [QUICK_START_PRODUCTION.md](./QUICK_START_PRODUCTION.md) (30-60 min)
   - Register at Enphase
   - Get credentials
   - Deploy

3. **Done!** Users can start connecting their accounts

### If you want to understand everything:

1. **[MULTI_TENANT_SETUP.md](./MULTI_TENANT_SETUP.md)** - The big picture
2. **[oauth-implementation.md](./oauth-implementation.md)** - How it works technically
3. **[PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)** - Production best practices
4. **[QUICK_START_PRODUCTION.md](./QUICK_START_PRODUCTION.md)** - Deploy checklist

## ✅ What's Already Built

The OAuth infrastructure is **fully implemented**:

✅ OAuth 2.0 flow for Enphase
✅ Multi-tenant token storage (per user, per meter)
✅ Token refresh mechanism
✅ CSRF protection
✅ Multiple provider support (Enphase, SolarEdge, Tesla, etc.)
✅ UI components for user connections
✅ Error handling
✅ API client libraries ([lib/api-clients/](../lib/api-clients/))

## ⏳ What You Need to Do

1. **Register** your application at https://developer.enphase.com/ (1-3 days approval)
2. **Configure** environment variables with your credentials
3. **Replace** mock API calls with real ones (lines marked with TODO)
4. **Deploy** to production

That's it!

## 🎓 Key Concepts

### Multi-Tenant OAuth

```
YOU                    YOUR USERS
├─ Register once      ├─ User A connects their Enphase
├─ Get credentials    ├─ User B connects their Enphase
└─ Deploy             └─ User C connects their SolarEdge
```

You don't connect to solar systems. Your users do.

### Token Storage

Each user's credentials are stored separately:
- **User A's meter** → User A's Enphase token
- **User B's meter** → User B's Enphase token
- **User C's meter** → User C's SolarEdge API key

### Data Fetching

Your cron job fetches data for ALL users automatically:
```
Every 15 minutes:
  For each connected meter:
    Use that meter's tokens
    Fetch latest data
    Store in measurements table
```

## 🔒 Security

- Client Secret: Stored in environment variables (never in code)
- User Tokens: Encrypted in database
- CSRF: Protected via state parameter
- HTTPS: Required in production
- Token Refresh: Automatic before expiry

## 💰 Costs

**Development**: $0 (use mock mode)
**Production**: $20-60/month
- Vercel Pro: $20
- Redis: $0-10 (optional, for caching)
- Sentry: $0-26 (optional, for monitoring)

## 📞 Support Resources

- **Enphase API**: https://developer.enphase.com/docs
- **SolarEdge API**: https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf
- **OAuth 2.0**: https://oauth.net/2/

## 🐛 Troubleshooting

| Error | Solution | Doc |
|-------|----------|-----|
| "OAuth configuration not set up" | Add env variables, restart server | [QUICK_START](./QUICK_START_PRODUCTION.md#troubleshooting) |
| "Redirect URI mismatch" | Check URI matches exactly | [PRODUCTION](./PRODUCTION_READINESS.md#troubleshooting) |
| Mock data showing | Replace TODO comments with real API calls | [PRODUCTION](./PRODUCTION_READINESS.md#step-41-replace-mock-data-in-test-connection) |
| Token expired | Refresh mechanism should handle automatically | [OAUTH](./oauth-implementation.md#token-refresh) |

## 📋 Production Checklist

### One-Time Setup (You):
- [ ] Read [MULTI_TENANT_SETUP.md](./MULTI_TENANT_SETUP.md)
- [ ] Register at https://developer.enphase.com/
- [ ] Get Client ID and Secret (wait 1-3 days)
- [ ] Add to `.env` production variables
- [ ] Replace mock API calls with real ones
- [ ] Deploy to Vercel/AWS/GCP
- [ ] Test with your own Enphase account

### Per User (Automatic):
- [ ] User clicks "Connect to Enphase"
- [ ] User logs in with their Enphase credentials
- [ ] User authorizes your app
- [ ] Tokens stored automatically
- [ ] Data fetches every 15 minutes

## 🎯 Next Steps

1. **Today**: Start Enphase developer registration
2. **This Week**: Get credentials, deploy to staging
3. **Next Week**: Test with real user accounts
4. **Production**: Launch! 🚀

## 📁 File Structure

```
docs/
├── README_OAUTH.md                    ← You are here
├── MULTI_TENANT_SETUP.md             ← Start here
├── QUICK_START_PRODUCTION.md         ← Fast deployment guide
├── PRODUCTION_READINESS.md           ← Complete guide
└── oauth-implementation.md           ← Technical details

lib/api-clients/
├── enphase.ts                        ← Enphase API client
└── solaredge.ts                      ← SolarEdge API client

app/api/oauth/enphase/
├── authorize/route.ts                ← OAuth initiation
├── callback/route.ts                 ← OAuth callback
└── refresh/route.ts                  ← Token refresh
```

## ❓ FAQs

**Q: Do my users need Enphase developer accounts?**
A: No! Only you need one. Users just use their normal Enphase login.

**Q: What if a user has 5 buildings with Enphase?**
A: They connect each one separately. Each gets its own tokens.

**Q: Can users revoke access?**
A: Yes, from their Enphase account. Your app will stop getting data.

**Q: How do I test without real users?**
A: Use your own Enphase account, or keep using mock mode.

**Q: What about SolarEdge?**
A: Simpler! Users just enter their API key (no OAuth needed).

**Q: Is this production-ready?**
A: Almost! Just need to:
  1. Register at Enphase
  2. Replace mock API calls
  3. Deploy

---

**Need help?** Check the specific document for your question or see the troubleshooting sections.
