# ML Architecture Optimization Roadmap

## 🎯 Goal
Enhance ML accuracy and expand recommendation diversity for more valuable, actionable insights.

---

## **Current State Analysis**

### ✅ What's Working Well
- Prophet for time series forecasting
- Real-time pricing integration (CAISO)
- Carbon intensity awareness (WattTime)
- Weather data integration (OpenWeatherMap)
- Battery optimization (TypeScript)

### ⚠️ Current Limitations
1. **Prophet only uses historical consumption** - no external features
2. **Limited to 3 recommendation types** - load shifting, peak avoidance, solar self-consumption
3. **No demand response** recommendations
4. **No equipment-specific** insights (HVAC, EVs, etc.)
5. **Short training window** (7 days) - misses seasonal patterns
6. **No model comparison** - Prophet is the only model
7. **No occupancy/calendar** awareness
8. **Fixed 6-hour generation** - not event-driven

---

## **🚀 TIER 1: Quick Wins (1-2 weeks each)**

### **1. Enhance Prophet with Regressors (External Features)**

**Current**: Prophet only learns from past consumption values
**Enhancement**: Add external variables that influence consumption

#### Implementation:
```python
# ml-service/app/services/consumption_forecaster.py

class ConsumptionForecaster:
    def train(self, measurements: List[Dict], weather_data: List[Dict] = None,
              pricing_data: List[Dict] = None, calendar_events: List[Dict] = None):

        df = self.prepare_data(measurements)

        # Add weather regressors
        if weather_data:
            df['temperature'] = self._map_weather(weather_data, 'temperature')
            df['humidity'] = self._map_weather(weather_data, 'humidity')
            df['cloud_cover'] = self._map_weather(weather_data, 'cloud_cover')

        # Add pricing regressors
        if pricing_data:
            df['electricity_price'] = self._map_pricing(pricing_data)

        # Add calendar regressors
        if calendar_events:
            df['is_holiday'] = self._map_holidays(calendar_events)
            df['is_weekend'] = df['ds'].dt.dayofweek.isin([5, 6]).astype(int)
            df['hour_of_day'] = df['ds'].dt.hour

        # Initialize Prophet with regressors
        self.model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=True,  # Enable with more data
            changepoint_prior_scale=0.05
        )

        # Add regressors
        self.model.add_regressor('temperature')
        self.model.add_regressor('humidity')
        self.model.add_regressor('cloud_cover')
        self.model.add_regressor('electricity_price')
        self.model.add_regressor('is_holiday')

        self.model.fit(df)
```

**Expected Improvement**: 15-25% better forecast accuracy

---

### **2. Expand Recommendation Types**

**Current**: 3 types (load shifting, peak avoidance, solar self-consumption)
**Enhancement**: 10+ diverse recommendation types

#### New Recommendation Categories:

**A. Demand Response**
```python
def generate_demand_response_recommendations(self, forecast, pricing):
    """
    Participate in utility demand response programs
    Example: "Grid emergency event predicted 2-5 PM tomorrow.
              Reduce load by 20% to earn $50 incentive"
    """
```

**B. Equipment-Specific**
```python
def generate_hvac_recommendations(self, forecast, weather):
    """
    Pre-cool/pre-heat strategies
    Example: "Pre-cool building 12-2 PM using cheap solar,
              then coast during 4-7 PM peak"
    """

def generate_ev_charging_recommendations(self, forecast, pricing):
    """
    Smart EV charging schedules
    Example: "Charge EV 11 PM - 6 AM for $8.50 (vs $15.20 at 6 PM)"
    """

def generate_water_heater_recommendations(self, pricing):
    """
    Water heater scheduling
    Example: "Heat water 10 PM - 6 AM when rates are 60% lower"
    """
```

**C. Proactive Maintenance**
```python
def generate_efficiency_recommendations(self, measurements):
    """
    Detect anomalies indicating equipment degradation
    Example: "HVAC consuming 25% more than typical for this temperature.
              Schedule maintenance - could save $200/month"
    """
```

**D. Weather-Based**
```python
def generate_weather_recommendations(self, weather_forecast):
    """
    Example: "Heatwave forecasted Thu-Sat. Pre-cool tonight,
              expect 40% higher costs without action"
    """
```

