import requests
import time
import cv2
import numpy as np
import os
import math
from vision_pipeline import process_frame

# --- CONFIGURATION ---
SERVER_URL = "http://localhost:8080/events"
BG_IMAGE = "simulation/test_frame_57k.png"
MARKER_DIR = "simulation/markers"
PIXELS_PER_METER = 160 # 3840px / 24m
OFFSET_X = 0
OFFSET_Y = 0

def pixel_to_meter(px, py):
    """Converts 4K raw pixels to Warehouse meters."""
    mx = px / PIXELS_PER_METER
    my = py / PIXELS_PER_METER
    return round(mx, 2), round(my, 2)

def generate_moving_frame(base_bg, marker_id, t):
    """Creates a frame with a marker moving in a circle."""
    # Load background if not already in memory
    frame = base_bg.copy()
    
    # Calculate moving position (circle)
    # Center of circle at (1920, 1080)
    # Radius 500 pixels
    radius = 600
    px = 1920 + radius * math.cos(t * 0.5)
    py = 1080 + radius * math.sin(t * 0.5)
    
    # Add marker
    marker_path = os.path.join(MARKER_DIR, f"marker_{marker_id}.png")
    marker = cv2.imread(marker_path)
    if marker is not None:
        marker_res = cv2.resize(marker, (60, 60))
        # Paste with bounds check
        h, w = marker_res.shape[:2]
        ix, iy = int(px - w/2), int(py - h/2)
        frame[iy:iy+h, ix:ix+w] = marker_res
        
    return frame, (px, py)

def run_vision_bridge():
    print("🚀 Starting Vision-to-Telemetry Bridge...")
    
    if not os.path.exists(BG_IMAGE):
        print(f"Error: {BG_IMAGE} not found. Please run create_world.py first.")
        return

    base_bg = cv2.imread(BG_IMAGE)
    if base_bg is None:
        print("Failed to load background image.")
        return

    # Ensure 4K resolution as per create_world.py
    base_bg = cv2.resize(base_bg, (3840, 2160))
    
    t = 0
    try:
        while True:
            # 1. Generate "Live" Frame
            frame, true_pixel_pos = generate_moving_frame(base_bg, 0, t)
            temp_frame_path = "simulation/live_feed.png"
            cv2.imwrite(temp_frame_path, frame)
            
            # 2. Process via Vision Pipeline
            # We look at the whole frame or a dynamic ROI
            # For simplicity, let's look at the whole frame (slower but safer for demo)
            # Actually, let's use a wide ROI around the movement area
            crop_rect = (0, 0, 3840, 2160) 
            results = process_frame(temp_frame_path, crop_rect)
            
            # 3. Handle Detections
            if results["detections"]:
                det = results["detections"][0]
                cx, cy = det["center"]
                
                # Convert to meters
                mx, my = pixel_to_meter(cx, cy)
                
                # 4. Send Telemetry
                payload = {
                    "event_type": "forklift", # Use forklift type for visual demo
                    "pallet_id": "VISION-FL-01",
                    "x": mx,
                    "y": my,
                    "z": 0,
                    "timestamp": time.time(),
                    "alerts": results["alerts"]
                }
                
                try:
                    resp = requests.post(SERVER_URL, json=payload, timeout=0.5)
                    print(f"📍 [VISION] Detected at ({mx}m, {my}m) | Process: {results['processing_time_ms']:.1f}ms | Sync: {resp.status_code}")
                except Exception as e:
                    print(f"⚠️ Sync Failed: {e}")
            else:
                print("🔍 Searching for markers...")

            t += 0.2
            time.sleep(0.05) # ~10-15 FPS target
            
    except KeyboardInterrupt:
        print("\nBridge stopped.")

if __name__ == "__main__":
    run_vision_bridge()
