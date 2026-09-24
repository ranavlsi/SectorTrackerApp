import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb, json, os
from divergence_reversal_scanner import evaluate_divergence_reversal

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

div_matches = []
sma_matches = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 12_000_000 or curr_c < 10: 
        continue
    
    res = evaluate_divergence_reversal(ticker, df=group)
    if res:
        # Category 1: Pure RSI Divergence + Liquidity Grab + CHoCH
        if res.get("has_bull_div"):
            div_matches.append({
                "ticker": ticker,
                "metric": f"🔥 Confluence: RSI Div (+{res['div_pts']}pts) + 200W-SMA (${res['sma200_w']:.2f}) + CHoCH" if res.get("is_confluence") else f"{res['pattern']} | +{res['div_pts']}pts RSI Div",
                "score": float(res["score"]),
                "dollar_vol": float(dvol),
                "is_confluence": bool(res.get("is_confluence")),
                "price": float(res["price"])
            })
            
        # Category 2: 200-Weekly SMA Defense + Liquidity Grab + CHoCH
        if res.get("has_200w_touch"):
            sma_matches.append({
                "ticker": ticker,
                "metric": f"🔥 Confluence: 200W-SMA (${res['sma200_w']:.2f}) + RSI Div (+{res['div_pts']}pts) + CHoCH" if res.get("is_confluence") else f"200W-SMA (${res['sma200_w']:.2f}) Defense + {res['pattern'].split(' + ')[-1]}",
                "score": float(res["score"]),
                "dollar_vol": float(dvol),
                "is_confluence": bool(res.get("is_confluence")),
                "price": float(res["price"])
            })

# Prioritize pure RSI Divergence stocks (those WITHOUT 200W-SMA confluence) at the top per user request
div_matches.sort(key=lambda x: (0 if x.get("is_confluence") else 1, x["score"], x["dollar_vol"]), reverse=True)
sma_matches.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)

print(f"Generated {len(div_matches)} Pure RSI Divergence Setups")
print(f"Generated {len(sma_matches)} 200-Weekly SMA Defense Setups")

for item in div_matches:
    item.pop("dollar_vol", None)
for item in sma_matches:
    item.pop("dollar_vol", None)

path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
with open(path) as f:
    data = json.load(f)

data["smc_divergence_reversal"] = div_matches[:50]
data["smc_200w_sma_reversal"] = sma_matches[:50]

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print("Successfully updated public/screener_results.json with both separate SMC categories!")
