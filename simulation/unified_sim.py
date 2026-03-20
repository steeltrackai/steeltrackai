import requests
import time
import math
import random
import cv2
import numpy as np
import os
import threading
from queue import Queue
from vision_pipeline import process_frame

# --- CONFIGURATION ---
SERVER_URL = "http://localhost:8080/events"
PALLETS_URL = "http://localhost:8080/pallets"
BG_IMAGE = "simulation/test_frame_57k.png"
MARKER_DIR = "simulation/markers"

# SQUARE MAPPING FOR VISION: 160 pixels per meter (X and Y)
PPM_VISION = 160

# Event Queue for Async Post
event_queue = Queue()

def event_sender():
    while True:
        payload = event_queue.get()
        try:
            requests.post(SERVER_URL, json=payload, timeout=0.1)
        except Exception:
            pass
        event_queue.task_done()

threading.Thread(target=event_sender, daemon=True).start()

def send_event_async(id, x, y, z, alerts=[], battery=100.0):
    payload = {
        "event_type": "forklift",
        "pallet_id": id,
        "x": x,
        "y": y,
        "z": z,
        "timestamp": time.time(),
        "alerts": alerts,
        "battery": battery
    }
    event_queue.put(payload)

def send_pallet_update(id, x, y, z):
    payload = {
        "event_type": "pallet",
        "pallet_id": id,
        "x": x,
        "y": y,
        "z": z,
        "timestamp": time.time(),
        "alerts": []
    }
    event_queue.put(payload)

class Forklift:
    def __init__(self, id, start_x, start_y, y_offset=0, is_vision=False):
        self.id = id
        self.x = start_x
        self.y = start_y
        self.y_offset = float(y_offset)
        self.is_vision = is_vision
        self.target_pallet = None
        self.target_pos = None
        self.carrying = None
        self.state = "IDLE"
        self.speed = 0.22 if not is_vision else 0.15 
        self.wait_timer = 0
        self.battery = 99.5 + random.random() * 0.5 # Tablet battery health
        self.last_alerts = []
        
        # Async Vision Sync
        self.vision_busy = False
        self.last_mx = start_x
        self.last_my = start_y
        self.last_yield_log = 0
        self.last_rack_log = 0

    def is_inside_rack(self, x, y):
        # Allow escaping if already inside a rack
        for rx1, rx2, ry1, ry2 in RACK_ZONES:
            if rx1 <= self.x <= rx2 and ry1 <= self.y <= ry2:
                # If next step moves outside the rack area, allow it (leaving)
                if self.target_pos:
                    tx, ty = self.target_pos
                    if not (rx1 <= tx <= rx2 and ry1 <= ty <= ry2):
                        return False # Leaving
        
        # Standard avoidance for new entry
        for rx1, rx2, ry1, ry2 in RACK_ZONES:
            if rx1 <= x <= rx2 and ry1 <= y <= ry2:
                if self.target_pos:
                    tx, ty = self.target_pos
                    # Allow entry ONLY if target is inside THIS rack
                    if rx1 <= tx <= rx2 and ry1 <= ty <= ry2:
                        return False
                return True
        return False

    def move_towards(self, tx, ty, others=[]):
        # 0. STRICT ROAD ENFORCEMENT
        # If we are in transiting states, clamp to the AISLE_Y
        if self.state in ["NAV_TO_AISLE_ENTRY", "NAV_AISLE_HORIZ"]:
            ty = AISLE_Y + self.y_offset

        # 1. Proximity Yielding (Safety First)
        for other in others:
            if other.id != self.id:
                dx_to_other = other.x - self.x
                dy_to_other = other.y - self.y
                dist = math.sqrt(dx_to_other**2 + dy_to_other**2)
                
                lane_conflict = abs(self.y - other.y) < 0.5
                
                if dist < 2.5 and lane_conflict:
                    mv_x = float(tx) - self.x
                    mv_y = float(ty) - self.y
                    dot_product = mv_x * dx_to_other + mv_y * dy_to_other
                    
                    if dot_product > 0: 
                        stop_dist = 0.3 if self.id < other.id else 1.2
                        if dist < stop_dist:
                            return False
                        if dist < 2.0 and self.id > other.id:
                            return False

        dx = float(tx) - self.x
        dy = float(ty) - self.y
        dist = math.sqrt(dx*dx + dy*dy)
        
        if dist < self.speed:
            self.x = float(tx)
            self.y = float(ty)
            self.battery = max(98.0, min(100.0, self.battery + (random.random() - 0.5) * 0.01))
            return True
        else:
            new_x = self.x + (dx/dist) * self.speed
            new_y = self.y + (dy/dist) * self.speed
            
            # 2. Rack Avoidance Check (STRICT)
            if self.is_inside_rack(new_x, new_y):
                return False 
                
            self.x = new_x
            self.y = new_y
            return False

