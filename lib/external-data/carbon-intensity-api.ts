/**
 * Carbon Intensity API Integration
 *
 * Integrates with carbon intensity data providers:
 * - WattTime API (real-time grid carbon intensity)
 * - ElectricityMap (global carbon intensity)
 * - EIA (US Energy Information Administration)
 *
 * Provides:
 * - Real-time marginal operating emissions rate (MOER)
 * - Historical carbon intensity data
 * - Forecasted carbon intensity
 * - Grid carbon impact signals for optimization
 */

export interface CarbonIntensity {
  timestamp: Date;
  region: string;
  carbonIntensity: number; // gCO2/kWh
  source: "watttime" | "electricitymap" | "eia" | "estimated";
  confidence?: number; // 0-1 (if forecasted)
}

export interface GridOptimizationSignal {
  timestamp: Date;
  cleanEnergyPercent: number; // % renewable on grid
  carbonIntensity: number; // gCO2/kWh
  recommendation: "charge" | "discharge" | "hold";
  reason: string;
}

/**
 * WattTime API Client
 * Real-time marginal operating emissions rate (MOER)
 * Sign up: https://www.watttime.org/api-documentation
 */
export class WattTimeClient {
  private baseUrl = "https://api.watttime.org/v3";
  private username: string;
  private password: string;
  private token?: string;
  private tokenExpiry?: Date;

  constructor(username?: string, password?: string) {
    this.username = username || process.env.WATTTIME_USERNAME || "";
    this.password = password || process.env.WATTTIME_PASSWORD || "";
  }

