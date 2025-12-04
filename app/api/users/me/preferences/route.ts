import { NextResponse } from "next/server";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

/**
 * Get Current User Preferences
 * Retrieves the authenticated user's preferences
 */
export async function GET() {
  try {
    // Get authenticated user ID from session
    const userId = await getCurrentUserId();

    // Get or create preferences
    let preferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });

    if (!preferences) {
      // Create default preferences
      const [newPreferences] = await db
        .insert(userPreferences)
        .values({
          userId: userId,
        })
        .returning();
      preferences = newPreferences;
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching preferences:", error);

    // Handle unauthorized error
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

/**
 * Update Current User Preferences
 * Updates the authenticated user's preferences
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Get authenticated user ID from session
    const userId = await getCurrentUserId();

    // Validate input
    const updateData: Partial<typeof userPreferences.$inferInsert> = {};
    if (body.theme !== undefined) updateData.theme = body.theme;
    if (body.emailNotifications !== undefined)
      updateData.emailNotifications = body.emailNotifications;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.alertThresholds !== undefined)
      updateData.alertThresholds = body.alertThresholds;

    // Get existing preferences
    const existingPreferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId),
    });

    let updatedPreferences;

    if (existingPreferences) {
      // Update existing
      [updatedPreferences] = await db
        .update(userPreferences)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId))
        .returning();
    } else {
      // Create new
      [updatedPreferences] = await db
        .insert(userPreferences)
        .values({
          userId: userId,
          ...updateData,
        })
        .returning();
    }

    return NextResponse.json(updatedPreferences);
  } catch (error) {
    console.error("Error updating preferences:", error);

    // Handle unauthorized error
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}
