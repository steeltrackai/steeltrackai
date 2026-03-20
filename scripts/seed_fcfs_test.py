import sqlite3
import time
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.getcwd(), "local_server", "store_twin.db")

def seed_fcfs():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Ensure arrival_timestamp exists
    try:
        cursor.execute("ALTER TABLE pallets ADD COLUMN arrival_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        print("Column 'arrival_timestamp' added.")
    except sqlite3.OperationalError:
        print("Column 'arrival_timestamp' already exists.")

    # 1. Clean existing pallets to avoid confusion
    cursor.execute("DELETE FROM pallets WHERE (product_name = 'Arroz Tio Joao') OR (pallet_id_tag IN ('PAL-OLD-001', 'PAL-YOUNG-002'))")
    
    # 2. Insert Oldest Pallet (Priority)
    old_time = (datetime.now() - timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        INSERT INTO pallets (pallet_id_tag, product_name, arrival_timestamp, location_x, location_y, location_z, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, ("PAL-OLD-001", "Arroz Tio Joao", old_time, 2.0, 3.0, 0.5, "standard"))
    
    # 3. Insert Younger Pallet (The one we will 'wrongly' pick)
    young_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute("""
        INSERT INTO pallets (pallet_id_tag, product_name, arrival_timestamp, location_x, location_y, location_z, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, ("PAL-YOUNG-002", "Arroz Tio Joao", young_time, 2.0, 5.0, 0.5, "standard"))
    
    conn.commit()
    conn.close()
    print("✅ Seeded 2 pallets for SKU 'Arroz Tio Joao'.")
    print("Priority: PAL-OLD-001")
    print("Test Violation by picking: PAL-YOUNG-002")

if __name__ == "__main__":
    seed_fcfs()
