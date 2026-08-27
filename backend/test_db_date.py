import duckdb

try:
    df = duckdb.query("SELECT MAX(Date) FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet')").to_df()
    print("Lakehouse Max Date:", df.iloc[0, 0])
except Exception as e:
    print(e)