class Pedestrian:
    def __init__(self, id, x, y):
        self.id = id
        self.x = x
        self.y = y
        self.speed = 0.08 # Walks at ~0.8m/s (sim scaled)
        self.target = (random.uniform(2, 22), random.uniform(2, 14))

    def move(self):
        dx = self.target[0] - self.x
        dy = self.target[1] - self.y
        dist = math.sqrt(dx**2 + dy**2)
        if dist < self.speed:
            self.target = (random.uniform(2, 22), random.uniform(2, 14))
        else:
            self.x += (dx/dist) * self.speed
            self.y += (dy/dist) * self.speed

# Warehouse Config
RACK_LOCATIONS = [(8.0, 2.6), (12.0, 2.6), (8.0, 5.6), (12.0, 5.6)]
# Define Rack Exclusion Zones (Bounding boxes: x_min, x_max, y_min, y_max)
RACK_ZONES = [
    (7.4, 8.6, 1.9, 3.3),   # Rack 1 (Padded)
    (11.4, 12.6, 1.9, 3.3), # Rack 2 (Padded)
    (7.4, 8.6, 4.9, 6.3),   # Rack 3 (Padded)
    (11.4, 12.6, 4.9, 6.3)  # Rack 4 (Padded)
]
AISLE_Y = 4.1

def meter_to_pixel(mx, my):
    return int(mx * PPM_VISION), int(my * PPM_VISION)

def pixel_to_meter(px, py):
    return round(px / PPM_VISION, 2), round(py / PPM_VISION, 2)

def vision_worker(fl, base_bg):
    """Background thread for heavy OpenCV processing."""
    while True:
        if fl.is_vision and not fl.vision_busy:
            fl.vision_busy = True
            
            # Snap internal state
            px, py = meter_to_pixel(fl.x, fl.y)
            frame = base_bg.copy()
            marker_path = os.path.join(MARKER_DIR, "marker_0.png")
            marker = cv2.imread(marker_path)
            
            if marker is not None:
                m_res = cv2.resize(marker, (60, 60))
                h_m, w_m = m_res.shape[:2]
                iy, ix = int(py - h_m/2), int(px - w_m/2)
                
                # Robust clipping for 4K bounds (3840 x 2160)
                y1, y2 = max(0, iy), min(2160, iy + h_m)
                x1, x2 = max(0, ix), min(3840, ix + w_m)
                my1, my2 = max(0, -iy), min(h_m, 2160 - iy)
                mx1, mx2 = max(0, -ix), min(w_m, 3840 - ix)
                
                if y2 > y1 and x2 > x1:
                    frame[y1:y2, x1:x2] = m_res[my1:my2, mx1:mx2]
            
            # Process in-memory
            results = process_frame(frame, (0, 0, 3840, 2160))
            
            if results.get("detections"):
                # Find the forklift marker (ID 0)
                forklift_marker = next((d for d in results["detections"] if d["id"] == 0), None)
                
                # Update vision reality, but let simulation MOVE towards it
                # (Prevents vision jitter from bypassing sim safety stops)
                if forklift_marker and "center" in forklift_marker:
                    cx, cy = forklift_marker["center"]
                    dmx, dmy = pixel_to_meter(cx, cy)
                    fl.last_mx = max(0.1, min(23.9, dmx))
                    fl.last_my = max(0.1, min(15.9, dmy))
                    fl.last_alerts = results.get("alerts", [])
                else:
                    pass
                
            fl.vision_busy = False
        time.sleep(0.01)

