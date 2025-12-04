/**
 * Weather API Integration
 *
 * Integrates with weather services for solar forecasting:
 * - OpenWeatherMap (general weather)
 * - SolCast (solar-specific forecasts)
 * - NOAA (US government weather data)
 */

export interface WeatherForecast {
  timestamp: Date;
  cloudCover: number; // 0-100%
  temperature: number; // Celsius
  irradiance: number; // W/m² (solar radiation)
  precipitationProbability: number; // 0-100%
  uvIndex: number;
  visibility: number; // km
}

/**
 * OpenWeatherMap Integration
 * Free tier: 1000 calls/day, 5-day forecast
 * Sign up: https://openweathermap.org/api
 */
export class OpenWeatherMapClient {
  private apiKey: string;
  private baseUrl = "https://api.openweathermap.org/data/2.5";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENWEATHERMAP_API_KEY || "";
  }

  /**
   * Get weather forecast for a location
   */
  async getForecast(
    latitude: number,
    longitude: number,
    hours: number = 48
  ): Promise<WeatherForecast[]> {
    if (!this.apiKey) {
      console.warn("OpenWeatherMap API key not configured");
      return this.getMockForecast(hours);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/forecast?lat=${latitude}&lon=${longitude}&appid=${this.apiKey}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`OpenWeatherMap API error: ${response.status}`);
      }

      const data = await response.json();

      return data.list.slice(0, Math.ceil(hours / 3)).map((item: any) => ({
        timestamp: new Date(item.dt * 1000),
        cloudCover: item.clouds.all,
        temperature: item.main.temp,
        irradiance: this.estimateIrradiance(item.clouds.all, item.dt),
        precipitationProbability: (item.pop || 0) * 100,
        uvIndex: item.uvi || 0,
        visibility: (item.visibility || 10000) / 1000,
      }));
    } catch (error) {
      console.error("OpenWeatherMap API error:", error);
      return this.getMockForecast(hours);
    }
  }

  /**
   * Estimate solar irradiance from cloud cover
   * Clear sky GHI ≈ 1000 W/m², reduced by clouds
   */
  private estimateIrradiance(cloudCover: number, timestamp: number): number {
    const date = new Date(timestamp * 1000);
    const hour = date.getHours();

    // No irradiance at night
    if (hour < 6 || hour > 19) return 0;

    // Base clear-sky irradiance (simplified)
    const hourFromNoon = Math.abs(hour - 12);
    const baseClearSky = 1000 * Math.cos((hourFromNoon / 6) * (Math.PI / 2));

    // Reduce by cloud cover
    const cloudFactor = 1 - (cloudCover / 100) * 0.75;

    return Math.max(0, baseClearSky * cloudFactor);
  }

  /**
   * Mock forecast for testing without API key
   */
  private getMockForecast(hours: number): WeatherForecast[] {
    const forecasts: WeatherForecast[] = [];
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const timestamp = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hour = timestamp.getHours();

      forecasts.push({
        timestamp,
        cloudCover: 30 + Math.random() * 40,
        temperature: 15 + Math.random() * 15,
        irradiance: hour >= 6 && hour <= 19 ? 400 + Math.random() * 400 : 0,
        precipitationProbability: Math.random() * 30,
        uvIndex: hour >= 10 && hour <= 16 ? 6 : 2,
        visibility: 10,
      });
    }

    return forecasts;
  }
}

/**
 * SolCast Integration
 * Specialized solar forecasting API
 * Free tier: 50 API calls/day
 * Sign up: https://solcast.com/
 */
export class SolCastClient {
  private apiKey: string;
  private baseUrl = "https://api.solcast.com.au";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SOLCAST_API_KEY || "";
  }

  /**
   * Get solar radiation forecast (PV power output)
   */
  async getSolarForecast(
    latitude: number,
    longitude: number,
    capacity: number, // kW installed capacity
    hours: number = 168 // 7 days
  ): Promise<{ timestamp: Date; expectedPower: number; irradiance: number }[]> {
    if (!this.apiKey) {
      console.warn("SolCast API key not configured");
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/rooftop_sites/estimated_actuals?` +
          `latitude=${latitude}&longitude=${longitude}&` +
          `capacity=${capacity}&hours=${hours}&format=json`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`SolCast API error: ${response.status}`);
      }

      const data = await response.json();

      return data.forecasts.map((f: any) => ({
        timestamp: new Date(f.period_end),
        expectedPower: f.pv_estimate, // kW
        irradiance: f.ghi, // W/m² Global Horizontal Irradiance
      }));
    } catch (error) {
      console.error("SolCast API error:", error);
      return [];
    }
  }
}

/**
 * Get weather forecast for a site
 */
export async function getWeatherForecast(
  latitude: number,
  longitude: number,
  hours: number = 48,
  provider: "openweathermap" | "solcast" = "openweathermap"
): Promise<WeatherForecast[]> {
  if (provider === "openweathermap") {
    const client = new OpenWeatherMapClient();
    return await client.getForecast(latitude, longitude, hours);
  }

  // SolCast returns solar-specific data
  const client = new SolCastClient();
  const solarForecast = await client.getSolarForecast(
    latitude,
    longitude,
    500, // Assume 500kW capacity for now
    hours
  );

  return solarForecast.map((f) => ({
    timestamp: f.timestamp,
    cloudCover: 0, // Not provided by SolCast
    temperature: 20, // Not provided
    irradiance: f.irradiance,
    precipitationProbability: 0,
    uvIndex: 0,
    visibility: 10,
  }));
}

/**
 * Get solar irradiance forecast directly
 * Useful for solar production forecasting
 */
export async function getSolarIrradianceForecast(
  latitude: number,
  longitude: number,
  hours: number = 48
): Promise<{ timestamp: Date; irradiance: number }[]> {
  // Try SolCast first (more accurate for solar)
  const solcastClient = new SolCastClient();
  if (solcastClient["apiKey"]) {
    try {
      const forecast = await solcastClient.getSolarForecast(
        latitude,
        longitude,
        1, // 1kW for normalized output
        hours
      );
      return forecast.map((f) => ({
        timestamp: f.timestamp,
        irradiance: f.irradiance,
      }));
    } catch (error) {
      console.warn("SolCast API failed, falling back to OpenWeatherMap");
    }
  }

  // Fallback to OpenWeatherMap
  const weatherClient = new OpenWeatherMapClient();
  const forecast = await weatherClient.getForecast(latitude, longitude, hours);
  return forecast.map((f) => ({
    timestamp: f.timestamp,
    irradiance: f.irradiance,
  }));
}
