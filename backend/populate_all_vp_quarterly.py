import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb, json, os
from volume_profile_scanner import evaluate_volume_profile_rejections

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

vah_items = []
vah_fixed_items = []
poc_items = []
poc_fixed_items = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000: continue
    if curr_c < 10: continue
    
    vp_res = evaluate_volume_profile_rejections(ticker, df=group, lookback=63)
    if not vp_res: continue
    
    # 1. Rolling VAH
    if vp_res.get("vah"):
        vah_items.append({
            "ticker": ticker,
            "metric": vp_res["vah"]["metric"],
            "score": vp_res["vah"]["score"],
            "dollar_vol": dvol
        })
        
    # 2. Fixed VAH
    if vp_res.get("vah_fixed"):
        vah_fixed_items.append({
            "ticker": ticker,
            "metric": vp_res["vah_fixed"]["metric"],
            "score": vp_res["vah_fixed"]["score"],
            "dollar_vol": dvol
        })
        
    # 3. Rolling POC
    if vp_res.get("poc"):
        poc_items.append({
            "ticker": ticker,
            "metric": vp_res["poc"]["metric"],
            "score": vp_res["poc"]["score"],
            "dollar_vol": dvol
        })
        
    # 4. Fixed POC
    if vp_res.get("poc_fixed"):
        poc_fixed_items.append({
            "ticker": ticker,
            "metric": vp_res["poc_fixed"]["metric"],
            "score": vp_res["poc_fixed"]["score"],
            "dollar_vol": dvol
        })

# Sort by score descending, then dollar volume
vah_items.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)
vah_fixed_items.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)
poc_items.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)
poc_fixed_items.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)

print(f"Results: Rolling VAH={len(vah_items)}, Fixed VAH={len(vah_fixed_items)}, Rolling POC={len(poc_items)}, Fixed POC={len(poc_fixed_items)}")

for lst in [vah_items, vah_fixed_items, poc_items, poc_fixed_items]:
    for item in lst:
        item.pop("dollar_vol", None)

path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
with open(path) as f:
    data = json.load(f)

data["vah_rejection"] = vah_items[:50]
data["vah_rejection_fixed"] = vah_fixed_items[:50]
data["poc_rejection"] = poc_items[:50]
data["poc_rejection_fixed"] = poc_fixed_items[:50]

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print("Successfully updated public/screener_results.json with both Rolling and Fixed Quarterly VAH & POC rejections!")
