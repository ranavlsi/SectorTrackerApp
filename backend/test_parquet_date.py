import duckdb
con = duckdb.connect()
LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
max_date = con.execute(f"SELECT MAX(Date) FROM '{LAKEHOUSE_PATH}'").fetchone()[0]
print(f"Max date in parquet: {max_date}")
