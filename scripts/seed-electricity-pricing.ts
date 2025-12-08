import { db } from '../db'
import { electricityPricing, sites } from '../db/schema'

/**
 * Seed script to populate electricity pricing contracts for Ontario
 *
 * Creates realistic electricity pricing contracts including:
 * - Time-of-Use (TOU) rates for residential/small commercial
 * - Ultra-Low Overnight (ULO) rates
 * - Tiered pricing
 * - Commercial demand charges
 * - Industrial rates with complex structures
 */

async function seedElectricityPricing() {
  console.log('🌱 Starting electricity pricing data seeding...')

  // Get all sites
  const allSites = await db.select().from(sites)

  if (allSites.length === 0) {
    console.error('❌ No sites found. Please run seed-control-room-test-data.ts first.')
    process.exit(1)
  }

  console.log(`✅ Found ${allSites.length} sites`)

  // Clean up existing pricing
  console.log('🧹 Cleaning up existing electricity pricing...')
  await db.delete(electricityPricing)

  const pricingContracts: any[] = []
  const now = new Date()
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

  // ==================== SITE 1: Manufacturing Plant A ====================
  // Time-of-Use (TOU) for small commercial
  const site1 = allSites.find(s => s.name === 'Manufacturing Plant A')
  if (site1) {
    console.log('\n💰 Creating contract for Manufacturing Plant A (TOU - Small Business)')

    pricingContracts.push({
      siteId: site1.id,
      region: 'Ontario',
      utilityProvider: 'Toronto Hydro',
      rateType: 'Time-of-Use',
      rateStructure: {
        ratePlan: 'TOU - Small Business',
        seasons: {
          summer: {
            months: [5, 6, 7, 8, 9], // May - September
            periods: {
              onPeak: {
                hours: [[11, 17]], // 11 AM - 5 PM weekdays
                rate: 0.151, // $/kWh
                label: 'On-Peak'
              },
              midPeak: {
                hours: [[7, 11], [17, 19]], // 7-11 AM, 5-7 PM weekdays
                rate: 0.102,
                label: 'Mid-Peak'
              },
              offPeak: {
                hours: [[19, 7]], // 7 PM - 7 AM + weekends
                rate: 0.074,
                label: 'Off-Peak'
              }
            }
          },
          winter: {
            months: [1, 2, 3, 4, 10, 11, 12], // Nov - April
            periods: {
              onPeak: {
                hours: [[7, 11], [17, 19]], // 7-11 AM, 5-7 PM weekdays
                rate: 0.151,
                label: 'On-Peak'
              },
              midPeak: {
                hours: [[11, 17]], // 11 AM - 5 PM weekdays
                rate: 0.102,
                label: 'Mid-Peak'
              },
              offPeak: {
                hours: [[19, 7]], // 7 PM - 7 AM + weekends
                rate: 0.074,
                label: 'Off-Peak'
              }
            }
          }
        },
        deliveryCharges: 0.0132, // $/kWh
        regulatoryCharges: 0.0057, // $/kWh
        hst: 0.13 // 13% HST
      },
      currency: 'CAD',
      demandCharge: null,
      demandThreshold: null,
      validFrom: oneYearAgo,
      validTo: oneYearFromNow,
      active: true,
      dataSource: 'Ontario Energy Board',
      metadata: {
        contractType: 'Time-of-Use',
        accountNumber: 'TH-SB-2024-001',
        meterType: 'Smart Meter',
        billingCycle: 'monthly'
      }
    })
  }

  // ==================== SITE 2: Data Center Toronto ====================
  // Large commercial with demand charges
  const site2 = allSites.find(s => s.name === 'Data Center Toronto')
  if (site2) {
    console.log('\n💰 Creating contract for Data Center Toronto (Commercial - Demand)')

    pricingContracts.push({
      siteId: site2.id,
      region: 'Ontario',
      utilityProvider: 'Toronto Hydro',
      rateType: 'Commercial Demand',
      rateStructure: {
        ratePlan: 'General Service >50kW',
        energyCharges: {
          onPeak: 0.132, // $/kWh
          midPeak: 0.094,
          offPeak: 0.065
        },
        timeOfUse: {
          summer: {
            months: [5, 6, 7, 8, 9],
            onPeak: [[11, 17]], // 11 AM - 5 PM weekdays
            midPeak: [[7, 11], [17, 19]],
            offPeak: [[19, 7]] // + weekends
          },
          winter: {
            months: [1, 2, 3, 4, 10, 11, 12],
            onPeak: [[7, 11], [17, 19]],
            midPeak: [[11, 17]],
            offPeak: [[19, 7]]
          }
        },
        deliveryCharges: {
          fixed: 45.50, // $/month
          variable: 0.0215 // $/kWh
        },
        regulatoryCharges: 0.0068,
        hst: 0.13
      },
      currency: 'CAD',
      demandCharge: 12.85, // $/kW for peak demand
      demandThreshold: 50, // kW
      validFrom: oneYearAgo,
      validTo: oneYearFromNow,
      active: true,
      dataSource: 'Toronto Hydro Commercial Rates',
      metadata: {
        contractType: 'Commercial Demand',
        accountNumber: 'TH-GS-2024-DC001',
        peakDemandWindow: '15-minute interval',
        billingCycle: 'monthly',
        powerFactor: 0.90,
        minimumCharge: 150.00
      }
    })

    // Also add Ultra-Low Overnight (ULO) option for battery charging
    console.log('   💰 Adding ULO option for overnight charging')

    pricingContracts.push({
      siteId: site2.id,
      region: 'Ontario',
      utilityProvider: 'Toronto Hydro',
      rateType: 'Ultra-Low Overnight',
      rateStructure: {
        ratePlan: 'ULO - Battery Charging',
        periods: {
          ultraLowOvernight: {
            hours: [[23, 7]], // 11 PM - 7 AM every day
            rate: 0.028, // $/kWh - significantly cheaper
            label: 'Ultra-Low Overnight'
          },
          weekend: {
            days: [0, 6], // Saturday, Sunday
            rate: 0.074,
            label: 'Weekend Off-Peak'
          },
          midPeak: {
            hours: [[7, 11], [17, 19]], // Weekdays
            rate: 0.102,
            label: 'Mid-Peak'
          },
          onPeak: {
            hours: [[11, 17]], // Weekdays
            rate: 0.151,
            label: 'On-Peak'
          }
        },
        deliveryCharges: 0.0215,
        regulatoryCharges: 0.0068,
        hst: 0.13
      },
      currency: 'CAD',
      demandCharge: 12.85,
      demandThreshold: 50,
      validFrom: oneYearAgo,
      validTo: oneYearFromNow,
      active: true,
      dataSource: 'OEB ULO Program',
      metadata: {
        contractType: 'Ultra-Low Overnight',
        accountNumber: 'TH-ULO-2024-DC001',
        programType: 'Battery Storage Incentive',
        billingCycle: 'monthly'
      }
    })
  }

  // ==================== SITE 3: BioLabs Research Center ====================
  // Medium commercial with moderate demand
  const site3 = allSites.find(s => s.name === 'BioLabs Research Center')
  if (site3) {
    console.log('\n💰 Creating contract for BioLabs Research Center (Medium Commercial)')

    pricingContracts.push({
      siteId: site3.id,
      region: 'Ontario - Mississauga',
      utilityProvider: 'Alectra Utilities',
      rateType: 'General Service 50-999kW',
      rateStructure: {
        ratePlan: 'GS 50-999kW',
        energyCharges: {
          onPeak: 0.138,
          midPeak: 0.098,
          offPeak: 0.068
        },
        timeOfUse: {
          summer: {
            months: [5, 6, 7, 8, 9],
            onPeak: [[11, 17]],
            midPeak: [[7, 11], [17, 19]],
            offPeak: [[19, 7]]
          },
          winter: {
            months: [1, 2, 3, 4, 10, 11, 12],
            onPeak: [[7, 11], [17, 19]],
            midPeak: [[11, 17]],
            offPeak: [[19, 7]]
          }
        },
        deliveryCharges: {
          fixed: 32.75,
          variable: 0.0198
        },
        regulatoryCharges: 0.0061,
        globalAdjustment: {
          type: 'Class B',
          estimatedRate: 0.045, // $/kWh (varies monthly)
          description: 'Based on Ontario average wholesale price'
        },
        hst: 0.13
      },
      currency: 'CAD',
      demandCharge: 10.92,
      demandThreshold: 50,
      validFrom: oneYearAgo,
      validTo: oneYearFromNow,
      active: true,
      dataSource: 'Alectra Utilities',
      metadata: {
        contractType: 'Medium Commercial',
        accountNumber: 'AL-GS-2024-BIO001',
        voltageLevel: '< 50kV',
        billingCycle: 'monthly',
        powerFactor: 0.88
      }
    })
  }

  // ==================== SITE 4: Distribution Hub East ====================
  // Industrial with complex pricing and incentives
  const site4 = allSites.find(s => s.name === 'Distribution Hub East')
  if (site4) {
    console.log('\n💰 Creating contract for Distribution Hub East (Industrial)')

    pricingContracts.push({
      siteId: site4.id,
      region: 'Ontario - Scarborough',
      utilityProvider: 'Toronto Hydro',
      rateType: 'Large User',
      rateStructure: {
        ratePlan: 'Large User >5,000kW',
        energyCharges: {
          onPeak: 0.119,
          midPeak: 0.086,
          offPeak: 0.058
        },
        timeOfUse: {
          summer: {
            months: [5, 6, 7, 8, 9],
            onPeak: [[11, 17]],
            midPeak: [[7, 11], [17, 19]],
            offPeak: [[19, 7]]
          },
          winter: {
            months: [1, 2, 3, 4, 10, 11, 12],
            onPeak: [[7, 11], [17, 19]],
            midPeak: [[11, 17]],
            offPeak: [[19, 7]]
          }
        },
        deliveryCharges: {
          fixed: 125.00,
          variable: 0.0165,
          networkCharge: 0.0089
        },
        demandCharges: {
          onPeak: 15.25, // $/kW
          nonCoincident: 4.78 // $/kW for overall peak
        },
        regulatoryCharges: 0.0072,
        globalAdjustment: {
          type: 'Class A',
          description: 'Based on contribution to top 5 provincial peaks',
          peakReductionIncentive: true
        },
        renewableIncentives: {
          solarExportRate: 0.095, // $/kWh - feed-in tariff
          storageIncentive: 50.00, // $/month for peak shaving
          evChargingCredit: 0.015 // $/kWh credit
        },
        hst: 0.13
      },
      currency: 'CAD',
      demandCharge: 15.25,
      demandThreshold: 100,
      validFrom: oneYearAgo,
      validTo: oneYearFromNow,
      active: true,
      dataSource: 'IESO Industrial Conservation Program',
      metadata: {
        contractType: 'Industrial - Class A',
        accountNumber: 'TH-LU-2024-DH001',
        voltageLevel: 'Transmission',
        billingCycle: 'monthly',
        powerFactor: 0.95,
        peakShavingProgram: true,
        demandResponseEligible: true,
        capacityAuction: true
      }
    })

    // Add separate contract for solar export
    console.log('   💰 Adding solar export contract (FIT)')

    pricingContracts.push({
      siteId: site4.id,
      region: 'Ontario',
      utilityProvider: 'IESO',
      rateType: 'Feed-In Tariff',
      rateStructure: {
        ratePlan: 'microFIT - Rooftop Solar',
        exportRate: 0.095, // $/kWh
        rateGuarantee: '20 years',
        eligibility: {
          maxCapacity: 500, // kW
          technology: 'Solar PV',
          location: 'Rooftop'
        },
        payments: {
          frequency: 'monthly',
          minimumPayment: 0,
          performanceRequirement: 0.85 // 85% capacity factor threshold
        }
      },
      currency: 'CAD',
      demandCharge: null,
      demandThreshold: null,
      validFrom: new Date('2023-01-01'),
      validTo: new Date('2043-01-01'), // 20-year contract
      active: true,
      dataSource: 'IESO FIT Program',
      metadata: {
        contractType: 'Feed-In Tariff',
        accountNumber: 'IESO-FIT-2023-DH001',
        projectSize: 400, // kW
        commissionDate: '2023-01-15',
        annualDegradation: 0.005 // 0.5% per year
      }
    })
  }

  // ==================== GENERAL ONTARIO RATES (for reference) ====================
  console.log('\n💰 Adding general Ontario reference rates')

  pricingContracts.push({
    siteId: null, // Not site-specific
    region: 'Ontario',
    utilityProvider: 'Ontario Energy Board',
    rateType: 'Regulated Price Plan - TOU',
    rateStructure: {
      ratePlan: 'Residential TOU (Reference)',
      seasons: {
        summer: {
          months: [5, 6, 7, 8, 9],
          periods: {
            onPeak: { hours: [[11, 17]], rate: 0.151, label: 'On-Peak' },
            midPeak: { hours: [[7, 11], [17, 19]], rate: 0.102, label: 'Mid-Peak' },
            offPeak: { hours: [[19, 7]], rate: 0.074, label: 'Off-Peak' }
          }
        },
        winter: {
          months: [1, 2, 3, 4, 10, 11, 12],
          periods: {
            onPeak: { hours: [[7, 11], [17, 19]], rate: 0.151, label: 'On-Peak' },
            midPeak: { hours: [[11, 17]], rate: 0.102, label: 'Mid-Peak' },
            offPeak: { hours: [[19, 7]], rate: 0.074, label: 'Off-Peak' }
          }
        }
      },
      deliveryCharges: 0.0132,
      regulatoryCharges: 0.0057,
      hst: 0.13
    },
    currency: 'CAD',
    demandCharge: null,
    demandThreshold: null,
    validFrom: new Date('2024-05-01'),
    validTo: new Date('2024-10-31'),
    active: true,
    dataSource: 'OEB RPP',
    metadata: {
      contractType: 'Residential Reference',
      updateFrequency: 'Semi-annual',
      source: 'https://www.oeb.ca/consumer-information-and-protection/electricity-rates'
    }
  })

  // Insert all pricing contracts
  console.log('\n💾 Inserting electricity pricing contracts...')

  for (const contract of pricingContracts) {
    await db.insert(electricityPricing).values(contract)
  }

  console.log('\n✅ Electricity pricing seeding complete!')
  console.log(`\n📊 Summary:`)
  console.log(`   - Total contracts: ${pricingContracts.length}`)
  console.log(`   - Site-specific contracts: ${pricingContracts.filter(c => c.siteId).length}`)
  console.log(`   - Reference rates: ${pricingContracts.filter(c => !c.siteId).length}`)
  console.log(`\n💰 Contract types created:`)
  console.log(`   ✓ Time-of-Use (TOU) - Small Business`)
  console.log(`   ✓ Commercial Demand - Large User`)
  console.log(`   ✓ Ultra-Low Overnight (ULO) - Battery Charging`)
  console.log(`   ✓ Medium Commercial - Research Facility`)
  console.log(`   ✓ Industrial - Class A with Demand Response`)
  console.log(`   ✓ Feed-In Tariff (FIT) - Solar Export`)
  console.log(`   ✓ Regulated Price Plan (Reference)`)
  console.log(`\n📋 Features included:`)
  console.log(`   ✓ Seasonal rate variations (Summer/Winter)`)
  console.log(`   ✓ Time-of-Use periods (On/Mid/Off-Peak)`)
  console.log(`   ✓ Demand charges for large users`)
  console.log(`   ✓ Global Adjustment (Class A & B)`)
  console.log(`   ✓ Delivery and regulatory charges`)
  console.log(`   ✓ Renewable energy incentives`)
  console.log(`   ✓ EV charging credits`)
  console.log(`   ✓ Peak shaving programs`)
}

seedElectricityPricing()
  .then(() => {
    console.log('\n✅ Seeding completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error seeding data:', error)
    process.exit(1)
  })
