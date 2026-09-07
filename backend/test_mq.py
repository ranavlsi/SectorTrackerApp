import duckdb

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='MQ' ORDER BY Date DESC LIMIT 250").to_df()
df = df.sort_values('Date').set_index('Date')

ema_21 = df['Close'].ewm(span=21, adjust=False).mean().iloc[-1]
sma_50 = df['Close'].rolling(50).mean().iloc[-1]
sma_200 = df['Close'].rolling(200).mean().iloc[-1]
current_price = df['Close'].iloc[-1]

high_52w = df['High'].max()

print(f"MQ Current Price: {current_price}")
print(f"MQ 21 EMA: {ema_21}")
print(f"MQ 50 SMA: {sma_50}")
print(f"MQ 200 SMA: {sma_200}")
print(f"MQ 52w High: {high_52w}")
print(f"% off 52w High: {((high_52w - current_price) / high_52w) * 100:.2f}%")

# Let's check 200 SMA slope
sma_200_1m_ago = df['Close'].rolling(200).mean().iloc[-20]
print(f"MQ 200 SMA 1 month ago: {sma_200_1m_ago}")

