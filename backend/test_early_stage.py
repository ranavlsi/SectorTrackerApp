import json

with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json', 'r') as f:
    data = json.load(f)
    
if "early_stage_2" in data:
    for item in data["early_stage_2"]:
        print(item)
