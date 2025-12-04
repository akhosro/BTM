import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

/**
 * Get Current User Profile
 * Retrieves the authenticated user's profile
 */
export async function GET() {
  try {
    // Get authenticated user ID from session
    const userId = await getCurrentUserId();

    // Fetch user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error fetching user:", error);

    // Handle unauthorized error
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

/**
 * Update Current User Profile
 * Updates the authenticated user's profile
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Get authenticated user ID from session
    const userId = await getCurrentUserId();

    // Validate input
    const updateData: Partial<typeof users.$inferInsert> = {};
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;
    if (body.company !== undefined) updateData.company = body.company;
    if (body.phone !== undefined) updateData.phone = body.phone;

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Return user without password hash
    const { passwordHash, ...userWithoutPassword } = updatedUser;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating user:", error);

    // Handle unauthorized error
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}
