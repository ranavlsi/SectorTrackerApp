import duckdb
import pandas as pd

LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
df = duckdb.query(f"SELECT * FROM read_parquet('{LAKEHOUSE_PATH}') WHERE Ticker='AVGO' ORDER BY Date DESC LIMIT 60").to_df()
df = df.sort_values('Date').set_index('Date')

close = df['Close']
high = df['High']
low = df['Low']

sma10 = close.rolling(10).mean().iloc[-1]
sma20 = close.rolling(20).mean().iloc[-1]
sma50 = close.rolling(50).mean().iloc[-1]

curr_low = low.iloc[-1]
curr_close = close.iloc[-1]

print(f"Current Low: {curr_low}, Current Close: {curr_close}")
print(f"SMA 10: {sma10}, SMA 20: {sma20}, SMA 50: {sma50}")

recent_fvg = None
for i in range(-21, -1):
    c_post_low = low.iloc[i]
    c_pre_high = high.iloc[i-2]
    
    if c_post_low > c_pre_high:
        gap_bottom = c_pre_high
        gap_top = c_post_low
        gap_size_pct = ((gap_top - gap_bottom) / gap_bottom) * 100
        
        if gap_size_pct > 0.5:
            print(f"Found FVG at index {i}: Gap {gap_bottom:.2f} - {gap_top:.2f} ({gap_size_pct:.2f}%)")
            recent_fvg = (gap_bottom, gap_top)

if recent_fvg:
    gap_bottom, gap_top = recent_fvg
    testing_gap = (curr_low <= gap_top * 1.01) and (curr_close >= gap_bottom * 0.99)
    print(f"Testing gap: {testing_gap} (Curr Low {curr_low} <= {gap_top * 1.01} AND Curr Close {curr_close} >= {gap_bottom * 0.99})")
    
    smas = {'10-day': sma10, '20-day': sma20, '50-day': sma50}
    for name, val in smas.items():
        if val >= gap_bottom * 0.99 and val <= gap_top * 1.01:
            print(f"SMA Confluence Found: {name} at {val:.2f} inside {gap_bottom * 0.99:.2f} - {gap_top * 1.01:.2f}")

