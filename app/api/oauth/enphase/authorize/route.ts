import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * Enphase OAuth Authorization Initiation Endpoint
 *
 * This endpoint initiates the OAuth 2.0 authorization flow for Enphase.
 * It redirects the user to Enphase's authorization page.
 *
 * Query Parameters:
 * - meterId: The meter ID to associate with this connection
 * - energySourceId: The energy source ID to store tokens in
 *
 * Environment Variables Required:
 * - ENPHASE_CLIENT_ID: Your Enphase application client ID
 * - ENPHASE_REDIRECT_URI: Your registered redirect URI (e.g., http://localhost:3000/api/oauth/enphase/callback)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meterId = searchParams.get("meterId");
    const energySourceId = searchParams.get("energySourceId");

    if (!meterId || !energySourceId) {
      return NextResponse.json(
        { error: "Missing meterId or energySourceId" },
        { status: 400 }
      );
    }

    const clientId = process.env.ENPHASE_CLIENT_ID;
    const redirectUri = process.env.ENPHASE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("Missing Enphase OAuth configuration");
      return NextResponse.json(
        { error: "OAuth configuration not set up. Please configure ENPHASE_CLIENT_ID and ENPHASE_REDIRECT_URI" },
        { status: 500 }
      );
    }

    // Generate a random state parameter for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Store state, meterId, and energySourceId in a cookie for verification in callback
    const stateData = JSON.stringify({
      state,
      meterId,
      energySourceId,
    });

    // Enphase OAuth authorization URL
    const authUrl = new URL("https://api.enphaseenergy.com/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    // Create response with redirect
    const response = NextResponse.redirect(authUrl.toString());

    // Set state cookie (expires in 10 minutes)
    response.cookies.set("enphase_oauth_state", stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error initiating Enphase OAuth:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate OAuth flow",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
