import { db } from '../db'
import { measurements, meters, sites } from '../db/schema'
import { eq } from 'drizzle-orm'

/**
 * Seed script to generate realistic measurement data for Control Room testing
 *
 * Generates hourly measurements for the past 7 days for all meters:
 * - CONS (Consumption): Realistic consumption patterns with day/night variation
 * - PROD (Production): Solar generation with daily cycle and weather variation
 * - STOR (Storage): Charge/discharge cycles
 * - INJ (Injection): Grid export based on excess generation
 */

// Helper to generate timestamps for the past N days at hourly intervals
function generateTimestamps(days: number = 7): Date[] {
  const timestamps: Date[] = []
  const now = new Date()
  const startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Round to nearest hour
  startTime.setMinutes(0, 0, 0)

  for (let i = 0; i < days * 24; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60 * 60 * 1000)
    timestamps.push(timestamp)
  }

  return timestamps
}

// Helper to add random variation
function addRandomVariation(value: number, variationPercent: number = 10): number {
  const variation = (Math.random() - 0.5) * 2 * (variationPercent / 100)
  return Math.max(0, value * (1 + variation))
}

// Generate consumption pattern (higher during day, lower at night)
function generateConsumptionValue(
  timestamp: Date,
  baseLoad: number,
  peakLoad: number,
  meterType: 'building' | 'hvac' | 'equipment' | 'lighting' = 'building'
): number {
  const hour = timestamp.getHours()
  const dayOfWeek = timestamp.getDay() // 0 = Sunday, 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

  let load = baseLoad

  switch (meterType) {
    case 'building':
      // Standard building load: peak during business hours
      if (hour >= 8 && hour < 18) {
        load = peakLoad
      } else if (hour >= 6 && hour < 20) {
        load = baseLoad + (peakLoad - baseLoad) * 0.5
      }
      // Weekend reduction
      if (isWeekend) {
        load *= 0.6
      }
      break

    case 'hvac':
      // HVAC: higher during day, weather dependent
      if (hour >= 7 && hour < 19) {
        load = peakLoad
      } else if (hour >= 5 && hour < 22) {
        load = baseLoad + (peakLoad - baseLoad) * 0.4
      }
      if (isWeekend) {
        load *= 0.7
      }
      break

    case 'equipment':
      // Equipment: 24/7 operation with slight day variation
      if (hour >= 8 && hour < 18) {
        load = peakLoad
      } else {
        load = baseLoad + (peakLoad - baseLoad) * 0.7
      }
      if (isWeekend) {
        load *= 0.5
      }
      break

    case 'lighting':
      // Lighting: high during night/early morning, low during day
      if (hour >= 7 && hour < 17) {
        load = baseLoad
      } else {
        load = peakLoad
      }
      if (isWeekend) {
        load *= 0.8
      }
      break
  }

  return addRandomVariation(load, 15)
}

// Generate solar production (peak at noon, zero at night)
function generateSolarProduction(timestamp: Date, capacity: number): number {
  const hour = timestamp.getHours()

  // Solar production follows a sine curve during daylight hours
  if (hour < 6 || hour > 19) {
    return 0
  }

  // Peak at solar noon (around 1 PM)
  const solarNoon = 13
  const hoursFromNoon = Math.abs(hour - solarNoon)

  // Sine curve for production
  const productionFactor = Math.cos((hoursFromNoon / 7) * (Math.PI / 2))

  // Weather variation (cloudy days reduce production)
  const weatherFactor = 0.7 + Math.random() * 0.3 // 70-100% of ideal

  const production = capacity * productionFactor * weatherFactor

  return Math.max(0, addRandomVariation(production, 20))
}

// Generate storage charge/discharge pattern
function generateStorageValue(
  timestamp: Date,
  capacity: number,
  productionValue: number,
  consumptionValue: number
): number {
  const hour = timestamp.getHours()

  // Charge during high solar production (10 AM - 2 PM)
  // Discharge during peak demand (5 PM - 9 PM)

  let storageValue = 0

  if (hour >= 10 && hour < 15) {
    // Charging (positive values) - store excess solar
    const excess = Math.max(0, productionValue - consumptionValue)
    storageValue = Math.min(capacity * 0.3, excess * 0.8) // Charge at 80% efficiency
  } else if (hour >= 17 && hour < 22) {
    // Discharging (negative values) - supplement consumption
    storageValue = -(capacity * 0.2) // Discharge 20% of capacity
  } else if (hour >= 22 || hour < 6) {
    // Light charging overnight if there's grid power
    storageValue = capacity * 0.05
  }

  return addRandomVariation(storageValue, 10)
}

// Generate grid injection (export) value
function generateInjectionValue(
  productionValue: number,
  consumptionValue: number,
  storageCharging: number
): number {
  // Inject when production exceeds consumption + storage charging
  const excess = productionValue - consumptionValue - Math.max(0, storageCharging)
  return Math.max(0, excess * 0.95) // 95% efficiency for grid export
}

