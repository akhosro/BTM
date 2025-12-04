/**
 * Scheduler Server Integration
 *
 * This file is imported by the Next.js app to start background jobs
 * It runs only on the server side, not in the browser
 */

import { startScheduler, stopScheduler } from "./index";

let isSchedulerStarted = false;

/**
 * Initialize scheduler on server start
 * This is called automatically when the Next.js app starts
 */
export function initializeScheduler() {
  // Only run in production or when explicitly enabled
  const shouldRun =
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_SCHEDULER === "true";

  if (!shouldRun) {
    console.log(
      "📅 Background scheduler disabled in development. Set ENABLE_SCHEDULER=true to enable."
    );
    return;
  }

  if (isSchedulerStarted) {
    console.log("📅 Scheduler already running");
    return;
  }

  try {
    startScheduler();
    isSchedulerStarted = true;

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Received SIGINT, stopping scheduler...");
      stopScheduler();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\n🛑 Received SIGTERM, stopping scheduler...");
      stopScheduler();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start scheduler:", error);
  }
}

// Auto-initialize when module is imported (server-side only)
if (typeof window === "undefined") {
  initializeScheduler();
}
