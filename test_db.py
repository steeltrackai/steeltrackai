import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_server", "store_twin.db")
print(f"Testing connection to {DB_PATH}")
try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"Success! Found tables: {tables}")
    conn.close()
except Exception as e:
    print(f"Failed! Error: {e}")
