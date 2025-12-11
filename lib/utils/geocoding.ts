/**
 * Geocoding Utilities
 * Convert location text to coordinates using various geocoding services
 */

import { getGridZoneFromCoordinates } from "./grid-zone-mapper";

export interface GeocodeResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  gridZone?: string;
  formattedAddress?: string;
  error?: string;
}

/**
 * Geocode using Nominatim (OpenStreetMap) - Free, no API key required
 * Rate limit: 1 request per second
 */
async function geocodeWithNominatim(address: string): Promise<GeocodeResult> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(address)}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Enalysis-MVP/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Location not found",
      };
    }

    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    // Auto-detect grid zone from coordinates
    const gridZone = getGridZoneFromCoordinates(latitude, longitude);

    if (!gridZone) {
      return {
        success: false,
        latitude,
        longitude,
        error: "Location not supported - no grid zone available for this region",
      };
    }

    return {
      success: true,
      latitude,
      longitude,
      gridZone,
      formattedAddress: result.display_name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Geocoding failed",
    };
  }
}

/**
 * Geocode using Google Maps Geocoding API (requires API key)
 * More accurate but requires GOOGLE_MAPS_API_KEY in environment
 */
async function geocodeWithGoogle(address: string): Promise<GeocodeResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Google Maps API key not configured",
    };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(address)}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Maps API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return {
        success: false,
        error: data.error_message || "Location not found",
      };
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry.location;

    // Auto-detect grid zone from coordinates
    const gridZone = getGridZoneFromCoordinates(lat, lng);

    if (!gridZone) {
      return {
        success: false,
        latitude: lat,
        longitude: lng,
        error: "Location not supported - no grid zone available for this region",
      };
    }

    return {
      success: true,
      latitude: lat,
      longitude: lng,
      gridZone,
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Geocoding failed",
    };
  }
}

/**
 * Main geocoding function
 * Tries Google Maps first (if API key available), falls back to Nominatim
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  if (!address || address.trim() === '') {
    return {
      success: false,
      error: "Address is required",
    };
  }

  // Try Google Maps first if API key is available
  if (process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    const googleResult = await geocodeWithGoogle(address);
    if (googleResult.success) {
      return googleResult;
    }
  }

  // Fall back to Nominatim (free, no API key)
  return geocodeWithNominatim(address);
}

/**
 * Validate and get grid zone from coordinates
 */
export function validateAndGetGridZone(
  latitude: number,
  longitude: number
): { success: boolean; gridZone?: string; error?: string } {
  // Validate coordinates
  if (latitude < -90 || latitude > 90) {
    return { success: false, error: "Invalid latitude (must be -90 to 90)" };
  }
  if (longitude < -180 || longitude > 180) {
    return { success: false, error: "Invalid longitude (must be -180 to 180)" };
  }

  // Get grid zone
  const gridZone = getGridZoneFromCoordinates(latitude, longitude);

  if (!gridZone) {
    return {
      success: false,
      error: "Location not supported - no grid zone available for these coordinates",
    };
  }

  return { success: true, gridZone };
}
