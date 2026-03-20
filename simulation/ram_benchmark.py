import os
import psutil
import time

def benchmark_ram_sim():
    process = psutil.Process(os.getpid())
    base_mem = process.memory_info().rss / (1024 * 1024)
    print(f"Base RAM usage: {base_mem:.2f} MB")
    
    print("--- SIMULATING LLAMA 3.2 VISION 4-BIT LOAD ---")
    # Simulate loading ~3.5GB of weights into RAM
    # We'll just allocate some memory in a list to see the impact
    try:
        dummy_data = []
        # Allocate roughly 3.5GB (3584 MB)
        # Each element in a list of bytes is roughly 1 byte
        # But list overhead is real. Let's use a bytearray.
        alloc_size = 3584 * 1024 * 1024
        weights = bytearray(alloc_size)
        
        current_mem = process.memory_info().rss / (1024 * 1024)
        print(f"Memory with 'Model' loaded: {current_mem:.2f} MB")
        
        available_mem = psutil.virtual_memory().available / (1024 * 1024)
        print(f"System RAM remaining: {available_mem:.2f} MB")
        
        if available_mem > 1024:
            print("✅ SUCCESS: Model fits comfortably with >1GB head room for OS/Vision.")
        else:
            print("⚠️ WARNING: Memory pressure high. Optimization strictly required.")
            
        time.sleep(2) # Hold it for a bit
        del weights
        
    except MemoryError:
        print("❌ FAILURE: Out of Memory during allocation.")

if __name__ == "__main__":
    benchmark_ram_sim()
