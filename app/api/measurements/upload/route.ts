import { NextResponse } from "next/server";
import { db } from "@/db";
import { measurements } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { meterId, data } = body;

    if (!meterId || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "meterId and data array are required" },
        { status: 400 }
      );
    }

    // Validate data format
    for (const record of data) {
      if (!record.timestamp || record.value === undefined) {
        return NextResponse.json(
          { error: "Each record must have timestamp and value fields" },
          { status: 400 }
        );
      }
    }

    // Prepare measurements for bulk insert
    const measurementsToInsert = data.map((record: any) => ({
      entityId: meterId,
      entityType: "meter",
      timestamp: new Date(record.timestamp),
      metric: record.metric || "energy",
      value: parseFloat(record.value),
      unit: record.unit || "kWh",
      quality: record.quality || "good",
      metadata: record.metadata || {},
    }));

    // Bulk insert measurements
    const inserted = await db
      .insert(measurements)
      .values(measurementsToInsert)
      .returning();

    return NextResponse.json(
      {
        success: true,
        count: inserted.length,
        message: `Successfully uploaded ${inserted.length} measurements`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading measurements:", error);
    return NextResponse.json(
      {
        error: "Failed to upload measurements",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET measurements for a meter
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const meterId = searchParams.get("meterId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = searchParams.get("limit");

    if (!meterId) {
      return NextResponse.json(
        { error: "meterId is required" },
        { status: 400 }
      );
    }

    let query = db
      .select()
      .from(measurements)
      .where((measurements as any).meterId.eq(meterId))
      .orderBy((measurements as any).timestamp.desc());

    if (limit) {
      query = query.limit(parseInt(limit)) as any;
    }

    const results = await query;

    return NextResponse.json({
      success: true,
      count: results.length,
      measurements: results,
    });
  } catch (error) {
    console.error("Error fetching measurements:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch measurements",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
