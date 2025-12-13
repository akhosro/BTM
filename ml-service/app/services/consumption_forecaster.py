import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from prophet import Prophet

class ConsumptionForecaster:
    """Forecasts energy consumption using Facebook Prophet with external regressors"""

    def __init__(self):
        self.model = None
        self.is_trained = False
        self.use_regressors = False  # Track if we're using external features

    def prepare_data(self, measurements: List[Dict], weather_data: Optional[List[Dict]] = None) -> pd.DataFrame:
        """
        Convert measurements to Prophet format with optional weather regressors

        Args:
            measurements: Historical consumption measurements
            weather_data: Optional weather data with temperature, humidity, cloud_cover
        """
        df = pd.DataFrame(measurements)
        df['ds'] = pd.to_datetime(df['timestamp']).dt.tz_localize(None)  # Remove timezone
        df['y'] = df['value'].astype(float)

        # Add weather regressors if available
        if weather_data and len(weather_data) > 0:
            weather_df = self._prepare_weather_regressors(weather_data)
            df = df.merge(weather_df, on='ds', how='left')

            # Fill missing weather data with forward fill, then backward fill
            weather_cols = ['temperature', 'humidity', 'cloud_cover']
            for col in weather_cols:
                if col in df.columns:
                    df[col] = df[col].fillna(method='ffill').fillna(method='bfill')
                    # If still missing, use reasonable defaults
                    if df[col].isna().any():
                        defaults = {'temperature': 20, 'humidity': 50, 'cloud_cover': 50}
                        df[col] = df[col].fillna(defaults.get(col, 0))

            self.use_regressors = True
        else:
            self.use_regressors = False

        return df

    def _prepare_weather_regressors(self, weather_data: List[Dict]) -> pd.DataFrame:
        """Convert weather data to regressor format"""
        weather_df = pd.DataFrame(weather_data)
        weather_df['ds'] = pd.to_datetime(weather_df['timestamp']).dt.tz_localize(None)

        # Extract relevant weather features
        regressors = {'ds': weather_df['ds']}

        # Temperature (Celsius)
        if 'temperature' in weather_df.columns:
            regressors['temperature'] = weather_df['temperature'].astype(float)

        # Humidity (percentage)
        if 'humidity' in weather_df.columns:
            regressors['humidity'] = weather_df['humidity'].astype(float)

        # Cloud cover (percentage)
        if 'cloud_cover' in weather_df.columns:
            regressors['cloud_cover'] = weather_df['cloud_cover'].astype(float)
        elif 'cloudCover' in weather_df.columns:  # Alternative naming
            regressors['cloud_cover'] = weather_df['cloudCover'].astype(float)

        return pd.DataFrame(regressors)

    def train(self, measurements: List[Dict], weather_data: Optional[List[Dict]] = None):
        """
        Train the Prophet model on historical data with optional weather features

        Args:
            measurements: Historical consumption measurements
            weather_data: Optional weather data to improve accuracy
        """
        if len(measurements) < 48:  # Need at least 2 days of hourly data
            raise ValueError("Insufficient data for training. Need at least 48 measurements.")

        df = self.prepare_data(measurements, weather_data)

        # Initialize Prophet with appropriate parameters
        self.model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,  # Not enough data typically
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0
        )

        # Add weather regressors if available
        if self.use_regressors:
            if 'temperature' in df.columns:
                self.model.add_regressor('temperature', standardize=True)
                print("✓ Added temperature regressor")

            if 'humidity' in df.columns:
                self.model.add_regressor('humidity', standardize=True)
                print("✓ Added humidity regressor")

            if 'cloud_cover' in df.columns:
                self.model.add_regressor('cloud_cover', standardize=True)
                print("✓ Added cloud_cover regressor")

        self.model.fit(df)
        self.is_trained = True

    def forecast(self, hours_ahead: int = 24, future_weather: Optional[List[Dict]] = None) -> pd.DataFrame:
        """
        Generate forecast for specified hours ahead

        Args:
            hours_ahead: Number of hours to forecast
            future_weather: Weather forecast for the prediction period (required if model uses regressors)
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before forecasting")

        # Create future dataframe
        future = self.model.make_future_dataframe(periods=hours_ahead, freq='H')

        # Add weather regressors for future period if model uses them
        if self.use_regressors:
            if future_weather and len(future_weather) > 0:
                weather_df = self._prepare_weather_regressors(future_weather)
                future = future.merge(weather_df, on='ds', how='left')

                # Fill missing future weather with last known values
                weather_cols = ['temperature', 'humidity', 'cloud_cover']
                for col in weather_cols:
                    if col in future.columns:
                        future[col] = future[col].fillna(method='ffill').fillna(method='bfill')
            else:
                # If no future weather provided but model expects it, use seasonal averages
                print("⚠️  Warning: Model uses weather regressors but no future weather provided. Using defaults.")
                future['temperature'] = 20  # Default temperature
                future['humidity'] = 50     # Default humidity
                future['cloud_cover'] = 50  # Default cloud cover

        # Generate forecast
        forecast = self.model.predict(future)

        # Return only future predictions
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(hours_ahead)

    def get_forecast_dict(self, hours_ahead: int = 24, future_weather: Optional[List[Dict]] = None) -> List[Dict]:
        """
        Get forecast as list of dictionaries

        Args:
            hours_ahead: Number of hours to forecast
            future_weather: Weather forecast for the prediction period
        """
        forecast_df = self.forecast(hours_ahead, future_weather)

        return [
            {
                'timestamp': row['ds'].isoformat(),
                'predicted_value': max(0, row['yhat']),  # Ensure non-negative
                'lower_bound': max(0, row['yhat_lower']),
                'upper_bound': max(0, row['yhat_upper']),
                'confidence': 0.8  # 80% confidence interval
            }
            for _, row in forecast_df.iterrows()
        ]

    def find_low_consumption_periods(self, forecast: List[Dict], threshold_percentile: float = 25) -> List[Dict]:
        """Identify periods with low predicted consumption for load shifting recommendations"""
        values = [f['predicted_value'] for f in forecast]
        threshold = np.percentile(values, threshold_percentile)

        low_periods = []
        for f in forecast:
            if f['predicted_value'] <= threshold:
                low_periods.append({
                    'timestamp': f['timestamp'],
                    'predicted_consumption': f['predicted_value'],
                    'savings_potential': (np.mean(values) - f['predicted_value']) / np.mean(values)
                })

        return low_periods
