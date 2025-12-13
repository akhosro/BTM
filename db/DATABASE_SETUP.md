# Database Setup Guide

## Overview

This project uses **two Supabase PostgreSQL databases**:

1. **Local Development DB** (US-East-1) - For development and testing
2. **Production DB** (US-West-2) - For production deployment on Vercel

## Current Database Schema

The schema is managed using **Drizzle ORM** and defined in:
- `db/schema.ts` - TypeScript schema definition
- `db/migrations/` - Auto-generated SQL migrations

## Switching Between Databases

### For Local Development (Default)

Your `.env.local` is currently configured for **LOCAL DEV**:

```bash
DATABASE_URL="postgresql://postgres.epgsrgfzcqcahohgtqex:...@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
```

### For Production Testing

To test against production database locally, edit `.env.local`:

1. Comment out the LOCAL DATABASE_URL
2. Uncomment the PRODUCTION DATABASE_URL

```bash
# DATABASE_URL="postgresql://postgres.epgsrgfzcqcahohgtqex:...@aws-1-us-east-1..." # LOCAL
DATABASE_URL="postgresql://postgres.lccbpaopmruxdvfkdoor:...@aws-0-us-west-2..." # PROD
```

⚠️ **WARNING**: Be careful when running migrations or making changes against production!

## Database Operations

### 1. Generate Migration (After Schema Changes)

When you modify `db/schema.ts`, generate a migration:

```bash
npm run db:generate
```

This creates a new SQL file in `db/migrations/`.

### 2. Apply Migrations

**To LOCAL dev database:**
```bash
npm run db:push
```

**To PRODUCTION database:**
1. Switch DATABASE_URL in `.env.local` to production
2. Run `npm run db:push`
3. Switch back to local dev URL

### 3. View Database in Drizzle Studio

```bash
npm run db:studio
```

Opens a web UI at `https://local.drizzle.studio` to browse your database.

## Production Deployment

### Vercel Environment Variables

Ensure these are set in your Vercel project settings:

1. `DATABASE_URL` - Production Supabase connection string
2. `SESSION_SECRET` - JWT signing secret (already configured)
3. `ML_SERVICE_URL` - Railway ML service URL

### Applying Migrations to Production

**Option 1: Via Vercel Deployment**
- Migrations run automatically on deployment if configured

**Option 2: Manual Push**
1. Temporarily switch `.env.local` to production URL
2. Run `npm run db:push`
3. Switch back to local URL
4. Commit and push to trigger Vercel deployment

## Database Backups

### Local Dev Database
- Supabase provides automatic daily backups
- Access via Supabase dashboard (US-East-1 project)

### Production Database
- Supabase provides automatic daily backups
- Access via Supabase dashboard (US-West-2 project)

## Migration History

Current migrations in `db/migrations/`:
- `0000_spooky_invaders.sql` - Initial schema
- `0001_purple_prism.sql` - Schema update
- `0002_same_star_brand.sql` - Latest changes

## Troubleshooting

### "SESSION_SECRET is required" Error
- Ensure `SESSION_SECRET` is set in `.env.local` (local dev)
- Ensure it's set in Vercel environment variables (production)

### Connection Issues
- Verify DATABASE_URL is correctly formatted
- Check Supabase project is active
- Ensure IP is allowlisted in Supabase (if applicable)

### Schema Drift
If schema.ts and database are out of sync:
```bash
npm run db:generate  # Generate new migration
npm run db:push      # Apply to database
```
