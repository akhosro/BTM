import { db } from '../db'
import { sites, meters, energySources, users } from '../db/schema'
import { eq } from 'drizzle-orm'

/**
 * Seed script to create comprehensive test data for Control Room layout testing
 *
 * Creates multiple sites with various meter hierarchies:
 * - Simple site with few meters
 * - Complex site with deep meter hierarchies
 * - Multi-category site with all meter types
 * - Site with energy sources
 */

async function seedControlRoomTestData() {
  console.log('🌱 Starting Control Room test data seeding...')

  // Get the first user (you should be logged in)
  const [user] = await db.select().from(users).limit(1)

  if (!user) {
    console.error('❌ No user found. Please create a user first.')
    process.exit(1)
  }

  console.log(`✅ Using user: ${user.email}`)

  // Clean up existing test data
  console.log('🧹 Cleaning up existing test data...')
  await db.delete(sites).where(eq(sites.userId, user.id))

  // ==================== SITE 1: Simple Manufacturing Site ====================
  console.log('\n📍 Creating Site 1: Simple Manufacturing Facility')
  const [site1] = await db.insert(sites).values({
    userId: user.id,
    name: 'Manufacturing Plant A',
    location: 'Toronto, ON',
    latitude: 43.6532,
    longitude: -79.3832,
    industryType: 'manufacturing',
    description: 'Primary manufacturing facility with basic metering'
  }).returning()

  const [site1Meter1] = await db.insert(meters).values({
    siteId: site1.id,
    name: 'Main Building',
    category: 'CONS',
    readingFrequency: '15min',
    capacity: 500,
    description: 'Main building consumption'
  }).returning()

  await db.insert(meters).values([
    {
      siteId: site1.id,
      name: 'Roof Solar',
      category: 'PROD',
      readingFrequency: '15min',
      capacity: 100,
      description: 'Solar panels on main building roof'
    },
    {
      siteId: site1.id,
      name: 'Battery Bank',
      category: 'STOR',
      readingFrequency: '5min',
      capacity: 150,
      description: 'Tesla Powerwall battery system'
    }
  ])

  // ==================== SITE 2: Complex Data Center ====================
  console.log('\n📍 Creating Site 2: Complex Data Center with Deep Hierarchy')
  const [site2] = await db.insert(sites).values({
    userId: user.id,
    name: 'Data Center Toronto',
    location: 'Toronto, ON - Downtown',
    latitude: 43.6426,
    longitude: -79.3871,
    industryType: 'datacenter',
    description: 'Large data center with complex multi-level metering'
  }).returning()

  // Level 1 - Main meters
  const [dc2MainCons] = await db.insert(meters).values({
    siteId: site2.id,
    name: 'Main Grid Connection',
    category: 'CONS',
    readingFrequency: '1min',
    capacity: 2000,
    description: 'Primary grid connection'
  }).returning()

  const [dc2MainProd] = await db.insert(meters).values({
    siteId: site2.id,
    name: 'Solar Array',
    category: 'PROD',
    readingFrequency: '5min',
    capacity: 500,
    description: 'Rooftop solar installation'
  }).returning()

  const [dc2MainStor] = await db.insert(meters).values({
    siteId: site2.id,
    name: 'Energy Storage System',
    category: 'STOR',
    readingFrequency: '1min',
    capacity: 1000,
    description: 'Large-scale battery storage'
  }).returning()

  const [dc2MainInj] = await db.insert(meters).values({
    siteId: site2.id,
    name: 'Grid Export',
    category: 'INJ',
    readingFrequency: '5min',
    capacity: 200,
    description: 'Excess power export to grid'
  }).returning()

  // Level 2 - Consumption breakdown
  const [dc2Floor1] = await db.insert(meters).values({
    siteId: site2.id,
    parentMeterId: dc2MainCons.id,
    name: 'Floor 1 - Server Halls',
    category: 'CONS',
    readingFrequency: '5min',
    capacity: 800,
    description: 'First floor server consumption'
  }).returning()

  const [dc2Floor2] = await db.insert(meters).values({
    siteId: site2.id,
    parentMeterId: dc2MainCons.id,
    name: 'Floor 2 - Cooling',
    category: 'CONS',
    readingFrequency: '5min',
    capacity: 600,
    description: 'HVAC and cooling systems'
  }).returning()

  const [dc2Floor3] = await db.insert(meters).values({
    siteId: site2.id,
    parentMeterId: dc2MainCons.id,
    name: 'Floor 3 - Office',
    category: 'CONS',
    readingFrequency: '15min',
    capacity: 200,
    description: 'Office space consumption'
  }).returning()

  // Level 3 - Server hall breakdown
  await db.insert(meters).values([
    {
      siteId: site2.id,
      parentMeterId: dc2Floor1.id,
      name: 'Server Rack A1-A10',
      category: 'CONS',
      readingFrequency: '1min',
      capacity: 200,
      description: 'High-density compute racks'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2Floor1.id,
      name: 'Server Rack B1-B10',
      category: 'CONS',
      readingFrequency: '1min',
      capacity: 200,
      description: 'Storage racks'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2Floor1.id,
      name: 'Server Rack C1-C10',
      category: 'CONS',
      readingFrequency: '1min',
      capacity: 150,
      description: 'Network equipment'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2Floor1.id,
      name: 'Lighting & Security',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 50,
      description: 'Floor lighting and security systems'
    }
  ])

  // Level 3 - Cooling breakdown
  await db.insert(meters).values([
    {
      siteId: site2.id,
      parentMeterId: dc2Floor2.id,
      name: 'Chiller 1',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 200,
      description: 'Primary chiller unit'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2Floor2.id,
      name: 'Chiller 2',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 200,
      description: 'Secondary chiller unit'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2Floor2.id,
      name: 'Air Handlers',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 150,
      description: 'Air handling units'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2Floor2.id,
      name: 'Pumps',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 50,
      description: 'Cooling water circulation pumps'
    }
  ])

  // Level 2 - Solar breakdown
  await db.insert(meters).values([
    {
      siteId: site2.id,
      parentMeterId: dc2MainProd.id,
      name: 'South Array',
      category: 'PROD',
      readingFrequency: '5min',
      capacity: 250,
      description: 'South-facing panels'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2MainProd.id,
      name: 'East Array',
      category: 'PROD',
      readingFrequency: '5min',
      capacity: 150,
      description: 'East-facing panels'
    },
    {
      siteId: site2.id,
      parentMeterId: dc2MainProd.id,
      name: 'West Array',
      category: 'PROD',
      readingFrequency: '5min',
      capacity: 100,
      description: 'West-facing panels'
    }
  ])

  // ==================== SITE 3: Biotech Facility ====================
  console.log('\n📍 Creating Site 3: Biotech Research Facility')
  const [site3] = await db.insert(sites).values({
    userId: user.id,
    name: 'BioLabs Research Center',
    location: 'Mississauga, ON',
    latitude: 43.5890,
    longitude: -79.6441,
    industryType: 'biotech',
    description: 'Biotech research facility with specialized equipment'
  }).returning()

  const [site3MainCons] = await db.insert(meters).values({
    siteId: site3.id,
    name: 'Main Utility Connection',
    category: 'CONS',
    readingFrequency: '15min',
    capacity: 800,
    description: 'Primary electrical service'
  }).returning()

  // Level 2 - Department breakdown
  const [site3Lab] = await db.insert(meters).values({
    siteId: site3.id,
    parentMeterId: site3MainCons.id,
    name: 'Laboratory Wing',
    category: 'CONS',
    readingFrequency: '5min',
    capacity: 400,
    description: 'Research laboratories'
  }).returning()

  await db.insert(meters).values([
    {
      siteId: site3.id,
      parentMeterId: site3MainCons.id,
      name: 'Cold Storage',
      category: 'CONS',
      readingFrequency: '1min',
      capacity: 200,
      description: 'Temperature-controlled storage'
    },
    {
      siteId: site3.id,
      parentMeterId: site3MainCons.id,
      name: 'Clean Rooms',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 150,
      description: 'Sterile environment facilities'
    },
    {
      siteId: site3.id,
      parentMeterId: site3MainCons.id,
      name: 'Office & Common',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 50,
      description: 'Office and common areas'
    }
  ])

  // Level 3 - Lab equipment
  await db.insert(meters).values([
    {
      siteId: site3.id,
      parentMeterId: site3Lab.id,
      name: 'Centrifuges',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 80,
      description: 'Laboratory centrifuges'
    },
    {
      siteId: site3.id,
      parentMeterId: site3Lab.id,
      name: 'Incubators',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 100,
      description: 'Cell culture incubators'
    },
    {
      siteId: site3.id,
      parentMeterId: site3Lab.id,
      name: 'Microscopy Suite',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 60,
      description: 'Electron microscopes and imaging'
    },
    {
      siteId: site3.id,
      parentMeterId: site3Lab.id,
      name: 'General Equipment',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 160,
      description: 'Various lab equipment'
    }
  ])

  // Add solar to biotech
  await db.insert(meters).values({
    siteId: site3.id,
    name: 'Solar Carport',
    category: 'PROD',
    readingFrequency: '15min',
    capacity: 150,
    description: 'Parking lot solar canopy'
  })

  // ==================== SITE 4: Logistics Warehouse ====================
  console.log('\n📍 Creating Site 4: Logistics & Distribution Center')
  const [site4] = await db.insert(sites).values({
    userId: user.id,
    name: 'Distribution Hub East',
    location: 'Scarborough, ON',
    latitude: 43.7731,
    longitude: -79.2578,
    industryType: 'logistics',
    description: 'Large distribution warehouse with automation'
  }).returning()

  const [site4MainCons] = await db.insert(meters).values({
    siteId: site4.id,
    name: 'Main Service',
    category: 'CONS',
    readingFrequency: '15min',
    capacity: 1200,
    description: 'Main electrical service'
  }).returning()

  // Warehouse zones
  await db.insert(meters).values([
    {
      siteId: site4.id,
      parentMeterId: site4MainCons.id,
      name: 'Warehouse Lighting',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 200,
      description: 'LED high-bay lighting'
    },
    {
      siteId: site4.id,
      parentMeterId: site4MainCons.id,
      name: 'Conveyor Systems',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 300,
      description: 'Automated conveyor belts'
    },
    {
      siteId: site4.id,
      parentMeterId: site4MainCons.id,
      name: 'HVAC & Ventilation',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 250,
      description: 'Climate control systems'
    },
    {
      siteId: site4.id,
      parentMeterId: site4MainCons.id,
      name: 'Loading Docks',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 150,
      description: 'Loading bay equipment'
    },
    {
      siteId: site4.id,
      parentMeterId: site4MainCons.id,
      name: 'Offices & Break Rooms',
      category: 'CONS',
      readingFrequency: '15min',
      capacity: 100,
      description: 'Administrative and staff areas'
    },
    {
      siteId: site4.id,
      parentMeterId: site4MainCons.id,
      name: 'EV Charging',
      category: 'CONS',
      readingFrequency: '5min',
      capacity: 200,
      description: 'Electric vehicle charging stations'
    }
  ])

  // Solar and storage
  const [site4Solar] = await db.insert(meters).values({
    siteId: site4.id,
    name: 'Rooftop Solar',
    category: 'PROD',
    readingFrequency: '5min',
    capacity: 400,
    description: 'Large rooftop solar array'
  }).returning()

  await db.insert(meters).values({
    siteId: site4.id,
    name: 'Battery Storage',
    category: 'STOR',
    readingFrequency: '5min',
    capacity: 500,
    description: 'Commercial battery system for peak shaving'
  })

  await db.insert(meters).values({
    siteId: site4.id,
    name: 'Grid Export',
    category: 'INJ',
    readingFrequency: '15min',
    capacity: 100,
    description: 'Excess solar export to grid'
  })

  // Add energy sources to some meters
  console.log('\n⚡ Adding energy sources...')

  // Get some production meters
  const prodMeters = await db.select()
    .from(meters)
    .where(eq(meters.category, 'PROD'))
    .limit(5)

  for (const meter of prodMeters) {
    await db.insert(energySources).values({
      meterId: meter.id,
      name: `${meter.name} - Solar PV`,
      sourceType: 'solar',
      capacity: meter.capacity,
      metadata: {
        panelType: 'Monocrystalline',
        efficiency: 0.22,
        installDate: '2023-01-15'
      }
    })
  }

  console.log('\n✅ Control Room test data seeding complete!')
  console.log('\n📊 Summary:')
  console.log('   - Site 1: Simple manufacturing (3 meters)')
  console.log('   - Site 2: Complex data center (20+ meters, 3-level hierarchy)')
  console.log('   - Site 3: Biotech facility (12 meters, 3-level hierarchy)')
  console.log('   - Site 4: Logistics hub (12 meters with solar & storage)')
  console.log('\n🎨 This data tests:')
  console.log('   ✓ All meter categories (CONS, PROD, STOR, INJ)')
  console.log('   ✓ Multi-level meter hierarchies (up to 3 levels)')
  console.log('   ✓ Complex connection paths')
  console.log('   ✓ Various site types')
  console.log('   ✓ Energy sources')
  console.log('\n🚀 Navigate to /control-room to see your test data!')
}

seedControlRoomTestData()
  .then(() => {
    console.log('\n✅ Seeding completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error seeding data:', error)
    process.exit(1)
  })
