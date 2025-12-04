/**
 * Energy Hierarchy Data Model
 *
 * Structure:
 * Portfolio → Sites → Meters → Assets/Sources
 */

// ===== ENUMS & CONSTANTS =====

export type MeterCategory = "CONS" | "PROD" | "INJ" | "STOR"
export type AssetType = "hvac" | "compressor" | "chiller" | "cooling" | "lighting" | "equipment" | "compute" | "pump" | "ev-charging"
export type SourceType = "solar" | "wind" | "battery" | "generator" | "chp" | "hydrogen"
export type IndustryType = "biotech" | "datacenter" | "logistics" | "telecom" | "manufacturing" | "commercial"

// ===== LEVEL 5: ENERGY SOURCE =====

export interface EnergySource {
  id: string
  name: string
  type: SourceType
  installedCapacity: number // kW
  currentOutput: number // kW
  forecasted?: number // kW (for renewables)
  weatherDependent: boolean
  cost: number // $/MWh
  carbon: number // g/kWh
  color?: string
  expanded?: boolean
}

// ===== LEVEL 4: ASSET =====

export interface Asset {
  id: string
  name: string
  type: AssetType
  ratedPower: number // kW
  currentPower: number // kW
  status: "active" | "inactive" | "maintenance"
  subCategory?: string
}

// ===== LEVEL 3: METER =====

export interface Meter {
  id: string
  name: string
  category: MeterCategory
  subType?: string

  // Power readings
  power: number // kW (current reading)
  powerIn: number // kW (incoming power)
  powerOut: number // kW (outgoing power)

  // Attributes
  unit: "kW" | "MWh"
  readingFrequency: "1min" | "5min" | "15min" | "hourly"
  dataSource?: string

  // Cost & emissions
  cost: number // $/MWh
  carbon: number // g/kWh

  // Hierarchy
  siteId: string
  assets?: Asset[] // For CONS meters
  sources?: EnergySource[] // For PROD meters

  // UI
  expanded?: boolean
  color?: string
}

// ===== LEVEL 2: SITE =====

export interface Site {
  id: string
  name: string
  type: "site"
  industryType: IndustryType

  // Location
  location?: string
  coordinates?: { lat: number; lng: number }
  timezone?: string

  // Utility
  utilityProvider?: string

  // Aggregated metrics
  totalConsumption: number // kW
  totalProduction: number // kW
  totalInjection: number // kW
  netBalance: number // kW (production - consumption)
  selfSufficiency: number // % (0-100)

  // Cost & emissions
  totalCost: number // $/hour
  totalCarbon: number // kg CO2/hour

  // Hierarchy
  portfolioId?: string
  meters: Meter[]

  // UI
  expanded?: boolean
  x?: number
  y?: number
}

// ===== LEVEL 1: PORTFOLIO =====

export interface Portfolio {
  id: string
  name: string
  owner: string

  // Coverage
  geographicCoverage?: string[]

  // Aggregated KPIs
  totalEnergyCost: number // $/day
  totalEmissions: number // kg CO2/day
  avgSelfSufficiency: number // % (0-100)
  totalSites: number
  totalCapacity: number // kW

  // Hierarchy
  sites: Site[]
}

// ===== ENERGY FLOW & ALLOCATION =====

export interface EnergyConnection {
  id: string
  from: string // meter ID or source ID
  to: string // meter ID

  // Flow data
  flow: number // kW
  percentage: number // % allocation (0-100)
  direction: "forward" | "reverse" | "bidirectional"

  // Metadata
  cost?: number // $/MWh
  carbon?: number // g/kWh

  // Validation
  fromCategory?: MeterCategory
  toCategory?: MeterCategory
}

// ===== CONNECTION VALIDATION MATRIX =====

export const CONNECTION_RULES = {
  "PROD->CONS": { valid: true, description: "Onsite generation supplying consumption" },
  "PROD->INJ": { valid: true, description: "Surplus generation exported to grid" },
  "PROD->PROD": { valid: true, description: "Renewable/backup charging storage", condition: "toSubType === 'storage'" },
  "IMP->CONS": { valid: true, description: "Grid import feeding consumption" },
  "IMP->PROD": { valid: true, description: "Grid charging storage", condition: "toSubType === 'storage'" },
  "CONS->INJ": { valid: false, description: "Consumption cannot export to grid directly" },
  "INJ->*": { valid: false, description: "Injection is terminal" },
  "STOR->CONS": { valid: true, description: "Storage discharge to loads" },
  "STOR->INJ": { valid: true, description: "Storage discharge to grid" },
} as const

// ===== HELPER TYPES =====

export interface Position {
  x: number
  y: number
}

export interface NodePositions {
  [nodeId: string]: Position
}

// ===== VIEW MODE =====

export type ViewMode = "energy" | "carbon" | "cost"
export type HierarchyView = "tree" | "flow" | "sankey"
