"""Test ML service endpoints"""
import requests
import json
from datetime import datetime, timedelta

ML_SERVICE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing ML service health...")
    response = requests.get(f"{ML_SERVICE_URL}/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_root():
    """Test root endpoint"""
    print("Testing ML service root...")
    response = requests.get(f"{ML_SERVICE_URL}/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_forecast_consumption():
    """Test consumption forecasting"""
    print("Testing consumption forecasting...")
    payload = {
        "site_id": "1cc35b4c-da27-4be2-bdb6-87435e253d9f",
        "forecast_hours": 24,
        "training_days": 7
    }
    response = requests.post(
        f"{ML_SERVICE_URL}/api/forecast/consumption",
        json=payload
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    print()

def test_generate_recommendations():
    """Test recommendation generation"""
    print("Testing recommendation generation...")
    payload = {
        "site_id": "1cc35b4c-da27-4be2-bdb6-87435e253d9f",
        "forecast_hours": 24,
        "training_days": 7
    }
    response = requests.post(
        f"{ML_SERVICE_URL}/api/recommend/generate",
        json=payload
    )
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Generated {len(data.get('recommendations', []))} recommendations")
        print(f"Saved {data.get('saved_count', 0)} to database")
        if data.get('recommendations'):
            print("\nFirst recommendation:")
            print(json.dumps(data['recommendations'][0], indent=2))
    else:
        print(f"Error: {response.json()}")
    print()

if __name__ == "__main__":
    print("=" * 60)
    print("ML Service Test Suite")
    print("=" * 60)
    print()

    test_health()
    test_root()
    test_forecast_consumption()
    test_generate_recommendations()

    print("=" * 60)
    print("Test suite completed")
    print("=" * 60)
