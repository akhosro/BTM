import { NextResponse } from "next/server";
import { db } from "@/db";
import { recommendations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!["pending", "acknowledged", "dismissed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'pending', 'acknowledged', or 'dismissed'" },
        { status: 400 }
      );
    }

    // Update recommendation status
    const updated = await db
      .update(recommendations)
      .set({
        status,
        actedOnAt: status !== "pending" ? new Date() : null
      })
      .where(eq(recommendations.id, id))
      .returning();

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recommendation: updated[0]
    });
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json(
      {
        error: "Failed to update recommendation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const recommendation = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id))
      .limit(1);

    if (!recommendation || recommendation.length === 0) {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      recommendation: recommendation[0]
    });
  } catch (error) {
    console.error("Error fetching recommendation:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch recommendation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
