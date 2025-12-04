/**
 * Enphase API Client
 *
 * Documentation: https://developer.enphase.com/docs
 * Rate Limit: 10 requests per minute
 */

export interface EnphaseSystemSummary {
  system_id: number
  modules: number
  size_w: number
  current_power: number // Watts
  energy_today: number // Wh
  energy_lifetime: number // Wh
  summary_date: string
  source: string
  status: string
  operational_at: number
  last_report_at: number
  last_energy_at: number
}

export interface EnphaseEnergyLifetime {
  start_date: string
  system_id: number
  production: number[] // Wh for each interval
  micro_production: number[]
  meter_production: number[]
  intervals: { end_at: number; devices_reporting: number }[]
}

export class EnphaseClient {
  private baseUrl = "https://api.enphaseenergy.com/api/v2"

  /**
   * Get system summary (current power, energy today, status)
   */
  async getSystemSummary(
    systemId: string,
    accessToken: string
  ): Promise<EnphaseSystemSummary> {
    const response = await fetch(`${this.baseUrl}/systems/${systemId}/summary`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMIT_EXCEEDED")
      }
      throw new Error(`Enphase API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get lifetime energy production data
   */
  async getEnergyLifetime(
    systemId: string,
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<EnphaseEnergyLifetime> {
    const url = new URL(`${this.baseUrl}/systems/${systemId}/energy_lifetime`)
    url.searchParams.set("start_date", startDate)
    url.searchParams.set("end_date", endDate)

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      if (response.status === 429) {
        throw new Error("RATE_LIMIT_EXCEEDED")
      }
      throw new Error(`Enphase API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get system inventory (devices)
   */
  async getInventory(systemId: string, accessToken: string) {
    const response = await fetch(`${this.baseUrl}/systems/${systemId}/inventory`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Enphase API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get system stats
   */
  async getStats(systemId: string, accessToken: string) {
    const response = await fetch(`${this.baseUrl}/systems/${systemId}/stats`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Enphase API error: ${response.status}`)
    }

    return response.json()
  }
}

// Singleton instance
export const enphaseClient = new EnphaseClient()
