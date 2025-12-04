# Database Schema Analysis - MVP Optimization

## Current Schema Tables

### ✅ **ACTIVELY USED** (Keep for MVP)

#### 1. **portfolios**
- **Status**: ✅ USED
- **Used in**: `/api/portfolios/route.ts`, Control Room hierarchy
- **Purpose**: Top-level organization for sites
- **Columns in use**: `id`, `name`, `description`, `createdAt`, `updatedAt`
- **Keep**: YES - Core entity

#### 2. **sites**
- **Status**: ✅ USED
- **Used in**: `/api/control-room/save/route.ts`, `/api/portfolios/route.ts`, Control Room
- **Purpose**: Physical locations/facilities
- **Columns in use**: `id`, `portfolioId`, `name`, `location`, `industryType`, `metadata`, `active`
- **Keep**: YES - Core entity

#### 3. **meters**
- **Status**: ✅ USED
- **Used in**: `/api/control-room/save/route.ts`, `/api/meters/route.ts`, `/api/portfolios/route.ts`, Control Room
- **Purpose**: Energy measurement points (PROD/CONS/STOR/INJ)
- **Columns in use**: All columns
- **Keep**: YES - Core entity

#### 4. **energySources**
- **Status**: ✅ USED
- **Used in**: `/api/energy-sources/route.ts`, Data Connections page
- **Purpose**: Connect meters to data sources (solar panels, batteries, etc.) with API config
- **Columns in use**: `id`, `meterId`, `name`, `sourceType`, `capacity`, `metadata` (API config), `active`
- **Columns NOT used**: `carbonIntensity`, `costPerMwh` (should be calculated, not stored)
- **Keep**: YES - Critical for MVP
- **Optimize**: Remove `carbonIntensity` and `costPerMwh` columns

---

### ⚠️ **PARTIALLY USED / FUTURE** (Review)

#### 5. **assets**
- **Status**: ⚠️ QUERIED BUT NOT POPULATED
- **Used in**: `/api/portfolios/route.ts` (included in relations)
- **Purpose**: Physical equipment (inverters, panels, batteries, etc.)
- **Current state**: Schema exists, queried in hierarchy, but no create/update endpoints
- **Decision**:
  - **For MVP**: Remove or mark as future feature
  - Assets are more granular than needed for MVP - meters are sufficient
  - **Recommendation**: REMOVE for MVP, add back later when needed

#### 6. **assetTypes**
- **Status**: ⚠️ NOT USED
- **Referenced by**: `assets` table (foreign key)
- **Purpose**: Define types of assets (inverter, panel, battery, etc.)
- **Decision**: **REMOVE** - only needed if we use assets table

#### 7. **recommendations**
- **Status**: ⚠️ QUERIED BUT NOT POPULATED
- **Used in**: `/api/portfolios/route.ts` (included in relations)
- **Purpose**: AI-generated optimization recommendations
- **Current state**: Schema exists, queried in hierarchy, but no create/update logic
- **Decision**:
  - **For MVP**: Keep schema, add implementation later
  - **Recommendation**: KEEP but mark as "Phase 2"

---

### ❌ **NOT USED** (Consider Removing for MVP)

#### 8. **assetConnections**
- **Status**: ❌ NOT USED
- **Purpose**: Define connections between assets (energy flow, dependencies)
- **Decision**: **REMOVE** - only needed with assets table

#### 9. **energyConnections**
- **Status**: ❌ NOT USED
- **Purpose**: Generic connections between any entities (meters, assets, sources)
- **Decision**: **REMOVE** - overly complex for MVP, relationships handled by foreign keys

#### 10. **measurements**
- **Status**: ❌ NOT CURRENTLY USED BUT CRITICAL
- **Purpose**: Store time-series data from APIs (power, energy readings)
- **Decision**: **KEEP** - Will be populated by background jobs fetching from solar APIs
- **Importance**: HIGH - this is where actual energy data will be stored

#### 11. **gridLinks**
- **Status**: ❌ NOT USED
- **Purpose**: Grid connection details and tariff structures
- **Decision**: **KEEP** - Needed for INJ/CONS calculations, but implement later

---

## Summary

### Tables to KEEP for MVP:
1. ✅ **portfolios** - Top level organization
2. ✅ **sites** - Physical locations
3. ✅ **meters** - Energy measurement points
4. ✅ **energySources** - Data source configurations
5. ✅ **measurements** - Time-series energy data (implement next)
6. ⚠️ **gridLinks** - Keep schema, implement later
7. ⚠️ **recommendations** - Keep schema, implement later

