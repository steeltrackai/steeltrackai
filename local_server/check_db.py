import sqlite3
import json

DB_PATH = "local_server/store_twin.db"

def check_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("--- PALLETS IN DIGITAL TWIN ---")
    cursor.execute("SELECT * FROM pallets")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
        
    print("\n--- SAFETY EVENTS ---")
    cursor.execute("SELECT * FROM safety_events")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
        
    conn.close()

if __name__ == "__main__":
    check_db()
