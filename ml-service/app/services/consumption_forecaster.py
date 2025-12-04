import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict
from prophet import Prophet

class ConsumptionForecaster:
    """Forecasts energy consumption using Facebook Prophet"""

    def __init__(self):
        self.model = None
        self.is_trained = False

    def prepare_data(self, measurements: List[Dict]) -> pd.DataFrame:
        """Convert measurements to Prophet format"""
        df = pd.DataFrame(measurements)
        df['ds'] = pd.to_datetime(df['timestamp']).dt.tz_localize(None)  # Remove timezone
        df['y'] = df['value'].astype(float)
        return df[['ds', 'y']]

    def train(self, measurements: List[Dict]):
        """Train the Prophet model on historical data"""
        if len(measurements) < 48:  # Need at least 2 days of hourly data
            raise ValueError("Insufficient data for training. Need at least 48 measurements.")

        df = self.prepare_data(measurements)

        # Initialize Prophet with appropriate parameters
        self.model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,  # Not enough data typically
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0
        )

        self.model.fit(df)
        self.is_trained = True

    def forecast(self, hours_ahead: int = 24) -> pd.DataFrame:
        """Generate forecast for specified hours ahead"""
        if not self.is_trained:
            raise ValueError("Model must be trained before forecasting")

        # Create future dataframe
        future = self.model.make_future_dataframe(periods=hours_ahead, freq='H')

        # Generate forecast
        forecast = self.model.predict(future)

        # Return only future predictions
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(hours_ahead)

    def get_forecast_dict(self, hours_ahead: int = 24) -> List[Dict]:
        """Get forecast as list of dictionaries"""
        forecast_df = self.forecast(hours_ahead)

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
