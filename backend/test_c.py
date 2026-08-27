import duckdb
import pandas as pd
df = duckdb.query("SELECT * FROM '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet' WHERE Ticker='C' ORDER BY Date").df()
df['Date'] = pd.to_datetime(df['Date'])
df.set_index('Date', inplace=True)
weekly_df = df.resample('W').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()
print(weekly_df.tail(4))
