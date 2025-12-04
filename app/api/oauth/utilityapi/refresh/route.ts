import { NextResponse } from "next/server";
import { db } from "@/db";
import { energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * UtilityAPI OAuth Token Refresh Endpoint
 *
 * This endpoint refreshes an expired access token using the refresh token.
 * It's called automatically when the access token is about to expire.
 *
 * Request Body (JSON):
 * - energySourceId: The energy source ID containing the refresh token
 *
 * Environment Variables Required:
 * - UTILITYAPI_CLIENT_ID_{UTILITY}: Your OAuth client ID for the specific utility
 * - UTILITYAPI_CLIENT_SECRET_{UTILITY}: Your OAuth client secret for the specific utility
 * - UTILITYAPI_OAUTH_TOKEN_ENDPOINT_{UTILITY}: The OAuth token endpoint for the utility
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { energySourceId } = body;

    if (!energySourceId) {
      return NextResponse.json(
        { error: "Missing energySourceId" },
        { status: 400 }
      );
    }

    // Get the energy source
    const source = await db.query.energySources.findFirst({
      where: eq(energySources.id, energySourceId),
    });

    if (!source) {
      return NextResponse.json(
        { error: "Energy source not found" },
        { status: 404 }
      );
    }

    const metadata = source.metadata as Record<string, any>;
    const refreshToken = metadata?.refreshToken;
    const utility = metadata?.utility;

    if (!refreshToken || !utility) {
      return NextResponse.json(
        { error: "Missing refresh token or utility information" },
        { status: 400 }
      );
    }

    const utilityUpper = utility.toUpperCase();

    // Get utility-specific OAuth configuration
    const clientId = process.env[`UTILITYAPI_CLIENT_ID_${utilityUpper}`];
    const clientSecret = process.env[`UTILITYAPI_CLIENT_SECRET_${utilityUpper}`];
    const tokenEndpoint = process.env[`UTILITYAPI_OAUTH_TOKEN_ENDPOINT_${utilityUpper}`];

    if (!clientId || !clientSecret || !tokenEndpoint) {
      console.error(`Missing UtilityAPI OAuth configuration for utility: ${utility}`);
      return NextResponse.json(
        { error: "OAuth configuration not found" },
        { status: 500 }
      );
    }

    // Refresh the token
    // UtilityAPI uses Basic Auth with base64-encoded client_id:client_secret
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("UtilityAPI token refresh failed:", errorText);
      return NextResponse.json(
        { error: "Token refresh failed", details: errorText },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate new token expiry time
    const expiresIn = tokenData.expires_in || 3600; // Default 1 hour
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update energy source with new tokens
    const updatedMetadata = {
      ...metadata,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided, else keep old
      tokenExpiry,
      tokenType: tokenData.token_type || "Bearer",
      lastTokenRefresh: new Date().toISOString(),
    };

    await db
      .update(energySources)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(energySources.id, energySourceId));

    return NextResponse.json({
      success: true,
      accessToken: tokenData.access_token,
      expiresIn,
      tokenExpiry,
    });
  } catch (error) {
    console.error("Error refreshing UtilityAPI token:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh token",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
