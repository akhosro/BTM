# Grid Zone Implementation Guide

## Overview

The grid zone system ensures all sites have accurate coordinates and standardized grid zone codes for reliable carbon intensity data lookups.

## Architecture

### Data Fields (Sites Table)

```typescript
{
  name: string;              // "Manufacturing Plant A"
  location?: string;         // "Toronto, ON - Downtown" (human-friendly display)
  latitude: number;          // 43.6532 (required)
  longitude: number;         // -79.3832 (required)
  gridZone: string;          // "CA-ON" (required, auto-detected from coordinates)
}
```

### Field Purposes

| Field | Required | Purpose | Example |
|-------|----------|---------|---------|
| `name` | ✅ | Site identifier | "Manufacturing Plant A" |
| `location` | ❌ | Human-friendly display text | "Toronto, ON - Downtown" |
| `latitude` | ✅ | Precise coordinates for APIs | 43.6532 |
| `longitude` | ✅ | Precise coordinates for APIs | -79.3832 |
| `gridZone` | ✅ | Standardized zone for data lookups | "CA-ON" |

## User Flow

### Creating a New Site

1. **User enters location text** (e.g., "Toronto, ON")
   - Free-form text input
   - Used for display purposes

2. **Frontend calls geocoding API**
   ```typescript
   POST /api/geocode
   { "address": "Toronto, ON" }
   ```

3. **System geocodes address**
   - Tries Google Maps API first (if API key available)
   - Falls back to Nominatim (OpenStreetMap, free)
   - Returns coordinates: `{ lat: 43.6532, lon: -79.3832 }`

4. **System auto-detects grid zone**
   - Maps coordinates to grid zone using coordinate boundaries
   - Returns: `{ gridZone: "CA-ON", gridZoneName: "Ontario" }`

5. **Frontend pre-fills form**
   ```
   Location: Toronto, ON
   Latitude: 43.6532  ✓
   Longitude: -79.3832  ✓
   Grid Zone: CA-ON (Ontario)  ✓
   ```

6. **User submits form**
   - All fields validated
   - Site created with complete location data

### Manual Coordinate Entry

Users can also manually enter coordinates:

1. **User enters lat/lon directly**
2. **Frontend validates on blur**
   ```typescript
   POST /api/geocode
   { "latitude": 43.6532, "longitude": -79.3832 }
   ```
3. **System auto-detects grid zone**
4. **Grid zone displayed with confirmation**

## API Endpoints

### POST /api/geocode

**Purpose**: Geocode address or validate coordinates

**Request (Address)**:
```json
{
  "address": "Toronto, ON"
}
```

**Request (Coordinates)**:
```json
{
  "latitude": 43.6532,
  "longitude": -79.3832
}
```

**Response**:
```json
{
  "success": true,
  "latitude": 43.6532,
  "longitude": -79.3832,
  "gridZone": "CA-ON",
  "gridZoneName": "Ontario",
  "formattedAddress": "Toronto, Ontario, Canada"
}
```

### GET /api/geocode/zones

**Purpose**: Get all available grid zones

**Response**:
```json
{
  "success": true,
  "zones": [
    { "code": "CA-ON", "name": "Ontario", "country": "CA" },
    { "code": "CA-QC", "name": "Quebec", "country": "CA" },
    { "code": "US-CAL-CISO", "name": "California (CAISO)", "country": "US" }
  ]
}
```

### POST /api/sites

**Purpose**: Create new site

**Request**:
```json
{
  "name": "Manufacturing Plant A",
  "location": "Toronto, ON - Downtown",
  "latitude": 43.6532,
  "longitude": -79.3832,
  "gridZone": "CA-ON",
  "industryType": "manufacturing"
}
```

**Validation**:
- ✅ `name` is required
- ✅ `latitude` and `longitude` are required
- ✅ `gridZone` auto-detected if not provided
- ✅ Coordinates must fall within a supported grid zone

## Grid Zone Mappings

### Currently Supported Zones

| Grid Zone | Name | Region | Coordinates |
|-----------|------|--------|-------------|
| `CA-ON` | Ontario | Canada | 41.5°N to 57°N, -95.2°W to -74.3°W |
| `CA-QC` | Quebec | Canada | 45°N to 62.5°N, -79.8°W to -57.1°W |
| `US-CAL-CISO` | California (CAISO) | USA | 32.5°N to 42°N, -124.5°W to -114.1°W |
| `US-NY-NYIS` | New York (NYISO) | USA | 40.5°N to 45°N, -79.8°W to -71.9°W |
| `US-TEX-ERCO` | Texas (ERCOT) | USA | 25.8°N to 36.5°N, -106.6°W to -93.5°W |

### Adding New Zones

Edit `lib/utils/grid-zone-mapper.ts`:

```typescript
{
  name: "British Columbia",
  zone: "CA-BC",
  country: "CA",
  bounds: {
    minLat: 48.3,
    maxLat: 60.0,
    minLon: -139.1,
    maxLon: -114.0,
  },
}
```

## Configuration

### Optional: Google Maps API

For more accurate geocoding, add Google Maps API key:

**.env.local**:
```env
GOOGLE_MAPS_API_KEY=your_key_here
```

**Without API key**: System automatically falls back to Nominatim (OpenStreetMap) - free, no key required.

## Data Integration

### How Grid Zones Are Used

1. **Carbon Intensity Sync**
   - [lib/scheduler/jobs/sync-carbon-intensity.ts](../lib/scheduler/jobs/sync-carbon-intensity.ts)
   - Uses `site.gridZone` to store carbon intensity with correct region

2. **ML Service Recommendations**
   - [ml-service/app/routers/recommendations.py](../ml-service/app/routers/recommendations.py)
   - Gets `site.grid_zone` from database
   - Fetches carbon intensity using grid zone

3. **Database Queries**
   - [ml-service/app/database.py](../ml-service/app/database.py)
   - `fetch_carbon_intensity(grid_zone="CA-ON")`
   - Queries: `WHERE region = 'CA-ON'`

## Migration Strategy

### For Existing Sites

Run migration script to populate grid zones for existing sites:

```bash
node update-grid-zones.mjs
```

This script:
1. Reads existing sites
2. Maps coordinates → grid zones
3. Updates `grid_zone` column
4. Validates all sites have zones

### Making Fields Required

Once all existing sites have coordinates and grid zones:

1. ✅ Schema updated: `latitude`, `longitude`, `gridZone` marked as required
2. ✅ API validation added
3. ✅ Frontend forms require these fields
4. Migration applied to make columns NOT NULL in database

## Benefits

✅ **Data Integrity**: Every site has valid coordinates and grid zone
✅ **Automatic**: Users don't need to understand grid zones
✅ **Accurate**: Coordinates ensure precise API calls
✅ **User-Friendly**: Location text provides human context
✅ **Flexible**: Can add more zones as needed
✅ **Validated**: System prevents invalid locations

## Troubleshooting

### "Location not supported" Error

**Cause**: Coordinates don't match any defined grid zone

**Solution**:
1. Check if zone exists in `grid-zone-mapper.ts`
2. Add new zone mapping if needed
3. Verify coordinate boundaries are correct

### Geocoding Fails

**Cause**: Address not found or API unavailable

**Solution**:
1. Check if Google Maps API key is valid (if using)
2. Verify internet connection for Nominatim
3. Try entering coordinates manually instead

### Grid Zone Mismatch

**Cause**: Site moved or coordinates updated without updating grid zone

**Solution**:
1. Re-validate coordinates using `/api/geocode`
2. Update grid zone to match new coordinates
3. Re-sync carbon intensity data for the site
