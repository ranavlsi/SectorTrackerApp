import duckdb

lake_df = duckdb.query("SELECT * FROM read_parquet('/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet') WHERE Ticker='RBLX' ORDER BY Date").to_df()
lake_df.rename(columns={'Ticker': 'symbol'}, inplace=True)
lake_df = lake_df.set_index('symbol')

df = lake_df.reset_index()
df.rename(columns={'close':'Close', 'high':'High', 'low':'Low', 'open':'Open', 'volume':'Volume'}, inplace=True)

if len(df) < 130:
    print("Failed: len(df) < 130")

base_df = df.iloc[-60:]
base_high = base_df['High'].max()
base_low = base_df['Low'].min()
base_depth = (base_high - base_low) / base_high

print(f"Base High: {base_high}, Base Depth: {base_depth}")

if base_depth > 0.35:
    print("Failed: Base Depth > 0.35")

current_close = base_df['Close'].iloc[-1]
current_volume = base_df['Volume'].iloc[-1]
print(f"Current Close: {current_close}, Volume: {current_volume}")

handle_high_15 = base_df['High'].iloc[-16:-1].max()

last_10_prev = base_df.iloc[-11:-1]
down_days_10 = last_10_prev[(last_10_prev['Close'] < last_10_prev['Open']) | 
                            (last_10_prev['Close'] < last_10_prev['Close'].shift(1))]
max_down_vol_10 = down_days_10['Volume'].max() if not down_days_10.empty else 0

is_up_day = (current_close > base_df['Open'].iloc[-1]) and (current_close > base_df['Close'].iloc[-2])
is_pocket_pivot = is_up_day and (current_volume > max_down_vol_10)

print(f"Max Down Vol: {max_down_vol_10}")
print(f"Is Up Day: {is_up_day}")
print(f"Is Pocket Pivot: {is_pocket_pivot}")

is_about_to_breakout = (current_close >= base_high * 0.85) and (current_close <= base_high)
is_confirmed_breakout = (current_close > base_high) and is_pocket_pivot

print(f"Is Confirmed Breakout: {is_confirmed_breakout}")
print(f"Is About To Breakout: {is_about_to_breakout}")
