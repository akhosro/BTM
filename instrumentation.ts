/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server starts
 * Perfect for initializing background services like our scheduler
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run at actual runtime, not during build
  // Check multiple build-time indicators
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export' ||
    process.argv.includes('build') ||
    process.argv.includes('export')
  ) {
    console.log('📅 Skipping scheduler initialization during build');
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // Only run on Node.js runtime (not Edge)
      const { initializeScheduler } = await import("./lib/scheduler/server");
      initializeScheduler();
    } catch (error) {
      console.error('❌ Failed to initialize scheduler:', error);
      // Don't throw - allow app to start even if scheduler fails
    }
  }
}
