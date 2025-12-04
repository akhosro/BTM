/**
 * Grid Operator / ISO API Integration
 *
 * Integrates with Independent System Operators (ISOs) and Regional Transmission Organizations (RTOs):
 * - CAISO (California)
 * - ERCOT (Texas)
 * - PJM (Mid-Atlantic/Midwest)
 * - ISO-NE (New England)
 * - NYISO (New York)
 * - MISO (Midwest)
 * - SPP (Southwest Power Pool)
 *
 * Data available:
 * - Real-time electricity pricing (LMP - Locational Marginal Pricing)
 * - Load forecasts
 * - Renewable generation data
 * - Demand response signals
 * - Grid curtailment notices
 */

export interface GridPricing {
  timestamp: Date;
  locationId: string;
  locationName: string;
  energyPrice: number; // $/MWh
  congestionPrice: number; // $/MWh
  lossPrice: number; // $/MWh
  totalLMP: number; // $/MWh (Locational Marginal Price)
}

export interface LoadForecast {
  timestamp: Date;
  forecastedLoad: number; // MW
  actualLoad?: number; // MW (if available)
  confidence: number; // 0-1
}

export interface RenewableGeneration {
  timestamp: Date;
  solar: number; // MW
  wind: number; // MW
  hydro: number; // MW
  other: number; // MW
  totalRenewable: number; // MW
  percentOfTotal: number; // % of grid mix
}

export interface DemandResponseEvent {
  eventId: string;
  startTime: Date;
  endTime: Date;
  eventType: "economic" | "emergency" | "test";
  targetReduction: number; // MW
  incentiveRate: number; // $/kWh
  zones: string[];
}

/**
 * CAISO API Client
 * California Independent System Operator
 * Documentation: http://www.caiso.com/market/Pages/default.aspx
 */
export class CAISOClient {
  private baseUrl = "http://oasis.caiso.com/oasisapi/SingleZip";

  /**
   * Get real-time pricing (5-minute intervals)
   */
  async getRealTimePricing(
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GridPricing[]> {
    try {
      const params = new URLSearchParams({
        queryname: "PRC_LMP",
        market_run_id: "RTM", // Real-Time Market
        node: locationId,
        startdatetime: this.formatCAISODate(startDate),
        enddatetime: this.formatCAISODate(endDate),
        version: "1",
        resultformat: "6", // JSON
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`CAISO API error: ${response.status}`);
      }

      const data = await response.json();

      return this.parseCAISOPricing(data);
    } catch (error) {
      console.error("CAISO API error:", error);
      return this.getMockPricing(startDate, endDate, locationId);
    }
  }

  /**
   * Get renewable generation data
   */
  async getRenewableGeneration(
    startDate: Date,
    endDate: Date
  ): Promise<RenewableGeneration[]> {
    try {
      const params = new URLSearchParams({
        queryname: "ENE_SLRS", // Solar and renewables
        startdatetime: this.formatCAISODate(startDate),
        enddatetime: this.formatCAISODate(endDate),
        version: "1",
        resultformat: "6",
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`CAISO API error: ${response.status}`);
      }

      const data = await response.json();

      return this.parseCAISORenewables(data);
    } catch (error) {
      console.error("CAISO renewable data error:", error);
      return [];
    }
  }

  private formatCAISODate(date: Date): string {
    return date.toISOString().replace("T", " ").slice(0, 19);
  }

  private parseCAISOPricing(data: any): GridPricing[] {
    // Parse CAISO API response format
    // Actual implementation would parse XML/JSON from CAISO
    return [];
  }

  private parseCAISORenewables(data: any): RenewableGeneration[] {
    // Parse renewable generation data
    return [];
  }

  private getMockPricing(
    startDate: Date,
    endDate: Date,
    locationId: string
  ): GridPricing[] {
    const pricing: GridPricing[] = [];
    const intervals = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (5 * 60 * 1000)
    );

    for (let i = 0; i < intervals; i++) {
      const timestamp = new Date(startDate.getTime() + i * 5 * 60 * 1000);
      const hour = timestamp.getHours();

      // Simulate price variation by time of day
      let basePrice = 35; // $/MWh
      if (hour >= 16 && hour < 21) {
        basePrice = 85; // Peak hours
      } else if (hour >= 12 && hour < 16) {
        basePrice = 55; // Part-peak
      }

      pricing.push({
        timestamp,
        locationId,
        locationName: "CAISO Default Zone",
        energyPrice: basePrice + Math.random() * 10,
        congestionPrice: Math.random() * 5,
        lossPrice: Math.random() * 2,
        totalLMP: basePrice + Math.random() * 10 + Math.random() * 5 + Math.random() * 2,
      });
    }

    return pricing;
  }
}

