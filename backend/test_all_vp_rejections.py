import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb
import pandas as pd
from volume_profile_scanner import calculate_volume_profile

def evaluate_level_bounce(level, df_slice, curr_c, curr_o, level_name):
    last_3 = df_slice.iloc[-3:]
    prior_20 = df_slice.iloc[-20:]
    
    # Must have come from above the level (prior peak was clearly above)
    was_above = prior_20['High'].max() >= level * 1.015
    # Low probed into or right around the level (-1.5% to +1.0%)
    tested_level = any((last_3['Low'] <= level * 1.01) & (last_3['Low'] >= level * 0.985))
    # Closed above the level, actively rejecting/bouncing up to +5%
    bouncing = curr_c >= level * 0.995 and curr_c <= level * 1.06 and (curr_c >= curr_o * 0.99)
    
    if was_above and tested_level and bouncing:
        dist = ((curr_c - level) / level) * 100
        score = round(100.0 - dist, 1)
        return {
            'dist': dist,
            'score': score,
            'metric': f"Bouncing +{dist:.1f}% off {level_name} ${level:.2f}"
        }
    return None

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

vah_results = []
poc_results = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    if len(group) < 63: continue
    curr_c = group['Close'].iloc[-1]
    curr_o = group['Open'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000: continue
    if curr_c < 10: continue
    
    recent_63 = group.iloc[-63:]
    vp = calculate_volume_profile(recent_63)
    if not vp: continue
    
    vah_res = evaluate_level_bounce(vp['vah'], recent_63, curr_c, curr_o, "VAH")
    if vah_res:
        vah_results.append({'ticker': ticker, 'metric': vah_res['metric'], 'score': vah_res['score']})
        
    poc_res = evaluate_level_bounce(vp['poc'], recent_63, curr_c, curr_o, "POC")
    if poc_res:
        poc_results.append({'ticker': ticker, 'metric': poc_res['metric'], 'score': poc_res['score']})

vah_results.sort(key=lambda x: x['score'], reverse=True)
poc_results.sort(key=lambda x: x['score'], reverse=True)

print(f"VAH Rejections: {len(vah_results)}")
for r in vah_results[:8]:
    print("  ", r)

print(f"POC Rejections: {len(poc_results)}")
for r in poc_results[:8]:
    print("  ", r)

