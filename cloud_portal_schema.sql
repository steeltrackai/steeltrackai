-- SteelTrack Cloud Admin Portal - Supabase Schema

-- 1. Clients Table (Supermarket Chains / Owners)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    contact_email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Licenses Table
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id),
    license_key TEXT UNIQUE NOT NULL, -- e.g., STEEL_ACTIVE_2026_MARCH
    issue_date TIMESTAMP DEFAULT NOW(),
    expiry_date TIMESTAMP NOT NULL,
    status TEXT DEFAULT 'active', -- active, expired, revoked
    last_validation TIMESTAMP -- When the local server last called home
);

-- 3. Update Registry (OTA Updates)
CREATE TABLE system_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_tag TEXT NOT NULL, -- e.g., v2.0.1
    release_notes TEXT,
    payload_url TEXT, -- URL to download the update (S3/Supabase Storage)
    is_critical BOOLEAN DEFAULT FALSE,
    released_at TIMESTAMP DEFAULT NOW()
);

-- 4. Device Inventory (Whitelisting Mini PCs/Tablets)
CREATE TABLE device_whitelists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id),
    mac_address TEXT UNIQUE NOT NULL,
    hardware_id TEXT UNIQUE NOT NULL,
    device_type TEXT NOT NULL, -- 'MINI_PC' or 'TABLET'
    registered_at TIMESTAMP DEFAULT NOW()
);