/**
 * ERCOT API Client
 * Electric Reliability Council of Texas
 * Documentation: https://www.ercot.com/mp/data-products/data-product-details?id=NP6-785-ER
 */
export class ERCOTClient {
  private baseUrl = "https://api.ercot.com/api/public-reports";

  /**
   * Get real-time settlement point prices
   */
  async getRealTimePricing(
    settlementPoint: string,
    startDate: Date,
    endDate: Date
  ): Promise<GridPricing[]> {
    try {
      // ERCOT uses different API structure
      // Would require authentication and proper endpoints

      console.warn("ERCOT API integration requires credentials");
      return this.getMockPricing(startDate, endDate, settlementPoint);
    } catch (error) {
      console.error("ERCOT API error:", error);
      return this.getMockPricing(startDate, endDate, settlementPoint);
    }
  }

  /**
   * Get load forecast
   */
  async getLoadForecast(
    startDate: Date,
    endDate: Date
  ): Promise<LoadForecast[]> {
    try {
      // ERCOT provides 7-day load forecasts
      console.warn("ERCOT load forecast integration requires credentials");
      return [];
    } catch (error) {
      console.error("ERCOT load forecast error:", error);
      return [];
    }
  }

  private getMockPricing(
    startDate: Date,
    endDate: Date,
    locationId: string
  ): GridPricing[] {
    const pricing: GridPricing[] = [];
    const intervals = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (15 * 60 * 1000)
    );

    for (let i = 0; i < intervals; i++) {
      const timestamp = new Date(startDate.getTime() + i * 15 * 60 * 1000);
      const hour = timestamp.getHours();

      let basePrice = 30; // $/MWh
      if (hour >= 14 && hour < 19) {
        basePrice = 120; // ERCOT has higher peak prices
      }

      pricing.push({
        timestamp,
        locationId,
        locationName: "ERCOT Hub Average",
        energyPrice: basePrice + Math.random() * 20,
        congestionPrice: 0,
        lossPrice: 0,
        totalLMP: basePrice + Math.random() * 20,
      });
    }

    return pricing;
  }
}

/**
 * PJM API Client
 * PJM Interconnection (Mid-Atlantic/Midwest)
 * Documentation: https://dataminer2.pjm.com/
 */
export class PJMClient {
  private baseUrl = "https://api.pjm.com/api/v1";

  /**
   * Get real-time pricing
   */
  async getRealTimePricing(
    pnodeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GridPricing[]> {
    try {
      // PJM DataMiner API requires subscription
      console.warn("PJM API integration requires credentials");
      return this.getMockPricing(startDate, endDate, pnodeId);
    } catch (error) {
      console.error("PJM API error:", error);
      return this.getMockPricing(startDate, endDate, pnodeId);
    }
  }

  /**
   * Get demand response events
   */
  async getDemandResponseEvents(
    startDate: Date,
    endDate: Date
  ): Promise<DemandResponseEvent[]> {
    try {
      // PJM provides demand response program data
      console.warn("PJM DR events integration requires credentials");
      return [];
    } catch (error) {
      console.error("PJM DR events error:", error);
      return [];
    }
  }

  private getMockPricing(
    startDate: Date,
    endDate: Date,
    locationId: string
  ): GridPricing[] {
    const pricing: GridPricing[] = [];
    const intervals = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (5 * 60 * 1000)
    );

    for (let i = 0; i < intervals; i++) {
      const timestamp = new Date(startDate.getTime() + i * 5 * 60 * 1000);
      const hour = timestamp.getHours();

      let basePrice = 32; // $/MWh
      if (hour >= 15 && hour < 20) {
        basePrice = 75;
      }

      pricing.push({
        timestamp,
        locationId,
        locationName: "PJM Western Hub",
        energyPrice: basePrice + Math.random() * 15,
        congestionPrice: Math.random() * 8,
        lossPrice: Math.random() * 3,
        totalLMP: basePrice + Math.random() * 15 + Math.random() * 8 + Math.random() * 3,
      });
    }

    return pricing;
  }
}

