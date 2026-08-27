import duckdb
LAKEHOUSE_PATH = '/Users/amitkumar/Desktop/SectorTrackerApp/backend/data/daily_ohlcv.parquet'
weekly_query = f"""
SELECT 
    Ticker as ticker,
    date_trunc('week', Date) + INTERVAL 4 DAYS as date,
    last(Close) as close,
    max(High) as high,
    min(Low) as low,
    sum(Volume) as volume
FROM '{LAKEHOUSE_PATH}'
WHERE Ticker='AAPL'
GROUP BY Ticker, date_trunc('week', Date)
ORDER BY date
"""
df = duckdb.query(weekly_query).df()
print(df.tail(5))
