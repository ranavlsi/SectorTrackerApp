import duckdb

df = duckdb.query("SELECT Date, Open, High, Low, Close, Volume FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='RBLX' ORDER BY Date DESC LIMIT 20").to_df()
print(df.to_string())
