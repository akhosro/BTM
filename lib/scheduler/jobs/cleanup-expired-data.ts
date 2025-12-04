/**
 * Data Cleanup Job
 *
 * Removes expired and old data to keep database performant:
 * - Expired recommendations
 * - Old carbon intensity forecasts
 * - Measurement data older than retention period
 */

import { db } from "@/db";
import { recommendations, gridCarbonIntensity, measurements } from "@/db/schema";
import { lt, and, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Data retention periods
const RETENTION_DAYS = {
  measurements: 395, // ~13 months of measurement data
  carbonForecasts: 7, // 7 days of carbon forecasts
  recommendations: 90, // 90 days for expired recommendations
};

export async function cleanupExpiredData() {
  const startTime = Date.now();
  let totalDeleted = 0;

  try {
    const now = new Date();

    // 1. Delete expired recommendations
    console.log("   🗑️  Cleaning up expired recommendations...");
    const expiredRecsDate = new Date(now.getTime() - RETENTION_DAYS.recommendations * 24 * 60 * 60 * 1000);

    const deletedRecs = await db
      .delete(recommendations)
      .where(
        and(
          isNotNull(recommendations.expiresAt),
          lt(recommendations.expiresAt, expiredRecsDate)
        )
      );

    // Get count from result if available, otherwise estimate
    const recsDeleted = (deletedRecs as any).count || 0;
    totalDeleted += recsDeleted;
    console.log(`   ✅ Deleted ${recsDeleted} expired recommendations`);

    // 2. Delete old carbon intensity forecasts
    console.log("   🗑️  Cleaning up old carbon forecasts...");
    const oldForecastDate = new Date(now.getTime() - RETENTION_DAYS.carbonForecasts * 24 * 60 * 60 * 1000);

    const deletedForecasts = await db
      .delete(gridCarbonIntensity)
      .where(lt(gridCarbonIntensity.timestamp, oldForecastDate));

    const forecastsDeleted = (deletedForecasts as any).count || 0;
    totalDeleted += forecastsDeleted;
    console.log(`   ✅ Deleted ${forecastsDeleted} old carbon forecasts`);

    // 3. Delete old measurements (keep last 13 months)
    console.log("   🗑️  Cleaning up old measurement data...");
    const oldMeasurementDate = new Date(now.getTime() - RETENTION_DAYS.measurements * 24 * 60 * 60 * 1000);

    const deletedMeasurements = await db
      .delete(measurements)
      .where(lt(measurements.timestamp, oldMeasurementDate));

    const measurementsDeleted = (deletedMeasurements as any).count || 0;
    totalDeleted += measurementsDeleted;
    console.log(`   ✅ Deleted ${measurementsDeleted} old measurements`);

    // 4. Vacuum analyze to reclaim space (PostgreSQL specific)
    console.log("   🔧 Running database optimization...");
    try {
      await db.execute(sql`VACUUM ANALYZE measurements`);
      await db.execute(sql`VACUUM ANALYZE grid_carbon_intensity`);
      await db.execute(sql`VACUUM ANALYZE recommendations`);
      console.log("   ✅ Database optimization completed");
    } catch (error) {
      console.warn("   ⚠️  Database optimization skipped (may require superuser privileges)");
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Cleanup complete: ${totalDeleted} records deleted in ${duration}ms`);

    return { totalDeleted, duration };
  } catch (error) {
    console.error("   ❌ Data cleanup error:", error);
    throw error;
  }
}

/**
 * Get database size statistics
 */
export async function getDatabaseStats() {
  try {
    const stats = {
      measurements: 0,
      carbonIntensity: 0,
      recommendations: 0,
    };

    // Count measurements
    const measurementCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM measurements`
    );
    const measurementRow = measurementCount[0] as any;
    stats.measurements = Number(measurementRow?.count || 0);

    // Count carbon intensity records
    const carbonCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM grid_carbon_intensity`
    );
    const carbonRow = carbonCount[0] as any;
    stats.carbonIntensity = Number(carbonRow?.count || 0);

    // Count recommendations
    const recsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM recommendations`
    );
    const recsRow = recsCount[0] as any;
    stats.recommendations = Number(recsRow?.count || 0);

    return stats;
  } catch (error) {
    console.error("Error getting database stats:", error);
    return null;
  }
}
