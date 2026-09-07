import json

with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/deepvue_results.json', 'r') as f:
    d = json.load(f)
    print("Leaders count:", len(d.get("leaders", [])))
    print("VCP count:", len(d.get("active_vcp", [])))
