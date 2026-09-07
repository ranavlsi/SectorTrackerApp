import duckdb

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='MQ' ORDER BY Date DESC LIMIT 250").to_df()
df = df.sort_values('Date').set_index('Date')

hist = df
current_price = hist['Close'].iloc[-1]
ema_21 = hist['Close'].ewm(span=21, adjust=False).mean()
sma_50 = hist['Close'].rolling(50).mean()
sma_200 = hist['Close'].rolling(200).mean()

aligned = (current_price > ema_21.iloc[-1]) and (ema_21.iloc[-1] > sma_50.iloc[-1]) and (sma_50.iloc[-1] > sma_200.iloc[-1])
print(f"Aligned: {aligned}")

recent_closes = hist['Close'].iloc[-20:]
recent_50s = sma_50.iloc[-20:]
days_above_50 = sum(recent_closes > recent_50s)
print(f"Days above 50 SMA (last 20): {days_above_50}")

sma200_1m_ago = sma_200.iloc[-20]
sma50_1m_ago = sma_50.iloc[-20]
print(f"SMA 200 > 1m ago: {sma_200.iloc[-1] > sma200_1m_ago}")
print(f"SMA 50 > 1m ago: {sma_50.iloc[-1] > sma50_1m_ago}")

high_52w = hist['High'].rolling(250).max().iloc[-1]
print(f"Current price within 25% of 52w high: {current_price >= high_52w * 0.75}")

