# Database Schema Documentation

This directory contains the database schema and configuration for the Enalysis MVP energy management system.

## Technology Stack

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Migration Tool**: Drizzle Kit

## Schema Overview

The database is designed to model a hierarchical energy management system with the following structure:

```
Portfolio
  └── Sites (with industry type)
      ├── Meters (CONS, PROD, INJ, STOR)
      │   ├── Assets (equipment like compressors, chillers, HVAC)
      │   └── Energy Sources (solar, wind, battery, grid)
      └── Grid Links (connection to external grid)
```

## Core Tables

### 1. Portfolios
Top-level container for organizing multiple sites.

### 2. Sites
Physical locations with:
- Industry type (biotech, datacenter, logistics, etc.)
- Location information
- Associated meters, grid links, and recommendations

### 3. Meters
Energy measurement points categorized as:
- **CONS**: Consumption meters
- **PROD**: Production meters
- **INJ**: Grid injection meters
- **STOR**: Storage meters

### 4. Assets
Physical equipment and devices:
- Compressors, chillers, HVAC systems
- Lighting, machinery, etc.
- Hierarchical structure (parent-child relationships)
- Connected via asset_connections table

### 5. Energy Sources
Power generation and storage sources:
- Solar panels, wind turbines
- Battery systems, generators
- CHP (Combined Heat & Power), hydrogen cells
- Includes capacity and carbon intensity data

### 6. Measurements
Time-series energy data:
- Power, energy, voltage, current metrics
- Timestamp-based for trend analysis
- Quality indicators (good, bad, estimated)
- Supports multiple entity types (meters, assets, energy sources)

### 7. Grid Links
External grid connections:
- Consumption and injection points
- Capacity limits
- Tariff structures

### 8. Recommendations
AI-generated optimization suggestions:
- Efficiency improvements
- Renewable energy opportunities
- Storage optimization
- ROI and carbon reduction estimates

## Enums

- **direction_enum**: `in`, `out`, `bi`
- **relationship_enum**: `energy_flow`, `data_flow`, `dependency`
- **industry_type_enum**: `biotech`, `datacenter`, `logistics`, `manufacturing`, etc.
- **meter_category_enum**: `CONS`, `PROD`, `INJ`, `STOR`
- **reading_frequency_enum**: `1min`, `5min`, `15min`, `hourly`, `daily`
- **quality_enum**: `good`, `bad`, `estimated`

## Setup Instructions

### 1. Install Dependencies

Already included in your project:
```bash
npm install drizzle-orm postgres dotenv
npm install -D drizzle-kit @types/pg
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Update the `DATABASE_URL` with your PostgreSQL connection string:
```
DATABASE_URL="postgresql://username:password@host:port/database"
```

### 3. Set Up PostgreSQL Database

**Option A: Local PostgreSQL with Docker**
```bash
docker run --name enalysis-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=enalysis_mvp -p 5432:5432 -d postgres:16
```

**Option B: Cloud Services**
- [Supabase](https://supabase.com) - Free tier with 500MB database
- [Neon](https://neon.tech) - Serverless Postgres with generous free tier
- [Railway](https://railway.app) - Easy deployment

### 4. Generate Migration

```bash
npm run db:generate
```

This creates migration files in `db/migrations/` based on your schema.

### 5. Run Migration

```bash
npm run db:migrate
```

This applies the migrations to your database.

**Alternative**: Push schema directly (good for development):
```bash
npm run db:push
```

### 6. Seed Initial Data

```bash
npm run db:seed
```

This populates the database with:
- Asset types (CONS, PROD, C/I, INJ)

### 7. Explore with Drizzle Studio (Optional)

```bash
npm run db:studio
```

Opens a visual database browser at `https://local.drizzle.studio`

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run db:generate` | Generate migration files from schema changes |
| `npm run db:migrate` | Apply migrations to database |
| `npm run db:push` | Push schema directly to database (dev only) |
| `npm run db:studio` | Open Drizzle Studio for visual database exploration |
| `npm run db:seed` | Seed database with initial data |

## Database Usage in Your App

### Import the database connection:

```typescript
import { db } from "@/db";
import { sites, meters, assets } from "@/db/schema";
```

### Example Queries:

**Fetch all sites:**
```typescript
const allSites = await db.select().from(sites);
```

**Fetch sites with their meters:**
```typescript
import { eq } from "drizzle-orm";

const sitesWithMeters = await db.query.sites.findMany({
  with: {
    meters: true,
  },
});
```

**Insert a new site:**
```typescript
const newSite = await db.insert(sites).values({
  portfolioId: "...",
  name: "New Facility",
  location: "San Francisco, CA",
  industryType: "biotech",
}).returning();
```

**Complex query with relations:**
```typescript
const portfolio = await db.query.portfolios.findFirst({
  where: eq(portfolios.id, portfolioId),
  with: {
    sites: {
      with: {
        meters: {
          with: {
            assets: true,
            energySources: true,
          },
        },
      },
    },
  },
});
```

## Schema Modifications

1. Edit `db/schema.ts`
2. Generate migration: `npm run db:generate`
3. Review generated SQL in `db/migrations/`
4. Apply migration: `npm run db:migrate`

## Key Features

- **Type Safety**: Full TypeScript type inference
- **Relationships**: Properly modeled with Drizzle relations
- **Indexes**: Optimized for common query patterns
- **Cascading Deletes**: Proper cleanup when parent entities are removed
- **JSONB Fields**: Flexible metadata storage
- **Timestamps**: Automatic tracking of created/updated times

## Notes

- All IDs use UUIDs for better distributed systems support
- Timestamps use `TIMESTAMPTZ` for proper timezone handling
- JSONB fields allow flexible metadata without schema changes
- Soft deletes can be implemented via `active` boolean fields
- The schema supports the full hierarchy: Portfolio → Site → Meter → Asset/EnergySource

## Troubleshooting

**Migration conflicts:**
```bash
# Drop and recreate (DEV ONLY - destroys data!)
npm run db:push -- --force
```

**Connection issues:**
- Verify `DATABASE_URL` in `.env.local`
- Check PostgreSQL is running
- Verify network/firewall settings

**Type errors:**
After schema changes, restart your TypeScript server or Next.js dev server.