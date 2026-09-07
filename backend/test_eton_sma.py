import duckdb
import pandas as pd
import json

with open('/Users/amitkumar/Desktop/SectorTrackerApp/public/deepvue_results.json', 'r') as f:
    d = json.load(f)
    eton_in_leaders = any(x['ticker'] == 'ETON' for x in d.get('leaders', []))
    print(f"Is ETON in leaders? {eton_in_leaders}")

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='ETON' ORDER BY Date DESC LIMIT 60").to_df()
df = df.sort_values('Date').set_index('Date')

close = df['Close']
sma_50 = close.rolling(50).mean()

current_price = close.iloc[-1]
current_50sma = sma_50.iloc[-1]

print(f"ETON Current Price: {current_price}")
print(f"ETON 50 SMA: {current_50sma}")

aligned = (current_price > current_50sma)
print(f"Is Price > 50 SMA? {aligned}")
