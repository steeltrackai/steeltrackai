import cv2
import numpy as np
import os

def generate_aruco_marker(marker_id, size=200):
    # Use standard 4x4 dictionary
    aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    marker_img = cv2.aruco.generateImageMarker(aruco_dict, marker_id, size)
    return marker_img

if __name__ == "__main__":
    output_dir = "simulation/markers"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Generate a few markers for testing
    for i in range(5):
        marker = generate_aruco_marker(i)
        cv2.imwrite(f"{output_dir}/marker_{i}.png", marker)
    print(f"Generated 5 ArUco markers in {output_dir}")
