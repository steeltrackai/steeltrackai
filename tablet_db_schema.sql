-- SteelTrack AI - Tablet Local Buffer Schema (SQLite)
-- Purpose: Store events locally when Wi-Fi is unstable and sync when connection is restored.

CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'pick', 'drop', 'scan', 'incident'
    pallet_id_tag TEXT,      -- ArUco ID or SKU name
    x REAL,                  -- Local XYZ from V-SLAM
    y REAL,
    z REAL,
    image_snippet_path TEXT, -- Path to the cropped 8K image for visual audit
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    sync_status INTEGER DEFAULT 0 -- 0: Pending, 1: Synced to Local Server
);

-- Index for faster sync lookups
CREATE INDEX IF NOT EXISTS idx_sync_status ON event_log(sync_status);
