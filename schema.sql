-- SteelTrack AI - Advanced Database Schema
-- Version: 1.2

-- Enable Vector Extension for visual similarity search (Gemini AI)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Locations Table (Base for Digital Twin)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., 'A-01-01' or 'Zone Floor D'
    type TEXT CHECK (type IN ('steel', 'floor', 'dock')),
    x INTEGER, -- Map coordinates for Digital Twin
    y INTEGER,
    z INTEGER DEFAULT 0, -- Level Height
    metadata JSONB, -- For shelf limits, specific department data, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pallets Table (Inventory & AI)
CREATE TABLE IF NOT EXISTS pallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pallet_id_tag TEXT UNIQUE NOT NULL, -- The ArUco/QR hash (Opaque ID)
    sku_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    erp_quantity INTEGER DEFAULT 0, -- What the ERP says should be there
    status TEXT DEFAULT 'standard', -- standard, near_expiry, partial, finished
    expiry_date DATE,
    image_url TEXT, -- Reference to Supabase Storage for visual audit
    embedding vector(768), -- For visual similarity search (Gemini embeddings)
    current_location_id UUID REFERENCES locations(id), -- Real-time tracking
    last_scanned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Activities Table (Digital Signature & movement Log)
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pallet_id UUID REFERENCES pallets(id),
    location_id UUID REFERENCES locations(id),
    forklift_id TEXT, -- Tablet/Forklift identifier
    driver_id UUID, -- Reference to Auth.users
    event_type TEXT CHECK (event_type IN ('pick', 'drop', 'scan', 'incident')),
    signature_metadata JSONB, -- {gps: "...", ip: "...", device_id: "..."}
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tasks Table (Workflow Management)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
    priority INTEGER DEFAULT 1,
    assigned_to TEXT, -- Forklift ID or Driver ID
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Warehouse Layout (JSON blob for Map Editor persistence)
CREATE TABLE IF NOT EXISTS warehouse_layout (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Forklift Telemetry (Real-time monitoring)
CREATE TABLE IF NOT EXISTS forklift_status (
    id TEXT PRIMARY KEY, -- Device ID
    battery_level INTEGER,
    is_online BOOLEAN,
    last_ping TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE forklift_status ENABLE ROW LEVEL SECURITY;

-- Allow ALL users (including anonymous) for testing/initial setup
-- WARNING: In production, change 'public' to 'authenticated' and use Supabase Auth.
CREATE POLICY "Allow public access" ON pallets FOR ALL USING (true);
CREATE POLICY "Allow public access" ON locations FOR ALL USING (true);
CREATE POLICY "Allow public access" ON activities FOR ALL USING (true);
CREATE POLICY "Allow public access" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public access" ON warehouse_layout FOR ALL USING (true);
CREATE POLICY "Allow public access" ON forklift_status FOR ALL USING (true);
