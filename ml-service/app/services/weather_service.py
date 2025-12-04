"""
Weather forecast service using OpenWeatherMap API
Free tier: 1,000 calls/day, 5-day/3-hour forecast
Includes caching to prevent exceeding API limits
"""

import os
import requests
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import math
import json


class WeatherService:
    # Class-level cache shared across instances
    _cache = {}
    _cache_timestamps = {}
    _api_call_count = 0
    _api_call_date = None

    def __init__(self):
        self.api_key = os.getenv("OPENWEATHER_API_KEY")
        self.base_url = os.getenv("OPENWEATHER_BASE_URL", "https://api.openweathermap.org/data/2.5")
        self.cache_duration_hours = int(os.getenv("WEATHER_CACHE_HOURS", "3"))  # Cache for 3 hours by default
        self.max_daily_calls = int(os.getenv("WEATHER_MAX_DAILY_CALLS", "900"))  # Conservative limit (900 out of 1000)

    def get_weather_forecast(self, lat: float, lon: float, solar_capacity_kw: float = 100.0) -> Optional[List[Dict]]:
        """
        Fetch weather forecast from OpenWeatherMap with caching

        Args:
            lat: Latitude
            lon: Longitude
            solar_capacity_kw: Solar panel capacity in kW (default: 100.0)

        Returns:
            List of weather forecasts with solar irradiance estimates
        """
        if not self.api_key or self.api_key == "your_api_key_here":
            print("Warning: OpenWeatherMap API key not configured. Using mock data.")
            return self._generate_mock_forecast(lat, lon)

        # Create cache key from location (rounded to 2 decimal places for nearby locations)
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"

        # Check if we have valid cached data
        if self._is_cache_valid(cache_key):
            print(f"Using cached weather data for {cache_key}")
            return self._cache[cache_key]

        # Check daily API call limit
        if not self._can_make_api_call():
            print(f"⚠️ API call limit reached ({self.max_daily_calls} calls/day). Using cached or mock data.")
            # Return cached data even if expired, or mock data
            if cache_key in self._cache:
                print("Using expired cache to avoid exceeding API limit")
                return self._cache[cache_key]
            return self._generate_mock_forecast(lat, lon)

        try:
            # Fetch weather forecast from API
            url = f"{self.base_url}/forecast"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": self.api_key,
                "units": "metric"  # Celsius, m/s
            }

            print(f"Fetching weather data from API (call {self._api_call_count + 1}/{self.max_daily_calls})")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Parse and cache the data
            forecasts = self._parse_weather_data(data, solar_capacity_kw)
            self._update_cache(cache_key, forecasts)
            self._increment_api_call_count()

            return forecasts

        except Exception as e:
            print(f"Error fetching weather forecast: {e}")
            # Return cached data if available, otherwise mock data
            if cache_key in self._cache:
                print("Using cached data due to API error")
                return self._cache[cache_key]
            return self._generate_mock_forecast(lat, lon, solar_capacity_kw)

    def _parse_weather_data(self, data: Dict, solar_capacity_kw: float = 100.0) -> List[Dict]:
        """Parse OpenWeatherMap API response"""
        forecasts = []

        for item in data.get("list", [])[:40]:  # 5 days, 3-hour intervals = 40 items
            timestamp = datetime.fromtimestamp(item["dt"])

            # Extract weather data
            temp = item["main"]["temp"]
            humidity = item["main"]["humidity"]
            pressure = item["main"]["pressure"]
            clouds = item["clouds"]["all"]
            wind_speed = item["wind"]["speed"]
            wind_direction = item["wind"].get("deg", 0)

            # Precipitation
            rain = item.get("rain", {}).get("3h", 0)
            snow = item.get("snow", {}).get("3h", 0)
            precipitation = rain + snow

            # Calculate solar irradiance (simplified model)
            solar_irradiance = self._estimate_solar_irradiance(
                timestamp, clouds, temp
            )

            # Calculate solar generation using site-specific capacity
            solar_generation = self._estimate_solar_generation(
                solar_irradiance, solar_capacity_kw
            )

            forecasts.append({
                "timestamp": timestamp.isoformat(),
                "temperature": temp,
                "humidity": humidity,
                "pressure": pressure,
                "cloud_cover": clouds,
                "wind_speed": wind_speed,
                "wind_direction": wind_direction,
                "precipitation": precipitation,
                "precipitation_probability": item.get("pop", 0) * 100,  # Convert to percentage
                "solar_irradiance": solar_irradiance,
                "solar_generation": solar_generation,
                "confidence": 0.85,  # OpenWeatherMap general confidence
                "description": item["weather"][0]["description"]
            })

        return forecasts

    def _estimate_solar_irradiance(self, timestamp: datetime, cloud_cover: float, temp: float) -> float:
        """
        Estimate solar irradiance (W/m²) based on time, cloud cover, and temperature

        Simplified model - in production, use actual solar radiation API
        """
        # Hour of day (0-23)
        hour = timestamp.hour

        # Day of year for seasonal variation
        day_of_year = timestamp.timetuple().tm_yday

        # Maximum irradiance at solar noon (varies by season)
        # Peak irradiance ~1000 W/m² in summer, ~600 W/m² in winter
        seasonal_factor = 0.8 + 0.2 * math.cos(2 * math.pi * (day_of_year - 172) / 365)
        max_irradiance = 1000 * seasonal_factor

        # Time of day factor (bell curve centered at solar noon ~12pm)
        if hour < 6 or hour > 18:
            time_factor = 0  # No sun at night
        else:
            # Peak at noon
            time_factor = math.cos(math.pi * (hour - 12) / 12) ** 2

        # Cloud cover reduction (0-100% clouds)
        cloud_factor = 1 - (cloud_cover / 100) * 0.75  # Clouds reduce by up to 75%

        # Calculate irradiance
        irradiance = max_irradiance * time_factor * cloud_factor

        return max(0, round(irradiance, 2))

    def _estimate_solar_generation(self, irradiance: float, capacity_kw: float) -> float:
        """
        Estimate solar generation (kW) from irradiance

        Args:
            irradiance: Solar irradiance in W/m²
            capacity_kw: Solar panel capacity in kW

        Returns:
            Estimated generation in kW
        """
        # Standard test condition (STC): 1000 W/m²
        stc_irradiance = 1000

        # Panel efficiency ~20% (varies by panel type)
        efficiency = 0.20

        # Performance ratio (accounts for losses) ~85%
        performance_ratio = 0.85

        # Calculate generation
        generation = capacity_kw * (irradiance / stc_irradiance) * performance_ratio

        return round(generation, 2)

    def _generate_mock_forecast(self, lat: float, lon: float, solar_capacity_kw: float = 100.0) -> List[Dict]:
        """Generate realistic mock weather forecast for testing"""
        forecasts = []
        now = datetime.now()

        for i in range(40):  # 5 days, 3-hour intervals
            timestamp = now + timedelta(hours=i * 3)
            hour = timestamp.hour

            # Mock temperature (varies by time of day)
            base_temp = 15  # 15°C average
            temp_variation = 5 * math.sin(2 * math.pi * (hour - 6) / 24)
            temperature = base_temp + temp_variation + (i % 10 - 5) * 0.5

            # Mock cloud cover (varies throughout day)
            cloud_cover = 30 + 20 * math.sin(2 * math.pi * i / 8)

            # Calculate solar irradiance
            solar_irradiance = self._estimate_solar_irradiance(
                timestamp, cloud_cover, temperature
            )

            # Calculate solar generation using site-specific capacity
            solar_generation = self._estimate_solar_generation(
                solar_irradiance, solar_capacity_kw
            )

            forecasts.append({
                "timestamp": timestamp.isoformat(),
                "temperature": round(temperature, 1),
                "humidity": 60 + (i % 20),
                "pressure": 1013 + (i % 10 - 5),
                "cloud_cover": round(cloud_cover, 1),
                "wind_speed": 3 + (i % 5),
                "wind_direction": (i * 45) % 360,
                "precipitation": 0.5 if i % 7 == 0 else 0,
                "precipitation_probability": 20 if i % 7 == 0 else 5,
                "solar_irradiance": solar_irradiance,
                "solar_generation": solar_generation,
                "confidence": 0.75,  # Mock data confidence
                "description": "partly cloudy"
            })

        return forecasts

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in self._cache or cache_key not in self._cache_timestamps:
            return False

        cached_time = self._cache_timestamps[cache_key]
        time_elapsed = datetime.now() - cached_time
        return time_elapsed.total_seconds() < (self.cache_duration_hours * 3600)

    def _update_cache(self, cache_key: str, data: List[Dict]) -> None:
        """Update cache with new data"""
        self._cache[cache_key] = data
        self._cache_timestamps[cache_key] = datetime.now()

    def _can_make_api_call(self) -> bool:
        """Check if we can make an API call without exceeding daily limit"""
        today = datetime.now().date()

        # Reset counter if it's a new day
        if self._api_call_date != today:
            self._api_call_count = 0
            self._api_call_date = today

        return self._api_call_count < self.max_daily_calls

    def _increment_api_call_count(self) -> None:
        """Increment the API call counter"""
        today = datetime.now().date()

        # Reset counter if it's a new day
        if self._api_call_date != today:
            self._api_call_count = 0
            self._api_call_date = today

        self._api_call_count += 1
        print(f"✓ API call successful. Daily count: {self._api_call_count}/{self.max_daily_calls}")

    def get_api_usage_stats(self) -> Dict:
        """Get current API usage statistics"""
        today = datetime.now().date()

        # Reset if different day
        if self._api_call_date != today:
            return {
                "calls_today": 0,
                "max_daily_calls": self.max_daily_calls,
                "remaining_calls": self.max_daily_calls,
                "date": today.isoformat()
            }

        return {
            "calls_today": self._api_call_count,
            "max_daily_calls": self.max_daily_calls,
            "remaining_calls": self.max_daily_calls - self._api_call_count,
            "date": today.isoformat()
        }
