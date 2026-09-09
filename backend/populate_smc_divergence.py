import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb, json, os
from divergence_reversal_scanner import evaluate_divergence_reversal

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

matches = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000 or curr_c < 10: continue
    
    res = evaluate_divergence_reversal(ticker, df=group)
    if res:
        matches.append({
            "ticker": ticker,
            "metric": str(res["metric"]),
            "score": float(res["score"]),
            "dollar_vol": float(dvol)
        })

matches.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)
print(f"Generated {len(matches)} SMC Divergence Reversals with Liquidity Grabs and CHoCH")

for item in matches:
    item.pop("dollar_vol", None)

path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
with open(path) as f:
    data = json.load(f)

data["smc_divergence_reversal"] = matches[:50]

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print("Successfully updated public/screener_results.json with smc_divergence_reversal category!")
