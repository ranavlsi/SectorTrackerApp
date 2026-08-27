import duckdb
import pandas as pd
df = duckdb.query("SELECT * FROM '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet' WHERE Ticker='MRVL' ORDER BY Date").df()
df['Date'] = pd.to_datetime(df['Date'])
df.set_index('Date', inplace=True)
weekly_df = df.resample('W').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
print(weekly_df.tail(4))

high_2 = weekly_df['High'].iloc[-3]
high_1 = weekly_df['High'].iloc[-2]
takeout_high = max(high_1, high_2)
curr_val = weekly_df['Close'].iloc[-1]

print(f"\nhigh_2: {high_2}")
print(f"high_1: {high_1}")
print(f"takeout_high: {takeout_high}")
print(f"curr_val: {curr_val}")
distance = ((takeout_high - curr_val) / takeout_high) * 100
print(f"distance: {distance}%")

