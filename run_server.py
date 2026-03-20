import os
import sys
import uvicorn

# Ensure the root and local_server are in the path
root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(root_dir)
sys.path.append(os.path.join(root_dir, "local_server"))

if __name__ == "__main__":
    # Import the app safely
    from local_server.main import app
    print("SteelTrack Local Server starting on port 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8080)
