import duckdb
import pandas as pd
LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'

spy_df = duckdb.query(f"SELECT Date as date, Close as close FROM '{LAKEHOUSE_PATH}' WHERE Ticker='SPY' ORDER BY Date").df()
spy_df['date'] = pd.to_datetime(spy_df['date'])
spy_df.set_index('date', inplace=True)
spy_weekly = spy_df.resample('W-FRI').last()

weekly_query = f"""
SELECT 
    Ticker as ticker,
    date_trunc('week', Date) + INTERVAL 4 DAYS as date,
    last(Close) as close,
    max(High) as high,
    min(Low) as low,
    sum(Volume) as volume
FROM '{LAKEHOUSE_PATH}'
WHERE Ticker='APPS'
GROUP BY Ticker, date_trunc('week', Date)
ORDER BY date
"""
apps_weekly = duckdb.query(weekly_query).df()
apps_weekly['date'] = pd.to_datetime(apps_weekly['date'])
apps_weekly.set_index('date', inplace=True)

weekly_52 = apps_weekly.iloc[-52:]
spy_aligned = spy_weekly.reindex(weekly_52.index).ffill()

rs_ratio = weekly_52['close'] / spy_aligned['close']
rs_ratio_normalized = rs_ratio / rs_ratio.iloc[0]

current_rs = rs_ratio_normalized.iloc[-1]
high_52_rs = rs_ratio_normalized.max()
rs_vs_high = (current_rs / high_52_rs) * 100

current_price = weekly_52['close'].iloc[-1]
high_52_price = weekly_52['high'].max()
price_vs_high = (current_price / high_52_price) * 100

high_52_idx = weekly_52['high'].argmax()
weeks_since_high = len(weekly_52) - 1 - high_52_idx

sma_10 = weekly_52['close'].rolling(10).mean().iloc[-1]
sma_40 = weekly_52['close'].rolling(40).mean().iloc[-1]
weekly_high = weekly_52['high'].iloc[-1]

print(f"APPS Stats:")
print(f"Price vs 52w High: {price_vs_high:.2f}% (Must be 60-99%)")
print(f"Weeks since High: {weeks_since_high} (Must be >= 3)")
print(f"Price / 10w MA: {current_price/sma_10:.2f} (Must be <= 1.10)")
print(f"Price / 40w MA: {current_price/sma_40:.2f} (Must be <= 1.40)")
print(f"Price / Weekly High: {current_price/weekly_high:.2f} (Must be >= 0.90)")
print(f"Current RS Normalized: {current_rs:.2f} (Overall Rank metric)")
