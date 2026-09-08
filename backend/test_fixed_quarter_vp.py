import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb
import pandas as pd
from volume_profile_scanner import calculate_volume_profile, evaluate_level_bounce

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

fixed_vah_matches = []
fixed_poc_matches = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    curr_c = group['Close'].iloc[-1]
    curr_o = group['Open'].iloc[-1]
    curr_l = group['Low'].iloc[-1]
    curr_h = group['High'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000: continue
    if curr_c < 10: continue
    
    date_series = group.index
    last_date = pd.to_datetime(date_series[-1])
    quarter = (last_date.month - 1) // 3 + 1
    start_month = 3 * quarter - 2
    start_of_quarter = pd.Timestamp(year=last_date.year, month=start_month, day=1)
    
    fixed_df = group[pd.to_datetime(date_series) >= start_of_quarter].copy()
    if len(fixed_df) < 15: continue
    
    vp_fixed = calculate_volume_profile(fixed_df, bins=100, va_pct=0.70)
    if not vp_fixed: continue
    
    vah_res = evaluate_level_bounce(vp_fixed['vah'], fixed_df, curr_c, curr_o, curr_l, curr_h, f"Fixed VAH (Q{quarter})")
    if vah_res:
        fixed_vah_matches.append({'ticker': ticker, 'metric': vah_res['message'], 'score': vah_res['score']})
        
    poc_res = evaluate_level_bounce(vp_fixed['poc'], fixed_df, curr_c, curr_o, curr_l, curr_h, f"Fixed POC (Q{quarter})")
    if poc_res:
        fixed_poc_matches.append({'ticker': ticker, 'metric': poc_res['message'], 'score': poc_res['score']})

print(f"Fixed Calendar Quarter VAH Rejections: {len(fixed_vah_matches)}")
fixed_vah_matches.sort(key=lambda x: x['score'], reverse=True)
for m in fixed_vah_matches[:8]:
    print("  ", m)

print(f"\nFixed Calendar Quarter POC Rejections: {len(fixed_poc_matches)}")
fixed_poc_matches.sort(key=lambda x: x['score'], reverse=True)
for m in fixed_poc_matches[:8]:
    print("  ", m)

