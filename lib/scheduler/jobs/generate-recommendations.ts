/**
 * AI Recommendations Generation Job
 *
 * Orchestrates recommendation generation by calling the Python ML service
 * The Python service provides:
 * - Prophet-based consumption forecasting
 * - Weather-enhanced solar forecasting
 * - ML-powered recommendations
 *
 * This job acts as an orchestration layer that:
 * 1. Calls Python ML service for each site
 * 2. Falls back to rule-based recommendations if ML service unavailable
 */

import { db } from "@/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Call Python ML service to generate recommendations
 */
async function callMLService(siteId: string): Promise<{ success: boolean; saved_count: number; forecasts_saved: number; weather_forecasts_saved: number }> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/api/recommend/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: siteId,
        forecast_hours: 24,
        training_days: 7,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      saved_count: data.saved_count || 0,
      forecasts_saved: data.forecasts_saved || 0,
      weather_forecasts_saved: data.weather_forecasts_saved || 0,
    };
  } catch (error) {
    console.error(`   ⚠️  ML service call failed:`, error);
    return { success: false, saved_count: 0, forecasts_saved: 0, weather_forecasts_saved: 0 };
  }
}

/**
 * Check if ML service is available
 */
async function checkMLServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function generateRecommendations() {
  const startTime = Date.now();
  let totalGenerated = 0;
  let totalForecasts = 0;
  let totalWeatherForecasts = 0;
  let sitesProcessed = 0;

  try {
    // Check if ML service is available
    const mlServiceAvailable = await checkMLServiceHealth();

    if (!mlServiceAvailable) {
      console.warn(`   ⚠️  Python ML service not available at ${ML_SERVICE_URL}`);
      console.warn(`   ⚠️  Skipping recommendation generation. Start ML service with: cd ml-service && python -m app.main`);
      return { totalGenerated: 0, duration: Date.now() - startTime, error: "ML service unavailable" };
    }

    console.log(`   ✅ Python ML service is healthy`);

    // Get all active sites
    const activeSites = await db
      .select()
      .from(sites)
      .where(eq(sites.active, true));

    console.log(`   Analyzing ${activeSites.length} sites for optimization opportunities`);

    for (const site of activeSites) {
      try {
        console.log(`   🔍 Calling ML service for ${site.name}...`);

        const result = await callMLService(site.id);

        if (result.success) {
          totalGenerated += result.saved_count;
          totalForecasts += result.forecasts_saved;
          totalWeatherForecasts += result.weather_forecasts_saved;
          sitesProcessed++;
          console.log(`   ✅ Generated ${result.saved_count} recommendations, ${result.forecasts_saved} forecasts, ${result.weather_forecasts_saved} weather forecasts for ${site.name}`);
        } else {
          console.error(`   ❌ Failed to generate recommendations for ${site.name}`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${site.name}:`, error);
        // Continue with other sites
      }
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Processed ${sitesProcessed}/${activeSites.length} sites in ${duration}ms`);
    console.log(`   📊 Total: ${totalGenerated} recommendations, ${totalForecasts} consumption forecasts, ${totalWeatherForecasts} weather forecasts`);

    return { totalGenerated, totalForecasts, totalWeatherForecasts, sitesProcessed, duration };
  } catch (error) {
    console.error("   ❌ Recommendation generation error:", error);
    throw error;
  }
}

/**
 * Configuration:
 *
 * Set ML_SERVICE_URL environment variable to point to Python ML service:
 *   ML_SERVICE_URL=http://localhost:8000 (default)
 *
 * The ML service must be running for this job to generate recommendations.
 * Start it with: cd ml-service && python -m app.main
 *
 * If the ML service is unavailable, this job will log a warning and skip
 * recommendation generation until the service is back online.
 */
