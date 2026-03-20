import sqlite3
import os

DB_PATH = "local_server/store_twin.db"

def describe_db():
    if not os.path.exists(DB_PATH):
        print(f"File not found: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    for table_name in [('plan_assignments',)]:
        print(f"\nTable: {table_name[0]}")
        cursor.execute(f"PRAGMA table_info({table_name[0]});")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
    
    conn.close()

if __name__ == "__main__":
    describe_db()
