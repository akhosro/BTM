/**
 * SolarEdge API Client
 *
 * Documentation: https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf
 * Rate Limit: 300 requests per day per site
 */

export interface SolarEdgePowerFlow {
  siteCurrentPowerFlow: {
    updateRefreshRate: number
    unit: string
    connections: Array<{
      from: string
      to: string
    }>
    GRID?: {
      status: string
      currentPower: number
    }
    LOAD?: {
      status: string
      currentPower: number
    }
    PV?: {
      status: string
      currentPower: number
      todayEnergy: number
    }
    STORAGE?: {
      status: string
      currentPower: number
      chargeLevel: number
      critical: boolean
    }
  }
}

export interface SolarEdgeEnergyDetails {
  energyDetails: {
    timeUnit: string
    unit: string
    meters: Array<{
      type: string
      values: Array<{
        date: string
        value: number
      }>
    }>
  }
}

export interface SolarEdgeOverview {
  overview: {
    lastUpdateTime: string
    lifeTimeData: {
      energy: number
      revenue: number
    }
    lastYearData: {
      energy: number
    }
    lastMonthData: {
      energy: number
    }
    lastDayData: {
      energy: number
    }
    currentPower: {
      power: number
    }
  }
}

export class SolarEdgeClient {
  private baseUrl = "https://monitoringapi.solaredge.com"

  /**
   * Get current power flow (real-time data)
   */
  async getCurrentPowerFlow(
    siteId: string,
    apiKey: string
  ): Promise<SolarEdgePowerFlow> {
    const url = `${this.baseUrl}/site/${siteId}/currentPowerFlow.json?api_key=${apiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("INVALID_API_KEY")
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMIT_EXCEEDED")
      }
      throw new Error(`SolarEdge API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get site overview (summary data)
   */
  async getOverview(siteId: string, apiKey: string): Promise<SolarEdgeOverview> {
    const url = `${this.baseUrl}/site/${siteId}/overview.json?api_key=${apiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("INVALID_API_KEY")
      }
      throw new Error(`SolarEdge API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get energy details for a time period
   */
  async getEnergyDetails(
    siteId: string,
    apiKey: string,
    startTime: string,
    endTime: string,
    timeUnit: "QUARTER_OF_AN_HOUR" | "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" = "DAY"
  ): Promise<SolarEdgeEnergyDetails> {
    const url = new URL(`${this.baseUrl}/site/${siteId}/energyDetails.json`)
    url.searchParams.set("api_key", apiKey)
    url.searchParams.set("startTime", startTime)
    url.searchParams.set("endTime", endTime)
    url.searchParams.set("timeUnit", timeUnit)

    const response = await fetch(url.toString())

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("INVALID_API_KEY")
      }
      throw new Error(`SolarEdge API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get power details for a time period
   */
  async getPowerDetails(
    siteId: string,
    apiKey: string,
    startTime: string,
    endTime: string
  ) {
    const url = new URL(`${this.baseUrl}/site/${siteId}/powerDetails.json`)
    url.searchParams.set("api_key", apiKey)
    url.searchParams.set("startTime", startTime)
    url.searchParams.set("endTime", endTime)

    const response = await fetch(url.toString())

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("INVALID_API_KEY")
      }
      throw new Error(`SolarEdge API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get site equipment/inventory
   */
  async getInventory(siteId: string, apiKey: string) {
    const url = `${this.baseUrl}/site/${siteId}/inventory.json?api_key=${apiKey}`

    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("INVALID_API_KEY")
      }
      throw new Error(`SolarEdge API error: ${response.status}`)
    }

    return response.json()
  }
}

// Singleton instance
export const solarEdgeClient = new SolarEdgeClient()
