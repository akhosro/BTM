"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Check, AlertCircle } from "lucide-react";

interface SiteFormProps {
  onSubmit: (data: SiteFormData) => Promise<void>;
  onCancel?: () => void;
}

export interface SiteFormData {
  name: string;
  location?: string;
  latitude: number;
  longitude: number;
  gridZone: string;
  industryType?: string;
  description?: string;
}

export function SiteFormWithGeocoding({ onSubmit, onCancel }: SiteFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    latitude: "",
    longitude: "",
    gridZone: "",
    gridZoneName: "",
    industryType: "other",
    description: "",
  });

  const [geocoding, setGeocoding] = useState(false);
  const [geocodeSuccess, setGeocodeSuccess] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Geocode location text to get coordinates and grid zone
   */
  const handleGeocodeLocation = async () => {
    if (!formData.location.trim()) {
      setGeocodeError("Please enter a location");
      return;
    }

    setGeocoding(true);
    setGeocodeError(null);
    setGeocodeSuccess(false);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: formData.location }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Geocoding failed");
      }

      // Auto-fill coordinates and grid zone
      setFormData(prev => ({
        ...prev,
        latitude: data.latitude.toString(),
        longitude: data.longitude.toString(),
        gridZone: data.gridZone,
        gridZoneName: data.gridZoneName || data.gridZone,
        location: data.formattedAddress || prev.location,
      }));

      setGeocodeSuccess(true);
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : "Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  };

  /**
   * Validate coordinates and get grid zone
   */
  const handleValidateCoordinates = async () => {
    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      setGeocodeError("Invalid coordinates");
      return;
    }

    setGeocoding(true);
    setGeocodeError(null);
    setGeocodeSuccess(false);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Validation failed");
      }

      setFormData(prev => ({
        ...prev,
        gridZone: data.gridZone,
        gridZoneName: data.gridZoneName || data.gridZone,
      }));

      setGeocodeSuccess(true);
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setGeocoding(false);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      setGeocodeError("Site name is required");
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      setGeocodeError("Coordinates are required");
      return;
    }

    if (!formData.gridZone) {
      setGeocodeError("Grid zone is required. Please geocode the location or validate coordinates.");
      return;
    }

    setSubmitting(true);
    setGeocodeError(null);

    try {
      await onSubmit({
        name: formData.name,
        location: formData.location || undefined,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        gridZone: formData.gridZone,
        industryType: formData.industryType || undefined,
        description: formData.description || undefined,
      });
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : "Failed to create site");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Site Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Site Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Manufacturing Plant A"
          required
        />
      </div>

      {/* Location with Geocoding */}
      <div className="space-y-2">
        <Label htmlFor="location">Location (City, Region)</Label>
        <div className="flex gap-2">
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => {
              setFormData({ ...formData, location: e.target.value });
              setGeocodeSuccess(false);
            }}
            placeholder="e.g., Toronto, ON"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleGeocodeLocation}
            disabled={geocoding || !formData.location.trim()}
          >
            {geocoding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            <span className="ml-2">Geocode</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter a location and click Geocode to auto-fill coordinates and grid zone
        </p>
      </div>

      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="latitude">
            Latitude <span className="text-red-500">*</span>
          </Label>
          <Input
            id="latitude"
            type="number"
            step="any"
            value={formData.latitude}
            onChange={(e) => {
              setFormData({ ...formData, latitude: e.target.value });
              setGeocodeSuccess(false);
            }}
            onBlur={handleValidateCoordinates}
            placeholder="e.g., 43.6532"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">
            Longitude <span className="text-red-500">*</span>
          </Label>
          <Input
            id="longitude"
            type="number"
            step="any"
            value={formData.longitude}
            onChange={(e) => {
              setFormData({ ...formData, longitude: e.target.value });
              setGeocodeSuccess(false);
            }}
            onBlur={handleValidateCoordinates}
            placeholder="e.g., -79.3832"
            required
          />
        </div>
      </div>

      {/* Grid Zone (Auto-detected) */}
      {formData.gridZone && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Grid Zone Detected</p>
              <p className="text-sm text-green-700">
                {formData.gridZone} - {formData.gridZoneName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Geocoding Success */}
      {geocodeSuccess && !formData.gridZone && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-700">
              Coordinates updated successfully
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {geocodeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{geocodeError}</p>
          </div>
        </div>
      )}

      {/* Industry Type */}
      <div className="space-y-2">
        <Label htmlFor="industryType">Industry Type</Label>
        <select
          id="industryType"
          value={formData.industryType}
          onChange={(e) => setFormData({ ...formData, industryType: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="manufacturing">Manufacturing</option>
          <option value="data_center">Data Center</option>
          <option value="healthcare">Healthcare</option>
          <option value="education">Education</option>
          <option value="retail">Retail</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Additional details about the site"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting || !formData.gridZone}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Site"
          )}
        </Button>
      </div>
    </form>
  );
}
