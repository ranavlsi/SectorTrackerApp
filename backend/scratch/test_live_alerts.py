import json

path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/rs_scanner_results.json'

with open(path, 'r') as f:
    data = json.load(f)

# Mock two stocks that exist in intraday_live.parquet
data['results'].insert(0, {
    "ticker": "AAPL",
    "rs_rating": 99,
    "pattern_status": "c_and_h",
    "pattern_details": {
        "breakout_trigger": 50.0 # AAPL is way above this, will trigger immediately
    },
    "zacks_rank": 1,
    "price": 190.0,
    "rs_badge": "12M RS High",
    "adr_pct": 5.0,
    "sparkline": [1, 2, 3]
})

with open(path, 'w') as f:
    json.dump(data, f)
    
print("Injected AAPL breakout trigger!")
