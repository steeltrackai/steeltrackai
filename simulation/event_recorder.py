import sqlite3
import os
from datetime import datetime

DB_PATH = "simulation/tablet_buffer.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Using the schema we defined earlier
    with open("tablet_db_schema.sql", "r") as f:
        cursor.executescript(f.read())
    conn.commit()
    conn.close()
    print(f"Local SQLite database initialized at {DB_PATH}")

def record_event(event_type, pallet_id, x, y, z):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO event_log (event_type, pallet_id_tag, x, y, z, sync_status)
        VALUES (?, ?, ?, ?, ?, 0)
    """, (event_type, pallet_id, x, y, z))
    conn.commit()
    event_id = cursor.lastrowid
    conn.close()
    return event_id

def get_pending_events():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM event_log WHERE sync_status = 0")
    events = cursor.fetchall()
    conn.close()
    return events

if __name__ == "__main__":
    if not os.path.exists(DB_PATH):
        init_db()
    
    # Test recording
    eid = record_event("scan", "PLT-777", 10.5, 4.2, 0.0)
    print(f"Recorded test event with ID: {eid}")
