import duckdb

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='MQ' ORDER BY Date DESC LIMIT 300").to_df()
df = df.sort_values('Date').set_index('Date')

sma50 = df['Close'].rolling(50).mean().iloc[-1]
sma150 = df['Close'].rolling(150).mean().iloc[-1]
sma200 = df['Close'].rolling(200).mean().iloc[-1]
sma200_1m = df['Close'].rolling(200).mean().iloc[-20]

curr = df['Close'].iloc[-1]
low52 = df['Low'].rolling(250).min().iloc[-1]
high52 = df['High'].rolling(250).max().iloc[-1]

print(f"1. Curr {curr} > 150 ({sma150}) & 200 ({sma200}): {curr > sma150 and curr > sma200}")
print(f"2. 150 ({sma150}) > 200 ({sma200}): {sma150 > sma200}")
print(f"3. 200 SMA trending up: {sma200 > sma200_1m}")
print(f"4. 50 ({sma50}) > 150 ({sma150}) & 200 ({sma200}): {sma50 > sma150 and sma50 > sma200}")
print(f"5. Curr {curr} > 50 ({sma50}): {curr > sma50}")
print(f"6. Curr {curr} > 30% off 52w low ({low52}): {curr > low52 * 1.3}")
print(f"7. Curr {curr} within 25% of 52w high ({high52}): {curr >= high52 * 0.75}")

