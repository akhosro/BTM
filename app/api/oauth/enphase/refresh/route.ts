import { NextResponse } from "next/server";
import { db } from "@/db";
import { energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Enphase OAuth Token Refresh Endpoint
 *
 * This endpoint refreshes an expired or expiring OAuth token for Enphase.
 * It should be called before the access token expires.
 *
 * Request Body:
 * - energySourceId: The energy source ID whose token needs refreshing
 *
 * Environment Variables Required:
 * - ENPHASE_CLIENT_ID: Your Enphase application client ID
 * - ENPHASE_CLIENT_SECRET: Your Enphase application client secret
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

    // Get the energy source with current tokens
    const source = await db.query.energySources.findFirst({
      where: eq(energySources.id, energySourceId),
    });

    if (!source) {
      return NextResponse.json(
        { error: "Energy source not found" },
        { status: 404 }
      );
    }

    const refreshToken = (source.metadata as any)?.refreshToken;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "No refresh token available. Please re-authenticate." },
        { status: 400 }
      );
    }

    const clientId = process.env.ENPHASE_CLIENT_ID;
    const clientSecret = process.env.ENPHASE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Missing Enphase OAuth configuration");
      return NextResponse.json(
        { error: "OAuth configuration not set up" },
        { status: 500 }
      );
    }

    // Request new access token using refresh token
    const tokenResponse = await fetch("https://api.enphaseenergy.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);

      // If refresh token is invalid, mark connection as failed
      await db
        .update(energySources)
        .set({
          metadata: {
            ...(source.metadata as any),
            connectionStatus: "failed",
            lastConnectionError: "Refresh token expired. Please re-authenticate.",
            lastConnectionTest: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(energySources.id, energySourceId));

      return NextResponse.json(
        { error: "Token refresh failed. Please re-authenticate." },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate new token expiry
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Update energy source with new tokens
    const updatedMetadata = {
      ...(source.metadata as any),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
      tokenExpiry,
      tokenType: tokenData.token_type || "Bearer",
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

    return NextResponse.json({
      success: true,
      tokenExpiry,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    console.error("Error refreshing Enphase token:", error);
    return NextResponse.json(
      {
        error: "Failed to refresh token",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
