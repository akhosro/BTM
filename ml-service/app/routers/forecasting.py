from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Dict

from app.database import fetch_measurements
from app.services.consumption_forecaster import ConsumptionForecaster

router = APIRouter()

class ForecastRequest(BaseModel):
    site_id: str
    hours_ahead: int = 24
    training_days: int = 7

class ForecastResponse(BaseModel):
    site_id: str
    forecast_horizon_hours: int
    generated_at: str
    predictions: List[Dict]

@router.post("/consumption", response_model=ForecastResponse)
async def forecast_consumption(request: ForecastRequest):
    """Generate consumption forecast for a site"""
    try:
        # Fetch historical data for training
        end_date = datetime.now()
        start_date = end_date - timedelta(days=request.training_days)

        measurements = fetch_measurements(
            site_id=request.site_id,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            meter_category="CONS"
        )

        if len(measurements) < 48:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient historical data. Found {len(measurements)} measurements, need at least 48."
            )

        # Train and forecast
        forecaster = ConsumptionForecaster()
        forecaster.train(measurements)
        predictions = forecaster.get_forecast_dict(hours_ahead=request.hours_ahead)

        return ForecastResponse(
            site_id=request.site_id,
            forecast_horizon_hours=request.hours_ahead,
            generated_at=datetime.now().isoformat(),
            predictions=predictions
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def forecast_health():
    """Health check for forecasting service"""
    return {
        "service": "forecasting",
        "status": "healthy",
        "models": ["prophet_consumption"]
    }
