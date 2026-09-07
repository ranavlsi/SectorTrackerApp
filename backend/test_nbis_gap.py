import duckdb
import pandas as pd
import json

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='NBIS' ORDER BY Date").to_df()
df = df.set_index('Date')

close = df['Close']
open_p = df['Open']
high = df['High']
low = df['Low']
vol = df['Volume']

curr_c = close.iloc[-1]
curr_h = high.iloc[-1]

vol_sma50 = vol.rolling(50).mean()

print(f"Current Close: {curr_c}")

for i in range(-20, 0):
    prev_c = close.iloc[i-1]
    day_o = open_p.iloc[i]
    day_c = close.iloc[i]
    day_v = vol.iloc[i]
    avg_v = vol_sma50.iloc[i-1] if i-1 >= -len(vol_sma50) else 0
    
    if day_o > prev_c * 1.04 and day_v > avg_v * 2.5 and day_c > day_o:
        days_since = abs(i)
        if 5 < days_since <= 20:
            print(f"Gap found at index {i} ({days_since} days ago).")
            print(f"Prev Close: {prev_c}, Day Open: {day_o}, Day Close: {day_c}, Gap: {((day_o/prev_c)-1)*100:.1f}%")
            print(f"Vol: {day_v}, Avg Vol: {avg_v} (Ratio: {day_v/avg_v:.2f})")
            
            gap_low = low.iloc[i]
            flag_high = high.iloc[i:i+4].max() if len(high.iloc[i:]) >= 4 else high.iloc[i:].max()
            print(f"Gap Low: {gap_low}, Flag High: {flag_high}")
            
            cond1 = curr_c > gap_low
            cond2 = high.iloc[i:].max() < day_c * 1.10
            cond3 = curr_c <= flag_high * 1.01
            print(f"Cond1 (Curr {curr_c} > Gap Low {gap_low}): {cond1}")
            print(f"Cond2 (Max {high.iloc[i:].max()} < Day Close 1.1x {day_c * 1.10}): {cond2}")
            print(f"Cond3 (Curr {curr_c} <= Flag High 1.01x {flag_high * 1.01}): {cond3}")
            
            if cond1 and cond2 and cond3:
                print(">>> PASSED POST EARNING CONSOLIDATION <<<")

