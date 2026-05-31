import pandas as pd
from long_base_scanner import evaluate_medium_base
import duckdb

lake_df = duckdb.query("SELECT * FROM read_parquet('backend/data/daily_ohlcv.parquet') ORDER BY Date").to_df()
lake_df = lake_df.sort_values('Date')
grouped = lake_df.groupby('Ticker')

count = 0
for ticker in list(grouped.groups.keys())[:1000]: # Test 1000 stocks
    ticker_df = grouped.get_group(ticker).set_index('Date')
    res = evaluate_medium_base(ticker, pre_df=ticker_df)
    if res:
        print(f"Match: {res}")
        count += 1
print(f"Total Matches in 1000 stocks: {count}")
