/**
 * Sync ISO Market Prices Script
 *
 * Fetches and stores IESO wholesale electricity market prices.
 * Includes both day-ahead forecasts and historical actual prices.
 */

import { db } from '../db'
import { isoMarketPrices } from '../db/schema'
import { fetchIESOForecastPrices, fetchIESOActualPrices } from '../lib/services/ieso-api'
import { and, eq } from 'drizzle-orm'

async function syncISOPrices() {
  console.log('🚀 Starting IESO market prices sync...\n')
  const startTime = Date.now()

  const results = {
    forecast: { fetched: 0, stored: 0, skipped: 0 },
    actual: { fetched: 0, stored: 0, skipped: 0 },
  }

  try {
    // ===== SYNC FORECAST PRICES =====
    console.log('📈 Fetching day-ahead forecast prices...')

    const forecastPrices = await fetchIESOForecastPrices()
    results.forecast.fetched = forecastPrices.length
    console.log(`   Found ${forecastPrices.length} forecast price points`)

    const now = new Date()

    for (const priceData of forecastPrices) {
      // Check if this exact forecast already exists
      const existing = await db.query.isoMarketPrices.findFirst({
        where: and(
          eq(isoMarketPrices.iso, 'IESO'),
          eq(isoMarketPrices.timestamp, priceData.timestamp),
          eq(isoMarketPrices.priceType, 'forecast'),
          eq(isoMarketPrices.forecastedAt, priceData.forecastedAt!)
        ),
      })

      if (existing) {
        results.forecast.skipped++
        continue
      }

      // Store the forecast price
      await db.insert(isoMarketPrices).values({
        iso: 'IESO',
        region: 'Ontario',
        priceType: 'forecast',
        marketType: 'energy',
        timestamp: priceData.timestamp,
        price: priceData.price,
        currency: 'CAD',
        forecastedAt: priceData.forecastedAt,
        forecastHorizonHours: priceData.forecastHorizonHours?.toString(),
        dataSource: 'IESO_API',
        metadata: {
          syncedAt: now.toISOString(),
        },
      })

      results.forecast.stored++
    }

    console.log(`   ✓ Stored ${results.forecast.stored} new forecasts`)
    console.log(`   ⊘ Skipped ${results.forecast.skipped} duplicates\n`)

    // ===== SYNC ACTUAL PRICES (LAST 7 DAYS) =====
    console.log('📊 Fetching actual prices (last 7 days)...')

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)

    console.log(`   Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

    const actualPrices = await fetchIESOActualPrices(startDate, endDate)
    results.actual.fetched = actualPrices.length
    console.log(`   Found ${actualPrices.length} actual price points`)

    for (const priceData of actualPrices) {
      // Check if this actual price already exists
      const existing = await db.query.isoMarketPrices.findFirst({
        where: and(
          eq(isoMarketPrices.iso, 'IESO'),
          eq(isoMarketPrices.timestamp, priceData.timestamp),
          eq(isoMarketPrices.priceType, 'actual')
        ),
      })

      if (existing) {
        results.actual.skipped++
        continue
      }

      // Store the actual price
      await db.insert(isoMarketPrices).values({
        iso: 'IESO',
        region: 'Ontario',
        priceType: 'actual',
        marketType: 'energy',
        timestamp: priceData.timestamp,
        price: priceData.price,
        currency: 'CAD',
        dataSource: 'IESO_API',
        metadata: {
          syncedAt: new Date().toISOString(),
        },
      })

      results.actual.stored++
    }

    console.log(`   ✓ Stored ${results.actual.stored} new actual prices`)
    console.log(`   ⊘ Skipped ${results.actual.skipped} duplicates\n`)

    // ===== SUMMARY =====
    const duration = Date.now() - startTime
    console.log('═══════════════════════════════════════════════════════')
    console.log(`✨ ISO prices sync completed in ${(duration / 1000).toFixed(2)}s`)
    console.log('═══════════════════════════════════════════════════════')
    console.log('\n📊 Summary:')
    console.log(`   Forecast prices: ${results.forecast.stored} stored, ${results.forecast.skipped} skipped`)
    console.log(`   Actual prices:   ${results.actual.stored} stored, ${results.actual.skipped} skipped`)
    console.log(`\n   Total new records: ${results.forecast.stored + results.actual.stored}`)

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Error syncing ISO prices:', error)
    console.error('\nPossible causes:')
    console.error('  - IESO API is temporarily unavailable')
    console.error('  - Network connectivity issues')
    console.error('  - Date range too far in the past/future')
    process.exit(1)
  }
}

syncISOPrices()
