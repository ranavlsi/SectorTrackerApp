import json

with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json', 'r') as f:
    data = json.load(f)
    
if "low_volume_breakout" in data:
    stocks = data["low_volume_breakout"]
    print(f"Found {len(stocks)} stealthy breakouts.")
    for item in stocks[:5]:
        print(item)
else:
    print("Key 'low_volume_breakout' not found.")
