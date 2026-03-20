import cv2
import numpy as np
import os

def create_simulated_world(bg_path, marker_dir, output_path):
    # Load background (Warehouse)
    bg = cv2.imread(bg_path)
    if bg is None:
        print("Background not found")
        return

    # Resize background to simulate 5.7K width (roughly 5760x2880)
    # For simulation purposes, let's use a manageable but high res like 3840x2160 (4K)
    bg = cv2.resize(bg, (3840, 2160))
    
    # Load a marker
    marker_path = os.path.join(marker_dir, "marker_0.png")
    marker = cv2.imread(marker_path)
    if marker is None:
        print("Marker not found")
        return
    
    # Simulate a small ArUco marker (50x50 pixels) for ~10-12m range
    marker_res = cv2.resize(marker, (50, 50))
    
    # --- SIMULATE MISALIGNMENT (TILT) ---
    # Rotate marker by 5 degrees
    rows, cols = marker_res.shape[:2]
    M = cv2.getRotationMatrix2D((cols/2, rows/2), 5, 1) 
    marker_res = cv2.warpAffine(marker_res, M, (cols, rows), borderValue=(255, 255, 255))
    
    # Paste marker at a specific location
    x, y = 1800, 1200
    bg[y:y+50, x:x+50] = marker_res
    
    # Add subtle blur to simulate realistic lens softness
    bg = cv2.GaussianBlur(bg, (3,3), 0)
    
    # --- SIMULATE IR ANCHORS (Localization) ---
    # These are high-intensity markers on the ceiling
    anchors = [(500, 100), (1500, 120), (2500, 100), (3500, 130)]
    for ax, ay in anchors:
        cv2.circle(bg, (ax, ay), 10, (255, 255, 255), -1)
        # Add a glow effect
        cv2.circle(bg, (ax, ay), 20, (200, 200, 200), 2)
    
    cv2.imwrite(output_path, bg)
    print(f"Simulated world saved to {output_path}")

if __name__ == "__main__":
    # Get the generated image path from environment or search
    # For now, I'll use a placeholder logic to find the latest .png in the artifact dir
    # But since I know the name, I'll search for it.
    bg_file = "C:/Users/andre/.gemini/antigravity/brain/23bf3da0-d588-4f16-a1ee-42a5a6036e28/warehouse_interior_sim_1773685941755.png"
    create_simulated_world(bg_file, "simulation/markers", "simulation/test_frame_57k.png")
