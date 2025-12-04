import { NextResponse } from "next/server";
import { db } from "@/db";
import { energySources } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const sources = await db
      .select({
        id: energySources.id,
        meterId: energySources.meterId,
        name: energySources.name,
        sourceType: energySources.sourceType,
        capacity: energySources.capacity,
        metadata: energySources.metadata,
        active: energySources.active,
      })
      .from(energySources)
      .where(eq(energySources.active, true));

    return NextResponse.json(sources, { status: 200 });
  } catch (error) {
    console.error("Error fetching energy sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch energy sources" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sources } = body;

    if (!sources || !Array.isArray(sources)) {
      return NextResponse.json(
        { error: "Sources data is required and must be an array" },
        { status: 400 }
      );
    }

    const savedSources: any[] = [];

    for (const sourceData of sources) {
      if (!sourceData.meterId || !sourceData.name || !sourceData.sourceType) {
        continue;
      }

      let savedSource;

      if (sourceData.id) {
        const [updatedSource] = await db
          .update(energySources)
          .set({
            name: sourceData.name,
            sourceType: sourceData.sourceType,
            capacity: sourceData.capacity,
            metadata: sourceData.metadata || {},
            active: sourceData.active ?? true,
            updatedAt: new Date(),
          })
          .where(eq(energySources.id, sourceData.id))
          .returning();
        savedSource = updatedSource;
      } else {
        const [newSource] = await db
          .insert(energySources)
          .values({
            meterId: sourceData.meterId,
            name: sourceData.name,
            sourceType: sourceData.sourceType,
            capacity: sourceData.capacity,
            metadata: sourceData.metadata || {},
            active: sourceData.active ?? true,
          })
          .returning();
        savedSource = newSource;
      }

      savedSources.push(savedSource);
    }

    return NextResponse.json(
      {
        success: true,
        sources: savedSources,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error saving energy sources:", error);
    return NextResponse.json(
      {
        error: "Failed to save energy sources",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
