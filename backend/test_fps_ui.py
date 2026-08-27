import json

with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json', 'r') as f:
    data = json.load(f)
    
if "breakout_retest" in data:
    for item in data["breakout_retest"]:
        if item.get("ticker") == "FPS":
            print(f"FOUND FPS: {item}")
else:
    print("No breakout_retest key found")