**E. Renewable Energy**
```python
def generate_solar_curtailment_recommendations(self, solar_forecast, grid_export_rate):
    """
    Example: "Solar production will exceed consumption 11 AM - 3 PM.
              Export 150 kWh to grid for $18 credit"
    """

def generate_battery_arbitrage_recommendations(self, pricing_forecast):
    """
    Example: "Price spread of $0.25/kWh predicted tomorrow.
              Charge at 2 AM ($0.08), discharge at 6 PM ($0.35)
              for $25 daily profit"
    """
```

**Expected Impact**: 5-8 recommendations per site daily (vs current 1-3)

---

### **3. Industry-Specific Recommendation Templates**

Add templates tailored to each industry type:

```python
class IndustryRecommendationEngine:

    INDUSTRY_TEMPLATES = {
        'manufacturing': {
            'production_scheduling': "Shift non-critical production to {low_price_hours}",
            'process_optimization': "Run batch processes during {solar_hours}",
            'compressed_air': "Reduce air compressor load during {peak_hours}"
        },
        'datacenter': {
            'workload_shifting': "Migrate batch jobs to {low_carbon_region}",
            'cooling_optimization': "Use free cooling during {cool_night_hours}",
            'server_scaling': "Scale down non-critical servers during {peak_hours}"
        },
        'logistics': {
            'ev_fleet': "Charge {ev_count} vehicles during {cheap_hours}",
            'cold_storage': "Pre-cool warehouses before {peak_hours}",
            'loading_dock': "Schedule loading operations during {solar_hours}"
        },
        'biotech': {
            'lab_equipment': "Run centrifuges/autoclaves during {off_peak_hours}",
            'hvac_precision': "Adjust lab HVAC setpoints during {moderate_weather}",
            'backup_systems': "Test backup generators during {low_demand_hours}"
        },
        'retail': {
            'lighting': "Dim non-essential lighting 20% during {peak_hours}",
            'refrigeration': "Pre-cool cases before {peak_hours}, coast through peak",
            'signage': "Turn off external signage during {expensive_hours}"
        }
    }
```

**Expected Impact**: Recommendations feel more relevant and actionable per industry

---

## **🔥 TIER 2: Medium Complexity (2-4 weeks each)**

### **4. Multi-Model Ensemble Forecasting**

**Current**: Only Prophet
**Enhancement**: Ensemble of 3-4 models, choose best performer

#### Implementation:
```python
class EnsembleForecaster:
    def __init__(self):
        self.models = {
            'prophet': Prophet(),
            'xgboost': XGBRegressor(),
            'lstm': LSTMModel(),
            'arima': AutoARIMA()
        }
        self.weights = {}  # Model weights based on performance

    def train_all(self, data):
        results = {}
        for name, model in self.models.items():
            model.fit(data)
            mape = self._validate(model, data)  # Cross-validation
            results[name] = {'model': model, 'mape': mape}

        # Weighted average based on accuracy
        self.weights = self._calculate_weights(results)

    def forecast(self, hours_ahead):
        forecasts = []
        for name, model in self.models.items():
            pred = model.predict(hours_ahead)
            forecasts.append(pred * self.weights[name])

        return np.sum(forecasts, axis=0)  # Weighted ensemble
```

**Models to Add**:
1. **XGBoost** - Great for capturing complex patterns
2. **LSTM** - Deep learning for sequential data
3. **ARIMA** - Statistical baseline
4. **LightGBM** - Fast gradient boosting

**Expected Improvement**: 20-35% better accuracy through ensemble

---

### **5. Real-Time Adaptive Recommendations**

**Current**: Recommendations generated every 6 hours (batch)
**Enhancement**: Event-driven + continuous monitoring

#### Implementation:
```python
class RealtimeRecommendationMonitor:
    """Monitor conditions and trigger recommendations when opportunities arise"""

    TRIGGERS = [
        {
            'name': 'price_spike_imminent',
            'condition': lambda: self.check_price_spike_forecast(),
            'recommendation': 'urgent_load_reduction',
            'priority': 'high'
        },
        {
            'name': 'excess_solar_detected',
            'condition': lambda: self.check_solar_excess(),
            'recommendation': 'charge_battery_or_shift_load',
            'priority': 'medium'
        },
        {
            'name': 'grid_carbon_ultra_low',
            'condition': lambda: self.check_carbon_intensity() < 100,
            'recommendation': 'run_energy_intensive_tasks',
            'priority': 'medium'
        }
    ]

    async def monitor(self):
        while True:
            for trigger in self.TRIGGERS:
                if trigger['condition']():
                    await self.generate_recommendation(trigger)
            await asyncio.sleep(300)  # Check every 5 minutes
```

