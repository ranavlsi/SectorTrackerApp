import duckdb

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='MQ' ORDER BY Date DESC LIMIT 750").to_df()
df = df.sort_values('Date').set_index('Date')

high_all_time = df['High'].max()
print(f"MQ All-Time High in dataset: {high_all_time}")

recent = df.iloc[-60:]
recent['SMA50'] = df['Close'].rolling(50).mean().iloc[-60:]
recent['EMA21'] = df['Close'].ewm(span=21, adjust=False).mean().iloc[-60:]

crosses_50 = 0
crosses_21 = 0

for i in range(1, len(recent)):
    prev_c = recent['Close'].iloc[i-1]
    curr_c = recent['Close'].iloc[i]
    prev_50 = recent['SMA50'].iloc[i-1]
    curr_50 = recent['SMA50'].iloc[i]
    prev_21 = recent['EMA21'].iloc[i-1]
    curr_21 = recent['EMA21'].iloc[i]
    
    if (prev_c < prev_50 and curr_c > curr_50) or (prev_c > prev_50 and curr_c < curr_50):
        crosses_50 += 1
        
    if (prev_c < prev_21 and curr_c > curr_21) or (prev_c > prev_21 and curr_c < curr_21):
        crosses_21 += 1

print(f"In the last 60 days, MQ crossed its 50 SMA {crosses_50} times.")
print(f"In the last 60 days, MQ crossed its 21 EMA {crosses_21} times.")

