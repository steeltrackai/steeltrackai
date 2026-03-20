import requests
import time

BASE_URL = "http://localhost:8080"

def test_dynamic_flow():
    print("1. Creating dynamic spot...")
    spot_data = {"name": "PRODUCE-1", "x": 10.5, "y": 5.2, "department": "Produce"}
    r = requests.post(f"{BASE_URL}/floor-spots", json=spot_data)
    print(f"   Status: {r.status_code}, Response: {r.text}")
    if r.status_code != 200:
        print("FAILED TO CREATE SPOT")
        return
    spot_id = r.json().get('id')
    if spot_id is None:
        print("NO ID IN RESPONSE")
        return

    print("\n2. Fetching spots...")
    r = requests.get(f"{BASE_URL}/floor-spots")
    print(f"   Dots found: {len(r.json())}")

    print("\n3. Assigning SKU to spot...")
    assign_data = {"plan_id": 1, "sku": "SKU-MILK-001", "x": 10.5, "y": 5.2, "spot_id": spot_id}
    r = requests.post(f"{BASE_URL}/daily-plan/assign", json=assign_data)
    print(f"   Status: {r.status_code}, Response: {r.json()}")

    print("\n4. Verifying assignment in current plan...")
    r = requests.get(f"{BASE_URL}/daily-plan/current")
    assignments = r.json().get('assignments', [])
    milk_assignment = next((a for a in assignments if a['sku'] == 'SKU-MILK-001'), None)
    print(f"   Milk Assignment: {milk_assignment}")

    print("\n5. Testing UNASSIGN (drag out)...")
    unassign_data = {"plan_id": 1, "sku": "SKU-MILK-001", "spot_id": "CLEAR"}
    r = requests.post(f"{BASE_URL}/daily-plan/assign", json=unassign_data)
    print(f"   Status: {r.status_code}, Response: {r.json()}")

    print("\n6. Verifying removal...")
    r = requests.get(f"{BASE_URL}/daily-plan/current")
    assignments = r.json().get('assignments', [])
    milk_assignment = next((a for a in assignments if a['sku'] == 'SKU-MILK-001'), None)
    print(f"   Milk Assignment (should be None): {milk_assignment}")

if __name__ == "__main__":
    test_dynamic_flow()
