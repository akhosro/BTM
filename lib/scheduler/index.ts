/**
 * Background Job Scheduler
 *
 * Manages automated data syncing and periodic tasks:
 * - Syncs energy data from connected sources (Enphase, SolarEdge, Tesla, UtilityAPI)
 * - Fetches grid carbon intensity forecasts
 * - Generates AI recommendations
 * - Cleans up expired data
 */

import cron from "node-cron";
import { syncAllEnergyData } from "./jobs/sync-energy-data";
import { syncCarbonIntensity } from "./jobs/sync-carbon-intensity";
import { generateRecommendations } from "./jobs/generate-recommendations";
import { cleanupExpiredData } from "./jobs/cleanup-expired-data";

// Track running jobs for graceful shutdown
const activeJobs: cron.ScheduledTask[] = [];

/**
 * Initialize all scheduled jobs
 */
export function startScheduler() {
  console.log("📅 Starting background job scheduler...");

  // Job 1: Sync energy data every 15 minutes
  const energySyncJob = cron.schedule("*/15 * * * *", async () => {
    console.log("🔄 [Job] Syncing energy data from all sources...");
    try {
      await syncAllEnergyData();
      console.log("✅ [Job] Energy data sync completed");
    } catch (error) {
      console.error("❌ [Job] Energy data sync failed:", error);
    }
  });
  activeJobs.push(energySyncJob);

  // Job 2: Sync carbon intensity forecasts every hour
  const carbonSyncJob = cron.schedule("0 * * * *", async () => {
    console.log("🔄 [Job] Syncing grid carbon intensity forecasts...");
    try {
      await syncCarbonIntensity();
      console.log("✅ [Job] Carbon intensity sync completed");
    } catch (error) {
      console.error("❌ [Job] Carbon intensity sync failed:", error);
    }
  });
  activeJobs.push(carbonSyncJob);

  // Job 3: Generate AI recommendations every 6 hours
  const recommendationsJob = cron.schedule("0 */6 * * *", async () => {
    console.log("🔄 [Job] Generating AI recommendations...");
    try {
      await generateRecommendations();
      console.log("✅ [Job] AI recommendations generated");
    } catch (error) {
      console.error("❌ [Job] Recommendation generation failed:", error);
    }
  });
  activeJobs.push(recommendationsJob);

  // Job 4: Cleanup expired data daily at 2 AM
  const cleanupJob = cron.schedule("0 2 * * *", async () => {
    console.log("🔄 [Job] Cleaning up expired data...");
    try {
      await cleanupExpiredData();
      console.log("✅ [Job] Data cleanup completed");
    } catch (error) {
      console.error("❌ [Job] Data cleanup failed:", error);
    }
  });
  activeJobs.push(cleanupJob);

  console.log("✅ Scheduler started with 4 jobs:");
  console.log("   - Energy data sync: Every 15 minutes");
  console.log("   - Carbon intensity: Every hour");
  console.log("   - AI recommendations: Every 6 hours");
  console.log("   - Data cleanup: Daily at 2 AM");
}

/**
 * Stop all scheduled jobs gracefully
 */
export function stopScheduler() {
  console.log("🛑 Stopping background job scheduler...");
  activeJobs.forEach((job) => job.stop());
  console.log("✅ All scheduled jobs stopped");
}

/**
 * Trigger a specific job manually (for testing/debugging)
 */
export async function runJobManually(jobName: string) {
  console.log(`🔧 Manually triggering job: ${jobName}`);

  switch (jobName) {
    case "sync-energy":
      await syncAllEnergyData();
      break;
    case "sync-carbon":
      await syncCarbonIntensity();
      break;
    case "generate-recommendations":
      await generateRecommendations();
      break;
    case "cleanup":
      await cleanupExpiredData();
      break;
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }

  console.log(`✅ Job completed: ${jobName}`);
}
