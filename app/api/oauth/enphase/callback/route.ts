import { NextResponse } from "next/server";
import { db } from "@/db";
import { energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Enphase OAuth Callback Endpoint
 *
 * This endpoint handles the OAuth 2.0 callback from Enphase.
 * It exchanges the authorization code for access and refresh tokens,
 * then stores them in the energy source metadata.
 *
 * Query Parameters:
 * - code: Authorization code from Enphase
 * - state: State parameter for CSRF protection
 *
 * Environment Variables Required:
 * - ENPHASE_CLIENT_ID: Your Enphase application client ID
 * - ENPHASE_CLIENT_SECRET: Your Enphase application client secret
 * - ENPHASE_REDIRECT_URI: Your registered redirect URI
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
      .find((c) => c.startsWith("enphase_oauth_state="))
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

    const { meterId, energySourceId } = stateData;

    const clientId = process.env.ENPHASE_CLIENT_ID;
    const clientSecret = process.env.ENPHASE_CLIENT_SECRET;
    const redirectUri = process.env.ENPHASE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Missing Enphase OAuth configuration");
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=config_missing", request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://api.enphaseenergy.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return NextResponse.redirect(
        new URL("/settings?tab=data-connections&oauth_error=token_exchange_failed", request.url)
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate token expiry time
    const expiresIn = tokenData.expires_in || 3600; // Default 1 hour if not provided
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

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

    // Clear the state cookie and redirect back to settings
    const response = NextResponse.redirect(
      new URL("/settings?tab=data-connections&oauth_success=true", request.url)
    );

    response.cookies.set("enphase_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0, // Delete cookie
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in Enphase OAuth callback:", error);
    return NextResponse.redirect(
      new URL("/settings?tab=data-connections&oauth_error=server_error", request.url)
    );
  }
}
