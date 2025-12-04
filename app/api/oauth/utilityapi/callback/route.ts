import { NextResponse } from "next/server";
import { db } from "@/db";
import { energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * UtilityAPI OAuth Callback Endpoint
 *
 * This endpoint handles the OAuth 2.0 callback from UtilityAPI (Green Button Connect).
 * It exchanges the authorization code for access and refresh tokens,
 * then stores them in the energy source metadata.
 *
 * Query Parameters:
 * - code: Authorization code from the utility
 * - state: State parameter for CSRF protection
 *
 * Environment Variables Required:
 * - UTILITYAPI_CLIENT_ID_{UTILITY}: Your OAuth client ID for the specific utility
 * - UTILITYAPI_CLIENT_SECRET_{UTILITY}: Your OAuth client secret for the specific utility
 * - UTILITYAPI_OAUTH_TOKEN_ENDPOINT_{UTILITY}: The OAuth token endpoint for the utility
 * - UTILITYAPI_REDIRECT_URI: Your registered redirect URI
 * - UTILITYAPI_API_TOKEN: Your UtilityAPI API token (for accessing UtilityAPI endpoints)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=missing_params", request.url)
      );
    }

    // Verify state from cookie
    const cookies = request.headers.get("cookie");
    const stateCookie = cookies
      ?.split("; ")
      .find((c) => c.startsWith("utilityapi_oauth_state="))
      ?.split("=")[1];

    if (!stateCookie) {
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=invalid_state", request.url)
      );
    }

    const stateData = JSON.parse(decodeURIComponent(stateCookie));

    if (stateData.state !== state) {
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=state_mismatch", request.url)
      );
    }

    const { meterId, energySourceId, utility } = stateData;
    const utilityUpper = utility.toUpperCase();

    // Get utility-specific OAuth configuration
    const clientId = process.env[`UTILITYAPI_CLIENT_ID_${utilityUpper}`];
    const clientSecret = process.env[`UTILITYAPI_CLIENT_SECRET_${utilityUpper}`];
    const tokenEndpoint = process.env[`UTILITYAPI_OAUTH_TOKEN_ENDPOINT_${utilityUpper}`];
    const redirectUri = process.env.UTILITYAPI_REDIRECT_URI;
    const apiToken = process.env.UTILITYAPI_API_TOKEN;

    if (!clientId || !clientSecret || !tokenEndpoint || !redirectUri) {
      console.error(`Missing UtilityAPI OAuth configuration for utility: ${utility}`);
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=config_missing", request.url)
      );
    }

    // Exchange authorization code for tokens
    // UtilityAPI uses Basic Auth with base64-encoded client_id:client_secret
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("UtilityAPI token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=token_exchange_failed", request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate token expiry time
    const expiresIn = tokenData.expires_in || 3600; // Default 1 hour if not provided
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Extract UtilityAPI-specific data from token response
    const authorizationURI = tokenData.authorizationURI || "";
    const authorizationUid = authorizationURI ? authorizationURI.split("/").pop() : "";

    // Update energy source with OAuth tokens
    const existingSource = await db.query.energySources.findFirst({
      where: eq(energySources.id, energySourceId),
    });

    if (!existingSource) {
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=source_not_found", request.url)
      );
    }

    // Merge new OAuth data with existing metadata
    const updatedMetadata = {
      ...(existingSource.metadata || {}),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiry,
      tokenType: tokenData.token_type || "Bearer",
      scope: tokenData.scope,
      authorizationURI: tokenData.authorizationURI,
      authorizationUid,
      resourceURI: tokenData.resourceURI,
      customerResourceURI: tokenData.customerResourceURI,
      utility,
      dataSourceType: "api",
      connectionStatus: "success",
      lastConnectionTest: new Date().toISOString(),
    };

    await db
      .update(energySources)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(energySources.id, energySourceId));

    // Optionally: Fetch meter info from UtilityAPI and update metadata
    // This requires the UTILITYAPI_API_TOKEN to access the UtilityAPI REST API
    if (apiToken && authorizationUid) {
      try {
        const { createUtilityAPIClient } = await import("@/lib/api-clients/utilityapi");
        const utilityApiClient = createUtilityAPIClient(apiToken);

        // Get meters for this authorization
        const meters = await utilityApiClient.getMeters(authorizationUid);

        if (meters.length > 0) {
          const meter = meters[0]; // Use first meter
          updatedMetadata.utilityMeterUid = meter.uid;
          updatedMetadata.utilityName = meter.utility_name;
          updatedMetadata.serviceAddress = meter.service_address;
          updatedMetadata.meterNumbers = meter.meter_numbers;

          // Update again with meter info
          await db
            .update(energySources)
            .set({
              metadata: updatedMetadata,
              updatedAt: new Date(),
            })
            .where(eq(energySources.id, energySourceId));
        }
      } catch (error) {
        console.error("Failed to fetch meter info from UtilityAPI:", error);
        // Don't fail the OAuth flow if this fails - just log it
      }
    }

    // Clear the state cookie and redirect back to settings
    const response = NextResponse.redirect(
      new URL("/settings?tab=data-connections&oauth_success=true", request.url)
    );

    response.cookies.set("utilityapi_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Delete cookie
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in UtilityAPI OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/settings?tab=data-connections&oauth_error=server_error", request.url)
    );
  }
}
