import os
import requests
import time

# Mock License Config (Simulating Supabase/Auth)
LICENSE_SERVER = "https://mock-billing.steeltrack.ai/validate"
LOCAL_LICENSE_FILE = "local_server/license_token.txt"

def check_license_validity():
    """
    Validates the supermarket license with the SteelTrack Cloud Portal.
    No inventory data is sent, only the license key.
    """
    if not os.path.exists(LOCAL_LICENSE_FILE):
        return False, "License Token Missing"
    
    with open(LOCAL_LICENSE_FILE, 'r') as f:
        token = f.read().strip()
    
    # In a real scenario, this would call Supabase
    # For simulation, we'll return True if token starts with 'STEEL'
    if token.startswith("STEEL_ACTIVE_"):
        return True, "License Validated with SteelTrack Portal"
    else:
        return False, "Invalid License or Expired Subscription"

def get_latest_updates():
    """
    Checks for new AI models (e.g. Llama coefficients) or system fixes.
    """
    # Simply returns a hardcoded version for simulation
    return {"version": "2.0.1", "notes": "Optimized ArUco detection at 12m"}

if __name__ == "__main__":
    # Create a mock license for the first run
    if not os.path.exists(LOCAL_LICENSE_FILE):
        with open(LOCAL_LICENSE_FILE, 'w') as f:
            f.write("STEEL_ACTIVE_2026_MARCH")
    
    is_valid, msg = check_license_validity()
    print(f"Status: {msg}")
