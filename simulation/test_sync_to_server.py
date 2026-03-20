import requests
import time
import json

SERVER_URL = "http://localhost:8000/events"

def simulate_edge_to_server():
    print("--- SIMULATING EDGE SYNC TO STORE SERVER ---")
    
    # 1. Normal Scan
    event_data = {
        "event_type": "scan",
        "pallet_id": "ARUCO-101",
        "x": 12.5,
        "y": 4.0,
        "z": 0.0,
        "timestamp": time.time(),
        "alerts": []
    }
    
    try:
        response = requests.post(SERVER_URL, json=event_data)
        print(f"Normal Scan: {response.json()}")
    except Exception as e:
        print(f"Failed to connect to server: {e}")

    # 2. Critical Safety Scan
    safety_event = {
        "event_type": "scan",
        "pallet_id": "ARUCO-666",
        "x": 15.2,
        "y": 8.1,
        "z": 0.0,
        "timestamp": time.time(),
        "alerts": ["DANGER: Misaligned Load", "DANGER: Pedestrian in Blind Spot!"]
    }
    
    try:
        response = requests.post(SERVER_URL, json=safety_event)
        print(f"Safety Alert Scan: {response.json()}")
    except Exception as e:
        print(f"Failed to connect to server: {e}")

if __name__ == "__main__":
    simulate_edge_to_server()
