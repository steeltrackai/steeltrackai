import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "local_server", "store_twin.db")

def reset_db():
    if os.path.exists(DB_PATH):
        # os.remove(DB_PATH) 
        print(f"Skipping deletion of existing DB at {DB_PATH} to preserve user changes.")
        # return # If we return here, we won't re-seed. Let's just not delete.

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Creating tables...")
    
    # Core Infrastructure
    cursor.execute("""
        CREATE TABLE blocks (
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

    cursor.execute("""
        CREATE TABLE daily_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE DEFAULT CURRENT_DATE,
            shift TEXT,
            manager_name TEXT,
            token TEXT UNIQUE,
            expires_at TIMESTAMP,
            status TEXT DEFAULT 'active'
        )
    """)

    cursor.execute("""
        CREATE TABLE plan_assignments (
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

    cursor.execute("""
        CREATE TABLE floor_spots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            x FLOAT NOT NULL,
            y FLOAT NOT NULL,
            department TEXT DEFAULT 'General',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE pallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pallet_id_tag TEXT UNIQUE NOT NULL,
            product_name TEXT,
            quantity_ai INTEGER DEFAULT 0,
            erp_quantity INTEGER DEFAULT 0,
            status TEXT DEFAULT 'standard',
            location_x FLOAT,
            location_y FLOAT,
            location_z FLOAT DEFAULT 0.0,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE forklifts (
            id TEXT PRIMARY KEY,
            location_x FLOAT NOT NULL,
            location_y FLOAT NOT NULL,
            location_z FLOAT DEFAULT 0.0,
            status TEXT DEFAULT 'idle',
            battery FLOAT DEFAULT 100.0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE safety_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            details TEXT,
            forklift_id TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


    # Stock Data (Simplified for Daily Planner)
    cursor.execute("""
        CREATE TABLE incoming_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT,
            product_name TEXT,
            expected_quantity INTEGER,
            expected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'available'
        )
    """)

    # Check if we already have spots/pallets before seeding
    cursor.execute("SELECT count(*) FROM floor_spots")
    has_data = cursor.fetchone()[0] > 0

    if not has_data:
        # 3. Seed test data
        print("Seeding test data as DB is empty...")
        import secrets
        import datetime
        test_token = secrets.token_hex(8)
        expires_at = (datetime.datetime.now() + datetime.timedelta(hours=8)).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("INSERT INTO daily_plans (shift, manager_name, token, expires_at) VALUES ('Morning', 'Admin', ?, ?)", (test_token, expires_at))
        plan_id = cursor.lastrowid
        print(f"Created active plan with token: {test_token} (expires at {expires_at})")

        items = [
            ('SKU-MILK-001', 'Fresh Milk 2L', 48),
            ('SKU-WATER-005', 'Mineral Water 500ml', 120),
            ('SKU-EGGS-012', 'Free Range Eggs x12', 36),
            ('SKU-BREAD-001', 'Wholemeal Bread', 24)
        ]
        cursor.executemany("INSERT INTO incoming_stock (sku, product_name, expected_quantity) VALUES (?, ?, ?)", items)

        # Some initial spots
        spots = [
            ('SPOT-A1', 12.0, 8.0, 'Produce'),
            ('SPOT-A2', 13.5, 8.0, 'Produce'),
            ('SPOT-B1', 12.0, 10.0, 'Dairy')
        ]
        cursor.executemany("INSERT INTO floor_spots (name, x, y, department) VALUES (?, ?, ?, ?)", spots)

        # Some test pallets
        pallets = [
            ('PAL-001', 'Fresh Milk 2L', 48, 48, 'standard', 12.0, 8.0, 0.0),
            ('PAL-002', 'Mineral Water 500ml', 120, 120, 'standard', 13.5, 8.0, 0.0)
        ]
        cursor.executemany("""
            INSERT INTO pallets (pallet_id_tag, product_name, quantity_ai, erp_quantity, status, location_x, location_y, location_z)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, pallets)
        print("Seed Complete.")
    else:
        print("DB already has data. Skipping seed to preserve user changes.")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    reset_db()
