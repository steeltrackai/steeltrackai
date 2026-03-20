import requests
import time
import math
import random
import threading
from queue import Queue

SERVER_URL = "http://localhost:8080/events"
PALLETS_URL = "http://localhost:8080/pallets"

# Shared queue for async event delivery
event_queue = Queue()

def event_sender():
    while True:
        payload = event_queue.get()
        try:
            requests.post(SERVER_URL, json=payload, timeout=0.1)
        except Exception:
            pass
        event_queue.task_done()

# Start sender thread
threading.Thread(target=event_sender, daemon=True).start()

def send_event_async(id, x, y, z):
    payload = {
        "event_type": "forklift",
        "pallet_id": id,
        "x": x,
        "y": y,
        "z": z,
        "timestamp": time.time(),
        "alerts": []
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
    def __init__(self, id, start_x, start_y, y_offset=0):
        self.id = id
        self.x = start_x
        self.y = start_y
        self.y_offset = y_offset # To prevent aisle overlap
        self.target_pallet = None
        self.target_pos = None
        self.carrying = None # Pallet ID
        self.state = "IDLE"
        self.speed = 0.22 # Balanced speed
        self.wait_timer = 0

    def move_towards(self, tx, ty):
        dx = tx - self.x
        dy = ty - self.y
        dist = math.sqrt(dx*dx + dy*dy)
        if dist < self.speed:
            self.x = tx
            self.y = ty
            return True
        else:
            self.x += (dx/dist) * self.speed
            self.y += (dy/dist) * self.speed
            return False

# Warehouse Configuration (Synced with WarehouseMap.tsx)
# Racks: y=2.0-3.2 and y=5.0-6.2. Aisle center y=4.1.
RACK_LOCATIONS = [
    (6.0, 2.6), (10.0, 2.6), # Rack center points
    (6.0, 5.6), (10.0, 5.6)
]
AISLE_Y = 4.1

print("Starting Optimized Forklift Simulation (Sync V3)...")

# 1. Fetch Initial Pallets
try:
    resp = requests.get(PALLETS_URL).json()
    pallets = {p['pallet_id_tag']: {'x': p['location_x'], 'y': p['location_y']} for p in resp}
except:
    pallets = {"ARUCO-101": {'x': 1.0, 'y': 2.0}, "ARUCO-102": {'x': 1.0, 'y': 3.0}}

# Distribute forklifts with offsets
fl1 = Forklift("FL-01", 14.0, 4.1, y_offset=-0.2)
fl2 = Forklift("FL-02", 14.5, 3.5, y_offset=0.2)
forklifts = [fl1, fl2]

try:
    while True:
        for fl in forklifts:
            if fl.state == "IDLE":
                available = [pid for pid in pallets if not any(f.carrying == pid or f.target_pallet == pid for f in forklifts)]
                if available:
                    fl.target_pallet = random.choice(available)
                    fl.target_pos = (pallets[fl.target_pallet]['x'], pallets[fl.target_pallet]['y'])
                    fl.state = "NAV_TO_AISLE_ENTRY"
                    print(f"[{fl.id}] Fetching {fl.target_pallet}...")
                
            elif fl.state == "NAV_TO_AISLE_ENTRY":
                # Move to aisle with offset
                if fl.move_towards(fl.x, AISLE_Y + fl.y_offset):
                    fl.state = "NAV_AISLE_HORIZ"

            elif fl.state == "NAV_AISLE_HORIZ":
                # Move to target X within aisle
                if fl.move_towards(fl.target_pos[0], AISLE_Y + fl.y_offset):
                    fl.state = "NAV_DOCK_VERT"

            elif fl.state == "NAV_DOCK_VERT":
                # Final arrival at target (no offset)
                if fl.move_towards(fl.target_pos[0], fl.target_pos[1]):
                    if fl.carrying:
                        # Dropped off
                        pallets[str(fl.carrying)]['x'] = fl.x
                        pallets[str(fl.carrying)]['y'] = fl.y
                        print(f"[{fl.id}] Detached {fl.carrying}")
                        fl.carrying = None
                        fl.state = "WAITING"
                        fl.wait_timer = 30
                    else:
                        # Picked up
                        fl.carrying = str(fl.target_pallet)
                        print(f"[{fl.id}] Attached {fl.carrying}")
                        fl.target_pallet = None
                        fl.target_pos = random.choice(RACK_LOCATIONS)
                        fl.state = "NAV_TO_AISLE_ENTRY"

            elif fl.state == "WAITING":
                fl.wait_timer -= 1
                if fl.wait_timer <= 0:
                    fl.state = "IDLE"

            # Sync Telemetry
            send_event_async(fl.id, fl.x, fl.y, 0)
            if fl.carrying:
                pallets[fl.carrying]['x'] = fl.x
                pallets[fl.carrying]['y'] = fl.y
                send_pallet_update(fl.carrying, fl.x, fl.y, 0)

        time.sleep(0.1)
except KeyboardInterrupt:
    print("Sim stopped.")