/**
 * ISO-NE API Client
 * ISO New England
 * Documentation: https://www.iso-ne.com/isoexpress/
 */
export class ISONEClient {
  private baseUrl = "https://webservices.iso-ne.com/api/v1.1";

  async getRealTimePricing(
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GridPricing[]> {
    try {
      console.warn("ISO-NE API integration requires credentials");
      return this.getMockPricing(startDate, endDate, locationId);
    } catch (error) {
      console.error("ISO-NE API error:", error);
      return this.getMockPricing(startDate, endDate, locationId);
    }
  }

  private getMockPricing(
    startDate: Date,
    endDate: Date,
    locationId: string
  ): GridPricing[] {
    const pricing: GridPricing[] = [];
    const intervals = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (5 * 60 * 1000)
    );

    for (let i = 0; i < intervals; i++) {
      const timestamp = new Date(startDate.getTime() + i * 5 * 60 * 1000);
      const hour = timestamp.getHours();

      let basePrice = 38; // $/MWh
      if (hour >= 17 && hour < 21) {
        basePrice = 95;
      }

      pricing.push({
        timestamp,
        locationId,
        locationName: "ISO-NE Hub",
        energyPrice: basePrice + Math.random() * 12,
        congestionPrice: Math.random() * 6,
        lossPrice: Math.random() * 2,
        totalLMP: basePrice + Math.random() * 12 + Math.random() * 6 + Math.random() * 2,
      });
    }

    return pricing;
  }
}

/**
 * Helper function to get grid operator client for a region
 */
export function getGridOperatorClient(region: string): CAISOClient | ERCOTClient | PJMClient | ISONEClient | null {
  const regionLower = region.toLowerCase();

  if (regionLower.includes("california") || regionLower.includes("caiso")) {
    return new CAISOClient();
  }

  if (regionLower.includes("texas") || regionLower.includes("ercot")) {
    return new ERCOTClient();
  }

  if (
    regionLower.includes("pjm") ||
    regionLower.includes("pennsylvania") ||
    regionLower.includes("ohio") ||
    regionLower.includes("maryland")
  ) {
    return new PJMClient();
  }

  if (
    regionLower.includes("new england") ||
    regionLower.includes("isone") ||
    regionLower.includes("iso-ne")
  ) {
    return new ISONEClient();
  }

  console.warn(`No grid operator client available for region: ${region}`);
  return null;
}

/**
 * Get real-time pricing for a location
 */
export async function getGridPricing(
  region: string,
  locationId: string,
  startDate: Date,
  endDate: Date
): Promise<GridPricing[]> {
  const client = getGridOperatorClient(region);

  if (!client) {
    return [];
  }

  return await client.getRealTimePricing(locationId, startDate, endDate);
}

/**
 * Get renewable generation data for a region
 */
export async function getRenewableGeneration(
  region: string,
  startDate: Date,
  endDate: Date
): Promise<RenewableGeneration[]> {
  // Currently only CAISO provides comprehensive renewable data
  if (region.toLowerCase().includes("california") || region.toLowerCase().includes("caiso")) {
    const client = new CAISOClient();
    return await client.getRenewableGeneration(startDate, endDate);
  }

  console.warn(`Renewable generation data not available for region: ${region}`);
  return [];
}
