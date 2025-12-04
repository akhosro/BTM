/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server starts
 * Perfect for initializing background services like our scheduler
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only run on Node.js runtime (not Edge)
    const { initializeScheduler } = await import("./lib/scheduler/server");
    initializeScheduler();
  }
}
