/**
 * Tesla Powerwall API Client
 *
 * Documentation: https://www.tesla.com/support/energy/powerwall/own/monitoring-from-home-network
 * Note: This is a local network API. Powerwall must be on the same network.
 *
 * Authentication: Email/Password exchange for Bearer token
 * Rate Limit: None (local network)
 */

export interface TeslaPowerwallLogin {
  username: string // Always "customer"
  email: string    // User's Tesla account email
  password: string // User's Tesla account password
  force_sm_off?: boolean
}

export interface TeslaPowerwallToken {
  email: string
  firstname: string
  lastname: string
  roles: string[]
  token: string
  provider: string
  loginTime: string
}

export interface TeslaPowerwallSOE {
  percentage: number // State of Energy (battery level %)
}

export interface TeslaPowerwallMeters {
  site?: {
    instant_power: number        // Grid power (W, positive = importing, negative = exporting)
    instant_reactive_power: number
    instant_apparent_power: number
    frequency: number
    energy_exported: number      // Total energy exported to grid (Wh)
    energy_imported: number      // Total energy imported from grid (Wh)
    instant_average_voltage: number
    instant_total_current: number
    i_a_current: number
    i_b_current: number
    i_c_current: number
  }
  battery?: {
    instant_power: number        // Battery power (W, positive = discharging, negative = charging)
    instant_reactive_power: number
    instant_apparent_power: number
    frequency: number
    energy_exported: number      // Total energy discharged (Wh)
    energy_imported: number      // Total energy charged (Wh)
    instant_average_voltage: number
    instant_total_current: number
  }
  load?: {
    instant_power: number        // Home consumption (W)
    instant_reactive_power: number
    instant_apparent_power: number
    frequency: number
    energy_exported: number
    energy_imported: number      // Total energy consumed (Wh)
    instant_average_voltage: number
    instant_total_current: number
  }
  solar?: {
    instant_power: number        // Solar production (W)
    instant_reactive_power: number
    instant_apparent_power: number
    frequency: number
    energy_exported: number      // Total solar energy produced (Wh)
    energy_imported: number
    instant_average_voltage: number
    instant_total_current: number
  }
}

export interface TeslaPowerwallStatus {
  start_time: string
  up_time_seconds: number
  is_new: boolean
  version: string
  git_hash: string
}

export class TeslaPowerwallClient {
  /**
   * Authenticate with Powerwall and get access token
   * Note: Powerwall uses self-signed certificates, so we need to disable SSL verification in production
   */
  async login(
    powerwallIp: string,
    email: string,
    password: string
  ): Promise<TeslaPowerwallToken> {
    const url = `https://${powerwallIp}/api/login/Basic`

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "customer",
          email,
          password,
          force_sm_off: false,
        }),
      })

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("INVALID_CREDENTIALS")
        }
        if (response.status === 404) {
          throw new Error("POWERWALL_NOT_FOUND")
        }
        throw new Error(`Tesla Powerwall login error: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch failed")) {
        throw new Error("NETWORK_ERROR")
      }
      throw error
    }
  }

  /**
   * Get battery state of charge (%)
   */
  async getSOE(powerwallIp: string, token: string): Promise<TeslaPowerwallSOE> {
    const url = `https://${powerwallIp}/api/system_status/soe`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Tesla Powerwall SOE error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get real-time power flow data (meters/aggregates)
   * This is the main endpoint for monitoring
   */
  async getMetersAggregates(
    powerwallIp: string,
    token: string
  ): Promise<TeslaPowerwallMeters> {
    const url = `https://${powerwallIp}/api/meters/aggregates`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Tesla Powerwall meters error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get Powerwall system status
   */
  async getStatus(powerwallIp: string, token: string): Promise<TeslaPowerwallStatus> {
    const url = `https://${powerwallIp}/api/status`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Tesla Powerwall status error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get operation mode
   */
  async getOperationMode(powerwallIp: string, token: string) {
    const url = `https://${powerwallIp}/api/operation`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Tesla Powerwall operation error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get site info
   */
  async getSiteInfo(powerwallIp: string, token: string) {
    const url = `https://${powerwallIp}/api/site_info`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("UNAUTHORIZED")
      }
      throw new Error(`Tesla Powerwall site info error: ${response.status}`)
    }

    return response.json()
  }
}

// Singleton instance
export const teslaPowerwallClient = new TeslaPowerwallClient()
