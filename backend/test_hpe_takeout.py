import duckdb
import pandas as pd
LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'

df = duckdb.query(f"SELECT * FROM '{LAKEHOUSE_PATH}' WHERE Ticker='HPE' ORDER BY Date").df()
df['Date'] = pd.to_datetime(df['Date'])
df.set_index('Date', inplace=True)

if len(df) < 200:
    print("Not enough daily data")
    exit()

# Resample to weekly
weekly_df = df.resample('W').agg({'Open':'first', 'High':'max', 'Low':'min', 'Close':'last', 'Volume':'sum'}).dropna()

close = df['Close']
vol = df['Volume']
curr_c = close.iloc[-1]

sma200 = close.rolling(200).mean().iloc[-1]
sma50 = close.rolling(50).mean().iloc[-1]

print(f"HPE Stage 2 Check:")
print(f"curr_c: {curr_c:.2f}, sma50: {sma50:.2f}, sma200: {sma200:.2f}")
print(f"Pass Stage 2? {curr_c > sma50 and sma50 > sma200}")

low_2 = weekly_df['Low'].iloc[-3]
low_1 = weekly_df['Low'].iloc[-2]
low_0 = weekly_df['Low'].iloc[-1]
high_2 = weekly_df['High'].iloc[-3]
takeout_high = weekly_df['High'].iloc[-2]
curr_val = weekly_df['Close'].iloc[-1]

print("\nWeekly Sequential Higher Low Check:")
print(f"low_2 (3 weeks ago): {low_2:.2f}")
print(f"low_1 (2 weeks ago): {low_1:.2f}")
print(f"low_0 (Last week):   {low_0:.2f}")
print(f"Pass Higher Lows? {low_0 > low_1 and low_1 > low_2}")

is_flat_top = takeout_high <= (high_2 * 1.05)
print(f"\nWedge Check:")
print(f"takeout_high (2 weeks ago high): {takeout_high:.2f}")
print(f"high_2 (3 weeks ago high): {high_2:.2f}")
print(f"is_flat_top (takeout <= high_2 * 1.05)? {is_flat_top}")

if curr_val > takeout_high:
    adv_50 = vol.rolling(50).mean().iloc[-1]
    curr_vol = vol.iloc[-1]
    print(f"\nBreakout Check:")
    print(f"curr_val: {curr_val:.2f} > takeout_high: {takeout_high:.2f}")
    print(f"curr_vol: {curr_vol} >= adv_50*1.5: {adv_50*1.5}")
    print(f"Pass Breakout Volume? {curr_vol >= adv_50 * 1.5}")
else:
    distance = ((takeout_high - curr_val) / takeout_high) * 100
    print(f"\nAwaiting Takeout Check:")
    print(f"distance to takeout: {distance:.2f}%")
    print(f"Pass Awaiting? {distance < 10.0}")
