from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import time
import sqlite3
import json
# Force-unify to store_twin.db to prevent "Empty Box" syndrome
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "store_twin.db")
print(f"TELEMETRY SERVER STARTING. USING DATABASE AT: {os.path.abspath(DB_PATH)}")
try:
    from services.license_manager import check_license_validity
except ImportError:
    import sys
    import os
    sys.path.append(os.path.join(os.path.dirname(__file__), "services"))
    from license_manager import check_license_validity

from sse_starlette.sse import EventSourceResponse
import asyncio
import threading
import time
import secrets
import datetime

# Global telemetry counters for diagnostics
stats = {
    "total_events": 0,
    "last_second_events": 0,
    "start_time": time.time()
}

# Real-time state caches to avoid DB bottleneck
pallet_cache = {}
forklift_cache = {}
pedestrian_cache = {}
alert_throttle = {} # (forklift_id, alert_type) -> last_time
active_queues = set()

# Background thread for periodic DB sync (Throttled to 0.5Hz to save I/O)
def db_sync_loop():
    while True:
        try:
            time.sleep(2.0)
            conn = sqlite3.connect(DB_PATH, timeout=10)
            # Use bigger timeout for SQLite to avoid locks
            conn.execute("PRAGMA busy_timeout = 3000") 
            cursor = conn.cursor()
            
            # Sync Forklifts
            for fid, data in list(forklift_cache.items()):
                cursor.execute("""
                    INSERT OR REPLACE INTO forklifts (id, location_x, location_y, location_z, status, battery, last_seen)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (fid, data['x'], data['y'], data['z'], data['status'], data.get('battery', 100.0)))
            
            # Sync Pallets
            for pid, data in list(pallet_cache.items()):
                cursor.execute("""
                    UPDATE pallets 
                    SET location_x = ?, location_y = ?, location_z = ?, last_seen = CURRENT_TIMESTAMP
                    WHERE pallet_id_tag = ?
                """, (data['x'], data['y'], data['z'], pid))
                
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"DB Sync Error: {e}")

# Start the sync thread
threading.Thread(target=db_sync_loop, daemon=True).start()

async def broadcast_event(data: dict):
    stats["total_events"] += 1
    if not active_queues:
        return
    
    msg = json.dumps(data)
    for q in list(active_queues):
        try:
            # Skip if queue is overwhelmed to maintain real-time
            if q.qsize() > 100: continue 
            q.put_nowait(msg) # No-wait for absolute speed
        except Exception:
            active_queues.remove(q)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SteelTrack Local Ingestion Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EdgeEvent(BaseModel):
    event_type: str
    pallet_id: str
    x: float
    y: float
    z: float
    timestamp: float
    alerts: Optional[List[str]] = []
    battery: Optional[float] = 100.0

@app.get("/")
async def root():
    is_ok, msg = check_license_validity()
    return {
        "status": "online" if is_ok else "restricted",
        "engine": "SteelTrack Hybrid V2",
        "license": msg
    }

def detect_fcfs_violation(pallet_id: str):
    """Checks if there is an older pallet with the same SKU still in the warehouse."""
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        
        # 1. Get current pallet's SKU and arrival date
        cursor.execute("SELECT product_name, arrival_timestamp FROM pallets WHERE pallet_id_tag = ?", (pallet_id,))
        current = cursor.fetchone()
        if not current or not current[0]:
            print(f"FCFS Auditor: Pallet {pallet_id} SKU not found in DB yet.")
            conn.close()
            return None
        
        sku, arrival_timestamp = current
        print(f"FCFS Auditor: Checking SKU {sku} for pallet {pallet_id} arrived at {arrival_timestamp}")
        
        # 2. Find if there's an older one of the same SKU that is still 'standard'
        cursor.execute("""
            SELECT pallet_id_tag, arrival_timestamp, location_x, location_y, location_z
            FROM pallets 
            WHERE product_name = ? 
              AND arrival_timestamp < ? 
              AND status = 'standard'
              AND pallet_id_tag != ?
            ORDER BY arrival_timestamp ASC 
            LIMIT 1
        """, (sku, arrival_timestamp, pallet_id))
        
        violation = cursor.fetchone()
        conn.close()
        
        if violation:
            print(f"FCFS VIOLATION! Older pallet {violation[0]} found (at X:{violation[2]} Y:{violation[3]})")
            return {
                "sku": sku,
                "current_pallet": pallet_id,
                "older_pallet": violation[0],
                "older_created_at": violation[1],
                "older_location": {
                    "x": violation[2],
                    "y": violation[3],
                    "z": violation[4]
                }
            }
    except Exception as e:
        print(f"FCFS Auditor Error: {e}")
    return None

@app.post("/events")
async def receive_event(event: EdgeEvent):
    start_time = time.time()
    fcfs_violation = None
    
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        
        # Track Z movement to detect "Lift" for FCFS check
        prev_z = pallet_cache.get(event.pallet_id, {}).get('z', 0)
        is_lifted = event.z > prev_z + 0.4 and event.event_type == "pallet"
        
        # 1. Update/Insert Pallet (Digital Twin)
        cursor.execute("""
            INSERT INTO pallets (pallet_id_tag, location_x, location_y, location_z, last_seen, status)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(pallet_id_tag) DO UPDATE SET
                location_x=excluded.location_x,
                location_y=excluded.location_y,
                location_z=excluded.location_z,
                last_seen=excluded.last_seen,
                status=excluded.status
        """, (event.pallet_id, event.x, event.y, event.z, "critical" if event.alerts else "stable"))
        
        if is_lifted:
            fcfs_violation = detect_fcfs_violation(event.pallet_id)
            if fcfs_violation:
                # Log violation to safety_events
                cursor.execute("""
                    INSERT INTO safety_events (event_type, severity, details, forklift_id)
                    VALUES (?, ?, ?, ?)
                """, ("FCFS_VIOLATION", "medium", json.dumps(fcfs_violation), "AUTO_AUDITOR"))
        
        # 2. Record Safety Events (with 5s throttle per forklift/alert)
        if event.alerts:
            now = time.time()
            for alert in event.alerts:
                throttle_key = (event.pallet_id, alert)
                last_time = alert_throttle.get(throttle_key, 0)
                
                if now - last_time > 5.0:
                    cursor.execute("""
                        INSERT INTO safety_events (event_type, severity, details, forklift_id)
                        VALUES (?, ?, ?, ?)
                    """, (alert, "high", json.dumps({"location": [event.x, event.y]}), event.pallet_id))
                    alert_throttle[throttle_key] = now
        
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Internal Database Error")

    # 3. Notify Connected UI (Real-time)
    # Non-blocking real-time broadcast and cache update
    if event.event_type == "forklift":
        forklift_cache[event.pallet_id] = {
            "x": event.x, "y": event.y, "z": event.z, "status": "active", "battery": event.battery
        }
    elif event.event_type == "pedestrian":
        pedestrian_cache[event.pallet_id] = {
            "x": event.x, "y": event.y, "z": event.z
        }
    else:
        # Update pallet cache, including status if alerts are present
        pallet_cache[event.pallet_id] = {
            "x": event.x, "y": event.y, "z": event.z, "status": "critical" if event.alerts else "stable"
        }

    # Broadast with potential FCFS violation
    await broadcast_event({
        "event_type": event.event_type,
        "id": event.pallet_id,
        "x": event.x,
        "y": event.y,
        "z": event.z,
        "alerts": event.alerts,
        "battery": event.battery,
        "fcfs_violation": fcfs_violation
    })

    process_time = (time.time() - start_time) * 1000
    return {
        "status": "synchronized",
        "ingestion_ms": f"{process_time:.2f}",
        "pallet": event.pallet_id
    }

@app.get("/pallets")
async def get_pallets():
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pallets")
        rows = cursor.fetchall()
        
        # Convert to list of dicts
        pallets = []
        for r in rows:
            pallets.append({
                "id": r[0],
                "pallet_id_tag": r[1],
                "product_name": r[2],
                "quantity_ai": r[3],
                "erp_quantity": r[4],
                "status": r[5],
                "location_x": r[6],
                "location_y": r[7],
                "location_z": r[8],
                "last_seen": r[9],
                "created_at": r[10]
            })
        conn.close()
        return pallets
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pallets/suggest/{sku}")
async def suggest_pallet(sku: str):
    """Returns the oldest non-finished pallet for a specific SKU (FCFS)."""
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pallet_id_tag, created_at, status 
            FROM pallets 
            WHERE (product_name = ? OR pallet_id_tag = ?) AND status != 'finished'
            ORDER BY created_at ASC 
            LIMIT 1
        """, (sku, sku))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "pallet_id": row[0],
                "created_at": row[1],
                "status": row[2],
                "priority": "FCFS_HIGH"
            }
        return {"message": "No priority pallets found for this SKU."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pallets/{pid}/status")
async def update_pallet_status(pid: str, data: dict):
    """Manually update pallet status (e.g., mark as finished or partial)."""
    try:
        new_status = data.get("status")
        if not new_status:
            raise HTTPException(status_code=400, detail="Missing 'status' in request body")
            
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("UPDATE pallets SET status = ? WHERE pallet_id_tag = ?", (new_status, pid))
        conn.commit()
        conn.close()
        
        # Invalidate cache
        if pid in pallet_cache:
            pallet_cache[pid]["status"] = new_status
            
        return {"status": "updated", "pallet": pid, "new_status": new_status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/forklifts")
async def get_forklifts():
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM forklifts")
        rows = cursor.fetchall()
        
        forklifts = []
        for r in rows:
            forklifts.append({
                "id": r[0],
                "location_x": r[1],
                "location_y": r[2],
                "location_z": r[3],
                "status": r[4],
                "battery": r[5]
            })
        conn.close()
        return forklifts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/safety-events")
async def get_safety_events():
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        # Get last 50 incidents
        cursor.execute("SELECT id, event_type, severity, timestamp, details, forklift_id FROM safety_events ORDER BY timestamp DESC LIMIT 50")
        rows = cursor.fetchall()
        events = []
        for r in rows:
            events.append({
                "id": r[0],
                "event_type": r[1],
                "severity": r[2],
                "timestamp": r[3],
                "details": json.loads(r[4]) if r[4] else {},
                "forklift_id": r[5]
            })
        conn.close()
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pedestrians")
async def get_pedestrians():
    return [{"id": k, "x": v["x"], "y": v["y"]} for k, v in pedestrian_cache.items()]

@app.get("/config/{key}")
async def get_config(key: str):
    """Retrieve a generic configuration value."""
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM configurations WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"key": key, "value": row[0]}
        return {"key": key, "value": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/config/{key}")
async def set_config(key: str, data: dict):
    """Store a generic configuration (e.g., mask_data)."""
    try:
        value = data.get("value")
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO configurations (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (key, value))
        conn.commit()
        conn.close()
        return {"status": "saved", "key": key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- DAILY STACKING PLANNER ENDPOINTS ---

@app.get("/incoming-stock")
async def get_incoming_stock():
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT id, sku, product_name, expected_quantity FROM incoming_stock")
        rows = cursor.fetchall()
        stock = [{"id": r[0], "sku": r[1], "product_name": r[2], "quantity": r[3]} for r in rows]
        conn.close()
        return stock
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/daily-plan/current")
async def get_current_plan():
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        
        # 1. Get today's plan
        today = datetime.date.today().isoformat()
        cursor.execute("SELECT id, token, expires_at FROM daily_plans WHERE date = ?", (today,))
        plan_row = cursor.fetchone()
        
        if not plan_row:
            # Create a new plan for today if it doesn't exist
            token = secrets.token_hex(16)
            expires = (datetime.datetime.now() + datetime.timedelta(hours=12)).isoformat()
            cursor.execute("INSERT INTO daily_plans (date, token, expires_at) VALUES (?, ?, ?)", (today, token, expires))
            conn.commit()
            plan_id = cursor.lastrowid
        else:
            plan_id, token, expires = plan_row
            
        # 2. Get assignments
        cursor.execute("SELECT sku, target_x, target_y, spot_id, status FROM plan_assignments WHERE plan_id = ?", (plan_id,))
        assignments = [{"sku": r[0], "x": r[1], "y": r[2], "spot_id": r[3], "status": r[4]} for r in cursor.fetchall()]
        
        conn.close()
        return {"id": plan_id, "date": today, "token": token, "expires_at": expires, "assignments": assignments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/daily-plan/assign")
async def assign_to_plan(data: dict):
    try:
        plan_id = data.get("plan_id")
        sku = data.get("sku")
        x = data.get("x")
        y = data.get("y")
        spot_id = data.get("spot_id")
        
        if not all([plan_id, sku]):
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        
        # If spot_id is None or 'CLEAR', we remove the assignment
        if not spot_id or spot_id == 'CLEAR':
            cursor.execute("DELETE FROM plan_assignments WHERE plan_id = ? AND sku = ?", (plan_id, sku))
            conn.commit()
            conn.close()
            return {"status": "unassigned"}

        # Upsert assignment (if SKU already in plan, update location)
        cursor.execute("""
            INSERT INTO plan_assignments (plan_id, sku, target_x, target_y, spot_id, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
            ON CONFLICT(plan_id, sku) DO UPDATE SET target_x=excluded.target_x, target_y=excluded.target_y, spot_id=excluded.spot_id
        """, (plan_id, sku, x, y, spot_id))
        
        conn.commit()
        conn.close()
        return {"status": "assigned"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/floor-spots")
async def get_floor_spots():
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, x, y, department FROM floor_spots")
        rows = cursor.fetchall()
        spots = [{"id": r[0], "name": r[1], "x": r[2], "y": r[3], "department": r[4]} for r in rows]
        conn.close()
        return spots
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/floor-spots")
async def create_floor_spot(data: dict):
    try:
        name = data.get("name")
        x = data.get("x")
        y = data.get("y")
        dept = data.get("department", "General")
        
        if x is None or y is None:
            raise HTTPException(status_code=400, detail="X and Y coordinates required")
            
        if not name:
            import secrets
            name = f"SPOT-{secrets.token_hex(2).upper()}"
            
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO floor_spots (name, x, y, department) VALUES (?, ?, ?, ?)", (name, x, y, dept))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        
        # Broadcast to all connected clients
        asyncio.create_task(broadcast_event({
            "event_type": "floor_spot_update",
            "action": "created",
            "id": new_id,
            "data": {"id": new_id, "name": name, "x": x, "y": y, "department": department}
        }))
        
        return {"status": "created", "id": new_id, "name": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/floor-spots/{id}")
async def update_floor_spot(id: str, data: dict):
    print(f">>> API: PUT /floor-spots/{id} with data: {data}")
    try:
        # Cast ID to int if possible, as DB uses integer PK
        try:
            db_id = int(id)
        except ValueError:
            db_id = id # Fallback for string IDs if any
            
        x = data.get("x")
        y = data.get("y")
        name = data.get("name")
        dept = data.get("department")
        
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()
        
        # Build update query dynamically
        updates = []
        params = []
        if x is not None:
            updates.append("x = ?")
            params.append(float(x))
        if y is not None:
            updates.append("y = ?")
            params.append(float(y))
        if name:
            updates.append("name = ?")
            params.append(name)
        if dept:
            updates.append("department = ?")
            params.append(dept)
            
        if not updates:
            conn.close()
            print(">>> API: No updates provided")
            return {"status": "no-change"}
            
        params.append(db_id)
        query = f"UPDATE floor_spots SET {', '.join(updates)} WHERE id = ?"
        print(f">>> API: Executing query: {query} with params {params}")
        cursor.execute(query, tuple(params))
        conn.commit()
        rows_affected = cursor.rowcount
        conn.close()
        
        # Broadcast to all connected clients
        # Broadcast the updated spot data to all clients
        asyncio.create_task(broadcast_event({
            "event_type": "floor_spot_update",
            "action": "updated",
            "id": db_id,
            "data": {"id": db_id, "x": x, "y": y, "name": name, "department": dept}
        }))
        
        print(f">>> API: Update complete. Rows affected: {rows_affected}")
        return {"status": "updated", "rows": rows_affected}
    except Exception as e:
        print(f">>> API ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stream")
async def event_stream():
    async def event_generator():
        q = asyncio.Queue()
        active_queues.add(q)
        try:
            while True:
                event = await q.get()
                yield {"data": event}
        except asyncio.CancelledError:
            active_queues.remove(q)
            raise

    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8085)
