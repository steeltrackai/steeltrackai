import requests
import time

URL = "http://localhost:8080/events"

def simulate_wrong_pick():
    # 1. First, ensure the pallet is 'at rest' (Z=0.5)
    requests.post(URL, json={
        "event_type": "pallet",
        "pallet_id": "PAL-YOUNG-002",
        "x": 2.0, "y": 5.0, "z": 0.5,
        "timestamp": time.time()
    })
    
    print("Pallet PAL-YOUNG-002 at rest. Preparando 'lift'...")
    time.sleep(2)
    
    # 2. Simulate Lift (Z increase)
    # This triggers is_lifted = event.z > prev_z + 0.4
    print("🚀 Triggering LIFT for PAL-YOUNG-002 (Wrong Rotation)...")
    resp = requests.post(URL, json={
        "event_type": "pallet",
        "pallet_id": "PAL-YOUNG-002",
        "x": 2.0, "y": 5.0, "z": 1.5, # LIFTED!
        "timestamp": time.time()
    })
    
    if resp.status_code == 200:
        print("✅ Evento enviado com sucesso.")
        print("Verifique o Admin Dashboard para o Alerta Vermelho de Violação FCFS!")
    else:
        print(f"❌ Erro ao enviar evento: {resp.text}")

if __name__ == "__main__":
    simulate_wrong_pick()
