import duckdb
LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
lake_df = duckdb.query(f"SELECT DISTINCT Ticker FROM read_parquet('{LAKEHOUSE_PATH}')").to_df()
print(f"Total Tickers in Lakehouse: {len(lake_df)}")
