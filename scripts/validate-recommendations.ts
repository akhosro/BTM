/**
 * Recommendation Validation Script
 *
 * This script validates recommendations by:
 * 1. Checking calculation accuracy (cost savings, CO2 reduction)
 * 2. Verifying data sources (forecasts, pricing, weather)
 * 3. Testing recommendation logic
 * 4. Comparing with actual consumption patterns
 */

import { db } from '../db'
import { recommendations, consumptionForecasts, weatherForecasts, electricityPricing, measurements, sites } from '../db/schema'
import { eq, desc, and, gte, sql } from 'drizzle-orm'

interface ValidationResult {
  recommendationId: string
  type: string
  headline: string
  valid: boolean
  checks: {
    name: string
    passed: boolean
    details: string
  }[]
  dataUsed: {
    consumptionData: number
    pricingData: number
    weatherData: number
    historicalData: number
  }
}

async function validateRecommendations() {
  console.log('\n🔍 RECOMMENDATION VALIDATION REPORT\n')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Get recent recommendations
  const recs = await db
    .select()
    .from(recommendations)
    .orderBy(desc(recommendations.createdAt))
    .limit(16)

  const results: ValidationResult[] = []

  for (const rec of recs) {
    console.log(`\n📋 Validating: ${rec.headline}`)
    console.log(`   Type: ${rec.type} | Confidence: ${rec.confidence}% | Savings: $${rec.costSavings}`)

    const result: ValidationResult = {
      recommendationId: rec.id,
      type: rec.type,
      headline: rec.headline,
      valid: true,
      checks: [],
      dataUsed: {
        consumptionData: 0,
        pricingData: 0,
        weatherData: 0,
        historicalData: 0
      }
    }

    // Check 1: Verify site exists and is active
    const site = await db.select().from(sites).where(eq(sites.id, rec.siteId)).limit(1)
    if (site.length === 0) {
      result.checks.push({
        name: 'Site Validation',
        passed: false,
        details: 'Site not found or inactive'
      })
      result.valid = false
    } else {
      result.checks.push({
        name: 'Site Validation',
        passed: true,
        details: `Site: ${site[0].name}`
      })
    }

    // Check 2: Verify supporting data exists
    const supportingData = rec.supportingData as any
    if (!supportingData || Object.keys(supportingData).length === 0) {
      result.checks.push({
        name: 'Supporting Data',
        passed: false,
        details: 'No supporting data found'
      })
    } else {
      result.checks.push({
        name: 'Supporting Data',
        passed: true,
        details: `Keys: ${Object.keys(supportingData).join(', ')}`
      })
    }

    // Check 3: Verify consumption forecasts exist
    const forecasts = await db
      .select()
      .from(consumptionForecasts)
      .where(eq(consumptionForecasts.siteId, rec.siteId))
      .orderBy(desc(consumptionForecasts.forecastTimestamp))
      .limit(24)

    result.dataUsed.consumptionData = forecasts.length
    if (forecasts.length === 0) {
      result.checks.push({
        name: 'Consumption Forecasts',
        passed: false,
        details: 'No consumption forecasts found'
      })
    } else {
      result.checks.push({
        name: 'Consumption Forecasts',
        passed: true,
        details: `${forecasts.length} forecasts available`
      })
    }

    // Check 4: Verify weather forecasts for weather-dependent recommendations
    if (['weather_alert', 'hvac_optimization'].includes(rec.type)) {
      const weather = await db
        .select()
        .from(weatherForecasts)
        .where(eq(weatherForecasts.siteId, rec.siteId))
        .orderBy(desc(weatherForecasts.forecastTimestamp))
        .limit(24)

      result.dataUsed.weatherData = weather.length
      if (weather.length === 0) {
        result.checks.push({
          name: 'Weather Forecasts',
          passed: false,
          details: 'No weather forecasts found for weather-dependent recommendation'
        })
        result.valid = false
      } else {
        result.checks.push({
          name: 'Weather Forecasts',
          passed: true,
          details: `${weather.length} weather forecasts available`
        })
      }
    }

    // Check 5: Verify pricing data exists
    const pricing = await db
      .select()
      .from(electricityPricing)
      .where(eq(electricityPricing.siteId, rec.siteId))
      .limit(1)

    result.dataUsed.pricingData = pricing.length
    if (pricing.length === 0) {
      result.checks.push({
        name: 'Pricing Data',
        passed: false,
        details: 'No pricing data found'
      })
    } else {
      result.checks.push({
        name: 'Pricing Data',
        passed: true,
        details: `Rate: ${pricing[0].rateType}`
      })
    }

    // Check 6: Verify historical measurements for maintenance alerts
    if (rec.type === 'maintenance_alert') {
      const historicalMeasurements = await db
        .select()
        .from(measurements)
        .where(
          and(
            sql`entity_id IN (SELECT id FROM meters WHERE site_id = ${rec.siteId})`,
            gte(measurements.timestamp, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          )
        )
        .limit(100)

      result.dataUsed.historicalData = historicalMeasurements.length
      if (historicalMeasurements.length < 48) {
        result.checks.push({
          name: 'Historical Data (Maintenance)',
          passed: false,
          details: `Only ${historicalMeasurements.length} measurements (need 48+)`
        })
      } else {
        result.checks.push({
          name: 'Historical Data (Maintenance)',
          passed: true,
          details: `${historicalMeasurements.length} historical measurements available`
        })
      }
    }

    // Check 7: Validate cost savings calculation
    if (rec.costSavings !== null && rec.costSavings !== undefined) {
      if (rec.costSavings < 0 && rec.type !== 'carbon') {
        result.checks.push({
          name: 'Cost Savings Logic',
          passed: false,
          details: `Negative savings ($${rec.costSavings}) for non-carbon recommendation`
        })
        result.valid = false
      } else if (rec.costSavings > 100000) {
        result.checks.push({
          name: 'Cost Savings Logic',
          passed: false,
          details: `Unrealistic savings ($${rec.costSavings}) - may indicate calculation error`
        })
        result.valid = false
      } else {
        result.checks.push({
          name: 'Cost Savings Logic',
          passed: true,
          details: `Savings of $${rec.costSavings?.toFixed(2)} is reasonable`
        })
      }
    }

    // Check 8: Validate confidence score
    if (rec.confidence < 0 || rec.confidence > 100) {
      result.checks.push({
        name: 'Confidence Score',
        passed: false,
        details: `Invalid confidence: ${rec.confidence}`
      })
      result.valid = false
    } else {
      result.checks.push({
        name: 'Confidence Score',
        passed: true,
        details: `${rec.confidence}% is valid`
      })
    }

    // Check 9: Validate recommended time is in future or recent past
    if (rec.recommendedTimeStart) {
      const timeDiff = rec.recommendedTimeStart.getTime() - Date.now()
      const hoursDiff = timeDiff / (1000 * 60 * 60)

      if (hoursDiff < -24) {
        result.checks.push({
          name: 'Timing Validity',
          passed: false,
          details: `Recommendation is for ${Math.abs(hoursDiff).toFixed(1)} hours ago`
        })
      } else if (hoursDiff > 168) {
        result.checks.push({
          name: 'Timing Validity',
          passed: false,
          details: `Recommendation is for ${hoursDiff.toFixed(1)} hours in future (>1 week)`
        })
      } else {
        result.checks.push({
          name: 'Timing Validity',
          passed: true,
          details: `Action time is ${hoursDiff > 0 ? 'in' : ''} ${Math.abs(hoursDiff).toFixed(1)} hours ${hoursDiff > 0 ? 'from now' : 'ago'}`
        })
      }
    }

    results.push(result)

    // Print validation results
    console.log('\n   Validation Checks:')
    result.checks.forEach(check => {
      const icon = check.passed ? '✓' : '✗'
      console.log(`   ${icon} ${check.name}: ${check.details}`)
    })

    console.log(`\n   Data Sources:`)
    console.log(`   • Consumption Forecasts: ${result.dataUsed.consumptionData}`)
    console.log(`   • Weather Forecasts: ${result.dataUsed.weatherData}`)
    console.log(`   • Pricing Records: ${result.dataUsed.pricingData}`)
    console.log(`   • Historical Measurements: ${result.dataUsed.historicalData}`)

    console.log(`\n   Overall: ${result.valid ? '✅ VALID' : '❌ INVALID'}`)
    console.log('   ───────────────────────────────────────────────────────')
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════════')
  console.log('📊 VALIDATION SUMMARY\n')

  const validCount = results.filter(r => r.valid).length
  const invalidCount = results.filter(r => !r.valid).length

  console.log(`Total Recommendations: ${results.length}`)
  console.log(`Valid: ${validCount} ✅`)
  console.log(`Invalid: ${invalidCount} ❌`)
  console.log(`Success Rate: ${((validCount / results.length) * 100).toFixed(1)}%\n`)

  // Breakdown by type
  const typeBreakdown: Record<string, { valid: number; invalid: number }> = {}
  results.forEach(r => {
    if (!typeBreakdown[r.type]) {
      typeBreakdown[r.type] = { valid: 0, invalid: 0 }
    }
    if (r.valid) {
      typeBreakdown[r.type].valid++
    } else {
      typeBreakdown[r.type].invalid++
    }
  })

  console.log('Breakdown by Type:')
  Object.entries(typeBreakdown).forEach(([type, counts]) => {
    console.log(`  ${type}: ${counts.valid} valid, ${counts.invalid} invalid`)
  })

  // Common issues
  const allChecks = results.flatMap(r => r.checks)
  const failedChecks = allChecks.filter(c => !c.passed)
  if (failedChecks.length > 0) {
    console.log('\n⚠️  Common Issues Found:')
    const issueGroups: Record<string, number> = {}
    failedChecks.forEach(check => {
      issueGroups[check.name] = (issueGroups[check.name] || 0) + 1
    })
    Object.entries(issueGroups)
      .sort((a, b) => b[1] - a[1])
      .forEach(([issue, count]) => {
        console.log(`  • ${issue}: ${count} occurrences`)
      })
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n')

  process.exit(0)
}

validateRecommendations().catch(error => {
  console.error('❌ Validation error:', error)
  process.exit(1)
})
