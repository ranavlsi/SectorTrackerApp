import sys
sys.path.append('/Users/amitkumar/Desktop/SectorTrackerApp/backend')
import duckdb
import pandas as pd
from volume_profile_scanner import calculate_volume_profile

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') ORDER BY Date").to_df()

vah_rolling_matches = []
poc_rolling_matches = []

for ticker, group in df.groupby('Ticker'):
    group = group.set_index('Date')
    if len(group) < 63: continue
    curr_c = group['Close'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 10_000_000: continue
    
    recent_63 = group.iloc[-63:]
    vp = calculate_volume_profile(recent_63)
    if not vp: continue
    
    vah = vp['vah']
    poc = vp['poc']
    val = vp['val']
    
    last_3 = recent_63.iloc[-3:]
    prior_20 = recent_63.iloc[-20:]
    
    # VAH Pullback Support:
    was_above_vah = prior_20['High'].max() >= vah * 1.015
    touched_vah = any(last_3['Low'] <= vah * 1.015) and any(last_3['Low'] >= vah * 0.98)
    bouncing_vah = curr_c >= vah * 0.99 and curr_c <= vah * 1.06
    
    if was_above_vah and touched_vah and bouncing_vah:
        dist_vah = ((curr_c - vah) / vah) * 100
        vah_rolling_matches.append({'ticker': ticker, 'metric': f"Bouncing +{dist_vah:.1f}% off VAH ${vah:.2f}", 'price': curr_c, 'vah': vah})
        
    # POC Pullback Support:
    was_above_poc = prior_20['High'].max() >= poc * 1.015
    touched_poc = any(last_3['Low'] <= poc * 1.015) and any(last_3['Low'] >= poc * 0.98)
    bouncing_poc = curr_c >= poc * 0.99 and curr_c <= poc * 1.06
    
    if was_above_poc and touched_poc and bouncing_poc:
        dist_poc = ((curr_c - poc) / poc) * 100
        poc_rolling_matches.append({'ticker': ticker, 'metric': f"Bouncing +{dist_poc:.1f}% off POC ${poc:.2f}", 'price': curr_c, 'poc': poc})

print(f"VAH Pullback Matches: {len(vah_rolling_matches)}")
for m in vah_rolling_matches[:10]:
    print("  ", m)

print(f"POC Pullback Matches: {len(poc_rolling_matches)}")
for m in poc_rolling_matches[:10]:
    print("  ", m)