### Tables to REMOVE from MVP:
1. ❌ **assets** - Too granular, meters are sufficient
2. ❌ **assetTypes** - Only needed if we use assets
3. ❌ **assetConnections** - Only needed if we use assets
4. ❌ **energyConnections** - Overly complex, relationships handled by FKs

---

## Schema Optimizations

### 1. **energySources** table optimization

**Current columns to REMOVE:**
```sql
carbonIntensity: doublePrecision("carbon_intensity"), // REMOVE - calculate from sourceType
costPerMwh: doublePrecision("cost_per_mwh"),         // REMOVE - calculate from tariffs
```

**Why?**
- **Carbon Intensity**: Static value based on source type (solar=0, grid=varies by region)
- **Cost**: Dynamic, depends on time-of-use tariffs, not a fixed property of the source

**Proposed schema:**
```typescript
export const energySources = pgTable(
  "energy_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meterId: uuid("meter_id").references(() => meters.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull(), // solar, wind, battery, grid, etc.
    capacity: doublePrecision("capacity"), // in kW
    metadata: jsonb("metadata").default({}), // API config: { useAPI, apiProvider, apiKey, systemId, etc. }
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  // indexes...
);
```

### 2. **measurements** table - Ready for implementation

This table is CRITICAL and should be the next priority:

```typescript
// Current schema is good:
export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull(), // meter or energy source ID
    entityType: text("entity_type").notNull(), // 'meter' or 'energy_source'
    timestamp: timestamp("timestamp").notNull(),
    metric: text("metric").notNull(), // 'power', 'energy', 'voltage', 'current', etc.
    value: doublePrecision("value").notNull(),
    unit: text("unit").default("kWh").notNull(),
    quality: qualityEnum("quality").default("good"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // indexes are good...
);
```

**Next steps:**
1. Create background job to fetch data from SolarEdge/Enphase APIs
2. Store readings in `measurements` table
3. Create API endpoints to query time-series data
4. Display in dashboard

---

## Recommended Migration Steps

### Phase 1: Clean up unused tables (NOW)

```sql
-- Drop unused tables
DROP TABLE IF EXISTS asset_connections CASCADE;
DROP TABLE IF EXISTS energy_connections CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS asset_types CASCADE;

-- Remove unused columns from energy_sources
ALTER TABLE energy_sources DROP COLUMN IF EXISTS carbon_intensity;
ALTER TABLE energy_sources DROP COLUMN IF EXISTS cost_per_mwh;
```

### Phase 2: Implement measurements table (NEXT)

1. Create API endpoint to fetch data from solar APIs
2. Create background job (cron or queue) to poll APIs based on `updateFrequency`
3. Store measurements in database
4. Create query API for time-series data
5. Build dashboard to display real-time/historical data

### Phase 3: Add tariffs/pricing (LATER)

Create new table for tariff structures:

```typescript
export const tariffs = pgTable("tariffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  siteId: uuid("site_id").references(() => sites.id),
  name: text("name").notNull(),
  energyType: text("energy_type").notNull(), // 'consumption', 'injection'
  rateStructure: jsonb("rate_structure").notNull(), // TOU rates, fixed rates, etc.
  currency: text("currency").default("USD"),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  active: boolean("active").default(true),
});
```

### Phase 4: Recommendations (LATER)

Implement AI-powered recommendations using existing `recommendations` table

---

## Current Database Efficiency

### Indexes Status: ✅ GOOD

All current tables have appropriate indexes:
- Foreign keys are indexed
- Query-heavy columns (category, timestamp, etc.) are indexed
- Composite indexes where needed

### Relationships: ✅ CLEAN

Current hierarchy is simple and clean:
```
Portfolio
  └── Sites
      ├── Meters (hierarchical via parentMeterId)
      │   └── Energy Sources (API config)
      └── Grid Links (future)
```

### Data Redundancy: ⚠️ NEEDS CLEANUP

- `carbonIntensity` in `energySources` - should be calculated
- `costPerMwh` in `energySources` - should be from tariffs table

---

## Conclusion

**For MVP, the schema is 80% optimized.**

**Immediate actions:**
1. ✅ Remove unused tables (assets, assetTypes, assetConnections, energyConnections)
2. ✅ Remove `carbonIntensity` and `costPerMwh` from `energySources`
3. 🔄 Implement `measurements` table with API data fetching
4. 📅 Keep `gridLinks` and `recommendations` for Phase 2

**Result:**
- Simpler schema
- Faster queries
- Less storage
- Easier to understand and maintain
- Ready for production MVP
