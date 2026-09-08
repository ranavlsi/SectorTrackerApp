import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb, json, os
from volume_profile_scanner import evaluate_volume_profile_rejections

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

vah_items = []
poc_items = []
val_items = []
val_fixed_items = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000: continue
    if curr_c < 10: continue
    
    vp_res = evaluate_volume_profile_rejections(ticker, df=group, lookback=63)
    if not vp_res: continue
    
    if vp_res.get("vah"):
        vah_items.append({
            "ticker": ticker,
            "metric": vp_res["vah"]["metric"],
            "score": vp_res["vah"]["score"],
            "dollar_vol": dvol
        })
        
    if vp_res.get("poc"):
        poc_items.append({
            "ticker": ticker,
            "metric": vp_res["poc"]["metric"],
            "score": vp_res["poc"]["score"],
            "dollar_vol": dvol
        })
        
    val_data = vp_res.get("val")
    if val_data:
        if val_data.get("rolling_message"):
            val_items.append({
                "ticker": ticker,
                "metric": val_data["rolling_message"],
                "score": val_data.get("score", 85.0),
                "dollar_vol": dvol
            })
        if val_data.get("fixed_message"):
            val_fixed_items.append({
                "ticker": ticker,
                "metric": val_data["fixed_message"],
                "score": val_data.get("score", 85.0),
                "dollar_vol": dvol
            })

# Sort by score descending, then dollar volume
vah_items.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)
poc_items.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)

print(f"Generated {len(vah_items)} VAH rejections, {len(poc_items)} POC rejections")

# Clean dollar_vol from saved payload
for item in vah_items: item.pop("dollar_vol", None)
for item in poc_items: item.pop("dollar_vol", None)

path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
with open(path) as f:
    data = json.load(f)

data["vah_rejection"] = vah_items[:50]
data["poc_rejection"] = poc_items[:50]

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print("Updated public/screener_results.json with VAH and POC rejections successfully!")
