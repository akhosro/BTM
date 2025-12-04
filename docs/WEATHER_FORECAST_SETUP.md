# Weather Forecast Setup Guide

## Overview

The Enalysis ML Service now includes real-time weather forecasting with solar irradiance calculations to help optimize energy usage based on weather conditions.

## Current Status

✅ **Weather forecast system implemented**
✅ **Mock data working** (realistic weather patterns with solar calculations)
✅ **Database storage** (weatherForecasts table populated)
✅ **API endpoints** ready for UI integration
⏳ **Real API integration** (requires OpenWeatherMap API key)

## Features

### Weather Forecasts
- 5-day / 3-hour interval forecasts (40 total forecasts)
- Temperature, cloud cover, wind speed, precipitation
- Precipitation probability
- Confidence intervals

### Solar Generation Forecasts
- Solar irradiance calculations (W/m²)
- Solar generation estimates (kW)
- Accounts for:
  - Time of day (solar noon peak)
  - Seasonal variations
  - Cloud cover impact
  - Panel efficiency (20%)
  - Performance ratio (85%)

### Data Retention
- Weather forecasts: **7 days** (shorter than consumption forecasts)
- Automatic cleanup of old forecasts
- Latest forecasts always available via API

## API Endpoints

### Get Weather Forecasts
```
GET /api/forecasts/weather?siteId={site_id}&hours={24}
```

**Response:**
```json
{
  "success": true,
  "forecasts": [
    {
      "timestamp": "2025-11-12T11:22:42.938Z",
      "temperature": 21.8,
      "cloudCover": 15.9,
      "windSpeed": 7,
      "precipitation": 0,
      "precipitationProbability": 5,
      "solarIrradiance": 528.03,
      "solarGeneration": 44.88,
      "confidence": 0.75,
      "dataSource": "mock",
      "horizonHours": "40"
    }
  ],
  "generatedAt": "2025-11-07T14:22:44.257Z",
  "count": 40
}
```

### Get Consumption Forecasts
```
GET /api/forecasts/consumption?siteId={site_id}&hours={24}
```

## Setting Up Real Weather Data (Optional)

### Step 1: Get OpenWeatherMap API Key

1. Go to https://openweathermap.org/api
2. Sign up for a free account
3. Navigate to API Keys section
4. Copy your API key

**Free Tier Limits:**
- 1,000 API calls/day
- 5-day / 3-hour forecast
- Perfect for MVP testing!

**Rate Limiting Protection:**
- ✅ **Automatic caching** (3-hour cache duration)
- ✅ **Daily call tracking** (max 900 calls/day by default)
- ✅ **Graceful fallback** (uses cached or mock data if limit reached)
- ✅ **Zero configuration required** - works out of the box!

### Step 2: Configure ML Service

Edit `ml-service/.env`:

```env
# Replace 'your_api_key_here' with your actual API key
OPENWEATHER_API_KEY=your_actual_api_key_from_openweathermap
OPENWEATHER_BASE_URL=https://api.openweathermap.org/data/2.5

# Optional: Configure caching and rate limiting
WEATHER_CACHE_HOURS=3              # Cache duration (default: 3 hours)
WEATHER_MAX_DAILY_CALLS=900        # Max API calls/day (default: 900, leaves 100 buffer)
```

### Step 3: Update Site Coordinates (if needed)

Edit `ml-service/app/routers/recommendations.py` line 88:

```python
# Update with your site's actual coordinates
# Current: Toronto (TD1 datacenter)
lat, lon = 43.6532, -79.3832

# Examples:
# New York: lat, lon = 40.7128, -74.0060
# London: lat, lon = 51.5074, -0.1278
# Vancouver: lat, lon = 49.2827, -123.1207
```

### Step 4: Restart ML Service

```bash
cd ml-service
./venv/Scripts/python.exe -m uvicorn app.main:app --port 8000
```

### Step 5: Test Real Data

```bash
# Generate forecasts (will call OpenWeatherMap API)
curl -X POST http://localhost:8000/api/recommend/generate \
  -H "Content-Type: application/json" \
  -d '{"site_id": "1cc35b4c-da27-4be2-bdb6-87435e253d9f", "forecast_hours": 24}'

# Check the logs - should NOT say "Using mock data"
```

## Mock Data vs Real Data

### Mock Data (Current)
- ✅ Realistic weather patterns
- ✅ Proper solar irradiance calculations
- ✅ No API calls required
- ✅ No rate limits
- ⚠️ Not actual weather predictions

### Real Data (with API key)
- ✅ Actual weather forecasts from OpenWeatherMap
- ✅ Real precipitation data
- ✅ Accurate cloud cover
- ✅ Professional-grade forecasts
- ⚠️ 1,000 calls/day limit (free tier)

## Rate Limiting & Caching

The weather service includes built-in protection against exceeding OpenWeatherMap's free tier limit (1,000 calls/day).

### How Caching Works

1. **First API Call**
   - Weather data is fetched from OpenWeatherMap
   - Response is cached in memory with timestamp
   - API call counter incremented
   - Data saved to database