def run_unified_sim():
    print("STARTING Unified Vision Simulation...")
    
    if not os.path.exists(BG_IMAGE):
        print("Error: Background image not found.")
        return
    
    base_bg = cv2.imread(BG_IMAGE)
    base_bg = cv2.resize(base_bg, (3840, 2160))
    
    # Forklift Fleet with Dedicated Pass-Through Lanes
    forklifts = [
        Forklift("FL-01", 6.0, 3.3, y_offset=-0.8),         # Top Lane
        Forklift("FL-02", 12.0, 4.9, y_offset=0.8),         # Bottom Lane
        Forklift("VISION-PRO", 18.0, 4.1, y_offset=0, is_vision=True) # Center Lane (Hybrid)
    ]
    
    pedestrians = [
        Pedestrian("P-01", 5.0, 5.0),
        Pedestrian("P-02", 15.0, 10.0)
    ]

    # Vision Thread
    threading.Thread(target=vision_worker, args=(forklifts[2], base_bg), daemon=True).start()

    # Load initial pallets and handle potential server delay
    time.sleep(1) 
    try:
        resp = requests.get(PALLETS_URL, timeout=1).json()
        pallets = {p['pallet_id_tag']: {'x': p['location_x'], 'y': p['location_y']} for p in resp}
        print(f"Loaded {len(pallets)} pallets from server.")
    except:
        print("Server fetch failed, using internal pallet tracker.")
        pallets = {"ARUCO-101": {'x': 1.0, 'y': 2.0}, "ARUCO-102": {'x': 1.0, 'y': 6.0}}

    while True:
        for p in pedestrians:
            p.move()

        for fl in forklifts:
            # 0. Safety: Pedestrian Detection
            emergency_stop = False
            # Clear pedestrian-specific alerts at start of frame, but keep vision alerts if any
            if not fl.is_vision:
                fl.last_alerts = []
            else:
                # For vision units, only filter out pedestrian alerts, keep vision findings
                fl.last_alerts = [a for a in fl.last_alerts if "Pedestrian" not in a]

            for p in pedestrians:
                p_dist = math.sqrt((fl.x - p.x)**2 + (fl.y - p.y)**2)
                if p_dist < 4.0: # Pedestrian near-miss zone
                    if "DANGER: Pedestrian in Blind Spot!" not in fl.last_alerts:
                        fl.last_alerts.append("DANGER: Pedestrian in Blind Spot!")
                    if p_dist < 1.5: # Emergency stop for pedestrian
                        emergency_stop = True
            
            if emergency_stop:
                # Still send telemetry so the dashboard knows we are stopped + alert
                send_event_async(str(fl.id), float(fl.x), float(fl.y), 0.0, fl.last_alerts, float(fl.battery))
                continue

            # 1. State Machine
            if fl.state == "IDLE":
                available = [pid for pid in pallets if pid.startswith("ARUCO-") and not any(f.carrying == pid or f.target_pallet == pid for f in forklifts)]
                if available:
                    fl.target_pallet = random.choice(available)
                    fl.target_pos = (pallets[fl.target_pallet]['x'], pallets[fl.target_pallet]['y'])
                    fl.state = "NAV_TO_AISLE_ENTRY"
                    print(f"[{fl.id}] Fetching {fl.target_pallet}")
            
            elif fl.state == "NAV_TO_AISLE_ENTRY":
                if fl.move_towards(fl.x, AISLE_Y + fl.y_offset, forklifts):
                    fl.state = "NAV_AISLE_HORIZ"

            elif fl.state == "NAV_AISLE_HORIZ":
                if fl.move_towards(fl.target_pos[0], AISLE_Y + fl.y_offset, forklifts):
                    fl.state = "NAV_DOCK_VERT"

            elif fl.state == "NAV_DOCK_VERT":
                if fl.move_towards(fl.target_pos[0], fl.target_pos[1], forklifts):
                    if fl.carrying:
                        print(f"[{fl.id}] Delivered {fl.carrying}")
                        pallets[str(fl.carrying)]['x'] = fl.x
                        pallets[str(fl.carrying)]['y'] = fl.y
                        fl.carrying = None
                        fl.state = "WAITING"
                        fl.wait_timer = 20
                    else:
                        fl.carrying = str(fl.target_pallet)
                        print(f"[{fl.id}] Picked up {fl.carrying}")
                        fl.target_pallet = None
                        # Target a random rack location
                        rx, ry = random.choice(RACK_LOCATIONS)
                        fl.target_pos = (rx, ry)
                        fl.state = "NAV_TO_AISLE_ENTRY"

            elif fl.state == "WAITING":
                fl.wait_timer -= 1
                if fl.wait_timer <= 0:
                    fl.state = "IDLE"

            # 2. Telemetry Ingestion (Send SIM Position to Digital Twin)
            send_event_async(str(fl.id), float(fl.x), float(fl.y), 0.0, fl.last_alerts, float(fl.battery))

            # 3. Vision Follower (Force simulation to move towards vision reality if vision unit)
            if fl.is_vision:
                fl.move_towards(fl.last_mx, fl.last_my, forklifts)

            # 4. Handle Carried Pallets
            if fl.carrying and fl.carrying in pallets:
                pallets[fl.carrying]['x'] = fl.x
                pallets[fl.carrying]['y'] = fl.y
                send_pallet_update(fl.carrying, float(fl.x), float(fl.y), 0.0)

        # 5. Pedestrian Telemetry
        for p in pedestrians:
            payload = {
                "event_type": "pedestrian",
                "pallet_id": p.id,
                "x": float(p.x),
                "y": float(p.y),
                "z": 1.2, # Head height
                "timestamp": time.time(),
                "battery": 100.0
            }
            event_queue.put(payload)

        time.sleep(0.1) # 10Hz Fleet Simulation

if __name__ == "__main__":
    run_unified_sim()
