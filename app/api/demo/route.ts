import { NextResponse } from "next/server";
import { db } from "@/db";
import { demoRequests } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, company, jobTitle, phone, facilityType, message } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !company || !jobTitle || !facilityType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create demo request
    const [demoRequest] = await db
      .insert(demoRequests)
      .values({
        firstName,
        lastName,
        email,
        company,
        jobTitle,
        phone: phone || null,
        facilityType,
        message: message || null,
        status: "pending",
      })
      .returning();

    return NextResponse.json({
      success: true,
      demoRequest,
    });
  } catch (error) {
    console.error("Error creating demo request:", error);
    return NextResponse.json(
      { error: "Failed to submit demo request" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve demo requests (for admin)
export async function GET() {
  try {
    const requests = await db
      .select()
      .from(demoRequests)
      .orderBy(demoRequests.createdAt);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching demo requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch demo requests" },
      { status: 500 }
    );
  }
}
