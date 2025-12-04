"""
Carbon Intensity Client for Ontario Grid

Fetches real-time grid carbon intensity from Electricity Maps (formerly CO2 Signal) API.
Free tier: 50 requests/hour, perfect for hourly updates.

API Documentation: https://www.electricitymaps.com/free-tier-api
Signup: https://www.electricitymaps.com/free-tier-api
"""

import requests
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional


class CarbonIntensityClient:
    """Client for Electricity Maps / CO2 Signal API"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ELECTRICITYMAPS_API_KEY') or os.getenv('CO2SIGNAL_API_KEY')
        self.base_url = "https://api.electricitymap.org/v3"

    def get_carbon_intensity(
        self,
        zone: str = "CA-ON",  # Ontario, Canada
        hours_forecast: int = 24
    ) -> List[Dict]:
        """
        Fetch carbon intensity forecast for a zone

        Args:
            zone: Zone code (CA-ON for Ontario)
            hours_forecast: How many hours of forecast to get

        Returns:
            List of carbon intensity records with timestamp and intensity
        """
        if not self.api_key:
            print("⚠️  No Electricity Maps API key found, using fallback data")
            return self._get_fallback_ontario_carbon(hours_forecast)

        try:
            # Get current carbon intensity
            headers = {
                "auth-token": self.api_key
            }

            url = f"{self.base_url}/carbon-intensity/latest"
            params = {"zone": zone}

            response = requests.get(url, headers=headers, params=params, timeout=10)

            if response.status_code == 401:
                print("⚠️  Invalid Electricity Maps API key, using fallback data")
                return self._get_fallback_ontario_carbon(hours_forecast)

            if response.status_code == 429:
                print("⚠️  Rate limit exceeded (50 requests/hour), using fallback data")
                return self._get_fallback_ontario_carbon(hours_forecast)

            response.raise_for_status()

            data = response.json()

            # Extract current carbon intensity
            current_intensity = data.get('carbonIntensity', 0)
            current_time = datetime.fromisoformat(data.get('datetime', datetime.now().isoformat()).replace('Z', '+00:00'))

            print(f"✅ Fetched Ontario carbon intensity: {current_intensity} gCO2/kWh")

            # Since free tier doesn't include forecast, we'll create a forecast
            # based on current value + typical Ontario patterns
            forecast = self._create_forecast_from_current(current_intensity, current_time, hours_forecast)

            return forecast

        except Exception as e:
            print(f"⚠️  Electricity Maps API error: {e}")
            print(f"Using fallback Ontario carbon intensity data")
            return self._get_fallback_ontario_carbon(hours_forecast)

    def _create_forecast_from_current(
        self,
        current_intensity: float,
        current_time: datetime,
        hours: int
    ) -> List[Dict]:
        """
        Create forecast based on current intensity + Ontario grid patterns

        Ontario grid is ~90% clean (nuclear + hydro), with natural gas peaking
        """
        forecast = []

        for i in range(hours):
            timestamp = current_time + timedelta(hours=i)
            hour = timestamp.hour

            # Apply typical Ontario diurnal pattern (multiplier on current base)
            # Ontario's carbon intensity varies based on natural gas usage
            if 0 <= hour < 6:
                # Night: Low demand, minimal gas, ~10% below average
                multiplier = 0.90
            elif 6 <= hour < 9:
                # Morning ramp: Increasing gas, ~5% above average
                multiplier = 1.05
            elif 9 <= hour < 17:
                # Daytime: Moderate demand, average
                multiplier = 1.0
            elif 17 <= hour < 22:
                # Evening peak: Maximum gas generation, ~20% above average
                multiplier = 1.20
            else:
                # Late evening: Decreasing, near average
                multiplier = 0.95

            intensity = current_intensity * multiplier

            forecast.append({
                'timestamp': timestamp.isoformat(),
                'carbon_intensity': round(intensity, 1),
                'region': 'Ontario',
                'data_source': 'ElectricityMaps',
                'is_forecast': i > 0  # First value is current, rest are forecast
            })

        return forecast

    def _get_fallback_ontario_carbon(self, hours: int = 24) -> List[Dict]:
        """
        Generate realistic fallback carbon intensity for Ontario

        Ontario grid averages ~30-60 gCO2/kWh (one of the cleanest in North America)
        - Nuclear: ~60% (zero carbon)
        - Hydro: ~25% (zero carbon)
        - Natural Gas: ~10% (high carbon during peaks)
        - Wind/Solar: ~5%

        Reference: https://www.ieso.ca/en/Corporate-IESO/Media/Year-End-Data
        """
        forecast = []
        now = datetime.now()

        for i in range(hours):
            timestamp = now + timedelta(hours=i)
            hour = timestamp.hour

            # Realistic Ontario carbon intensity pattern (gCO2/kWh)
            if 0 <= hour < 6:
                # Night: Minimal gas peaking, mostly nuclear/hydro
                intensity = 30
            elif 6 <= hour < 9:
                # Morning ramp: Some gas peaking
                intensity = 50
            elif 9 <= hour < 17:
                # Daytime: Moderate load, mix of sources
                intensity = 40
            elif 17 <= hour < 22:
                # Evening peak: Maximum gas generation
                intensity = 70
            else:
                # Late evening: Decreasing gas
                intensity = 45

            # Add small random variation
            import random
            variation = random.uniform(-5, 5)
            intensity = max(25, intensity + variation)  # Ontario rarely below 25 gCO2/kWh

            forecast.append({
                'timestamp': timestamp.isoformat(),
                'carbon_intensity': round(intensity, 1),
                'region': 'Ontario',
                'data_source': 'fallback',
                'is_forecast': True
            })

        return forecast

    def get_historical_average(self, zone: str = "CA-ON") -> float:
        """
        Get historical average carbon intensity for a zone

        For Ontario: ~40 gCO2/kWh average (one of the cleanest grids)
        """
        # Ontario-specific averages
        averages = {
            'CA-ON': 40,  # Ontario: Nuclear + Hydro dominant
            'CA-AB': 600,  # Alberta: Coal/gas heavy (for comparison)
            'CA-BC': 20,   # BC: Mostly hydro (for comparison)
        }

        return averages.get(zone, 300)  # Default to ~300 if zone unknown


# Convenience function
def get_ontario_carbon_intensity(hours: int = 24) -> List[Dict]:
    """Quick helper to get Ontario carbon intensity forecast"""
    client = CarbonIntensityClient()
    return client.get_carbon_intensity(zone="CA-ON", hours_forecast=hours)
