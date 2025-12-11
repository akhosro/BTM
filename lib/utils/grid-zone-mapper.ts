/**
 * Grid Zone Mapper
 * Maps coordinates to Electricity Maps grid zone codes
 * Based on: https://static.electricitymaps.com/api/docs/index.html#zones
 */

interface GridZoneMapping {
  name: string;
  zone: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  country?: string;
}

// Electricity Maps zones with coordinate boundaries
const GRID_ZONE_MAPPINGS: GridZoneMapping[] = [
  // Canada - Ontario
  {
    name: "Ontario",
    zone: "CA-ON",
    country: "CA",
    bounds: {
      minLat: 41.5,
      maxLat: 57.0,
      minLon: -95.2,
      maxLon: -74.3,
    },
  },
  // Canada - Quebec
  {
    name: "Quebec",
    zone: "CA-QC",
    country: "CA",
    bounds: {
      minLat: 45.0,
      maxLat: 62.5,
      minLon: -79.8,
      maxLon: -57.1,
    },
  },
  // USA - California (CAISO)
  {
    name: "California (CAISO)",
    zone: "US-CAL-CISO",
    country: "US",
    bounds: {
      minLat: 32.5,
      maxLat: 42.0,
      minLon: -124.5,
      maxLon: -114.1,
    },
  },
  // USA - New York
  {
    name: "New York (NYISO)",
    zone: "US-NY-NYIS",
    country: "US",
    bounds: {
      minLat: 40.5,
      maxLat: 45.0,
      minLon: -79.8,
      maxLon: -71.9,
    },
  },
  // USA - Texas (ERCOT)
  {
    name: "Texas (ERCOT)",
    zone: "US-TEX-ERCO",
    country: "US",
    bounds: {
      minLat: 25.8,
      maxLat: 36.5,
      minLon: -106.6,
      maxLon: -93.5,
    },
  },
  // Add more zones as needed
];

/**
 * Get grid zone from coordinates
 */
export function getGridZoneFromCoordinates(
  latitude: number,
  longitude: number
): string | null {
  // Find matching zone based on coordinate bounds
  for (const mapping of GRID_ZONE_MAPPINGS) {
    const { bounds } = mapping;
    if (
      latitude >= bounds.minLat &&
      latitude <= bounds.maxLat &&
      longitude >= bounds.minLon &&
      longitude <= bounds.maxLon
    ) {
      return mapping.zone;
    }
  }

  // No zone found
  return null;
}

/**
 * Get all available grid zones for display in UI
 */
export function getAvailableGridZones(): GridZoneMapping[] {
  return GRID_ZONE_MAPPINGS;
}

/**
 * Get grid zone details by zone code
 */
export function getGridZoneDetails(zone: string): GridZoneMapping | null {
  return GRID_ZONE_MAPPINGS.find((m) => m.zone === zone) || null;
}

/**
 * Validate if coordinates fall within a known grid zone
 */
export function validateCoordinates(
  latitude: number,
  longitude: number
): { valid: boolean; zone: string | null; message?: string } {
  // Check if coordinates are valid
  if (latitude < -90 || latitude > 90) {
    return { valid: false, zone: null, message: "Invalid latitude (must be -90 to 90)" };
  }
  if (longitude < -180 || longitude > 180) {
    return { valid: false, zone: null, message: "Invalid longitude (must be -180 to 180)" };
  }

  const zone = getGridZoneFromCoordinates(latitude, longitude);

  if (!zone) {
    return {
      valid: false,
      zone: null,
      message: "Location not supported - no grid zone found for these coordinates",
    };
  }

  return { valid: true, zone };
}