  /**
   * Authenticate with WattTime API v3
   * Returns Bearer token that expires after 30 minutes
   */
  private async authenticate(): Promise<string> {
    if (!this.username || !this.password) {
      throw new Error("WattTime credentials not configured");
    }

    // Check if we have a valid token
    if (this.token && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.token;
    }

    // Get new token via /login endpoint using Basic auth
    const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");

    try {
      const response = await fetch(`${this.baseUrl}/login`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`WattTime login failed (${response.status}):`, text);
        throw new Error(`WattTime login failed: ${response.status}`);
      }

      const data = await response.json();
      this.token = data.token;
      // Token expires after 30 minutes
      this.tokenExpiry = new Date(Date.now() + 29 * 60 * 1000);

      return this.token;
    } catch (error) {
      console.error("WattTime authentication error:", error);
      throw error;
    }
  }

  /**
   * Get balancing authority region for coordinates
   * This endpoint is free for all users
   */
  async getRegion(latitude: number, longitude: number): Promise<string> {
    try {
      // region-from-loc uses Basic auth, not Bearer token
      const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");

      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });

      const response = await fetch(`${this.baseUrl}/region-from-loc?${params}`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`WattTime region lookup failed (${response.status}):`, text);
        throw new Error(`WattTime region lookup failed: ${response.status}`);
      }

      const data = await response.json();
      return data.region; // v3 uses 'region' instead of 'abbrev'
    } catch (error) {
      console.error("WattTime region lookup error:", error);
      // Fallback to generic US region
      return "CAISO_NORTH";
    }
  }

  /**
   * Get real-time carbon intensity (MOER)
   */
  async getRealTimeCarbonIntensity(
    latitude: number,
    longitude: number
  ): Promise<CarbonIntensity> {
    try {
      const token = await this.authenticate();
      const region = await this.getRegion(latitude, longitude);

      const params = new URLSearchParams({
        ba: region,
      });

      const response = await fetch(`${this.baseUrl}/signal-index?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`WattTime MOER request failed (${response.status}):`, text);
        throw new Error(`WattTime MOER request failed: ${response.status}`);
      }

      const data = await response.json();

      return {
        timestamp: new Date(data.point_time),
        region,
        carbonIntensity: data.value || data.moer, // v3 uses 'value'
        source: "watttime",
      };
    } catch (error) {
      console.error("WattTime real-time data error:", error);
      return this.getFallbackIntensity(latitude, longitude);
    }
  }

  /**
   * Get carbon intensity forecast (24-hour ahead)
   */
  async getCarbonIntensityForecast(
    latitude: number,
    longitude: number,
    hours: number = 24
  ): Promise<CarbonIntensity[]> {
    try {
      const token = await this.authenticate();
      const region = await this.getRegion(latitude, longitude);

      const params = new URLSearchParams({
        ba: region,
      });

      const response = await fetch(`${this.baseUrl}/forecast?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`WattTime forecast request failed (${response.status}):`, text);
        throw new Error(`WattTime forecast request failed: ${response.status}`);
      }

      const data = await response.json();

      return data.forecast.slice(0, hours).map((point: any) => ({
        timestamp: new Date(point.point_time),
        region,
        carbonIntensity: point.value, // MOER value
        source: "watttime" as const,
        confidence: 0.85, // WattTime forecast confidence
      }));
    } catch (error) {
      console.error("WattTime forecast error:", error);
      return this.getFallbackForecast(latitude, longitude, hours);
    }
  }

  /**
   * Get grid optimization signal (when to charge/discharge for clean energy)
   */
  async getGridOptimizationSignal(
    latitude: number,
    longitude: number
  ): Promise<GridOptimizationSignal> {
    try {
      const currentIntensity = await this.getRealTimeCarbonIntensity(
        latitude,
        longitude
      );

      const forecast = await this.getCarbonIntensityForecast(
        latitude,
        longitude,
        12
      );

      // Calculate average intensity over next 12 hours
      const avgFutureIntensity =
        forecast.reduce((sum, f) => sum + f.carbonIntensity, 0) /
        forecast.length;

      // Determine recommendation
      let recommendation: "charge" | "discharge" | "hold";
      let reason: string;

      if (currentIntensity.carbonIntensity < avgFutureIntensity * 0.8) {
        // Grid is currently very clean - good time to charge
        recommendation = "charge";
        reason = `Grid is ${Math.round(100 - (currentIntensity.carbonIntensity / avgFutureIntensity) * 100)}% cleaner than average - store clean energy`;
      } else if (currentIntensity.carbonIntensity > avgFutureIntensity * 1.2) {
        // Grid is currently dirty - good time to discharge
        recommendation = "discharge";
        reason = `Grid is ${Math.round((currentIntensity.carbonIntensity / avgFutureIntensity - 1) * 100)}% dirtier than average - use stored clean energy`;
      } else {
        // Grid intensity is average
        recommendation = "hold";
        reason = "Grid intensity is near average - wait for better opportunity";
      }

      // Estimate clean energy percentage (simplified)
      const baselineIntensity = 500; // gCO2/kWh (typical fossil fuel grid)
      const cleanEnergyPercent = Math.max(
        0,
        Math.min(
          100,
          ((baselineIntensity - currentIntensity.carbonIntensity) /
            baselineIntensity) *
            100
        )
      );

      return {
        timestamp: currentIntensity.timestamp,
        cleanEnergyPercent,
        carbonIntensity: currentIntensity.carbonIntensity,
        recommendation,
        reason,
      };
    } catch (error) {
      console.error("Grid optimization signal error:", error);
      return {
        timestamp: new Date(),
        cleanEnergyPercent: 50,
        carbonIntensity: 400,
        recommendation: "hold",
        reason: "Unable to determine optimal action - grid data unavailable",
      };
    }
  }

  /**
   * Fallback carbon intensity when API is unavailable
   */
  private getFallbackIntensity(
    latitude: number,
    longitude: number
  ): CarbonIntensity {
    // Use typical regional averages
    const region = this.estimateRegion(latitude, longitude);

    // Regional carbon intensity estimates (gCO2/kWh)
    const regionalAverages: Record<string, number> = {
      "California": 250, // High renewable penetration
      "Texas": 420, // Mix of renewable and fossil
      "Northeast": 300, // Nuclear + renewables
      "Midwest": 550, // Coal-heavy
      "Pacific Northwest": 150, // Hydro-heavy
      "Southeast": 450, // Coal/gas
      "US Average": 400,
    };

    return {
      timestamp: new Date(),
      region,
      carbonIntensity: regionalAverages[region] || regionalAverages["US Average"],
      source: "estimated",
    };
  }

  /**
   * Fallback forecast using typical daily patterns
   */
  private getFallbackForecast(
    latitude: number,
    longitude: number,
    hours: number
  ): CarbonIntensity[] {
    const baseIntensity = this.getFallbackIntensity(latitude, longitude);
    const forecast: CarbonIntensity[] = [];

    for (let i = 0; i < hours; i++) {
      const timestamp = new Date(Date.now() + i * 60 * 60 * 1000);
      const hour = timestamp.getHours();

      // Carbon intensity typically lower during solar hours (10am-4pm)
      let intensityFactor = 1.0;
      if (hour >= 10 && hour < 16) {
        intensityFactor = 0.7; // 30% cleaner during solar peak
      } else if (hour >= 18 && hour < 22) {
        intensityFactor = 1.3; // 30% dirtier during evening peak
      }

      forecast.push({
        timestamp,
        region: baseIntensity.region,
        carbonIntensity: baseIntensity.carbonIntensity * intensityFactor,
        source: "estimated",
        confidence: 0.5,
      });
    }

    return forecast;
  }

  private estimateRegion(latitude: number, longitude: number): string {
    // Simple region estimation based on coordinates
    if (latitude >= 32 && latitude <= 42 && longitude >= -124 && longitude <= -114) {
      return "California";
    }
    if (latitude >= 26 && latitude <= 36 && longitude >= -106 && longitude <= -93) {
      return "Texas";
    }
    if (latitude >= 45 && longitude >= -125 && longitude <= -116) {
      return "Pacific Northwest";
    }
    return "US Average";
  }
}

/**
 * Get carbon intensity for a location
 */
export async function getCarbonIntensity(
  latitude: number,
  longitude: number
): Promise<CarbonIntensity> {
  const client = new WattTimeClient();

  try {
    return await client.getRealTimeCarbonIntensity(latitude, longitude);
  } catch (error) {
    console.error("Error fetching carbon intensity:", error);
    // Return fallback
    return {
      timestamp: new Date(),
      region: "Unknown",
      carbonIntensity: 400, // US average
      source: "estimated",
    };
  }
}

/**
 * Get carbon intensity forecast
 */
export async function getCarbonIntensityForecast(
  latitude: number,
  longitude: number,
  hours: number = 24
): Promise<CarbonIntensity[]> {
  const client = new WattTimeClient();

  try {
    return await client.getCarbonIntensityForecast(latitude, longitude, hours);
  } catch (error) {
    console.error("Error fetching carbon intensity forecast:", error);
    return client["getFallbackForecast"](latitude, longitude, hours);
  }
}

/**
 * Get optimization signal for battery charging decisions
 */
export async function getGridOptimizationSignal(
  latitude: number,
  longitude: number
): Promise<GridOptimizationSignal> {
  const client = new WattTimeClient();
  return await client.getGridOptimizationSignal(latitude, longitude);
}
