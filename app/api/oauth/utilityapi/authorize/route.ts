import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * UtilityAPI OAuth Authorization Initiation Endpoint
 *
 * This endpoint initiates the OAuth 2.0 authorization flow for UtilityAPI (Green Button Connect).
 * It redirects the user to their utility's authorization page.
 *
 * Query Parameters:
 * - meterId: The meter ID to associate with this connection
 * - energySourceId: The energy source ID to store tokens in
 * - utility: The utility code (e.g., "pge", "sce", "sdge")
 *
 * Environment Variables Required:
 * - UTILITYAPI_CLIENT_ID_{UTILITY}: Your UtilityAPI OAuth client ID for specific utility (e.g., UTILITYAPI_CLIENT_ID_PGE)
 * - UTILITYAPI_OAUTH_AUTHORIZE_ENDPOINT_{UTILITY}: The OAuth authorization endpoint for the utility
 * - UTILITYAPI_REDIRECT_URI: Your registered redirect URI (e.g., http://localhost:3000/api/oauth/utilityapi/callback)
 *
 * Note: UtilityAPI OAuth endpoints are utility-specific. Each utility has its own OAuth settings.
 * You configure these in your UtilityAPI account after registering as a third party.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meterId = searchParams.get("meterId");
    const energySourceId = searchParams.get("energySourceId");
    const utility = searchParams.get("utility");

    if (!meterId || !energySourceId || !utility) {
      return NextResponse.json(
        { error: "Missing meterId, energySourceId, or utility" },
        { status: 400 }
      );
    }

    const utilityUpper = utility.toUpperCase();

    // Get utility-specific OAuth configuration
    const clientId = process.env[`UTILITYAPI_CLIENT_ID_${utilityUpper}`];
    const authorizeEndpoint = process.env[`UTILITYAPI_OAUTH_AUTHORIZE_ENDPOINT_${utilityUpper}`];
    const redirectUri = process.env.UTILITYAPI_REDIRECT_URI;

    if (!clientId || !authorizeEndpoint || !redirectUri) {
      console.error(`Missing UtilityAPI OAuth configuration for utility: ${utility}`);
      console.error(`Required env vars: UTILITYAPI_CLIENT_ID_${utilityUpper}, UTILITYAPI_OAUTH_AUTHORIZE_ENDPOINT_${utilityUpper}, UTILITYAPI_REDIRECT_URI`);
      return NextResponse.json(
        { error: `OAuth configuration not set up for ${utility}. Please configure the required environment variables.` },
        { status: 500 }
      );
    }

    // Generate a random state parameter for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Store state, meterId, energySourceId, and utility in a cookie for verification in callback
    const stateData = JSON.stringify({
      state,
      meterId,
      energySourceId,
      utility,
    });

    // UtilityAPI Green Button OAuth authorization URL
    const authUrl = new URL(authorizeEndpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    // Optional: Add scope if needed (defaults to account settings)
    // authUrl.searchParams.set("scope", "FB=4_51");

    // Create response with redirect
    const response = NextResponse.redirect(authUrl.toString());

    // Set state cookie (expires in 10 minutes)
    response.cookies.set("utilityapi_oauth_state", stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error initiating UtilityAPI OAuth:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate OAuth flow",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
