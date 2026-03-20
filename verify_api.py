import requests

BASE_URL = "http://127.0.0.1:8085"

print("Checking /pallets...")
try:
    res = requests.get(f"{BASE_URL}/pallets")
    print(f"Status: {res.status_code}")
    print(f"Data: {res.json()}")
except Exception as e:
    print(f"Error: {e}")

print("\nChecking /daily-plan/current...")
try:
    res = requests.get(f"{BASE_URL}/daily-plan/current")
    print(f"Status: {res.status_code}")
    print(f"Data: {res.json()}")
except Exception as e:
    print(f"Error: {e}")
