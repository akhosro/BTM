import { NextResponse } from "next/server";
import { db } from "@/db";
import { electricityPricing, sites } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const region = searchParams.get("region");
    const activeOnly = searchParams.get("activeOnly") === "true";

    // If siteId provided, verify it belongs to the current user
    if (siteId) {
      const site = await db.query.sites.findFirst({
        where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
      });
      if (!site) {
        return NextResponse.json(
          { error: "Site not found or access denied" },
          { status: 403 }
        );
      }
    }

    let query = db
      .select()
      .from(electricityPricing)
      .orderBy(desc(electricityPricing.validFrom));

    const conditions = [];
    if (siteId) {
      conditions.push(eq(electricityPricing.siteId, siteId));
    }
    if (region) {
      conditions.push(eq(electricityPricing.region, region));
    }
    if (activeOnly) {
      conditions.push(eq(electricityPricing.active, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const pricing = await query;

    return NextResponse.json(pricing, { status: 200 });
  } catch (error) {
    console.error("Error fetching electricity pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch electricity pricing" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await request.json();
    const {
      siteId,
      region,
      utilityProvider,
      rateType,
      rateStructure,
      currency,
      demandCharge,
      demandThreshold,
      validFrom,
      validTo,
      dataSource,
      metadata,
    } = body;

    if (!region || !rateType || !rateStructure || !validFrom) {
      return NextResponse.json(
        { error: "Missing required fields: region, rateType, rateStructure, validFrom" },
        { status: 400 }
      );
    }

    // If siteId provided, verify it belongs to the current user
    if (siteId) {
      const site = await db.query.sites.findFirst({
        where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
      });
      if (!site) {
        return NextResponse.json(
          { error: "Site not found or access denied" },
          { status: 403 }
        );
      }
    }

    // Deactivate previous pricing for this site/region if creating a new active one
    if (siteId || region) {
      const conditions = [];
      if (siteId) conditions.push(eq(electricityPricing.siteId, siteId));
      if (region) conditions.push(eq(electricityPricing.region, region));

      if (conditions.length > 0) {
        await db
          .update(electricityPricing)
          .set({ active: false })
          .where(and(...conditions));
      }
    }

    const [newPricing] = await db
      .insert(electricityPricing)
      .values({
        siteId: siteId || null,
        region,
        utilityProvider: utilityProvider || null,
        rateType,
        rateStructure,
        currency: currency || "CAD",
        demandCharge: demandCharge || null,
        demandThreshold: demandThreshold || null,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
        active: true,
        dataSource: dataSource || "manual",
        metadata: metadata || {},
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        pricing: newPricing,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating electricity pricing:", error);
    return NextResponse.json(
      {
        error: "Failed to create electricity pricing",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Pricing ID is required" },
        { status: 400 }
      );
    }

    const [updatedPricing] = await db
      .update(electricityPricing)
      .set({
        active: active !== undefined ? active : undefined,
        updatedAt: new Date(),
      })
      .where(eq(electricityPricing.id, id))
      .returning();

    if (!updatedPricing) {
      return NextResponse.json(
        { error: "Pricing not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        pricing: updatedPricing,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating electricity pricing:", error);
    return NextResponse.json(
      {
        error: "Failed to update electricity pricing",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
