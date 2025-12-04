# Production Database Setup - Step by Step

## Option 1: Supabase Setup (RECOMMENDED - 10 minutes)

### Step 1: Create Supabase Account

1. **Go to**: https://supabase.com
2. **Click**: "Start your project"
3. **Sign up** with GitHub (fastest) or email
4. **Verify** your email if using email signup

### Step 2: Create New Project

1. **Click**: "New Project"
2. **Fill in project details**:
   ```
   Organization: Create new organization
   Name: enalysis-mvp-prod
   Database Password: [Click "Generate password" - SAVE THIS!]
   Region: Choose closest to your users
     - US East (Ohio) for East Coast
     - US West (Oregon) for West Coast
     - EU (Frankfurt) for Europe
   Pricing Plan: Free tier (for testing)
   ```

3. **Click**: "Create new project"
4. **Wait**: 2-3 minutes for provisioning

### Step 3: Get Connection String

1. **Go to**: Project Settings (gear icon) → Database
2. **Find**: "Connection string" section
3. **Select**: "URI" tab
4. **Copy** the connection string - it looks like:
   ```
   postgresql://postgres.xxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

5. **Replace** `[YOUR-PASSWORD]` with the password from Step 2

### Step 4: Enable Connection Pooling (IMPORTANT)

Supabase provides two connection types:

**Direct Connection** (Port 5432):
```
postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```
- Use for: Drizzle migrations, Drizzle Studio
- Limit: 60 connections max

**Pooled Connection** (Port 6543) - **USE THIS FOR PRODUCTION**:
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```
- Use for: Production app, API routes
- Limit: Thousands of connections
- Mode: Transaction pooling

### Step 5: Update Environment Variables

**For Local Development** (`.env.local`):
```bash
# Direct connection for migrations and Drizzle Studio
DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

**For Production** (Vercel/Railway environment variables):
```bash
# Pooled connection for production app
DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
```

### Step 6: Run Database Migrations

```bash
# Navigate to project
cd enalysis-mvp

# Run migrations to production database
npm run db:push

# Verify tables were created
npm run db:studio
```

### Step 7: Verify Database Setup

1. **Open Supabase Dashboard** → Table Editor
2. **Check for tables**:
   - users
   - sites
   - meters
   - measurements
   - recommendations
   - grid_carbon_intensity
   - electricity_pricing
   - etc.

3. **Test connection** from your app:
   ```bash
   # Create a test script
   npx tsx -e "import { db } from './db/index.js'; const result = await db.query.sites.findMany(); console.log('✅ Connected! Found', result.length, 'sites'); process.exit(0);"
   ```

### Step 8: Set Up Automatic Backups

**Supabase Free Tier**:
- ✅ Daily backups (retained for 7 days)
- ✅ Point-in-time recovery (last 7 days)

**To enable**:
1. Go to: Project Settings → Database → Backups
2. Verify: "Daily backups" is enabled
3. **Pro Plan adds**:
   - 30-day backup retention
   - Custom backup schedules

### Step 9: Configure SSL (Already Enabled!)

Supabase has SSL enabled by default. Verify with:
```bash
# Connection string should include:
?sslmode=require
```

### Step 10: Test from Production

Once deployed to Vercel/Railway:
1. Add `DATABASE_URL` to environment variables
2. Run migrations: `npm run db:push`
3. Test API endpoint
4. Check Supabase dashboard for new data

---

## Option 2: Neon Setup (Alternative - 10 minutes)

### Step 1: Create Neon Account

1. **Go to**: https://neon.tech
2. **Click**: "Sign Up"
3. **Sign up** with GitHub or email
4. **Verify** email

### Step 2: Create Project

1. **Click**: "Create a project"
2. **Fill in**:
   ```
   Project name: enalysis-mvp-prod
   Postgres version: 16 (latest)
   Region: Choose closest to users
   ```
3. **Click**: "Create project"
4. **Save** the connection string shown

### Step 3: Get Connection String

Neon provides the connection string immediately:
```
postgresql://[user]:[password]@ep-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 4: Configure Compute Settings

1. **Go to**: Project Settings → Compute
2. **Set**:
   - Compute size: 0.25 CU (Free tier)
   - Auto-suspend: 5 minutes (default)
   - Auto-scaling: Enabled

