from datetime import datetime, timedelta
from typing import List, Dict
import numpy as np

class RecommendationEngine:
    """Generates actionable energy management recommendations"""

    def __init__(self):
        self.min_confidence = 70

    def calculate_electricity_cost(self, consumption_kwh: float, timestamp: str, pricing_data: Dict, caiso_pricing: List[Dict] = None) -> float:
        """
        Calculate electricity cost for given consumption at a specific time.
        Prefers real-time CAISO pricing when available, falls back to TOU rate structure.

        Args:
            consumption_kwh: Amount of electricity consumed
            timestamp: ISO format timestamp
            pricing_data: Dictionary containing rate_structure from database
            caiso_pricing: Optional list of CAISO real-time pricing records
        """
        # First, try to use CAISO real-time pricing if available
        if caiso_pricing:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                # Find matching CAISO pricing record (within 1 hour)
                for price_record in caiso_pricing:
                    price_dt = price_record['timestamp']
                    if isinstance(price_dt, str):
                        price_dt = datetime.fromisoformat(price_dt.replace('Z', '+00:00'))

                    # Match timestamps within same hour
                    if price_dt.replace(minute=0, second=0, microsecond=0) == dt.replace(minute=0, second=0, microsecond=0):
                        # Use CAISO real-time LMP (already in $/kWh)
                        rate = price_record.get('lmp_kwh', price_record.get('lmp', 0) / 1000)
                        return consumption_kwh * rate
            except Exception as e:
                print(f"Warning: Could not use CAISO pricing, falling back to TOU: {e}")

        # Fallback to TOU rate structure
        if not pricing_data or not isinstance(pricing_data, dict):
            return consumption_kwh * 0.12  # Fallback rate

        rate_structure = pricing_data.get('rate_structure')
        if not rate_structure or not isinstance(rate_structure, dict):
            # Try legacy format
            return consumption_kwh * pricing_data.get('off_peak_rate', 0.12)

        # Parse timestamp
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except:
            return consumption_kwh * 0.12

        hour = dt.hour
        day_of_week = dt.weekday()  # Monday=0, Sunday=6
        month = dt.month

        # Handle different rate structure formats
        rate = self._get_rate_from_structure(rate_structure, hour, day_of_week, month)
        return consumption_kwh * rate

    def _get_rate_from_structure(self, rate_structure: Dict, hour: int, day_of_week: int, month: int) -> float:
        """
        Extract rate from rate structure based on time.
        Handles multiple rate structure formats.
        """
        # Format 1: seasons → summer/winter → periods → onPeak/midPeak/offPeak
        if 'seasons' in rate_structure and isinstance(rate_structure['seasons'], dict):
            seasons = rate_structure['seasons']
            # Determine season
            season = 'summer' if month in seasons.get('summer', {}).get('months', [5,6,7,8,9]) else 'winter'

            if season in seasons and 'periods' in seasons[season]:
                periods = seasons[season]['periods']
                for period_name, period_config in periods.items():
                    if isinstance(period_config, dict) and self._is_in_period(hour, day_of_week, period_config):
                        return period_config.get('rate', 0.12)

        # Format 2: timeOfUse + energyCharges
        if 'timeOfUse' in rate_structure and 'energyCharges' in rate_structure:
            tou = rate_structure['timeOfUse']
            charges = rate_structure['energyCharges']

            # Determine season
            season = 'summer' if month in tou.get('summer', {}).get('months', [5,6,7,8,9]) else 'winter'

            if season in tou and isinstance(charges, dict):
                # Check which period this hour falls into
                season_config = tou[season]
                for period in ['onPeak', 'midPeak', 'offPeak']:
                    if period in season_config:
                        hour_ranges = season_config[period]
                        for start_hour, end_hour in hour_ranges:
                            # Handle overnight periods (e.g., [19, 7])
                            if start_hour > end_hour:  # Wraps around midnight
                                if hour >= start_hour or hour < end_hour:
                                    return charges.get(period, 0.12)
                            else:
                                if start_hour <= hour < end_hour:
                                    return charges.get(period, 0.12)

        # Legacy format: simple periods at top level
        for period_name, period_config in rate_structure.items():
            if isinstance(period_config, dict) and 'rate' in period_config:
                if self._is_in_period(hour, day_of_week, period_config):
                    return period_config.get('rate', 0.12)

        return 0.12  # Fallback

    def _is_in_period(self, hour: int, day_of_week: int, period_config: Dict) -> bool:
        """
        Check if given hour and day fall within a rate period.

        Args:
            hour: Hour of day (0-23)
            day_of_week: Day of week (0=Monday, 6=Sunday)
            period_config: Config with 'hours' and 'days' arrays

        Example period_config:
        {
            'rate': 0.082,
            'hours': [[0, 7], [19, 24]],  # 0-7am and 7pm-midnight
            'days': [1, 2, 3, 4, 5],  # Weekdays (Mon-Fri)
            'label': 'Off-Peak'
        }
        """
        # Check if day matches
        valid_days = period_config.get('days', [0, 1, 2, 3, 4, 5, 6])
        if day_of_week not in valid_days:
            return False

        # Check if hour matches
        hour_ranges = period_config.get('hours', [])
        for start_hour, end_hour in hour_ranges:
            # Handle overnight periods
            if start_hour > end_hour:  # Wraps around midnight
                if hour >= start_hour or hour < end_hour:
                    return True
            else:
                if start_hour <= hour < end_hour:
                    return True

        return False

    def get_rate_at_time(self, timestamp: str, pricing_data: Dict, caiso_pricing: List[Dict] = None) -> float:
        """
        Get the electricity rate at a specific time.
        Prefers real-time CAISO pricing when available, falls back to TOU rates.
        """
        # First, try to use CAISO real-time pricing if available
        if caiso_pricing:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                # Find matching CAISO pricing record
                for price_record in caiso_pricing:
                    price_dt = price_record['timestamp']
                    if isinstance(price_dt, str):
                        price_dt = datetime.fromisoformat(price_dt.replace('Z', '+00:00'))

                    # Match timestamps within same hour
                    if price_dt.replace(minute=0, second=0, microsecond=0) == dt.replace(minute=0, second=0, microsecond=0):
                        return price_record.get('lmp_kwh', price_record.get('lmp', 0) / 1000)
            except:
                pass

        # Fallback to TOU rate structure
        if not pricing_data or not isinstance(pricing_data, dict):
            return 0.12

        rate_structure = pricing_data.get('rate_structure')
        if not rate_structure or not isinstance(rate_structure, dict):
            return pricing_data.get('off_peak_rate', 0.12)

        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            hour = dt.hour
            day_of_week = dt.weekday()
            month = dt.month

            return self._get_rate_from_structure(rate_structure, hour, day_of_week, month)
        except:
            pass

        return 0.12

    def generate_load_shift_recommendation(
        self,
        consumption_forecast: List[Dict],
        carbon_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None
    ) -> Dict:
        """Generate recommendation for load shifting to lower cost/carbon periods"""

        # Find optimal time window
        combined_scores = []
        for i, cons in enumerate(consumption_forecast):
            timestamp = cons['timestamp']

            # Find matching carbon intensity
            carbon_intensity = next(
                (c['carbon_intensity'] for c in carbon_forecast if c['timestamp'] == timestamp),
                40  # Default Ontario average (gCO2/kWh) - one of cleanest grids
            )

            # Calculate score (lower is better)
            # Normalize both metrics to 0-1 scale
            cons_norm = cons['predicted_value'] / max(c['predicted_value'] for c in consumption_forecast)
            carbon_norm = carbon_intensity / max(c['carbon_intensity'] for c in carbon_forecast)

            score = (cons_norm * 0.3) + (carbon_norm * 0.7)  # Weight carbon more heavily

            combined_scores.append({
                'timestamp': timestamp,
                'score': score,
                'carbon_intensity': carbon_intensity,
                'predicted_consumption': cons['predicted_value']
            })

        # Find best window (lowest score)
        best_window = min(combined_scores, key=lambda x: x['score'])
        avg_score = np.mean([s['score'] for s in combined_scores])

        # Calculate potential savings
        potential_reduction_pct = ((avg_score - best_window['score']) / avg_score) * 100

        # Estimate cost savings using actual rate structure
        estimated_load = 50  # kWh assumption for flexible loads

        # Calculate average cost across all periods
        avg_cost = np.mean([self.calculate_electricity_cost(estimated_load, s['timestamp'], pricing_data, caiso_pricing)
                           for s in combined_scores])

        # Calculate cost at best window
        best_window_cost = self.calculate_electricity_cost(estimated_load, best_window['timestamp'], pricing_data, caiso_pricing)

        # Savings from shifting load to best window
        cost_savings = avg_cost - best_window_cost

        # Calculate CO2 reduction
        avg_carbon = np.mean([s['carbon_intensity'] for s in combined_scores])
        co2_reduction = estimated_load * (avg_carbon - best_window['carbon_intensity']) / 1000  # kg

        timestamp_dt = datetime.fromisoformat(best_window['timestamp'].replace('Z', '+00:00'))

        return {
            'type': 'carbon',
            'headline': f"Shift flexible loads to {timestamp_dt.strftime('%H:%M')} for lowest carbon",
            'description': (
                f"Grid carbon intensity will be lowest at {timestamp_dt.strftime('%H:%M')} "
                f"({best_window['carbon_intensity']:.0f} g/kWh) vs peak of {max(s['carbon_intensity'] for s in combined_scores):.0f} g/kWh. "
                f"Shift HVAC pre-cooling, EV charging, or other flexible loads to this window to reduce emissions by {potential_reduction_pct:.0f}%."
            ),
            'cost_savings': float(round(cost_savings, 2)),
            'co2_reduction': float(round(co2_reduction, 2)),
            'confidence': int(min(95, 70 + int(potential_reduction_pct))),
            'action_type': 'load_shift',
            'recommended_time_start': best_window['timestamp'],
            'recommended_time_end': (timestamp_dt + timedelta(hours=2)).isoformat(),
            'supporting_data': {
                'optimal_carbon_intensity': best_window['carbon_intensity'],
                'reduction_percent': round(potential_reduction_pct, 1),
                'peak_carbon': max(s['carbon_intensity'] for s in combined_scores)
            }
        }

    def generate_peak_avoidance_recommendation(
        self,
        consumption_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None
    ) -> Dict:
        """Generate recommendation for avoiding peak consumption periods"""

        # Identify peak consumption periods
        values = [f['predicted_value'] for f in consumption_forecast]
        peak_threshold = np.percentile(values, 75)

        peak_periods = [f for f in consumption_forecast if f['predicted_value'] >= peak_threshold]

        if not peak_periods:
            return None

        # Calculate potential savings using actual rate structure
        avg_peak_load = np.mean([p['predicted_value'] for p in peak_periods])
        reducible_load = avg_peak_load * 0.20  # Assume 20% is reducible

        # Calculate actual cost at peak periods
        peak_period_costs = [self.calculate_electricity_cost(reducible_load, p['timestamp'], pricing_data, caiso_pricing)
                            for p in peak_periods]
        total_peak_cost = sum(peak_period_costs)

        # Find the lowest rate period (likely off-peak)
        all_rates = [self.get_rate_at_time(f['timestamp'], pricing_data, caiso_pricing) for f in consumption_forecast]
        min_rate = min(all_rates) if all_rates else 0.08

        # Savings from reducing during peak vs shifting to off-peak
        alternative_cost = reducible_load * min_rate * len(peak_periods)
        cost_savings = total_peak_cost - alternative_cost

        first_peak = peak_periods[0]
        timestamp_dt = datetime.fromisoformat(first_peak['timestamp'].replace('Z', '+00:00'))

        return {
            'type': 'cost',
            'headline': f"Reduce consumption during peak hours ({timestamp_dt.strftime('%H:%M')}-{(timestamp_dt + timedelta(hours=len(peak_periods))).strftime('%H:%M')})",
            'description': (
                f"Peak demand forecasted at {avg_peak_load:.1f} kWh during high-rate periods. "
                f"Reduce lighting, adjust HVAC setpoints, or defer non-critical loads to save "
                f"${cost_savings:.0f} by avoiding peak rates."
            ),
            'cost_savings': float(round(cost_savings, 2)),
            'co2_reduction': float(round(reducible_load * 0.04, 2)),  # CO2 estimate using Ontario 40 gCO2/kWh average
            'confidence': 85,
            'action_type': 'demand_response',
            'recommended_time_start': first_peak['timestamp'],
            'recommended_time_end': peak_periods[-1]['timestamp'],
            'supporting_data': {
                'peak_load': round(avg_peak_load, 1),
                'peak_periods': len(peak_periods),
                'reducible_load': round(reducible_load, 1)
            }
        }

    def generate_demand_charge_avoidance(
        self,
        consumption_forecast: List[Dict],
        pricing_data: Dict
    ) -> Dict:
        """Generate recommendation for avoiding demand charges by reducing peak demand"""

        # Only generate if demand charges are configured
        if not pricing_data or not isinstance(pricing_data, dict):
            return None

        demand_charge = pricing_data.get('demand_charge')
        demand_threshold = pricing_data.get('demand_threshold', 0)

        if not demand_charge or demand_charge <= 0:
            return None

        # Find the absolute peak consumption
        peak_consumption = max(consumption_forecast, key=lambda x: x['predicted_value'])
        peak_kw = peak_consumption['predicted_value']

        # If below threshold, no recommendation needed
        if peak_kw <= demand_threshold:
            return None

        # Calculate potential savings
        # Target: Reduce peak by 10-20% to lower demand charge
        reduction_target_pct = 15  # 15% reduction target
        target_reduction_kw = peak_kw * (reduction_target_pct / 100)
        new_peak_kw = peak_kw - target_reduction_kw

        # Calculate monthly savings
        # Demand charges are typically monthly based on the highest 15-min peak
        monthly_savings = target_reduction_kw * demand_charge

        timestamp_dt = datetime.fromisoformat(peak_consumption['timestamp'].replace('Z', '+00:00'))

        return {
            'type': 'cost',
            'headline': f"Reduce peak demand at {timestamp_dt.strftime('%H:%M')} to lower demand charges",
            'description': (
                f"Peak demand forecasted at {peak_kw:.1f} kW. Your utility charges ${demand_charge:.2f}/kW for peak demand. "
                f"By reducing this peak by {reduction_target_pct}% ({target_reduction_kw:.1f} kW) through load shedding, "
                f"demand response, or battery discharge, you can save ${monthly_savings:.0f}/month in demand charges. "
                f"Consider: Adjust HVAC setpoints 30 min before peak, defer heavy equipment operation, or discharge battery storage."
            ),
            'cost_savings': float(round(monthly_savings, 2)),
            'co2_reduction': 0.0,  # Demand charge avoidance doesn't directly reduce emissions
            'confidence': 90,
            'action_type': 'demand_response',
            'recommended_time_start': (timestamp_dt - timedelta(minutes=30)).isoformat(),
            'recommended_time_end': (timestamp_dt + timedelta(minutes=30)).isoformat(),
            'supporting_data': {
                'current_peak_kw': round(peak_kw, 1),
                'target_peak_kw': round(new_peak_kw, 1),
                'reduction_kw': round(target_reduction_kw, 1),
                'demand_charge_rate': demand_charge,
                'monthly_savings': round(monthly_savings, 2)
            }
        }

    def generate_recommendations(
        self,
        consumption_forecast: List[Dict],
        carbon_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None
    ) -> List[Dict]:
        """
        Generate all recommendations for a site.

        Args:
            consumption_forecast: ML-generated consumption forecast
            carbon_forecast: Grid carbon intensity forecast
            pricing_data: Time-of-use rate structure from database
            caiso_pricing: Optional real-time CAISO market pricing (for California sites)
        """

        recommendations = []

        # Load shifting recommendation
        try:
            load_shift = self.generate_load_shift_recommendation(
                consumption_forecast, carbon_forecast, pricing_data, caiso_pricing
            )
            if load_shift:
                recommendations.append(load_shift)
        except Exception as e:
            print(f"Error generating load shift recommendation: {e}")
            import traceback
            traceback.print_exc()

        # Peak avoidance recommendation
        try:
            peak_avoid = self.generate_peak_avoidance_recommendation(
                consumption_forecast, pricing_data, caiso_pricing
            )
            if peak_avoid:
                recommendations.append(peak_avoid)
        except Exception as e:
            print(f"Error generating peak avoidance recommendation: {e}")
            import traceback
            traceback.print_exc()

        # Demand charge avoidance recommendation
        try:
            demand_avoid = self.generate_demand_charge_avoidance(
                consumption_forecast, pricing_data
            )
            if demand_avoid:
                recommendations.append(demand_avoid)
        except Exception as e:
            print(f"Error generating demand charge avoidance recommendation: {e}")

        return recommendations
