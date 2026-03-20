from local_server.main import app
import uvicorn
import traceback

print("Attempting to run server manually for diagnostics...")
try:
    uvicorn.run(app, host="127.0.0.1", port=8085, log_level="debug")
except Exception as e:
    print(f"FAILED TO START SERVER: {e}")
    traceback.print_exc()
