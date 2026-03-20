import sqlite3
import os

DB_PATH = "local_server/store_twin.db"

def cleanup():
    if not os.path.exists(DB_PATH):
        print("Database not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Cleaning up database...")
    
    # 1. Clear forklifts (only kept ones are the standard fleet)
    cursor.execute("DELETE FROM forklifts WHERE id NOT IN ('FL-01', 'FL-02', 'VISION-PRO')")
    # Also clear them if they were fully wiped previously to ensure no stale data
    cursor.execute("DELETE FROM forklifts WHERE id LIKE 'ARUCO-%'")
    
    # 2. Clear miscategorized pallets
    zombie_ids = ['FL-01', 'FL-02', 'VISION-PRO', 'VISION-FL-01']
    for zid in zombie_ids:
        cursor.execute("DELETE FROM pallets WHERE pallet_id_tag = ?", (zid,))
    
    # 3. Reset standard pallets to starting positions
    standard_pallets = [
        ("ARUCO-101", 1.0, 2.0),
        ("ARUCO-102", 1.0, 6.0),
        ("ARUCO-103", 2.0, 2.0),
        ("ARUCO-104", 2.0, 6.0)
    ]
    
    for tag, x, y in standard_pallets:
        cursor.execute("""
            INSERT OR REPLACE INTO pallets (pallet_id_tag, location_x, location_y, location_z, status)
            VALUES (?, ?, ?, 0, 'stable')
        """, (tag, x, y))

    conn.commit()
    conn.close()
    print("Cleanup complete. Database is fresh.")

if __name__ == "__main__":
    cleanup()
