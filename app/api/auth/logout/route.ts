import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

/**
 * Logout API Endpoint
 * Clears the session cookie
 */
export async function POST() {
  try {
    // Clear session cookie
    await clearSessionCookie();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}