async function seedMeasurementData() {
  console.log('🌱 Starting measurement data seeding...')

  // Get all meters with their sites
  const allMeters = await db.select({
    meter: meters,
    site: sites
  })
    .from(meters)
    .innerJoin(sites, eq(meters.siteId, sites.id))

  if (allMeters.length === 0) {
    console.error('❌ No meters found. Please run seed-control-room-test-data.ts first.')
    process.exit(1)
  }

  console.log(`✅ Found ${allMeters.length} meters to populate`)

  // Generate timestamps for the past 7 days
  const timestamps = generateTimestamps(7)
  console.log(`📅 Generating ${timestamps.length} measurements per meter (7 days, hourly)`)

  // Delete existing measurements
  console.log('🧹 Cleaning up existing measurements...')
  await db.delete(measurements)

  let totalMeasurements = 0

  for (const { meter, site } of allMeters) {
    console.log(`\n📊 Processing: ${site.name} - ${meter.name} (${meter.category})`)

    // Determine meter characteristics based on name and category
    const capacity = meter.capacity || 100
    const baseLoad = capacity * 0.3
    const peakLoad = capacity * 0.85

    // Determine meter type for consumption patterns
    let meterType: 'building' | 'hvac' | 'equipment' | 'lighting' = 'building'
    const meterName = meter.name.toLowerCase()
    if (meterName.includes('cooling') || meterName.includes('hvac') || meterName.includes('chiller')) {
      meterType = 'hvac'
    } else if (meterName.includes('server') || meterName.includes('equipment') || meterName.includes('conveyor')) {
      meterType = 'equipment'
    } else if (meterName.includes('lighting')) {
      meterType = 'lighting'
    }

    const measurementsToInsert: any[] = []

    for (const timestamp of timestamps) {
      let value = 0
      let metric = ''
      let unit = 'kWh'

      switch (meter.category) {
        case 'CONS':
          // Consumption meters
          value = generateConsumptionValue(timestamp, baseLoad, peakLoad, meterType)
          metric = 'energy_consumed'
          unit = 'kWh'
          break

        case 'PROD':
          // Production meters (solar)
          value = generateSolarProduction(timestamp, capacity)
          metric = 'energy_produced'
          unit = 'kWh'
          break

        case 'STOR':
          // Storage meters
          const sampleProduction = generateSolarProduction(timestamp, 200)
          const sampleConsumption = generateConsumptionValue(timestamp, 100, 300)
          value = generateStorageValue(timestamp, capacity, sampleProduction, sampleConsumption)
          metric = value >= 0 ? 'energy_charged' : 'energy_discharged'
          unit = 'kWh'
          break

        case 'INJ':
          // Injection meters (grid export)
          const prodForExport = generateSolarProduction(timestamp, 300)
          const consForExport = generateConsumptionValue(timestamp, 100, 200)
          const storageCharging = Math.max(0, prodForExport - consForExport) * 0.3
          value = generateInjectionValue(prodForExport, consForExport, storageCharging)
          metric = 'energy_exported'
          unit = 'kWh'
          break
      }

      // Only insert if value is meaningful
      if (Math.abs(value) > 0.01) {
        measurementsToInsert.push({
          entityId: meter.id,
          entityType: 'meter',
          timestamp,
          metric,
          value: Math.abs(value), // Store as positive, metric indicates direction
          unit,
          quality: Math.random() > 0.95 ? 'estimated' : 'good', // 5% estimated readings
          metadata: {
            meterCategory: meter.category,
            siteName: site.name
          }
        })
      }
    }

    // Batch insert measurements
    if (measurementsToInsert.length > 0) {
      await db.insert(measurements).values(measurementsToInsert)
      totalMeasurements += measurementsToInsert.length
      console.log(`   ✓ Inserted ${measurementsToInsert.length} measurements`)
    }
  }

  console.log('\n✅ Measurement data seeding complete!')
  console.log(`\n📊 Summary:`)
  console.log(`   - Total measurements: ${totalMeasurements.toLocaleString()}`)
  console.log(`   - Time range: Past 7 days (hourly)`)
  console.log(`   - Meters populated: ${allMeters.length}`)
  console.log(`\n📈 Data includes:`)
  console.log(`   ✓ Realistic consumption patterns (day/night, weekday/weekend)`)
  console.log(`   ✓ Solar production curves (sunrise to sunset)`)
  console.log(`   ✓ Battery charge/discharge cycles`)
  console.log(`   ✓ Grid export during excess production`)
  console.log(`   ✓ Weather and usage variation`)
  console.log(`   ✓ Data quality indicators`)
}

seedMeasurementData()
  .then(() => {
    console.log('\n✅ Seeding completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error seeding data:', error)
    process.exit(1)
  })