2. **Subsequent Calls (within 3 hours)**
   - Cached data returned immediately
   - No API call made
   - No impact on daily limit
   - Logs show "Using cached weather data"

3. **After Cache Expires (3+ hours)**
   - Check if daily limit reached
   - If under limit: fetch fresh data
   - If limit reached: use expired cache or mock data
   - Graceful degradation - system never fails

### Monitoring API Usage

Check your current API usage:
```bash
curl http://localhost:8000/api/recommend/weather-api-usage
```

**Response:**
```json
{
  "success": true,
  "usage": {
    "calls_today": 15,
    "max_daily_calls": 900,
    "remaining_calls": 885,
    "date": "2025-11-07"
  }
}
```

### Configuration Options

In `ml-service/.env`:

```env
# Cache duration (default: 3 hours)
# Matches OpenWeatherMap's update frequency
WEATHER_CACHE_HOURS=3

# Max daily calls (default: 900)
# Leaves 100-call buffer from the 1,000 limit
WEATHER_MAX_DAILY_CALLS=900
```

### Benefits

- ✅ **Never exceed API limits** - automatic protection
- ✅ **Faster responses** - cached data returns instantly
- ✅ **Cost savings** - fewer API calls = more headroom
- ✅ **Reliability** - continues working even if limit reached
- ✅ **No manual management** - fully automatic

### Example Scenario

**MVP with 10 sites, checking every 30 minutes:**
- Without caching: 10 sites × 48 checks/day = **480 calls/day** ❌ (would fail)
- With caching: 10 sites × 8 checks/day = **80 calls/day** ✅ (well under limit)

The 3-hour cache means you only make 8 API calls per day per site, not 48!

## How It Works

1. **ML Service generates recommendations**
   - Fetches consumption forecast from Prophet
   - Fetches weather forecast (OpenWeatherMap or mock)
   - Calculates solar generation from irradiance
   - Saves all forecasts to database

2. **Weather Service calculates solar irradiance**
   - Time of day (solar noon peak)
   - Seasonal variation (summer vs winter)
   - Cloud cover reduction (up to 75%)
   - Returns W/m² irradiance

3. **Solar generation estimation**
   - Uses standard test conditions (1000 W/m²)
   - Panel efficiency: 20%
   - Performance ratio: 85%
   - Returns kW generation for 100kW capacity

4. **Database storage**
   - All 40 forecasts saved to `weather_forecasts` table
   - Includes temperature, wind, clouds, precipitation
   - Solar irradiance and generation estimates
   - 7-day retention policy

5. **API serves forecasts**
   - Next.js API endpoints expose forecast data
   - UI can display weather + solar charts
   - Always shows latest forecast generation

## Testing

### Check if forecasts are saved:
```bash
curl "http://localhost:3000/api/forecasts/weather?siteId=1cc35b4c-da27-4be2-bdb6-87435e253d9f&hours=5"
```

### Expected output:
- 40 forecasts total (5 days × 8 intervals)
- Temperature, clouds, wind, precipitation
- Solar irradiance (0 at night, ~500-800 W/m² peak)
- Solar generation (0 at night, ~40-70 kW peak for 100kW capacity)
- Data source: "mock" or "openweathermap"

## Next Steps for Production

1. **Get OpenWeatherMap API key** (free tier is fine for MVP)
2. **Add multiple site support** (different coordinates per site)
3. **Add weather alerts** (severe weather notifications)
4. **Enhance solar model** (use actual panel specs from sites table)
5. **Historical comparison** (compare forecast vs actual weather)
6. **Persistent caching** (optional: use Redis instead of in-memory cache)

## Troubleshooting

### "Using mock data" warning
- API key not configured in `.env`
- Check: `OPENWEATHER_API_KEY` in `ml-service/.env`

### No forecasts saved
- Check ML service logs for errors
- Verify database connection
- Check retention policy hasn't deleted them

### Solar generation always 0
- Check time of day (should be 0 at night)
- Verify cloud cover < 100%
- Check solar irradiance calculation

### "API call limit reached" warning
- Normal behavior - caching is working!
- System will use cached or mock data
- Limit resets at midnight (local time)
- Check usage: `curl http://localhost:8000/api/recommend/weather-api-usage`
- Increase cache duration in `.env` if needed

### Want to increase API call limit?
- Upgrade to paid OpenWeatherMap tier, OR
- Increase `WEATHER_CACHE_HOURS` to 6 or 12 hours
- Reduce `WEATHER_MAX_DAILY_CALLS` if too aggressive

## Summary

Your weather forecast system is **ready to use**! It's currently using realistic mock data that includes proper solar irradiance calculations. When you're ready for production, just add an OpenWeatherMap API key to get real weather forecasts!

**Current Stats:**
- ✅ 40 weather forecasts per generation
- ✅ Solar irradiance calculations working
- ✅ 7-day retention policy active
- ✅ API endpoints ready for UI integration
- ✅ Mock data providing realistic patterns
- ✅ **Automatic caching and rate limiting** - never exceed API limits!
- ✅ **API usage monitoring** - track your daily call count
