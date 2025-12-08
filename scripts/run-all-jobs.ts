/**
 * Run All Background Jobs Script
 *
 * This script runs all background jobs to populate the database with fresh data:
 * - Sync carbon intensity forecasts
 * - Generate consumption forecasts, weather forecasts, and recommendations
 * - Sync energy data from connected sources
 */

import { syncCarbonIntensity } from '../lib/scheduler/jobs/sync-carbon-intensity'
import { generateRecommendations } from '../lib/scheduler/jobs/generate-recommendations'
import { syncAllEnergyData } from '../lib/scheduler/jobs/sync-energy-data'

async function runAllJobs() {
  console.log('🚀 Starting all background jobs...\n')
  const startTime = Date.now()

  try {
    // Job 1: Sync Carbon Intensity
    console.log('📊 Job 1/3: Syncing grid carbon intensity forecasts...')
    await syncCarbonIntensity()
    console.log('✅ Carbon intensity sync complete\n')

    // Job 2: Generate Recommendations (includes consumption & weather forecasts)
    console.log('🤖 Job 2/3: Generating AI recommendations and forecasts...')
    console.log('   (This also generates consumption and weather forecasts)\n')
    await generateRecommendations()
    console.log('✅ Recommendations generation complete\n')

    // Job 3: Sync Energy Data
    console.log('⚡ Job 3/3: Syncing energy data from connected sources...')
    await syncAllEnergyData()
    console.log('✅ Energy data sync complete\n')

    const duration = Date.now() - startTime
    console.log('═══════════════════════════════════════════════════════')
    console.log(`✨ All jobs completed successfully in ${(duration / 1000).toFixed(2)}s`)
    console.log('═══════════════════════════════════════════════════════')
    console.log('\n📊 Data populated in these tables:')
    console.log('   ✓ grid_carbon_intensity')
    console.log('   ✓ consumption_forecasts')
    console.log('   ✓ weather_forecasts')
    console.log('   ✓ recommendations')
    console.log('   ✓ measurements (from connected sources)')
    console.log('\n💡 To sync ISO market prices, run:')
    console.log('   npx tsx scripts/sync-iso-prices.ts')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error running jobs:', error)
    process.exit(1)
  }
}

runAllJobs()
