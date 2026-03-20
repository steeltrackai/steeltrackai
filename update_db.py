import sqlite3
import os

db_path = 'local_server/store_twin.db'
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Pallet Inside Rack A1 - Ground
# Aisle A1 in 2D is X:200..600, Y:100..160
# In units (PIXELS_PER_METER=50): X:4..12, Y:2..3.2
# Center is X:8, Y:2.6
cursor.execute('UPDATE pallets SET location_x=8.0, location_y=2.6, location_z=0, status="stable" WHERE pallet_id_tag="ARUCO-101"')

# Pallet Inside Rack A1 - Level 3
cursor.execute('UPDATE pallets SET location_x=8.0, location_y=2.6, location_z=3, status="stable" WHERE pallet_id_tag="ARUCO-102"')

# Red box grounded outside
cursor.execute('UPDATE pallets SET location_x=2.0, location_y=4.0, location_z=0, status="critical" WHERE pallet_id_tag="ARUCO-0"')

conn.commit()
print("Database updated with precise center coordinates.")
conn.close()
