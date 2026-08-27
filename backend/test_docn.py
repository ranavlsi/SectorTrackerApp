import duckdb
import pandas as pd
df = duckdb.query("SELECT * FROM '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet' WHERE Ticker='DOCN' ORDER BY Date").df()
df['Daily_Range_Pct'] = (df['High'] - df['Low']) / df['Close'].shift(1)
adr_20 = df['Daily_Range_Pct'].rolling(window=20).mean().iloc[-2] * 100
df['SMA_50_Vol'] = df['Volume'].rolling(window=50).mean()
max_vol_ratio = (df['Volume'] / df['SMA_50_Vol']).iloc[-40:].max()
print(f"DOCN ADR: {adr_20:.2f}%")
print(f"DOCN Max Vol Thrust: {max_vol_ratio:.1f}x")
