import duckdb
import pandas as pd

lake_df = duckdb.query("SELECT * FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='RBLX' ORDER BY Date").to_df()
high = lake_df['High']
low = lake_df['Low']
close = lake_df['Close']
vol = lake_df['Volume']

curr_c = close.iloc[-1]

print("--- Checking Medium Base Breakout (20-day) ---")
base_20_highs = high.iloc[-25:-5]
pivot_20 = base_20_highs.max()
print(f"20-day Pivot: {pivot_20}")
if curr_c > pivot_20:
    base_20_lows = low.iloc[-25:-5]
    base_20_depth = (pivot_20 - base_20_lows.min()) / pivot_20
    print(f"Base Depth: {base_20_depth} (Needs < 0.25)")
    avg_vol_20 = vol.iloc[-20:].mean()
    vol_surge = vol.iloc[-1] > avg_vol_20 * 1.5
    print(f"Vol Surge: {vol.iloc[-1]} > {avg_vol_20 * 1.5} -> {vol_surge}")
    recent_resistance_touches = (base_20_highs >= pivot_20 * 0.98).sum()
    print(f"Touches: {recent_resistance_touches} (Needs >= 2)")
    
print("\n--- Checking Long Base Breakout (60-day) ---")
base_60_highs = high.iloc[-65:-5]
pivot_60 = base_60_highs.max()
print(f"60-day Pivot: {pivot_60}")
if curr_c > pivot_60:
    base_60_lows = low.iloc[-65:-5]
    base_depth = (pivot_60 - base_60_lows.min()) / pivot_60
    print(f"Base Depth: {base_depth} (Needs < 0.35)")
    vol_surge = vol.iloc[-1] > vol.iloc[-50:].mean() * 1.5
    print(f"Vol Surge: {vol.iloc[-1]} > {vol.iloc[-50:].mean() * 1.5} -> {vol_surge}")
    
print("\n--- Checking HVE Breakout ---")
hve_vol = vol.iloc[-1] > vol.iloc[-20:].mean() * 2.5
print(f"HVE Vol: {vol.iloc[-1]} > {vol.iloc[-20:].mean() * 2.5} -> {hve_vol}")

from darvas_box_scanner import calculate_darvas_box
try:
    db_status, db_top, db_bottom, db_msg = calculate_darvas_box(lake_df)
    print(f"\n--- Checking Darvas ---")
    print(f"Darvas Status: {db_status}, Top: {db_top}")
except Exception as e:
    print(f"Darvas Error: {e}")

