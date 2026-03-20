#!/bin/bash
# SteelTrack AI - Supermarket Server One-Click Setup
# This script installs the Local Ingestion Engine and Manager Dashboard on an Intel N100 / Mini PC.

echo "🚀 Starting SteelTrack AI Local Server Setup..."

# 1. Update system and install Python/Node
sudo apt-get update && sudo apt-get install -y python3-pip nodejs npm sqlite3

# 2. Clone/Extract the Bundle
# (Assuming the bundle is already on the machine)
pip3 install -r requirements.txt
npm install

# 3. Initialize the Digital Twin (SQLite)
python3 local_server/db_manager.py # This creates the schema

# 4. Start the Services
echo "📦 Services starting..."
# Run backend in background
python3 run_server.py &
# Run frontend
npm run preview -- --port 80 --host 0.0.0.0

echo "✅ Setup Complete. Access the dashboard at http://localhost"
