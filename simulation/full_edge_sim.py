from vision_pipeline import process_frame
from event_recorder import record_event, init_db
import os
import time
import requests

SERVER_URL = "http://localhost:8000/events"

def run_simulation():
    # 1. Setup
    frame_path = "simulation/test_frame_57k.png"
    crop_rect = (1780, 1180, 100, 100) # Tight ROI for the 40px long-range test
    
    if not os.path.exists("simulation/tablet_buffer.db"):
        init_db()
        
    print("--- STARTING EDGE SIMULATION ---")
    print(f"Processing frame: {frame_path}")
    
    # 2. Vision Pipeline
    results = process_frame(frame_path, crop_rect)
    
    # 3. Persistence & Alert Handling
    if results.get("alerts"):
        for alert in results["alerts"]:
            print(f"🚨 ALERT: {alert}")
            
    if results.get("ids"):
        marker_id = f"ARUCO-{results['ids'][0]}"
        print(f"✅ Detected {marker_id} in {results['processing_time_ms']:.2f}ms")
        
        # 3. Localization (VSLAM/IR Anchors)
        if results.get("local_position"):
            x, y = results["local_position"]["x"], results["local_position"]["y"]
            z = 0.0
            print(f"📍 Localization: Position ({x}, {y}) calculated via {results['anchors_count']} IR Anchors")
        else:
            # Fallback to simulated coordinates from V-SLAM
            x, y, z = 10.5, 4.2, 0.0 
        
        db_id = record_event("scan", marker_id, x, y, z)
        print(f"📦 Event stored in SQLite. Local ID: {db_id}")
        
        # 4. Sync to Local Store Server
        sync_data = {
            "event_type": "scan",
            "pallet_id": marker_id,
            "x": x,
            "y": y,
            "z": z,
            "timestamp": time.time(),
            "alerts": results.get("alerts", [])
        }
        
        try:
            resp = requests.post(SERVER_URL, json=sync_data)
            print(f"📡 Server Sync: {resp.json().get('status')} ({resp.json().get('ingestion_ms')}ms)")
        except Exception as e:
            print(f"⚠️ Server Sync Failed: {e}")
    else:
        print("ℹ️ No pallet marker detected in current ROI.")
    
    print("--- SIMULATION COMPLETE ---")

if __name__ == "__main__":
    run_simulation()
