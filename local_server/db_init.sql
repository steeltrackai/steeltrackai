-- Local Schema for Store Server (Digital Twin)
-- This mirrors the cloud schema but optimized for local ingestion

CREATE TABLE IF NOT EXISTS pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pallet_id_tag TEXT UNIQUE NOT NULL, -- The ArUco or Label ID
    product_name TEXT,
    quantity_ai INTEGER DEFAULT 0,
    erp_quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'stable', 'misaligned', 'missing'
    location_x FLOAT,
    location_y FLOAT,
    location_z FLOAT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    vector_id TEXT -- Reference to Qdrant vector
);

CREATE TABLE IF NOT EXISTS safety_events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'pedestrian_alert', 'misalignment'
    severity TEXT, -- 'critical', 'warning'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    last_cloud_sync TIMESTAMP WITH TIME ZONE,
    status TEXT
);
