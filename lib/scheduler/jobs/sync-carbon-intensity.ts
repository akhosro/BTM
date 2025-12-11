/**
 * Carbon Intensity Sync Job
 *
 * Fetches grid carbon intensity forecasts for all active sites
 * Data sources: WattTime, ElectricityMaps, or similar APIs
 */

import { db } from "@/db";
import { sites, gridCarbonIntensity } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCarbonIntensityForecast } from "@/lib/external-data/carbon-intensity-api";

/**
 * Fetch carbon intensity forecast using real API or fallback
 */
async function fetchCarbonIntensityForecast(
  gridZone: string,
  latitude: number,
  longitude: number
) {
  try {
    // Use real WattTime API if credentials configured
    const forecasts = await getCarbonIntensityForecast(latitude, longitude, 24);

    // Convert to database format - use grid zone instead of region text
    return forecasts.map((forecast) => ({
      region: gridZone, // Use standardized grid zone (e.g., CA-ON, US-CAL-CISO)
      gridOperator: null, // WattTime doesn't provide this directly
      timestamp: forecast.timestamp,
      carbonIntensity: forecast.carbonIntensity,
      generationMix: null, // Not provided by WattTime free tier
      forecastType: forecast.confidence ? "forecast" : "estimated",
      forecastHorizonHours: null,
      dataSource: forecast.source,
      confidence: forecast.confidence || null,
      metadata: {},
    }));
  } catch (error) {
    console.warn(`   ⚠️  WattTime API unavailable for ${gridZone}, using fallback model`);

    // Fallback: Generate realistic mock forecasts
    const now = new Date();
    const fallbackForecasts = [];

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now);
      timestamp.setHours(now.getHours() + hour, 0, 0, 0);

      const forecastHour = timestamp.getHours();

      // Realistic carbon intensity pattern (gCO2/kWh)
      let intensity = 300; // Base intensity

      // Lower during solar hours (10 AM - 4 PM)
      if (forecastHour >= 10 && forecastHour < 16) {
        intensity = 200 + Math.random() * 50;
      }
      // Higher during evening peak (6 PM - 10 PM) when gas plants ramp up
      else if (forecastHour >= 18 && forecastHour < 22) {
        intensity = 450 + Math.random() * 100;
      }
      // Moderate during night (more wind, some coal)
      else {
        intensity = 300 + Math.random() * 80;
      }

      fallbackForecasts.push({
        region: gridZone, // Use standardized grid zone
        gridOperator: null,
        timestamp,
        carbonIntensity: Math.round(intensity),
        generationMix: null,
        forecastType: "estimated",
        forecastHorizonHours: null,
        dataSource: "estimated",
        confidence: 0.5,
        metadata: {},
      });
    }

    return fallbackForecasts;
  }
}

export async function syncCarbonIntensity() {
  const startTime = Date.now();
  let totalSynced = 0;

  try {
    // Get all active sites
    const activeSites = await db
      .select()
      .from(sites)
      .where(eq(sites.active, true));

    console.log(`   Found ${activeSites.length} active sites`);

    // Sync carbon intensity for each site with coordinates and grid zone
    for (const site of activeSites) {
      // Skip sites without coordinates or grid zone
      if (!site.latitude || !site.longitude) {
        console.log(`   ⚠️  Skipping ${site.name} - no coordinates configured`);
        continue;
      }

      if (!site.gridZone) {
        console.log(`   ⚠️  Skipping ${site.name} - no grid zone configured`);
        continue;
      }

      try {
        const forecasts = await fetchCarbonIntensityForecast(
          site.gridZone,
          site.latitude,
          site.longitude
        );

        // Insert forecasts into database
        if (forecasts.length > 0) {
          // Insert all forecasts (no unique constraint to upsert on)
          for (const forecast of forecasts) {
            await db
              .insert(gridCarbonIntensity)
              .values(forecast)
              .onConflictDoNothing(); // Avoid duplicates if same region+timestamp exists
          }

          totalSynced += forecasts.length;
          console.log(
            `   ✅ Synced ${forecasts.length} forecasts for ${site.name} (${forecasts[0].dataSource})`
          );
        }
      } catch (error) {
        console.error(`   ❌ Failed to sync carbon intensity for ${site.name}:`, error);
        // Continue with other sites
      }
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Synced ${totalSynced} carbon intensity forecasts in ${duration}ms`);

    return { totalSynced, duration };
  } catch (error) {
    console.error("   ❌ Carbon intensity sync error:", error);
    throw error;
  }
}

/**
 * Configuration:
 *
 * To use real-time carbon intensity data, configure WattTime credentials in .env:
 *   WATTTIME_USERNAME=your_username
 *   WATTTIME_PASSWORD=your_password
 *
 * Sign up at: https://www.watttime.org/api-documentation/
 *
 * Without credentials, the job falls back to estimated carbon intensity patterns.
 */
