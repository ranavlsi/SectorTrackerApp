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
    curr_o = group['Open'].iloc[-1]
    vol = group['Volume']
    dvol = float(curr_c * vol.iloc[-20:].mean())
    if dvol < 15_000_000: continue
    if curr_c < 10: continue
    
    recent_63 = group.iloc[-63:]
    vp = calculate_volume_profile(recent_63)
    if not vp: continue
    
    vah = vp['vah']
    poc = vp['poc']
    val = vp['val']
    
    last_3 = recent_63.iloc[-3:]
    prior_20 = recent_63.iloc[-20:]
    
    # 1. VAH Pullback Rejection (Bullish bounce after pullback to VAH)
    # Must have traded clearly above VAH within last 20 days (e.g. at least 2% above)
    was_above_vah = prior_20['High'].max() >= vah * 1.02
    # In last 3 days, low probed near or into VAH (down to -1.5% below VAH, up to +1% above VAH)
    tested_vah = any((last_3['Low'] <= vah * 1.01) & (last_3['Low'] >= vah * 0.985))
    # Today or yesterday closed above VAH, confirming the level held
    bounced_vah = curr_c > vah and curr_c <= vah * 1.05 and (curr_c >= curr_o * 0.99)
    
    if was_above_vah and tested_vah and bounced_vah:
        dist_vah = ((curr_c - vah) / vah) * 100
        vah_rolling_matches.append({
            'ticker': ticker,
            'metric': f"Bouncing +{dist_vah:.1f}% off VAH ${vah:.2f}",
            'score': round(100.0 - dist_vah, 1)
        })
        
    # 2. POC Pullback Rejection (Bullish bounce after pullback to POC)
    # Price was previously higher above POC
    was_above_poc = prior_20['High'].max() >= poc * 1.025
    # Tested POC in last 3 days
    tested_poc = any((last_3['Low'] <= poc * 1.01) & (last_3['Low'] >= poc * 0.985))
    # Closed above POC, showing institutional bid
    bounced_poc = curr_c > poc and curr_c <= poc * 1.05 and (curr_c >= curr_o * 0.99)
    
    if was_above_poc and tested_poc and bounced_poc:
        dist_poc = ((curr_c - poc) / poc) * 100
        poc_rolling_matches.append({
            'ticker': ticker,
            'metric': f"Bouncing +{dist_poc:.1f}% off POC ${poc:.2f}",
            'score': round(100.0 - dist_poc, 1)
        })

print(f"Refined VAH Pullback Matches (Liquid $15M, Price > $10): {len(vah_rolling_matches)}")
vah_rolling_matches.sort(key=lambda x: x['score'], reverse=True)
for m in vah_rolling_matches[:15]:
    print("  ", m)

print(f"\nRefined POC Pullback Matches (Liquid $15M, Price > $10): {len(poc_rolling_matches)}")
poc_rolling_matches.sort(key=lambda x: x['score'], reverse=True)
for m in poc_rolling_matches[:15]:
    print("  ", m)

