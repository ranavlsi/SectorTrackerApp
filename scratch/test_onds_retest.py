import pandas as pd
import duckdb

df = duckdb.query("SELECT * FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='ONDS' ORDER BY Date").to_df()

close = df['Close']
high = df['High']
low = df['Low']
vol = df['Volume']

curr_c = close.iloc[-1]
dollar_vol = curr_c * vol.iloc[-20:].mean()

daily_range_pct = (high.iloc[-14:] - low.iloc[-14:]) / close.iloc[-14:]
adr_pct = daily_range_pct.mean() * 100

print(f"ONDS Dollar Vol: ${dollar_vol:,.2f}")
print(f"ONDS ADR %: {adr_pct:.2f}%")
