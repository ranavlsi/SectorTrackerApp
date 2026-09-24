import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb, json, os
from deepvue_launchpad_scanner import evaluate_deepvue_launchpad

ETF_BLOCKLIST = {
    'SPY', 'QQQ', 'DIA', 'IWM', 'SMH', 'XLF', 'XLE', 'XLK', 'XLV', 'XLY', 'XLI', 'XLU', 'XLP', 'XLB', 'XLC', 'XRE', 'XRT', 'XBI', 'IBB', 'KRE', 'KBE', 'GDX', 'GDXJ', 'GLD', 'SLV', 'USO', 'UNG', 'TLT', 'TMF', 'HYG', 'JNK', 'LQD', 'BND', 'AGG', 'VTI', 'VOO', 'VEA', 'VWO', 'EEM', 'EFA', 'ARKK', 'ARKG', 'ARKW', 'ARKF', 'ARKQ',
    'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'UPRO', 'SPXU', 'TNA', 'TZA', 'UDOW', 'SDOW', 'URTY', 'SRTY', 'FAS', 'FAZ', 'LABU', 'LABD', 'NUGT', 'DUST', 'JNUG', 'JDST', 'UCO', 'SCO', 'BOIL', 'KOLD', 'YINN', 'YANG', 'CWEB', 'KWEB', 'FXI', 'GUSH', 'DRIP', 'ERX', 'ERY', 'TECL', 'TECS', 'WEBL', 'WEBS', 'FNGU', 'FNGD', 'BULZ', 'BERZ', 'DPST', 'NAIL', 'RETL', 'CURE', 'DFEN', 'HIBL', 'HIBS', 'MIDU', 'PILL', 'SPXL', 'SPXS', 'SPYU', 'TDF', 'TYD', 'TYO', 'UBOT', 'UTSL', 'WANT', 'BITU', 'SBIT', 'CONL', 'NVDL', 'NVD', 'TSLL', 'TSLQ', 'TSLR', 'AMZU', 'AMZD', 'GGLL', 'GGLS', 'AAPU', 'AAPD', 'MSFU', 'MSFD', 'UVXY', 'VIXY', 'SVIX', 'BITO', 'IBIT', 'FBTC', 'ARKB', 'BITB', 'EZBC', 'BRRR', 'HODL', 'BTCW', 'GBTC',
    'EWN', 'EWI', 'DXJ', 'CWB', 'IYF', 'RPG', 'BBJP', 'IEFA', 'IEMG', 'IJH', 'IJR', 'IWF', 'IWD', 'EWT', 'EWY', 'EWG', 'EWU', 'EWC', 'EWH', 'EWZ', 'RSX', 'EWW', 'INDA', 'MCHI', 'KBA', 'ASHR', 'VEU', 'VXUS', 'BKLN', 'SHV', 'BIL', 'SHY', 'IEI', 'IEF', 'TLH', 'GOVT', 'MBB', 'VCIT', 'VCSH', 'VT', 'SCHD', 'VIG', 'VYM', 'JEPI', 'JEPQ', 'DGRO', 'DVY', 'IWR', 'IWS', 'IWN', 'IWO', 'QUAL', 'USMV', 'EFAV', 'MTUM', 'VLUE'
}

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

# Extract SPY close for RS Line calculation
spy_series = None
spy_df = df[df['Ticker'] == 'SPY']
if not spy_df.empty:
    spy_series = spy_df.set_index('Date')['Close']

matches = []

for ticker, group in df.groupby('Ticker'):
    if ticker in ETF_BLOCKLIST:
        continue
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 12_000_000 or curr_c < 5: 
        continue
    
    res = evaluate_deepvue_launchpad(ticker, df=group, spy_series=spy_series)
    if res:
        matches.append({
            "ticker": ticker,
            "metric": str(res["metric"]),
            "score": float(res["score"]),
            "dollar_vol": float(dvol),
            "price": float(res["price"]),
            "state": str(res["state"]),
            "state_label": str(res["state_label"]),
            "state_color": str(res["state_color"]),
            "has_pocket_pivot": bool(res["has_pocket_pivot"]),
            "has_rs_high": bool(res["has_rs_high"]),
            "entry_pivot": float(res["entry_pivot"]),
            "stop_loss": float(res["stop_loss"]),
            "risk_pct": float(res["risk_pct"]),
            "ma_spread_pct": float(res["ma_spread_pct"])
        })

matches.sort(key=lambda x: (x["score"], x["dollar_vol"]), reverse=True)
print(f"Generated {len(matches)} Upgraded DeepVue Launchpad Stock Setups")

for item in matches:
    item.pop("dollar_vol", None)

path = '/Users/amitkumar/Desktop/SectorTrackerApp/public/screener_results.json'
with open(path) as f:
    data = json.load(f)

data["deepvue_launchpad"] = matches[:50]

with open(path, 'w') as f:
    json.dump(data, f, indent=2)

print("Successfully updated public/screener_results.json with upgraded deepvue_launchpad category!")
