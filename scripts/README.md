# Scripts Directory

This folder contains production-ready utility scripts for database seeding, data synchronization, and maintenance tasks.

## 🚀 Production Scripts

### Data Seeding

**`seed-demo-data.ts`** ✅ **Active**
- **Usage**: `npm run seed:demo`
- **Purpose**: Populate database with demo/test data
- **When**: Initial setup, testing, demos

**`seed-control-room-test-data.ts`**
- **Usage**: `tsx scripts/seed-control-room-test-data.ts`
- **Purpose**: Populate Control Room with test sites/meters
- **When**: Testing Control Room functionality

**`seed-electricity-pricing.ts`**
- **Usage**: `tsx scripts/seed-electricity-pricing.ts`
- **Purpose**: Populate electricity pricing data
- **When**: Initial setup, pricing updates

**`seed-measurement-data.ts`**
- **Usage**: `tsx scripts/seed-measurement-data.ts`
- **Purpose**: Populate meter measurement data
- **When**: Testing charts, analytics

### Data Population & Sync

**`populate-measurements.ts`**
- **Usage**: `tsx scripts/populate-measurements.ts`
- **Purpose**: Populate historical measurement data
- **When**: Initial setup, backfilling data

**`sync-iso-prices.ts`**
- **Usage**: `tsx scripts/sync-iso-prices.ts`
- **Purpose**: Sync market prices from IESO API
- **When**: Daily/hourly (can be automated)

**`update-carbon-timestamps.ts`** ✅ **Active**
- **Usage**: `npm run update:carbon`
- **Purpose**: Update carbon intensity timestamps
- **When**: After carbon data sync

### Utilities

**`run-all-jobs.ts`**
- **Usage**: `tsx scripts/run-all-jobs.ts`
- **Purpose**: Run all background jobs manually
- **When**: Testing, manual data refresh

## 📦 Archived Scripts

The `archive/` folder contains one-time debug, fix, and migration scripts that were used during development. These are kept for reference but are not needed for normal operations.

**Examples of archived scripts:**
- `fix-*.ts` - One-time data fixes
- `check-*.ts` - Debug/diagnostic scripts
- `migrate-*.ts` - Schema migration helpers
- `cleanup-*.ts` - One-time cleanup tasks

## 🔧 Running Scripts

Most scripts use `tsx` (TypeScript execution) with environment variables:

```bash
# Using npm script (recommended)
npm run seed:demo

# Direct execution
tsx --require dotenv/config scripts/seed-demo-data.ts
```

## ⚠️ Important Notes

1. **Environment**: Scripts read from `.env.local` by default
2. **Database**: Be careful which DATABASE_URL is active (LOCAL vs PROD)
3. **Idempotency**: Some scripts can be run multiple times safely, others cannot
4. **Backups**: Always backup before running data modification scripts

## 📝 Adding New Scripts

When adding new production scripts:

1. Add them to this README with clear documentation
2. If it's a common task, add an npm script to `package.json`
3. One-time scripts should go in `archive/` after use
