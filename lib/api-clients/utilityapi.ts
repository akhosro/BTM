/**
 * UtilityAPI Client
 *
 * Documentation: https://utilityapi.com/docs
 * Green Button OAuth: https://utilityapi.com/docs/greenbutton/oauth
 *
 * UtilityAPI provides access to utility consumption data through Green Button OAuth.
 * Each utility has its own OAuth endpoints (configured in UtilityAPI settings).
 */

export interface UtilityAPITokenResponse {
  token_type: "Bearer"
  access_token: string
  refresh_token: string
  expires_in: number // seconds until expiration (typically 3600)
  scope: string
  resourceURI: string // subscription URL
  customerResourceURI: string // retail customer URL
  authorizationURI: string // authorization URL
}

export interface UtilityAPIMeter {
  uid: string
  created: string
  utility: string
  utility_name: string
  service_address: string
  service_tariff: string
  service_class: string
  meter_numbers: string[]
  is_activated: boolean
}

export interface UtilityAPIBill {
  uid: string
  created: string
  updated: string
  utility: string
  meter: string
  start: string // ISO date
  end: string // ISO date
  cost: number // in dollars
  used: number // in kWh for electric
  items: Array<{
    name: string
    quantity: number
    rate: number
    cost: number
    unit: string
  }>
  line_items: Array<{
    name: string
    cost: number
  }>
}

export interface UtilityAPIInterval {
  start: string // ISO date
  end: string // ISO date
  kWh: number // energy consumption
}

export interface UtilityAPIIntervalsResponse {
  intervals: UtilityAPIInterval[]
  next: string | null // pagination URL
}

export interface UtilityAPIAuthorization {
  uid: string
  created: string
  utility: string
  utility_name: string
  status: "active" | "inactive" | "pending" | "revoked"
  scope: string
  expires: string | null
  meters: string[] // array of meter UIDs
}

/**
 * UtilityAPI Client
 *
 * Note: UtilityAPI uses two authentication methods:
 * 1. API Token (for your server to access UtilityAPI endpoints)
 * 2. Green Button OAuth (for users to authorize access to their utility data)
 */
export class UtilityAPIClient {
  private baseUrl = "https://utilityapi.com/api/v2"
  private apiToken: string

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  /**
   * Get authorization URL for Green Button OAuth flow
   *
   * @param utilityOAuthEndpoint - Utility-specific OAuth authorize endpoint (from UtilityAPI settings)
   * @param clientId - Your OAuth client_id for this utility
   * @param redirectUri - Your callback URL
   * @param state - CSRF protection token
   * @param scope - Optional scope (defaults to account settings)
   */
  getAuthorizationUrl(
    utilityOAuthEndpoint: string,
    clientId: string,
    redirectUri: string,
    state: string,
    scope?: string
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
    })

    if (scope) {
      params.set("scope", scope)
    }

    return `${utilityOAuthEndpoint}?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   *
   * @param tokenEndpoint - Utility-specific OAuth token endpoint (from UtilityAPI settings)
   * @param clientId - Your OAuth client_id
   * @param clientSecret - Your OAuth client_secret
   * @param code - Authorization code from redirect
   * @param redirectUri - Must match the original redirect_uri
   */
  async exchangeCodeForToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
  ): Promise<UtilityAPITokenResponse> {
    const credentials = btoa(`${clientId}:${clientSecret}`)

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    })

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("INVALID_CLIENT_CREDENTIALS")
      }
      if (response.status === 400) {
        throw new Error("INVALID_AUTHORIZATION_CODE")
      }
      throw new Error(`OAuth token exchange failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Refresh access token
   *
   * @param tokenEndpoint - Utility-specific OAuth token endpoint
   * @param clientId - Your OAuth client_id
   * @param clientSecret - Your OAuth client_secret
   * @param refreshToken - Previously received refresh token
   */
  async refreshAccessToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<UtilityAPITokenResponse> {
    const credentials = btoa(`${clientId}:${clientSecret}`)

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("INVALID_REFRESH_TOKEN")
      }
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get authorization details
   * Uses your API token (not user's OAuth token)
   */
  async getAuthorization(authorizationUid: string): Promise<UtilityAPIAuthorization> {
    const url = `${this.baseUrl}/authorizations/${authorizationUid}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("INVALID_API_TOKEN")
      }
      if (response.status === 404) {
        throw new Error("AUTHORIZATION_NOT_FOUND")
      }
      throw new Error(`Get authorization failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get meters for an authorization
   * Uses your API token (not user's OAuth token)
   */
  async getMeters(authorizationUid?: string): Promise<UtilityAPIMeter[]> {
    const url = authorizationUid
      ? `${this.baseUrl}/authorizations/${authorizationUid}/meters`
      : `${this.baseUrl}/meters`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("INVALID_API_TOKEN")
      }
      throw new Error(`Get meters failed: ${response.status}`)
    }

    const data = await response.json()
    return data.meters || []
  }

  /**
   * Get bills for a meter
   * Uses your API token (not user's OAuth token)
   */
  async getBills(meterUid: string): Promise<UtilityAPIBill[]> {
    const url = `${this.baseUrl}/bills?meters=${meterUid}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("INVALID_API_TOKEN")
      }
      throw new Error(`Get bills failed: ${response.status}`)
    }

    const data = await response.json()
    return data.bills || []
  }

  /**
   * Get interval usage data for a meter
   * Uses your API token (not user's OAuth token)
   *
   * @param meterUid - Meter UID
   * @param startDate - ISO date string (e.g., "2025-01-01")
   * @param endDate - ISO date string (e.g., "2025-01-31")
   */
  async getIntervals(
    meterUid: string,
    startDate?: string,
    endDate?: string
  ): Promise<UtilityAPIIntervalsResponse> {
    const params = new URLSearchParams({
      meters: meterUid,
    })

    if (startDate) {
      params.set("start", startDate)
    }
    if (endDate) {
      params.set("end", endDate)
    }

    const url = `${this.baseUrl}/intervals?${params.toString()}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("INVALID_API_TOKEN")
      }
      throw new Error(`Get intervals failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get current usage summary
   * Helper method to get today's usage and latest bill
   */
  async getCurrentUsage(meterUid: string): Promise<{
    currentUsage: number // kWh
    latestBill: UtilityAPIBill | null
    lastUpdate: string
  }> {
    // Get today's intervals
    const today = new Date().toISOString().split("T")[0]
    const intervalsData = await this.getIntervals(meterUid, today, today)

    // Calculate total usage for today
    const currentUsage = intervalsData.intervals.reduce(
      (sum, interval) => sum + interval.kWh,
      0
    )

    // Get latest bill
    const bills = await this.getBills(meterUid)
    const latestBill = bills.length > 0 ? bills[0] : null

    return {
      currentUsage,
      latestBill,
      lastUpdate: new Date().toISOString(),
    }
  }
}

// Note: The singleton instance requires an API token
// You'll need to initialize this with your UtilityAPI API token
export const createUtilityAPIClient = (apiToken: string) => new UtilityAPIClient(apiToken)
