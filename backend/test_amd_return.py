import duckdb
df = duckdb.query("SELECT * FROM '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet' WHERE Ticker='AMD' ORDER BY Date").df()
if not df.empty:
    close = df['Close'].iloc[-1]
    close_6 = df['Close'].iloc[-6]
    ret = (close - close_6) / close_6 * 100
    print(f"AMD close: {close}, close_6: {close_6}, return_5d: {ret:.2f}%")
    print("Last 6 dates:", df['Date'].iloc[-6:].tolist())
