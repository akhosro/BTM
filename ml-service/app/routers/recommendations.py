from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Dict

from app.database import (
    fetch_measurements,
    fetch_carbon_intensity,
    fetch_electricity_pricing,
    save_recommendation,
    save_consumption_forecast,
    delete_old_forecasts,
    save_weather_forecast,
    delete_old_weather_forecasts,
    get_site_coordinates
)
from app.services.consumption_forecaster import ConsumptionForecaster
from app.services.recommendation_engine import RecommendationEngine
from app.services.weather_service import WeatherService

router = APIRouter()

class RecommendationRequest(BaseModel):
    site_id: str
    forecast_hours: int = 24
    training_days: int = 7

class RecommendationResponse(BaseModel):
    site_id: str
    generated_at: str
    recommendations: List[Dict]
    saved_count: int
    forecasts_saved: int = 0
    weather_forecasts_saved: int = 0

@router.post("/generate", response_model=RecommendationResponse)
async def generate_recommendations(request: RecommendationRequest):
    """Generate ML-powered recommendations for a site"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=request.training_days)
        forecast_end = end_date + timedelta(hours=request.forecast_hours)

        # Fetch historical consumption data
        measurements = fetch_measurements(
            site_id=request.site_id,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            meter_category="CONS"
        )

        if len(measurements) < 48:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient historical data for site {request.site_id}"
            )

        # Generate consumption forecast
        forecaster = ConsumptionForecaster()
        forecaster.train(measurements)
        consumption_forecast = forecaster.get_forecast_dict(hours_ahead=request.forecast_hours)

        # Delete old forecasts (retention policy: 30 days)
        delete_old_forecasts(site_id=request.site_id, retention_days=30)

        # Save consumption forecasts to database
        forecasts_saved = 0
        for i, fc in enumerate(consumption_forecast):
            try:
                forecast_id = save_consumption_forecast(
                    site_id=request.site_id,
                    forecast_timestamp=fc['timestamp'],
                    predicted_value=float(fc['predicted_value']),
                    lower_bound=float(fc['lower_bound']),
                    upper_bound=float(fc['upper_bound']),
                    forecast_horizon_hours=i + 1,  # Hours ahead
                    model_type='prophet',
                    confidence=0.8,  # 80% confidence interval
                    training_data_points=len(measurements),
                    metadata={'training_days': request.training_days}
                )
                if forecast_id:
                    forecasts_saved += 1
            except Exception as e:
                print(f"Error saving forecast: {e}")

        # Fetch and save weather forecasts
        # Get site coordinates from database
        site_info = get_site_coordinates(site_id=request.site_id)

        weather_forecasts_saved = 0
        if site_info and site_info['latitude'] and site_info['longitude']:
            lat, lon = float(site_info['latitude']), float(site_info['longitude'])
            solar_capacity = float(site_info.get('solar_capacity_kw', 100.0))
            print(f"Using coordinates for {site_info['name']}: {lat}, {lon}")
            print(f"Solar capacity: {solar_capacity} kW")

            weather_service = WeatherService()
            weather_forecasts = weather_service.get_weather_forecast(lat, lon, solar_capacity)

            # Delete old weather forecasts (7-day retention)
            delete_old_weather_forecasts(site_id=request.site_id, retention_days=7)

            if weather_forecasts:
                for i, wf in enumerate(weather_forecasts):
                    try:
                        wf_id = save_weather_forecast(
                            site_id=request.site_id,
                            forecast_timestamp=wf['timestamp'],
                            forecast_horizon_hours=i + 1,
                            temperature=wf.get('temperature'),
                            cloud_cover=wf.get('cloud_cover'),
                            wind_speed=wf.get('wind_speed'),
                            precipitation=wf.get('precipitation'),
                            precipitation_probability=wf.get('precipitation_probability'),
                            solar_irradiance=wf.get('solar_irradiance'),
                            solar_generation=wf.get('solar_generation'),
                            confidence=wf.get('confidence'),
                            data_source='openweathermap' if weather_service.api_key and weather_service.api_key != 'your_api_key_here' else 'mock',
                            metadata={
                                'description': wf.get('description', ''),
                                'latitude': lat,
                                'longitude': lon,
                                'location': site_info.get('location', '')
                            }
                        )
                        if wf_id:
                            weather_forecasts_saved += 1
                    except Exception as e:
                        print(f"Error saving weather forecast: {e}")
        else:
            print(f"⚠️ Site {request.site_id} has no coordinates - skipping weather forecast")

        # Fetch carbon intensity forecast
        # Try to use real-time API first, fall back to database
        carbon_forecast_data = []
        try:
            from app.services.carbon_intensity_client import CarbonIntensityClient
            carbon_client = CarbonIntensityClient()

            # Determine region based on site location
            region_code = "CA-ON"  # Default to Ontario
            if site_info and site_info.get('location'):
                location = site_info.get('location', '').lower()
                # Map locations to Electricity Maps zone codes
                if any(indicator in location for indicator in ['california', 'ca', 'san francisco', 'los angeles']):
                    region_code = "US-CAL-CISO"
                elif 'ontario' in location or 'toronto' in location or 'ottawa' in location:
                    region_code = "CA-ON"
                # Add more regions as needed

            # Fetch real-time carbon intensity
            carbon_forecast_api = carbon_client.get_carbon_intensity(zone=region_code, hours_forecast=request.forecast_hours)

            # Convert to format expected by recommendation engine
            carbon_forecast_data = [
                {
                    'timestamp': cf['timestamp'],
                    'carbon_intensity': cf['carbon_intensity']
                }
                for cf in carbon_forecast_api
            ]

            print(f"✅ Fetched {len(carbon_forecast_data)} carbon intensity records from Electricity Maps")
        except Exception as e:
            print(f"⚠️  Could not fetch real-time carbon intensity: {e}")
            print(f"Falling back to database carbon intensity")

            # Fall back to database
            carbon_forecast_db = fetch_carbon_intensity(
                start_date=end_date.isoformat(),
                end_date=forecast_end.isoformat(),
                region="Ontario"
            )
            carbon_forecast_data = carbon_forecast_db if carbon_forecast_db else []

        carbon_forecast = carbon_forecast_data

        # Fetch pricing data
        print(f"📊 Fetching pricing data for site {request.site_id}")
        try:
            pricing_data = fetch_electricity_pricing(
                site_id=request.site_id,
                start_date=start_date.date().isoformat(),
                end_date=end_date.date().isoformat()
            )
            print(f"✅ Pricing data fetched: {pricing_data}")
        except Exception as e:
            print(f"❌ Error fetching pricing: {e}")
            import traceback
            traceback.print_exc()
            pricing_data = None

        # Fetch real-time CAISO pricing if site is in California
        caiso_pricing = []
        if site_info and site_info.get('location'):
            location = site_info.get('location', '').lower()
            # Check if site is in CAISO territory (California)
            if any(indicator in location for indicator in ['california', 'ca', 'san francisco', 'los angeles', 'san diego', 'sacramento']):
                try:
                    from app.services.caiso_client import CAISOClient
                    caiso_client = CAISOClient()
                    # Get hourly average real-time pricing for next 24 hours
                    caiso_pricing = caiso_client.get_hourly_average(hours=48)
                    print(f"✅ Fetched {len(caiso_pricing)} CAISO real-time pricing records")
                except Exception as e:
                    print(f"⚠️  Could not fetch CAISO pricing: {e}")

        # Generate recommendations
        engine = RecommendationEngine()
        print(f"📊 Generating recommendations with:")
        print(f"   Consumption forecast: {len(consumption_forecast)} records")
        print(f"   Carbon forecast: {len(carbon_forecast)} records")
        print(f"   Pricing data: {pricing_data}")
        print(f"   CAISO pricing: {len(caiso_pricing) if caiso_pricing else 0} records")

        recommendations = engine.generate_recommendations(
            consumption_forecast=consumption_forecast,
            carbon_forecast=carbon_forecast,
            pricing_data=pricing_data or {},
            caiso_pricing=caiso_pricing if caiso_pricing else None
        )
        print(f"✅ Generated {len(recommendations)} recommendations")

        # Save recommendations to database
        saved_count = 0
        for rec in recommendations:
            try:
                rec_id = save_recommendation(
                    site_id=request.site_id,
                    rec_type=rec['type'],
                    headline=rec['headline'],
                    description=rec['description'],
                    cost_savings=rec['cost_savings'],
                    co2_reduction=rec['co2_reduction'],
                    confidence=rec['confidence'],
                    action_type=rec['action_type'],
                    recommended_time_start=rec['recommended_time_start'],
                    recommended_time_end=rec['recommended_time_end'],
                    supporting_data=rec['supporting_data']
                )
                if rec_id:
                    saved_count += 1
            except Exception as e:
                print(f"Error saving recommendation: {e}")

        return RecommendationResponse(
            site_id=request.site_id,
            generated_at=datetime.now().isoformat(),
            recommendations=recommendations,
            saved_count=saved_count,
            forecasts_saved=forecasts_saved,
            weather_forecasts_saved=weather_forecasts_saved
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/weather-api-usage")
async def get_weather_api_usage():
    """Get current weather API usage statistics"""
    try:
        weather_service = WeatherService()
        stats = weather_service.get_api_usage_stats()
        return {
            "success": True,
            "usage": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def recommendations_health():
    """Health check for recommendations service"""
    return {
        "service": "recommendations",
        "status": "healthy",
        "engines": ["load_shift", "peak_avoidance"]
    }