### Step 5: Run Migrations

```bash
# Set DATABASE_URL temporarily
export DATABASE_URL="postgresql://[your-neon-url]"

# Run migrations
npm run db:push
```

### Step 6: Enable Branching (Optional but Awesome)

Neon's killer feature - database branching:

```bash
# Create staging branch
neonctl branches create --name staging

# Get staging connection string
neonctl connection-string staging
```

Use for:
- Testing migrations before production
- Development environments
- Pull request previews

---

## Option 3: Railway Setup (All-in-One - 15 minutes)

### Step 1: Create Railway Account

1. **Go to**: https://railway.app
2. **Sign up** with GitHub
3. **Authorize** Railway app

### Step 2: Create New Project

1. **Click**: "New Project"
2. **Select**: "Provision PostgreSQL"
3. **Wait**: 1-2 minutes for provisioning

### Step 3: Get Connection Details

Railway automatically creates environment variables:
- `DATABASE_URL`: Full connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`: Individual components

**Copy** the `DATABASE_URL` from the Variables tab

### Step 4: Deploy Your App to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

Railway will:
- ✅ Build your Next.js app
- ✅ Deploy the ML service
- ✅ Connect to PostgreSQL
- ✅ Set up SSL
- ✅ Provide a domain

---

## Comparison Table

| Feature | Supabase | Neon | Railway |
|---------|----------|------|---------|
| **Setup Time** | 5 min | 5 min | 10 min |
| **Free Tier** | 500MB | 512MB | $5/month |
| **SSL** | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| **Backups** | ✅ Daily | ✅ Daily | ❌ Manual |
| **Dashboard** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Scaling** | Good | Excellent | Good |
| **Special Feature** | Auth, Storage | Branching | Full hosting |
| **Best For** | Easy setup | Performance | All-in-one |

---

## Quick Start Commands

### After Getting Connection String:

```bash
# 1. Update local .env.local
DATABASE_URL="your_connection_string_here"

# 2. Test connection
cd enalysis-mvp
npx tsx -e "import { db } from './db/index.js'; console.log('Testing connection...'); const result = await db.execute('SELECT NOW()'); console.log('✅ Connected at:', result.rows[0].now); process.exit(0);"

# 3. Run migrations
npm run db:push

# 4. Verify tables
npm run db:studio
# Open http://localhost:4983

# 5. Seed demo data (optional)
npm run seed:demo
```

---

## Troubleshooting

### Error: "SSL connection required"
**Solution**: Add `?sslmode=require` to connection string
```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### Error: "Too many connections"
**Solution**: Use connection pooling
- **Supabase**: Use pooler URL (port 6543)
- **Neon**: Use pooled connection
- **Railway**: Add `?connection_limit=5` to URL

### Error: "Database does not exist"
**Solution**: Check database name in connection string
```bash
# Format: postgresql://user:pass@host:5432/DATABASE_NAME
# Ensure DATABASE_NAME matches your database
```

### Error: "Password authentication failed"
**Solution**:
1. Check password has no special characters needing URL encoding
2. Use direct password from provider dashboard
3. For special characters, URL encode them:
   - `@` → `%40`
   - `#` → `%23`
   - `&` → `%26`

---

## Security Checklist

After setting up database:

- [ ] SSL mode enabled (`?sslmode=require`)
- [ ] Strong password (32+ characters)
- [ ] Connection string stored in environment variables (not in code)
- [ ] Backups configured and tested
- [ ] Firewall rules set (if available)
- [ ] Monitoring enabled
- [ ] Connection pooling configured
- [ ] Database password saved in password manager

---

## Next Steps

After database is set up:

1. ✅ Run migrations: `npm run db:push`
2. ✅ Seed demo data: `npm run seed:demo`
3. ✅ Test locally with production database
4. ⏭️ Deploy ML service (next guide)
5. ⏭️ Configure Vercel with production DATABASE_URL
6. ⏭️ Deploy to production

---

## Support Links

- **Supabase Docs**: https://supabase.com/docs/guides/database
- **Neon Docs**: https://neon.tech/docs/introduction
- **Railway Docs**: https://docs.railway.app/databases/postgresql
- **Drizzle ORM**: https://orm.drizzle.team/docs/overview

---

**Need help?** Check the troubleshooting section or reach out on Discord/support channels!
