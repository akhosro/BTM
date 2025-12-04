import { NextResponse } from "next/server";

/**
 * Test API Connection Endpoint
 *
 * Currently returns mock data for MVP testing.
 *
 * PRODUCTION IMPLEMENTATION NOTES:
 *
 * SolarEdge API:
 * - Endpoint: https://monitoringapi.solaredge.com/site/{siteId}/currentPowerFlow.json?api_key={apiKey}
 * - Authentication: API key in query parameter
 * - Rate Limit: 300 requests per day per site
 * - Documentation: https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf
 * - Response includes: currentPower.power, lifeTimeData.energy, etc.
 *
 * Enphase API:
 * - Endpoint: https://api.enphaseenergy.com/api/v2/systems/{systemId}/summary
 * - Authentication: OAuth 2.0 (requires access token)
 * - Rate Limit: 10 requests per minute
 * - Documentation: https://developer.enphase.com/docs
 * - Response includes: current_power, energy_today, etc.
 *
 * For production:
 * 1. Implement OAuth 2.0 flow for Enphase
 * 2. Add proper error handling and retry logic
 * 3. Implement rate limiting and caching
 * 4. Store refresh tokens securely for Enphase
 * 5. Add webhook support for real-time updates
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, credentials } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Missing provider" },
        { status: 400 }
      );
    }

    // Check if this is an OAuth provider (Enphase or UtilityAPI)
    const isOAuthProvider = provider === "enphase" || provider === "enphase_battery" || provider === "utility_api";

    if (isOAuthProvider) {
      if (provider === "utility_api") {
        // UtilityAPI OAuth provider
        if (!credentials?.accessToken) {
          return NextResponse.json(
            { error: "Missing OAuth credentials. Please connect your utility account." },
            { status: 400 }
          );
        }

        // Check if token is expired
        if (credentials.tokenExpiry) {
          const expiryDate = new Date(credentials.tokenExpiry);
          const now = new Date();
          const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

          if (expiryDate <= fiveMinutesFromNow) {
            return NextResponse.json(
              { error: "Access token expired or expiring soon. Please refresh your connection." },
              { status: 401 }
            );
          }
        }

        // Get UtilityAPI data
        const apiToken = process.env.UTILITYAPI_API_TOKEN;
        if (!apiToken) {
          return NextResponse.json(
            { error: "UtilityAPI configuration missing. Please configure UTILITYAPI_API_TOKEN." },
            { status: 500 }
          );
        }

        try {
          const { createUtilityAPIClient } = await import("@/lib/api-clients/utilityapi");
          const utilityApiClient = createUtilityAPIClient(apiToken);

          // Get meter UID from metadata
          const utilityMeterUid = credentials.utilityMeterUid;
          if (!utilityMeterUid) {
            return NextResponse.json(
              { error: "Utility meter not found. Please reconnect your utility account." },
              { status: 400 }
            );
          }

          // Get current usage and latest bill
          const usageData = await utilityApiClient.getCurrentUsage(utilityMeterUid);

          return NextResponse.json({
            success: true,
            provider,
            currentPower: 0, // UtilityAPI provides consumption in kWh, not real-time power
            energyToday: usageData.currentUsage,
            status: "online",
            lastUpdate: usageData.lastUpdate,
            latestBill: usageData.latestBill ? {
              cost: usageData.latestBill.cost,
              used: usageData.latestBill.used,
              start: usageData.latestBill.start,
              end: usageData.latestBill.end,
            } : null,
          }, { status: 200 });
        } catch (error) {
          console.error("UtilityAPI error:", error);

          if (error instanceof Error) {
            if (error.message === "INVALID_API_TOKEN") {
              return NextResponse.json(
                { error: "Invalid UtilityAPI token. Please check server configuration." },
                { status: 403 }
              );
            }
            if (error.message === "AUTHORIZATION_NOT_FOUND") {
              return NextResponse.json(
                { error: "Authorization not found. Please reconnect your utility account." },
                { status: 404 }
              );
            }
          }

          throw error;
        }
      }

      // Enphase OAuth provider
      if (!credentials?.accessToken || !credentials?.systemId) {
        return NextResponse.json(
          { error: "Missing OAuth credentials. Please connect your Enphase account." },
          { status: 400 }
        );
      }

      // Check if token is expired
      if (credentials.tokenExpiry) {
        const expiryDate = new Date(credentials.tokenExpiry);
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (expiryDate <= fiveMinutesFromNow) {
          return NextResponse.json(
            { error: "Access token expired or expiring soon. Please refresh your connection." },
            { status: 401 }
          );
        }
      }

      // TODO: Implement actual Enphase API call
      // Enphase API Endpoint: https://api.enphaseenergy.com/api/v2/systems/{systemId}/summary
      // Use credentials.accessToken for authorization
      // For now, returning simulated data for testing UI flow
      console.warn(`⚠️ Enphase OAuth provider not fully implemented - using simulated data for testing`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockData = getMockDataForProvider(provider);

      return NextResponse.json({
        success: true,
        provider,
        currentPower: mockData.currentPower,
        energyToday: mockData.energyToday,
        status: "online",
        lastUpdate: new Date().toISOString(),
        warning: "Using simulated data - Enphase API not yet implemented",
      }, { status: 200 });
    } else {
      // For API key providers
      if (!credentials?.apiKey) {
        return NextResponse.json(
          { error: "Missing required credentials (API key)" },
          { status: 400 }
        );
      }

      // SolarEdge API implementation
      if (provider === "solaredge") {
        const siteId = credentials.siteId || credentials.systemId

        if (!siteId) {
          return NextResponse.json(
            { error: "Missing Site ID for SolarEdge" },
            { status: 400 }
          );
        }

        try {
          const { solarEdgeClient } = await import("@/lib/api-clients/solaredge")
          const data = await solarEdgeClient.getCurrentPowerFlow(siteId, credentials.apiKey)

          const powerFlow = data.siteCurrentPowerFlow

          return NextResponse.json({
            success: true,
            provider,
            currentPower: (powerFlow.PV?.currentPower || 0) / 1000, // Convert W to kW
            energyToday: (powerFlow.PV?.todayEnergy || 0) / 1000, // Convert Wh to kWh
            status: powerFlow.PV?.status || "unknown",
            lastUpdate: new Date().toISOString(),
            gridStatus: powerFlow.GRID?.status,
            gridPower: (powerFlow.GRID?.currentPower || 0) / 1000,
            loadPower: (powerFlow.LOAD?.currentPower || 0) / 1000,
            batteryPower: powerFlow.STORAGE ? (powerFlow.STORAGE.currentPower || 0) / 1000 : undefined,
            batteryLevel: powerFlow.STORAGE?.chargeLevel,
          }, { status: 200 })
        } catch (error) {
          console.error("SolarEdge API error:", error)

          if (error instanceof Error) {
            if (error.message === "INVALID_API_KEY") {
              return NextResponse.json(
                { error: "Invalid API key. Please check your SolarEdge API key." },
                { status: 403 }
              )
            }
            if (error.message === "RATE_LIMIT_EXCEEDED") {
              return NextResponse.json(
                { error: "Rate limit exceeded. SolarEdge allows 300 requests per day." },
                { status: 429 }
              )
            }
          }

          throw error
        }
      }

      // Tesla Powerwall implementation
      if (provider === "tesla_powerwall") {
        const powerwallIp = credentials.powerwallIp
        const teslaEmail = credentials.teslaEmail
        const teslaPassword = credentials.teslaPassword
        const token = credentials.token

        if (!powerwallIp) {
          return NextResponse.json(
            { error: "Missing Powerwall IP address" },
            { status: 400 }
          );
        }

        try {
          const { teslaPowerwallClient } = await import("@/lib/api-clients/tesla")

          // If no token, we need to authenticate first
          let accessToken = token
          if (!accessToken) {
            if (!teslaEmail || !teslaPassword) {
              return NextResponse.json(
                { error: "Please provide Tesla account email and password to connect" },
                { status: 400 }
              );
            }

            // Get token
            const authResponse = await teslaPowerwallClient.login(powerwallIp, teslaEmail, teslaPassword)
            accessToken = authResponse.token
          }

          // Get battery state of charge
          const soeData = await teslaPowerwallClient.getSOE(powerwallIp, accessToken)

          // Get power flow data
          const metersData = await teslaPowerwallClient.getMetersAggregates(powerwallIp, accessToken)

          // Calculate today's energy (this is an approximation since Tesla doesn't provide daily totals directly)
          const solarEnergyToday = metersData.solar ? (metersData.solar.energy_exported / 1000) : 0

          return NextResponse.json({
            success: true,
            provider,
            currentPower: metersData.battery ? (metersData.battery.instant_power / 1000) : 0, // Convert W to kW
            energyToday: solarEnergyToday, // kWh
            status: "online",
            lastUpdate: new Date().toISOString(),
            batteryLevel: soeData.percentage,
            batteryPower: metersData.battery ? (metersData.battery.instant_power / 1000) : 0,
            solarPower: metersData.solar ? (metersData.solar.instant_power / 1000) : 0,
            gridPower: metersData.site ? (metersData.site.instant_power / 1000) : 0,
            loadPower: metersData.load ? (metersData.load.instant_power / 1000) : 0,
            // Return token so it can be saved
            token: accessToken,
          }, { status: 200 })
        } catch (error) {
          console.error("Tesla Powerwall API error:", error)

          if (error instanceof Error) {
            if (error.message === "INVALID_CREDENTIALS") {
              return NextResponse.json(
                { error: "Invalid Tesla email or password" },
                { status: 403 }
              )
            }
            if (error.message === "POWERWALL_NOT_FOUND") {
              return NextResponse.json(
                { error: "Powerwall not found at this IP address. Check the IP and make sure you're on the same network." },
                { status: 404 }
              )
            }
            if (error.message === "NETWORK_ERROR") {
              return NextResponse.json(
                { error: "Cannot reach Powerwall. Make sure it's on the same network and the IP is correct." },
                { status: 503 }
              )
            }
            if (error.message === "UNAUTHORIZED") {
              return NextResponse.json(
                { error: "Token expired. Please reconnect with your Tesla credentials." },
                { status: 401 }
              )
            }
          }

          throw error
        }
      }

      // Other API key providers not yet implemented
      // TODO: Implement Fronius, SMA, Huawei, Growatt APIs
      // Fronius: https://www.fronius.com/en/solar-energy/installers-partners/technical-data/all-products/system-monitoring/open-interfaces/fronius-solar-api-json-
      // SMA: https://www.sma.de/en/products/monitoring-control/webconnect.html
      // Huawei: https://support.huawei.com/enterprise/en/doc/EDOC1100261860
      // Growatt: https://www.growatt.com/show-39-486.html
      if (!credentials?.systemId) {
        return NextResponse.json(
          { error: "Missing required credentials (System ID)" },
          { status: 400 }
        );
      }

      console.warn(`⚠️ Provider '${provider}' not implemented - using simulated data for testing`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockData = getMockDataForProvider(provider);

      return NextResponse.json({
        success: true,
        provider,
        currentPower: mockData.currentPower,
        energyToday: mockData.energyToday,
        status: "online",
        lastUpdate: new Date().toISOString(),
        warning: `Provider '${provider}' API not yet implemented - using simulated data`,
      }, { status: 200 });
    }
  } catch (error) {
    console.error("Error testing solar connection:", error);
    return NextResponse.json(
      {
        error: "Failed to test connection",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Simulated data for testing unimplemented solar providers
 *
 * IMPORTANT: This is ONLY used for providers that don't have real API implementations yet:
 * - Enphase (OAuth flow exists, but API call not implemented)
 * - Fronius, SMA, Huawei, Growatt (not implemented)
 *
 * Real implementations exist for:
 * - SolarEdge (fully implemented)
 * - Tesla Powerwall (fully implemented)
 * - UtilityAPI (fully implemented)
 */
function getMockDataForProvider(provider: string) {
  const simulatedData: Record<string, { currentPower: number; energyToday: number }> = {
    solaredge: { currentPower: 125.5, energyToday: 450.2 },
    enphase: { currentPower: 98.3, energyToday: 380.7 },
    fronius: { currentPower: 142.1, energyToday: 520.5 },
    sma: { currentPower: 115.8, energyToday: 425.3 },
    huawei: { currentPower: 135.2, energyToday: 495.8 },
    growatt: { currentPower: 108.6, energyToday: 405.1 },
  };

  return simulatedData[provider] || { currentPower: 100, energyToday: 400 };
}
