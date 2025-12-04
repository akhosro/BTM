// Type definitions for Control Room Builder

export interface EnergySource {
  id: string
  meterId: string
  name: string
  sourceType: string
  capacity: number | null
  metadata: any
  active: boolean
}

export interface Meter {
  id: string
  siteId: string
  parentMeterId?: string | null
  name: string
  category: "CONS" | "PROD" | "INJ" | "STOR"
  capacity: number | null
  readingFrequency: string
  metadata: any
  active: boolean
  energySources: EnergySource[]
  assets: any[]
  siteName?: string
}

export interface Site {
  id: string
  name: string
  location: string | null
  latitude: number | null
  longitude: number | null
  industryType: string
  metadata: any
  active: boolean
  meters: Meter[]
}

export interface CanvasItem {
  id: string
  level: number
  type: "site" | "meter" | "solar" | "battery"
  data: Site | Meter | EnergySource
  name: string
  parentId?: string
  position?: { x: number; y: number }
}
