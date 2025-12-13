import psycopg2
from psycopg2.extras import RealDictCursor
import os
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:1519188@localhost:5432/enalysis_mvp")

@contextmanager
def get_db_connection():
    """Context manager for database connections"""
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        yield conn
    finally:
        if conn:
            conn.close()

def fetch_measurements(site_id: str, start_date: str, end_date: str, meter_category: str = "CONS"):
    """Fetch measurements from database for a specific site and time range"""
    query = """
        SELECT
            m.timestamp,
            m.value,
            m.unit,
            mt.category
        FROM measurements m
        JOIN meters mt ON m.entity_id = mt.id
        WHERE mt.site_id = %s
          AND mt.category = %s
          AND m.entity_type = 'meter'
          AND m.timestamp >= %s::timestamp
          AND m.timestamp <= %s::timestamp
        ORDER BY m.timestamp ASC
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (site_id, meter_category, start_date, end_date))
            return cursor.fetchall()

def fetch_carbon_intensity(start_date: str, end_date: str, grid_zone: str = "CA-ON"):
    """Fetch grid carbon intensity forecasts using grid zone (e.g., CA-ON, US-CAL-CISO)"""
    query = """
        SELECT
            timestamp,
            carbon_intensity,
            forecast_type
        FROM grid_carbon_intensity
        WHERE region = %s
          AND timestamp >= %s::timestamp
          AND timestamp <= %s::timestamp
        ORDER BY timestamp ASC
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (grid_zone, start_date, end_date))
            return cursor.fetchall()

def fetch_electricity_pricing(site_id: str, start_date: str, end_date: str):
    """Fetch electricity pricing data - get the rate that's valid during the time period"""
    query = """
        SELECT
            valid_from,
            rate_type,
            rate_structure,
            demand_charge,
            demand_threshold
        FROM electricity_pricing
        WHERE site_id = %s
          AND active = true
          AND valid_from <= %s::date
          AND (valid_to IS NULL OR valid_to >= %s::date)
        ORDER BY valid_from DESC
        LIMIT 1
    """

    with get_db_connection() as conn:
        # Use RealDictCursor to get results as dictionaries
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(query, (site_id, start_date, end_date))
            row = cursor.fetchone()

            if not row:
                return None

            # Row is already a dictionary
            return dict(row)

def save_recommendation(site_id: str, rec_type: str, headline: str, description: str,
                        cost_savings: float, co2_reduction: float, confidence: int,
                        action_type: str, recommended_time_start: str, recommended_time_end: str,
                        supporting_data: dict):
    """Save a recommendation to the database"""
    query = """
        INSERT INTO recommendations (
            site_id, type, headline, description, cost_savings, co2_reduction,
            confidence, action_type, recommended_time_start, recommended_time_end,
            supporting_data, status, generated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', NOW()
        )
        RETURNING id
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (
                site_id, rec_type, headline, description, cost_savings, co2_reduction,
                confidence, action_type, recommended_time_start, recommended_time_end,
                psycopg2.extras.Json(supporting_data)
            ))
            conn.commit()
            result = cursor.fetchone()
            return result['id'] if result else None

def save_consumption_forecast(site_id: str, forecast_timestamp: str, predicted_value: float,
                              lower_bound: float, upper_bound: float, forecast_horizon_hours: int,
                              model_type: str, confidence: float, training_data_points: int,
                              metadata: dict = None):
    """Save a consumption forecast to the database"""
    query = """
        INSERT INTO consumption_forecasts (
            site_id, forecast_timestamp, predicted_value, lower_bound, upper_bound,
            forecast_horizon_hours, model_type, model_version, confidence,
            data_source, training_data_points, metadata, generated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
        )
        RETURNING id
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (
                site_id,
                forecast_timestamp,
                predicted_value,
                lower_bound,
                upper_bound,
                forecast_horizon_hours,
                model_type,
                '1.0',  # model_version
                confidence,
                'ml_service',  # data_source
                training_data_points,
                psycopg2.extras.Json(metadata or {})
            ))
            conn.commit()
            result = cursor.fetchone()
            return result['id'] if result else None

def delete_old_forecasts(site_id: str, retention_days: int = 30):
    """Delete forecasts older than retention_days"""
    query = """
        DELETE FROM consumption_forecasts
        WHERE site_id = %s
          AND generated_at < NOW() - INTERVAL '%s days'
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (site_id, retention_days))
            conn.commit()
            return cursor.rowcount

def save_weather_forecast(site_id: str, forecast_timestamp: str, forecast_horizon_hours: int,
                          temperature: float = None, cloud_cover: float = None,
                          wind_speed: float = None, precipitation: float = None,
                          precipitation_probability: float = None, solar_irradiance: float = None,
                          solar_generation: float = None, confidence: float = None,
                          data_source: str = "openweathermap", metadata: dict = None):
    """Save a weather forecast to the database"""
    query = """
        INSERT INTO weather_forecasts (
            site_id, forecast_timestamp, forecast_horizon_hours,
            temperature_forecast, cloud_cover_forecast, wind_speed_forecast,
            precipitation_forecast, precipitation_probability,
            solar_irradiance_forecast, solar_generation_forecast,
            confidence, data_source, metadata, generated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
        )
        RETURNING id
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (
                site_id,
                forecast_timestamp,
                forecast_horizon_hours,
                temperature,
                cloud_cover,
                wind_speed,
                precipitation,
                precipitation_probability,
                solar_irradiance,
                solar_generation,
                confidence,
                data_source,
                psycopg2.extras.Json(metadata or {})
            ))
            conn.commit()
            result = cursor.fetchone()
            return result['id'] if result else None

def delete_old_weather_forecasts(site_id: str, retention_days: int = 7):
    """Delete weather forecasts older than retention_days (weather forecasts have shorter retention)"""
    query = """
        DELETE FROM weather_forecasts
        WHERE site_id = %s
          AND generated_at < NOW() - INTERVAL '%s days'
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (site_id, retention_days))
            conn.commit()
            return cursor.rowcount

def fetch_weather_forecasts(site_id: str, start_date: str, end_date: str):
    """Fetch historical weather forecasts for ML training"""
    query = """
        SELECT
            forecast_timestamp as timestamp,
            temperature,
            humidity,
            cloud_cover,
            wind_speed,
            precipitation,
            precipitation_probability,
            solar_irradiance,
            solar_generation
        FROM weather_forecasts
        WHERE site_id = %s
          AND forecast_timestamp >= %s
          AND forecast_timestamp <= %s
        ORDER BY forecast_timestamp ASC
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (site_id, start_date, end_date))
            results = cursor.fetchall()
            return results if results else []

def get_site_coordinates(site_id: str):
    """Get latitude, longitude, grid zone, and solar capacity for a site"""
    query = """
        SELECT
            s.latitude,
            s.longitude,
            s.grid_zone,
            s.location,
            s.name,
            COALESCE(
                (SELECT capacity
                 FROM meters
                 WHERE site_id = s.id
                   AND category = 'PROD'
                   AND active = true
                   AND capacity IS NOT NULL
                 ORDER BY created_at DESC
                 LIMIT 1),
                100.0
            ) as solar_capacity_kw
        FROM sites s
        WHERE s.id = %s AND s.active = true
    """

    with get_db_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (site_id,))
            result = cursor.fetchone()
            return result if result else None
