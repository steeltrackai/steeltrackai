import cv2
import numpy as np
import os
import time

# Mocking mediapipe for simulation environment stability
mp_face = None

class StaticMaskDetector:
    """Detects stable pixels over time to isolate the forklift structure."""
    def __init__(self, threshold=5, consensus_frames=10):
        self.accumulator = None
        self.frameCount = 0
        self.threshold = threshold
        self.consensus_frames = consensus_frames
        self.current_mask = None

    def update(self, frame):
        """Update the stability map with a new frame."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if self.accumulator is None:
            self.accumulator = gray.astype(np.float32)
            self.frameCount = 1
            return None

        # Simple temporal consensus: average difference
        # In a real system, we'd use variance or MOG2
        cv2.accumulateWeighted(gray.astype(np.float32), self.accumulator, 0.1)
        self.frameCount += 1

        if self.frameCount >= self.consensus_frames:
            # Pixels that are very close to the running average are 'static'
            # (In simulation, we assume motion is happening)
            diff = cv2.absdiff(gray, self.accumulator.astype(np.uint8))
            _, stable = cv2.threshold(diff, self.threshold, 255, cv2.THRESH_BINARY_INV)
            self.current_mask = stable
            return stable
        return None

    def apply_mask(self, frame, mask=None):
        """Apply the mask to the frame."""
        target_mask = mask if mask is not None else self.current_mask
        if target_mask is None:
            return frame
        
        # Ensure mask is same size
        if target_mask.shape[:2] != frame.shape[:2]:
            target_mask = cv2.resize(target_mask, (frame.shape[1], frame.shape[0]))
            
        return cv2.bitwise_and(frame, frame, mask=target_mask)

# Global instances for simulation
mask_detector = StaticMaskDetector()
active_mask = None

def process_frame(frame_input, crop_rect, calibration_mode=False):
    """
    Simulates the Edge Vision Pipeline:
    1. Apply Static Mask (Isolate Machine)
    2. Crop ROI & Sharpen
    3. Detect ArUco/IR
    """
    global active_mask
    start_time = time.time()
    
    # 1. Handle Input (Path or Array)
    if isinstance(frame_input, str):
        frame = cv2.imread(frame_input)
    else:
        frame = frame_input

    if frame is None:
        return {"error": "Image not found"}

    # 2. Dynamic Static Masking Logic
    if calibration_mode:
        new_mask = mask_detector.update(frame)
        if new_mask is not None:
            active_mask = new_mask # Calibration complete
            print("Calibration complete: Mask generated.")

    # Apply the mask (if it exists)
    masked_frame = mask_detector.apply_mask(frame, active_mask)

    # 3. Crop (Simulated ROI)
    x, y, w, h = crop_rect
    roi = masked_frame[y:y+h, x:x+w]
    
    # 4. Sharpening
    kernel = np.array([[-1,-1,-1], 
                       [-1, 9,-1],
                       [-1,-1,-1]])
    sharpened_roi = cv2.filter2D(roi, -1, kernel)
    
    # 5. Upscale and Detect
    processed_roi = cv2.resize(sharpened_roi, (0, 0), fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    parameters = cv2.aruco.DetectorParameters()
    parameters.minMarkerPerimeterRate = 0.01 
    detector = cv2.aruco.ArucoDetector(aruco_dict, parameters)
    
    corners, ids, rejected = detector.detectMarkers(processed_roi)
    
    detections = []
    alerts = []
    if ids is not None:
        for i, marker_corners in enumerate(corners):
            c = marker_corners[0]
            cx = float(np.mean(c[:, 0]))
            cy = float(np.mean(c[:, 1]))
            dy = c[1][1] - c[0][1]
            dx = c[1][0] - c[0][0]
            angle = np.degrees(np.arctan2(dy, dx))
            detections.append({"id": int(ids[i][0]), "center": (cx, cy), "angle": angle})
            if abs(angle) > 5.0:
                alerts.append(f"DANGER: Misaligned Load (Tilt: {angle:.2f}°)")

    # Safety: Person Detection (Mocked)
    if "person" in str(frame_input).lower():
        alerts.append("DANGER: Pedestrian in Blind Spot!")

    # Localization: IR Anchor Detection
    gray = cv2.cvtColor(masked_frame, cv2.COLOR_BGR2GRAY)
    top_region = gray[0:int(frame.shape[0]*0.2), :]
    _, thresh = cv2.threshold(top_region, 240, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    anchors_found = []
    for cnt in contours:
        M = cv2.moments(cnt)
        if M["m00"] > 0:
            cx_a = int(M["m10"] / M["m00"])
            cy_a = int(M["m01"] / M["m00"])
            anchors_found.append((cx_a, cy_a))
    
    end_time = time.time()
    processing_ms = (end_time - start_time) * 1000
    
    results = {
        "detections": detections,
        "processing_time_ms": processing_ms,
        "alerts": alerts,
        "status": "SAFE" if not alerts else "CRITICAL",
        "mask_active": active_mask is not None
    }

    if anchors_found:
        results["anchors_count"] = len(anchors_found)
    
    return results

if __name__ == "__main__":
    frame_path = "simulation/test_frame_57k.png"
    # ROI for the marker we placed at (1800, 1200) in create_world.py
    # We'll give it some padding
    crop_rect = (1780, 1180, 100, 100) 
    
    if not os.path.exists(frame_path):
        print(f"Test frame {frame_path} not found. Run create_world.py first.")
    else:
        results = process_frame(frame_path, crop_rect)
        print(f"Results: {results}")
        if results.get("detections"):
            print("✅ SUCCESS: ArUco Marker Detected!")
        else:
            print("❌ FAILURE: ArUco Marker Not Detected.")
