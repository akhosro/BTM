from datetime import datetime, timedelta
from typing import List, Dict, Optional
import numpy as np

class RecommendationEngine:
    """Generates actionable energy management recommendations with confidence scoring"""

    def __init__(self):
        self.min_confidence = 70

    def _add_explanation(self, recommendation: Dict, data_sources: List[str],
                        risk_factors: List[str], savings_uncertainty: float = 0.15) -> Dict:
        """
        Add detailed explanation to recommendation with confidence scoring.

        Args:
            recommendation: Base recommendation dict
            data_sources: List of data sources used
            risk_factors: List of potential risks or uncertainties
            savings_uncertainty: Uncertainty range (default ±15%)
        """
        cost_savings = recommendation.get('cost_savings', 0)

        # Map numeric confidence to label
        confidence_score = recommendation.get('confidence', 70)
        if confidence_score >= 85:
            confidence_label = 'high'
        elif confidence_score >= 70:
            confidence_label = 'medium'
        else:
            confidence_label = 'low'

        recommendation['explanation'] = {
            'why': recommendation.get('description', ''),
            'data_sources': data_sources,
            'risk_factors': risk_factors,
            'confidence_label': confidence_label,
            'savings_range': {
                'best_case': round(cost_savings * (1 + savings_uncertainty), 2),
                'expected': round(cost_savings, 2),
                'worst_case': round(cost_savings * (1 - savings_uncertainty), 2)
            }
        }

        return recommendation

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

    def generate_weather_alert(
        self,
        weather_forecast: List[Dict],
        consumption_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None
    ) -> Optional[Dict]:
        """
        Generate weather-based alerts for extreme conditions that will impact energy costs.

        Args:
            weather_forecast: Weather forecast data with temperature, conditions
            consumption_forecast: Energy consumption forecast
            pricing_data: Electricity pricing structure
            caiso_pricing: Optional real-time pricing
        """
        if not weather_forecast or len(weather_forecast) == 0:
            return None

        # Detect heatwave (3+ consecutive hours above 32°C / 90°F)
        hot_periods = [w for w in weather_forecast if w.get('temperature', 0) > 32]

        if len(hot_periods) >= 3:
            # Calculate impact
            avg_temp = np.mean([w['temperature'] for w in hot_periods])
            duration_hours = len(hot_periods)

            # Estimate increased cooling load (1% increase per degree above 25°C)
            baseline_temp = 25
            temp_increase = avg_temp - baseline_temp
            consumption_increase_pct = temp_increase * 1.0  # 1% per degree

            # Estimate baseline consumption during this period
            baseline_consumption = np.mean([c['predicted_value'] for c in consumption_forecast[:duration_hours]])
            increased_consumption = baseline_consumption * (consumption_increase_pct / 100)

            # Calculate additional cost
            timestamp = hot_periods[0]['timestamp']
            additional_cost = self.calculate_electricity_cost(
                increased_consumption * duration_hours,
                timestamp,
                pricing_data,
                caiso_pricing
            )

            # Savings from pre-cooling
            precool_savings = additional_cost * 0.30  # 30% savings from pre-cooling strategy

            start_dt = datetime.fromisoformat(hot_periods[0]['timestamp'].replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(hot_periods[-1]['timestamp'].replace('Z', '+00:00'))

            recommendation = {
                'type': 'weather_alert',
                'headline': f"Heatwave alert: Pre-cool building to save ${precool_savings:.0f}",
                'description': (
                    f"Extreme heat forecasted {start_dt.strftime('%a %I%p')}-{end_dt.strftime('%I%p')} "
                    f"(avg {avg_temp:.0f}°C). Pre-cool your building tonight during off-peak hours, "
                    f"then coast through the heatwave with minimal cooling. "
                    f"This avoids ${additional_cost:.0f} in peak-hour cooling costs."
                ),
                'cost_savings': float(round(precool_savings, 2)),
                'co2_reduction': float(round(increased_consumption * 0.04 * 0.3, 2)),  # 30% of avoided consumption
                'confidence': 85,
                'action_type': 'weather_response',
                'recommended_time_start': (start_dt - timedelta(hours=8)).isoformat(),  # Pre-cool 8 hours before
                'recommended_time_end': end_dt.isoformat(),
                'supporting_data': {
                    'peak_temperature': round(max(w['temperature'] for w in hot_periods), 1),
                    'duration_hours': duration_hours,
                    'consumption_increase_pct': round(consumption_increase_pct, 1),
                    'additional_cost_without_action': round(additional_cost, 2)
                }
            }

            return self._add_explanation(
                recommendation,
                data_sources=['OpenWeatherMap forecast', 'Prophet consumption model'],
                risk_factors=['Actual temperature may vary ±3°C', 'Cooling efficiency depends on building insulation'],
                savings_uncertainty=0.20
            )

        return None

    def generate_efficiency_alert(
        self,
        consumption_forecast: List[Dict],
        historical_baseline: Optional[float] = None
    ) -> Optional[Dict]:
        """
        Generate efficiency/maintenance alerts by detecting consumption anomalies.

        Args:
            consumption_forecast: Recent consumption forecast
            historical_baseline: Historical average consumption for comparison
        """
        if not consumption_forecast or historical_baseline is None:
            return None

        # Calculate current average consumption
        current_avg = np.mean([c['predicted_value'] for c in consumption_forecast])

        # Detect significant increase (>20% above baseline)
        increase_pct = ((current_avg - historical_baseline) / historical_baseline) * 100

        if increase_pct > 20:  # 20% threshold for alert
            # Estimate monthly waste
            excess_consumption = current_avg - historical_baseline
            monthly_waste_kwh = excess_consumption * 24 * 30  # Monthly estimate

            # Estimate cost of waste (using average rate of $0.12/kWh)
            monthly_cost_waste = monthly_waste_kwh * 0.12

            recommendation = {
                'type': 'maintenance_alert',
                'headline': f"Equipment efficiency alert: Consuming {increase_pct:.0f}% more than normal",
                'description': (
                    f"Current consumption is {increase_pct:.0f}% higher than baseline ({current_avg:.1f} kWh vs {historical_baseline:.1f} kWh). "
                    f"This could indicate: HVAC system degradation, air filter blockage, refrigerant leak, "
                    f"or equipment malfunction. Schedule maintenance to restore efficiency and save "
                    f"${monthly_cost_waste:.0f}/month."
                ),
                'cost_savings': float(round(monthly_cost_waste, 2)),
                'co2_reduction': float(round(monthly_waste_kwh * 0.04, 2)),  # CO2 from avoided waste
                'confidence': 75,
                'action_type': 'maintenance',
                'recommended_time_start': datetime.now().isoformat(),
                'recommended_time_end': (datetime.now() + timedelta(days=7)).isoformat(),
                'supporting_data': {
                    'current_consumption': round(current_avg, 1),
                    'baseline_consumption': round(historical_baseline, 1),
                    'increase_percent': round(increase_pct, 1),
                    'monthly_waste_kwh': round(monthly_waste_kwh, 1)
                }
            }

            return self._add_explanation(
                recommendation,
                data_sources=['Historical consumption data', 'Prophet forecast model'],
                risk_factors=['Seasonal variations may affect comparison', 'Increased occupancy could explain higher usage'],
                savings_uncertainty=0.25
            )

        return None

    def generate_hvac_precool_recommendation(
        self,
        consumption_forecast: List[Dict],
        weather_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None
    ) -> Optional[Dict]:
        """
        Generate HVAC pre-cooling/pre-heating recommendations based on pricing and weather.

        Args:
            consumption_forecast: Energy consumption forecast
            weather_forecast: Weather forecast
            pricing_data: Electricity pricing
            caiso_pricing: Optional real-time pricing
        """
        if not weather_forecast or len(weather_forecast) < 8:
            return None

        # Find the price spread between cheap and expensive hours
        all_rates = []
        for i, fc in enumerate(consumption_forecast[:24]):  # Next 24 hours
            rate = self.get_rate_at_time(fc['timestamp'], pricing_data, caiso_pricing)
            all_rates.append({'timestamp': fc['timestamp'], 'rate': rate})

        if not all_rates:
            return None

        # Sort by rate
        sorted_rates = sorted(all_rates, key=lambda x: x['rate'])
        cheapest_period = sorted_rates[0]
        most_expensive_period = sorted_rates[-1]

        # Only recommend if there's significant price spread (>40%)
        price_spread_pct = ((most_expensive_period['rate'] - cheapest_period['rate']) / most_expensive_period['rate']) * 100

        if price_spread_pct < 40:
            return None

        # Estimate HVAC load (assume 40% of total consumption)
        avg_consumption = np.mean([c['predicted_value'] for c in consumption_forecast[:8]])
        hvac_load = avg_consumption * 0.40  # 40% assumption

        # Pre-cooling strategy: Use cheap hours to over-cool, then coast through expensive hours
        precool_hours = 2
        coast_hours = 4

        # Cost of normal cooling during expensive period
        normal_cost = self.calculate_electricity_cost(
            hvac_load * coast_hours,
            most_expensive_period['timestamp'],
            pricing_data,
            caiso_pricing
        )

        # Cost of pre-cooling during cheap period (uses 20% more energy but at lower rate)
        precool_cost = self.calculate_electricity_cost(
            hvac_load * precool_hours * 1.2,
            cheapest_period['timestamp'],
            pricing_data,
            caiso_pricing
        )

        savings = normal_cost - precool_cost

        if savings <= 1:  # Minimum $1 savings threshold
            return None

        cheap_dt = datetime.fromisoformat(cheapest_period['timestamp'].replace('Z', '+00:00'))
        expensive_dt = datetime.fromisoformat(most_expensive_period['timestamp'].replace('Z', '+00:00'))

        recommendation = {
            'type': 'hvac_optimization',
            'headline': f"Pre-cool building at {cheap_dt.strftime('%I%p')} to save ${savings:.0f}",
            'description': (
                f"Electricity is {price_spread_pct:.0f}% cheaper at {cheap_dt.strftime('%I%p')} "
                f"(${cheapest_period['rate']:.3f}/kWh) vs {expensive_dt.strftime('%I%p')} "
                f"(${most_expensive_period['rate']:.3f}/kWh). "
                f"Pre-cool your building by lowering setpoint 2-3°C during cheap hours, "
                f"then raise setpoint during expensive hours. Building thermal mass keeps it cool."
            ),
            'cost_savings': float(round(savings, 2)),
            'co2_reduction': float(round(hvac_load * 0.2 * 0.04, 2)),  # Slight CO2 reduction
            'confidence': 80,
            'action_type': 'hvac_precool',
            'recommended_time_start': cheapest_period['timestamp'],
            'recommended_time_end': (cheap_dt + timedelta(hours=precool_hours)).isoformat(),
            'supporting_data': {
                'cheap_rate': round(cheapest_period['rate'], 3),
                'expensive_rate': round(most_expensive_period['rate'], 3),
                'price_spread_pct': round(price_spread_pct, 1),
                'precool_duration_hours': precool_hours,
                'coast_duration_hours': coast_hours
            }
        }

        return self._add_explanation(
            recommendation,
            data_sources=['CAISO real-time pricing' if caiso_pricing else 'TOU rate structure', 'Weather forecast'],
            risk_factors=['Building thermal mass affects coast duration', 'Occupant comfort may be impacted'],
            savings_uncertainty=0.20
        )

    def generate_ev_charging_recommendation(
        self,
        consumption_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None,
        ev_fleet_size: int = 0
    ) -> Optional[Dict]:
        """
        Generate EV charging optimization recommendations.

        Args:
            consumption_forecast: Energy consumption forecast
            pricing_data: Electricity pricing
            caiso_pricing: Optional real-time pricing
            ev_fleet_size: Number of EVs (0 = estimate based on site)
        """
        # Only generate if site likely has EVs (could be enhanced with actual EV data)
        if ev_fleet_size == 0:
            # Skip for now - would need EV detection logic
            return None

        # Find overnight low-rate period
        overnight_periods = []
        for fc in consumption_forecast[:24]:
            dt = datetime.fromisoformat(fc['timestamp'].replace('Z', '+00:00'))
            if 22 <= dt.hour or dt.hour <= 6:  # 10 PM - 6 AM
                rate = self.get_rate_at_time(fc['timestamp'], pricing_data, caiso_pricing)
                overnight_periods.append({'timestamp': fc['timestamp'], 'rate': rate, 'hour': dt.hour})

        if not overnight_periods:
            return None

        # Find cheapest overnight hours
        sorted_overnight = sorted(overnight_periods, key=lambda x: x['rate'])
        cheapest_overnight = sorted_overnight[0]

        # Find typical daytime rate
        daytime_periods = [fc for fc in consumption_forecast[:24]
                          if 6 < datetime.fromisoformat(fc['timestamp'].replace('Z', '+00:00')).hour < 22]
        if daytime_periods:
            avg_daytime_rate = np.mean([self.get_rate_at_time(p['timestamp'], pricing_data, caiso_pricing)
                                       for p in daytime_periods])
        else:
            avg_daytime_rate = 0.20

        # Calculate savings
        ev_charge_kwh = 50 * ev_fleet_size  # 50 kWh per EV assumption
        overnight_cost = ev_charge_kwh * cheapest_overnight['rate']
        daytime_cost = ev_charge_kwh * avg_daytime_rate
        savings = daytime_cost - overnight_cost

        if savings < 5:  # Minimum $5 savings
            return None

        charge_dt = datetime.fromisoformat(cheapest_overnight['timestamp'].replace('Z', '+00:00'))

        recommendation = {
            'type': 'ev_charging',
            'headline': f"Charge {ev_fleet_size} EVs overnight to save ${savings:.0f}",
            'description': (
                f"Overnight electricity rate ({cheapest_overnight['rate']:.3f}/kWh) is "
                f"{((avg_daytime_rate - cheapest_overnight['rate']) / avg_daytime_rate * 100):.0f}% cheaper "
                f"than daytime rate (${avg_daytime_rate:.3f}/kWh). "
                f"Schedule EV charging for {charge_dt.strftime('%I%p')}-6 AM to save ${savings:.0f} "
                f"vs charging during the day."
            ),
            'cost_savings': float(round(savings, 2)),
            'co2_reduction': 0.0,  # Shifting time doesn't reduce emissions, but could add if paired with solar
            'confidence': 90,
            'action_type': 'ev_charging',
            'recommended_time_start': cheapest_overnight['timestamp'],
            'recommended_time_end': (charge_dt + timedelta(hours=8)).isoformat(),
            'supporting_data': {
                'overnight_rate': round(cheapest_overnight['rate'], 3),
                'daytime_rate': round(avg_daytime_rate, 3),
                'ev_count': ev_fleet_size,
                'total_kwh': round(ev_charge_kwh, 1)
            }
        }

        return self._add_explanation(
            recommendation,
            data_sources=['CAISO real-time pricing' if caiso_pricing else 'TOU rate structure'],
            risk_factors=['EV must be plugged in overnight', 'Charging speed depends on charger type'],
            savings_uncertainty=0.10
        )

    def generate_recommendations(
        self,
        consumption_forecast: List[Dict],
        carbon_forecast: List[Dict],
        pricing_data: Dict,
        caiso_pricing: List[Dict] = None,
        weather_forecast: List[Dict] = None,
        historical_baseline: Optional[float] = None,
        ev_fleet_size: int = 0
    ) -> List[Dict]:
        """
        Generate all recommendations for a site with confidence scoring and explanations.

        Args:
            consumption_forecast: ML-generated consumption forecast
            carbon_forecast: Grid carbon intensity forecast
            pricing_data: Time-of-use rate structure from database
            caiso_pricing: Optional real-time CAISO market pricing (for California sites)
            weather_forecast: Optional weather forecast data
            historical_baseline: Optional historical baseline for efficiency detection
            ev_fleet_size: Number of EVs (for EV charging recommendations)
        """

        recommendations = []

        # 1. Load shifting recommendation
        try:
            load_shift = self.generate_load_shift_recommendation(
                consumption_forecast, carbon_forecast, pricing_data, caiso_pricing
            )
            if load_shift:
                load_shift = self._add_explanation(
                    load_shift,
                    data_sources=['Grid carbon intensity API', 'Prophet consumption forecast',
                                 'CAISO pricing' if caiso_pricing else 'TOU rate structure'],
                    risk_factors=['Forecast uncertainty ±15%', 'Flexible loads must be available'],
                    savings_uncertainty=0.15
                )
                recommendations.append(load_shift)
        except Exception as e:
            print(f"Error generating load shift recommendation: {e}")
            import traceback
            traceback.print_exc()

        # 2. Peak avoidance recommendation
        try:
            peak_avoid = self.generate_peak_avoidance_recommendation(
                consumption_forecast, pricing_data, caiso_pricing
            )
            if peak_avoid:
                peak_avoid = self._add_explanation(
                    peak_avoid,
                    data_sources=['Prophet consumption forecast', 'TOU rate structure'],
                    risk_factors=['Load reduction may impact operations', 'Forecast accuracy ±15%'],
                    savings_uncertainty=0.15
                )
                recommendations.append(peak_avoid)
        except Exception as e:
            print(f"Error generating peak avoidance recommendation: {e}")
            import traceback
            traceback.print_exc()

        # 3. Demand charge avoidance recommendation
        try:
            demand_avoid = self.generate_demand_charge_avoidance(
                consumption_forecast, pricing_data
            )
            if demand_avoid:
                demand_avoid = self._add_explanation(
                    demand_avoid,
                    data_sources=['Prophet consumption forecast', 'Utility demand charge rate'],
                    risk_factors=['Peak timing forecast ±30 min', 'Requires responsive load control'],
                    savings_uncertainty=0.10
                )
                recommendations.append(demand_avoid)
        except Exception as e:
            print(f"Error generating demand charge avoidance recommendation: {e}")

        # 4. Weather-based alerts (NEW)
        if weather_forecast:
            try:
                weather_alert = self.generate_weather_alert(
                    weather_forecast, consumption_forecast, pricing_data, caiso_pricing
                )
                if weather_alert:
                    recommendations.append(weather_alert)
            except Exception as e:
                print(f"Error generating weather alert: {e}")

        # 5. Efficiency/Maintenance alerts (NEW)
        if historical_baseline is not None:
            try:
                efficiency_alert = self.generate_efficiency_alert(
                    consumption_forecast, historical_baseline
                )
                if efficiency_alert:
                    recommendations.append(efficiency_alert)
            except Exception as e:
                print(f"Error generating efficiency alert: {e}")

        # 6. HVAC pre-cooling/pre-heating (NEW)
        if weather_forecast:
            try:
                hvac_rec = self.generate_hvac_precool_recommendation(
                    consumption_forecast, weather_forecast, pricing_data, caiso_pricing
                )
                if hvac_rec:
                    recommendations.append(hvac_rec)
            except Exception as e:
                print(f"Error generating HVAC recommendation: {e}")

        # 7. EV charging optimization (NEW)
        if ev_fleet_size > 0:
            try:
                ev_rec = self.generate_ev_charging_recommendation(
                    consumption_forecast, pricing_data, caiso_pricing, ev_fleet_size
                )
                if ev_rec:
                    recommendations.append(ev_rec)
            except Exception as e:
                print(f"Error generating EV charging recommendation: {e}")

        # Sort by cost savings (highest first) and limit to top 5 to avoid overwhelming users
        recommendations.sort(key=lambda x: x.get('cost_savings', 0), reverse=True)
        return recommendations[:5]  # Return top 5 most valuable recommendations