**Expected Impact**: Catch time-sensitive opportunities (e.g., negative pricing)

---

### **6. Confidence Scoring & Explanation**

Add confidence scores and explanations to every recommendation:

```python
class ExplainableRecommendation:
    def generate_with_explanation(self, recommendation):
        return {
            'recommendation': recommendation,
            'confidence': self._calculate_confidence(),
            'explanation': {
                'why': "Electricity price drops 65% from $0.35 to $0.12/kWh",
                'data_sources': ['CAISO real-time pricing', 'Prophet forecast'],
                'risk_factors': ['Forecast has ±15% uncertainty'],
                'alternative_actions': ['Wait until midnight for even lower rates']
            },
            'expected_savings': {
                'cost': '$12.50',
                'carbon': '8.5 kg CO2',
                'probability': 0.85
            }
        }
```

**Expected Impact**: Users trust and act on recommendations more

---

## **⚡ TIER 3: Advanced (4-8 weeks each)**

### **7. Reinforcement Learning for Battery Control**

**Current**: TypeScript dynamic programming (good, but fixed rules)
**Enhancement**: RL agent learns optimal strategy

#### Implementation:
```python
import gymnasium as gym
from stable_baselines3 import PPO

class BatteryEnv(gym.Env):
    """Custom environment for battery optimization"""

    def __init__(self, pricing_data, solar_forecast, consumption_forecast):
        super().__init__()
        self.action_space = gym.spaces.Box(low=-1, high=1, shape=(1,))  # -1=discharge, +1=charge
        self.observation_space = gym.spaces.Box(...)

    def step(self, action):
        # Simulate one time step
        charge_amount = action * self.battery_capacity
        cost = self._calculate_cost(charge_amount)
        carbon = self._calculate_carbon(charge_amount)

        reward = -cost - (carbon * self.carbon_price)
        return observation, reward, done, info

# Train agent
env = BatteryEnv(pricing, solar, consumption)
model = PPO("MlpPolicy", env, verbose=1)
model.learn(total_timesteps=100000)

# Use for real-time decisions
obs = env.reset()
action = model.predict(obs)
```

**Expected Improvement**: 10-20% better battery ROI vs rule-based

---

### **8. Long-Term Forecasting with Seasonal Models**

**Current**: 7 days training, 24 hours forecast
**Enhancement**: 12+ months training, multi-day forecasts

#### Implementation:
```python
class LongTermForecaster:
    def __init__(self):
        self.model = Prophet(
            yearly_seasonality=True,
            seasonality_mode='multiplicative',
            changepoint_prior_scale=0.001  # More conservative for long-term
        )

        # Add custom seasonalities
        self.model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )

        # Add industry-specific patterns
        self.model.add_seasonality(
            name='production_cycle',  # For manufacturing
            period=7,  # Weekly production schedule
            fourier_order=3
        )

    def forecast_multi_day(self, days_ahead=7):
        """Generate 7-day forecast for strategic planning"""
        return self.model.predict(
            self.model.make_future_dataframe(periods=days_ahead*24, freq='H')
        )
```

**Use Cases**:
- Budget forecasting: "Expected energy cost next month: $12,500"
- Capacity planning: "Peak demand will exceed transformer capacity on July 15"
- Renewable sizing: "Adding 100 kW solar would offset 85% of summer consumption"

---

### **9. Anomaly Detection for Proactive Alerts**

Detect equipment issues before they become expensive:

```python
from sklearn.ensemble import IsolationForest

class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(contamination=0.05)

    def detect_equipment_anomalies(self, measurements):
        """Detect abnormal consumption patterns"""
        features = self._extract_features(measurements)
        anomalies = self.model.predict(features)

        if anomalies.any():
            return self._generate_maintenance_alert(features, anomalies)

    def _generate_maintenance_alert(self, features, anomalies):
        return {
            'alert': 'HVAC consuming 30% above normal for current temperature',
            'severity': 'medium',
            'estimated_waste': '$250/month',
            'suggested_action': 'Schedule HVAC maintenance inspection',
            'confidence': 0.92
        }
```

