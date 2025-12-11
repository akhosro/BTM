import { NextResponse } from "next/server";
import { geocodeAddress, validateAndGetGridZone } from "@/lib/utils/geocoding";
import { getGridZoneDetails } from "@/lib/utils/grid-zone-mapper";

/**
 * POST /api/geocode
 * Geocode an address and auto-detect grid zone
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, latitude, longitude } = body;

    // Option 1: Geocode from address
    if (address) {
      const result = await geocodeAddress(address);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      // Get grid zone details for display
      const gridZoneDetails = result.gridZone
        ? getGridZoneDetails(result.gridZone)
        : null;

      return NextResponse.json({
        success: true,
        latitude: result.latitude,
        longitude: result.longitude,
        gridZone: result.gridZone,
        gridZoneName: gridZoneDetails?.name,
        formattedAddress: result.formattedAddress,
      });
    }

    // Option 2: Validate coordinates and get grid zone
    if (latitude !== undefined && longitude !== undefined) {
      const result = validateAndGetGridZone(latitude, longitude);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      // Get grid zone details for display
      const gridZoneDetails = result.gridZone
        ? getGridZoneDetails(result.gridZone)
        : null;

      return NextResponse.json({
        success: true,
        latitude,
        longitude,
        gridZone: result.gridZone,
        gridZoneName: gridZoneDetails?.name,
      });
    }

    return NextResponse.json(
      { error: "Either 'address' or 'latitude' and 'longitude' are required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      {
        error: "Geocoding failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/geocode/zones
 * Get all available grid zones
 */
export async function GET() {
  try {
    const { getAvailableGridZones } = await import("@/lib/utils/grid-zone-mapper");
    const zones = getAvailableGridZones();

    return NextResponse.json({
      success: true,
      zones: zones.map(zone => ({
        code: zone.zone,
        name: zone.name,
        country: zone.country,
      })),
    });
  } catch (error) {
    console.error("Error fetching grid zones:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch grid zones",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
