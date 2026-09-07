import duckdb

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='NBIS' ORDER BY Date").to_df()
df = df.set_index('Date')
recent = df.iloc[-20:]

for idx, (date, row) in enumerate(recent.iterrows()):
    print(f"{date}: Open: {row['Open']:.2f}, High: {row['High']:.2f}, Low: {row['Low']:.2f}, Close: {row['Close']:.2f}")