---

### **10. Federated Learning Across Sites**

Learn from all sites without sharing sensitive data:

```python
class FederatedRecommendationEngine:
    """Learn optimal strategies from entire portfolio"""

    def aggregate_insights(self, site_models):
        """
        Combine learnings from all sites:
        - Manufacturing sites: Learn best production schedules
        - Datacenters: Learn cooling optimization
        - Share anonymized patterns, not raw data
        """

        aggregated_model = self._federated_averaging(site_models)

        return {
            'industry_best_practices': self._extract_patterns(aggregated_model),
            'peer_benchmarking': "Your site uses 15% more than similar facilities",
            'optimization_potential': "$3,200/month based on peer performance"
        }
```

---

## **📊 Expected Overall Impact**

| Metric | Current | After Tier 1 | After Tier 2 | After Tier 3 |
|--------|---------|--------------|--------------|--------------|
| **Forecast Accuracy (MAPE)** | 25% | 18% | 12% | 8% |
| **Recommendations per Site** | 1-3/day | 5-8/day | 10-15/day | 15-25/day |
| **Recommendation Types** | 3 | 10 | 15 | 25+ |
| **User Action Rate** | ~30% | ~45% | ~60% | ~70% |
| **Average Savings per Rec** | $5-10 | $8-15 | $12-20 | $15-30 |
| **Model Response Time** | 2-3s | 2-3s | 3-5s | 1-2s (cached) |

---

## **🛠️ Implementation Priority**

### Phase 1 (Month 1-2): Quick Wins
1. ✅ Add Prophet regressors (weather, pricing, calendar)
2. ✅ Expand to 10 recommendation types
3. ✅ Add industry-specific templates

### Phase 2 (Month 3-4): Accuracy Improvements
4. ✅ Multi-model ensemble
5. ✅ Real-time adaptive recommendations
6. ✅ Confidence scoring & explanations

### Phase 3 (Month 5-8): Advanced ML
7. ✅ Reinforcement learning for batteries
8. ✅ Long-term forecasting
9. ✅ Anomaly detection
10. ✅ Federated learning

---

## **🔧 Technical Requirements**

### Additional Python Packages:
```bash
# ml-service/requirements.txt additions
xgboost>=2.0.0
lightgbm>=4.0.0
tensorflow>=2.15.0  # For LSTM
scikit-learn>=1.3.0
stable-baselines3>=2.0.0  # For RL
gymnasium>=0.29.0
pmdarima>=2.0.0  # For AutoARIMA
```

### Infrastructure Needs:
- **More compute**: Railway Pro plan or AWS EC2 (t3.medium)
- **Model storage**: S3 or Railway volumes for trained models
- **Caching**: Redis for real-time recommendation lookup
- **Monitoring**: MLflow for model performance tracking

### Database Schema Updates:
```sql
-- Store model metadata
CREATE TABLE ml_models (
  id UUID PRIMARY KEY,
  model_type TEXT NOT NULL,  -- 'prophet', 'xgboost', 'lstm'
  site_id UUID,
  trained_at TIMESTAMP,
  accuracy_mape FLOAT,
  is_active BOOLEAN,
  model_artifact_url TEXT  -- S3/Railway URL
);

-- Store model predictions for comparison
CREATE TABLE model_predictions (
  id UUID PRIMARY KEY,
  model_id UUID REFERENCES ml_models(id),
  timestamp TIMESTAMP,
  predicted_value FLOAT,
  actual_value FLOAT,
  error FLOAT
);
```

---

## **💡 Quick Start: Implement Tier 1 Item #1**

Want to start immediately? Here's the first enhancement:

```python
# 1. Update consumption_forecaster.py to accept weather data
# 2. Add weather regressor to Prophet model
# 3. Update API endpoint to fetch weather during training
# 4. Test with historical data

# Expected 5-hour implementation, 15-20% accuracy improvement
```

Would you like me to implement this first enhancement for you?
