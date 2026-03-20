import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "store_twin.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Core Store Infrastructure
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            name TEXT,
            x FLOAT,
            y FLOAT,
            width FLOAT,
            height FLOAT,
            type TEXT,
            levels INTEGER DEFAULT 1,
            slots INTEGER DEFAULT 1,
            rotation FLOAT DEFAULT 0,
            color TEXT
        )
    """)

    # Real-time State
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pallet_id_tag TEXT UNIQUE,
            product_name TEXT,
            sku TEXT,
            location_x FLOAT,
            location_y FLOAT,
            location_z FLOAT,
            status TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS forklifts (
            id TEXT PRIMARY KEY,
            location_x FLOAT,
            location_y FLOAT,
            battery INTEGER,
            status TEXT,
            current_operator TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pedestrians (
            id TEXT PRIMARY KEY,
            location_x FLOAT,
            location_y FLOAT,
            role TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Daily Plans (Master)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE DEFAULT CURRENT_DATE,
            shift TEXT,
            manager_name TEXT,
            status TEXT DEFAULT 'active'
        )
    """)

    # Plan Assignments (The drag-and-drop results)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plan_id INTEGER,
            sku TEXT NOT NULL,
            target_x FLOAT,
            target_y FLOAT,
            target_z FLOAT DEFAULT 0.0,
            spot_id TEXT,
            status TEXT DEFAULT 'pending',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(plan_id, sku),
            FOREIGN KEY(plan_id) REFERENCES daily_plans(id)
        )
    """)

    # Floor Spots (Dynamic drop zones)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS floor_spots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            x FLOAT NOT NULL,
            y FLOAT NOT NULL,
            department TEXT DEFAULT 'General',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
