import duckdb
import pandas as pd

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='NBIS' ORDER BY Date").to_df()
df = df.set_index('Date')

close = df['Close']
open_p = df['Open']
high = df['High']
low = df['Low']
vol = df['Volume']
curr_c = close.iloc[-1]
vol_sma50 = vol.rolling(50).mean()

for i in range(-20, 0):
    prev_c = close.iloc[i-1]
    day_o = open_p.iloc[i]
    day_c = close.iloc[i]
    day_v = vol.iloc[i]
    avg_v = vol_sma50.iloc[i-1] if i-1 >= -len(vol_sma50) else 0
    
    if day_o > prev_c * 1.04 and day_v > avg_v * 2.5 and day_c > day_o:
        days_since = abs(i)
        gap_low = low.iloc[i]
        lowest_close_since_gap = close.iloc[i:].min()
        lowest_low_since_gap = low.iloc[i:].min()
        flag_high_real = high.iloc[i:].max()
        max_drawdown = (flag_high_real - lowest_low_since_gap) / flag_high_real
        is_holding_gap = lowest_close_since_gap >= gap_low * 0.98
        is_tight = max_drawdown <= 0.15
        print(f"i={i}, days_since={days_since}")
        print(f"gap_low: {gap_low}, lowest_close_since_gap: {lowest_close_since_gap}, is_holding_gap: {is_holding_gap}")
        print(f"flag_high_real: {flag_high_real}, lowest_low_since_gap: {lowest_low_since_gap}, max_drawdown: {max_drawdown:.3f}, is_tight: {is_tight}")
