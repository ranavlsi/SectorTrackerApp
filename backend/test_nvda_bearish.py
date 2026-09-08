import duckdb
import pandas as pd

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='NVDA' ORDER BY Date").to_df()
df = df.set_index('Date')
row = df.iloc[-1]
curr_o, curr_h, curr_l, curr_c = row['Open'], row['High'], row['Low'], row['Close']
print(f"Open: {curr_o}, High: {curr_h}, Low: {curr_l}, Close: {curr_c}")
print(f"Is Green? {curr_c >= curr_o} ({curr_c} vs {curr_o})")
candle_range = curr_h - curr_l
close_in_upper = (curr_c - curr_l) >= (candle_range * 0.45)
print(f"Close in upper 45%? {close_in_upper} (dist from low: {curr_c - curr_l}, 45% range: {candle_range * 0.45})")
