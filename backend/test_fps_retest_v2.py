import duckdb
import pandas as pd

lake_df = duckdb.query("SELECT * FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='FPS' ORDER BY Date").to_df()
high = lake_df['High']
low = lake_df['Low']
close = lake_df['Close']

base_highs = high.iloc[-70:-10]
pivot = base_highs.max()
recent_data = high.iloc[-10:-1]
recent_high = recent_data.max()

days_below_pivot = (base_highs < pivot * 0.99).sum()
is_true_base = days_below_pivot >= 15

peak_idx = recent_data.values.argmax() 
days_since_peak = len(recent_data) - peak_idx

pullback_min_low = low.iloc[-days_since_peak:].min()
did_not_violate = pullback_min_low >= pivot * 0.96

print(f"Is True Base: {is_true_base} (Days below pivot: {days_below_pivot})")
print(f"Did Not Violate: {did_not_violate} (Pullback Min Low: {pullback_min_low}, Threshold: {pivot * 0.96})")

